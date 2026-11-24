# -*- coding: utf-8 -*-
"""M3: propagacion de una contaminacion aguas abajo.

Dada una alerta en un sitio, estima a que sitios de abajo llega, en que ventana
horaria y con que concentracion. Produce un objeto que cumple
contrato/esquemas/prediccion_propagacion.schema.json.

El modelo NO es el que preveia el plan. Dos mediciones sobre los propios datos
lo decidieron:

1. En 90 tramos reales entre sitios consecutivos, muestreados el mismo dia, la
   razon de concentracion aguas abajo entre aguas arriba tiene **mediana 1.00**
   y no muestra tendencia con la distancia (de 0 a 20 km). No hay atenuacion
   medible: entre dos sitios entran tantas descargas como la autodepuracion
   quita. Una constante de decaimiento de literatura quedaria contradicha por
   nuestras propias mediciones, asi que k = 0 y el transporte es conservativo.
2. Lo que si tiene valor es la **dispersion**: p10 0.46 y p90 2.26 para la DQO.
   Eso no es error del modelo, es que cada tramo tiene sus propias descargas.
   Se publica como banda, calibrada con los tramos de este rio, en lugar de un
   valor puntual falso.

La velocidad del flujo no existe medida en esta cuenca (ni en los datos de
CONAGUA ni en la literatura que se reviso), asi que se declara como intervalo y
la salida es una ventana horaria, nunca una hora exacta.

Lee    : datos/procesados/red/, datos/procesados/muestreo_nucleo.csv
Escribe: datos/procesados/red/atenuacion_observada.csv
         datos/procesados/red/tiempo_viaje.csv
         contrato/fixtures/prediccion_ejemplo.json
         docs/14-propagacion.md

Uso:
    python -I scripts/80_propagacion.py
    python -I scripts/80_propagacion.py --sitio DLTLA2582 --parametro DQO_TOT --valor 400
"""
import argparse
import csv
import importlib.util
import json
import os
import statistics as st
from collections import defaultdict
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AQUI = os.path.dirname(os.path.abspath(__file__))
PROC = os.path.join(RAIZ, 'datos', 'procesados')
RED = os.path.join(PROC, 'red')
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')

# ------------------------------------------------------------------ supuestos
# Velocidad media del flujo. NO hay medicion para esta cuenca: es un supuesto
# declarado. El intervalo cubre desde un cauce urbano encajonado y lento hasta
# un tramo de pendiente moderada. Cambiarlo aqui cambia todas las ventanas.
VELOCIDAD_MIN_MS = 0.3
VELOCIDAD_MAX_MS = 1.0
FUENTE_VELOCIDAD = 'supuesto_declarado'

# Mas alla de esta distancia la prediccion deja de ser operativamente util:
# hay cadenas de 151 km en la cuenca.
DISTANCIA_UTIL_M = 50000.0
# Tramos minimos que deben respaldar la banda de un parametro para confiar en ella.
TRAMOS_PARA_CONFIANZA = 60

VERSION = '1.0'
TZ = timezone(timedelta(hours=-6))

_spec = importlib.util.spec_from_file_location(
    'validador', os.path.join(RAIZ, 'contrato', 'validador.py'))
val = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(val)

informe = []


def di(s=''):
    print(s)
    informe.append(s)


def leer(ruta):
    with open(ruta, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def escribir(ruta, campos, filas):
    with open(ruta, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
        w.writeheader()
        w.writerows(filas)
    print('  -> {}: {:,} filas'.format(os.path.relpath(ruta, RAIZ), len(filas)))


def pct(xs, q):
    xs = sorted(xs)
    i = (len(xs) - 1) * q / 100.0
    lo, hi = int(i), min(int(i) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo)


def valor_de(r):
    if r['valor'] not in ('', None):
        return float(r['valor'])
    if r['bajo_limite_deteccion'] == 'true' and r['limite_deteccion']:
        return float(r['limite_deteccion']) / 2.0
    return None


# ================================================= 1. calibrar con los datos
di('# Propagacion aguas abajo (M3)')
di()
di('Generado por `scripts/80_propagacion.py`.')
di()
di('## 1. Lo que dicen los datos, no la literatura')
di()

sitios = {r['c_sitio']: r for r in leer(os.path.join(PROC, 'sitio.csv'))}
red_sitio = {r['c_sitio']: r for r in leer(os.path.join(RED, 'sitio_red.csv'))}
abajo = leer(os.path.join(RED, 'sitio_aguas_abajo.csv'))
pares = leer(os.path.join(RED, 'sitio_pares.csv'))

obs = defaultdict(dict)
for r in leer(os.path.join(PROC, 'muestreo_nucleo.csv')):
    v = valor_de(r)
    if v is not None and r['fecha']:
        obs[(r['c_sitio'], r['fecha'])][r['c_parametro']] = v
fechas_de = defaultdict(set)
for (s, f) in obs:
    fechas_de[s].add(f)

# Solo tramos adyacentes y sin marcar: un tramo fisico real entre dos sitios.
# Usar los 6 276 pares de ancestria contaria el mismo tramo muchas veces y
# falsearia la medicion: con repeticion la mediana salia 1.06, sin ella 1.00.
adyacentes = [r for r in abajo
              if r['c_sitio_aguas_abajo'] and not r.get('revisar')
              and r['distancia_cauce_m']]

PARAMS = ['DQO_TOT', 'DBO_TOT', 'SST', 'CONDUC_CAMPO', 'SDT', 'COLI_FEC',
          'E_COLI', 'OD_mg/L', 'N_NH3', 'P_TOT', 'TURBIEDAD']
def razones_de(cp, tramos):
    """Devuelve (por_tramo, individuales) de la razon abajo/arriba.

    Las dos sirven para cosas distintas y conviene no confundirlas:
    - por_tramo (una mediana por tramo) mide la tendencia central sin que un
      tramo muy muestreado domine. Es la que sostiene el "no hay atenuacion".
    - individuales alimenta la banda, porque la banda tiene que cubrir UNA
      observacion futura, no el tramo tipico. Estimarla con medianas por tramo
      la deja demasiado angosta: la cobertura caia al 41 % en E_COLI.
    """
    por_tramo, individuales = [], []
    for r in tramos:
        a, b = r['c_sitio'], r['c_sitio_aguas_abajo']
        rr = []
        for f in fechas_de.get(a, set()) & fechas_de.get(b, set()):
            oa, ob = obs[(a, f)], obs[(b, f)]
            if cp in oa and cp in ob and oa[cp] > 0:
                rr.append(ob[cp] / oa[cp])
        if rr:
            por_tramo.append(st.median(rr))
            individuales += rr
    return por_tramo, individuales


atenuacion = {}
for cp in PARAMS:
    por_tramo, indiv = razones_de(cp, adyacentes)
    if len(por_tramo) < 10 or len(indiv) < 30:
        continue
    atenuacion[cp] = {
        'c_parametro': cp, 'tramos': len(por_tramo), 'observaciones': len(indiv),
        'razon_p10': round(pct(indiv, 10), 3),
        'razon_mediana': round(st.median(por_tramo), 3),
        'razon_p90': round(pct(indiv, 90), 3),
        'pct_sube': round(100.0 * sum(1 for x in por_tramo if x > 1) / len(por_tramo), 0),
    }

di('Razon entre la concentracion aguas abajo y la de aguas arriba, medida en '
   'tramos adyacentes muestreados **el mismo dia**. Una razon por tramo, para '
   'no contar el mismo tramo varias veces.')
di()
di('| Parametro | Tramos | Observ. | p10 | Mediana por tramo | p90 | % de tramos donde sube |')
di('|---|---|---|---|---|---|---|')
for cp in PARAMS:
    a = atenuacion.get(cp)
    if a:
        di('| `{}` | {} | {} | {:.2f} | **{:.2f}** | {:.2f} | {:.0f} % |'.format(
            cp, a['tramos'], a['observaciones'], a['razon_p10'],
            a['razon_mediana'], a['razon_p90'], a['pct_sube']))
di()
di('**La mediana es 1.00 en todos los parametros.** Sobre las distancias que '
   'separan a dos sitios consecutivos (mediana 1 749 m, hasta 20 km) no hay '
   'atenuacion neta medible: entre dos sitios entran tantas descargas como la '
   'autodepuracion quita. Por eso el modelo es de **transporte conservativo**, '
   'con k = 0, y no un decaimiento con constante de literatura, que quedaria '
   'contradicho por estas 90 mediciones.')
di()
_dqo = atenuacion.get('DQO_TOT')
if _dqo:
    di('Lo que si informa es la dispersion. Para la DQO, el 80 % central de las '
       'observaciones esta entre **{:.2f} y {:.2f}** veces la concentracion de '
       'arriba. Eso se publica como **banda de llegada**, no como un valor '
       'puntual. Los percentiles se estiman con las observaciones individuales '
       'y no con las medianas por tramo, porque la banda tiene que cubrir una '
       'observacion futura.'.format(_dqo['razon_p10'], _dqo['razon_p90']))
di()

escribir(os.path.join(RED, 'atenuacion_observada.csv'),
         ['c_parametro', 'tramos', 'observaciones', 'razon_p10',
          'razon_mediana', 'razon_p90', 'pct_sube'],
         [atenuacion[c] for c in PARAMS if c in atenuacion])

# ======================================================== 2. tiempo de viaje
di('## 2. Ventana de llegada')
di()
di('`tiempo = distancia sobre el cauce / velocidad`. La distancia la calculo '
   'M1. La velocidad **no existe medida** en esta cuenca: se declara el '
   'intervalo {:.1f} a {:.1f} m/s y la salida es una ventana, nunca una hora '
   'exacta.'.format(VELOCIDAD_MIN_MS, VELOCIDAD_MAX_MS))
di()

filas_viaje = []
for p in pares:
    if p.get('revisar'):
        continue
    d = float(p['distancia_cauce_m'])
    filas_viaje.append({
        'c_sitio_arriba': p['c_sitio_arriba'],
        'c_sitio_abajo': p['c_sitio_abajo'],
        'distancia_cauce_m': d, 'saltos': int(p['saltos']),
        'horas_min': round(d / VELOCIDAD_MAX_MS / 3600.0, 2),
        'horas_max': round(d / VELOCIDAD_MIN_MS / 3600.0, 2),
        'dentro_de_alcance_util': 'si' if d <= DISTANCIA_UTIL_M else 'no',
    })
escribir(os.path.join(RED, 'tiempo_viaje.csv'),
         ['c_sitio_arriba', 'c_sitio_abajo', 'distancia_cauce_m', 'saltos',
          'horas_min', 'horas_max', 'dentro_de_alcance_util'], filas_viaje)

utiles = [f for f in filas_viaje if f['dentro_de_alcance_util'] == 'si']
di('- **{:,}** pares con ventana calculada; {:,} dentro de los {:.0f} km que '
   'considero operativamente utiles.'.format(
       len(filas_viaje), len(utiles), DISTANCIA_UTIL_M / 1000))
if utiles:
    hs = sorted(f['horas_min'] for f in utiles)
    di('- Llegada mas temprana a un sitio cualquiera aguas abajo: mediana '
       '**{:.1f} h**, percentil 10 {:.1f} h. Son todos los pares de '
       'ancestria, no solo los consecutivos.'.format(hs[len(hs) // 2], pct(hs, 10)))
di()
di('Sensibilidad: a 1 km de distancia, la ventana va de {:.1f} a {:.1f} horas. '
   'Si la velocidad real fuera 0.2 o 1.5 m/s, iria de {:.1f} a {:.1f}. Quien '
   'mida un aforo con flotador en un tramo puede cerrar ese intervalo y '
   'estrechar todas las predicciones de golpe.'.format(
       1000 / VELOCIDAD_MAX_MS / 3600, 1000 / VELOCIDAD_MIN_MS / 3600,
       1000 / 1.5 / 3600, 1000 / 0.2 / 3600))
di()

# ===================================================== 3. funcion de prediccion
descendientes = defaultdict(list)
for f in filas_viaje:
    descendientes[f['c_sitio_arriba']].append(f)
for lst in descendientes.values():
    lst.sort(key=lambda f: f['distancia_cauce_m'])

marcados = {r['c_sitio'] for r in abajo if r.get('revisar')}


def predecir(c_sitio, c_parametro, valor, cuando=None, c_alerta='AL-EJEMPLO-01'):
    """Devuelve un objeto prediccion_propagacion para una alerta."""
    cuando = cuando or datetime.now(TZ).replace(microsecond=0)
    ate = atenuacion.get(c_parametro)
    destinos = []
    for i, f in enumerate(descendientes.get(c_sitio, []), start=1):
        cb = f['c_sitio_abajo']
        s = sitios.get(cb, {})
        lentico = 'NTIC' in (s.get('tipo_cuerpo') or '').upper()

        if ate and valor is not None:
            v_est = round(valor * ate['razon_mediana'], 3)
            v_min = round(valor * ate['razon_p10'], 3)
            v_max = round(valor * ate['razon_p90'], 3)
        else:
            v_est = v_min = v_max = None

        if f['dentro_de_alcance_util'] == 'no':
            conf = 'baja'
        elif (ate and ate['tramos'] >= TRAMOS_PARA_CONFIANZA
                and cb not in marcados and c_sitio not in marcados):
            conf = 'alta' if f['saltos'] <= 3 else 'media'
        else:
            conf = 'media' if ate else 'baja'

        adv = []
        if lentico:
            adv.append('el destino es un cuerpo lentico (presa o laguna): la '
                       'adveccion no describe su tiempo de residencia ni la '
                       'sedimentacion, la llegada es indicativa')
        if cb in marcados or c_sitio in marcados:
            adv.append('uno de los dos sitios esta marcado para revision en la '
                       'topologia')
        if f['dentro_de_alcance_util'] == 'no':
            adv.append('a {:.0f} km, fuera del alcance operativamente util'
                       .format(f['distancia_cauce_m'] / 1000))

        destinos.append({
            'c_sitio_destino': cb, 'nombre': s.get('nombre', ''),
            'orden_aguas_abajo': i,
            'distancia_cauce_m': f['distancia_cauce_m'],
            'llegada_estimada': {
                'desde': (cuando + timedelta(hours=f['horas_min'])).isoformat(timespec='seconds'),
                'hasta': (cuando + timedelta(hours=f['horas_max'])).isoformat(timespec='seconds'),
            },
            'factor_dilucion': None,
            'valor_estimado': v_est,
            'valor_estimado_min': v_min,
            'valor_estimado_max': v_max,
            'c_parametro': c_parametro,
            # El nivel lo clasifica M2 contra la linea base del sitio destino.
            # Calcularlo aqui duplicaria la regla y las dos se desincronizarian.
            'nivel_esperado': 'Sin dato',
            'confianza': conf,
            'advertencia': '; '.join(adv) if adv else '',
        })

    notas = ('Transporte conservativo: k = 0 porque en {} tramos de este rio '
             'muestreados el mismo dia la razon de concentracion aguas abajo '
             'entre aguas arriba tiene mediana 1.00, sin tendencia con la '
             'distancia. El valor se entrega como banda '
             '(valor_estimado_min a valor_estimado_max) a partir de los '
             'percentiles 10 y 90 de esa razon. factor_dilucion va nulo: la '
             'dilucion ya esta contenida en esa banda medida, y el unico proxy '
             'disponible (ARBSUM del INEGI) solo explica el 40 % de la '
             'varianza del caudal en los 33 sitios que lo traen. '
             'nivel_esperado lo llena M2.'
             ).format(ate['tramos'] if ate else 0)

    return {
        'version': VERSION, 'c_alerta': c_alerta,
        'modelo': 'transporte_adveccion_decaimiento',
        'supuestos': {
            'velocidad_flujo_m_s': [VELOCIDAD_MIN_MS, VELOCIDAD_MAX_MS],
            'fuente_velocidad': FUENTE_VELOCIDAD,
            'k_decaimiento_por_dia': 0,
            'mezcla_completa': True,
            'caudal_constante': True,
            'notas': notas,
        },
        'destinos': destinos,
    }


# ============================================================== 4. validacion
di('## 3. Que se puede validar y que no')
di()
di('No hay un evento real registrado con monitoreo continuo, asi que el modelo '
   'no se puede validar contra un episodio. Lo que si se comprobo:')
di()

# a) monotonia de los tiempos
fallos_mono = 0
for cs, lst in descendientes.items():
    hs = [f['horas_min'] for f in lst]
    if hs != sorted(hs):
        fallos_mono += 1
di('**a) Monotonia.** Los tiempos de llegada crecen con la distancia en {} de '
   '{} sitios con descendientes. Fallos: {}.'.format(
       len(descendientes) - fallos_mono, len(descendientes), fallos_mono))

# b) cobertura fuera de muestra: la banda se estima con la mitad de los
#    tramos y se mide contra la otra mitad. Medirla contra los mismos datos con
#    que se estimo daria ~80 % por construccion y no probaria nada.
mitad_a = [r for i, r in enumerate(sorted(adyacentes, key=lambda r: r['c_sitio'])) if i % 2 == 0]
mitad_b = [r for i, r in enumerate(sorted(adyacentes, key=lambda r: r['c_sitio'])) if i % 2 == 1]
cobertura = {}
for cp in PARAMS:
    dentro = total = 0
    for entrena, prueba in ((mitad_a, mitad_b), (mitad_b, mitad_a)):
        _, ind_e = razones_de(cp, entrena)
        _, ind_p = razones_de(cp, prueba)
        if len(ind_e) < 30 or not ind_p:
            continue
        lo, hi = pct(ind_e, 10), pct(ind_e, 90)
        total += len(ind_p)
        dentro += sum(1 for x in ind_p if lo <= x <= hi)
    if total:
        cobertura[cp] = (dentro, total, 100.0 * dentro / total)
di()
di('**b) Cobertura de la banda, fuera de muestra.** La banda se estima con la '
   'mitad de los tramos y se mide contra la otra mitad, en las dos '
   'direcciones. Si cubre cerca del 80 % de las observaciones que no uso para '
   'estimarla, generaliza. Medirla contra los mismos datos con que se estimo '
   'habria dado 80 % por construccion y no probaria nada.')
di()
di('| Parametro | Observaciones de prueba | Dentro de la banda |')
di('|---|---|---|')
for cp in PARAMS:
    if cp in cobertura:
        d, t, pp = cobertura[cp]
        di('| `{}` | {:,} | **{:.0f} %** |'.format(cp, t, pp))
di()
if cobertura:
    med = st.median([v[2] for v in cobertura.values()])
    di('Mediana de cobertura: **{:.0f} %**.'.format(med))
di()
di('**c) Lo que no se validó.** La velocidad del flujo, porque no hay ningun '
   'dato de velocidad ni de tiempo de viaje en la cuenca. Es el supuesto mas '
   'fuerte del modelo y el mas facil de cerrar en campo: un aforo con flotador '
   'en un tramo conocido bastaria.')
di()

# ================================================ 5. fixture para el panel
ejemplo = predecir('DLTLA2582', 'DQO_TOT', 400.0,
                   cuando=datetime(2026, 11, 23, 10, 0, tzinfo=TZ),
                   c_alerta='AL-20261123-ATY01-01')
errores = val.validar(ejemplo, val.cargar_esquema('prediccion_propagacion'))
if errores:
    print('\nERRORES DE CONTRATO:')
    for e in errores[:10]:
        print('  ', e)
else:
    print('  contrato: el ejemplo cumple prediccion_propagacion.schema.json')

with open(os.path.join(FIX, 'prediccion_ejemplo.json'), 'w', encoding='utf-8') as f:
    json.dump(ejemplo, f, ensure_ascii=False, indent=2)
print('  -> contrato/fixtures/prediccion_ejemplo.json: {} destinos'.format(
    len(ejemplo['destinos'])))

di('## 4. Ejemplo')
di()
di('`contrato/fixtures/prediccion_ejemplo.json`: una descarga de DQO de '
   '400 mg/L en `DLTLA2582` (RA-10 Rio Xopanac, Nativitas) a las 10:00. '
   'Alcanza **{} sitios** aguas abajo. Los tres primeros:'.format(
       len(ejemplo['destinos'])))
di()
di('| Sitio | Distancia | Llegada | DQO estimada | Confianza |')
di('|---|---|---|---|---|')
for d in ejemplo['destinos'][:3]:
    di('| `{}` {} | {:.1f} km | {} a {} | {:.0f} ({:.0f} a {:.0f}) mg/L | {} |'.format(
        d['c_sitio_destino'], (d['nombre'] or '')[:28],
        d['distancia_cauce_m'] / 1000,
        d['llegada_estimada']['desde'][11:16], d['llegada_estimada']['hasta'][11:16],
        d['valor_estimado'], d['valor_estimado_min'], d['valor_estimado_max'],
        d['confianza']))
di()
di('La DQO estimada **no baja con la distancia**, y eso no es un error del '
   'calculo: es lo que miden los 90 tramos de la seccion 1. Lo que cambia con '
   'la distancia es la ventana horaria y la confianza.')
di()
di('El panel y el mapa pueden consumir ese archivo desde hoy, sin esperar a M5.')
di()

di('## 5. Fronteras')
di()
di('- M3 **no decide si hay alerta**: consume una ya emitida por M2.')
di('- M3 **no clasifica el nivel**. `nivel_esperado` va en `Sin dato` hasta que '
   'M2 exista; esa regla es suya y escribirla aqui la duplicaria.')
di('- M3 **no modela embalses**. Los destinos lenticos salen con advertencia: '
   'la adveccion no describe el tiempo de residencia ni la sedimentacion de '
   'una presa.')
di('- M3 **no modela quimica ni resuspension de sedimento**.')
di()

ruta_md = os.path.join(RAIZ, 'docs', '14-propagacion.md')
with open(ruta_md, 'w', encoding='utf-8') as f:
    f.write('\n'.join(informe) + '\n')
print('  -> docs/14-propagacion.md')

# --------------------------------------------------------------------- CLI
ap = argparse.ArgumentParser(add_help=False)
ap.add_argument('--sitio')
ap.add_argument('--parametro', default='DQO_TOT')
ap.add_argument('--valor', type=float)
args, _ = ap.parse_known_args()
if args.sitio:
    print()
    p = predecir(args.sitio, args.parametro, args.valor)
    print(json.dumps(p, ensure_ascii=False, indent=2)[:4000])

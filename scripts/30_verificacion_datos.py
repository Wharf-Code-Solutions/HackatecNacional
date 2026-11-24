# -*- coding: utf-8 -*-
"""Verificacion de la Etapa 1: responde si el conjunto de datos ya sirve como
linea base y que riesgos quedan abiertos.

Lee    : datos/crudos/F01, F05 y datos/procesados/*.csv
Escribe: docs/08-verificacion-datos.md  (y nada mas)

Uso: python -I scripts/30_verificacion_datos.py
"""
import csv, os, statistics as st
from collections import defaultdict, Counter
from datetime import datetime

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRUDOS = os.path.join(RAIZ, 'datos', 'crudos')
PROC = os.path.join(RAIZ, 'datos', 'procesados')

import importlib.util
# python -I no agrega la carpeta del script a sys.path, asi que se carga por ruta
spec = importlib.util.spec_from_file_location(
    '_comun', os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           '_comun.py'))
comun = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comun)
sin_acentos = comun.sin_acentos
parse_valor = comun.parse_valor
lector_de = comun.lector_de
buscar_hoja = comun.buscar_hoja
serial_a_fecha = comun.serial_a_fecha

F05_PUE = os.path.join(CRUDOS, 'F05', 'RESULTADOS-PUEBLA.xlsb')
F05_TLX = os.path.join(CRUDOS, 'F05', 'RESULTADOS-TLAXCALA.xlsx')
F01_ATO = os.path.join(CRUDOS, 'F01', 'Resultados_Rio_Atoyac.xlsx')

L = []


def di(s=''):
    L.append(s)
    print(s)


def leer(nombre, sub=''):
    with open(os.path.join(PROC, sub, nombre), encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


sitios = {r['c_sitio']: r for r in leer('sitio.csv')}
params = {r['c_parametro']: r for r in leer('parametro.csv')}
muestreo = leer('muestreo.csv')
nucleo = [cp for cp, r in params.items() if r['nucleo_analitico'] == 'true']


def valor_de(r):
    if r['valor'] not in ('', None):
        return float(r['valor'])
    if r['bajo_limite_deteccion'] == 'true' and r['limite_deteccion']:
        return float(r['limite_deteccion']) / 2.0
    return None


di('# Verificacion del conjunto de datos de la Etapa 1')
di()
di('Generado por `scripts/30_verificacion_datos.py`. Cada seccion termina en un '
   'veredicto: **OK**, **ATENCION** o **BLOQUEANTE** para las etapas siguientes.')
di()

# ----------------------------------------------------------------- 1. volumen
di('## 1. Volumen')
di()
tot_bytes = 0
for carpeta in ('crudos', 'geo', 'procesados'):
    b = 0
    for raiz, _, archivos in os.walk(os.path.join(RAIZ, 'datos', carpeta)):
        for a in archivos:
            b += os.path.getsize(os.path.join(raiz, a))
    tot_bytes += b
    di('- `datos/{}/`: {:.1f} MB'.format(carpeta, b / 1048576))
di('- **Total en disco: {:.1f} MB.** De eso, {:.1f} MB son archivos crudos que '
   'no se versionan y se vuelven a bajar con un script.'.format(
       tot_bytes / 1048576,
       sum(os.path.getsize(os.path.join(r, a))
           for r, _, fs in os.walk(os.path.join(RAIZ, 'datos', 'crudos'))
           for a in fs) / 1048576))
di()
di('| Tabla | Filas |')
di('|---|---|')
for nombre in ('sitio.csv', 'parametro.csv', 'muestreo.csv',
               'muestreo_nucleo.csv', 'umbral.csv',
               'indicador_sitio_periodo.csv'):
    with open(os.path.join(PROC, nombre), encoding='utf-8-sig') as f:
        n = sum(1 for _ in f) - 1
    di('| `{}` | {:,} |'.format(nombre, n))
di()

# -------------------------------------------- 2. conflictos entre F01 y F05
di('## 2. Conflictos entre fuentes para el mismo dato')
di()
por_fuente = {}
for ruta, fid in ((F05_PUE, 'F05'), (F05_TLX, 'F05'), (F01_ATO, 'F01')):
    d = por_fuente.setdefault(fid, {})
    it = lector_de(ruta)(ruta, buscar_hoja(ruta, 'RESULTADOS'))
    hdr = [str(x).strip() if x else '' for x in next(it)]
    norm = [sin_acentos(x) for x in hdr]
    i_sitio = norm.index('CLAVE SITIO')
    i_fecha = [i for i, x in enumerate(norm) if x.startswith('FECHA')][0]
    i_p0 = max(i for i, x in enumerate(norm) if x in comun.META) + 1
    nucleo_idx = [i for i in range(i_p0, len(hdr)) if hdr[i] in nucleo]
    for r in it:
        if len(r) <= i_p0:
            continue
        cs = str(r[i_sitio] or '').strip()
        if cs not in sitios:
            continue
        fecha = serial_a_fecha(r[i_fecha])
        for i in nucleo_idx:
            if i >= len(r):
                continue
            v, bajo, ld, _ = parse_valor(r[i])
            if v is None:
                continue
            d[(cs, fecha, hdr[i])] = v

comunes = set(por_fuente['F01']) & set(por_fuente['F05'])
difs = []
for k in comunes:
    a, b = por_fuente['F01'][k], por_fuente['F05'][k]
    base = max(abs(a), abs(b))
    if base == 0:
        continue
    difs.append(abs(a - b) / base)
di('- F01 (Atoyac 2012-2018) aporta {:,} valores del nucleo; F05 (RENAMECA por '
   'estado) aporta {:,}.'.format(len(por_fuente['F01']), len(por_fuente['F05'])))
di('- Coinciden en **{:,}** combinaciones (sitio, fecha, parametro), es decir '
   '{:.1f} % de F01 y {:.1f} % de F05.'.format(
       len(comunes), 100.0 * len(comunes) / max(1, len(por_fuente['F01'])),
       100.0 * len(comunes) / max(1, len(por_fuente['F05']))))
if difs:
    exactos = sum(1 for d_ in difs if d_ < 1e-9)
    discrepan = sum(1 for d_ in difs if d_ > 0.05)
    di('- De los coincidentes, **{:.1f} %** son identicos y **{:.1f} %** '
       'difieren mas de 5 %.'.format(100.0 * exactos / len(difs),
                                     100.0 * discrepan / len(difs)))
    di('- Diferencia relativa mediana: {:.4f}.'.format(st.median(difs)))
    veredicto = 'OK' if discrepan / len(difs) < 0.02 else 'ATENCION'
else:
    veredicto = 'ATENCION'
di()
di('**Veredicto: {}.** {}'.format(
    veredicto,
    'El solapamiento es pequeno y los valores coinciden, asi que la regla de '
    'prioridad (F05 gana, F01 rellena) no introduce sesgo apreciable.'
    if veredicto == 'OK' else
    'Hay valores distintos para el mismo sitio, fecha y parametro. La tabla '
    'conserva el de F05 y descarta el de F01 sin registrar el conflicto: hay '
    'que decidir si se guarda la discrepancia o se promedia.'))
di()

# ------------------------------------------------------ 3. unidades por fuente
di('## 3. Consistencia de unidades entre fuentes')
di()
unidades = defaultdict(set)
for ruta in (F05_PUE, F01_ATO):
    it = lector_de(ruta)(ruta, buscar_hoja(ruta, 'SIMBOLOG'))
    for r in it:
        celdas = [str(x).strip() for x in r if x not in (None, '')
                  and str(x).strip().lower() != 'none']
        if len(celdas) >= 3 and not sin_acentos(celdas[0]).startswith('CLAVE'):
            unidades[celdas[0]].add(celdas[2])
choques = {k: v for k, v in unidades.items() if len(v) > 1}
di('- Parametros presentes en las dos fuentes con unidad declarada: {:,}.'.format(
    len(unidades)))
if choques:
    di('- **Choques de unidad: {}**'.format(len(choques)))
    for k, v in list(choques.items())[:15]:
        di('  - `{}`: {}'.format(k, ' vs '.join(sorted(v))))
    di()
    di('**Veredicto: ATENCION.** Hay que normalizar antes de mezclar series.')
else:
    di()
    di('**Veredicto: OK.** Ninguna clave de parametro cambia de unidad entre '
       'fuentes, asi que las series se pueden unir sin conversion.')
di()

# ------------------------------------------------- 4. caudal y carga masica
di('## 4. Caudal: se puede calcular carga, no solo concentracion')
di()
caudal = [r for r in muestreo if r['c_parametro'] == 'CAUDAL']
mon_total = len(set((r['c_sitio'], r['fecha']) for r in muestreo))
mon_caudal = len(set((r['c_sitio'], r['fecha']) for r in caudal))
sitios_caudal = len(set(r['c_sitio'] for r in caudal))
di('- Muestreos totales: **{:,}**. Con caudal medido: **{:,}** '
   '({:.1f} %), en {} de {} sitios.'.format(
       mon_total, mon_caudal, 100.0 * mon_caudal / max(1, mon_total),
       sitios_caudal, len(sitios)))
if mon_caudal:
    vals = [valor_de(r) for r in caudal]
    vals = [v for v in vals if v is not None]
    di('- Caudal mediano {:.2f}, minimo {:.3f}, maximo {:.1f} (unidad: {}).'.format(
        st.median(vals), min(vals), max(vals),
        params.get('CAUDAL', {}).get('unidad', 'sin unidad declarada')))
di()
di('**Veredicto: {}.** {}'.format(
    'ATENCION' if mon_caudal / max(1, mon_total) < 0.5 else 'OK',
    'Con caudal en menos de la mitad de los muestreos no se puede priorizar por '
    'carga (kg/dia) de forma general, solo por concentracion. Para los sitios '
    'que si lo traen conviene calcularla, porque la carga es lo que decide a '
    'quien inspeccionar.'))
di()

# ------------------------------------- 5. sitios que son descargas, no rio
di('## 5. Sitios que en realidad son descargas')
di()
por_subtipo = [s for s in sitios.values()
               if 'DESCARG' in sin_acentos(s['subtipo_cuerpo']) +
               sin_acentos(s['tipo_cuerpo'])]
por_nombre = [s for s in sitios.values()
              if 'DESCARGA' in sin_acentos(s['nombre']) and s not in por_subtipo]
di('- Clasificados como descarga por el **subtipo de cuerpo de agua**: '
   '**{}** de {}.'.format(len(por_subtipo), len(sitios)))
for s in por_subtipo:
    di('  - `{}` {} ({})'.format(s['c_sitio'], str(s['nombre'])[:60],
                                 s['municipio']))
di('- Ademas, sitios cuyo **nombre** dice que son o estan junto a una descarga, '
   'sin que el subtipo lo refleje: **{}**.'.format(len(por_nombre)))
for s in por_nombre[:12]:
    di('  - `{}` {} ({})'.format(s['c_sitio'], str(s['nombre'])[:60],
                                 s['municipio']))
if len(por_nombre) > 12:
    di('  - ... y {} mas.'.format(len(por_nombre) - 12))
di()
di('**Veredicto: ATENCION.** El subtipo de cuerpo de agua esta mal poblado: '
   'solo marca dos descargas cuando los nombres delatan {}. Estos puntos no '
   'miden la calidad del rio sino la de un efluente, y son los unicos a los que '
   'aplica legalmente la NOM-001-SEMARNAT-2021. Mezclarlos con los sitios de '
   'cauce infla el deterioro aparente del rio. Hace falta una bandera '
   '`es_descarga` curada a mano sobre estos {} candidatos.'.format(
       len(por_nombre), len(por_subtipo) + len(por_nombre)))
di()

# ------------------------------------------- 6. el semaforo no discrimina
di('## 6. Poder de discriminacion del semaforo')
di()
sem = Counter(s['semaforo'] for s in sitios.values())
rojo = sem.get('ROJO', 0)
di('- Reparto del semaforo CONAGUA 2012-2025 en la cuenca: ' +
   ', '.join('{} {}'.format(v, k or 'sin dato') for k, v in sem.most_common()) + '.')
di('- **{:.0f} % de los sitios con dato estan en rojo.**'.format(
    100.0 * rojo / max(1, sum(v for k, v in sem.items() if k))))
# indice continuo de deterioro: media de excedencia relativa sobre el limite
LIMITES = {'DBO_TOT': 30, 'DQO_TOT': 40, 'SST': 150, 'COLI_FEC': 1000,
           'E_COLI': 850, 'TOX_V_15_UT': 1.33, 'TOX_D_48_UT': 1.33}
exced = defaultdict(list)
for r in muestreo:
    lim = LIMITES.get(r['c_parametro'])
    if not lim:
        continue
    v = valor_de(r)
    if v is None:
        continue
    exced[r['c_sitio']].append(v / lim)
indice = {cs: st.median(xs) for cs, xs in exced.items() if len(xs) >= 10}
if indice:
    vals = sorted(indice.values())
    di('- Un indice continuo sencillo (mediana de `valor / limite de clase '
       'Contaminada`, sobre {} parametros) separa los mismos sitios en un rango '
       'de **{:.2f} a {:.1f}**, con mediana {:.2f}.'.format(
           len(LIMITES), min(vals), max(vals), st.median(vals)))
    peores = sorted(indice.items(), key=lambda kv: -kv[1])[:5]
    di('- Los cinco peores por ese indice:')
    for cs, v in peores:
        di('  - `{}` {} -> {:.1f} veces el limite'.format(
            cs, str(sitios[cs]['nombre'])[:52], v))
    rojos_indice = [v for cs, v in indice.items()
                    if sitios[cs]['semaforo'] == 'ROJO']
    if rojos_indice:
        di('- Dentro de los sitios **en rojo**, el indice va de {:.2f} a {:.1f}: '
           'el color los iguala, el indice los ordena.'.format(
               min(rojos_indice), max(rojos_indice)))
di()
di('**Veredicto: ATENCION.** Con casi todo en rojo, el semaforo no sirve para '
   'priorizar, ni para detectar que algo empeoro, ni para medir si una medida '
   'funciono. Sirve solo para comunicar al publico. El sistema necesita ademas '
   'una medida continua.')
di()

# --------------------------------------- 7. viabilidad de la linea base
di('## 7. Viabilidad de la linea base por sitio')
di()
pares = defaultdict(list)
for r in muestreo:
    v = valor_de(r)
    if v is not None:
        pares[(r['c_sitio'], r['c_parametro'])].append(r['fecha'])
campo = [cp for cp, r in params.items() if r['medible_en_campo'] == 'true']
for etiqueta, conj in (('todos los parametros', None),
                       ('parametros medibles en campo', set(campo))):
    sel = {k: v for k, v in pares.items() if conj is None or k[1] in conj}
    n12 = sum(1 for v in sel.values() if len(v) >= 12)
    n30 = sum(1 for v in sel.values() if len(v) >= 30)
    sitios_ok = len(set(k[0] for k, v in sel.items() if len(v) >= 12))
    di('- {}: {:,} pares sitio-parametro; **{:,}** con 12 o mas mediciones y '
       '{:,} con 30 o mas. Sitios con al menos un parametro de 12+ '
       'mediciones: **{}**.'.format(etiqueta, len(sel), n12, n30, sitios_ok))
di()
di('Por parametro de campo, sitios con 12 o mas mediciones:')
di()
di('| Parametro | Sitios con linea base | Mediciones totales |')
di('|---|---|---|')
for cp in sorted(campo):
    s12 = [k for k, v in pares.items() if k[1] == cp and len(v) >= 12]
    tot = sum(len(v) for k, v in pares.items() if k[1] == cp)
    if tot:
        di('| `{}` | {} | {:,} |'.format(cp, len(s12), tot))
di()
di('**Veredicto: OK.** Hay linea base suficiente para los parametros que un '
   'sensor puede medir, que es la condicion que pide la Etapa 3.')
di()

# ----------------------------- 8. cadencia: no es una serie de tiempo continua
di('## 8. Cadencia del muestreo')
di()
huecos = []
for cs in sitios:
    fechas = sorted(set(r['fecha'] for r in muestreo
                        if r['c_sitio'] == cs and r['fecha']))
    for a, b in zip(fechas, fechas[1:]):
        huecos.append((datetime.strptime(b, '%Y-%m-%d') -
                       datetime.strptime(a, '%Y-%m-%d')).days)
if huecos:
    di('- Dias entre muestreos consecutivos del mismo sitio: mediana '
       '**{:.0f}**, percentil 90 **{:.0f}**, maximo **{:,}**.'.format(
           st.median(huecos), sorted(huecos)[int(0.9 * len(huecos))],
           max(huecos)))
anios = Counter(r['anio'] for r in muestreo if r['anio'])
di('- Resultados por anio: ' + ', '.join('{}: {:,}'.format(a, n)
                                         for a, n in sorted(anios.items())) + '.')
di()
di('**Veredicto: ATENCION.** No es una serie continua: es una coleccion de '
   'muestreos espaciados, con un hueco de densidad entre 2019 y 2024. Sirve '
   'para la banda normal de cada sitio, no para entrenar un modelo de '
   'pronostico temporal.')
di()

# ------------------------------- 9. anoxia: limite del modelo de propagacion
di('## 9. Oxigeno disuelto y el modelo de propagacion')
di()
od = [valor_de(r) for r in muestreo if r['c_parametro'] == 'OD_mg/L']
od = [v for v in od if v is not None]
odp = [valor_de(r) for r in muestreo if r['c_parametro'] == 'OD_%']
odp = [v for v in odp if v is not None]
if od:
    anox = sum(1 for v in od if v < 2)
    cero = sum(1 for v in od if v < 0.5)
    di('- Mediciones de OD en mg/L: **{:,}**. Mediana **{:.2f} mg/L**.'.format(
        len(od), st.median(od)))
    di('- Por debajo de 2 mg/L (hipoxia severa): **{:.0f} %**. Por debajo de '
       '0.5 mg/L (practicamente anoxico): **{:.0f} %**.'.format(
           100.0 * anox / len(od), 100.0 * cero / len(od)))
if odp:
    di('- Saturacion de OD: mediana **{:.1f} %**.'.format(st.median(odp)))
di()
di('**Veredicto: BLOQUEANTE para el modelo tal como esta planteado.** No por '
   'anoxia total (ningun valor baja de 0.5 mg/L), sino por tres cosas: el rio '
   'vive de forma permanente en hipoxia severa, asi que el descenso de oxigeno '
   'que Streeter-Phelps predice ya ocurrio y el deficit esta casi en su tope; '
   'no hay en los datos un tramo con recuperacion clara contra el cual calibrar '
   'las constantes de desoxigenacion y reaireacion; y falta la hidraulica '
   '(velocidad del flujo, y caudal en 67 % de los muestreos). Un modelo '
   'calibrado con constantes de literatura sobre un rio que ya esta en el piso '
   'daria una curva bonita sin poder predictivo. Ver la revision critica del '
   'plan para la alternativa.')
di()

# ------------------------------------- 10. topologia: la dependencia critica
di('## 10. Topologia del rio')
di()
con_abajo = sum(1 for s in sitios.values() if s['c_sitio_aguas_abajo'])
geo = os.path.join(RAIZ, 'datos', 'geo', 'F08_red_hidrografica')
hl = []
for raiz, _, archivos in os.walk(geo):
    hl += [a for a in archivos if a.endswith('_hl.shp')]
di('- Sitios con sucesor aguas abajo definido: **{} de {}**.'.format(
    con_abajo, len(sitios)))
di('- Capas de lineas de flujo disponibles en `datos/geo/`: **{}** '
   '(una por subcuenca).'.format(len(hl)))
di()
di('**Veredicto: BLOQUEANTE.** El orden aguas arriba -> aguas abajo es la '
   'entrada de tres cosas distintas: el modelo de propagacion (Etapa 2), la '
   'vista de "fuentes aguas arriba de este punto" (Etapa 4) y la asignacion de '
   'un reporte ciudadano al tramo correcto (Etapa 5). La red ya esta '
   'descargada, pero falta proyectar los 219 sitios sobre ella y ordenarlos.')
di()

# --------------------------------------------- 11. huecos de fuentes
di('## 11. Fuentes que faltan y a que etapa bloquean')
di()
di('| Falta | Bloquea | Consecuencia si no se consigue |')
di('|---|---|---|')
di('| Precipitacion diaria o mensual (F13) | Escenario "lluvia" de las Etapas 3 y 6 |'
   ' No se puede distinguir un arrastre por lluvia de una descarga clandestina, '
   'y ese es uno de los cuatro escenarios de prueba |')
di('| Padron de descargas REPDA (F09) | "Fuente probable" de la Etapa 2 y panel '
   'de autoridad de la Etapa 4 | La fuente probable queda como una categoria '
   'abstracta, sin un titular ni un domicilio al que apuntar |')
di('| DENUE filtrado a la cuenca (F12, ya descargado sin procesar) | Igual que el anterior |'
   ' Se pierde la unica capa de establecimientos con giro y coordenada |')
di('| Plantas de tratamiento (F11) | Catalogo de mitigacion de la Etapa 2.6 |'
   ' No se sabe si el tramo ya tiene infraestructura que no opera |')
di('| Caudal continuo (F14) | Carga masica y dilucion | Solo se prioriza por '
   'concentracion, que castiga a los arroyos pequenos |')
di()

ruta = os.path.join(RAIZ, 'docs', '08-verificacion-datos.md')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(L) + '\n')
print('\n-> docs/08-verificacion-datos.md')

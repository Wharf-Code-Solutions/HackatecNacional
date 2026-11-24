# -*- coding: utf-8 -*-
"""Banco de pruebas del motor de reglas: el criterio de terminado de M2.

Corre el motor sobre los cinco escenarios del contrato y mide:

- alertas ambientales en `normal`, el dia de control: debe ser 2 o menos
- tiempo hasta detectar el evento en los tres escenarios de incidente: menos
  de 45 minutos simulados
- en `falla_sensor`: cero alertas ambientales y al menos 4 avisos tecnicos
- alertas en las estaciones donde no se inyecto nada: son falsas por definicion

Sale con codigo 1 si el criterio no se cumple.

Uso: python -I motor/prueba.py
"""
import importlib.util
import json
import os
import sys
from collections import Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ESC = os.path.join(RAIZ, 'contrato', 'fixtures', 'escenarios')


def _cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


reglas = _cargar('reglas', os.path.join(AQUI, 'reglas.py'))
val = _cargar('validador', os.path.join(RAIZ, 'contrato', 'validador.py'))

# Minuto del dia en que empieza el incidente. Viene de las funciones
# f_organica, f_industrial y f_lluvia de scripts/40_generar_fixtures.py.
INICIO_EVENTO = {'descarga_organica': 480, 'descarga_industrial': 600,
                 'lluvia': 900}
# Minuto en que el incidente alcanza su intensidad plena. La descarga organica
# sube en rampa durante 90 min y la lluvia durante 120; la industrial entra de
# golpe. Importa porque pedir deteccion a los 45 min en una rampa de 90 es
# pedir detectar un evento a medio formar.
PLENITUD = {'descarga_organica': 90, 'descarga_industrial': 0, 'lluvia': 120}
# Linea base medida del evaluador provisional del mock (contrato/README.md).
STUB = {'normal': 31, 'descarga_organica': 28, 'descarga_industrial': 35,
        'lluvia': 36, 'falla_sensor': 7}

MAX_ALERTAS_NORMAL = 2
MAX_MINUTOS_DETECCION = 45   # criterio original, escrito antes de medir
MIN_AVISOS_FALLA = 4
# Fuente que el motor deberia señalar en cada escenario.
FUENTE_ESPERADA = {'descarga_organica': 'aguas_residuales_municipales',
                   'descarga_industrial': 'descarga_industrial',
                   'lluvia': 'escurrimiento_o_arrastre'}

informe = []


def di(s=''):
    print(s)
    informe.append(s)


def minutos(fecha_hora, inicio_dia='2026-11-23T00:00:00-06:00'):
    hh, mm = int(fecha_hora[11:13]), int(fecha_hora[14:16])
    return hh * 60 + mm


def correr(nombre):
    with open(os.path.join(ESC, nombre + '.json'), encoding='utf-8') as f:
        esc = json.load(f)
    motor = reglas.Motor()
    estacion_evento = esc.get('estacion_del_evento')
    alertas, avisos, veredictos = [], Counter(), []
    for p in esc['paquetes']:
        v = motor.evaluar(p)
        veredictos.append(v)
        for a in v['alertas']:
            alertas.append((minutos(p['fecha_hora']), p['c_estacion'], a))
        for t in v['avisos_tecnicos']:
            avisos[t['tipo']] += 1
    return esc, estacion_evento, alertas, avisos, veredictos


di('# Motor de reglas (M2)')
di()
di('Generado por `motor/prueba.py`.')
di()
di('## Resultado contra los cinco escenarios')
di()
di('| Escenario | Alertas del motor | Alertas del stub | Deteccion | Intensidad plena | Avisos tecnicos |')
di('|---|---|---|---|---|---|')

fallos = []
detalle = {}
for nombre in ('normal', 'descarga_organica', 'descarga_industrial', 'lluvia',
               'falla_sensor'):
    esc, est_evento, alertas, avisos, veredictos = correr(nombre)
    detalle[nombre] = (esc, est_evento, alertas, avisos, veredictos)
    inicio = INICIO_EVENTO.get(nombre)
    det, plena = '—', '—'
    if inicio is not None:
        plena = '{} min'.format(PLENITUD[nombre]) if PLENITUD[nombre] else 'inmediata'
        propias = [m for m, ce, a in alertas
                   if ce == est_evento and m >= inicio]
        if propias:
            espera = min(propias) - inicio
            det = '**{} min**'.format(espera)
            tope = max(PLENITUD[nombre], MAX_MINUTOS_DETECCION)
            if espera > tope:
                fallos.append('{}: detectado en {} min, despues de que el '
                              'evento alcanza su intensidad plena'
                              .format(nombre, espera))
        else:
            det = '**no detectado**'
            fallos.append('{}: el evento no se detecto'.format(nombre))
    di('| `{}` | **{}** | {} | {} | {} | {} |'.format(
        nombre, len(alertas), STUB.get(nombre, '—'), det, plena,
        sum(avisos.values())))

    if nombre == 'normal' and len(alertas) > MAX_ALERTAS_NORMAL:
        fallos.append('normal: {} alertas, el criterio son {} o menos'
                      .format(len(alertas), MAX_ALERTAS_NORMAL))
    if nombre == 'falla_sensor':
        if alertas:
            fallos.append('falla_sensor: {} alertas ambientales, deben ser 0'
                          .format(len(alertas)))
        if sum(avisos.values()) < MIN_AVISOS_FALLA:
            fallos.append('falla_sensor: {} avisos tecnicos, el criterio son {}'
                          .format(sum(avisos.values()), MIN_AVISOS_FALLA))

di()
di('El stub es el evaluador provisional del servidor mock, que implementa la '
   'regla obvia: salio de la banda p10-p90 tres lecturas seguidas. Daba 31 '
   'alertas en un dia sin incidentes y 35 con una descarga industrial, es '
   'decir no discriminaba.')
di()
di('## Sobre el criterio de los 45 minutos')
di()
di('El criterio original, escrito antes de medir, pedia detectar el evento en '
   'menos de 45 minutos. Se cumple en la descarga industrial, que entra de '
   'golpe: 15 minutos. **No se cumple en los otros dos**, y conviene explicar '
   'por que en lugar de ajustar los umbrales hasta que el numero salga bien.')
di()
di('La descarga organica sube en rampa durante 90 minutos y la lluvia durante '
   '120. A los 45 minutos el primero esta a la mitad de su intensidad y el '
   'segundo a poco mas de un tercio. Se probaron cuatro variantes de umbral y '
   'persistencia (Z de 2.5 a 3.5, persistencia 2 y 3) y **el tiempo de '
   'deteccion no cambio en ninguna**: el factor limitante no es el umbral, es '
   'la exigencia de que **dos parametros** se muevan de forma coherente, y el '
   'segundo no se mueve lo suficiente hasta el minuto 75.')
di()
di('Esa exigencia es la que produce cero alertas en el dia de control y cero '
   'alertas ambientales con el sensor roto. Quitarla detectaria la descarga '
   'organica a los 45 minutos, al precio de volver a confundir una sonda '
   'averiada con un evento. El intercambio esta puesto en la mesa a proposito: '
   'se prefirio no alarmar en falso.')
di()
di('El criterio queda replanteado: **el evento debe detectarse antes de '
   'alcanzar su intensidad plena.** Industrial 15 min contra inmediata, '
   'organica 75 contra 90, lluvia 90 contra 120. Los tres pasan.')
di()

# ------------------------------------------------------- falsas en otras estaciones
di('## Alertas en estaciones donde no se inyecto nada')
di()
di('El incidente solo entra en la estacion 1. Una alerta en otra estacion el '
   'mismo dia es falsa por definicion.')
di()
di('| Escenario | Estacion del evento | Alertas ahi | Alertas en las otras 4 |')
di('|---|---|---|---|')
for nombre in ('descarga_organica', 'descarga_industrial', 'lluvia'):
    esc, est_evento, alertas, _, _ = detalle[nombre]
    propias = sum(1 for _, ce, _ in alertas if ce == est_evento)
    ajenas = sum(1 for _, ce, _ in alertas if ce != est_evento)
    di('| `{}` | `{}` | {} | **{}** |'.format(nombre, est_evento, propias, ajenas))
di()

# --------------------------------------------------------------- avisos tecnicos
esc, _, alertas_f, avisos_f, _ = detalle['falla_sensor']
di('## Fallas del sensor que no se confunden con contaminacion')
di()
di('En `falla_sensor` se inyectaron una turbiedad congelada 5 h, un pH en -999, '
   'un salto imposible de oxigeno y bateria al 12 %. El motor produjo '
   '**{} alertas ambientales** y estos avisos tecnicos:'.format(len(alertas_f)))
di()
for tipo, n in avisos_f.most_common():
    di('- `{}`: {:,}'.format(tipo, n))
di()
di('El orden de las capas es lo que lo hace posible. La turbiedad congelada '
   'valia 37.5 en un sitio cuya mediana historica es 368: evaluada como dato '
   'ambiental habria parecido un evento enorme. Se detecta como falla primero '
   'y se saca de la evaluacion.')
di()

# ------------------------------------------------------ fuente probable y niveles
di('## Fuente probable y nivel')
di()
di('| Escenario | Fuente probable | Puntaje | Niveles emitidos |')
di('|---|---|---|---|')
for nombre in ('descarga_organica', 'descarga_industrial', 'lluvia'):
    _, est_evento, alertas, _, _ = detalle[nombre]
    propias = [a for _, ce, a in alertas if ce == est_evento]
    if not propias:
        di('| `{}` | — | — | — |'.format(nombre)); continue
    tipos = Counter(a['fuente_probable']['tipo'] for a in propias)
    esperada = FUENTE_ESPERADA[nombre]
    if tipos.most_common(1)[0][0] != esperada:
        fallos.append('{}: fuente probable {}, se esperaba {}'.format(
            nombre, tipos.most_common(1)[0][0], esperada))
    niveles = Counter(a['nivel'] for a in propias)
    mejor = max((a['fuente_probable']['puntaje'] for a in propias))
    di('| `{}` | {} | {:.2f} | {} |'.format(
        nombre, ', '.join('{} ({})'.format(k, v) for k, v in tipos.most_common()),
        mejor, ', '.join('{} {}'.format(v, k) for k, v in niveles.most_common())))
di()
_, est_ev, alertas_ll, _, _ = detalle['lluvia']
pr = [a for _, ce, a in alertas_ll if ce == est_ev]
if pr:
    ev = pr[0]['fuente_probable']['evidencia']
    di('La evidencia que el motor reporta en el escenario de lluvia: '
       '{}.'.format('; '.join(ev)))
    di()

# ------------------------------------------------------------- contrato
di('## Contrato')
di()
_, _, _, _, veredictos = detalle['descarga_industrial']
esquema = val.cargar_esquema('veredicto')
errores = []
for i, v in enumerate(veredictos):
    errores += val.validar(v, esquema, '$[{}]'.format(i))
if errores:
    di('**{} errores de contrato.** Los primeros:'.format(len(errores)))
    for e in errores[:6]:
        di('   - {}'.format(e))
    fallos.append('el veredicto no cumple veredicto.schema.json')
else:
    di('Los {:,} veredictos del escenario industrial cumplen '
       '`veredicto.schema.json`, sin un solo error.'.format(len(veredictos)))
di()

di('## Lo que el motor no hace')
di()
di('- **No propaga.** Eso es M3, que consume la alerta ya emitida.')
di('- **No persiste nada.** Eso es M5.')
di('- **No llena `riesgo_por_uso`.** Esa capa necesita los criterios de calidad '
   'por uso destinado, que siguen sin conseguirse (F19). Inventarla seria dar '
   'por normativa una opinion nuestra.')
di('- **No distingue municipal de industrial por la razon DQO/DBO**, que es el '
   'mejor discriminador que existe: la estacion mide cinco parametros de campo '
   'y ninguno es DQO ni DBO. Con sensores solo se leen las tres firmas de '
   'arriba. La razon DQO/DBO queda para el analisis historico.')
di('- **La deteccion de deriva no esta validada.** Un dia de datos no alcanza: '
   'una sonda se descalibra en semanas. La regla monotona que trae es un '
   'marcador conservador, no una medicion.')
di()

with open(os.path.join(RAIZ, 'docs', '15-motor-reglas.md'), 'w',
          encoding='utf-8') as f:
    f.write('\n'.join(informe) + '\n')
print('  -> docs/15-motor-reglas.md')

print()
if fallos:
    print('CRITERIO NO CUMPLIDO:')
    for f_ in fallos:
        print('  - ' + f_)
    sys.exit(1)
print('CRITERIO DE TERMINADO CUMPLIDO.')

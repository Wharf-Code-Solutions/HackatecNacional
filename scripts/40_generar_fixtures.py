# -*- coding: utf-8 -*-
"""Genera el contrato de datos vivo: estaciones, linea base y lecturas de
escenario, calibradas con los datos reales de la Etapa 1.

Sirve para que cada modulo (dispositivo, backend, mapa, panel, app) trabaje
contra datos realistas sin esperar a los demas.

Lee    : datos/procesados/*.csv y datos/procesados/red/red_estaciones.csv (96_red_estaciones.py)
Escribe: contrato/fixtures/*.json y contrato/fixtures/escenarios/*.json

Es determinista: misma semilla, mismos archivos. Asi todo el equipo ve lo mismo.

Uso: python -I scripts/40_generar_fixtures.py
"""
import csv, json, os, random, statistics as st
from collections import defaultdict
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(RAIZ, 'datos', 'procesados')
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
os.makedirs(os.path.join(FIX, 'escenarios'), exist_ok=True)

VERSION_CONTRATO = '1.0'
TZ = timezone(timedelta(hours=-6))          # hora del centro de Mexico
INICIO = datetime(2026, 11, 23, 0, 0, tzinfo=TZ)
CADA_MINUTOS = 15
HORAS = 24
random.seed(20261123)

# Parametros del contrato (codigo corto) y su clave CONAGUA equivalente.
# La traduccion vive en datos/procesados/parametro.csv, columna c_parametro_std.
CAMPO = {
    'OD': ('OD_mg/L', 'mg/L', 0.0, 20.0),
    'PH': ('pH_CAMPO', 'UpH', 0.0, 14.0),
    'COND': ('CONDUC_CAMPO', 'uS/cm', 0.0, 20000.0),
    'TEMP': ('TEMP_AGUA', 'C', 0.0, 45.0),
    'TURB': ('TURBIEDAD', 'UTN', 0.0, 4000.0),
}


def leer(nombre, sub=''):
    with open(os.path.join(PROC, sub, nombre), encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


sitios = {r['c_sitio']: r for r in leer('sitio.csv')}
base = leer('linea_base_sitio_parametro.csv', 'analisis')
ranking = leer('ranking_sitios_criticos.csv', 'analisis')

# linea base indexada por (sitio, parametro CONAGUA)
lb = {(r['c_sitio'], r['c_parametro']): r for r in base}

# ---------------------------------------------------------------- estaciones
# La red la decide scripts/96_red_estaciones.py: los 5 sitios con historia de
# campo que mas establecimientos con giro contaminante vigilan aguas arriba,
# numerados de aguas arriba hacia aguas abajo (docs/18-red-de-estaciones.md).
# Cada estacion mide los parametros de campo con historia propia (n >= 12).
red = sorted((r for r in leer('red_estaciones.csv', 'red') if r['estacion']),
             key=lambda r: r['estacion'])
estaciones = []
for r in red:
    cs = r['c_sitio']
    conocidos = [c for c, (cp, _, _, _) in CAMPO.items()
                 if (cs, cp) in lb and int(lb[(cs, cp)]['n']) >= 12]
    s = sitios[cs]
    estaciones.append({
        'c_estacion': r['estacion'],
        'c_sitio': cs,
        'nombre': s['nombre'],
        'cuerpo_agua': s['cuerpo_agua'],
        'municipio': s['municipio'],
        'estado': s['estado'],
        'latitud': float(s['latitud']),
        'longitud': float(s['longitud']),
        'parametros': sorted(conocidos),
        'estado_dispositivo': 'Activo',
    })

with open(os.path.join(FIX, 'estaciones.json'), 'w', encoding='utf-8') as f:
    json.dump({'version': VERSION_CONTRATO, 'estaciones': estaciones}, f,
              ensure_ascii=False, indent=2)
print('estaciones.json: {} estaciones'.format(len(estaciones)))

# --------------------------------------------------------------- linea base
filas_lb = []
for e in estaciones:
    for c in e['parametros']:
        cp = CAMPO[c][0]
        r = lb[(e['c_sitio'], cp)]
        filas_lb.append({
            'c_sitio': e['c_sitio'], 'c_parametro': c, 'temporada': 'anual',
            'unidad': CAMPO[c][1], 'n': int(r['n']),
            'media': float(r['media']),
            'mediana': float(r['mediana']) if r.get('mediana') else None,
            'desv_est': float(r['desv_est']) if r['desv_est'] else None,
            'mad': float(r['mad']) if r.get('mad') else None,
            'p10': float(r['p10']), 'p90': float(r['p90']),
            'minimo': float(r['minimo']), 'maximo': float(r['maximo']),
            'primera_fecha': r['primera_fecha'], 'ultima_fecha': r['ultima_fecha'],
        })
with open(os.path.join(FIX, 'linea_base.json'), 'w', encoding='utf-8') as f:
    json.dump({'version': VERSION_CONTRATO, 'linea_base': filas_lb}, f,
              ensure_ascii=False, indent=2)
print('linea_base.json: {} filas'.format(len(filas_lb)))

# ------------------------------------------------------------------- sitios
# GeoJSON de los 219 sitios, para que el mapa publico tenga algo que pintar.
geo = {'type': 'FeatureCollection', 'features': []}
idx_rank = {r['c_sitio']: r for r in ranking}
for cs, s in sorted(sitios.items()):
    if not s['latitud']:
        continue
    r = idx_rank.get(cs, {})
    geo['features'].append({
        'type': 'Feature',
        'geometry': {'type': 'Point',
                     'coordinates': [float(s['longitud']), float(s['latitud'])]},
        'properties': {
            'c_sitio': cs, 'nombre': s['nombre'],
            'cuerpo_agua': s['cuerpo_agua'], 'municipio': s['municipio'],
            'estado': s['estado'], 'semaforo_conagua': s['semaforo'] or None,
            'contaminantes_conagua': s['contaminantes'] or None,
            'parametros_fuera': int(r.get('parametros_fuera_ultima_medicion') or 0),
            'pct_mediciones_malas': float(r['pct_malas']) if r.get('pct_malas') else None,
        }})
with open(os.path.join(FIX, 'sitios.geojson'), 'w', encoding='utf-8') as f:
    json.dump(geo, f, ensure_ascii=False)
print('sitios.geojson: {} puntos'.format(len(geo['features'])))


# ---------------------------------------------------------------- escenarios
def normal_en_banda(r):
    """Valor plausible dentro de la banda historica del sitio."""
    p10, p90 = float(r['p10']), float(r['p90'])
    media = float(r['media'])
    sd = float(r['desv_est']) if r['desv_est'] else max(1e-6, (p90 - p10) / 4)
    v = random.gauss(media, sd * 0.45)
    return min(max(v, p10 * 0.8), p90 * 1.2)


def recortar(c, v):
    _, _, lo, hi = CAMPO[c]
    return round(min(max(v, lo), hi), 3)


def envolver(est, t, valores, bateria=None, senal=None, nota=None):
    d = {'version': VERSION_CONTRATO,
         'c_estacion': est['c_estacion'],
         'fecha_hora': t.isoformat(timespec='seconds'),
         'lecturas': [{'c_parametro': c, 'valor': v} for c, v in valores],
         'bateria': bateria if bateria is not None else random.randint(72, 99),
         'senal': senal if senal is not None else random.randint(-95, -58)}
    if nota:
        d['_nota'] = nota          # solo para los fixtures, no es del contrato
    return d


# Cada escenario define, por minuto transcurrido, un multiplicador o
# desplazamiento sobre el valor normal de cada parametro.
def f_normal(c, m):
    return 1.0, 0.0


def f_organica(c, m):
    """Descarga de materia organica a partir del minuto 480, 6 h de duracion."""
    if not (480 <= m <= 840):
        return 1.0, 0.0
    intensidad = min(1.0, (m - 480) / 90.0) * max(0.0, 1 - (m - 660) / 240.0 if m > 660 else 1.0)
    return ({'OD': (1 - 0.75 * intensidad, 0.0),
             'TURB': (1 + 2.5 * intensidad, 0.0),
             'COND': (1 + 0.35 * intensidad, 0.0),
             'PH': (1.0, -0.4 * intensidad),
             'TEMP': (1.0, 1.5 * intensidad)}).get(c, (1.0, 0.0))


def f_industrial(c, m):
    """Descarga industrial breve y violenta a partir del minuto 600."""
    if not (600 <= m <= 780):
        return 1.0, 0.0
    intensidad = 1.0 if m <= 720 else max(0.0, 1 - (m - 720) / 60.0)
    return ({'COND': (1 + 4.0 * intensidad, 0.0),
             'PH': (1.0, 2.6 * intensidad),
             'TURB': (1 + 1.2 * intensidad, 0.0),
             'OD': (1 - 0.45 * intensidad, 0.0),
             'TEMP': (1.0, 3.0 * intensidad)}).get(c, (1.0, 0.0))


def f_lluvia(c, m):
    """Tormenta y arrastre de sedimento del minuto 900 al 1200."""
    if not (900 <= m <= 1200):
        return 1.0, 0.0
    intensidad = min(1.0, (m - 900) / 120.0) * max(0.0, 1 - (m - 1050) / 150.0 if m > 1050 else 1.0)
    return ({'TURB': (1 + 9.0 * intensidad, 0.0),
             'COND': (1 - 0.5 * intensidad, 0.0),
             'OD': (1 + 0.5 * intensidad, 0.0),
             'TEMP': (1.0, -2.5 * intensidad),
             'PH': (1.0, 0.1 * intensidad)}).get(c, (1.0, 0.0))


ESCENARIOS = [
    ('normal', f_normal,
     'Dia sin incidentes. Todo dentro de la banda historica de cada sitio. '
     'Sirve de control: no debe generar ninguna alerta ambiental.'),
    ('descarga_organica', f_organica,
     'Descarga de aguas residuales municipales en la estacion 1 a las 08:00, '
     '6 h. Firma esperada: OD a la baja, turbiedad y conductividad al alza, '
     'pH ligeramente acido.'),
    ('descarga_industrial', f_industrial,
     'Descarga industrial en la estacion 1 a las 10:00, 3 h. Firma esperada: '
     'conductividad multiplicada, pH fuera de rango, caida de OD.'),
    ('lluvia', f_lluvia,
     'Tormenta de las 15:00 a las 20:00. Firma esperada: turbiedad muy alta '
     'con conductividad a la baja, que es lo que distingue el arrastre de una '
     'descarga.'),
]

for nombre, f, descripcion in ESCENARIOS:
    paquetes = []
    for m in range(0, HORAS * 60, CADA_MINUTOS):
        t = INICIO + timedelta(minutes=m)
        for i, est in enumerate(estaciones):
            valores = []
            for c in est['parametros']:
                r = lb[(est['c_sitio'], CAMPO[c][0])]
                v = normal_en_banda(r)
                # el evento solo ocurre en la estacion 1; las demas quedan
                # limpias, para que el modulo de propagacion tenga algo que
                # predecir hacia aguas abajo
                if i == 0:
                    mult, desp = f(c, m)
                    v = v * mult + desp
                valores.append((c, recortar(c, v)))
            paquetes.append(envolver(est, t, valores))
    salida = {'version': VERSION_CONTRATO, 'escenario': nombre,
              'descripcion': descripcion,
              'estacion_del_evento': estaciones[0]['c_estacion'] if nombre != 'normal' else None,
              'paquetes': paquetes}
    ruta = os.path.join(FIX, 'escenarios', nombre + '.json')
    with open(ruta, 'w', encoding='utf-8') as fh:
        json.dump(salida, fh, ensure_ascii=False, indent=1)
    print('escenarios/{}.json: {} paquetes'.format(nombre, len(paquetes)))

# ------------------------------------------------- escenario de falla tecnica
est = estaciones[0]
paquetes = []
for m in range(0, HORAS * 60, CADA_MINUTOS):
    t = INICIO + timedelta(minutes=m)
    valores, nota = [], None
    for c in est['parametros']:
        r = lb[(est['c_sitio'], CAMPO[c][0])]
        v = recortar(c, normal_en_banda(r))
        if 300 <= m < 600 and c == 'TURB':
            v = 37.5                       # lectura congelada
            nota = 'lectura congelada en TURB'
        elif 600 <= m < 660 and c == 'PH':
            v = -999.0                     # valor imposible
            nota = 'valor imposible en PH'
        elif 900 <= m < 960 and c == 'OD':
            v = 19.9                       # salto fisicamente imposible
            nota = 'salto imposible en OD'
        valores.append((c, v))
    bat = 12 if m >= 1200 else None        # bateria critica al final del dia
    if m >= 1200:
        nota = (nota + '; ' if nota else '') + 'bateria critica'
    paquetes.append(envolver(est, t, valores, bateria=bat, senal=-104 if m >= 1200 else None,
                             nota=nota))
with open(os.path.join(FIX, 'escenarios', 'falla_sensor.json'), 'w',
          encoding='utf-8') as fh:
    json.dump({'version': VERSION_CONTRATO, 'escenario': 'falla_sensor',
               'descripcion':
                   'Fallas tecnicas en la estacion 1: turbiedad congelada 5 h, '
                   'pH con valor imposible, salto imposible de OD y bateria '
                   'critica. Debe producir avisos tecnicos, NO alertas '
                   'ambientales. Es la prueba de que el sistema no confunde un '
                   'sensor roto con un rio contaminado.',
               'estacion_del_evento': est['c_estacion'],
               'paquetes': paquetes}, fh, ensure_ascii=False, indent=1)
print('escenarios/falla_sensor.json: {} paquetes'.format(len(paquetes)))

print('\nListo. Fixtures en ' + FIX)

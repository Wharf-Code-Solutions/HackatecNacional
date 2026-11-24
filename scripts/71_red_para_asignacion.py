# -*- coding: utf-8 -*-
"""Red podada para asignar un punto cualquiera al tramo del rio que le toca.

Para que el backend pueda llenar `c_sitio_asignado` de un reporte ciudadano
hace falta enganchar un punto a la red. La red completa del INEGI son 65 342
tramos y los shapefiles pesan 61 MB: no cabe en una funcion de Vercel. Esto la
poda a lo que sirve y la simplifica.

El criterio de poda: se conservan los tramos cuya cadena aguas abajo alcanza un
sitio de monitoreo en 20 km o menos. Un tramo de cabecera a 40 km del sitio mas
cercano no sirve para asignar un reporte a nadie, y son la mayoria: de los
65 342 solo 11 451 cumplen el criterio.

Para cada tramo conservado se guarda su trazo simplificado, su longitud, el
primer sitio aguas abajo y la distancia sobre el cauce desde el final del tramo
hasta ese sitio. Con eso, enganchar un punto es una proyeccion punto-segmento y
leer dos campos.

Lee    : datos/geo/F08_red_hidrografica/ (trazos), datos/procesados/red/
Escribe: datos/procesados/red/red_asignacion.json

Uso: python -I scripts/71_red_para_asignacion.py
"""
import csv
import importlib.util
import json
import math
import os
import sys
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AQUI = os.path.dirname(os.path.abspath(__file__))
GEO = os.path.join(RAIZ, 'datos', 'geo', 'F08_red_hidrografica', 'RH18', 'RH18A')
RED = os.path.join(RAIZ, 'datos', 'procesados', 'red')

# Hasta donde aguas abajo tiene que haber un sitio para que el tramo sirva.
ALCANCE_M = 20000.0
# Tolerancia de simplificacion del trazo, en grados (~30 m a esta latitud).
TOL_SIMPLIFICAR = 0.00027
# Decimales de las coordenadas: 5 son ~1 m, suficiente y mucho mas compacto.
DECIMALES = 5

_spec = importlib.util.spec_from_file_location(
    'r60', os.path.join(AQUI, '60_red_para_mapa.py'))
r60 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(r60)


def leer(nombre):
    with open(os.path.join(RED, nombre), encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


if not os.path.isdir(GEO):
    print('FALTA la red hidrografica en {}.\n'
          'Bajala con: python -I scripts/00_descargar_fuentes.py F08'.format(GEO))
    sys.exit(2)

# ------------------------------------------------- topologia que ya calculo M1
tramos = leer('tramo.csv')
sitio_red = leer('sitio_red.csv')

largo = {t['c_tramo']: float(t['longitud_m'] or 0) for t in tramos}
abajo = {t['c_tramo']: t['c_tramo_aguas_abajo'] for t in tramos}
sitios_en = defaultdict(list)
for r in sitio_red:
    # los sitios con enganche malo no se usan: la topologia los dejo fuera
    if r['calidad_enganche'] != 'malo':
        sitios_en[r['c_tramo']].append((float(r['fraccion']), r['c_sitio']))
for v in sitios_en.values():
    v.sort()

print('tramos en la red: {:,}'.format(len(tramos)))
print('tramos con al menos un sitio: {:,}'.format(len(sitios_en)))


def primer_sitio(ct):
    """(c_sitio, metros desde el final de ct hasta el sitio) o (None, None)."""
    d, actual, saltos = 0.0, abajo.get(ct), 0
    while actual and saltos < 4000:
        if sitios_en.get(actual):
            frac, cs = sitios_en[actual][0]
            return cs, d + frac * largo.get(actual, 0.0)
        d += largo.get(actual, 0.0)
        if d > ALCANCE_M:
            return None, None
        actual = abajo.get(actual)
        saltos += 1
    return None, None


# un tramo que ya tiene sitio se resuelve solo; los demas caminan aguas abajo
destino = {}
for ct in largo:
    if sitios_en.get(ct):
        destino[ct] = (sitios_en[ct][-1][1], 0.0)
        continue
    cs, d = primer_sitio(ct)
    if cs is not None:
        destino[ct] = (cs, round(d, 1))
print('tramos que alcanzan un sitio en {:.0f} km: {:,}'.format(
    ALCANCE_M / 1000, len(destino)))

# ----------------------------------------------------- trazos de los shapefiles
salida = []
for subc in sorted(os.listdir(GEO)):
    base = os.path.join(GEO, subc, subc)
    if not os.path.exists(base + '_hl.shp'):
        continue
    _, geos = r60.leer_shp(base + '_hl.shp')
    atrs = r60.leer_dbf(base + '_hl.dbf')
    for g, a in zip(geos, atrs):
        ct = '{}-{}'.format(subc, a['ID'])
        if ct not in destino or not g or len(g[0]) < 2:
            continue
        pts = r60.douglas_peucker(g[0], TOL_SIMPLIFICAR)
        if len(pts) < 2:
            pts = [g[0][0], g[0][-1]]
        cs, d = destino[ct]
        salida.append({
            't': ct, 's': cs, 'd': d, 'l': round(largo.get(ct, 0.0), 1),
            'p': [[round(x, DECIMALES), round(y, DECIMALES)] for x, y in pts],
        })

vertices = sum(len(t['p']) for t in salida)
print('tramos escritos: {:,}   vertices: {:,}   promedio {:.1f} por tramo'.format(
    len(salida), vertices, vertices / max(1, len(salida))))

ruta = os.path.join(RED, 'red_asignacion.json')
with open(ruta, 'w', encoding='utf-8') as f:
    json.dump({'version': 1, 'alcance_m': ALCANCE_M,
               'tolerancia_simplificacion_grados': TOL_SIMPLIFICAR,
               'campos': {'t': 'c_tramo', 's': 'primer c_sitio aguas abajo',
                          'd': 'metros sobre el cauce del final del tramo a ese sitio',
                          'l': 'longitud del tramo en metros',
                          'p': 'trazo simplificado [lon, lat]'},
               'tramos': salida}, f, ensure_ascii=False, separators=(',', ':'))
mb = os.path.getsize(ruta) / 1048576
print('  -> datos/procesados/red/red_asignacion.json: {:.2f} MB'.format(mb))
if mb > 4:
    print('  OJO: pesa mas de 4 MB. Baja ALCANCE_M o sube TOL_SIMPLIFICAR.')


# ------------------------------------------------- comprobacion de cordura
def metros(a, b):
    return math.hypot((a[0] - b[0]) * 105300.0, (a[1] - b[1]) * 110574.0)


ok = fuera = 0
for r in sitio_red:
    if r['calidad_enganche'] == 'malo':
        continue
    t = next((x for x in salida if x['t'] == r['c_tramo']), None)
    if t is None:
        fuera += 1
        continue
    ok += 1
print('\nsitios cuyo propio tramo quedo en la red podada: {} (fuera: {})'.format(ok, fuera))

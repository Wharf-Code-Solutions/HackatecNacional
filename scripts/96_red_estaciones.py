# -*- coding: utf-8 -*-
"""Donde poner pocas estaciones: cobertura de establecimientos DENUE por sitio.

Una red de monitoreo continuo cuesta por estacion (equipo, instalacion, visitas
de calibracion, reposicion de sondas), asi que el numero de estaciones es una
restriccion, no una variable libre. Este script responde dos preguntas con los
datos del repositorio:

1. Cuanto vigila cada estacion adicional. Un establecimiento con giro
   contaminante (DENUE, F12, filtrado por 95_denue_cuenca.py) queda "vigilado"
   si hay una estacion aguas abajo a VENTANA_M o menos sobre el cauce. Se eligen
   sitios uno a uno, siempre el que mas establecimientos nuevos agrega
   (seleccion voraz de cobertura maxima), y se ve donde dejan de rendir.
2. Que sitios pueden ser estacion. Solo los que tienen historia propia de campo:
   al menos 4 de los 5 parametros que mide la estacion con n >= 12. Sin esa
   historia el motor de reglas (M2) no tiene contra que comparar.

La red elegida son los primeros N_ESTACIONES de esa seleccion, numerados de
aguas arriba hacia aguas abajo (la estacion 1 es la mas lejana de la presa de
Valsequillo, donde termina la red).

Limites que se declaran: el DENUE dice que existe el establecimiento y su giro,
no que descargue ni cuanto; un establecimiento sin sitio a VENTANA_M aguas abajo
no lo vigila ninguna red de estas.

Lee    : datos/procesados/sitio.csv
         datos/procesados/analisis/linea_base_sitio_parametro.csv
         datos/procesados/red/{sitio_aguas_abajo,sitio_red,tiempo_viaje}.csv
         datos/procesados/red/red_asignacion.json   (tramo -> primer sitio aguas abajo)
         datos/procesados/denue/establecimientos_cuenca.csv
         datos/procesados/mapa/red_hidrografica.geojson (60_red_para_mapa.py)
Escribe: datos/procesados/red/red_estaciones.csv
         datos/procesados/mapa/red_vigilada.geojson  (tramos del mapa que vigila cada estacion)

Uso: python -I scripts/96_red_estaciones.py
"""
import csv
import json
import os
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(RAIZ, 'datos', 'procesados')

VENTANA_M = 20000.0        # mismo alcance que red_asignacion.json
N_ESTACIONES = 5           # las que se presentan; ver docs/18-red-de-estaciones.md
N_CURVA = 12               # hasta donde se reporta la curva de rendimiento
MIN_N = 12                 # mediciones para que un parametro cuente como historia
MIN_PARAMETROS = 4         # de los 5 de campo
CAMPO = ['OD_mg/L', 'pH_CAMPO', 'CONDUC_CAMPO', 'TEMP_AGUA', 'TURBIEDAD']
RECEPTOR = 'DLPUE2068'     # presa Manuel Avila Camacho (Valsequillo): donde termina la red


def leer(*partes):
    with open(os.path.join(PROC, *partes), encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


sitio = {r['c_sitio']: r for r in leer('sitio.csv')}
sitio_red = {r['c_sitio']: r for r in leer('red', 'sitio_red.csv')}
abajo = {r['c_sitio']: (r['c_sitio_aguas_abajo'], float(r['distancia_cauce_m'] or 0))
         for r in leer('red', 'sitio_aguas_abajo.csv') if r['c_sitio_aguas_abajo']}
hist = defaultdict(dict)
for r in leer('analisis', 'linea_base_sitio_parametro.csv'):
    hist[r['c_sitio']][r['c_parametro']] = int(r['n'])
with open(os.path.join(PROC, 'red', 'red_asignacion.json'), encoding='utf-8') as f:
    tramo_trazo = json.load(f)['tramos']
tramo = {t['t']: (t['s'], t['d']) for t in tramo_trazo}
establecimientos = leer('denue', 'establecimientos_cuenca.csv')
al_receptor = {r['c_sitio_arriba']: float(r['distancia_cauce_m'])
               for r in leer('red', 'tiempo_viaje.csv') if r['c_sitio_abajo'] == RECEPTOR}

# sitio -> establecimientos que tiene aguas arriba a VENTANA_M o menos
vigila = defaultdict(set)
for e in establecimientos:
    if e['c_tramo'] not in tramo:
        continue                      # ningun sitio a menos de 20 km aguas abajo
    s, d = tramo[e['c_tramo']]
    vistos = set()
    while s and d <= VENTANA_M and s not in vistos:
        vistos.add(s)
        vigila[s].add(e['c_fuente_cont'])
        if s not in abajo:
            break
        s, dd = abajo[s]
        d += dd


def con_historia(s):
    return sum(1 for c in CAMPO if hist[s].get(c, 0) >= MIN_N) >= MIN_PARAMETROS


candidatos = sorted(s for s in sitio if con_historia(s))
cubiertos, curva = set(), []
for _ in range(N_CURVA):
    mejor = max(candidatos, key=lambda s: (len(vigila[s] - cubiertos), s))
    nuevos = len(vigila[mejor] - cubiertos)
    if not nuevos:
        break
    cubiertos |= vigila[mejor]
    curva.append((mejor, nuevos, len(cubiertos)))

elegidas = [s for s, _, _ in curva[:N_ESTACIONES]]
# numeracion de aguas arriba hacia aguas abajo: mas lejos de la presa, numero menor
orden = sorted(elegidas, key=lambda s: -al_receptor.get(s, 0))
numero = {s: i for i, s in enumerate(orden, 1)}

total = len(establecimientos)
ruta = os.path.join(PROC, 'red', 'red_estaciones.csv')
with open(ruta, 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['paso', 'c_sitio', 'nombre', 'cuerpo_agua', 'municipio', 'estado',
                'establecimientos_nuevos', 'establecimientos_acumulados', 'pct_acumulado',
                'condicion_cauce', 'distancia_a_valsequillo_m', 'estacion'])
    for k, (s, nuevos, acum) in enumerate(curva, 1):
        r, rr = sitio[s], sitio_red.get(s, {})
        w.writerow([k, s, r['nombre'], r['cuerpo_agua'], r['municipio'], r['estado'], nuevos, acum,
                    round(100.0 * acum / total, 1), rr.get('condicion_cauce', ''),
                    al_receptor.get(s, ''), 'EST-ATY-{:02d}'.format(numero[s]) if s in numero else ''])

# ------------------------------------------------- tramos que vigila cada estacion, para el mapa
# Un tramo de red_asignacion queda vigilado por la primera estacion que encuentra aguas abajo a
# VENTANA_M o menos. El mapa dibuja la red del INEGI de orden >= 4 (60_red_para_mapa.py), que no
# trae clave de tramo: cada tramo del mapa se marca vigilado si su vertice central cae a menos de
# CERCA_GRADOS de un vertice de un tramo vigilado (las dos redes son del mismo INEGI; la de
# asignacion esta simplificada a ~30 m).
CERCA_GRADOS = 0.0012          # ~120 m
celda, rejilla = 0.002, defaultdict(list)
for t in tramo_trazo:
    s, d = t['s'], t['d']
    vistos = set()
    while s and d <= VENTANA_M and s not in vistos:
        if s in numero:
            for x, y in t['p']:
                rejilla[(int(x // celda), int(y // celda))].append((x, y, s))
            break
        vistos.add(s)
        if s not in abajo:
            break
        s, dd = abajo[s]
        d += dd


def vigilado_por(x, y):
    mejor, dist = None, CERCA_GRADOS
    cx, cy = int(x // celda), int(y // celda)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for px, py, s in rejilla.get((cx + i, cy + j), ()):
                dd = ((px - x) ** 2 + (py - y) ** 2) ** 0.5
                if dd < dist:
                    mejor, dist = s, dd
    return mejor


with open(os.path.join(PROC, 'mapa', 'red_hidrografica.geojson'), encoding='utf-8') as f:
    red_mapa = json.load(f)
vigilada = []
for ft in red_mapa['features']:
    g = ft['geometry']
    lineas = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    linea = max(lineas, key=len)
    x, y = linea[len(linea) // 2][:2]
    s = vigilado_por(x, y)
    if s:
        vigilada.append({'type': 'Feature', 'geometry': g,
                         'properties': {'orden': ft['properties'].get('orden'),
                                        'estacion': 'EST-ATY-{:02d}'.format(numero[s]), 'c_sitio': s}})
# El mapa solo dibuja cauces de orden >= 4, y una estacion puede estar en uno menor (el Alseseca en
# Totimehuacan es de orden 2): quedaria lejos de cualquier rio dibujado. Por eso se agregan los
# tramos de red_asignacion que desembocan en la estacion a CONEXION_M o menos, con su propio trazo.
CONEXION_M = 3000.0
for t in tramo_trazo:
    if t['s'] in numero and t['d'] <= CONEXION_M:
        vigilada.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': t['p']},
                         'properties': {'orden': None, 'estacion': 'EST-ATY-{:02d}'.format(numero[t['s']]),
                                        'c_sitio': t['s'], 'conexion': True}})
ruta_mapa = os.path.join(PROC, 'mapa', 'red_vigilada.geojson')
with open(ruta_mapa, 'w', encoding='utf-8') as f:
    json.dump({'type': 'FeatureCollection', 'features': vigilada}, f, ensure_ascii=False, separators=(',', ':'))

print('Establecimientos DENUE en la cuenca: {}'.format(total))
print('Sitios con historia de campo ({}+ parametros, n >= {}): {}'.format(MIN_PARAMETROS, MIN_N, len(candidatos)))
for k, (s, nuevos, acum) in enumerate(curva, 1):
    print('{:>2}  {:<13} +{:>4}  {:>4} ({:>4.1f} %)  {}'.format(
        k, s, nuevos, acum, 100.0 * acum / total, numero.get(s) and 'EST-ATY-{:02d}'.format(numero[s]) or ''))
print('Tramos del mapa vigilados: {}'.format(len(vigilada)))
print('Escribe ' + os.path.relpath(ruta, RAIZ) + ' y ' + os.path.relpath(ruta_mapa, RAIZ))

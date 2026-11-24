# -*- coding: utf-8 -*-
"""DENUE: establecimientos con giro contaminante, ligados a la red y a cada sitio.

El motor de reglas sabe de que TIPO es una descarga (industrial, organica...),
pero no puede nombrar un establecimiento. Este script cruza el DENUE (F12) con
la topologia de M1 para que "fuente probable" deje de ser una categoria abstracta:

1. Filtra el DENUE de Puebla y Tlaxcala a la cuenca RH18A y a los giros SCIAN
   que descargan al agua (manufactura, mineria, rastros, residuos, granjas,
   hospitales, lavanderias, gasolineras, plantas de tratamiento).
2. Engancha cada establecimiento al tramo mas cercano de la red del INEGI
   (maximo MAX_ENGANCHE_M; si no hay tramo cerca, no es candidato).
3. Para cada sitio de monitoreo, recorre la red hacia aguas arriba (hasta
   ALCANCE_M sobre el cauce) y lista los establecimientos que desaguarian
   hacia ese punto, con su distancia sobre el cauce.

Limites que se declaran, no se esconden: el DENUE dice que existe el
establecimiento y su giro, NO que descargue ni cuanto; el enganche es al tramo
mas cercano, sin verificar si el predio realmente desagua ahi; la distancia
sobre el cauce usa la longitud completa de cada tramo. Es una lista de
sospechosos para inspeccion, no una acusacion.

Lee    : datos/crudos/F12/*.zip, datos/procesados/mapa/cuenca.geojson,
         datos/procesados/red/{tramo,sitio_red}.csv
Escribe: datos/procesados/denue/establecimientos_cuenca.csv
         datos/procesados/denue/candidatos_por_sitio.csv
         contrato/fixtures/candidatos_denue.json

Uso: python -I scripts/95_denue_cuenca.py
"""
import csv
import io
import json
import math
import os
import zipfile
from collections import defaultdict, deque

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRUDOS = os.path.join(RAIZ, 'datos', 'crudos', 'F12')
PROC = os.path.join(RAIZ, 'datos', 'procesados')
SALIDA = os.path.join(PROC, 'denue')
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')

MAX_ENGANCHE_M = 500      # mas lejos de un cauce, no se considera que descargue ahi
ALCANCE_M = 30000         # hasta donde se busca aguas arriba de un sitio
TOPE_POR_SITIO = 40       # candidatos que se guardan por sitio en el CSV
TOPE_FIXTURE = 8          # candidatos por sitio y tipo de fuente en el fixture
LAT0 = 19.0
M_LAT = 110574.0
M_LON = 111320.0 * math.cos(math.radians(LAT0))

# (prefijo SCIAN, tipo de fuente que el motor reconoce, giro legible).
# El prefijo mas largo gana. 'industrial' y 'organica' son las dos fuentes que
# el motor distingue; 'otra' agrupa lo demas.
GIROS = [
    ('3131', 'industrial', 'Textil: hilado y fibras'),
    ('3132', 'industrial', 'Textil: tejido de telas'),
    ('3133', 'industrial', 'Textil: acabado y teñido'),
    ('314', 'industrial', 'Productos textiles'),
    ('315', 'industrial', 'Prendas de vestir'),
    ('316', 'industrial', 'Curtido de cuero y piel'),
    ('322', 'industrial', 'Papel'),
    ('324', 'industrial', 'Derivados del petroleo y carbon'),
    ('325', 'industrial', 'Industria quimica'),
    ('326', 'industrial', 'Plastico y hule'),
    ('327', 'industrial', 'Minerales no metalicos'),
    ('331', 'industrial', 'Metalurgia basica'),
    ('332', 'industrial', 'Productos metalicos'),
    ('333', 'industrial', 'Maquinaria y equipo'),
    ('334', 'industrial', 'Equipo electronico'),
    ('335', 'industrial', 'Equipo electrico'),
    ('336', 'industrial', 'Equipo de transporte'),
    ('337', 'industrial', 'Muebles'),
    ('339', 'industrial', 'Otras manufacturas'),
    ('311', 'organica', 'Alimentos'),
    ('3114', 'organica', 'Conservacion de frutas y verduras'),
    ('3115', 'organica', 'Lacteos'),
    ('3116', 'organica', 'Rastros y carnes'),
    ('3118', 'organica', 'Panificacion'),
    ('3119', 'organica', 'Otros alimentos'),
    ('3121', 'organica', 'Bebidas'),
    ('3122', 'organica', 'Tabaco'),
    ('112', 'organica', 'Ganaderia (granjas)'),
    ('1121', 'organica', 'Bovinos'),
    ('1122', 'organica', 'Porcicultura'),
    ('1123', 'organica', 'Avicultura'),
    ('2213', 'organica', 'Agua potable y drenaje'),
    ('22132', 'organica', 'Tratamiento de aguas residuales'),
    ('311611', 'organica', 'Rastros'),
    ('21', 'industrial', 'Mineria'),
    ('562', 'otra', 'Manejo de residuos'),
    ('622', 'otra', 'Hospitales'),
    ('8123', 'otra', 'Lavanderias y tintorerias'),
    ('468411', 'otra', 'Gasolineras'),
    ('811', 'otra', 'Talleres de reparacion'),
]
GIROS.sort(key=lambda g: -len(g[0]))
# manufactura y mineria: sin mas filtro. Talleres y gasolineras son tantos que
# solo cuentan si caen muy cerca de un cauce; se enganchan igual pero pesan menos.
# Giros que existen por miles pero casi no descargan al agua (panaderias,
# talleres, costura, muebles, ladrilleras, gasolineras): fuera, porque lo que
# sobra tapa a los pocos que si importan.
EXCLUIR = ('3118', '811', '315', '337', '339', '327', '4684', '3122')
# Con 0 a 5 personas solo se conservan los giros cuya descarga es grave aun
# siendo chica (curtidurias, quimica, rastros, porcicultura, mineria, residuos...).
CHICO_OK = ('3133', '316', '325', '3116', '311611', '1122', '22132', '21', '562', '622', '322', '331', '324')
PESO = {'industrial': 3, 'organica': 3, 'otra': 1}
PESO_PREFIJO = {'811': 0.5, '468411': 0.5, '337': 0.5, '315': 1}


def a_xy(lon, lat):
    return lon * M_LON, lat * M_LAT


def giro_de(codigo, personal=''):
    if codigo.startswith(EXCLUIR):
        return None
    if personal.startswith('0 a 5') and not codigo.startswith(CHICO_OK):
        return None
    for pref, tipo, nombre in GIROS:
        if codigo.startswith(pref):
            return pref, tipo, nombre
    return None


def leer_cuenca():
    g = json.load(open(os.path.join(PROC, 'mapa', 'cuenca.geojson'), encoding='utf-8'))
    anillos = []
    for f in g['features']:
        geo = f['geometry']
        polis = [geo['coordinates']] if geo['type'] == 'Polygon' else geo['coordinates']
        for poli in polis:
            anillos.append(poli)
    return anillos


def en_anillo(lon, lat, anillo):
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i][0], anillo[i][1]
        xj, yj = anillo[j][0], anillo[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def en_cuenca(lon, lat, polis):
    for poli in polis:
        if en_anillo(lon, lat, poli[0]) and not any(en_anillo(lon, lat, h) for h in poli[1:]):
            return True
    return False


def leer_tramos():
    tramos = {}
    ruta = os.path.join(PROC, 'red', 'tramo.csv')
    for r in csv.DictReader(open(ruta, encoding='utf-8-sig')):
        x1, y1 = a_xy(float(r['lon_inicio']), float(r['lat_inicio']))
        x2, y2 = a_xy(float(r['lon_fin']), float(r['lat_fin']))
        tramos[r['c_tramo']] = {
            'seg': (x1, y1, x2, y2), 'long': float(r['longitud_m']),
            'abajo': r['c_tramo_aguas_abajo'] or None}
    return tramos


CELDA = 1000.0


def indice(tramos):
    idx = defaultdict(list)
    for c, t in tramos.items():
        x1, y1, x2, y2 = t['seg']
        for cx in range(int(min(x1, x2) // CELDA), int(max(x1, x2) // CELDA) + 1):
            for cy in range(int(min(y1, y2) // CELDA), int(max(y1, y2) // CELDA) + 1):
                idx[(cx, cy)].append(c)
    return idx


def dist_segmento(px, py, seg):
    x1, y1, x2, y2 = seg
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy
    u = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    return math.hypot(px - (x1 + u * dx), py - (y1 + u * dy))


def tramo_cercano(px, py, tramos, idx):
    cx, cy = int(px // CELDA), int(py // CELDA)
    mejor, dmin = None, MAX_ENGANCHE_M + 1
    for ax in (cx - 1, cx, cx + 1):
        for ay in (cy - 1, cy, cy + 1):
            for c in idx.get((ax, ay), ()):
                d = dist_segmento(px, py, tramos[c]['seg'])
                if d < dmin:
                    mejor, dmin = c, d
    return (mejor, dmin) if mejor else (None, None)


def leer_denue(polis):
    xs = [p[0] for poli in polis for p in poli[0]]
    ys = [p[1] for poli in polis for p in poli[0]]
    lon0, lon1, lat0, lat1 = min(xs), max(xs), min(ys), max(ys)
    vistos, descartados = [], 0
    for nombre in sorted(os.listdir(CRUDOS)):
        if not nombre.endswith('.zip'):
            continue
        zf = zipfile.ZipFile(os.path.join(CRUDOS, nombre))
        interno = [n for n in zf.namelist() if n.startswith('conjunto_de_datos/') and n.endswith('.csv')][0]
        lector = csv.DictReader(io.TextIOWrapper(zf.open(interno), encoding='latin-1', newline=''))
        for r in lector:
            g = giro_de(r['codigo_act'], r['per_ocu'])
            if not g:
                continue
            try:
                lon, lat = float(r['longitud']), float(r['latitud'])
            except ValueError:
                descartados += 1
                continue
            if not (lon0 <= lon <= lon1 and lat0 <= lat <= lat1) or not en_cuenca(lon, lat, polis):
                continue
            vistos.append((r, g, lon, lat))
    return vistos, descartados


def main():
    polis = leer_cuenca()
    tramos = leer_tramos()
    idx = indice(tramos)
    registros, sin_coord = leer_denue(polis)

    estab = []
    por_tramo = defaultdict(list)
    for r, (pref, tipo, giro), lon, lat in registros:
        px, py = a_xy(lon, lat)
        c, d = tramo_cercano(px, py, tramos, idx)
        if not c:
            continue
        nombre = (r['nom_estab'] or r['raz_social'] or giro).strip()
        e = {'c_fuente_cont': 'DENUE-' + r['id'], 'nombre': nombre, 'codigo_scian': r['codigo_act'],
             'giro': giro, 'tipo_fuente': tipo, 'municipio': r['municipio'], 'entidad': r['entidad'],
             'lon': lon, 'lat': lat, 'c_tramo': c, 'distancia_al_cauce_m': round(d, 0),
             'personal': r['per_ocu'], 'fecha_alta': r['fecha_alta'],
             'peso': PESO[tipo] * PESO_PREFIJO.get(pref, 1)}
        estab.append(e)
        por_tramo[c].append(e)

    os.makedirs(SALIDA, exist_ok=True)
    cols = ['c_fuente_cont', 'nombre', 'codigo_scian', 'giro', 'tipo_fuente', 'municipio', 'entidad',
            'lon', 'lat', 'c_tramo', 'distancia_al_cauce_m', 'personal', 'fecha_alta']
    with open(os.path.join(SALIDA, 'establecimientos_cuenca.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(estab)

    # tramos que desaguan en cada tramo (para recorrer hacia arriba)
    arriba = defaultdict(list)
    for c, t in tramos.items():
        if t['abajo']:
            arriba[t['abajo']].append(c)

    sitios = list(csv.DictReader(open(os.path.join(PROC, 'red', 'sitio_red.csv'), encoding='utf-8-sig')))
    filas, fixture = [], {}
    sin_cand = 0
    for s in sitios:
        t0 = s['c_tramo']
        if t0 not in tramos:
            continue
        frac = float(s['fraccion'] or 1)
        # enc[c] = metros sobre el cauce entre el extremo de aguas abajo de c y
        # el sitio; en el propio tramo del sitio solo cuenta lo que queda arriba
        enc = {t0: 0.0}
        cola = deque([t0])
        while cola:
            c = cola.popleft()
            largo = tramos[c]['long'] * (frac if c == t0 else 1)
            for a in arriba.get(c, ()):
                d = enc[c] + largo
                if a not in enc and d <= ALCANCE_M:
                    enc[a] = d
                    cola.append(a)
        cands = []
        for c, dc in enc.items():
            for e in por_tramo.get(c, ()):
                # distancia sobre el cauce: lo recorrido desde el tramo del
                # establecimiento hasta el sitio, mas el enganche transversal
                cands.append((e, dc + e['distancia_al_cauce_m']))
        # orden: primero lo cercano; el peso del giro pesa como 3 km por punto
        cands.sort(key=lambda p: p[1] - 3000 * p[0]['peso'])
        if not cands:
            sin_cand += 1
        for rango, (e, d) in enumerate(cands[:TOPE_POR_SITIO], 1):
            filas.append({'c_sitio': s['c_sitio'], 'rango': rango, 'c_fuente_cont': e['c_fuente_cont'],
                          'nombre': e['nombre'], 'giro': e['giro'], 'tipo_fuente': e['tipo_fuente'],
                          'municipio': e['municipio'], 'distancia_cauce_m': round(d, 0),
                          'distancia_al_cauce_m': e['distancia_al_cauce_m']})
        porti = defaultdict(list)
        for e, d in cands:
            if len(porti[e['tipo_fuente']]) < TOPE_FIXTURE:
                porti[e['tipo_fuente']].append(
                    {'c_fuente_cont': e['c_fuente_cont'], 'nombre': e['nombre'],
                     'giro': e['giro'], 'distancia_m': round(d, 0)})
        fixture[s['c_sitio']] = dict(porti)

    cols2 = ['c_sitio', 'rango', 'c_fuente_cont', 'nombre', 'giro', 'tipo_fuente', 'municipio',
             'distancia_cauce_m', 'distancia_al_cauce_m']
    with open(os.path.join(SALIDA, 'candidatos_por_sitio.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols2)
        w.writeheader()
        w.writerows(filas)
    with open(os.path.join(FIX, 'candidatos_denue.json'), 'w', encoding='utf-8') as f:
        json.dump({'version': '1.0',
                   'fuente': 'INEGI DENUE vigente (F12) cruzado con la red de M1',
                   'alcance_m': ALCANCE_M, 'max_enganche_m': MAX_ENGANCHE_M,
                   'n_establecimientos': len(estab), 'sitios': fixture},
                  f, ensure_ascii=False, indent=1)

    cuenta = defaultdict(int)
    for e in estab:
        cuenta[e['tipo_fuente']] += 1
    print('Establecimientos con giro de interes dentro de la cuenca:', len(registros))
    print('  enganchados a un tramo (<= {} m): {}'.format(MAX_ENGANCHE_M, len(estab)), dict(cuenta))
    print('Sitios:', len(sitios), '| sin ningun candidato aguas arriba:', sin_cand)
    print('Archivos escritos en', SALIDA)


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""Escuelas públicas rurales de Puebla y los factores de su índice de riesgo (módulo A, docs/19).

Base: el catálogo de centros de trabajo de la SEP (CCT, nivel, ámbito rural/urbano, coordenadas).
A cada escuela pública rural le agrega lo que hoy se puede medir y escribe
`datos/procesados/escuelas/factores_escuelas.csv`, la entrada de `97_escuelas_riesgo.py`: las columnas del
contrato (docs/19 §4.1), un puntaje de 0 a 1 por factor y los valores crudos de donde sale cada puntaje.

Factores y su puntaje (los cortes son hipótesis, igual que los pesos de 97):

    pendiente                   percentil 75 de la pendiente en RADIO_PENDIENTE_M (la ladera, no la parcela):
                                0 en 5°, 1 en 30° o más. Mosaicos de elevación terrarium (AWS, públicos).
    susceptibilidad_laderas     SIN DATO todavía (CENAPRED). 0.
    urbanizacion_reciente       establecimientos del DENUE dados de alta desde 2020 a menos de 1 km: 1 con 30 o más.
    cercania_cauce_o_descarga   fuente contaminante del DENUE más cercana (giros de 95_denue_cuenca.py):
                                1 a menos de 100 m, 0 a 1 km o más. La red de ríos solo existe para la cuenca
                                del Atoyac, así que por ahora solo cuentan las descargas.
    calidad_agua                sitio CONAGUA a menos de 2 km: su fracción de mediciones fuera de norma.
                                SIN DATO (0) si no hay sitio cerca.
    sin_drenaje                 CONAPO: % de ocupantes sin drenaje ni excusado en la localidad: 1 con 50 % o más.
    marginacion                 CONAPO: grado de marginación de la localidad: Muy alto 1, Alto 0.75, Medio 0.5,
                                Bajo 0.25, Muy bajo 0.

La columna `sin_dato` dice qué factores quedaron en 0 por falta de fuente, para no confundirlos con riesgo nulo.

Lee    : datos/crudos/F18/cnct2026.csv (SEP, bajado a mano: el portal bloquea descargas automáticas),
         F19/IML_2020.zip (CONAPO, necesita xlrd), F16/iter_21_cpv2020_csv.zip (INEGI, coordenadas de localidades),
         F12/denue_21_puebla_csv.zip (DENUE), F17/terrarium (caché de elevación), contrato/fixtures/sitios.geojson
         y estaciones.json
Escribe: datos/procesados/escuelas/factores_escuelas.csv

    python -I scripts/98_escuelas_candidatas.py
"""
import csv
import importlib.util
import io
import json
import math
import os
import re
import time
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AQUI = os.path.join(RAIZ, 'scripts')
CR = os.path.join(RAIZ, 'datos', 'crudos')
SEP = os.path.join(CR, 'F18', 'cnct2026.csv')
IML = os.path.join(CR, 'F19', 'IML_2020.zip')
ITER = os.path.join(CR, 'F16', 'iter_21_cpv2020_csv.zip')
DENUE = os.path.join(CR, 'F12', 'denue_21_puebla_csv.zip')
TERRENO = os.path.join(CR, 'F17', 'terrarium')
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
SALIDA = os.path.join(RAIZ, 'datos', 'procesados', 'escuelas', 'factores_escuelas.csv')

_spec = importlib.util.spec_from_file_location('denue_cuenca', os.path.join(AQUI, '95_denue_cuenca.py'))
d95 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(d95)

NIVEL = {'preescolar': 'preescolar', 'primaria': 'primaria', 'secundaria': 'secundaria', 'media superior': 'media_superior'}
TIPOS = ('escuela', 'plantel (media superior)')
RADIO_PENDIENTE_M = 250
ZOOM = 12
URL_TERRENO = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
UA = 'Mozilla/5.0 (recoleccion de datos abiertos, HackaTec 2026)'
GRADO = {'Muy alto': 1.0, 'Alto': 0.75, 'Medio': 0.5, 'Bajo': 0.25, 'Muy bajo': 0.0}
ALTA_RECIENTE = '2020-01'
M_LAT = 110574.0


def m_lon(lat):
    return 111320.0 * math.cos(math.radians(lat))


def metros(la1, lo1, la2, lo2):
    return math.hypot((la1 - la2) * M_LAT, (lo1 - lo2) * m_lon(la1))


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').strip().lower())
    return re.sub(r'[^a-z0-9 ]', '', ''.join(c for c in s if not unicodedata.combining(c))).strip()


def lineal(v, cero, uno):
    """0 en `cero`, 1 en `uno` (funciona también con cero > uno), recortado a [0, 1]."""
    if v is None:
        return 0.0
    return round(min(1.0, max(0.0, (v - cero) / (uno - cero))), 3)


class Rejilla:
    """Puntos por celdas de ~2 km para buscar vecinos sin comparar con todos."""
    def __init__(self, puntos, celda=0.02):
        self.celda, self.r = celda, defaultdict(list)
        for p in puntos:
            self.r[(int(p[0] / celda), int(p[1] / celda))].append(p)

    def cerca(self, lat, lon, radio_m):
        k = int(radio_m / (self.celda * M_LAT)) + 1
        ci, cj = int(lat / self.celda), int(lon / self.celda)
        for di in range(-k, k + 1):
            for dj in range(-k, k + 1):
                for p in self.r.get((ci + di, cj + dj), ()):
                    d = metros(lat, lon, p[0], p[1])
                    if d <= radio_m:
                        yield d, p


# ------------------------------------------------------------------ fuentes
def escuelas_sep():
    salida = []
    with open(SEP, encoding='utf-8-sig', newline='') as f:
        for r in csv.DictReader(f):
            if not r['cv_cct'].startswith('21') or r['c_tipo'] not in TIPOS:
                continue
            if r['inmueble_c_nom_ambito'] != 'rural' or r['sostenimiento_c_control'] != 'público':
                continue
            nivel = NIVEL.get(r['tiponivelsub_c_servicion2']) or NIVEL.get(r['tiponivelsub_c_servicion1'])
            if not nivel:
                continue                       # inicial, especial, capacitación, superior: fuera del alcance de CAPCEE
            try:
                lat, lon = float(r['inmueble_latitud']), float(r['inmueble_longitud'])
            except ValueError:
                continue
            if not (17.5 <= lat <= 21.0 and -99.5 <= lon <= -96.5):
                continue
            salida.append({'cct': r['cv_cct'], 'nombre': r['c_nombre'].strip(), 'nivel': nivel,
                           'municipio': r['inmueble_c_nom_mun'].strip(), 'localidad': r['inmueble_c_nom_loc'].strip(),
                           'latitud': lat, 'longitud': lon})
    return salida


def marginacion():
    try:
        import xlrd
    except ImportError:
        # `python -I` ignora los paquetes instalados con `pip install --user`; xlrd suele estar ahí
        import site
        import sys
        sys.path.append(site.getusersitepackages())
        import xlrd
    wb = xlrd.open_workbook(file_contents=zipfile.ZipFile(IML).read('IML_2020.xls'))
    s = wb.sheet_by_name('IML_2020_MICH-ZAC')
    cols = s.row_values(0)
    i = {c: cols.index(c) for c in ('CVE_LOC', 'NOM_MUN', 'NOM_LOC', 'OVSDE', 'GM_2020')}
    loc = {}
    for n in range(1, s.nrows):
        v = s.row_values(n)
        if str(v[i['CVE_LOC']]).startswith('21'):
            loc[str(v[i['CVE_LOC']])] = {'nom_mun': v[i['NOM_MUN']], 'nom_loc': v[i['NOM_LOC']],
                                         'ovsde': v[i['OVSDE']] if isinstance(v[i['OVSDE']], float) else None,
                                         'grado': v[i['GM_2020']]}
    return loc


def dms(texto):
    m = re.match(r"\s*(\d+)\D+(\d+)\D+([\d.]+)\D*([NSEOW])", texto or '')
    if not m:
        return None
    g = int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3)) / 3600
    return -g if m.group(4) in 'SOW' else g


def coordenadas_localidades():
    z = zipfile.ZipFile(ITER)
    nombre = next(n for n in z.namelist() if 'conjunto_de_datos_iter' in n and n.endswith('.csv'))
    loc = {}
    with io.TextIOWrapper(z.open(nombre), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            if r['LOC'] in ('0000', '9998', '9999'):
                continue
            la, lo = dms(r['LATITUD']), dms(r['LONGITUD'])
            if la is not None and lo is not None:
                loc['21' + r['MUN'] + r['LOC']] = (la, lo)
    return loc


def denue():
    z = zipfile.ZipFile(DENUE)
    nombre = next(n for n in z.namelist() if re.search(r'denue_inegi_21_?\.csv$', n))
    fuentes, recientes = [], []
    with io.TextIOWrapper(z.open(nombre), encoding='latin-1') as f:
        for r in csv.DictReader(f):
            try:
                la, lo = float(r['latitud']), float(r['longitud'])
            except ValueError:
                continue
            g = d95.giro_de(r['codigo_act'], r['per_ocu'])
            if g:
                fuentes.append((la, lo, g[2]))
            if (r.get('fecha_alta') or '') >= ALTA_RECIENTE:
                recientes.append((la, lo))
    return fuentes, recientes


# ------------------------------------------------------------------ pendiente (como en la versión anterior)
def mosaico(x, y):
    from PIL import Image
    ruta = os.path.join(TERRENO, str(ZOOM), str(x), '{}.png'.format(y))
    if not os.path.exists(ruta):
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        for intento in range(3):
            try:
                pet = urllib.request.Request(URL_TERRENO.format(z=ZOOM, x=x, y=y), headers={'User-Agent': UA})
                with urllib.request.urlopen(pet, timeout=60) as resp, open(ruta, 'wb') as f:
                    f.write(resp.read())
                break
            except OSError:
                if intento == 2:
                    raise
                time.sleep(2)
    px = Image.open(ruta).convert('RGB').load()
    return [[px[i, j][0] * 256 + px[i, j][1] + px[i, j][2] / 256 - 32768 for i in range(256)] for j in range(256)]


class Terreno:
    def __init__(self):
        self.cache = {}

    def elev(self, gx, gy):
        t = (int(gx // 256), int(gy // 256))
        if t not in self.cache:
            self.cache[t] = mosaico(*t)
        return self.cache[t][int(gy) % 256][int(gx) % 256]

    def pendiente_p75(self, lat, lon):
        n = 2 ** ZOOM
        gx = (lon + 180) / 360 * n * 256
        gy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * 256
        res = 156543.03392 * math.cos(math.radians(lat)) / n
        r = max(1, int(RADIO_PENDIENTE_M / res))
        pend = []
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    x, y = gx + dx, gy + dy
                    a = (self.elev(x + 1, y) - self.elev(x - 1, y)) / (2 * res)
                    b = (self.elev(x, y + 1) - self.elev(x, y - 1)) / (2 * res)
                    pend.append(math.degrees(math.atan(math.hypot(a, b))))
        pend.sort()
        return round(pend[int(0.75 * (len(pend) - 1))], 1)


# ------------------------------------------------------------------ armado
def main():
    escuelas = escuelas_sep()
    print('SEP: {} escuelas públicas rurales de Puebla (preescolar a media superior)'.format(len(escuelas)))
    iml = marginacion()
    coords = coordenadas_localidades()
    # índice por (municipio, localidad) normalizados; y por municipio, las localidades con coordenadas
    por_nombre, por_mun = {}, defaultdict(list)
    for cve, l in iml.items():
        por_nombre.setdefault((norm(l['nom_mun']), norm(l['nom_loc'])), cve)
        if cve in coords:
            por_mun[norm(l['nom_mun'])].append((coords[cve][0], coords[cve][1], cve))
    fuentes, recientes = denue()
    rf, rr = Rejilla(fuentes), Rejilla(recientes)
    sitios = json.load(open(os.path.join(FIX, 'sitios.geojson'), encoding='utf-8'))['features']
    rs = Rejilla([(s['geometry']['coordinates'][1], s['geometry']['coordinates'][0], s['properties']) for s in sitios])
    estaciones = json.load(open(os.path.join(FIX, 'estaciones.json'), encoding='utf-8'))['estaciones']
    print('CONAPO: {} localidades; DENUE: {} fuentes, {} altas desde 2020'.format(len(iml), len(fuentes), len(recientes)))

    t = Terreno()
    por_nombre_ok = por_cercania = sin_loc = 0
    for i, e in enumerate(escuelas, 1):
        la, lo = e['latitud'], e['longitud']
        cve = por_nombre.get((norm(e['municipio']), norm(e['localidad'])))
        if cve:
            por_nombre_ok += 1
        else:
            cands = [(metros(la, lo, a, b), c) for a, b, c in por_mun.get(norm(e['municipio']), ())]
            if cands and min(cands)[0] <= 3000:
                cve = min(cands)[1]
                por_cercania += 1
            else:
                sin_loc += 1
        l = iml.get(cve, {})
        e['cve_loc'] = cve or ''
        e['grado_marginacion'] = l.get('grado', '')
        e['pct_sin_drenaje'] = round(l['ovsde'], 1) if l.get('ovsde') is not None else ''
        e['pendiente_p75'] = t.pendiente_p75(la, lo)
        fc = min(rf.cerca(la, lo, 1500), default=None, key=lambda x: x[0])
        e['dist_fuente_m'] = round(fc[0]) if fc else ''
        e['fuente_cercana'] = fc[1][2] if fc else ''
        e['altas_recientes_1km'] = sum(1 for _ in rr.cerca(la, lo, 1000))
        sc = min(rs.cerca(la, lo, 2000), default=None, key=lambda x: x[0])
        e['sitio_conagua'] = sc[1][2]['c_sitio'] if sc else ''
        e['pct_mediciones_malas'] = sc[1][2].get('pct_mediciones_malas') if sc else ''
        est = min(((metros(la, lo, s['latitud'], s['longitud']), s['c_estacion']) for s in estaciones), default=None)
        e['c_estacion'] = est[1] if est and est[0] <= 3000 else ''
        # puntajes 0..1
        e['pendiente'] = lineal(e['pendiente_p75'], 5, 30)
        e['susceptibilidad_laderas'] = 0.0
        e['urbanizacion_reciente'] = lineal(e['altas_recientes_1km'], 0, 30)
        e['cercania_cauce_o_descarga'] = lineal(fc[0], 1000, 100) if fc else 0.0
        e['calidad_agua'] = round(min(1.0, float(e['pct_mediciones_malas'])), 3) if e['pct_mediciones_malas'] not in ('', None) else 0.0
        e['sin_drenaje'] = lineal(l.get('ovsde'), 0, 50) if l.get('ovsde') is not None else 0.0
        e['marginacion'] = GRADO.get(l.get('grado'), 0.0)
        faltan = ['susceptibilidad_laderas']
        if not sc:
            faltan.append('calidad_agua')
        if not l:
            faltan += ['sin_drenaje', 'marginacion']
        e['sin_dato'] = ' '.join(faltan)
        e['ambito'], e['matricula'], e['fuente_agua'] = 'rural', '', 'desconocida'
        if i % 1000 == 0:
            print('  {} de {} ({} mosaicos de elevación)'.format(i, len(escuelas), len(t.cache)))
    print('localidad: {} por nombre, {} por cercanía, {} sin localidad'.format(por_nombre_ok, por_cercania, sin_loc))

    campos = ['cct', 'nombre', 'nivel', 'matricula', 'municipio', 'localidad', 'ambito', 'latitud', 'longitud',
              'fuente_agua', 'c_estacion', 'pendiente', 'susceptibilidad_laderas', 'urbanizacion_reciente',
              'cercania_cauce_o_descarga', 'calidad_agua', 'sin_drenaje', 'marginacion', 'sin_dato',
              'cve_loc', 'grado_marginacion', 'pct_sin_drenaje', 'pendiente_p75', 'dist_fuente_m', 'fuente_cercana',
              'altas_recientes_1km', 'sitio_conagua', 'pct_mediciones_malas']
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
        w.writeheader()
        w.writerows(escuelas)
    print('{}: {} escuelas ({} mosaicos de elevación)'.format(os.path.relpath(SALIDA, RAIZ), len(escuelas), len(t.cache)))


if __name__ == '__main__':
    main()

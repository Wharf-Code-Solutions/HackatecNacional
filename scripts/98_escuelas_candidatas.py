# -*- coding: utf-8 -*-
"""Escuelas públicas de Puebla con los datos para su índice de riesgo (módulo A, docs/19).

Primer paso de los datos reales. Deja una tabla intermedia, una fila por escuela pública del DENUE, con lo
que hoy se puede medir sin más descargas que las del INEGI:

    clee, nombre, nivel, municipio, localidad, cve_mun, cve_loc, latitud, longitud,
    ambito            rural si su localidad tiene menos de 2 500 habitantes (criterio del INEGI)
    pob_localidad     habitantes de la localidad (censo 2020)
    pct_sin_drenaje   viviendas habitadas sin drenaje / viviendas habitadas (censo 2020, ITER)
    pct_agua_fuera    viviendas con agua entubada solo fuera de la vivienda o sin ella (censo 2020)
    pendiente_p75     pendiente en grados, percentil 75 dentro de RADIO_PENDIENTE_M (la ladera alrededor,
                      no la parcela, que suele estar aplanada)
    dist_fuente_m     distancia a la fuente contaminante más cercana del DENUE (mismos giros que 95_denue_cuenca.py)
    fuente_cercana    su giro

Lo que falta para el índice completo, y de dónde sale (docs/19 §5): la CCT y la matrícula (catálogo de
centros de trabajo de la SEP, que bloquea descargas automáticas: se baja a mano a datos/crudos/F18),
la susceptibilidad de laderas (CENAPRED), la marginación (CONAPO) y la calidad del agua de la fuente.

Lee    : datos/crudos/F12/denue_21_puebla_csv.zip (DENUE), datos/crudos/F16/iter_21_cpv2020_csv.zip (ITER 2020),
         mosaicos de elevación terrarium de AWS (públicos, sin llave; caché en datos/crudos/F17)
Escribe: datos/procesados/escuelas/escuelas_candidatas.csv

    python -I scripts/98_escuelas_candidatas.py
"""
import csv
import importlib.util
import io
import math
import os
import re
import time
import urllib.request
import zipfile
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AQUI = os.path.join(RAIZ, 'scripts')
DENUE = os.path.join(RAIZ, 'datos', 'crudos', 'F12', 'denue_21_puebla_csv.zip')
ITER = os.path.join(RAIZ, 'datos', 'crudos', 'F16', 'iter_21_cpv2020_csv.zip')
TERRENO = os.path.join(RAIZ, 'datos', 'crudos', 'F17', 'terrarium')
SALIDA = os.path.join(RAIZ, 'datos', 'procesados', 'escuelas', 'escuelas_candidatas.csv')

# La clasificación de giros contaminantes vive en 95_denue_cuenca.py: se reutiliza, no se copia.
_spec = importlib.util.spec_from_file_location('denue_cuenca', os.path.join(AQUI, '95_denue_cuenca.py'))
d95 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(d95)

# Escuelas del sector público (el CAPCEE construye y mantiene las públicas): SCIAN 6111x2
NIVEL = {'611112': 'preescolar', '611122': 'primaria', '611132': 'secundaria', '611142': 'secundaria',
         '611152': 'media_superior', '611162': 'media_superior', '611172': 'otro', '611182': 'otro'}
RURAL_MAX = 2500
RADIO_PENDIENTE_M = 250
ZOOM = 12                      # ~36 m por pixel a esta latitud
URL_TERRENO = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
UA = 'Mozilla/5.0 (recoleccion de datos abiertos, HackaTec 2026)'
M_LAT = 110574.0


def m_lon(lat):
    return 111320.0 * math.cos(math.radians(lat))


# ------------------------------------------------------------------ ITER: localidades
def numero(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None      # '*' (reservado por confidencialidad) o 'N/D'


def localidades():
    z = zipfile.ZipFile(ITER)
    nombre = next(n for n in z.namelist() if n.endswith('.csv') and 'conjunto_de_datos_iter' in n)
    loc = {}
    with io.TextIOWrapper(z.open(nombre), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            if r['LOC'] in ('0000', '9998', '9999'):
                continue           # totales del municipio y localidades agrupadas
            viv = numero(r['VIVPAR_HAB'])
            sin_dren, agua_fuera = numero(r['VPH_NODREN']), numero(r['VPH_AGUAFV'])
            loc[(r['MUN'], r['LOC'])] = {
                'pob': numero(r['POBTOT']),
                'pct_sin_drenaje': round(sin_dren / viv, 3) if viv and sin_dren is not None else None,
                'pct_agua_fuera': round(agua_fuera / viv, 3) if viv and agua_fuera is not None else None,
            }
    return loc


# ------------------------------------------------------------------ DENUE: escuelas y fuentes
def denue():
    z = zipfile.ZipFile(DENUE)
    nombre = next(n for n in z.namelist() if re.search(r'denue_inegi_21_?\.csv$', n))
    escuelas, fuentes = [], []
    with io.TextIOWrapper(z.open(nombre), encoding='latin-1') as f:
        for r in csv.DictReader(f):
            try:
                lat, lon = float(r['latitud']), float(r['longitud'])
            except ValueError:
                continue
            cod = r['codigo_act']
            if cod in NIVEL:
                escuelas.append({'clee': r['clee'], 'nombre': r['nom_estab'].strip(), 'nivel': NIVEL[cod],
                                 'municipio': r['municipio'].strip(), 'localidad': r['localidad'].strip(),
                                 'cve_mun': r['cve_mun'].zfill(3), 'cve_loc': r['cve_loc'].zfill(4),
                                 'latitud': lat, 'longitud': lon})
            else:
                g = d95.giro_de(cod, r['per_ocu'])
                if g:
                    fuentes.append((lat, lon, g[2]))
    return escuelas, fuentes


def fuente_mas_cercana(escuelas, fuentes):
    """Rejilla de 0.02 grados (~2 km): solo se compara con las fuentes de las celdas vecinas."""
    celda = 0.02
    rejilla = defaultdict(list)
    for la, lo, g in fuentes:
        rejilla[(int(la / celda), int(lo / celda))].append((la, lo, g))
    for e in escuelas:
        ci, cj = int(e['latitud'] / celda), int(e['longitud'] / celda)
        mejor = (None, None)
        for di in range(-3, 4):
            for dj in range(-3, 4):
                for la, lo, g in rejilla.get((ci + di, cj + dj), ()):
                    d = math.hypot((la - e['latitud']) * M_LAT, (lo - e['longitud']) * m_lon(e['latitud']))
                    if mejor[0] is None or d < mejor[0]:
                        mejor = (d, g)
        e['dist_fuente_m'] = round(mejor[0]) if mejor[0] is not None else None
        e['fuente_cercana'] = mejor[1] or ''


# ------------------------------------------------------------------ pendiente
def mosaico(x, y):
    """Elevaciones de un mosaico terrarium (256 x 256), con caché en disco."""
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
    img = Image.open(ruta).convert('RGB')
    px = img.load()
    return [[px[i, j][0] * 256 + px[i, j][1] + px[i, j][2] / 256 - 32768 for i in range(256)] for j in range(256)]


def a_pixel(lat, lon):
    n = 2 ** ZOOM
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x * 256, y * 256          # pixel global


class Terreno:
    def __init__(self):
        self.cache = {}

    def elev(self, gx, gy):
        tx, ty = int(gx // 256), int(gy // 256)
        if (tx, ty) not in self.cache:
            self.cache[(tx, ty)] = mosaico(tx, ty)
        return self.cache[(tx, ty)][int(gy) % 256][int(gx) % 256]

    def pendiente_p75(self, lat, lon):
        gx, gy = a_pixel(lat, lon)
        res = 156543.03392 * math.cos(math.radians(lat)) / 2 ** ZOOM      # metros por pixel
        r = max(1, int(RADIO_PENDIENTE_M / res))
        pend = []
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy > r * r:
                    continue
                x, y = gx + dx, gy + dy
                dzdx = (self.elev(x + 1, y) - self.elev(x - 1, y)) / (2 * res)
                dzdy = (self.elev(x, y + 1) - self.elev(x, y - 1)) / (2 * res)
                pend.append(math.degrees(math.atan(math.hypot(dzdx, dzdy))))
        pend.sort()
        return round(pend[int(0.75 * (len(pend) - 1))], 1)


def main():
    loc = localidades()
    escuelas, fuentes = denue()
    print('DENUE: {} escuelas públicas, {} fuentes contaminantes'.format(len(escuelas), len(fuentes)))
    sin_loc = 0
    for e in escuelas:
        l = loc.get((e['cve_mun'], e['cve_loc']))
        if not l:
            sin_loc += 1
        e['pob_localidad'] = int(l['pob']) if l and l['pob'] is not None else None
        e['ambito'] = ('rural' if e['pob_localidad'] < RURAL_MAX else 'urbano') if e['pob_localidad'] is not None else ''
        e['pct_sin_drenaje'] = l['pct_sin_drenaje'] if l else None
        e['pct_agua_fuera'] = l['pct_agua_fuera'] if l else None
    fuente_mas_cercana(escuelas, fuentes)
    rurales = [e for e in escuelas if e['ambito'] == 'rural']
    print('rurales: {} (sin localidad en el ITER: {})'.format(len(rurales), sin_loc))
    t = Terreno()
    for i, e in enumerate(rurales, 1):
        e['pendiente_p75'] = t.pendiente_p75(e['latitud'], e['longitud'])
        if i % 250 == 0:
            print('  pendiente: {} de {} ({} mosaicos)'.format(i, len(rurales), len(t.cache)))
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    campos = ['clee', 'nombre', 'nivel', 'municipio', 'localidad', 'cve_mun', 'cve_loc', 'latitud', 'longitud', 'ambito',
              'pob_localidad', 'pct_sin_drenaje', 'pct_agua_fuera', 'pendiente_p75', 'dist_fuente_m', 'fuente_cercana']
    with open(SALIDA, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
        w.writeheader()
        for e in rurales:
            w.writerow(e)
    print('{}: {} escuelas rurales ({} mosaicos de elevación)'.format(os.path.relpath(SALIDA, RAIZ), len(rurales), len(t.cache)))


if __name__ == '__main__':
    main()

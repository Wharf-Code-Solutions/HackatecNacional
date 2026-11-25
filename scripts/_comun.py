# -*- coding: utf-8 -*-
"""Funciones compartidas por los scripts de la Etapa 1: lectura de los Excel de
CONAGUA, normalizacion de texto, fechas y valores censurados.

No se ejecuta por si solo.
"""
import re
import unicodedata
from datetime import datetime

# Encabezados que en las hojas RESULTADOS son metadatos, no parametros.
META = ('CLAVE SITIO', 'CLAVE DE MONITOREO', 'CLAVE MONITOREO',
        'NOMBRE DEL SITIO', 'TIPO CUERPO DE AGUA', 'FECHA REALIZACION',
        'FECHA', 'ANO')

NULOS = ('ND', 'N/D', 'S/D', '-', 'NA', 'N.D.', 'NONE', 'NULL')


def sin_acentos(s):
    """Mayusculas sin acentos ni espacios al borde. Para comparar encabezados."""
    if s is None:
        return ''
    s = unicodedata.normalize('NFKD', str(s))
    return ''.join(c for c in s if not unicodedata.combining(c)).upper().strip()


# Las fuentes escriben el mismo estado de formas distintas: F01 pone "PUEBLA" y
# F05 pone "PUEBLA DE ZARAGOZA" (que es el nombre oficial de la capital, no del
# estado). Sin normalizar, agrupar por estado parte la cuenca en tres.
ESTADO_CANONICO = {
    'PUEBLA': 'PUEBLA',
    'PUEBLA DE ZARAGOZA': 'PUEBLA',
    'H. PUEBLA DE ZARAGOZA': 'PUEBLA',
    'HEROICA PUEBLA DE ZARAGOZA': 'PUEBLA',
    'TLAXCALA': 'TLAXCALA',
    'TLAXCALA DE XICOHTENCATL': 'TLAXCALA',
}


def normaliza_estado(valor):
    """Devuelve el nombre canonico del estado, o el original si no se conoce."""
    clave = sin_acentos(valor)
    return ESTADO_CANONICO.get(clave, str(valor).strip() if valor else '')


def parse_valor(v):
    """Devuelve (valor, bajo_ld, limite_ld, censura_sup).

    `<0.01` -> valor nulo, bajo_ld true, limite_ld 0.01.
    `>24000` -> valor 24000, censura_sup true.
    Texto no numerico o marcador de ausencia -> todo vacio.
    """
    if v is None or isinstance(v, bool):
        return None, '', '', ''
    if isinstance(v, (int, float)):
        return float(v), 'false', '', 'false'
    s = str(v).strip().replace(',', '')
    if s == '' or sin_acentos(s) in NULOS:
        return None, '', '', ''
    m = re.match(r'^<\s*([0-9.]+)$', s)
    if m:
        return None, 'true', m.group(1), 'false'
    m = re.match(r'^>\s*([0-9.]+)$', s)
    if m:
        return float(m.group(1)), 'false', '', 'true'
    try:
        return float(s), 'false', '', 'false'
    except ValueError:
        return None, '', '', ''


def leer_xlsb(ruta, hoja):
    from pyxlsb import open_workbook
    with open_workbook(ruta) as wb:
        with wb.get_sheet(hoja) as sh:
            for row in sh.rows():
                yield [c.v for c in row]


def leer_xlsx(ruta, hoja):
    import openpyxl
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    ws = wb[hoja]
    for row in ws.iter_rows(values_only=True):
        yield list(row)
    wb.close()


def lector_de(ruta):
    return leer_xlsb if ruta.lower().endswith('.xlsb') else leer_xlsx


def hojas(ruta):
    if ruta.lower().endswith('.xlsb'):
        from pyxlsb import open_workbook
        with open_workbook(ruta) as wb:
            return list(wb.sheets)
    import openpyxl
    wb = openpyxl.load_workbook(ruta, read_only=True)
    n = wb.sheetnames
    wb.close()
    return n


def buscar_hoja(ruta, pista):
    """Encuentra la hoja cuyo nombre contiene `pista`, ignorando acentos."""
    for h in hojas(ruta):
        if sin_acentos(pista) in sin_acentos(h):
            return h
    raise KeyError('{} no esta en {}: {}'.format(pista, ruta, hojas(ruta)))


def serial_a_fecha(v):
    """Serial de Excel, datetime o texto -> 'AAAA-MM-DD' (o cadena vacia)."""
    if v is None or v == '':
        return ''
    if isinstance(v, datetime):
        return v.strftime('%Y-%m-%d')
    try:
        n = float(v)
    except (TypeError, ValueError):
        s = str(v).strip()
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y'):
            try:
                return datetime.strptime(s[:10], fmt).strftime('%Y-%m-%d')
            except ValueError:
                pass
        return ''
    from pyxlsb import convert_date
    d = convert_date(n)
    return d.strftime('%Y-%m-%d') if d else ''


# ----------------------------------------------------------------- geometría (mecanismos, docs/19 y docs/20)
# La usan 97_escuelas_riesgo.py, 99_reubicacion.py y 100_escuelas_ladera.py. Distancias en plano local: bastan
# a la escala de unos kilómetros.
import json as _json
import math as _math
import os as _os

_RAIZ = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))

# El Alto Atoyac: las cuatro subcuencas del INEGI que drenan a la presa Manuel Ávila Camacho (Valsequillo). La cuenca
# RH18A que dibuja el mapa es mucho mayor (llega a la Mixteca); el proyecto se centra en esta parte.
SUBCUENCAS_ALTO_ATOYAC = ('RH18Ad', 'RH18Ai', 'RH18Aj', 'RH18Ac')   # Texmelucan, Zahuapan, Alseseca, Valsequillo
_alto = None


def metros(lat, lon, lat2, lon2):
    kx = 111320 * _math.cos(_math.radians(lat))
    return _math.hypot((lon2 - lon) * kx, (lat2 - lat) * 110540)


def proyecta(lat, lon, a, b):
    """Distancia del punto al segmento a-b ([lon, lat]) y el punto proyectado, en plano local."""
    kx = 111320 * _math.cos(_math.radians(lat))
    ax, ay = (a[0] - lon) * kx, (a[1] - lat) * 110540
    bx, by = (b[0] - lon) * kx, (b[1] - lat) * 110540
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / l2))
    px, py = ax + t * dx, ay + t * dy
    return _math.hypot(px, py), [lon + px / kx, lat + py / 110540], t


def lineas(geom):
    return geom['coordinates'] if geom['type'] == 'MultiLineString' else [geom['coordinates']]


def mas_cercano(lat, lon, tramos):
    """tramos: [(coords, dato)]. Devuelve (distancia, punto, dato, metros del punto al final del tramo, coords)."""
    mejor = None
    for coords, dato in tramos:
        for i in range(len(coords) - 1):
            d, p, t = proyecta(lat, lon, coords[i], coords[i + 1])
            if mejor is None or d < mejor[0]:
                resto = (1 - t) * metros(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
                resto += sum(metros(coords[j][1], coords[j][0], coords[j + 1][1], coords[j + 1][0])
                             for j in range(i + 1, len(coords) - 1))
                mejor = (d, p, dato, resto, coords)
    return mejor


def tramos_de_cauces():
    """Los cauces del INEGI: los de asignación (todos los órdenes, con su sitio CONAGUA aguas abajo) y los del mapa
    (orden >= 4). [(coords, tramo o None)]."""
    with open(_os.path.join(_RAIZ, 'datos', 'procesados', 'red', 'red_asignacion.json'), encoding='utf-8') as f:
        asig = [(t['p'], t) for t in _json.load(f)['tramos']]
    with open(_os.path.join(_RAIZ, 'datos', 'procesados', 'mapa', 'red_hidrografica.geojson'), encoding='utf-8') as f:
        red = [(l, None) for ft in _json.load(f)['features'] for l in lineas(ft['geometry'])]
    return asig, red


def distancia_a_cauce(lat, lon, cauces):
    asig, red = cauces
    return min(m[0] for m in (mas_cercano(lat, lon, asig), mas_cercano(lat, lon, red)) if m)


def en_alto_atoyac(lat, lon):
    """True si el punto cae en una de las SUBCUENCAS_ALTO_ATOYAC (datos/procesados/mapa/subcuencas.geojson)."""
    global _alto
    if _alto is None:
        with open(_os.path.join(_RAIZ, 'datos', 'procesados', 'mapa', 'subcuencas.geojson'), encoding='utf-8') as f:
            _alto = []
            for ft in _json.load(f)['features']:
                if ft['properties']['clave'] in SUBCUENCAS_ALTO_ATOYAC:
                    g = ft['geometry']
                    _alto += [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    for pol in _alto:
        dentro, a = False, pol[0]
        for i in range(len(a)):
            x1, y1 = a[i - 1][:2]
            x2, y2 = a[i][:2]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                dentro = not dentro
        if dentro:
            return True
    return False

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

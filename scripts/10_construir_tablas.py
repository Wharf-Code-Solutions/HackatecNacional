# -*- coding: utf-8 -*-
"""Construye las tablas procesadas del modelo de datos (seccion 6 del plan)
a partir de los archivos crudos de CONAGUA.

Lee    : datos/crudos/F02, datos/crudos/F05
Escribe: datos/procesados/*.csv
Nunca modifica los archivos crudos.

Uso: python -I scripts/10_construir_tablas.py
"""
import csv, importlib.util, os, re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# python -I no agrega la carpeta del script a sys.path, asi que se carga por ruta
_spec = importlib.util.spec_from_file_location(
    '_comun', os.path.join(os.path.dirname(os.path.abspath(__file__)), '_comun.py'))
comun = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(comun)
sin_acentos = comun.sin_acentos
parse_valor = comun.parse_valor
lector_de = comun.lector_de
buscar_hoja = comun.buscar_hoja
serial_a_fecha = comun.serial_a_fecha
normaliza_estado = comun.normaliza_estado
META = comun.META

CRUDOS = os.path.join(RAIZ, 'datos', 'crudos')
SALIDA = os.path.join(RAIZ, 'datos', 'procesados')
os.makedirs(SALIDA, exist_ok=True)

F02_P = os.path.join(CRUDOS, 'F02', 'Calidad_del_Agua_Superficial_p_2012-2025.xlsx')
F05_PUE = os.path.join(CRUDOS, 'F05', 'RESULTADOS-PUEBLA.xlsb')
F05_TLX = os.path.join(CRUDOS, 'F05', 'RESULTADOS-TLAXCALA.xlsx')
F01_ATO = os.path.join(CRUDOS, 'F01', 'Resultados_Rio_Atoyac.xlsx')

# (ruta, id de fuente). El orden importa: ante un duplicado
# (c_sitio, fecha, c_parametro) se conserva el de la fuente mas reciente, que
# aqui es F05 (RENAMECA 2012-2025); F01 (Atoyac 2012-2018, muestreo mensual)
# rellena el historial que F05 no trae.
ORIGENES = ((F05_PUE, 'F05'), (F05_TLX, 'F05'), (F01_ATO, 'F01'))


def escribir(nombre, campos, filas):
    ruta = os.path.join(SALIDA, nombre)
    with open(ruta, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
        w.writeheader()
        w.writerows(filas)
    print('  -> {}: {:,} filas'.format(nombre, len(filas)))


# Cuencas del area de estudio. Se exige ademas estado Pue/Tlax para no mezclar
# los rios Atoyac de Oaxaca y Guerrero.
CUENCAS_OK = ('ALTO ATOYAC', 'RIO ALTO ATOYAC', 'RIO ATOYAC', 'RIO ZAHUAPAN',
              'ZAHUAPAN', 'RIO ALSESECA', 'ALTO BALSAS')
ESTADOS_OK = ('PUEBLA DE ZARAGOZA', 'PUEBLA', 'TLAXCALA')
CUERPOS_OK = ('MANUEL AVILA CAMACHO', 'VALSEQUILLO', 'ATOYAC', 'ZAHUAPAN',
              'ALSESECA', 'SAN FRANCISCO', 'XONECUILA')


def en_area(cuenca, estado, cuerpo, tipo):
    t = sin_acentos(tipo)
    if 'SUBTERRANEO' in t or 'POZO' in t:
        return False, 'subterraneo'
    if sin_acentos(estado) not in [sin_acentos(e) for e in ESTADOS_OK]:
        return False, 'otro estado'
    c = sin_acentos(cuenca)
    if any(c == k or c.startswith(k) for k in CUENCAS_OK):
        return True, 'cuenca'
    if any(k in sin_acentos(cuerpo) for k in CUERPOS_OK):
        return True, 'cuerpo de agua'
    return False, 'fuera de cuenca'


EN_CAMPO = {'OD_%', 'OD_mg/L', 'OD_%_SUP', 'OD_mg/L_SUP', 'OD_%_MED',
            'OD_mg/L_MED', 'OD_%_FON', 'OD_mg/L_FON', 'pH_CAMPO',
            'pH_CAMPO_SUP', 'pH_CAMPO_MED', 'pH_CAMPO_FON', 'TEMP_AGUA',
            'TEMP_AMB', 'CONDUC_CAMPO', 'CONDUC_CAMPO_SUP', 'CONDUC_CAMPO_MED',
            'CONDUC_CAMPO_FON', 'TURBIEDAD', 'POT_REDOX_CAMPO', 'SDT',
            'TRANSPARENCIA', 'PROFUNDIDAD'}

ESTANDAR = {'OD_mg/L': 'OD', 'OD_%': 'OD_PCT', 'DBO_TOT': 'DBO5',
            'DQO_TOT': 'DQO', 'SST': 'SST', 'SDT': 'SDT', 'COLI_FEC': 'CF',
            'E_COLI': 'ECOLI', 'TOX_D_48_UT': 'TOX_D', 'TOX_V_15_UT': 'TOX_V',
            'pH_CAMPO': 'PH', 'TEMP_AGUA': 'TEMP', 'CONDUC_CAMPO': 'COND',
            'TURBIEDAD': 'TURB'}

NUCLEO = set(ESTANDAR) | {'DBO_SOL', 'DQO_SOL', 'COLI_TOT', 'N_NH3', 'N_TOT',
                          'P_TOT', 'GRAS_ACEI', 'SAAM', 'FENOLES_TOT',
                          'SULFUROS_TOT', 'CAUDAL', 'AS_TOT', 'CD_TOT',
                          'CR_TOT', 'HG_TOT', 'PB_TOT', 'NI_TOT', 'CU_TOT',
                          'ZN_TOT', 'CN_TOT', 'CR_HEX', 'H_HELMINTOS',
                          'MAT_FLOTANTE', 'SOLID_SED'}

# ============================================================ 1. tabla sitio
print('1) sitio')
sitios = {}
descartes = {}
for ruta, fid in ORIGENES:
    it = lector_de(ruta)(ruta, buscar_hoja(ruta, 'SITIOS'))
    hdr = [str(x).strip() if x else '' for x in next(it)]
    ix = {sin_acentos(h): i for i, h in enumerate(hdr)}

    def g(r, *claves):
        for k in claves:
            i = ix.get(sin_acentos(k))
            if i is not None and i < len(r) and r[i] not in (None, ''):
                return str(r[i]).strip()
        return ''

    for r in it:
        clave = g(r, 'CLAVE SITIO')
        if not clave:
            continue
        cuenca = g(r, 'CUENCA')
        estado = g(r, 'ESTADO')
        cuerpo = g(r, 'CUERPO DE AGUA')
        tipo = g(r, 'TIPO DE CUERPO DE AGUA')
        ok, motivo = en_area(cuenca, estado, cuerpo, tipo)
        if not ok:
            descartes[motivo] = descartes.get(motivo, 0) + 1
            continue
        lat, lon = g(r, 'LATITUD'), g(r, 'LONGITUD')
        try:
            lat, lon = float(lat), -abs(float(lon))
            if not (17.5 <= lat <= 20.5 and -99.5 <= lon <= -97.0):
                lat = lon = ''
        except ValueError:
            lat = lon = ''
        if clave in sitios:          # la primera fuente de ORIGENES manda
            continue
        sitios[clave] = {
            'c_sitio': clave, 'nombre': g(r, 'NOMBRE DEL SITIO'),
            'cuerpo_agua': cuerpo, 'tipo_cuerpo': tipo,
            'subtipo_cuerpo': g(r, 'SUBTIPO CUERPO AGUA'),
            'municipio': g(r, 'MUNICIPIO'),
            'estado': normaliza_estado(estado), 'cuenca': cuenca,
            'organismo_cuenca': g(r, 'ORGANISMO CUENCA'),
            'latitud': lat, 'longitud': lon,
            'semaforo': '', 'contaminantes': '', 'fuente': fid}
print('   descartados:', descartes)

# enriquecer con semaforo y contaminantes de F02 (periodo 2012-2025)
import openpyxl

wb = openpyxl.load_workbook(F02_P, read_only=True, data_only=True)
ws = wb[buscar_hoja(F02_P, 'CAPSUP')]
it = ws.iter_rows(values_only=True)
h = [str(x).strip() if x else '' for x in next(it)]
jx = {sin_acentos(k): i for i, k in enumerate(h)}
ind_filas = []
for r in it:
    clave = str(r[jx['CLAVE SITIO']] or '').strip()
    cuenca = r[jx['CUENCA']]
    estado = r[jx['ESTADO']]
    cuerpo = r[jx['CUERPO DE AGUA']]
    tipo = r[jx['TIPO']]
    ok, _ = en_area(cuenca, estado, cuerpo, tipo)
    if not ok:
        continue
    fila = {}
    for i in range(len(h)):
        fila[sin_acentos(h[i]).lower().replace(' ', '_').replace('/', '_')] = r[i]
    fila['fuente'] = 'F02'
    ind_filas.append(fila)
    if clave in sitios:
        sitios[clave]['semaforo'] = r[jx['SEMAFORO']] or ''
        sitios[clave]['contaminantes'] = r[jx['CONTAMINANTES']] or ''
    elif clave:
        try:
            lat = float(r[jx['LATITUD']])
            lon = -abs(float(r[jx['LONGITUD']]))
        except (TypeError, ValueError):
            lat = lon = ''
        sitios[clave] = {
            'c_sitio': clave, 'nombre': r[jx['NOMBRE DEL SITIO']] or '',
            'cuerpo_agua': cuerpo or '', 'tipo_cuerpo': tipo or '',
            'subtipo_cuerpo': r[jx['SUBTIPO']] or '',
            'municipio': r[jx['MUNICIPIO']] or '',
            'estado': normaliza_estado(estado),
            'cuenca': cuenca or '',
            'organismo_cuenca': r[jx['ORGANISMO_DE_CUENCA']] or '',
            'latitud': lat, 'longitud': lon,
            'semaforo': r[jx['SEMAFORO']] or '',
            'contaminantes': r[jx['CONTAMINANTES']] or '', 'fuente': 'F02'}
wb.close()
print('   indicadores de la cuenca en F02: {}'.format(len(ind_filas)))

CAMPOS_SITIO = ['c_sitio', 'nombre', 'cuerpo_agua', 'tipo_cuerpo', 'subtipo_cuerpo',
                'municipio', 'estado', 'cuenca', 'organismo_cuenca', 'latitud',
                'longitud', 'semaforo', 'contaminantes', 'fuente']
escribir('sitio.csv', CAMPOS_SITIO,
         sorted(sitios.values(), key=lambda d: d['c_sitio']))
if ind_filas:
    escribir('indicador_sitio_periodo.csv', list(ind_filas[0].keys()), ind_filas)

# ======================================================== 2. tabla parametro
print('2) parametro')
params = {}
for ruta, fid in ORIGENES:
    it = lector_de(ruta)(ruta, buscar_hoja(ruta, 'SIMBOLOG'))
    for r in it:
        # la hoja puede empezar con filas vacias o con el encabezado corrido
        celdas = [str(x).strip() if x not in (None, '') else '' for x in r]
        celdas = [c for c in celdas if c and c.lower() != 'none']
        if len(celdas) < 2:
            continue
        cl = celdas[0]
        if sin_acentos(cl).startswith('CLAVE'):
            continue
        if cl in params:
            continue
        params[cl] = {
            'c_parametro': cl,
            'nombre': celdas[1] if len(celdas) > 1 else '',
            'unidad': celdas[2] if len(celdas) > 2 else '',
            'medible_en_campo': 'true' if cl in EN_CAMPO else 'false',
            'c_parametro_std': ESTANDAR.get(cl, ''),
            'nucleo_analitico': 'true' if cl in NUCLEO else 'false',
            'fuente': fid}
escribir('parametro.csv',
         ['c_parametro', 'nombre', 'unidad', 'medible_en_campo',
          'c_parametro_std', 'nucleo_analitico', 'fuente'],
         sorted(params.values(), key=lambda d: d['c_parametro']))

# ========================================================= 3. tabla muestreo
print('3) muestreo')
CAMPOS_M = ['c_sitio', 'fecha', 'c_parametro', 'valor', 'bajo_limite_deteccion',
            'limite_deteccion', 'censurado_superior', 'c_monitoreo', 'anio',
            'fuente']
vistos = set()
filas_m = []
filas_n = []
for ruta, fid in ORIGENES:
    it = lector_de(ruta)(ruta, buscar_hoja(ruta, 'RESULTADOS'))
    hdr = [str(x).strip() if x else '' for x in next(it)]
    norm = [sin_acentos(x) for x in hdr]
    i_sitio = norm.index('CLAVE SITIO')
    i_mon = [i for i, x in enumerate(norm) if x.startswith('CLAVE') and 'MONITOREO' in x][0]
    i_fecha = [i for i, x in enumerate(norm) if x.startswith('FECHA')][0]
    anio_cols = [i for i, x in enumerate(norm) if x == 'ANO']
    i_anio = anio_cols[0] if anio_cols else None
    # las columnas de parametros empiezan despues del ultimo encabezado meta
    i_param0 = max(i for i, x in enumerate(norm) if x in META) + 1
    n_mon = 0
    for r in it:
        if len(r) <= i_param0:
            continue
        clave = str(r[i_sitio] or '').strip()
        if clave not in sitios:
            continue
        n_mon += 1
        fecha = serial_a_fecha(r[i_fecha])
        anio = ''
        if i_anio is not None and r[i_anio]:
            anio = str(r[i_anio]).split('.')[0]
        if not anio:
            anio = fecha[:4] if fecha else ''
        mon = str(r[i_mon] or '').strip()
        for i in range(i_param0, min(len(r), len(hdr))):
            cp = hdr[i]
            if not cp:
                continue
            val, bajo, ld, sup = parse_valor(r[i])
            if val is None and bajo != 'true':
                continue
            llave = (clave, fecha, cp)
            if llave in vistos:
                continue
            vistos.add(llave)
            f = {'c_sitio': clave, 'fecha': fecha, 'c_parametro': cp,
                 'valor': val if val is not None else '',
                 'bajo_limite_deteccion': bajo, 'limite_deteccion': ld,
                 'censurado_superior': sup, 'c_monitoreo': mon, 'anio': anio,
                 'fuente': fid}
            filas_m.append(f)
            if cp in NUCLEO:
                filas_n.append(f)
    print('   {}: {:,} monitoreos de la cuenca'.format(os.path.basename(ruta), n_mon))
escribir('muestreo.csv', CAMPOS_M, filas_m)
escribir('muestreo_nucleo.csv', CAMPOS_M, filas_n)

# =========================================================== 4. tabla umbral
print('4) umbral')
COLOR = {'EXCELENTE': 'Verde', 'BUENA CALIDAD': 'Verde', 'ACEPTABLE': 'Amarillo',
         'CONTAMINADA': 'Rojo', 'FUERTEMENTE CONTAMINADA': 'Rojo',
         'NO TOXICO': 'Verde', 'TOXICIDAD BAJA': 'Verde',
         'TOXICIDAD MODERADA': 'Amarillo', 'TOXICIDAD ALTA': 'Rojo'}


def rangos(texto):
    """'DBO mayor de 3 y menor o igual a 6' -> [(3, 6)]. Soporta varios tramos."""
    t = sin_acentos(texto)
    t = t.replace('MENOR O IGUAL A', '<=').replace('MENOR O IGUAL', '<=')
    t = t.replace('MAYOR O IGUAL A', '>=').replace('MAYOR O IGUAL', '>=')
    t = t.replace('MAYOR DE', '>').replace('MAYOR A', '>').replace('MAYOR', '>')
    t = t.replace('MENOR DE', '<').replace('MENOR A', '<').replace('MENOR', '<')
    out = []
    for tramo in t.split(';'):
        mn = mx = ''
        for op, num in re.findall(r'(<=|>=|<|>)\s*([0-9]+(?:\.[0-9]+)?)', tramo):
            if op in ('>', '>='):
                mn = float(num)
            else:
                mx = float(num)
        if mn != '' or mx != '':
            out.append((mn, mx))
    return out or [('', '')]


wb = openpyxl.load_workbook(F02_P, read_only=True, data_only=True)
ws = wb[buscar_hoja(F02_P, 'ESCALAS')]
umbrales = []
param_actual = ''
for r in ws.iter_rows(values_only=True):
    a = str(r[0]).strip() if r[0] else ''
    b = str(r[1]).strip() if len(r) > 1 and r[1] else ''
    d = str(r[2]).strip() if len(r) > 2 and r[2] else ''
    if sin_acentos(a).startswith('CALIDAD DEL AGUA PARA'):
        param_actual = a.split('PARA', 1)[1].strip()
        continue
    if not a or not b:
        continue
    for mn, mx in rangos(b):
        umbrales.append({'c_parametro': param_actual, 'c_escala': 'CONAGUA_SUP',
                         'categoria': a, 'min': mn, 'max': mx, 'criterio': b,
                         'color_semaforo': COLOR.get(sin_acentos(a), ''),
                         'descripcion': d, 'fuente': 'F06'})
wb.close()

# Limites de la NOM-001-SEMARNAT-2021 (DOF 11/03/2022), Tablas 1 y 2, para los
# receptores que aplican en la cuenca. Transcritos de datos/crudos/F07.
# P.M = promedio mensual, P.D = promedio diario, V.I = valor instantaneo.
# Nota: la norma de 2021 ya NO fija limite de DBO5 en la Tabla 1; usa DQO y COT.
NOM001 = [
    # (c_parametro, unidad, rio_PM, rio_PD, rio_VI, embalse_PM, embalse_PD, embalse_VI)
    ('TEMP_AGUA', 'C', 35, 35, 35, 35, 35, 35),
    ('GRAS_ACEI', 'mg/L', 15, 18, 21, 15, 18, 21),
    ('SST', 'mg/L', 60, 72, 84, 20, 24, 28),
    ('DQO_TOT', 'mg/L', 150, 180, 210, 100, 120, 140),
    ('COT', 'mg/L', 38, 45, 53, 25, 30, 35),
    ('N_TOT', 'mg/L', 25, 30, 35, 15, 25, 30),
    ('P_TOT', 'mg/L', 15, 18, 21, 5, 10, 15),
    ('E_COLI', 'NMP/100 mL', 250, 500, 600, 250, 500, 600),
    ('ENTEROC', 'NMP/100 mL', 250, 400, 500, 250, 400, 500),
    ('TOX_V_15_UT', 'UT', 2, 2, 2, 2, 2, 2),
    ('AS_TOT', 'mg/L', 0.2, 0.3, 0.4, 0.1, 0.15, 0.2),
    ('CD_TOT', 'mg/L', 0.2, 0.3, 0.4, 0.1, 0.15, 0.2),
    ('CN_TOT', 'mg/L', 1, 2, 3, 1, 1.5, 2),
    ('CU_TOT', 'mg/L', 4, 5, 6, 4, 5, 6),
    ('CR_TOT', 'mg/L', 1, 1.25, 1.5, 0.5, 0.75, 1),
    ('HG_TOT', 'mg/L', 0.01, 0.015, 0.02, 0.005, 0.008, 0.01),
    ('NI_TOT', 'mg/L', 2, 3, 4, 2, 3, 4),
]
ESCALAS_NOM = (('NOM001_2021_RIO', 2), ('NOM001_2021_EMBALSE', 5))
for fila in NOM001:
    cp, unidad = fila[0], fila[1]
    for escala, off in ESCALAS_NOM:
        for etiqueta, k in (('Promedio mensual', 0), ('Promedio diario', 1),
                            ('Valor instantaneo', 2)):
            umbrales.append({
                'c_parametro': cp, 'c_escala': escala,
                'categoria': 'Limite permisible - ' + etiqueta,
                'min': '', 'max': fila[off + k],
                'criterio': '{} <= {} {}'.format(cp, fila[off + k], unidad),
                'color_semaforo': 'Rojo si se excede',
                'descripcion': 'NOM-001-SEMARNAT-2021, ' +
                               ('Tabla 2 (metales y cianuros)' if cp.endswith('_TOT')
                                and cp in ('AS_TOT', 'CD_TOT', 'CN_TOT', 'CU_TOT',
                                           'CR_TOT', 'HG_TOT', 'NI_TOT')
                                else 'Tabla 1'),
                'fuente': 'F07'})
# pH aplica como intervalo unico en todos los receptores
for escala, _ in ESCALAS_NOM:
    umbrales.append({'c_parametro': 'pH_CAMPO', 'c_escala': escala,
                     'categoria': 'Limite permisible - intervalo', 'min': 6,
                     'max': 9, 'criterio': 'pH entre 6 y 9',
                     'color_semaforo': 'Rojo si se excede',
                     'descripcion': 'NOM-001-SEMARNAT-2021, Tabla 1',
                     'fuente': 'F07'})

escribir('umbral.csv',
         ['c_parametro', 'c_escala', 'categoria', 'min', 'max', 'criterio',
          'color_semaforo', 'descripcion', 'fuente'], umbrales)

wb = openpyxl.load_workbook(F02_P, read_only=True, data_only=True)
ws = wb[buscar_hoja(F02_P, 'Diccionario')]
dic = []
for r in ws.iter_rows(values_only=True):
    if r[0]:
        dic.append({'campo': r[0], 'descripcion': r[1], 'tipo': r[2],
                    'valor_posible': r[3] if len(r) > 3 else '', 'fuente': 'F02'})
wb.close()
escribir('diccionario_conagua.csv',
         ['campo', 'descripcion', 'tipo', 'valor_posible', 'fuente'], dic[1:])

print('\nListo. Tablas en ' + SALIDA)

# -*- coding: utf-8 -*-
"""Revision de salud del repositorio: comprueba las invariantes que se pueden
comprobar sin correr el pipeline completo.

Es la verificacion que debe pasar cualquier cambio. La lista de invariantes esta
en docs/contexto/01-invariantes.md; aqui se automatizan las que tienen
una comprobacion mecanica.

Uso:  python -I scripts/50_verificar_repo.py
Sale con codigo 1 si alguna comprobacion falla.
"""
import csv
import importlib.util
import json
import os
import re
import sys
from collections import Counter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AQUI = os.path.dirname(os.path.abspath(__file__))
PROC = os.path.join(RAIZ, 'datos', 'procesados')
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')

fallas = []
avisos = []


def ok(etiqueta, detalle=''):
    print('  OK    {} {}'.format(etiqueta, detalle))


def falla(etiqueta, detalle):
    print('  FALLA {} -> {}'.format(etiqueta, detalle))
    fallas.append('{}: {}'.format(etiqueta, detalle))


def aviso(etiqueta, detalle):
    print('  AVISO {} -> {}'.format(etiqueta, detalle))
    avisos.append('{}: {}'.format(etiqueta, detalle))


# ------------------------------------------------- I2 / conteos de las tablas
FILAS_ESPERADAS = {
    'sitio.csv': 219,
    'parametro.csv': 347,
    'muestreo.csv': 145703,
    'muestreo_nucleo.csv': 74801,
    'umbral.csv': 146,
    'indicador_sitio_periodo.csv': 212,
    'diccionario_conagua.csv': 48,
    os.path.join('red', 'tramo.csv'): 65342,
    os.path.join('red', 'sitio_red.csv'): 219,
    os.path.join('red', 'sitio_aguas_abajo.csv'): 219,
    os.path.join('red', 'sitio_pares.csv'): 6276,
}

print('\n1) Conteos de las tablas procesadas')
for nombre, esperado in FILAS_ESPERADAS.items():
    ruta = os.path.join(PROC, nombre)
    if not os.path.exists(ruta):
        aviso(nombre, 'no existe; corre scripts/10_construir_tablas.py')
        continue
    with open(ruta, encoding='utf-8-sig') as f:
        n = sum(1 for _ in f) - 1
    if n == esperado:
        ok(nombre, '{:,} filas'.format(n))
    else:
        falla(nombre, 'esperaba {:,} filas, hay {:,}. Si el cambio era '
                      'intencional, actualiza FILAS_ESPERADAS y la '
                      'docs que cita la cifra'.format(esperado, n))

# ------------------------------------------- I6 / solo Puebla y Tlaxcala
print('\n2) Recorte del area de estudio (invariante I6)')
ruta = os.path.join(PROC, 'sitio.csv')
if os.path.exists(ruta):
    with open(ruta, encoding='utf-8-sig') as f:
        estados = Counter(r['estado'] for r in csv.DictReader(f))
    permitidos = {'PUEBLA', 'TLAXCALA'}
    extra = set(estados) - permitidos
    if extra:
        falla('estados en sitio.csv', 'aparecen estados fuera del area: {}'.format(extra))
    else:
        ok('estados en sitio.csv', dict(estados))
else:
    aviso('estados en sitio.csv', 'sitio.csv no existe')

# ----------------------------------------------- I4 / los CSV traen BOM
print('\n3) Codificacion de los CSV (invariante I4)')
sin_bom = []
for carpeta in (PROC, os.path.join(PROC, 'analisis')):
    if not os.path.isdir(carpeta):
        continue
    for a in sorted(os.listdir(carpeta)):
        if not a.endswith('.csv'):
            continue
        with open(os.path.join(carpeta, a), 'rb') as f:
            if f.read(3) != b'\xef\xbb\xbf':
                sin_bom.append(a)
if sin_bom:
    falla('BOM en los CSV', 'sin utf-8-sig: {}'.format(', '.join(sin_bom)))
else:
    ok('BOM en los CSV', 'todos en utf-8-sig')

# ------------------------------------- I3 / la logica compartida no se duplica
print('\n4) Logica compartida sin duplicar (invariante I3)')
for fn in ('parse_valor', 'sin_acentos', 'serial_a_fecha', 'leer_xlsb', 'buscar_hoja'):
    donde = []
    for a in sorted(os.listdir(AQUI)):
        if not a.endswith('.py'):
            continue
        texto = open(os.path.join(AQUI, a), encoding='utf-8').read()
        if re.search(r'^def {}\('.format(fn), texto, re.M):
            donde.append(a)
    if donde == ['_comun.py']:
        ok(fn, 'definida solo en _comun.py')
    elif not donde:
        falla(fn, 'no esta definida en ninguna parte')
    else:
        falla(fn, 'definida en {} (debe estar solo en _comun.py)'.format(donde))

# ------------------------------- I9 / el contrato no tiene dependencias externas
print('\n5) El contrato corre sin dependencias (invariante I9)')
ESTANDAR = {'argparse', 'collections', 'csv', 'datetime', 'http', 'json', 'os',
            're', 'sys', 'time', 'urllib', 'unicodedata', 'importlib',
            'validador', 'statistics', 'random', 'math', 'pathlib', 'typing'}
carpeta = os.path.join(RAIZ, 'contrato')
externas = []
for a in sorted(os.listdir(carpeta)):
    if not a.endswith('.py'):
        continue
    for linea in open(os.path.join(carpeta, a), encoding='utf-8'):
        m = re.match(r'\s*(?:from|import)\s+([A-Za-z_][\w.]*)', linea)
        if m and m.group(1).split('.')[0] not in ESTANDAR:
            externas.append('{}: {}'.format(a, m.group(1)))
if externas:
    falla('imports del contrato', 'dependencias externas: {}'.format(externas))
else:
    ok('imports del contrato', 'solo biblioteca estandar')

# ------------------------------------------ los fixtures cumplen su esquema
print('\n6) Fixtures contra los esquemas')
spec = importlib.util.spec_from_file_location(
    'validador', os.path.join(RAIZ, 'contrato', 'validador.py'))
val = importlib.util.module_from_spec(spec)
spec.loader.exec_module(val)

CONTEOS_FIX = {'estaciones': 5, 'linea_base': 25}
total_err = 0
for esquema, archivo, llave in (('estacion', 'estaciones.json', 'estaciones'),
                                ('linea_base', 'linea_base.json', 'linea_base')):
    ruta = os.path.join(FIX, archivo)
    if not os.path.exists(ruta):
        aviso(archivo, 'no existe; corre scripts/40_generar_fixtures.py')
        continue
    objetos = json.load(open(ruta, encoding='utf-8'))[llave]
    esq = val.cargar_esquema(esquema)
    err = [e for i, o in enumerate(objetos)
           for e in val.validar(o, esq, '$[{}]'.format(i))]
    total_err += len(err)
    if err:
        falla(archivo, '{} errores, el primero: {}'.format(len(err), err[0]))
    else:
        esperado = CONTEOS_FIX.get(llave)
        detalle = '{} objetos'.format(len(objetos))
        if esperado and len(objetos) != esperado:
            aviso(archivo, detalle + ' (esperaba {})'.format(esperado))
        else:
            ok(archivo, detalle)

carpeta = os.path.join(FIX, 'escenarios')
if os.path.isdir(carpeta):
    esq = val.cargar_esquema('lectura')
    for a in sorted(os.listdir(carpeta)):
        if not a.endswith('.json'):
            continue
        paquetes = json.load(open(os.path.join(carpeta, a), encoding='utf-8'))['paquetes']
        err = [e for i, p in enumerate(paquetes)
               for e in val.validar(p, esq, '$[{}]'.format(i))]
        total_err += len(err)
        if err:
            falla(a, '{} errores, el primero: {}'.format(len(err), err[0]))
        else:
            ok(a, '{} paquetes'.format(len(paquetes)))
else:
    aviso('escenarios', 'la carpeta no existe')

# -------------------------- el vocabulario del contrato existe en parametro.csv
print('\n7) Vocabulario del contrato contra parametro.csv (invariante I5)')
ruta_esq = os.path.join(RAIZ, 'contrato', 'esquemas', 'lectura.schema.json')
ruta_par = os.path.join(PROC, 'parametro.csv')
if os.path.exists(ruta_esq) and os.path.exists(ruta_par):
    esq = json.load(open(ruta_esq, encoding='utf-8'))
    codigos = set(esq['properties']['lecturas']['items']['properties']
                  ['c_parametro']['enum'])
    with open(ruta_par, encoding='utf-8-sig') as f:
        std = {r['c_parametro_std'] for r in csv.DictReader(f) if r['c_parametro_std']}
    faltan = codigos - std
    if faltan:
        falla('codigos del contrato', 'sin equivalente CONAGUA en parametro.csv: '
                                     '{}'.format(sorted(faltan)))
    else:
        ok('codigos del contrato', '{} codigos, todos con equivalente'.format(len(codigos)))
else:
    aviso('codigos del contrato', 'falta lectura.schema.json o parametro.csv')

# ---------------------------------------------------- enlaces de la docs
print('\n8) Enlaces relativos en los .md')
rotos = []
for raiz, _, archivos in os.walk(RAIZ):
    # node_modules y dist son de terceros o generados (panel/ es React con Vite, D23).
    if any(p in raiz for p in ('.git', 'crudos', 'geo', '__pycache__', 'node_modules', 'dist')):
        continue
    for a in archivos:
        if not a.endswith('.md'):
            continue
        p = os.path.join(raiz, a)
        texto = open(p, encoding='utf-8').read()
        for destino in sorted(set(re.findall(r'\]\(([^)#]+)\)', texto))):
            if destino.startswith(('http', '#', 'mailto:')):
                continue
            if not os.path.exists(os.path.normpath(os.path.join(raiz, destino))):
                rotos.append('{} -> {}'.format(os.path.relpath(p, RAIZ), destino))
if rotos:
    for r in rotos:
        falla('enlace roto', r)
else:
    ok('enlaces', 'ninguno roto')

# ------------------------------------- I15 / crudos y geo fuera del repositorio
print('\n9) Archivos que no deben versionarse (invariante I15)')
gi = os.path.join(RAIZ, '.gitignore')
if os.path.exists(gi):
    texto = open(gi, encoding='utf-8').read()
    for patron in ('datos/crudos/', 'datos/geo/', 'muestreo.csv'):
        if patron in texto:
            ok('.gitignore', 'cubre {}'.format(patron))
        else:
            falla('.gitignore', 'no cubre {}'.format(patron))
else:
    falla('.gitignore', 'no existe')

# -------------------------------------------------------------------- resumen
print('\n' + '=' * 62)
if fallas:
    print('{} FALLA(S):'.format(len(fallas)))
    for f_ in fallas:
        print('  - ' + f_)
if avisos:
    print('{} aviso(s):'.format(len(avisos)))
    for a_ in avisos:
        print('  - ' + a_)
if not fallas:
    print('Todas las comprobaciones mecanicas pasan.')
    if avisos:
        print('Hay avisos: suelen significar que falta correr un script.')
print('=' * 62)
sys.exit(1 if fallas else 0)

# -*- coding: utf-8 -*-
"""Área donde la app ciudadana deja generar un reporte: Puebla, aproximada por sus localidades.

No tenemos el contorno oficial del estado (el marco geoestadístico del INEGI no está descargado). Se aproxima con las
localidades del censo 2020 de Puebla (ITER, F16, ya descargado): una malla de celdas de CELDA grados (≈ 5.5 km) donde
hay al menos una localidad, más MARGEN celdas alrededor para no cortar a quien está en la orilla de una localidad.

Lo que eso implica: cerca de la frontera el área se pasa unos km a los estados vecinos, y un cerro despoblado dentro de
Puebla puede quedar como hueco si no hay localidad a menos de ≈ 10 km (raro). Basta para que un reporte en Oaxaca, Veracruz
o la Ciudad de México no se pueda generar.

Salida (DERIVADA: se edita este script, no el archivo):
    datos/procesados/mapa/area_reportes.json    {"celda": 0.05, "celdas": ["fila,columna", ...]}
    (la app la copia a su public/datos/ con ciudadano/scripts/copiar-datos.mjs)

    python -I scripts/103_area_reportes.py
"""
import csv
import io
import json
import math
import os
import re
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITER = os.path.join(RAIZ, 'datos', 'crudos', 'F16', 'iter_21_cpv2020_csv.zip')
SALIDA = os.path.join(RAIZ, 'datos', 'procesados', 'mapa', 'area_reportes.json')
CELDA = 0.05
MARGEN = 1


def dms(texto):
    """'97°57'09.774" W' -> -97.952715. None si no se puede leer."""
    m = re.match(r'\s*(\d+)°(\d+)\'([\d.]+)"\s*([NSEW])', texto or '')
    if not m:
        return None
    v = int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3)) / 3600
    return -v if m.group(4) in 'SW' else v


def main():
    with zipfile.ZipFile(ITER) as z:
        nombre = next(n for n in z.namelist() if 'conjunto_de_datos_iter' in n and n.endswith('.csv'))
        texto = io.TextIOWrapper(z.open(nombre), encoding='utf-8-sig')
        puntos = []
        for r in csv.DictReader(texto):
            la, lo = dms(r['LATITUD']), dms(r['LONGITUD'])
            if la is not None and lo is not None:
                puntos.append((la, lo))
    base = {(math.floor(la / CELDA), math.floor(lo / CELDA)) for la, lo in puntos}
    celdas = {(i + di, j + dj) for i, j in base for di in range(-MARGEN, MARGEN + 1) for dj in range(-MARGEN, MARGEN + 1)}
    salida = {
        'celda': CELDA,
        'fuente': 'Localidades del censo 2020 de Puebla (INEGI, ITER) con {} celdas de margen; aproxima el estado'.format(MARGEN),
        'celdas': sorted('{},{}'.format(i, j) for i, j in celdas),
    }
    with open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(salida, f, ensure_ascii=False, separators=(',', ':'))
    print('{} localidades con coordenadas; {} celdas con localidad, {} con el margen'.format(len(puntos), len(base), len(celdas)))


if __name__ == '__main__':
    main()

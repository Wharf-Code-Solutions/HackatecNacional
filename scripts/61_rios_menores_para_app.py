# -*- coding: utf-8 -*-
"""Cauces de orden 3 para el mapa de la app ciudadana (M8).

El mapa del modulo M6 dibuja los rios de orden >= 4 (red_hidrografica.geojson,
de 60_red_para_mapa.py). En la app, una persona tiene que poner el pin sobre el
cauce que ve, y muchas barrancas con descargas son de orden 3: sin ellas el
mapa base no deja ubicar bien el rio. La red completa del INEGI no se versiona
(I15) y Vercel no la tiene, asi que aqui se saca solo el orden 3 a un archivo
compacto. La app lo descarga hasta que la persona acerca el mapa.

Formato, para que pese poco (unos 240 KB comprimido): una lista de lineas, cada
una una lista de [lon, lat] a 4 decimales (~10 m), en el sentido del flujo como
las traza el INEGI. Mismo Douglas-Peucker que 60_red_para_mapa.py.

Lee    : datos/geo/F08_red_hidrografica/RH18/RH18A/RH18A?/*_hl.shp
Escribe: datos/procesados/mapa/rios_orden3.json

    python -I scripts/61_rios_menores_para_app.py
"""
import importlib.util
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
# La lectura del shapefile y la simplificacion viven en 60_red_para_mapa.py: se reutilizan, no se copian.
_spec = importlib.util.spec_from_file_location('red_para_mapa', os.path.join(AQUI, '60_red_para_mapa.py'))
r60 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(r60)

ORDEN = 3
DECIMALES = 4
SALIDA = os.path.join(r60.SALIDA, 'rios_orden3.json')


def main():
    r60.extrae_si_falta()
    lineas = []
    for sc in sorted(d for d in os.listdir(r60.BASE) if d.startswith('RH18A')):
        carpeta = os.path.join(r60.BASE, sc)
        _, geo = r60.leer_shp(os.path.join(carpeta, sc + '_hl.shp'))
        attr = r60.leer_dbf(os.path.join(carpeta, sc + '_hl.dbf'))
        for g, a in zip(geo, attr):
            if g is None or int(r60.numero(a.get('ORDER_1'), 0)) != ORDEN:
                continue
            for parte in g:
                pts = r60.douglas_peucker(parte, r60.TOL_LINEA)
                if len(pts) >= 2:
                    lineas.append([[round(x, DECIMALES), round(y, DECIMALES)] for x, y in pts])
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump({'version': '1.0', 'orden': ORDEN, 'fuente': 'INEGI, Red Hidrografica 1:50 000 (F08)',
                   'lineas': lineas}, f, separators=(',', ':'))
    print('rios_orden3.json: {:,} lineas, {:,.0f} KB'.format(len(lineas), os.path.getsize(SALIDA) / 1024))


if __name__ == '__main__':
    main()

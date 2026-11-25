"""Contorno de Mexico para el mapa (mapa/): extrae el poligono de Mexico de Natural Earth 1:50m.

Fuente: Natural Earth, ne_50m_admin_0_countries.geojson (dominio publico), descargado a mano:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson

Uso:  python -I scripts/104_contorno_mexico.py RUTA/ne_50m_admin_0_countries.geojson
Salida: datos/procesados/mapa/mexico.geojson (un Feature con el poligono de Mexico, coordenadas a 3 decimales)
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'datos' / 'procesados' / 'mapa' / 'mexico.geojson'


def redondea(c):
    return [round(c[0], 3), round(c[1], 3)] if isinstance(c[0], (int, float)) else [redondea(x) for x in c]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    paises = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    mx = [f for f in paises['features'] if f['properties'].get('ADM0_A3') == 'MEX']
    if len(mx) != 1:
        sys.exit('No encontre un unico poligono con ADM0_A3 = MEX')
    g = mx[0]['geometry']
    g['coordinates'] = redondea(g['coordinates'])
    SALIDA.write_text(json.dumps({'type': 'Feature', 'properties': {'nombre': 'Mexico', 'fuente': 'Natural Earth 1:50m'}, 'geometry': g},
                                 separators=(',', ':')), encoding='utf-8')
    print('Escrito', SALIDA, SALIDA.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()

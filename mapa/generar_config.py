# -*- coding: utf-8 -*-
"""Escribe mapa/config.js a partir del .env de la raiz del repositorio.

El token de Mapbox se guarda en un solo lugar, el .env (no versionado):

    MAPBOX_ACCESS_TOKEN=pk.xxxxx

y este script lo copia a mapa/config.js (tampoco versionado), que es lo que la
pagina del mapa puede leer. Un navegador no tiene acceso al .env: la pagina solo
ve archivos servidos.

Esto es comodidad, no ocultamiento. Un token publico de Mapbox (pk.) viaja en
cada peticion de teselas y cualquiera lo ve en el navegador; esta hecho para eso.
La proteccion real es restringirlo por URL en la cuenta de Mapbox. Por la misma
razon el script se niega a escribir un token secreto (sk.): ese jamas debe llegar
a una pagina web.

Uso, desde la raiz del repositorio:
    python -I mapa/generar_config.py

Sin token (o con el valor vacio) escribe un config.js vacio y el mapa usa
MapLibre con OpenFreeMap, sin llave.
"""
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ENV = os.path.join(RAIZ, '.env')
SALIDA = os.path.join(AQUI, 'config.js')
VARIABLE = 'MAPBOX_ACCESS_TOKEN'
# Los tokens de Mapbox son tres partes en base64url separadas por punto.
FORMA = re.compile(r'^pk\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$')


def leer_env(ruta):
    """KEY=valor por linea; ignora comentarios y comillas que envuelvan el valor."""
    valores = {}
    if not os.path.exists(ruta):
        return valores
    with open(ruta, encoding='utf-8-sig') as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith('#') or '=' not in linea:
                continue
            clave, valor = linea.split('=', 1)
            clave = clave.strip()
            if clave.startswith('export '):
                clave = clave[len('export '):].strip()
            valor = valor.strip()
            if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in '"\'':
                valor = valor[1:-1]
            valores[clave] = valor
    return valores


def enmascarar(token):
    # Nunca se imprime el token completo: la salida de la terminal se comparte y se copia.
    return '{}...{} ({} caracteres)'.format(token[:3], token[-4:], len(token))


def main():
    if not os.path.exists(ENV):
        print('No existe .env en la raiz. Crealo con la linea {}=pk.tu_token'.format(VARIABLE))
        return 1
    token = leer_env(ENV).get(VARIABLE, '')

    if token.startswith('sk.'):
        print('El token es SECRETO (sk.). No se escribe: una pagina web lo expondria a cualquiera.')
        print('Usa el token publico (pk.) de tu cuenta de Mapbox.')
        return 1
    if token and not FORMA.match(token):
        print('{} no parece un token publico de Mapbox (debe empezar con pk.). No se escribe.'.format(VARIABLE))
        return 1

    contenido = (
        '// Generado por mapa/generar_config.py desde el .env de la raiz. No lo edites ni lo versiones:\n'
        '// cambia el token en .env y vuelve a correr el script.\n'
        'window.MAPBOX_TOKEN = {};\n'.format(json.dumps(token))
    )
    with open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        f.write(contenido)

    if token:
        print('mapa/config.js escrito con el token {}.'.format(enmascarar(token)))
        print('Recuerda restringirlo por URL en tu cuenta de Mapbox.')
    else:
        print('mapa/config.js escrito sin token: el mapa usara MapLibre con OpenFreeMap.')
        print('Pega tu token publico en .env ({}=pk...) y vuelve a correr el script.'.format(VARIABLE))
    return 0


if __name__ == '__main__':
    sys.exit(main())

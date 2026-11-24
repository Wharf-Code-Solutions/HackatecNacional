# -*- coding: utf-8 -*-
"""Validador de JSON Schema, subconjunto suficiente para este contrato.

Se escribio a mano para que el contrato no dependa de ningun paquete externo:
cualquier integrante del equipo puede validar un payload con el Python que ya
tiene instalado. Soporta type, required, additionalProperties, properties,
enum, const, pattern, minimum/maximum, exclusiveMinimum, minItems/maxItems,
items y maxLength. Ignora $ref (los esquemas que lo usan se validan por partes).

Uso como libreria:
    from validador import validar, cargar_esquema
    errores = validar(payload, cargar_esquema('lectura'))

Uso desde la terminal:
    python contrato/validador.py lectura archivo.json
"""
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
ESQUEMAS = os.path.join(AQUI, 'esquemas')

TIPOS = {'object': dict, 'array': list, 'string': str, 'number': (int, float),
         'integer': int, 'boolean': bool, 'null': type(None)}


def cargar_esquema(nombre):
    ruta = os.path.join(ESQUEMAS, nombre + '.schema.json')
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def _tipo_ok(valor, tipos):
    if isinstance(tipos, str):
        tipos = [tipos]
    for t in tipos:
        esperado = TIPOS.get(t)
        if esperado is None:
            continue
        if t == 'integer' and isinstance(valor, bool):
            continue
        if t == 'number' and isinstance(valor, bool):
            continue
        if t == 'boolean' and not isinstance(valor, bool):
            continue
        if isinstance(valor, esperado):
            return True
    return False


def validar(valor, esquema, ruta='$'):
    """Devuelve una lista de errores en texto. Vacia significa que paso."""
    err = []
    if not isinstance(esquema, dict):
        return err
    if '$ref' in esquema:
        return err                       # fuera del alcance a proposito

    if 'type' in esquema and not _tipo_ok(valor, esquema['type']):
        err.append('{}: se esperaba {}, llego {}'.format(
            ruta, esquema['type'], type(valor).__name__))
        return err

    if 'const' in esquema and valor != esquema['const']:
        err.append('{}: debe ser {!r}, llego {!r}'.format(
            ruta, esquema['const'], valor))
    if 'enum' in esquema and valor not in esquema['enum']:
        err.append('{}: {!r} no esta en los valores permitidos {}'.format(
            ruta, valor, esquema['enum']))

    if isinstance(valor, str):
        if 'pattern' in esquema and not re.search(esquema['pattern'], valor):
            err.append('{}: {!r} no cumple el patron {}'.format(
                ruta, valor, esquema['pattern']))
        if 'maxLength' in esquema and len(valor) > esquema['maxLength']:
            err.append('{}: mas de {} caracteres'.format(
                ruta, esquema['maxLength']))

    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        if 'minimum' in esquema and valor < esquema['minimum']:
            err.append('{}: {} es menor que el minimo {}'.format(
                ruta, valor, esquema['minimum']))
        if 'maximum' in esquema and valor > esquema['maximum']:
            err.append('{}: {} es mayor que el maximo {}'.format(
                ruta, valor, esquema['maximum']))
        if 'exclusiveMinimum' in esquema and valor <= esquema['exclusiveMinimum']:
            err.append('{}: {} debe ser mayor que {}'.format(
                ruta, valor, esquema['exclusiveMinimum']))

    if isinstance(valor, dict):
        for campo in esquema.get('required', []):
            if campo not in valor:
                err.append('{}: falta el campo obligatorio {!r}'.format(ruta, campo))
        props = esquema.get('properties', {})
        if esquema.get('additionalProperties') is False:
            for k in valor:
                if k not in props:
                    err.append('{}: campo no permitido {!r}'.format(ruta, k))
        for k, sub in props.items():
            if k in valor:
                err += validar(valor[k], sub, '{}.{}'.format(ruta, k))

    if isinstance(valor, list):
        if 'minItems' in esquema and len(valor) < esquema['minItems']:
            err.append('{}: se esperaban al menos {} elementos'.format(
                ruta, esquema['minItems']))
        if 'maxItems' in esquema and len(valor) > esquema['maxItems']:
            err.append('{}: se esperaban a lo mas {} elementos'.format(
                ruta, esquema['maxItems']))
        if isinstance(esquema.get('items'), dict):
            for i, it in enumerate(valor):
                err += validar(it, esquema['items'], '{}[{}]'.format(ruta, i))

    return err


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    nombre, archivo = sys.argv[1], sys.argv[2]
    with open(archivo, encoding='utf-8') as f:
        datos = json.load(f)
    lista = datos if isinstance(datos, list) else [datos]
    esquema = cargar_esquema(nombre)
    total = 0
    for i, d in enumerate(lista):
        for e in validar(d, esquema, '$[{}]'.format(i) if len(lista) > 1 else '$'):
            print('ERROR', e)
            total += 1
    print('{} error(es) en {} objeto(s)'.format(total, len(lista)))
    sys.exit(1 if total else 0)

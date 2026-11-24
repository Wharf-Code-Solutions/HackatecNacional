# -*- coding: utf-8 -*-
"""Reproduce un escenario enviando sus lecturas a un servidor, como lo haria el
dispositivo real. Solo biblioteca estandar.

Sirve para dos cosas: probar el backend de alguien mas sin tener el hardware, y
grabar la demo de la Etapa 8 con tiempos controlados.

    python contrato/reproducir_escenario.py descarga_organica
    python contrato/reproducir_escenario.py lluvia --url http://127.0.0.1:8080 --velocidad 120
    python contrato/reproducir_escenario.py falla_sensor --en-seco

--velocidad es cuantos minutos simulados pasan por segundo real. 0 envia todo
de golpe. --en-seco solo valida e imprime, sin enviar nada.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from validador import cargar_esquema, validar          # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('escenario')
    ap.add_argument('--url', default='http://127.0.0.1:8080')
    ap.add_argument('--velocidad', type=float, default=0,
                    help='minutos simulados por segundo real; 0 = sin espera')
    ap.add_argument('--en-seco', action='store_true')
    ap.add_argument('--lote', type=int, default=5,
                    help='cuantos paquetes por peticion')
    args = ap.parse_args()

    ruta = os.path.join(AQUI, 'fixtures', 'escenarios', args.escenario + '.json')
    if not os.path.exists(ruta):
        carpeta = os.path.join(AQUI, 'fixtures', 'escenarios')
        print('No existe ese escenario. Disponibles: ' +
              ', '.join(sorted(a[:-5] for a in os.listdir(carpeta))))
        return 2
    with open(ruta, encoding='utf-8') as f:
        esc = json.load(f)

    print('Escenario: {}'.format(esc['escenario']))
    print(esc['descripcion'])
    print('Paquetes: {}'.format(len(esc['paquetes'])))

    esquema = cargar_esquema('lectura')
    malos = 0
    for i, p in enumerate(esc['paquetes']):
        errores = validar(p, esquema, '$[{}]'.format(i))
        if errores:
            malos += 1
            if malos <= 5:
                for e in errores:
                    print('  ERROR DE CONTRATO', e)
    if malos:
        print('{} paquetes no cumplen el contrato. No se envia nada.'.format(malos))
        return 1
    print('Todos los paquetes cumplen el contrato.')
    if args.en_seco:
        return 0

    enviados = alertas = 0
    lote, minuto_previo = [], None
    for p in esc['paquetes']:
        if args.velocidad > 0:
            minuto = p['fecha_hora'][11:16]
            if minuto_previo is not None and minuto != minuto_previo:
                time.sleep(15.0 / args.velocidad)
            minuto_previo = minuto
        lote.append(p)
        if len(lote) >= args.lote:
            alertas += enviar(args.url, lote)
            enviados += len(lote)
            lote = []
    if lote:
        alertas += enviar(args.url, lote)
        enviados += len(lote)
    print('Enviados {} paquetes. Alertas generadas: {}.'.format(enviados, alertas))
    return 0


def enviar(url, paquetes):
    cuerpo = json.dumps(paquetes).encode('utf-8')
    pet = urllib.request.Request(url.rstrip('/') + '/lecturas', data=cuerpo,
                                 headers={'Content-Type': 'application/json'},
                                 method='POST')
    try:
        with urllib.request.urlopen(pet, timeout=20) as r:
            d = json.loads(r.read().decode('utf-8'))
            return sum(len(v.get('alertas', [])) for v in d.get('veredictos', []))
    except urllib.error.HTTPError as e:
        print('HTTP {}: {}'.format(e.code, e.read().decode('utf-8', 'replace')[:400]))
    except urllib.error.URLError as e:
        print('No se pudo conectar a {}: {}'.format(url, e.reason))
        raise SystemExit(1)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

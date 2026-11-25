# -*- coding: utf-8 -*-
"""Siembra 24 h de lecturas de los 10 mecanismos junto a escuelas (EST-ESC y EST-LAD) para la demostración.

Los escenarios de contrato/fixtures/escenarios/ son de las estaciones del Atoyac, que salieron del presupuesto; sin
ellos el panel se ve vacío hasta que alguien corre el simulador. Este script fabrica lecturas que cumplen el contrato
y las manda a POST /lecturas como lo haría el dispositivo: el backend decide las alertas, el script no.

- Agua: alrededor de la mediana de la línea base que usa el motor (la del sitio o banda_simulacion), con ruido de
  ±0.6 MAD y el ciclo diario de la temperatura. Eventos: descarga industrial en ESC-02 (hace 9 h, 3 h de duración,
  ya normalizada) y descarga orgánica en ESC-04 (empieza hace 2 h y sigue: queda por atender).
- Ladera: suelo y inclinómetro quietos con lluvia ligera; tormenta en LAD-02 (hace 8 h) y deslave en LAD-04 (la
  lluvia de las últimas horas y el inclinómetro que se mueve: queda por atender).

Cada estación empieza donde se quedó su última lectura (o hace 24 h): nunca escribe en el pasado de otra corrida.
Todo número es fabricado para la demostración; no es medición.

    python contrato/sembrar_demo.py --url https://hackatec-nacional.vercel.app/api
    python contrato/sembrar_demo.py --en-seco
"""
import argparse
import json
import math
import os
import random
import sys
import urllib.request
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from validador import cargar_esquema, validar          # noqa: E402

FIX = os.path.join(AQUI, 'fixtures')
PASO = timedelta(minutes=15)
N = 96   # 24 h


def leer(nombre):
    with open(os.path.join(FIX, nombre), encoding='utf-8') as f:
        return json.load(f)


def pedir(url, metodo='GET', cuerpo=None):
    datos = json.dumps(cuerpo).encode('utf-8') if cuerpo is not None else None
    pet = urllib.request.Request(url, data=datos, method=metodo, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(pet, timeout=60) as r:
        return json.loads(r.read().decode('utf-8') or '{}')


def iso(t):
    return t.isoformat(timespec='seconds')


def agua(est, lb, t, i, rnd, evento):
    sitio = est['c_sitio'] if (est['c_sitio'], 'COND') in lb else est['banda_simulacion']
    v = {}
    for cp in est['parametros']:
        b = lb[(sitio, cp)]
        med, mad = b['mediana'], max(b['mad'], 0.05 * abs(b['mediana']) or 0.1)
        # Deriva lenta (horas) de hasta ±4.5 MAD más ruido: aleja la lectura de lo habitual sin un escalón brusco.
        fase = sum(map(ord, est['c_estacion'] + cp)) % 7
        x = med + 4.5 * mad * math.sin(i / 14.0 + fase) + rnd.gauss(0, 0.5 * mad)
        if cp == 'TEMP':
            x = med + 2.0 * math.sin((t.hour + t.minute / 60 - 9) / 24 * 2 * math.pi) + rnd.gauss(0, 0.3)
        v[cp] = x
    k = evento(i)
    if k == 'pulso':
        v['TURB'] *= 1.8; v['COND'] *= 1.25
    elif k == 'calor':
        v['TEMP'] += 3.5; v['OD'] *= 0.7
    elif k == 'industrial':
        v['COND'] *= 9; v['PH'] += 1.6; v['OD'] *= 0.5; v['TURB'] *= 2
    elif k == 'organica':
        v['TURB'] *= 5; v['COND'] *= 1.8; v['PH'] -= 0.6; v['OD'] *= 0.4
    v['OD'] = max(v['OD'], 0.2)
    v['TURB'] = max(v['TURB'], 1)
    return [{'c_parametro': cp, 'valor': round(v[cp], 3)} for cp in est['parametros']]


def ladera(t, i, rnd, evento, estado):
    k = evento(i)
    lluvia = 0.0
    if k == 'tormenta':
        lluvia = rnd.uniform(5, 9)
    elif k == 'aguacero':
        lluvia = rnd.uniform(3, 5)
    elif k == 'llovizna':
        lluvia = rnd.uniform(1.5, 3)
    elif k == 'deslave':
        lluvia = rnd.uniform(6, 11)
    elif rnd.random() < 0.06:
        lluvia = round(rnd.uniform(0.2, 1.5), 1)
    estado['hum'] = min(48.0, estado['hum'] + lluvia * 0.35) - 0.04
    estado['hum'] = max(estado['hum'], 22.0)
    if k == 'deslave' and estado['hum'] > 40:
        estado['incl'] += rnd.uniform(0.15, 0.35)
    incl = estado['incl'] + rnd.gauss(0, 0.02)
    return [{'c_parametro': 'LLUVIA', 'valor': round(lluvia, 1)},
            {'c_parametro': 'HUM_SUELO', 'valor': round(estado['hum'], 2)},
            {'c_parametro': 'INCL', 'valor': round(incl, 2)}]


def entre(a, b):
    """Evento activo entre los paquetes a y b (contados desde el final: N-a es hace a cuartos de hora)."""
    return lambda i: N - a <= i < N - b


EVENTOS = {
    'EST-ESC-02': lambda i: 'industrial' if entre(36, 24)(i) else None,
    'EST-ESC-04': lambda i: 'organica' if i >= N - 8 else None,
    'EST-LAD-02': lambda i: 'tormenta' if entre(32, 16)(i) else None,
    'EST-LAD-04': lambda i: 'deslave' if i >= N - 20 else None,
    # Las demás tienen un episodio menor: la huella de cada una muestra algo, como un día real de temporada.
    'EST-ESC-01': lambda i: 'pulso' if entre(20, 12)(i) else None,
    'EST-ESC-03': lambda i: 'calor' if entre(30, 14)(i) else None,
    'EST-ESC-05': lambda i: 'pulso' if entre(14, 6)(i) else None,
    'EST-LAD-01': lambda i: 'aguacero' if entre(26, 14)(i) else None,
    'EST-LAD-03': lambda i: 'llovizna' if entre(40, 10)(i) else None,
    'EST-LAD-05': lambda i: 'aguacero' if entre(18, 8)(i) else None,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8080')
    ap.add_argument('--en-seco', action='store_true', help='solo arma y valida, no envía')
    ap.add_argument('--semilla', type=int, default=7)
    args = ap.parse_args()
    url = args.url.rstrip('/')
    rnd = random.Random(args.semilla)
    lb = {(r['c_sitio'], r['c_parametro']): r for r in leer('linea_base.json')['linea_base']}
    ests = leer('mecanismos.json')['estaciones']

    ahora = datetime.now().astimezone().replace(second=0, microsecond=0)
    ahora -= timedelta(minutes=ahora.minute % 15)
    ultima = {}
    if not args.en_seco:
        for e in pedir(url + '/estaciones').get('estaciones', []):
            if e.get('ultima_recepcion'):
                ultima[e['c_estacion']] = datetime.fromisoformat(e['ultima_recepcion'])

    paquetes = []
    for est in ests:
        c = est['c_estacion']
        t0 = ahora - PASO * (N - 1)
        if c in ultima and ultima[c] + PASO > t0:
            t0 = ultima[c] + PASO
            t0 = t0.replace(second=0, microsecond=0) - timedelta(minutes=t0.minute % 15)
            t0 += PASO if t0 <= ultima[c] else timedelta(0)
        ev = EVENTOS.get(c, lambda i: None)
        es_ladera = 'LLUVIA' in est['parametros']
        estado = {'hum': rnd.uniform(24, 30), 'incl': rnd.uniform(0.02, 0.1)}
        for i in range(N):
            t = t0 + PASO * i
            lect = ladera(t, i, rnd, ev, estado) if es_ladera else agua(est, lb, t, i, rnd, ev)
            paquetes.append({'version': '1.0', 'c_estacion': c, 'fecha_hora': iso(t), 'lecturas': lect,
                             'bateria': rnd.randint(88, 99), 'senal': rnd.randint(-92, -60)})

    esquema = cargar_esquema('lectura')
    malos = [e for i, p in enumerate(paquetes) for e in validar(p, esquema, '$[{}]'.format(i))]
    if malos:
        print('No cumplen el contrato:', malos[:5])
        return 1
    print('{} paquetes de {} estaciones cumplen el contrato.'.format(len(paquetes), len(ests)))
    if args.en_seco:
        return 0

    for est in ests:
        pedir(url + '/estaciones/{}/reiniciar'.format(est['c_estacion']), 'POST', {})
    alertas = 0
    for est in ests:
        suyos = [p for p in paquetes if p['c_estacion'] == est['c_estacion']]
        n = 0
        for j in range(0, len(suyos), 24):
            r = pedir(url + '/lecturas', 'POST', suyos[j:j + 24])
            n += sum(len(v.get('alertas') or []) for v in r.get('veredictos', []))
        alertas += n
        print('  {} · {} paquetes · {} alertas'.format(est['c_estacion'], len(suyos), n))
    print('Listo: {} alertas abiertas por el motor.'.format(alertas))
    return 0


if __name__ == '__main__':
    sys.exit(main())

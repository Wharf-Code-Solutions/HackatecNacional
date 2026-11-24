# -*- coding: utf-8 -*-
"""Escuelas que llevan módulo de ladera (docs/20 §3.2): criterio y lista.

El módulo de ladera (pluviómetro, humedad de suelo, inclinómetro) va en la misma estación que ya mide agua. Aquí
se decide DÓNDE. La lista se la entrega a `scripts/99_reubicacion.py`, que arma las estaciones EST-LAD-.

Criterio (hipótesis, igual que los pesos del índice):

  1. Elegibles: escuelas de escuelas.json con sub-índice `riesgo.derrumbe` >= DERRUMBE_MINIMO y susceptibilidad
     de laderas de CENAPRED Alta o Muy alta (columna `susceptibilidad_laderas` de factores_escuelas.csv:
     0.75 = Alta, 1.0 = Muy alta).
  2. Orden: `riesgo.derrumbe` de mayor a menor; a igual valor, la pendiente de su entorno (p75) y luego la CCT.
  3. Cuántos: N_MODULOS = 5, el mismo presupuesto que las estaciones de agua (docs/18). Se eligen a más de
     SEPARACION_M entre sí: dos laderas pegadas comparten tormenta, pero no la misma ladera. Las escuelas del
     catálogo que quedan a menos de PROTEGE_M de un módulo van en su lista `escuelas_protegidas`.
  4. Inclinómetro (`INCL`) solo si la susceptibilidad es Muy alta (1.0): es el sensor caro y el que
     avisa de un movimiento ya iniciado.

Lo que NO dice: no predice deslaves. Elige dónde vigilar el detonante.

Salida (DERIVADA: se edita este script, no el archivo):
    contrato/fixtures/escuelas_ladera.json

    python -I scripts/100_escuelas_ladera.py
"""
import csv
import json
import math
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
FACTORES = os.path.join(RAIZ, 'datos', 'procesados', 'escuelas', 'factores_escuelas.csv')

DERRUMBE_MINIMO = 0.7
SUSCEPTIBILIDAD_MINIMA = 0.75     # Alta
SUSCEPTIBILIDAD_INCL = 1.0        # Muy alta
N_MODULOS = 5
SEPARACION_M = 5000
PROTEGE_M = 1500
NOMBRE_SUSCEPTIBILIDAD = {0.75: 'Alta', 1.0: 'Muy alta'}

M_LAT = 110574.0


def metros(a, b):
    return math.hypot((a[0] - b[0]) * M_LAT, (a[1] - b[1]) * 111320.0 * math.cos(math.radians(a[0])))


def main():
    with open(os.path.join(FIX, 'escuelas.json'), encoding='utf-8') as f:
        escuelas = json.load(f)
    with open(FACTORES, encoding='utf-8-sig') as f:
        factores = {r['cct']: r for r in csv.DictReader(f)}
    with open(os.path.join(FIX, 'mecanismos.json'), encoding='utf-8') as f:
        agua = json.load(f)['estaciones']
    con_agua = {c: e['c_estacion'] for e in agua for c in e['escuelas_protegidas']}

    elegibles = []
    for e in escuelas:
        fa = factores[e['cct']]
        susc = float(fa['susceptibilidad_laderas'])
        if e['riesgo']['derrumbe'] >= DERRUMBE_MINIMO and susc >= SUSCEPTIBILIDAD_MINIMA:
            elegibles.append((e, susc, float(fa['pendiente_p75'] or 0)))
    elegibles.sort(key=lambda x: (-x[0]['riesgo']['derrumbe'], -x[2], x[0]['cct']))

    elegidos = []
    for e, susc, p75 in elegibles:
        punto = (e['latitud'], e['longitud'])
        if len(elegidos) < N_MODULOS and all(metros(punto, (y[0]['latitud'], y[0]['longitud'])) >= SEPARACION_M
                                             for y in elegidos):
            elegidos.append((e, susc, p75))

    modulos = []
    for i, (e, susc, p75) in enumerate(elegidos, 1):
        punto = (e['latitud'], e['longitud'])
        # Las del catálogo en la misma ladera: a menos de PROTEGE_M de la escuela elegida.
        protegidas = [o['cct'] for o in escuelas if metros(punto, (o['latitud'], o['longitud'])) <= PROTEGE_M]
        modulos.append({
            'c_estacion': 'EST-LAD-{:02d}'.format(i),
            'cct': e['cct'],
            'escuela': e['nombre'],
            'nivel': e['nivel'],
            'municipio': e['municipio'],
            'localidad': e['localidad'],
            'latitud': e['latitud'],
            'longitud': e['longitud'],
            'riesgo_derrumbe': e['riesgo']['derrumbe'],
            'susceptibilidad_cenapred': NOMBRE_SUSCEPTIBILIDAD[susc],
            'pendiente_p75_grados': p75,
            'parametros': ['LLUVIA', 'HUM_SUELO'] + (['INCL'] if susc >= SUSCEPTIBILIDAD_INCL else []),
            'escuelas_protegidas': sorted(set(protegidas) | {e['cct']}),
            # Si la escuela ya está junto a una estación de agua, el módulo se suma a esa estación (docs/20 §3.2).
            'estacion_de_agua_existente': con_agua.get(e['cct']),
        })

    salida = {
        'version': '0.1-propuesta',
        '_provisional': True,
        'criterio': ('Escuelas de escuelas.json con riesgo.derrumbe >= {} y susceptibilidad de laderas CENAPRED Alta o '
                     'Muy alta, por riesgo de derrumbe descendente; las {} primeras a mas de {} m entre si; INCL solo con '
                     'Muy alta. Umbrales de seleccion son hipotesis. Generado por scripts/100_escuelas_ladera.py.').format(
                         DERRUMBE_MINIMO, N_MODULOS, SEPARACION_M),
        'elegibles': len(elegibles),
        'elegibles_muy_alta': sum(1 for x in elegibles if x[1] >= SUSCEPTIBILIDAD_INCL),
        'modulos': modulos,
    }
    with open(os.path.join(FIX, 'escuelas_ladera.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
        f.write('\n')

    print('{} escuelas elegibles ({} con susceptibilidad Muy alta); {} modulos'.format(
        len(elegibles), salida['elegibles_muy_alta'], len(modulos)))
    for m in modulos:
        print('  {} {} {:<26} {:<22} derrumbe {:.3f} {:<8} {} escuelas  {}'.format(
            m['c_estacion'], m['cct'], m['municipio'][:26], m['localidad'][:22], m['riesgo_derrumbe'],
            m['susceptibilidad_cenapred'], len(m['escuelas_protegidas']), ','.join(m['parametros'])))


if __name__ == '__main__':
    main()

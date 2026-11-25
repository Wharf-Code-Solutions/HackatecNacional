# -*- coding: utf-8 -*-
"""Escenarios del módulo de ladera (docs/20 §3.3): paquetes POST /lecturas con LLUVIA, HUM_SUELO e INCL.

Escribe tres escenarios, DERIVADOS (se edita este script, no los JSON), en contrato/fixtures/escenarios/:

    tormenta_ladera.json      una tormenta corta e intensa en un día; suelo que sube pero no satura; sin movimiento
    lluvia_prolongada.json    cuatro días de lluvia moderada (65 a 95 mm por día); ninguna ventana de 24 h llama la atención pero la de 72 h sí;
                              el suelo llega cerca de saturación; sin movimiento
    deslave.json              dos días de lluvia sobre suelo saturado y, a media mañana del segundo, el salto del inclinómetro

Los tres son de la estación EST-LAD-01 (Tecuantla, Jopala; con inclinómetro, `escuelas_ladera.json`). Todo el modelo es
SINTÉTICO y sus parámetros son supuestos: la lluvia es un hietograma inventado con la forma de una tormenta; la humedad es
una cubeta simple (sube con la lluvia, drena hasta la capacidad de campo y satura en la porosidad del suelo de la ladera,
de suelo_laderas.json); el inclinómetro está quieto con
ruido de ±0.05° hasta el evento. Sirven para probar el motor y el backend, no para decir cómo se comporta una ladera real.
Paquetes cada 15 min, con la misma forma que los del agua (lectura.schema.json): valor crudo, sin corregir.

Lo que cada escenario espera del motor (con los umbrales de umbrales_lluvia.json, que son hipótesis):

    tormenta_ladera           unos 120 mm en 24 h: pasa el mínimo de Caine (103 mm), muy por debajo de lo de 1999 → Preventiva
    lluvia_prolongada         máximo de 24 h unos 92 mm (no pasa 103) pero 72 h unos 244 mm (pasa 201) y suelo sobre su umbral calibrado → Preventiva,
                              y Crítica con la combinación propuesta (lluvia Preventiva + suelo saturado)
    deslave                   INCL salta de unos 0.1° a unos 3.8° (> 2° crítico) → Crítica, sin esperar la lluvia

    python -I scripts/102_escenarios_ladera.py
"""
import json
import math
import os
import random
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'contrato', 'fixtures', 'escenarios')
ESTACION = 'EST-LAD-01'
ZONA = timezone(timedelta(hours=-6))
PASO_MIN = 15
BASCULADA_MM = 0.2          # el pluviómetro de balancín cuenta de 0.2 en 0.2 mm (docs/20 §2)

HUM_BASE = 31.0             # % de humedad del suelo en seco, supuesto (si no hay suelo calibrado)
HUM_SATURA = 50.0           # satura alrededor de 45-50 % (docs/20 §4), supuesto (si no hay suelo calibrado)
# Suelo de la ladera de la estación (scripts/103_suelo_laderas.py): la humedad drena hasta su capacidad de campo y satura
# en su porosidad. "Suelo seco" (la tormenta) arranca en el 80 % de la capacidad de campo, supuesto.
_SUELO = os.path.join(RAIZ, 'contrato', 'fixtures', 'suelo_laderas.json')
if os.path.exists(_SUELO):
    with open(_SUELO, encoding='utf-8') as _f:
        _s = next((x for x in json.load(_f)['laderas'] if x['c_estacion'] == ESTACION), None)
    if _s:
        HUM_BASE, HUM_SATURA = _s['capacidad_campo_pct'], _s['saturacion_pct']
HUM_SECO = round(0.8 * HUM_BASE, 1)
GANANCIA = 0.009            # fracción del hueco hasta la saturación que se llena por mm de lluvia, supuesto
DRENAJE = 0.0025            # fracción del exceso sobre la base que drena por paso de 15 min, supuesto


def pulso(i, centro, ancho, mm_total):
    """Hietograma triangular: `mm_total` repartidos alrededor del paso `centro` en `ancho` pasos."""
    d = abs(i - centro)
    return max(0.0, 1 - d / (ancho / 2.0)) if d < ancho / 2.0 else 0.0


def reparte(total_mm, pesos):
    s = sum(pesos)
    return [total_mm * p / s if s else 0.0 for p in pesos]


def cuantiza(mm):
    return round(round(mm / BASCULADA_MM) * BASCULADA_MM, 1)


def serie_lluvia(pasos, tormentas, rng):
    """tormentas: [(paso_central, ancho_en_pasos, mm_total)]. Más un goteo de fondo casi nulo."""
    mm = [0.0] * pasos
    for centro, ancho, total in tormentas:
        pesos = [pulso(i, centro, ancho, total) for i in range(pasos)]
        for i, v in enumerate(reparte(total, pesos)):
            mm[i] += v * (0.85 + 0.3 * rng.random())          # la lluvia real no es un triángulo limpio
    # La cuantización por basculadas pierde o gana fracciones: se corrige el total de cada tormenta aparte, no aquí.
    return [cuantiza(v) for v in mm]


def serie_humedad(lluvia, rng, h0=HUM_BASE):
    h, salida = h0, []
    for mm in lluvia:
        h += GANANCIA * mm * (HUM_SATURA - h) - DRENAJE * max(0.0, h - HUM_BASE)   # solo drena lo que pasa de la capacidad de campo
        h = min(h, HUM_SATURA)
        salida.append(round(h + rng.gauss(0, 0.12), 2))
    return salida


def serie_inclinacion(pasos, rng, saltos=()):
    """Quieta con ruido de ±0.05°. `saltos`: [(paso, grados)], cambia el nivel desde ese paso (el cambio es acumulado)."""
    nivel, salida = 0.0, []
    for i in range(pasos):
        for paso, g in saltos:
            if i == paso:
                nivel = g
        salida.append(round(nivel + rng.gauss(0, 0.03), 3))
    return salida


def armar(inicio, lluvia, humedad, incl, semilla, notas=None):
    rng = random.Random(semilla)
    paquetes = []
    for i in range(len(lluvia)):
        t = inicio + timedelta(minutes=PASO_MIN * i)
        p = {
            'version': '1.0', 'c_estacion': ESTACION, 'fecha_hora': t.isoformat(),
            'lecturas': [
                {'c_parametro': 'LLUVIA', 'valor': lluvia[i]},
                {'c_parametro': 'HUM_SUELO', 'valor': humedad[i]},
                {'c_parametro': 'INCL', 'valor': incl[i]},
            ],
            # El contrato pide bateria como porcentaje entero (no voltios) y señal en dBm.
            'bateria': max(60, 96 - i // 48),
            'senal': -86 + rng.randint(-3, 3),
        }
        if notas and i in notas:
            p['_nota'] = notas[i]
        paquetes.append(p)
    return paquetes


def paso_de(inicio, hora_texto):
    t = datetime.fromisoformat(hora_texto)
    return int((t - inicio).total_seconds() // (PASO_MIN * 60))


def ventana_max(lluvia, pasos):
    return max(sum(lluvia[i:i + pasos]) for i in range(max(1, len(lluvia) - pasos + 1)))


def escribir(nombre, descripcion, paquetes, lluvia, humedad, incl):
    esc = {'version': '1.0', 'escenario': nombre, 'descripcion': descripcion,
           'estacion_del_evento': ESTACION, 'paquetes': paquetes}
    with open(os.path.join(SALIDA, nombre + '.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(esc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('{:<18} {} paquetes  24 h max {:>6.1f} mm  72 h max {:>6.1f} mm  total {:>6.1f} mm  humedad max {:>5.1f} %  '
          '|INCL| max {:.2f}°'.format(nombre, len(paquetes), ventana_max(lluvia, 96), ventana_max(lluvia, 288),
                                      sum(lluvia), max(humedad), max(abs(x) for x in incl)))


def main():
    os.makedirs(SALIDA, exist_ok=True)

    # ---- 1. Tormenta: 24 h con una tormenta de 15:00 a 19:00 (16 pasos) de unos 120 mm
    inicio = datetime(2026, 11, 23, 0, 0, tzinfo=ZONA)
    rng = random.Random(1)
    centro = paso_de(inicio, '2026-11-23T17:00:00-06:00')
    lluvia = serie_lluvia(96, [(centro, 16, 120.0)], rng)
    hum = serie_humedad(lluvia, rng, h0=HUM_SECO)                # suelo seco: lejos de la temporada de lluvias
    incl = serie_inclinacion(96, rng)
    escribir('tormenta_ladera',
             'Tormenta de las 15:00 a las 19:00 sobre una ladera con suelo seco (unos 120 mm en 24 h). Escenario sintético '
             'de EST-LAD-01. Esperado: lluvia sobre el mínimo de Caine (103 mm en 24 h), suelo que sube pero no satura, '
             'inclinómetro quieto: una alerta Preventiva por lluvia y ninguna por movimiento.',
             armar(inicio, lluvia, hum, incl, 11), lluvia, hum, incl)

    # ---- 2. Lluvia prolongada: cuatro días, unos 60-85 mm por día, repartidos en la tarde y noche
    inicio = datetime(2026, 11, 20, 0, 0, tzinfo=ZONA)
    rng = random.Random(2)
    tormentas = []
    for dia, mm in enumerate((65.0, 85.0, 95.0, 65.0)):
        base = dia * 96
        tormentas += [(base + 52, 28, mm * 0.65), (base + 82, 20, mm * 0.35)]      # 13:00 y 20:30 aprox.
    lluvia = serie_lluvia(384, tormentas, rng)
    hum = serie_humedad(lluvia, rng)
    incl = serie_inclinacion(384, rng, saltos=[(380, 0.3)])    # un asomo al final, bajo el aviso de 0.5°
    escribir('lluvia_prolongada',
             'Cuatro días de lluvia moderada (65 a 95 mm por día). Ninguna ventana de 24 h pasa 103 mm pero la de 72 h '
             'pasa 201 mm, y el suelo llega cerca de saturación. Escenario sintético de EST-LAD-01. Esperado: alerta '
             'Preventiva por la ventana de 72 h; con la combinación propuesta (lluvia Preventiva + suelo cerca de '
             'saturación), Crítica. El inclinómetro no pasa su aviso.',
             armar(inicio, lluvia, hum, incl, 22), lluvia, hum, incl)

    # ---- 3. Deslave: dos días de lluvia y salto del inclinómetro el segundo día a las 10:30
    inicio = datetime(2026, 11, 22, 0, 0, tzinfo=ZONA)
    rng = random.Random(3)
    lluvia = serie_lluvia(192, [(96 - 40, 30, 70.0), (96 + 28, 36, 80.0)], rng)
    hum = serie_humedad(lluvia, rng, h0=HUM_BASE)              # empieza húmedo: en capacidad de campo, ya venía lloviendo
    p_salto = paso_de(inicio, '2026-11-23T10:30:00-06:00')
    # Un reptar previo (0.1° a 0.6° en 2.5 h) y luego el salto a unos 3.8°.
    incl = serie_inclinacion(192, rng, saltos=[(p_salto - 10 + k, 0.1 + 0.05 * k) for k in range(10)] + [(p_salto, 3.8)])
    escribir('deslave',
             'Dos días de lluvia sobre suelo que se satura y, el segundo día a las 10:30, un salto del inclinómetro de '
             'unos 0.1° a unos 3.8° tras un reptar de 2.5 h. Escenario sintético de EST-LAD-01. Esperado: alerta Crítica por '
             'INCL (> 2°) sin esperar a la lluvia, con suelo cerca de saturación y lluvia acumulada como contexto.',
             armar(inicio, lluvia, hum, incl, 33, {p_salto: 'salto del inclinometro: el evento'}), lluvia, hum, incl)


if __name__ == '__main__':
    main()

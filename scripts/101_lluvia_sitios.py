# -*- coding: utf-8 -*-
"""Lluvia por sitio y umbrales detonantes del módulo de ladera (docs/20 §3.3 y §5).

Escribe dos fixtures, DERIVADOS (se edita este script, no los JSON):

    contrato/fixtures/lluvia_sitios.json     por estación de ladera: lluvia diaria típica de temporada y percentiles
                                             de tormenta (p50, p90, p99), de NASA POWER/IMERG (F21)
    contrato/fixtures/umbrales_lluvia.json   los umbrales que usan las reglas de derrumbe, cada uno con su fuente

LO QUE ES Y LO QUE NO ES. Los umbrales son HIPÓTESIS. No existe un umbral publicado de lluvia para deslaves en la
Sierra Norte de Puebla: Lugo-Hubp et al. (2005) dicen que "no se puede determinar un umbral de precipitación
absoluto" en los deslaves de 1999. Lo que hay es (1) un mínimo global de intensidad-duración, (2) las cifras medidas
de ese evento y (3) la historia de lluvia del propio sitio. Con ellos se arman tres niveles, y cada número dice de
dónde sale. Humedad de suelo e inclinación no tienen ninguna fuente publicada: son supuestos de diseño, y así
se declaran.

La lluvia por sitio es satélite (IMERG a 0.1°, día en hora UTC), no pluviómetro: subestima las tormentas extremas de
montaña. Sus percentiles son una referencia de qué es "lo normal en temporada" en ese sitio, no una medición de la
ladera; el pluviómetro de la estación la reemplaza apenas exista.

    python -I scripts/101_lluvia_sitios.py
"""
import json
import math
import os
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
F21 = os.path.join(RAIZ, 'datos', 'crudos', 'F21')

DIA_LLUVIOSO_MM = 1.0        # convención usual: un "día con lluvia" tiene al menos 1 mm
PERCENTILES = (50, 90, 99)
MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

# ---------------------------------------------------------------- umbrales (cada número con su fuente)
CAINE_A, CAINE_B = 14.82, -0.39     # I = 14.82 · D^-0.39, I en mm/h y D en horas (Caine, 1980)
FUENTE_CAINE = ('Caine, N. (1980), "The rainfall intensity-duration control of shallow landslides and debris flows", '
                'Geografiska Annaler 62A. Ecuación tomada de su cita en Vennari et al. (2014), Nat. Hazards Earth Syst. '
                'Sci. 14, 317-330: I = 14.82 · D^-0.39, mínimo global de 73 eventos; por debajo, la actividad de '
                'deslizamientos es poco probable.')
FUENTE_1999 = ('Flores-Lorenzo y Alcántara-Ayala (2002), Investigaciones Geográficas 49, 7-26: en Teziutlán cayeron '
               '300 mm el 4 y 360 mm el 5 de octubre de 1999. Lugo-Hubp et al. (2005), Rev. Mex. Ciencias Geológicas '
               '22(2), 212-228: 743 mm del 3 al 6 de octubre en Teziutlán y 844 mm en Zacapoaxtla; "no se puede '
               'determinar un umbral de precipitación absoluto".')
TEZIUTLAN_24H_MM = 360.0     # el día de mayor lluvia del evento (5 de octubre de 1999)
TEZIUTLAN_48H_MM = 660.0     # 300 + 360: lo que cayó el 4 y el 5; cota inferior para la ventana de 72 h
HUM_SATURACION_PCT = 45.0    # supuesto de diseño de docs/20 §4: el suelo satura alrededor de 45-50 %
INCL_AVISO_GRADOS = 0.5      # 10 veces el ruido de diseño del sensor (±0.05°); supuesto
INCL_CRITICO_GRADOS = 2.0    # 40 veces el ruido; supuesto


def caine_mm(horas):
    """Lluvia acumulada (mm) en `horas` que iguala el mínimo global de Caine: I·D = 14.82 · D^(1-0.39)."""
    return CAINE_A * horas ** (1 + CAINE_B)


def percentil(xs, q):
    """Percentil por interpolación lineal (el mismo que numpy por defecto)."""
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q / 100.0
    a, b = int(math.floor(k)), int(math.ceil(k))
    return xs[a] + (xs[b] - xs[a]) * (k - a)


def leer_serie(ruta):
    with open(ruta, encoding='utf-8') as f:
        d = json.load(f)
    p = d['properties']['parameter']['IMERG_PRECTOT']
    fechas = sorted(p)
    # -999 es el valor de relleno de POWER: sin dato, no cero.
    serie = [(f, None if p[f] == -999 else float(p[f])) for f in fechas]
    return d, serie


def resumir(serie):
    validos = [(f, v) for f, v in serie if v is not None]
    por_mes = defaultdict(list)
    for f, v in validos:
        por_mes[int(f[4:6])].append(v)
    # Anual por mes: promedio mensual de lluvia diaria x días del mes ≈ mm/mes
    mm_mes = {m: sum(xs) / len(xs) * 30.4 for m, xs in por_mes.items()}
    media_mes = sum(mm_mes.values()) / 12
    temporada = sorted(m for m, v in mm_mes.items() if v >= media_mes)   # meses por encima del promedio mensual
    en_temporada = [(f, v) for f, v in validos if int(f[4:6]) in temporada]
    con_lluvia = [v for f, v in en_temporada if v >= DIA_LLUVIOSO_MM]

    # Ventana móvil de 3 días consecutivos completos (sin huecos)
    suma3 = []
    for i in range(2, len(serie)):
        t = [serie[i - k][1] for k in range(3)]
        if all(x is not None for x in t) and int(serie[i][0][4:6]) in temporada:
            suma3.append(sum(t))

    f_max, v_max = max(validos, key=lambda x: x[1])
    return {
        'dias_validos': len(validos),
        'temporada_meses': [MESES[m - 1] for m in temporada],
        'mm_por_mes_promedio': {MESES[m - 1]: round(mm_mes[m], 1) for m in sorted(mm_mes)},
        'mm_anuales_promedio': round(sum(mm_mes.values()), 0),
        'temporada': {
            'dias': len(en_temporada),
            'lluvia_diaria_media_mm': round(sum(v for _, v in en_temporada) / len(en_temporada), 2),
            'dias_con_lluvia': len(con_lluvia),
            'fraccion_dias_con_lluvia': round(len(con_lluvia) / len(en_temporada), 3),
            # Percentiles de TORMENTA: solo entre días con lluvia (>= 1 mm), que es lo que pasa cuando llueve
            'lluvia_diaria_dia_con_lluvia_mm': {'p{}'.format(q): round(percentil(con_lluvia, q), 1) for q in PERCENTILES},
            'lluvia_3_dias_mm': {'p{}'.format(q): round(percentil(suma3, q), 1) for q in PERCENTILES},
            'n_ventanas_3_dias': len(suma3),
        },
        'maximo_diario_mm': {'valor': round(v_max, 1), 'fecha': '{}-{}-{}'.format(f_max[:4], f_max[4:6], f_max[6:])},
    }


def main():
    with open(os.path.join(FIX, 'escuelas_ladera.json'), encoding='utf-8') as f:
        modulos = json.load(f)['modulos']

    sitios = []
    for m in modulos:
        ruta = os.path.join(F21, 'power_{}.json'.format(m['c_estacion']))
        if not os.path.exists(ruta):
            raise SystemExit('Falta {}: python -I scripts/00_descargar_fuentes.py F21'.format(ruta))
        d, serie = leer_serie(ruta)
        celda = d['geometry']['coordinates'][:2]
        sitios.append({
            'c_estacion': m['c_estacion'], 'cct': m['cct'], 'localidad': m['localidad'], 'municipio': m['municipio'],
            'latitud': m['latitud'], 'longitud': m['longitud'],
            'celda_de_la_fuente': {'longitud': celda[0], 'latitud': celda[1]},
            **resumir(serie),
        })

    lluvia = {
        'version': '0.1-propuesta',
        '_provisional': True,
        'fuente': 'NASA POWER, parámetro IMERG_PRECTOT (mm/día, malla 0.1°, día en hora UTC), 2001-2025; datos/crudos/F21',
        'advertencia': ('Es lluvia de satélite, no de pluviómetro: tiende a subestimar tormentas extremas de montaña. '
                        'Los percentiles dicen qué es normal en temporada en ese sitio, no cuánto llovió en la ladera. '
                        'Dos estaciones pueden compartir celda y dar la misma serie.'),
        'temporada': 'los meses cuyo promedio mensual supera al promedio de los 12; ver temporada_meses de cada sitio',
        'dia_con_lluvia_mm': DIA_LLUVIOSO_MM,
        'sitios': sitios,
    }
    with open(os.path.join(FIX, 'lluvia_sitios.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(lluvia, f, ensure_ascii=False, indent=1)
        f.write('\n')

    c24, c72 = caine_mm(24), caine_mm(72)
    umbrales = {
        'version': '0.1-propuesta',
        '_provisional': True,
        'aviso': ('HIPÓTESIS. No hay umbral publicado de lluvia para deslaves en la Sierra Norte de Puebla; estos valores '
                  'ordenan la vigilancia, no predicen un deslave. Se calibran con la primera temporada de datos del pluviómetro.'),
        'lluvia': {
            'descripcion': ('Lluvia acumulada (suma de LLUVIA de los paquetes) en ventanas móviles de 24 h y 72 h. '
                            'Un nivel se alcanza cuando se cumple CUALQUIERA de sus dos ventanas.'),
            'niveles': [
                {'nivel': 'Informativa', 'acumulada_24h_mm': 'p99_sitio', 'acumulada_72h_mm': 'p99_sitio_3_dias',
                 'origen': ('Historia del propio sitio (lluvia_sitios.json): el p99 de la lluvia diaria en días con lluvia '
                            'de la temporada y el p99 de la lluvia de 3 días. Es satélite, puede quedar bajo la lluvia real. '
                            'Mismo principio que el resto del proyecto: desviación respecto de la historia del punto.'),
                 'tipo': 'percentil_del_sitio'},
                {'nivel': 'Preventiva', 'acumulada_24h_mm': round(c24, 0), 'acumulada_72h_mm': round(c72, 0),
                 'origen': ('Mínimo global de intensidad-duración de Caine (1980) evaluado en D = 24 h y D = 72 h '
                            '(I·D = 14.82 · D^0.61). ' + FUENTE_CAINE),
                 'tipo': 'minimo_global_literatura'},
                {'nivel': 'Critica', 'acumulada_24h_mm': TEZIUTLAN_24H_MM, 'acumulada_72h_mm': TEZIUTLAN_48H_MM,
                 'origen': ('Lluvia que sí detonó miles de deslaves en la zona: 360 mm en un día y 660 mm en dos días '
                            '(300 + 360) en Teziutlán, octubre de 1999. La segunda cifra se usa como cota para la ventana de '
                            '72 h (en 72 h cayó al menos eso). ' + FUENTE_1999),
                 'tipo': 'evento_observado'},
            ],
            'ventana_de_los_percentiles': ('p99_sitio y p99_sitio_3_dias se leen de lluvia_sitios.json: '
                                           'temporada.lluvia_diaria_dia_con_lluvia_mm.p99 y temporada.lluvia_3_dias_mm.p99'),
        },
        'humedad_suelo': {
            'cerca_de_saturacion_pct': HUM_SATURACION_PCT,
            'fuente': 'ninguna publicada: supuesto de diseño de docs/20 §4 (el suelo satura alrededor de 45-50 %). '
                      'Depende del suelo de cada ladera; calibrar con la primera temporada.',
        },
        'inclinacion': {
            'aviso_grados': INCL_AVISO_GRADOS, 'critico_grados': INCL_CRITICO_GRADOS,
            'fuente': 'ninguna publicada: 10 y 40 veces el ruido de diseño del sensor (±0.05°, docs/20 §2). '
                      'INCL es el cambio respecto de la instalación, no la inclinación absoluta.',
        },
        'combinacion_propuesta': ('Lluvia al nivel Preventiva con suelo cerca de saturación sube a Critica; '
                                  'un cambio de INCL de aviso con lluvia o suelo saturado es Preventiva, y un cambio '
                                  'crítico es Critica sin más. Es una propuesta para el motor (docs/20 §5), no está implementada.'),
    }
    with open(os.path.join(FIX, 'umbrales_lluvia.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(umbrales, f, ensure_ascii=False, indent=1)
        f.write('\n')

    print('Caine: {:.0f} mm en 24 h, {:.0f} mm en 72 h'.format(c24, c72))
    for s in sitios:
        t = s['temporada']
        print('{} {:<14} {:<22} anual {:>5.0f} mm  temporada {}  media {:.1f} mm/d  dias con lluvia {:.0%}  '
              'p50/p90/p99 diaria {}  3 dias p99 {}  max {} mm ({})'.format(
                  s['c_estacion'], s['municipio'][:14], s['localidad'][:22], s['mm_anuales_promedio'],
                  ','.join(s['temporada_meses']), t['lluvia_diaria_media_mm'], t['fraccion_dias_con_lluvia'],
                  '/'.join(str(t['lluvia_diaria_dia_con_lluvia_mm']['p{}'.format(q)]) for q in PERCENTILES),
                  t['lluvia_3_dias_mm']['p99'], s['maximo_diario_mm']['valor'], s['maximo_diario_mm']['fecha']))


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""Reubicación de los mecanismos junto a escuelas rurales vulnerables (módulo A del cambio de rumbo, docs/19 §5).

Un mecanismo es la estación de calidad del agua (sondas en el cauce) más el colector de residuos flotantes en
la misma orilla, ≈ 10 m aguas arriba. Los dos son instrumentos DE CAUCE: miden y limpian el agua que corre junto
a la escuela y que llega a su pozo, manantial o patio cuando crece. Por eso el criterio es:

  1. Elegibles: escuelas de escuelas.json en el Alto Atoyac (las cuatro subcuencas que drenan a Valsequillo,
     `_comun.SUBCUENCAS_ALTO_ATOYAC`) con un cauce a menos de RADIO_CAUCE_M. El cauce se busca primero en
     la red de asignación (todos los órdenes, trae el sitio de CONAGUA aguas abajo) y, si no hay, en la red
     del mapa (orden >= 4). Las dos redes del INEGI que tenemos cubren solo la cuenca RH18A: las escuelas de
     la Sierra Norte (otra vertiente) quedan fuera hasta bajar su red, no porque no lo necesiten.
  2. Orden: riesgo de CONTAMINACIÓN de la escuela (escuelas.json), porque es el riesgo que estos mecanismos
     atienden. El de derrumbe pide otro mecanismo (pluviómetro, humedad de suelo, inclinómetro) aún no diseñado.
  3. Cuántos: N_MECANISMOS = 5, los mismos que la red anterior (presupuesto, docs/18), a más de SEPARACION_M
     entre sí. Varias escuelas comparten localidad y cauce: las que quedan cerca de un mecanismo ya elegido
     no abren otro, quedan en su lista escuelas_protegidas.

La estación se coloca en el punto del cauce más cercano a la escuela. Su c_sitio es el sitio de CONAGUA
aguas abajo sobre ese cauce (red_asignacion.json); si no lo hay, null, y el motor la compara solo contra su
propia historia reciente. linea_base.json trae solo 5 sitios: cuando el c_sitio no está ahí, el simulador
fabrica el agua con la banda del sitio con línea base más cercano (banda_simulacion), y se dice así.

Autorizaciones (docs/19 §4.3): CEASPUE para instalar en el cauce y CAPCEE para vincularlo al plantel. Se
toma el estado que la escuela ya tenga en escuelas.json; si no tiene, 'pendiente'. Sin CEASPUE otorgada
el mecanismo es 'propuesta'.

Módulo de ladera (docs/20 §3.2): las 5 escuelas de escuelas_ladera.json (las elige 100_escuelas_ladera.py) se
vuelven estaciones EST-LAD- con pluviómetro, humedad de suelo e inclinómetro, en la escuela, sin colector ni c_sitio.

Salidas (DERIVADAS: se edita este script, no los archivos):
    contrato/fixtures/mecanismos.json               las estaciones reubicadas con su escuela y su colector
    datos/procesados/mapa/red_mecanismos.geojson    el tramo de cada estación, para dibujarlo en el mapa

    python -I scripts/99_reubicacion.py
"""
import csv
import importlib.util
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
MAPA = os.path.join(RAIZ, 'datos', 'procesados', 'mapa')
RED = os.path.join(RAIZ, 'datos', 'procesados', 'red')

N_MECANISMOS = 5
RADIO_CAUCE_M = 2500          # la escuela tiene un cauce "cerca" si está a menos de esto en línea recta
SEPARACION_M = 3000           # dos mecanismos más cerca que esto vigilarían lo mismo: uno protege a las dos escuelas
PARAMETROS = ['COND', 'OD', 'PH', 'TEMP', 'TURB']
POSICION_COLECTOR = 'misma orilla, ≈ 10 m aguas arriba de la estación'

_spec = importlib.util.spec_from_file_location('_comun', os.path.join(RAIZ, 'scripts', '_comun.py'))
_comun = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_comun)
metros, lineas, mas_cercano, en_alto_atoyac = _comun.metros, _comun.lineas, _comun.mas_cercano, _comun.en_alto_atoyac


def leer(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def estado_de(escuela, organismo):
    for a in escuela.get('autorizaciones') or []:
        if a['organismo'] == organismo:
            return a['estado'], a['fecha']
    return 'pendiente', None


def inicial(s):
    return ' '.join(w if w.lower() in ('de', 'del', 'la', 'el', 'los', 'las', 'y') else w[:1].upper() + w[1:].lower()
                    for w in (s or '').split())


def main():
    escuelas = leer(os.path.join(FIX, 'escuelas.json'))
    asignacion = leer(os.path.join(RED, 'red_asignacion.json'))
    red = leer(os.path.join(MAPA, 'red_hidrografica.geojson'))
    con_base = sorted({r['c_sitio'] for r in leer(os.path.join(FIX, 'linea_base.json'))['linea_base']})
    with open(os.path.join(RAIZ, 'datos', 'procesados', 'sitio.csv'), encoding='utf-8-sig') as f:
        sitios = {r['c_sitio'].replace(' ', ''): r for r in csv.DictReader(f)}

    t_asig = [(t['p'], t) for t in asignacion['tramos']]
    t_red = [(l, None) for f in red['features'] for l in lineas(f['geometry'])]

    elegibles = []
    for e in escuelas:
        if not en_alto_atoyac(e['latitud'], e['longitud']):
            continue                                   # el proyecto se centra en el Alto Atoyac (_comun.SUBCUENCAS_ALTO_ATOYAC)
        asig = mas_cercano(e['latitud'], e['longitud'], t_asig)
        if asig and asig[0] <= RADIO_CAUCE_M:
            d, punto, tramo, resto, coords = asig
            c_sitio, al_sitio = tramo['s'], round(resto + tramo['d'])
        else:
            gen = mas_cercano(e['latitud'], e['longitud'], t_red)
            if not gen or gen[0] > RADIO_CAUCE_M:
                continue
            d, punto, _, _, coords = gen
            c_sitio, al_sitio = None, None
        elegibles.append((e, d, punto, coords, c_sitio, al_sitio))

    elegibles.sort(key=lambda x: (-x[0]['riesgo']['contaminacion'], x[0]['cct']))
    # Varias escuelas comparten localidad y cauce: un mecanismo las protege a todas. Se eligen en orden de
    # riesgo, saltando las que caen a menos de SEPARACION_M de uno ya elegido (esas quedan protegidas por él).
    elegidos = []
    for x in elegibles:
        cerca = [y for y in elegidos if metros(x[2][1], x[2][0], y[0][2][1], y[0][2][0]) < SEPARACION_M]
        if cerca:
            cerca[0][1].append(x[0]['cct'])
        elif len(elegidos) < N_MECANISMOS:
            elegidos.append((x, [x[0]['cct']]))
    estaciones, tramos = [], []
    for i, ((e, d, punto, coords, c_sitio, al_sitio), protegidas) in enumerate(elegidos, 1):
        lon, lat = round(punto[0], 6), round(punto[1], 6)
        if c_sitio in con_base:
            banda = c_sitio
        else:
            banda = min(con_base, key=lambda s: metros(lat, lon, float(sitios[s]['latitud']), float(sitios[s]['longitud'])))
        # Los rótulos de la toponimia del INEGI están dispersos y fallan en barrancas: el nombre firme es el
        # del cuerpo de agua al que drena, el de su sitio de CONAGUA.
        cuerpo = ('Cauce hacia ' + inicial(sitios[c_sitio]['cuerpo_agua'])) if c_sitio in sitios else 'Cauce sin nombre en el INEGI'
        ceaspue, f_ceaspue = estado_de(e, 'CEASPUE')
        capcee, f_capcee = estado_de(e, 'CAPCEE')
        ce = 'EST-ESC-{:02d}'.format(i)
        estaciones.append({
            'c_estacion': ce,
            'c_sitio': c_sitio,
            'nombre': 'Junto a ' + e['nombre'],
            'cuerpo_agua': cuerpo,
            'municipio': e['municipio'],
            'estado': 'Puebla',
            'latitud': lat,
            'longitud': lon,
            'parametros': PARAMETROS,
            'estado_dispositivo': 'Activo',
            'cct': e['cct'],
            'escuela': e['nombre'],
            'localidad': e['localidad'],
            'escuelas_protegidas': protegidas,
            'distancia_escuela_m': round(d),
            'distancia_al_sitio_m': al_sitio,
            'banda_simulacion': banda,
            'instalacion': 'autorizada' if ceaspue == 'otorgada' else 'propuesta',
            'autorizaciones': [
                {'organismo': 'CEASPUE', 'tramite': 'instalacion_en_cauce', 'estado': ceaspue, 'fecha': f_ceaspue},
                {'organismo': 'CAPCEE', 'tramite': 'vinculacion_con_plantel', 'estado': capcee, 'fecha': f_capcee},
            ],
            'colector': {'c_colector': 'COL-ESC-{:02d}'.format(i), 'posicion': POSICION_COLECTOR},
        })
        tramos.append({'type': 'Feature', 'properties': {'c_estacion': ce, 'conexion': True},
                       'geometry': {'type': 'LineString', 'coordinates': [[round(x, 6), round(y, 6)] for x, y in coords]}})

    # ---- Módulo de ladera (docs/20 §3.2). Las escuelas y sus sensores los elige 100_escuelas_ladera.py; aquí solo
    # se convierten en estaciones con la forma de las demás. Sin cauce: sin colector, sin c_sitio y sin banda.
    # Si la escuela ya tiene estación de agua, sus sensores de ladera se suman a esa estación.
    ruta_ladera = os.path.join(FIX, 'escuelas_ladera.json')
    ladera = leer(ruta_ladera)['modulos'] if os.path.exists(ruta_ladera) else []
    por_cct = {e['cct']: e for e in escuelas}
    for m in ladera:
        e = por_cct.get(m['cct'], {})
        # el cauce que socava su ladera (docs/20, criterio de 100_escuelas_ladera.py): nombre por su sitio CONAGUA
        a = mas_cercano(m['latitud'], m['longitud'], t_asig)
        b = mas_cercano(m['latitud'], m['longitud'], t_red)
        cauce = min((x for x in (a, b) if x), key=lambda x: x[0])
        sitio_c = cauce[2]['s'] if cauce[2] else None
        nombre_c = ('Cauce hacia ' + inicial(sitios[sitio_c]['cuerpo_agua'])) if sitio_c in sitios else 'Cauce sin nombre en el INEGI'
        capcee, f_capcee = estado_de(e, 'CAPCEE')
        existente = next((x for x in estaciones if x['c_estacion'] == m.get('estacion_de_agua_existente')), None)
        if existente:
            existente['parametros'] += [p for p in m['parametros'] if p not in existente['parametros']]
            existente['escuelas_protegidas'] += [c for c in m['escuelas_protegidas'] if c not in existente['escuelas_protegidas']]
            continue
        estaciones.append({
            'c_estacion': m['c_estacion'],
            'c_sitio': None,
            'nombre': 'Ladera de ' + m['localidad'],
            'cuerpo_agua': nombre_c,
            'municipio': m['municipio'],
            'estado': 'Puebla',
            'latitud': m['latitud'],
            'longitud': m['longitud'],
            'parametros': m['parametros'],
            'estado_dispositivo': 'Activo',
            'cct': m['cct'],
            'escuela': m['escuela'],
            'localidad': m['localidad'],
            'escuelas_protegidas': m['escuelas_protegidas'],
            'distancia_escuela_m': 0,
            'distancia_cauce_m': round(cauce[0]),
            'distancia_al_sitio_m': None,
            'banda_simulacion': None,
            # Sin fuente de agua no hace falta CEASPUE: basta el plantel (CAPCEE).
            'instalacion': 'autorizada' if capcee == 'otorgada' else 'propuesta',
            'autorizaciones': [
                {'organismo': 'CAPCEE', 'tramite': 'vinculacion_con_plantel', 'estado': capcee, 'fecha': f_capcee},
            ],
            'colector': None,
        })

    salida = {
        'version': '2.0-propuesta',
        '_provisional': True,
        'criterio': ('EST-ESC: escuelas de escuelas.json con un cauce a menos de {} m, ordenadas por riesgo de contaminacion; '
                     'las {} primeras a mas de {} m entre si. EST-LAD: modulo de ladera de las escuelas de escuelas_ladera.json '
                     '(docs/20). Generado por scripts/99_reubicacion.py.').format(RADIO_CAUCE_M, N_MECANISMOS, SEPARACION_M),
        'estaciones': estaciones,
    }
    with open(os.path.join(FIX, 'mecanismos.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
        f.write('\n')
    with open(os.path.join(MAPA, 'red_mecanismos.geojson'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'type': 'FeatureCollection', 'features': tramos}, f, ensure_ascii=False, separators=(',', ':'))

    print('{} escuelas, {} con cauce a menos de {} m; {} mecanismos de agua y {} de ladera'.format(
        len(escuelas), len(elegibles), RADIO_CAUCE_M, sum(1 for x in estaciones if x.get('colector')),
        sum(1 for x in estaciones if not x.get('colector'))))
    for e in [x for x in estaciones if x.get('colector')]:
        print('  {} {:<24} {:<14} {:<26} cauce {:>5} m  {} escuelas  sitio {:<12} banda {:<10} {}'.format(
            e['c_estacion'], e['localidad'][:24], e['municipio'][:14], e['cuerpo_agua'][:26], e['distancia_escuela_m'],
            len(e['escuelas_protegidas']), e['c_sitio'] or '-', e['banda_simulacion'], e['instalacion']))
    for e in [x for x in estaciones if not x.get('colector')]:
        print('  {} {:<24} {:<14} ladera: {}  {}'.format(e['c_estacion'], e['localidad'][:24], e['municipio'][:14],
                                                         ', '.join(e['parametros']), e['instalacion']))
    protegidas = sum(len(e['escuelas_protegidas']) for e in estaciones if e.get('colector'))
    print('  {} escuelas protegidas; {} elegibles sin mecanismo; {} fuera del Alto Atoyac o sin cauce a menos de 2.5 km'.format(
        protegidas, len(elegibles) - protegidas, len(escuelas) - len(elegibles)))


if __name__ == '__main__':
    main()

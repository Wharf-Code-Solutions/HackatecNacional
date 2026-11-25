# -*- coding: utf-8 -*-
"""Huella de calor y prioridad de los reportes ciudadanos.

Dos preguntas distintas con dos salidas distintas:

  huella(reportes)                    QUE esta pasando y DONDE: el propio rio coloreado segun la densidad
                                      de reportes. Es publica y solo pinta donde hay evidencia suficiente.
  prioridades(reportes, alertas)      QUE atender primero: un puntaje de 1 a 10 con su desglose, para la
                                      autoridad. Cruza reportes con las alertas del motor, la topologia
                                      (M1), las ventanas de llegada (M3) y los establecimientos del DENUE.

Por que no es la formula de SIGRIV (base + (reportes - 1) + entorno): contar reportes de forma lineal se
infla con spam (aqui no hay cuentas), una distancia en linea recta mezcla barrancas que no se comunican, y
lo que distingue a este proyecto -sensores, aguas arriba y aguas abajo, fuentes probables- no cabia.

Todos los pesos son HIPOTESIS de diseno, sin reportes reales con que calibrarlos: viven aqui, arriba,
como datos, para ajustarlos sin tocar la logica. El desglose de cada prioridad sale completo para poder
defender el numero (invariante I12).

Aproximacion que se declara: la red publicada para asignar (red_asignacion.json) trae, por tramo, el sitio
que queda aguas abajo y los metros hasta el, pero no los enlaces entre tramos. La distancia "sobre el cauce"
entre un foco y un tramo se aproxima con la diferencia de esos metros, y solo se mezclan tramos que drenan
al mismo sitio y quedan cerca en linea recta. Dos afluentes con la misma diferencia pueden aparecer algo
mas cerca de lo que estan; el factor de cercania en linea recta lo limita.

Solo biblioteca estandar. Lo cargan el mock y el backend; ninguno importa al otro.
"""
import csv
import json
import math
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RED = os.path.join(RAIZ, 'datos', 'procesados', 'red')
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')

# ----------------------------------------------------------------- pesos (hipotesis ajustables)
GRAVEDAD = {'peces_muertos': 5, 'descarga_visible': 4, 'color_anormal': 3, 'espuma': 3,
            'basura_o_residuos': 2, 'mal_olor': 2, 'otro': 2,
            'deslave': 4}       # deslave: hipotesis, a la par de una descarga (pone en riesgo a una escuela)
FOCO_RADIO_M = 150            # mismo tipo a menos de esto y de FOCO_HORAS: es el mismo foco
FOCO_HORAS = 24
ZONA_RADIO_M = 1500           # focos del mismo sitio a menos de esto forman una zona de calor
SEMIVIDA_H = 72               # un reporte pierde la mitad de su peso cada 72 h
UMBRAL_ZONA = 2.5             # suma de pesos minima para pintar calor: 3 focos distintos, o 3 reportes del mismo tipo (1 + log2 3 = 2.58)
MIN_REPORTES_ZONA = 3
SIGMA_ARRIBA_M = 500          # el calor llega poco aguas arriba del foco...
SIGMA_ABAJO_M = 1500          # ...y mas lejos aguas abajo, que es hacia donde viaja
SIGMA_LATERAL_M = 600         # cercania en linea recta al foco
MAX_LATERAL_M = 2500
ALCANCE_ABAJO_M = 4500        # hasta donde se sigue el calor aguas abajo (3 sigmas)
INTENSIDAD_TOPE = 6.0         # suma de pesos que se pinta como intensidad 1
# Deslaves: no viven en un cauce, asi que su calor es una mancha sobre el terreno (puntos que la app dibuja como mapa
# de calor), no el rio coloreado. Mismos umbrales que el agua: con menos de 3 reportes una persona sola pintaria.
TIPOS_LADERA = ('deslave',)
ZONA_LADERA_RADIO_M = 1500    # focos de deslave a menos de esto forman una zona (una ladera, un mismo cerro)
INTENSIDAD_MIN = 0.05
TOPE_CIUDADANA = 2.0          # tope del aporte de corroboracion ciudadana (log2 de reportes)
BONO_SENSOR_MISMO_SITIO = 3
BONO_SENSOR_AGUAS_ABAJO = 2
VENTANA_SENSOR_H = 24         # alerta y reporte a menos de esto, para el mismo sitio
MISMO_PUNTO_CAUCE_M = 1000    # dos sitios a menos de esto sobre el cauce cuentan como el mismo punto: un reporte
                              # junto a una estacion se asigna al sitio siguiente aguas abajo (DLTLA2554 -> DLTLA0279RNL, 167 m)
MARGEN_LLEGADA_ANTES_H = 2    # tolerancia alrededor de la ventana de llegada de M3
MARGEN_LLEGADA_DESPUES_H = 12
BONO_FUENTE = 1
FUENTE_MAX_M = 5000
CALIDAD = {'foto_validada': 1.0, 'foto_sin_validar': 0.9, 'sin_foto': 0.8}
CALIDAD_GPS_MALO = 0.9        # precision de GPS peor que GPS_MALO_M
GPS_MALO_M = 100
ESTADOS_ABIERTOS_ALERTA = ('Abierta', 'En atencion')
ESTADOS_CERRADOS_REPORTE = ('Cerrado', 'Descartado')
BANDAS = ((7, 'Alta'), (4, 'Media'), (0, 'Baja'))
# Tipos para los que un establecimiento del DENUE aguas arriba es una pista plausible
FUENTE_POR_TIPO = {'descarga_visible': ('industrial', 'organica'), 'color_anormal': ('industrial',),
                   'espuma': ('industrial', 'organica'), 'peces_muertos': ('industrial', 'organica'),
                   'mal_olor': ('organica',)}

LAT0 = 19.1
M_LAT = 110574.0
M_LON = 111320.0 * math.cos(math.radians(LAT0))
CELDA = 0.01

_cache = {}


def _xy(lon, lat):
    return lon * M_LON, lat * M_LAT


def _ahora():
    return datetime.now(timezone.utc)


def _fecha(txt):
    try:
        d = datetime.fromisoformat(str(txt).replace('Z', '+00:00'))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


# ----------------------------------------------------------------- datos (se cargan una vez)
def _red():
    if 'red' in _cache:
        return _cache['red']
    ruta = os.path.join(RED, 'red_asignacion.json')
    tramos, rejilla, por_sitio = {}, defaultdict(list), defaultdict(list)
    if os.path.exists(ruta):
        with open(ruta, encoding='utf-8') as f:
            for t in json.load(f)['tramos']:
                t['xy'] = [_xy(p[0], p[1]) for p in t['p']]
                tramos[t['t']] = t
                por_sitio[t['s']].append(t['t'])
                for a, b in zip(t['p'], t['p'][1:]):
                    for cx in range(int(min(a[0], b[0]) / CELDA), int(max(a[0], b[0]) / CELDA) + 1):
                        for cy in range(int(min(a[1], b[1]) / CELDA), int(max(a[1], b[1]) / CELDA) + 1):
                            rejilla[(cx, cy)].append(t['t'])
    _cache['red'] = (tramos, rejilla, por_sitio)
    return _cache['red']


def _viaje():
    """{(c_sitio_arriba, c_sitio_abajo): (horas_min, horas_max, metros_sobre_el_cauce)} de tiempo_viaje.csv (M3)."""
    if 'viaje' not in _cache:
        d = {}
        ruta = os.path.join(RED, 'tiempo_viaje.csv')
        if os.path.exists(ruta):
            with open(ruta, encoding='utf-8-sig') as f:
                for r in csv.DictReader(f):
                    d[(r['c_sitio_arriba'], r['c_sitio_abajo'])] = (float(r['horas_min']), float(r['horas_max']), float(r['distancia_cauce_m']))
        _cache['viaje'] = d
    return _cache['viaje']


def _candidatos():
    if 'cand' not in _cache:
        ruta = os.path.join(FIX, 'candidatos_denue.json')
        d = {}
        if os.path.exists(ruta):
            with open(ruta, encoding='utf-8') as f:
                d = json.load(f).get('sitios', {})
        _cache['cand'] = d
    return _cache['cand']


def _dist_segmento(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy
    u = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / l2))
    return math.hypot(px - (a[0] + u * dx), py - (a[1] + u * dy))


def _dist_tramo(px, py, t):
    pts = t['xy']
    if len(pts) == 1:
        return math.hypot(px - pts[0][0], py - pts[0][1])
    return min(_dist_segmento(px, py, pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def enganchar(lat, lon, tolerancia_m=1500.0):
    """Tramo, sitio aguas abajo y metros hasta el sitio para un punto; None si no hay cauce cerca."""
    tramos, rejilla, _ = _red()
    if not tramos:
        return None
    px, py = _xy(lon, lat)
    cx, cy = int(lon / CELDA), int(lat / CELDA)
    mejor, dmin = None, tolerancia_m
    for ax in range(cx - 2, cx + 3):
        for ay in range(cy - 2, cy + 3):
            for c in rejilla.get((ax, ay), ()):
                d = _dist_tramo(px, py, tramos[c])
                if d < dmin:
                    mejor, dmin = c, d
    if mejor is None:
        return None
    t = tramos[mejor]
    return {'c_tramo': mejor, 'c_sitio': t['s'], 'd_sitio_m': t['d'], 'distancia_al_cauce_m': round(dmin, 0)}


# ----------------------------------------------------------------- focos
def _peso_tiempo(horas):
    return 0.5 ** (max(0.0, horas) / SEMIVIDA_H)


def _factor_calidad(r):
    if not r.get('foto_url'):
        f = CALIDAD['sin_foto']
    else:
        ca = r.get('clasificacion_automatica') or {}
        f = CALIDAD['foto_validada'] if ca.get('etiqueta') in GRAVEDAD and ca.get('confianza', 0) >= 0.6 else CALIDAD['foto_sin_validar']
    p = r.get('precision_ubicacion_m')
    if p is not None and p > GPS_MALO_M:
        f *= CALIDAD_GPS_MALO
    return f


def focos(reportes, ahora=None):
    """Agrupa los reportes abiertos: mismo tipo, a menos de FOCO_RADIO_M y FOCO_HORAS entre si.
    Cada foco lleva el enganche a la red, su peso (1 + log2 n) y su calidad."""
    ahora = ahora or _ahora()
    utiles = []
    for r in reportes:
        if r.get('estado') in ESTADOS_CERRADOS_REPORTE or r.get('latitud') is None or r.get('longitud') is None:
            continue
        f = _fecha(r.get('fecha_hora'))
        if f is None:
            continue
        utiles.append((f, r))
    utiles.sort(key=lambda p: p[0])
    grupos = []
    for f, r in utiles:
        x, y = _xy(r['longitud'], r['latitud'])
        for g in grupos:
            if g['tipo'] == r['tipo'] and abs((f - g['ultima']).total_seconds()) / 3600 <= FOCO_HORAS \
                    and math.hypot(x - g['x'], y - g['y']) <= FOCO_RADIO_M:
                g['reportes'].append(r)
                g['ultima'] = max(g['ultima'], f)
                break
        else:
            grupos.append({'tipo': r['tipo'], 'x': x, 'y': y, 'lat': r['latitud'], 'lon': r['longitud'],
                           'reportes': [r], 'ultima': f})
    for g in grupos:
        n = len(g['reportes'])
        g['n'] = n
        g['peso'] = (1 + math.log2(n)) * _peso_tiempo((ahora - g['ultima']).total_seconds() / 3600)
        g['calidad'] = max(_factor_calidad(r) for r in g['reportes'])
        g['enganche'] = enganchar(g['lat'], g['lon'])
    return grupos


def zonas(grupos):
    """Une focos del mismo sitio a menos de ZONA_RADIO_M. Una zona esta activa (pinta calor) si suma
    UMBRAL_ZONA de peso y MIN_REPORTES_ZONA reportes: con menos, una sola persona dibujaria una huella."""
    con_cauce = [g for g in grupos if g['enganche']]
    padre = list(range(len(con_cauce)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    for i, a in enumerate(con_cauce):
        for j in range(i + 1, len(con_cauce)):
            b = con_cauce[j]
            if a['enganche']['c_sitio'] == b['enganche']['c_sitio'] and math.hypot(a['x'] - b['x'], a['y'] - b['y']) <= ZONA_RADIO_M:
                padre[raiz(i)] = raiz(j)
    por_raiz = defaultdict(list)
    for i, g in enumerate(con_cauce):
        por_raiz[raiz(i)].append(g)
    salida = []
    for miembros in por_raiz.values():
        peso = sum(g['peso'] for g in miembros)
        n = sum(g['n'] for g in miembros)
        salida.append({'focos': miembros, 'peso': peso, 'n_reportes': n,
                       'activa': peso >= UMBRAL_ZONA and n >= MIN_REPORTES_ZONA,
                       'ultima': max(g['ultima'] for g in miembros),
                       'c_sitio': miembros[0]['enganche']['c_sitio']})
        for g in miembros:
            g['zona_activa'] = salida[-1]['activa']
    return salida


# ----------------------------------------------------------------- huella
def zonas_ladera(grupos):
    """Une focos de deslave a menos de ZONA_LADERA_RADIO_M, sin depender del cauce. Activa con los mismos
    umbrales que una zona del rio."""
    lad = [g for g in grupos if g['tipo'] in TIPOS_LADERA]
    padre = list(range(len(lad)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    for i, a in enumerate(lad):
        for j in range(i + 1, len(lad)):
            b = lad[j]
            if math.hypot(a['x'] - b['x'], a['y'] - b['y']) <= ZONA_LADERA_RADIO_M:
                padre[raiz(i)] = raiz(j)
    por_raiz = defaultdict(list)
    for i, g in enumerate(lad):
        por_raiz[raiz(i)].append(g)
    salida = []
    for miembros in por_raiz.values():
        peso = sum(g['peso'] for g in miembros)
        n = sum(g['n'] for g in miembros)
        salida.append({'focos': miembros, 'peso': peso, 'n_reportes': n,
                       'activa': peso >= UMBRAL_ZONA and n >= MIN_REPORTES_ZONA,
                       'ultima': max(g['ultima'] for g in miembros)})
    return salida


def huella(reportes, ahora=None):
    """GeoJSON de dos capas. Agua: los tramos del rio con su intensidad (0 a 1), con el trazo de la red.
    Ladera: un punto por foco de deslave con su intensidad, que la app dibuja como mancha de calor; lleva
    'capa': 'ladera'. Solo zonas activas en las dos."""
    tramos, _, por_sitio = _red()
    viaje = _viaje()
    grupos = focos(reportes, ahora)
    # Los deslaves no colorean el rio: van a su propia capa
    zs = zonas([g for g in grupos if g['tipo'] not in TIPOS_LADERA])
    activas = [z for z in zs if z['activa']]
    crudo = defaultdict(float)
    for z in activas:
        for g in z['focos']:
            e = g['enganche']
            # Tramos que drenan al mismo sitio que el foco, y los que drenan a sitios aguas abajo dentro del
            # alcance del calor: el calor viaja con el agua y no se corta en la estacion.
            candidatos = [(c, 0.0) for c in por_sitio.get(e['c_sitio'], ())]
            for (arriba, abajo), (_, _, dist) in viaje.items():
                if arriba == e['c_sitio'] and dist <= ALCANCE_ABAJO_M:
                    candidatos += [(c, dist) for c in por_sitio.get(abajo, ())]
            for c, dist_sitio in candidatos:
                t = tramos[c]
                lateral = _dist_tramo(g['x'], g['y'], t)
                if lateral > MAX_LATERAL_M:
                    continue
                # metros a lo largo del cauce: > 0 aguas arriba del foco, < 0 aguas abajo
                a_lo_largo = (t['d'] - dist_sitio) - e['d_sitio_m']
                if a_lo_largo < -ALCANCE_ABAJO_M:
                    continue
                sigma = SIGMA_ARRIBA_M if a_lo_largo > 0 else SIGMA_ABAJO_M
                k = math.exp(-0.5 * (a_lo_largo / sigma) ** 2) * math.exp(-0.5 * (lateral / SIGMA_LATERAL_M) ** 2)
                crudo[c] += g['peso'] * k
    feats = []
    for c, v in crudo.items():
        inten = min(1.0, v / INTENSIDAD_TOPE)
        if inten >= INTENSIDAD_MIN:
            feats.append({'type': 'Feature',
                          'geometry': {'type': 'LineString', 'coordinates': tramos[c]['p']},
                          'properties': {'c_tramo': c, 'intensidad': round(inten, 3)}})
    feats.sort(key=lambda f: f['properties']['intensidad'])
    laderas = [z for z in zonas_ladera(grupos) if z['activa']]
    for z in laderas:
        for g in z['focos']:
            feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [g['lon'], g['lat']]},
                          'properties': {'capa': 'ladera', 'intensidad': round(min(1.0, g['peso'] / UMBRAL_ZONA), 3)}})
    return {'type': 'FeatureCollection', 'features': feats,
            'metadatos': {'version': '1.0', 'generado': (ahora or _ahora()).isoformat(timespec='seconds'),
                          'n_reportes_abiertos': sum(g['n'] for g in grupos),
                          'zonas_activas': [{'c_sitio': z['c_sitio'], 'n_reportes': z['n_reportes'],
                                             'ultimo_reporte': z['ultima'].isoformat(timespec='seconds')} for z in activas],
                          'zonas_ladera_activas': [{'n_reportes': z['n_reportes'],
                                                    'ultimo_reporte': z['ultima'].isoformat(timespec='seconds')} for z in laderas],
                          'umbral': {'peso': UMBRAL_ZONA, 'reportes': MIN_REPORTES_ZONA}, 'semivida_h': SEMIVIDA_H}}


# ----------------------------------------------------------------- prioridad
def _bono_sensor(c_sitio, ultima, alertas):
    """+3 si hay una alerta abierta en el mismo sitio (o a menos de MISMO_PUNTO_CAUCE_M sobre el cauce) y a
    menos de 24 h; +2 si la hay en una estacion aguas
    abajo y su hora cae dentro de la ventana de llegada de M3 (con margen). Devuelve (bono, motivo)."""
    mejor, motivo = 0, None
    viaje = _viaje()
    for a in alertas:
        if a.get('estado') not in ESTADOS_ABIERTOS_ALERTA:
            continue
        fa = _fecha(a.get('fecha_hora'))
        if fa is None:
            continue
        dh = (fa - ultima).total_seconds() / 3600
        sa = a.get('c_sitio')
        cerca = sa == c_sitio or any(
            par in viaje and viaje[par][2] <= MISMO_PUNTO_CAUCE_M for par in ((c_sitio, sa), (sa, c_sitio)))
        if cerca and abs(dh) <= VENTANA_SENSOR_H and BONO_SENSOR_MISMO_SITIO > mejor:
            mejor, motivo = BONO_SENSOR_MISMO_SITIO, 'alerta {} en el mismo punto del cauce, a {:.0f} h del reporte'.format(a.get('c_alerta'), abs(dh))
        elif (c_sitio, a.get('c_sitio')) in viaje and BONO_SENSOR_AGUAS_ABAJO > mejor:
            hmin, hmax, _ = viaje[(c_sitio, a['c_sitio'])]
            if hmin - MARGEN_LLEGADA_ANTES_H <= dh <= hmax + MARGEN_LLEGADA_DESPUES_H:
                mejor, motivo = BONO_SENSOR_AGUAS_ABAJO, 'alerta {} aguas abajo, dentro de la ventana de llegada ({:.1f} a {:.1f} h)'.format(a.get('c_alerta'), hmin, hmax)
    return mejor, motivo


def _bono_fuente(c_sitio, tipo):
    tipos = FUENTE_POR_TIPO.get(tipo)
    if not tipos:
        return 0, None
    cands = _candidatos().get(c_sitio, {})
    cerca = [(c['distancia_m'], c['nombre'], c['giro']) for t in tipos for c in cands.get(t, []) if c.get('distancia_m', 1e9) <= FUENTE_MAX_M]
    if not cerca:
        return 0, None
    d, nombre, giro = min(cerca)
    return BONO_FUENTE, '{} ({}), a {:.1f} km aguas arriba'.format(nombre, giro, d / 1000.0)


def prioridades(reportes, alertas, ahora=None):
    grupos = focos(reportes, ahora)
    zonas(grupos)
    items = []
    for g in grupos:
        e = g['enganche']
        base = GRAVEDAD.get(g['tipo'], 2)
        ciud = min(TOPE_CIUDADANA, math.log2(g['n']))
        sensor, m_sensor, fuente, m_fuente = 0, None, 0, None
        if e:
            sensor, m_sensor = _bono_sensor(e['c_sitio'], g['ultima'], alertas)
            fuente, m_fuente = _bono_fuente(e['c_sitio'], g['tipo'])
        bruto = g['calidad'] * (base + ciud) + sensor + fuente
        p = max(1, min(10, int(round(bruto))))
        banda = next(b for corte, b in BANDAS if p >= corte)
        ids = [r.get('c_reporte') for r in g['reportes']]
        items.append({
            'c_foco': 'F-' + str(ids[0]), 'tipo': g['tipo'], 'n_reportes': g['n'], 'c_reportes': ids,
            'latitud': round(g['lat'], 3), 'longitud': round(g['lon'], 3),     # redondeadas a ~100 m
            'c_sitio': e['c_sitio'] if e else None,
            'distancia_al_cauce_m': e['distancia_al_cauce_m'] if e else None,
            'ultimo_reporte': g['ultima'].isoformat(timespec='seconds'),
            'prioridad': p, 'banda': banda, 'zona_de_calor': bool(g.get('zona_activa')),
            'desglose': {'gravedad_del_tipo': base, 'corroboracion_ciudadana': round(ciud, 2),
                         'factor_de_calidad': round(g['calidad'], 2),
                         'sensor': sensor, 'sensor_motivo': m_sensor,
                         'fuente_probable': fuente, 'fuente_motivo': m_fuente,
                         'sin_cauce_cerca': e is None},
        })
    items.sort(key=lambda i: (-i['prioridad'], i['ultimo_reporte']))   # mas alta primero; a igualdad, la mas antigua
    return {'version': '1.0', 'generado': (ahora or _ahora()).isoformat(timespec='seconds'), 'prioridades': items}

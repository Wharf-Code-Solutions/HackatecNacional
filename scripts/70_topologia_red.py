# -*- coding: utf-8 -*-
"""M1: topologia de la red hidrografica.

Responde, para cada uno de los sitios de monitoreo, cual es el siguiente sitio
aguas abajo y a que distancia sobre el cauce. Es la entrada de tres cosas: el
modelo de propagacion (M3), la vista de "que fuentes hay aguas arriba de este
punto" (M7) y la asignacion de un reporte ciudadano al tramo correcto (M8).

Lee    : datos/geo/F08_red_hidrografica/  y  datos/procesados/sitio.csv
Escribe: datos/procesados/red/*.csv  y  docs/13-topologia-red.md

No usa dependencias externas: reutiliza el lector de shapefile y dbf de
scripts/60_red_para_mapa.py.

Uso: python -I scripts/70_topologia_red.py
"""
import csv
import importlib.util
import math
import os
import sys
from collections import defaultdict, deque

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AQUI = os.path.dirname(os.path.abspath(__file__))
GEO = os.path.join(RAIZ, 'datos', 'geo', 'F08_red_hidrografica', 'RH18', 'RH18A')
PROC = os.path.join(RAIZ, 'datos', 'procesados')
SALIDA = os.path.join(PROC, 'red')

# ------------------------------------------------------------------ parametros
# Metrica local: a la latitud de la cuenca (~19.1 N) basta una proyeccion plana.
# El error frente a una geodesica es muy inferior a la tolerancia de enganche.
LAT0 = 19.1
M_POR_GRADO_LAT = 110574.0
M_POR_GRADO_LON = 111320.0 * math.cos(math.radians(LAT0))

# Tolerancia de enganche de un sitio al cauce. La red 1:50 000 tiene precision
# del orden de decenas de metros y el GPS de un sitio de muestreo, de ~10 m.
ENGANCHE_BUENO = 150.0
ENGANCHE_DUDOSO = 500.0

# Dos extremos de tramo se consideran el mismo nodo si estan a menos de esto.
TOL_NODO_M = 2.0
# Distancia maxima para unir la salida de una subcuenca con la red de la vecina.
TOL_COSTURA_M = 500.0

# Rejilla espacial para no comparar cada sitio contra todos los segmentos.
CELDA_GRADOS = 0.01

# ------------------------------------------------------- lector del compañero
_spec = importlib.util.spec_from_file_location(
    'r60', os.path.join(AQUI, '60_red_para_mapa.py'))
r60 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(r60)
leer_shp, leer_dbf = r60.leer_shp, r60.leer_dbf

informe = []


def di(s=''):
    print(s)
    informe.append(s)


def metros(a, b):
    """Distancia aproximada en metros entre dos (lon, lat)."""
    dx = (a[0] - b[0]) * M_POR_GRADO_LON
    dy = (a[1] - b[1]) * M_POR_GRADO_LAT
    return math.hypot(dx, dy)


def numero(txt, defecto=0.0):
    try:
        return float(str(txt).strip())
    except (TypeError, ValueError):
        return defecto


# =========================================================== 1. cargar la red
di('# Topologia de la red hidrografica (M1)')
di()
di('Generado por `scripts/70_topologia_red.py`.')
di()
di('## 1. Red cargada')
di()

if not os.path.isdir(GEO):
    print('\nFALTA la red hidrografica en {}.'.format(GEO))
    print('Bajala con: python -I scripts/00_descargar_fuentes.py F08')
    sys.exit(2)

tramos = {}            # c_tramo -> dict
subcuencas = sorted(d for d in os.listdir(GEO)
                    if os.path.isdir(os.path.join(GEO, d)))
salidas_subc = {}      # subcuenca -> (lon, lat) del punto de drenaje

for subc in subcuencas:
    base = os.path.join(GEO, subc, subc)
    _, geos = leer_shp(base + '_hl.shp')
    atrs = leer_dbf(base + '_hl.dbf')
    n = 0
    for g, a in zip(geos, atrs):
        if not g:
            continue
        pts = g[0]
        if len(pts) < 2:
            continue
        clave = '{}-{}'.format(subc, a['ID'])
        tramos[clave] = {
            'c_tramo': clave, 'subcuenca': subc, 'pts': pts,
            'orden': int(numero(a.get('ORDER_1'), 0)),
            'arbsum': numero(a.get('ARBSUM_1'), 0),
            'pathl': numero(a.get('PATHL_1'), 0),
            'longitud_m': numero(a.get('LENGTHM'), 0),
            'condicion': a.get('CONDICION', ''),
            'entidad': a.get('ENTIDAD', ''),
            'flowdir': a.get('FLOWDIR', ''),
        }
        n += 1
    # punto de drenaje de la subcuenca
    try:
        tipo, dr = leer_shp(base + '_dr.shp')
        if dr and dr[0]:
            salidas_subc[subc] = tuple(dr[0]) if tipo == 1 else tuple(dr[0][0][0])
    except (OSError, IndexError, TypeError):
        pass
    di('- `{}`: {:,} tramos{}'.format(
        subc, n, '' if subc in salidas_subc else ' (sin punto de drenaje)'))

di()
di('Total: **{:,} tramos** en {} subcuencas. La longitud la trae el propio '
   'INEGI en el campo `LENGTHM`, asi que no se recalcula.'.format(
       len(tramos), len(subcuencas)))
di()
ordenes = defaultdict(int)
for t in tramos.values():
    ordenes[t['orden']] += 1
di('Reparto por orden de Strahler: ' +
   ', '.join('orden {}: {:,}'.format(k, v) for k, v in sorted(ordenes.items())) + '.')
di()
di('> Se usan **todos** los tramos, incluidos los de orden 1 a 3. '
   '`60_red_para_mapa.py` filtra a orden 4 o mas para que el mapa no se '
   'arrastre, pero muchas barrancas urbanas son de orden bajo y son justo los '
   'puntos mas contaminados de la cuenca.')
di()

# ==================================================== 2. nodos y conectividad
di('## 2. Grafo de la red')
di()

# Un nodo es un extremo de tramo. Se agrupan los extremos coincidentes
# redondeando a una rejilla del tamano de la tolerancia.
GRADOS_TOL = TOL_NODO_M / M_POR_GRADO_LAT


def clave_nodo(p):
    return (round(p[0] / GRADOS_TOL), round(p[1] / GRADOS_TOL))


nodo_de = {}           # clave -> id de nodo
coord_nodo = {}        # id de nodo -> (lon, lat)
incidentes = defaultdict(list)   # id de nodo -> [(c_tramo, 'ini'|'fin')]

for t in tramos.values():
    for extremo, p in (('ini', t['pts'][0]), ('fin', t['pts'][-1])):
        k = clave_nodo(p)
        if k not in nodo_de:
            nodo_de[k] = len(nodo_de)
            coord_nodo[nodo_de[k]] = p
        t['nodo_' + extremo] = nodo_de[k]
        incidentes[nodo_de[k]].append((t['c_tramo'], extremo))

di('- {:,} nodos distintos, uniendo extremos a menos de {:.0f} m.'.format(
    len(nodo_de), TOL_NODO_M))
sueltos = sum(1 for n, lst in incidentes.items() if len(lst) == 1)
di('- {:,} nodos con un solo tramo (cabeceras y salidas).'.format(sueltos))
di()

# ------------------------------------------------- orientar hacia la salida
# No se confia en FLOWDIR: se enraiza cada subcuenca en su punto de drenaje y
# se orienta cada tramo hacia la raiz. Despues se valida contra ARBSUM_1 y
# PATHL_1, que el INEGI calcula de forma independiente.
por_subc = defaultdict(list)
for t in tramos.values():
    por_subc[t['subcuenca']].append(t)

orientados = 0
n_componentes = 0
for subc, lista in sorted(por_subc.items()):
    vecinos = defaultdict(list)
    for t in lista:
        vecinos[t['nodo_ini']].append(t['c_tramo'])
        vecinos[t['nodo_fin']].append(t['c_tramo'])

    # El producto del INEGI trae, junto a la red principal de cada subcuenca,
    # fragmentos sueltos de unas pocas decenas de tramos. Hay que orientar cada
    # componente por separado: enraizar toda la subcuenca en el nodo mas cercano
    # al punto de drenaje hace que la raiz caiga en un fragmento y deja sin
    # orientar el 99 % de la red. Esto paso de verdad en 4 de las 10 subcuencas.
    comp_de = {}
    componentes = []
    for t0 in lista:
        if t0['c_tramo'] in comp_de:
            continue
        idc = len(componentes)
        comp_de[t0['c_tramo']] = idc
        miembros, cola = [], deque([t0['c_tramo']])
        while cola:
            ct = cola.popleft()
            miembros.append(ct)
            t = tramos[ct]
            for nodo in (t['nodo_ini'], t['nodo_fin']):
                for ct2 in vecinos[nodo]:
                    if ct2 not in comp_de:
                        comp_de[ct2] = idc
                        cola.append(ct2)
        componentes.append(miembros)
    n_componentes += len(componentes)

    p_dr = salidas_subc.get(subc)
    for miembros in componentes:
        claves = set(miembros)
        # La salida de un componente es un nodo de grado 1. Entre todos los de
        # grado 1 se toma el del tramo con mayor ARBSUM_1, que es el que
        # acumula mas red aguas arriba: ese es el desague.
        grados = defaultdict(int)
        for ct in miembros:
            grados[tramos[ct]['nodo_ini']] += 1
            grados[tramos[ct]['nodo_fin']] += 1
        cand = [(tramos[ct]['arbsum'], nodo)
                for ct in miembros
                for nodo in (tramos[ct]['nodo_ini'], tramos[ct]['nodo_fin'])
                if grados[nodo] == 1]
        if cand:
            raiz = max(cand)[1]
        elif p_dr:
            raiz = min((metros(coord_nodo[n], p_dr), n) for ct in miembros
                       for n in (tramos[ct]['nodo_ini'], tramos[ct]['nodo_fin']))[1]
        else:
            raiz = tramos[miembros[0]]['nodo_fin']

        visto = {raiz}
        cola = deque([raiz])
        while cola:
            nodo = cola.popleft()
            for ct in vecinos[nodo]:
                if ct not in claves:
                    continue
                t = tramos[ct]
                if t.get('orientado'):
                    continue
                # el extremo que toca el nodo ya visitado es el de aguas abajo
                if t['nodo_fin'] == nodo:
                    otro = t['nodo_ini']
                elif t['nodo_ini'] == nodo:
                    t['pts'] = t['pts'][::-1]
                    t['nodo_ini'], t['nodo_fin'] = t['nodo_fin'], t['nodo_ini']
                    otro = t['nodo_ini']
                else:
                    continue
                t['orientado'] = True
                orientados += 1
                if otro not in visto:
                    visto.add(otro)
                    cola.append(otro)

di('- {:,} componentes conexas en total: la red principal de cada subcuenca '
   'mas fragmentos sueltos del propio producto del INEGI.'.format(n_componentes))
di('- **{:,} de {:,} tramos orientados** hacia la salida de su componente '
   '({:.1f} %).'.format(orientados, len(tramos),
                        100.0 * orientados / max(1, len(tramos))))

# --------------------------------------- validar la orientacion con ARBSUM_1
# ARBSUM_1 cuenta los tramos aguas arriba, asi que crece hacia aguas abajo.
siguiente = {}          # c_tramo -> c_tramo aguas abajo
for t in tramos.values():
    candidatos = [tramos[ct] for ct, ex in incidentes[t['nodo_fin']]
                  if ct != t['c_tramo'] and tramos[ct].get('orientado')
                  and tramos[ct]['nodo_ini'] == t['nodo_fin']]
    if candidatos:
        siguiente[t['c_tramo']] = max(candidatos, key=lambda x: x['arbsum'])['c_tramo']

coherentes = incoherentes = 0
for ct, ab in siguiente.items():
    if tramos[ab]['arbsum'] >= tramos[ct]['arbsum']:
        coherentes += 1
    else:
        incoherentes += 1
total_ar = coherentes + incoherentes
di('- Validacion con `ARBSUM_1`: **{:.1f} %** de los enlaces tienen suma '
   'arborescente no decreciente hacia aguas abajo ({:,} de {:,}).'.format(
       100.0 * coherentes / max(1, total_ar), coherentes, total_ar))

# -------------------------------------------- costura entre subcuencas
costuras = 0
for subc, p in sorted(salidas_subc.items()):
    # nodo de salida de esta subcuenca
    cand = [t for t in por_subc[subc] if t['c_tramo'] not in siguiente]
    if not cand:
        continue
    salida = min(cand, key=lambda t: metros(coord_nodo[t['nodo_fin']], p))
    nodo_salida = coord_nodo[salida['nodo_fin']]
    mejor = None
    for otra, lista in por_subc.items():
        if otra == subc:
            continue
        for t in lista:
            d = metros(coord_nodo[t['nodo_ini']], nodo_salida)
            if mejor is None or d < mejor[0]:
                mejor = (d, t['c_tramo'])
    if mejor and mejor[0] <= TOL_COSTURA_M:
        siguiente[salida['c_tramo']] = mejor[1]
        costuras += 1
di('- {} subcuencas cosidas a la red de la vecina (tolerancia {:.0f} m).'.format(
    costuras, TOL_COSTURA_M))
di()

# ================================================ 3. enganche de los sitios
di('## 3. Enganche de los sitios al cauce')
di()

with open(os.path.join(PROC, 'sitio.csv'), encoding='utf-8-sig') as f:
    sitios = [r for r in csv.DictReader(f) if r['latitud'] and r['longitud']]
di('- Sitios con coordenadas: **{}**.'.format(len(sitios)))

# rejilla de segmentos
rejilla = defaultdict(list)
for t in tramos.values():
    pts = t['pts']
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        cx0, cx1 = sorted((int(a[0] / CELDA_GRADOS), int(b[0] / CELDA_GRADOS)))
        cy0, cy1 = sorted((int(a[1] / CELDA_GRADOS), int(b[1] / CELDA_GRADOS)))
        for cx in range(cx0, cx1 + 1):
            for cy in range(cy0, cy1 + 1):
                rejilla[(cx, cy)].append((t['c_tramo'], i))


def proyecta(p, a, b):
    """Punto mas cercano a p en el segmento a-b, en metros. Devuelve (d, t)."""
    ax = (a[0] - p[0]) * M_POR_GRADO_LON
    ay = (a[1] - p[1]) * M_POR_GRADO_LAT
    bx = (b[0] - p[0]) * M_POR_GRADO_LON
    by = (b[1] - p[1]) * M_POR_GRADO_LAT
    dx, dy = bx - ax, by - ay
    largo2 = dx * dx + dy * dy
    if largo2 == 0:
        return math.hypot(ax, ay), 0.0
    tt = -(ax * dx + ay * dy) / largo2
    tt = max(0.0, min(1.0, tt))
    return math.hypot(ax + tt * dx, ay + tt * dy), tt


def longitud_hasta(pts, i, tt):
    """Metros desde el inicio de la polilinea hasta el punto (segmento i, frac tt)."""
    acum = 0.0
    for k in range(i):
        acum += metros(pts[k], pts[k + 1])
    return acum + metros(pts[i], pts[i + 1]) * tt


enganches = {}
for s in sitios:
    p = (float(s['longitud']), float(s['latitud']))
    cx, cy = int(p[0] / CELDA_GRADOS), int(p[1] / CELDA_GRADOS)
    mejor = None
    for radio in (1, 3, 6, 12):          # crece si no encuentra nada cerca
        for ix in range(cx - radio, cx + radio + 1):
            for iy in range(cy - radio, cy + radio + 1):
                for ct, i in rejilla.get((ix, iy), ()):
                    pts = tramos[ct]['pts']
                    d, tt = proyecta(p, pts[i], pts[i + 1])
                    if mejor is None or d < mejor[0]:
                        mejor = (d, ct, i, tt)
        if mejor and mejor[0] <= radio * CELDA_GRADOS * M_POR_GRADO_LAT:
            break
    if not mejor:
        continue
    d, ct, i, tt = mejor
    pts = tramos[ct]['pts']
    total = sum(metros(pts[k], pts[k + 1]) for k in range(len(pts) - 1))
    frac = (longitud_hasta(pts, i, tt) / total) if total else 0.0
    enganches[s['c_sitio']] = {
        'c_sitio': s['c_sitio'], 'nombre': s['nombre'],
        'tipo_cuerpo': s['tipo_cuerpo'], 'c_tramo': ct,
        'fraccion': round(frac, 6), 'distancia_enganche_m': round(d, 1),
        'calidad_enganche': ('bueno' if d <= ENGANCHE_BUENO else
                             'dudoso' if d <= ENGANCHE_DUDOSO else 'malo'),
        'subcuenca': tramos[ct]['subcuenca'],
        'orden_strahler': tramos[ct]['orden'],
        'condicion_cauce': tramos[ct]['condicion'],
    }

cal = defaultdict(int)
for e in enganches.values():
    cal[e['calidad_enganche']] += 1
di('- Calidad del enganche: ' +
   ', '.join('{} {}'.format(v, k) for k, v in sorted(cal.items(), key=lambda kv: -kv[1])) +
   ' (bueno <= {:.0f} m, dudoso <= {:.0f} m).'.format(ENGANCHE_BUENO, ENGANCHE_DUDOSO))
ds = sorted(e['distancia_enganche_m'] for e in enganches.values())
if ds:
    di('- Distancia de enganche: mediana **{:.0f} m**, percentil 90 {:.0f} m, '
       'maxima {:.0f} m.'.format(ds[len(ds) // 2], ds[int(0.9 * len(ds))], ds[-1]))
lent = [e for e in enganches.values() if 'NTIC' in e['tipo_cuerpo'].upper()]
if lent:
    di('- **{}** sitios lenticos (presa, laguna). No estan sobre una linea de '
       'flujo: se enganchan al cauce mas cercano y quedan marcados, porque su '
       'tiempo de residencia no se modela como un tramo de rio.'.format(len(lent)))
di()

# ============================================== 4. recorrido aguas abajo
di('## 4. Siguiente sitio aguas abajo')
di()

# Un sitio que engancho a mas de medio kilometro del cauce no se encadena. Los
# casos reales son jagueyes y presas que la red 1:50 000 no conecta con el
# Atoyac: forzarlos a un tramo a 11 km inventaria un recorrido que no existe.
# Quedan en sitio_red.csv con su distancia y su motivo, no se borran.
fuera_de_cadena = {cs for cs, e in enganches.items()
                   if e['calidad_enganche'] == 'malo'}
sitios_por_tramo = defaultdict(list)
for cs, e in enganches.items():
    if cs in fuera_de_cadena:
        continue
    sitios_por_tramo[e['c_tramo']].append(e)
for lst in sitios_por_tramo.values():
    lst.sort(key=lambda e: e['fraccion'])
di('- **{}** sitios quedan fuera de la cadena por enganche mayor a {:.0f} m: '
   '{}.'.format(len(fuera_de_cadena), ENGANCHE_DUDOSO,
                ', '.join('`{}`'.format(c) for c in sorted(fuera_de_cadena))))
di()

MAX_SALTOS = 4000


def siguiente_sitio(cs):
    """Devuelve (c_sitio_abajo, distancia_m, saltos) o (None, None, saltos)."""
    e = enganches[cs]
    ct = e['c_tramo']
    # otro sitio mas abajo en el mismo tramo
    for otro in sitios_por_tramo[ct]:
        if otro['fraccion'] > e['fraccion']:
            d = (otro['fraccion'] - e['fraccion']) * tramos[ct]['longitud_m']
            return otro['c_sitio'], d, 0
    # si no, caminar aguas abajo
    dist = (1.0 - e['fraccion']) * tramos[ct]['longitud_m']
    actual, saltos = ct, 0
    while saltos < MAX_SALTOS:
        ab = siguiente.get(actual)
        if ab is None:
            return None, None, saltos
        saltos += 1
        if sitios_por_tramo.get(ab):
            primero = sitios_por_tramo[ab][0]
            return (primero['c_sitio'],
                    dist + primero['fraccion'] * tramos[ab]['longitud_m'], saltos)
        dist += tramos[ab]['longitud_m']
        actual = ab
    return None, None, saltos


filas_abajo = []
for cs in sorted(enganches):
    e = enganches[cs]
    if cs in fuera_de_cadena:
        filas_abajo.append({
            'c_sitio': cs, 'nombre': e['nombre'], 'c_sitio_aguas_abajo': '',
            'distancia_cauce_m': '', 'tramos_intermedios': 0,
            'revisar': 'si',
            'motivo_sin_sucesor': 'enganche a {:.0f} m del cauce mas cercano; '
                                  'no se encadena'.format(e['distancia_enganche_m']),
        })
        continue
    ab, d, saltos = siguiente_sitio(cs)
    # El orden de Strahler no puede bajar hacia aguas abajo. Si baja, el
    # enganche puso uno de los dos en la rama equivocada de una confluencia o
    # la orientacion de ese tramo esta mal. Se publica marcado, no se oculta.
    revisar = ''
    if ab and enganches[ab]['orden_strahler'] < e['orden_strahler']:
        revisar = 'si'
    filas_abajo.append({
        'c_sitio': cs, 'nombre': e['nombre'],
        'c_sitio_aguas_abajo': ab or '',
        'distancia_cauce_m': round(d, 1) if d is not None else '',
        'tramos_intermedios': saltos,
        'revisar': revisar,
        'motivo_sin_sucesor': '' if ab else (
            'llega a la salida de la red sin encontrar otro sitio'
            if saltos < MAX_SALTOS else 'recorrido truncado'),
    })

con = sum(1 for f in filas_abajo if f['c_sitio_aguas_abajo'])
di('- **{} de {}** sitios tienen sucesor aguas abajo. De los {} restantes, '
   '{} llegan al final de su cauce (nadie los sigue, no es un error) y {} son '
   'los que quedaron fuera de la cadena por enganche lejano.'.format(
       con, len(filas_abajo), len(filas_abajo) - con,
       len(filas_abajo) - con - len(fuera_de_cadena), len(fuera_de_cadena)))
dd = sorted(f['distancia_cauce_m'] for f in filas_abajo if f['distancia_cauce_m'] != '')
if dd:
    di('- Distancia al siguiente sitio: mediana **{:.0f} m**, minima {:.0f} m, '
       'maxima {:.0f} m.'.format(dd[len(dd) // 2], dd[0], dd[-1]))
di()

# ------------------------------------------------------- pares de ancestria
pares = []
for cs in sorted(enganches):
    visto, actual, dist, saltos = set(), cs, 0.0, 0
    while True:
        fila = next((f for f in filas_abajo if f['c_sitio'] == actual), None)
        if not fila or not fila['c_sitio_aguas_abajo']:
            break
        ab = fila['c_sitio_aguas_abajo']
        if ab in visto:
            break
        visto.add(ab)
        dist += float(fila['distancia_cauce_m'] or 0)
        saltos += 1
        pares.append({'c_sitio_arriba': cs, 'c_sitio_abajo': ab,
                      'distancia_cauce_m': round(dist, 1), 'saltos': saltos,
                      'revisar': fila.get('revisar', '')})
        actual = ab
        if saltos > 300:
            break
di('- **{:,} pares** (sitio arriba, sitio abajo) con su distancia sobre el '
   'cauce. Es la relacion que necesita el panel para responder "que hay aguas '
   'arriba de este punto".'.format(len(pares)))
di()

# ================================================== 5. validacion por nombre
di('## 5. Validacion')
di()
di('Decenas de sitios declaran su posicion en el nombre. Si el orden calculado '
   'contradice el nombre, el calculo esta mal.')
di()

nombres = {cs: (e['nombre'] or '').upper() for cs, e in enganches.items()}
abajo_de = {f['c_sitio']: f['c_sitio_aguas_abajo'] for f in filas_abajo}
descendientes = defaultdict(set)
for p in pares:
    descendientes[p['c_sitio_arriba']].add(p['c_sitio_abajo'])

# a) pares "aguas arriba" / "aguas abajo" del mismo cuerpo de agua
revisados = coinciden = contradicen = 0
ejemplos = []
for cs, nom in nombres.items():
    if 'AGUAS ARRIBA' not in nom:
        continue
    raiz = nom.replace('AGUAS ARRIBA', '').strip()
    for cs2, nom2 in nombres.items():
        if cs2 == cs or 'AGUAS ABAJO' not in nom2:
            continue
        if nom2.replace('AGUAS ABAJO', '').strip() != raiz:
            continue
        revisados += 1
        if cs2 in descendientes[cs]:
            coinciden += 1
            if len(ejemplos) < 4:
                ejemplos.append('`{}` -> `{}` ({})'.format(cs, cs2, raiz[:44]))
        elif cs in descendientes[cs2]:
            contradicen += 1
            ejemplos.append('**CONTRADICE** `{}` deberia estar arriba de `{}` ({})'
                            .format(cs, cs2, raiz[:44]))
if revisados:
    di('**a) Pares "aguas arriba" y "aguas abajo" del mismo punto.** '
       '{} pares revisados: {} coinciden con el calculo, {} lo contradicen, '
       '{} sin relacion de ancestria (pueden estar en ramas distintas).'.format(
           revisados, coinciden, contradicen, revisados - coinciden - contradicen))
    for e in ejemplos[:6]:
        di('   - ' + e)
else:
    di('**a)** No se encontraron pares comparables por nombre.')
di()

# b) el orden de Strahler no decrece hacia aguas abajo
baja = sube = 0
for f in filas_abajo:
    ab = f['c_sitio_aguas_abajo']
    if not ab:
        continue
    o1 = enganches[f['c_sitio']]['orden_strahler']
    o2 = enganches[ab]['orden_strahler']
    if o2 >= o1:
        sube += 1
    else:
        baja += 1
di('**b) Orden de Strahler.** De {} pares consecutivos, **{}** tienen orden no '
   'decreciente hacia aguas abajo y {} lo tienen decreciente.'.format(
       sube + baja, sube, baja))
if baja:
    di('   Un orden que baja puede ser legitimo si el enganche puso dos sitios '
       'en ramas distintas de una confluencia; conviene revisar esos casos.')
di()

# c) las cadenas terminan en la salida de la red
sin_suc = [f for f in filas_abajo if not f['c_sitio_aguas_abajo']]
di('**c) Final de las cadenas.** {} sitios sin sucesor: {} porque su cadena '
   'llega a la salida de la red, {} porque engancharon lejos del cauce y no se '
   'encadenan, y {} con el recorrido truncado.'.format(
       len(sin_suc),
       sum(1 for f in sin_suc if 'salida' in f['motivo_sin_sucesor']),
       sum(1 for f in sin_suc if 'enganche' in f['motivo_sin_sucesor']),
       sum(1 for f in sin_suc if 'truncado' in f['motivo_sin_sucesor'])))
di()

# ====================================================== 6. escribir tablas
os.makedirs(SALIDA, exist_ok=True)


def escribir(nombre, campos, filas):
    with open(os.path.join(SALIDA, nombre), 'w', newline='',
              encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
        w.writeheader()
        w.writerows(filas)
    print('  -> red/{}: {:,} filas'.format(nombre, len(filas)))


print()
filas_tramo = [{
    'c_tramo': t['c_tramo'], 'subcuenca': t['subcuenca'],
    'orden_strahler': t['orden'], 'arbsum': t['arbsum'],
    'longitud_m': t['longitud_m'], 'condicion': t['condicion'],
    'entidad': t['entidad'],
    'c_tramo_aguas_abajo': siguiente.get(t['c_tramo'], ''),
    'lon_inicio': round(t['pts'][0][0], 6), 'lat_inicio': round(t['pts'][0][1], 6),
    'lon_fin': round(t['pts'][-1][0], 6), 'lat_fin': round(t['pts'][-1][1], 6),
} for t in sorted(tramos.values(), key=lambda x: x['c_tramo'])]
escribir('tramo.csv', list(filas_tramo[0].keys()), filas_tramo)

escribir('sitio_red.csv',
         ['c_sitio', 'nombre', 'tipo_cuerpo', 'c_tramo', 'fraccion',
          'distancia_enganche_m', 'calidad_enganche', 'subcuenca',
          'orden_strahler', 'condicion_cauce'],
         [enganches[k] for k in sorted(enganches)])

escribir('sitio_aguas_abajo.csv',
         ['c_sitio', 'nombre', 'c_sitio_aguas_abajo', 'distancia_cauce_m',
          'tramos_intermedios', 'revisar', 'motivo_sin_sucesor'], filas_abajo)

escribir('sitio_pares.csv',
         ['c_sitio_arriba', 'c_sitio_abajo', 'distancia_cauce_m', 'saltos',
          'revisar'], pares)

rev = [f for f in filas_abajo if f.get('revisar')]
di('**d) Marcados para revision.** {} sitios llevan `revisar = si`: {} por '
   'enganche lejano y {} porque el orden de Strahler baja hacia su sucesor. '
   'No se ocultan ni se corrigen a mano: quien consuma la tabla puede '
   'filtrarlos.'.format(len(rev), len(fuera_de_cadena),
                        len(rev) - len(fuera_de_cadena)))
for f in rev:
    di('   - `{}` {} {}'.format(f['c_sitio'], (f['nombre'] or '')[:46],
                                f['motivo_sin_sucesor'] or
                                '-> `{}`, orden decreciente'.format(f['c_sitio_aguas_abajo'])))
di()

di('## 6. Tablas producidas')
di()
di('| Archivo | Filas | Para que |')
di('|---|---|---|')
di('| `red/tramo.csv` | {:,} | La red con su orden, longitud y tramo de aguas '
   'abajo |'.format(len(filas_tramo)))
di('| `red/sitio_red.csv` | {:,} | Donde quedo enganchado cada sitio y con que '
   'calidad |'.format(len(enganches)))
di('| `red/sitio_aguas_abajo.csv` | {:,} | El siguiente sitio aguas abajo y su '
   'distancia sobre el cauce |'.format(len(filas_abajo)))
di('| `red/sitio_pares.csv` | {:,} | Todos los pares arriba-abajo, para '
   'responder "que hay aguas arriba de aqui" |'.format(len(pares)))
di()
di('`c_sitio_aguas_abajo` vive aqui y no en `sitio.csv`: `sitio.csv` lo genera '
   '`10_construir_tablas.py`, que corre antes de este script y no puede '
   'conocer la topologia.')
di()

ruta_md = os.path.join(RAIZ, 'docs', '13-topologia-red.md')
with open(ruta_md, 'w', encoding='utf-8') as f:
    f.write('\n'.join(informe) + '\n')
print('  -> docs/13-topologia-red.md')

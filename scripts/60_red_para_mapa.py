# -*- coding: utf-8 -*-
"""Extrae de la red hidrografica del INEGI lo que el mapa necesita para dibujar
la cuenca del Alto Atoyac: rios con su orden, subcuencas y nombres.

Lee    : datos/geo/F08_red_hidrografica/RH18/RH18A/RH18A?/*.shp  (capas _hl, _subc, _to)
Escribe: datos/procesados/mapa/red_hidrografica.geojson
         datos/procesados/mapa/cuenca.geojson        (contorno exterior de las 10 subcuencas)
         datos/procesados/mapa/confluencias.geojson  (uniones principales de la red, con nombre)
         datos/procesados/mapa/subcuencas.geojson
         datos/procesados/mapa/toponimia_hidrografica.geojson

Esto NO es el orden aguas arriba -> aguas abajo de los sitios (eso es M1). Es solo
geometria simplificada para pintar. Conserva ORDER_1 (orden del cauce), la
condicion (perenne, intermitente, canal) y el acumulado aguas arriba, que M1 y el
mapa pueden usar para ordenar y para dar grosor al trazo.

Sin dependencias: lee shapefile y dbf a mano, solo con la biblioteca estandar.
No modifica nada en datos/geo (invariante I1).

Uso: python -I scripts/60_red_para_mapa.py
"""
import json
import math
import os
import struct
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, 'datos', 'geo', 'F08_red_hidrografica', 'RH18', 'RH18A')
SALIDA = os.path.join(RAIZ, 'datos', 'procesados', 'mapa')
os.makedirs(SALIDA, exist_ok=True)

# Un cauce de orden 1 es un escurrimiento de ladera: son miles y ensucian el mapa.
# Con orden >= 4 se ven los rios y las barrancas principales (7 600 tramos, ~2 MB).
ORDEN_MINIMO = 4
TOL_LINEA = 0.00015        # grados (~16 m) para Douglas-Peucker
TOL_SUBC = 0.0008
DECIMALES = 5
# Nombres que aportan al mapa; el resto de la toponimia son cerros y poblados.
PREFIJOS_NOMBRE = ('RIO', 'RÍO', 'ARROYO', 'BARRANCA', 'PRESA', 'LAGUNA', 'CANAL', 'LAGO')


# ------------------------------------------------------------ lectura de shapefile
def leer_shp(ruta):
    """Devuelve (tipo, [ (partes, ...) ]) con cada registro como lista de anillos o
    lineas, o un punto. Los registros nulos se devuelven como None para no
    desalinear el indice con el dbf."""
    with open(ruta, 'rb') as f:
        d = f.read()
    tipo = struct.unpack('<i', d[32:36])[0]
    pos, out = 100, []
    while pos + 8 <= len(d):
        longitud = struct.unpack('>i', d[pos + 4:pos + 8])[0] * 2
        c = d[pos + 8:pos + 8 + longitud]
        pos += 8 + longitud
        t = struct.unpack('<i', c[:4])[0]
        if t == 0:
            out.append(None)
        elif t == 1:
            out.append(struct.unpack('<2d', c[4:20]))
        elif t in (3, 5):
            nparts, npts = struct.unpack('<2i', c[36:44])
            partes = list(struct.unpack('<%di' % nparts, c[44:44 + 4 * nparts]))
            ini = 44 + 4 * nparts
            pts = struct.unpack('<%dd' % (2 * npts), c[ini:ini + 16 * npts])
            pts = [(pts[2 * i], pts[2 * i + 1]) for i in range(npts)]
            partes.append(npts)
            out.append([pts[partes[i]:partes[i + 1]] for i in range(nparts)])
        else:
            out.append(None)
    return tipo, out


def leer_dbf(ruta):
    with open(ruta, 'rb') as f:
        d = f.read()
    n = struct.unpack('<I', d[4:8])[0]
    cab, lon = struct.unpack('<2H', d[8:12])
    campos, p = [], 32
    while d[p] != 0x0D:
        campos.append((d[p:p + 11].split(b'\x00')[0].decode('ascii'), d[p + 16]))
        p += 32
    filas = []
    for i in range(n):
        r = d[cab + i * lon: cab + (i + 1) * lon]
        off, fila = 1, {}
        for nombre, ln in campos:
            b = r[off:off + ln]
            try:
                fila[nombre] = b.decode('utf-8').strip()
            except UnicodeDecodeError:
                fila[nombre] = b.decode('cp1252').strip()
            off += ln
        filas.append(fila)
    return filas


# ------------------------------------------------------------------ simplificacion
def douglas_peucker(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        norma = (dx * dx + dy * dy) ** 0.5
        mejor, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if norma == 0:
                dist = ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            else:
                dist = abs(dy * px - dx * py + bx * ay - by * ax) / norma
            if dist > mejor:
                mejor, idx = dist, i
        if mejor > tol:
            keep[idx] = True
            pila.append((a, idx))
            pila.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def redondea(pts):
    return [[round(x, DECIMALES), round(y, DECIMALES)] for x, y in pts]


def numero(texto, defecto=0.0):
    try:
        return float(texto)
    except ValueError:
        return defecto


def dms(texto):
    """'192258.612' -> grados decimales (formato DDMMSS.sss del INEGI)."""
    v = numero(texto, None)
    if v is None:
        return None
    g = int(v // 10000)
    m = int((v - g * 10000) // 100)
    s = v - g * 10000 - m * 100
    return g + m / 60 + s / 3600


def extrae_si_falta():
    """Si solo esta el zip descargado, lo extrae a datos/geo (que no se versiona)."""
    if os.path.isdir(BASE):
        return
    zip_f08 = os.path.join(RAIZ, 'datos', 'crudos', 'F08',
                           '702825006881_RedHidrografica_Cuenca_R_Atoyac_RH_Balsas.zip')
    if not os.path.exists(zip_f08):
        raise SystemExit('Falta la red hidrografica. Corre: python -I scripts/00_descargar_fuentes.py F08')
    destino = os.path.join(RAIZ, 'datos', 'geo', 'F08_red_hidrografica')
    os.makedirs(destino, exist_ok=True)
    with zipfile.ZipFile(zip_f08) as zf:
        for n in zf.namelist():
            if os.path.isabs(n) or '..' in n.replace(chr(92), '/').split('/'):
                raise SystemExit('ruta sospechosa dentro del zip: ' + n)
        zf.extractall(destino)
    print('Extraido en ' + destino)


def contorno_cuenca(subcuencas):
    """Contorno exterior de la cuenca: los lados que comparten dos subcuencas se cancelan
    (en el INEGI coinciden vértice a vértice) y los que quedan se encadenan en anillos."""
    lados = {}
    for sc in subcuencas:
        _, geo = leer_shp(os.path.join(BASE, sc, sc + '_subc.shp'))
        for g in geo:
            for anillo in g or []:
                for a, b in zip(anillo, anillo[1:]):
                    a, b = tuple(a), tuple(b)
                    k = (a, b) if a < b else (b, a)
                    if k in lados:
                        del lados[k]
                    else:
                        lados[k] = (a, b)
    siguiente = {}
    for a, b in lados.values():
        siguiente.setdefault(a, []).append(b)
        siguiente.setdefault(b, []).append(a)
    usados, anillos = set(), []
    for inicio in list(siguiente):
        if inicio in usados:
            continue
        anillo, previo, actual = [inicio], None, inicio
        usados.add(inicio)
        while True:
            opciones = [p for p in siguiente[actual] if p != previo and (p not in usados or p == inicio)]
            if not opciones:
                break
            previo, actual = actual, opciones[0]
            anillo.append(actual)
            if actual == inicio:
                break
            usados.add(actual)
        if len(anillo) > 10 and anillo[0] == anillo[-1]:
            anillos.append(anillo)
    anillos.sort(key=len, reverse=True)
    return [redondea(douglas_peucker(a, TOL_SUBC)) for a in anillos[:1]]


def confluencias(subcuencas, cuantas=14, separacion_km=6.0):
    """Confluencias principales sobre la red completa (todos los órdenes).

    FLOWDIR = 1 en toda la red: cada línea va de aguas arriba a aguas abajo. Se acumula la
    longitud de red aguas arriba de cada tramo; donde un cauce se divide, lo acumulado pasa
    solo a la salida de mayor orden, para no contarlo dos veces. Una confluencia se ordena
    por la red del afluente menor: así ganan las uniones de dos ríos grandes. El nombre de
    cada brazo es la toponimia del INEGI más cercana a su cauce, río arriba.
    """
    lineas = []
    for sc in subcuencas:
        _, geo = leer_shp(os.path.join(BASE, sc, sc + '_hl.shp'))
        attr = leer_dbf(os.path.join(BASE, sc, sc + '_hl.dbf'))
        for g, a in zip(geo, attr):
            if g:
                p = g[0]
                lineas.append((tuple(p[0]), tuple(p[-1]), numero(a.get('LENGTHM')), int(numero(a.get('ORDER_1'))), p))
    llegan, salen = {}, {}
    for i, l in enumerate(lineas):
        llegan.setdefault(l[1], []).append(i)
        salen.setdefault(l[0], []).append(i)
    elegido = {pt: max(v, key=lambda k: (lineas[k][3], lineas[k][2])) for pt, v in salen.items()}
    pendientes = [len(llegan.get(l[0], [])) for l in lineas]
    acum = [0.0] * len(lineas)
    cola = [i for i, n in enumerate(pendientes) if n == 0]
    while cola:
        i = cola.pop()
        acum[i] = lineas[i][2] + sum(acum[j] for j in llegan.get(lineas[i][0], []) if elegido[lineas[j][1]] == i)
        for k in salen.get(lineas[i][1], []):
            pendientes[k] -= 1
            if pendientes[k] == 0:
                cola.append(k)

    rios = []
    for sc in subcuencas:
        _, geo = leer_shp(os.path.join(BASE, sc, sc + '_to.shp'))
        attr = leer_dbf(os.path.join(BASE, sc, sc + '_to.dbf'))
        for g, a in zip(geo, attr):
            nombre = (a.get('NOMBRE_COM') or a.get('NOMBRE') or '').strip()
            if g and nombre.upper().startswith(('RIO', 'RÍO', 'ARROYO', 'BARRANCA')):
                rios.append((g[0], g[1], nombre))

    def km(a, b):
        return math.hypot((a[0] - b[0]) * 105.5, (a[1] - b[1]) * 111.0)

    def nombre_rio_arriba(i, tramo_km=60.0, radio_km=1.0):
        """Recorre el brazo río arriba por el afluente mayor y devuelve el nombre que más se
        repite pegado a su cauce. Un río se rotula muchas veces a lo largo de su curso; un
        nombre suelto cerca de la unión suele ser de otro cauce."""
        puntos, recorrido = [], 0.0
        while i is not None and recorrido < tramo_km * 1000:
            puntos.extend(lineas[i][4][::3] + [lineas[i][4][-1]])
            recorrido += lineas[i][2]
            previos = [j for j in llegan.get(lineas[i][0], []) if elegido[lineas[j][1]] == i]
            i = max(previos, key=lambda j: acum[j]) if previos else None
        xs, ys = [p[0] for p in puntos], [p[1] for p in puntos]
        caja = (min(xs) - 0.01, max(xs) + 0.01, min(ys) - 0.01, max(ys) + 0.01)
        votos = {}
        for x, y, nombre in rios:
            if caja[0] <= x <= caja[1] and caja[2] <= y <= caja[3] and min(km(p, (x, y)) for p in puntos) < radio_km:
                clave = nombre.upper()
                peso = 2 if clave.startswith(('RIO', 'RÍO')) else 1
                votos[clave] = (votos.get(clave, (0, nombre))[0] + peso, nombre)
        if not votos:
            return None
        return max(votos.values())[1]

    candidatas = []
    for pt, ins in llegan.items():
        if len(ins) >= 2:
            ins = sorted(ins, key=lambda j: acum[j], reverse=True)
            candidatas.append((acum[ins[1]], pt, ins[0], ins[1]))
    candidatas.sort(reverse=True)
    elegidas = []
    for menor, pt, i_mayor, i_menor in candidatas:
        if len(elegidas) >= cuantas:
            break
        if any(km(pt, e['geometry']['coordinates']) < separacion_km for e in elegidas):
            continue
        a, b = nombre_rio_arriba(i_mayor), nombre_rio_arriba(i_menor)
        if a and b and a.upper() == b.upper():
            b = None
        elegidas.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [round(pt[0], DECIMALES), round(pt[1], DECIMALES)]},
            'properties': {
                'rango': len(elegidas) + 1,
                'principal': a, 'afluente': b,
                'km_red_principal': round(acum[i_mayor] / 1000),
                'km_red_afluente': round(menor / 1000),
            }})
    return elegidas


def main():
    extrae_si_falta()
    subcuencas = sorted(d for d in os.listdir(BASE) if d.startswith('RH18A'))
    lineas, polis, nombres = [], [], []
    vistos = set()
    cond_corta = {'PERENNE': 'P', 'INTERMITENTE': 'I', 'EN OPERACION': 'C', 'FLUJO VIRTUAL': 'V'}
    por_orden = {}
    for sc in subcuencas:
        carpeta = os.path.join(BASE, sc)
        # --- cauces
        _, geo = leer_shp(os.path.join(carpeta, sc + '_hl.shp'))
        attr = leer_dbf(os.path.join(carpeta, sc + '_hl.dbf'))
        for g, a in zip(geo, attr):
            if g is None:
                continue
            orden = int(numero(a.get('ORDER_1'), 0))
            por_orden[orden] = por_orden.get(orden, 0) + 1
            if orden < ORDEN_MINIMO:
                continue
            for parte in g:
                pts = douglas_peucker(parte, TOL_LINEA)
                if len(pts) < 2:
                    continue
                lineas.append({
                    'type': 'Feature',
                    'geometry': {'type': 'LineString', 'coordinates': redondea(pts)},
                    'properties': {
                        'orden': orden,
                        'cond': cond_corta.get(a.get('CONDICION'), '?'),
                        'km_arriba': round(numero(a.get('ARBSUM_1')) / 1000, 1),
                        'subc': sc,
                    }})
        # --- subcuenca
        _, geo = leer_shp(os.path.join(carpeta, sc + '_subc.shp'))
        attr = leer_dbf(os.path.join(carpeta, sc + '_subc.dbf'))
        for g, a in zip(geo, attr):
            if g is None:
                continue
            anillos = [redondea(douglas_peucker(p, TOL_SUBC)) for p in g]
            drena = [a.get('DRENAJE%d' % i) for i in range(1, 5) if a.get('DRENAJE%d' % i, '-') not in ('-', '')]
            polis.append({
                'type': 'Feature',
                'geometry': {'type': 'Polygon', 'coordinates': anillos},
                'properties': {
                    'clave': a.get('CVE_SUBCUE', sc),
                    'nombre': a.get('SUBCUENCA'),
                    'area_km2': round(numero(a.get('AREA_KM2')), 1),
                    'drena_a': drena,
                }})
        # --- toponimia hidrografica
        _, geo = leer_shp(os.path.join(carpeta, sc + '_to.shp'))
        attr = leer_dbf(os.path.join(carpeta, sc + '_to.dbf'))
        for g, a in zip(geo, attr):
            if g is None:
                continue
            nombre = (a.get('NOMBRE_COM') or a.get('NOMBRE') or '').strip()
            if not nombre.upper().startswith(PREFIJOS_NOMBRE) or nombre.upper() in vistos:
                continue
            vistos.add(nombre.upper())      # un rotulo por nombre: el mapa no necesita repetirlo
            nombres.append({
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [round(g[0], DECIMALES), round(g[1], DECIMALES)]},
                'properties': {'nombre': nombre, 'termino': a.get('TERMINO_GE'), 'estado': a.get('NOM_EDOM')},
            })

    def escribe(nombre, features):
        ruta = os.path.join(SALIDA, nombre)
        with open(ruta, 'w', encoding='utf-8') as f:
            json.dump({'type': 'FeatureCollection', 'features': features}, f, ensure_ascii=False, separators=(',', ':'))
        print('{}: {:,} elementos, {:,.0f} KB'.format(nombre, len(features), os.path.getsize(ruta) / 1024))

    print('Cauces por orden en las 10 subcuencas:', dict(sorted(por_orden.items())))
    print('Se conservan orden >= {}'.format(ORDEN_MINIMO))
    escribe('red_hidrografica.geojson', lineas)
    escribe('subcuencas.geojson', polis)
    escribe('toponimia_hidrografica.geojson', nombres)
    contorno = contorno_cuenca(subcuencas)
    escribe('cuenca.geojson', [{'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': contorno},
                                'properties': {'clave': 'RH18A', 'nombre': 'Cuenca R. Atoyac',
                                               'area_km2': round(sum(p['properties']['area_km2'] for p in polis), 1)}}])
    escribe('confluencias.geojson', confluencias(subcuencas))


if __name__ == '__main__':
    main()

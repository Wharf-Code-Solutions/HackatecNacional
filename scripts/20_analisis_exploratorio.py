# -*- coding: utf-8 -*-
"""Analisis exploratorio inicial (seccion 11 del plan).

Lee    : datos/procesados/*.csv
Escribe: datos/procesados/analisis/*.csv  y  docs/09-hallazgos-exploratorio.md

Uso: python -I scripts/20_analisis_exploratorio.py
"""
import csv, os, statistics as st
from collections import defaultdict, Counter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(RAIZ, 'datos', 'procesados')
OUT = os.path.join(PROC, 'analisis')
os.makedirs(OUT, exist_ok=True)


def leer(nombre):
    with open(os.path.join(PROC, nombre), encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def escribir(nombre, campos, filas):
    with open(os.path.join(OUT, nombre), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
        w.writeheader()
        w.writerows(filas)
    print('  -> analisis/{}: {:,} filas'.format(nombre, len(filas)))


sitios = {r['c_sitio']: r for r in leer('sitio.csv')}
params = {r['c_parametro']: r for r in leer('parametro.csv')}
muestreo = leer('muestreo_nucleo.csv')

# Un valor bajo el limite de deteccion se representa como LD/2 y queda marcado.
def valor_de(r):
    if r['valor'] not in ('', None):
        return float(r['valor'])
    if r['bajo_limite_deteccion'] == 'true' and r['limite_deteccion']:
        return float(r['limite_deteccion']) / 2.0
    return None


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return ''
    k = (len(xs) - 1) * p / 100.0
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


# Escala CONAGUA de agua superficial: (min_excluyente, max_incluyente) por clase
ESCALA = {
    'DBO_TOT': [('Excelente', None, 3), ('Buena calidad', 3, 6),
                ('Aceptable', 6, 30), ('Contaminada', 30, 120),
                ('Fuertemente contaminada', 120, None)],
    'DQO_TOT': [('Excelente', None, 10), ('Buena calidad', 10, 20),
                ('Aceptable', 20, 40), ('Contaminada', 40, 200),
                ('Fuertemente contaminada', 200, None)],
    'SST': [('Excelente', None, 25), ('Buena calidad', 25, 75),
            ('Aceptable', 75, 150), ('Contaminada', 150, 400),
            ('Fuertemente contaminada', 400, None)],
    'COLI_FEC': [('Excelente', None, 100), ('Buena calidad', 100, 200),
                 ('Aceptable', 200, 1000), ('Contaminada', 1000, 10000),
                 ('Fuertemente contaminada', 10000, None)],
    'E_COLI': [('Excelente', None, 126), ('Buena calidad', 126, 576),
               ('Aceptable', 576, 850), ('Contaminada', 850, 1000),
               ('Fuertemente contaminada', 1000, None)],
    'TOX_D_48_UT': [('No toxico', None, 1), ('Toxicidad baja', 1, 1.33),
                    ('Toxicidad moderada', 1.33, 5),
                    ('Toxicidad alta', 5, None)],
    'TOX_V_15_UT': [('No toxico', None, 1), ('Toxicidad baja', 1, 1.33),
                    ('Toxicidad moderada', 1.33, 5),
                    ('Toxicidad alta', 5, None)],
}
MALAS = ('Contaminada', 'Fuertemente contaminada', 'Toxicidad moderada',
         'Toxicidad alta')


def clasificar(cp, v):
    if cp == 'OD_%':          # escala de dos colas
        if 70 < v <= 110:
            return 'Excelente'
        if 50 < v <= 70 or 110 < v <= 120:
            return 'Buena calidad'
        if 30 < v <= 50 or 120 < v <= 130:
            return 'Aceptable'
        if 10 < v <= 30 or 130 < v <= 150:
            return 'Contaminada'
        return 'Fuertemente contaminada'
    for nombre, mn, mx in ESCALA.get(cp, []):
        if (mn is None or v > mn) and (mx is None or v <= mx):
            return nombre
    return ''


# ------------------------------------------- 1. linea base por sitio/parametro
print('1) linea base por sitio y parametro')
grupos = defaultdict(list)
for r in muestreo:
    v = valor_de(r)
    if v is None:
        continue
    grupos[(r['c_sitio'], r['c_parametro'])].append((r['fecha'], v))

base = []
for (cs, cp), serie in sorted(grupos.items()):
    vs = [v for _, v in serie]
    base.append({
        'c_sitio': cs, 'nombre_sitio': sitios.get(cs, {}).get('nombre', ''),
        'municipio': sitios.get(cs, {}).get('municipio', ''),
        'c_parametro': cp, 'unidad': params.get(cp, {}).get('unidad', ''),
        'n': len(vs), 'media': round(st.fmean(vs), 4),
        'mediana': round(st.median(vs), 4),
        'desv_est': round(st.stdev(vs), 4) if len(vs) > 1 else '',
        'minimo': round(min(vs), 4), 'maximo': round(max(vs), 4),
        'p10': round(pct(vs, 10), 4), 'p90': round(pct(vs, 90), 4),
        'primera_fecha': min(f for f, _ in serie),
        'ultima_fecha': max(f for f, _ in serie)})
escribir('linea_base_sitio_parametro.csv', list(base[0].keys()), base)

# --------------------------------------------- 2. ranking de sitios criticos
print('2) ranking de sitios')
clas = defaultdict(Counter)
ultimo = {}
for r in muestreo:
    v = valor_de(r)
    if v is None:
        continue
    c = clasificar(r['c_parametro'], v)
    if not c:
        continue
    clas[r['c_sitio']][c] += 1
    k = (r['c_sitio'], r['c_parametro'])
    if k not in ultimo or r['fecha'] > ultimo[k][0]:
        ultimo[k] = (r['fecha'], v, c)

malos_por_sitio = defaultdict(set)
for (cs, cp), (f, v, c) in ultimo.items():
    if c in MALAS:
        malos_por_sitio[cs].add(cp)

ranking = []
for cs, cnt in clas.items():
    tot = sum(cnt.values())
    mal = sum(cnt[c] for c in MALAS)
    s = sitios.get(cs, {})
    ranking.append({
        'c_sitio': cs, 'nombre_sitio': s.get('nombre', ''),
        'cuerpo_agua': s.get('cuerpo_agua', ''), 'municipio': s.get('municipio', ''),
        'estado': s.get('estado', ''), 'latitud': s.get('latitud', ''),
        'longitud': s.get('longitud', ''), 'semaforo_conagua': s.get('semaforo', ''),
        'contaminantes_conagua': s.get('contaminantes', ''),
        'mediciones_clasificadas': tot, 'mediciones_malas': mal,
        'pct_malas': round(100.0 * mal / tot, 1) if tot else '',
        'parametros_fuera_ultima_medicion': len(malos_por_sitio.get(cs, ())),
        'cuales': '|'.join(sorted(malos_por_sitio.get(cs, ())))})
ranking.sort(key=lambda d: (-d['parametros_fuera_ultima_medicion'],
                            -(d['pct_malas'] or 0)))
escribir('ranking_sitios_criticos.csv', list(ranking[0].keys()), ranking)

# ------------------------------------------------- 3. estiaje contra lluvias
print('3) temporada (estiaje nov-may / lluvias jun-oct)')
temp = defaultdict(lambda: defaultdict(list))
for r in muestreo:
    v = valor_de(r)
    if v is None or not r['fecha']:
        continue
    mes = int(r['fecha'][5:7])
    temporada = 'lluvias' if 6 <= mes <= 10 else 'estiaje'
    temp[r['c_parametro']][temporada].append(v)

filas_t = []
for cp, d in sorted(temp.items()):
    e, l = d.get('estiaje', []), d.get('lluvias', [])
    if len(e) < 10 or len(l) < 10:
        continue
    me, ml = st.median(e), st.median(l)
    filas_t.append({'c_parametro': cp, 'unidad': params.get(cp, {}).get('unidad', ''),
                    'n_estiaje': len(e), 'mediana_estiaje': round(me, 4),
                    'n_lluvias': len(l), 'mediana_lluvias': round(ml, 4),
                    'cambio_pct_lluvias_vs_estiaje':
                        round(100.0 * (ml - me) / me, 1) if me else ''})
escribir('temporada_por_parametro.csv', list(filas_t[0].keys()), filas_t)

# ------------------------------------------------------- 4. tendencia anual
print('4) tendencia anual')
anual = defaultdict(list)
for r in muestreo:
    v = valor_de(r)
    if v is None or not r['anio']:
        continue
    anual[(r['c_parametro'], r['anio'])].append(v)
filas_a = [{'c_parametro': cp, 'anio': a, 'n': len(vs),
            'mediana': round(st.median(vs), 4), 'media': round(st.fmean(vs), 4)}
           for (cp, a), vs in sorted(anual.items())]
escribir('tendencia_anual_parametro.csv', list(filas_a[0].keys()), filas_a)

# ----------------------------------------- 5. cobertura por sitio y parametro
print('5) cobertura')
cob = defaultdict(set)
for r in muestreo:
    if r['fecha']:
        cob[r['c_sitio']].add(r['fecha'])
filas_c = []
for cs, s in sorted(sitios.items()):
    fechas = cob.get(cs, set())
    filas_c.append({'c_sitio': cs, 'nombre_sitio': s['nombre'],
                    'municipio': s['municipio'], 'estado': s['estado'],
                    'cuenca': s['cuenca'], 'cuerpo_agua': s['cuerpo_agua'],
                    'latitud': s['latitud'], 'longitud': s['longitud'],
                    'semaforo': s['semaforo'], 'n_muestreos': len(fechas),
                    'primer_muestreo': min(fechas) if fechas else '',
                    'ultimo_muestreo': max(fechas) if fechas else ''})
escribir('cobertura_por_sitio.csv', list(filas_c[0].keys()), filas_c)

# --------------------------------------------------------- 6. correlaciones
print('6) correlaciones entre parametros del nucleo')
por_monitoreo = defaultdict(dict)
for r in muestreo:
    v = valor_de(r)
    if v is not None:
        por_monitoreo[(r['c_sitio'], r['fecha'])][r['c_parametro']] = v
claves = [cp for cp, n in Counter(
    cp for d in por_monitoreo.values() for cp in d).items() if n >= 300]
filas_r = []
for i, a in enumerate(sorted(claves)):
    for b in sorted(claves)[i + 1:]:
        xs = [(d[a], d[b]) for d in por_monitoreo.values() if a in d and b in d]
        if len(xs) < 100:
            continue
        try:
            r_p = st.correlation([x for x, _ in xs], [y for _, y in xs])
        except st.StatisticsError:
            continue
        if abs(r_p) >= 0.4:
            filas_r.append({'parametro_a': a, 'parametro_b': b, 'n': len(xs),
                            'pearson': round(r_p, 3)})
filas_r.sort(key=lambda d: -abs(d['pearson']))
escribir('correlaciones_parametros.csv', ['parametro_a', 'parametro_b', 'n', 'pearson'], filas_r)

# ------------------------------------------------------------- 7. hallazgos
print('7) resumen de hallazgos')
total_sitios = len(sitios)
con_coord = sum(1 for s in sitios.values() if s['latitud'])
sem = Counter(s['semaforo'] for s in sitios.values())
cont = Counter()
for s in sitios.values():
    for c in str(s['contaminantes']).replace(',', ' ').split():
        if c.strip():
            cont[c.strip().upper()] += 1
anios = Counter(r['anio'] for r in muestreo if r['anio'])
top10 = ranking[:10]
peores_t = sorted([f for f in filas_t if f['cambio_pct_lluvias_vs_estiaje'] != ''],
                  key=lambda d: -abs(d['cambio_pct_lluvias_vs_estiaje']))[:8]

L = []
L.append('# Hallazgos del analisis exploratorio inicial')
L.append('')
L.append('Generado por `scripts/20_analisis_exploratorio.py` sobre las tablas de '
         '`datos/procesados/`. Fuentes: F01, F02, F05 (CONAGUA).')
L.append('')
L.append('## Cobertura')
L.append('')
L.append('- **{}** sitios de monitoreo superficial en el area de estudio; '
         '{} con coordenadas validas.'.format(total_sitios, con_coord))
L.append('- **{:,}** resultados en la tabla `muestreo` ({:,} en el nucleo '
         'analitico), de **{:,}** muestreos.'.format(
             sum(1 for _ in open(os.path.join(PROC, 'muestreo.csv'),
                                 encoding='utf-8-sig')) - 1,
             len(muestreo), len(por_monitoreo)))
L.append('- Periodo: **{} a {}**.'.format(
    min(r['fecha'] for r in muestreo if r['fecha']),
    max(r['fecha'] for r in muestreo if r['fecha'])))
L.append('- Resultados del nucleo por anio: ' +
         ', '.join('{}: {:,}'.format(a, n) for a, n in sorted(anios.items())) + '.')
L.append('')
L.append('## Semaforo CONAGUA del periodo 2012-2025 (F02)')
L.append('')
for k, v in sem.most_common():
    L.append('- {}: **{}** sitios'.format(k or '(sin dato)', v))
L.append('')
if cont:
    L.append('Contaminantes que CONAGUA senala con mas frecuencia en la cuenca: ' +
             ', '.join('{} ({})'.format(k, v) for k, v in cont.most_common(10)) + '.')
    L.append('')
L.append('## 10 sitios mas criticos')
L.append('')
L.append('Orden: numero de parametros fuera de clase en su ultima medicion, '
         'luego porcentaje historico de mediciones en clase mala.')
L.append('')
L.append('| Sitio | Nombre | Cuerpo de agua | Municipio | Param. fuera | % malas |')
L.append('|---|---|---|---|---|---|')
for d in top10:
    L.append('| {} | {} | {} | {} | {} | {} |'.format(
        d['c_sitio'], str(d['nombre_sitio'])[:46], str(d['cuerpo_agua'])[:26],
        str(d['municipio'])[:20], d['parametros_fuera_ultima_medicion'],
        d['pct_malas']))
L.append('')
L.append('## Efecto de la temporada')
L.append('')
L.append('Mediana en lluvias (junio-octubre) frente a estiaje (noviembre-mayo), '
         'parametros con mayor cambio relativo:')
L.append('')
L.append('| Parametro | Unidad | Mediana estiaje | Mediana lluvias | Cambio |')
L.append('|---|---|---|---|---|')
for d in peores_t:
    L.append('| {} | {} | {} | {} | {:+.1f}% |'.format(
        d['c_parametro'], d['unidad'], d['mediana_estiaje'], d['mediana_lluvias'],
        d['cambio_pct_lluvias_vs_estiaje']))
L.append('')
L.append('## Parametros que suben juntos (pista del tipo de fuente)')
L.append('')
L.append('| A | B | n | Pearson |')
L.append('|---|---|---|---|')
for d in filas_r[:15]:
    L.append('| {} | {} | {} | {} |'.format(d['parametro_a'], d['parametro_b'],
                                            d['n'], d['pearson']))
L.append('')
L.append('## Pendiente')
L.append('')
L.append('- Orden aguas arriba -> aguas abajo de los sitios (requiere F08, '
         'red hidrografica).')
L.append('- Cruce con descargas y establecimientos (F09-F12) y con precipitacion (F13).')
L.append('- Limites de la NOM-001-SEMARNAT-2021 cargados a `umbral` (F07 ya descargado).')
L.append('')

ruta_md = os.path.join(RAIZ, 'docs', '09-hallazgos-exploratorio.md')
with open(ruta_md, 'w', encoding='utf-8') as f:
    f.write('\n'.join(L))
print('  -> docs/09-hallazgos-exploratorio.md')
print('\nListo.')

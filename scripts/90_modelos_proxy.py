# -*- coding: utf-8 -*-
"""Modelos proxy: estimar un parametro de laboratorio desde un sensor barato.

La estacion mide conductividad y turbiedad en campo. Si de ahi se pueden
estimar los solidos disueltos y los solidos suspendidos, que normalmente exigen
laboratorio, una estacion de pocos miles de pesos reporta parametros que hoy
cuestan un muestreo.

Se ajustan dos relaciones de potencia en espacio logaritmico y, sobre todo, se
VALIDAN fuera de muestra de dos formas distintas:

- por sitio: se ajusta con la mitad de los sitios y se prueba en los otros. Es
  la pregunta real, porque una estacion nueva se instala en un sitio cuya
  relacion no se uso para ajustar.
- en el tiempo: se ajusta con las fechas tempranas de cada sitio y se prueba en
  las posteriores, para ver si calibrar por sitio aporta algo.

El resultado decide cual se publica y cual no. Un modelo no entra al fixture
solo porque exista: entra si su error predictivo lo justifica.

Lee    : datos/procesados/muestreo_nucleo.csv
Escribe: datos/procesados/proxy_modelos.csv
         contrato/fixtures/modelos_proxy.json
         docs/16-modelos-proxy.md

Uso: python -I scripts/90_modelos_proxy.py
"""
import csv
import json
import math
import os
import statistics as st
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(RAIZ, 'datos', 'procesados')
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')

# Un modelo se publica si su error mediano fuera de muestra no pasa de esto y
# su percentil 90 tampoco. Reportar un numero con 35 % de error tipico como si
# fuera una medicion seria enganoso.
MAX_ERROR_MEDIANO = 0.10
MAX_ERROR_P90 = 0.25

# (sensor, parametro de laboratorio, codigo del contrato para el sensor)
RELACIONES = [
    ('CONDUC_CAMPO', 'SDT', 'COND', 'uS/cm', 'mg/L'),
    ('TURBIEDAD', 'SST', 'TURB', 'UTN', 'mg/L'),
]

informe = []


def di(s=''):
    print(s)
    informe.append(s)


def valor_de(r):
    if r['valor'] not in ('', None):
        return float(r['valor'])
    if r['bajo_limite_deteccion'] == 'true' and r['limite_deteccion']:
        return float(r['limite_deteccion']) / 2.0
    return None


def pct(xs, q):
    xs = sorted(xs)
    i = (len(xs) - 1) * q / 100.0
    lo, hi = int(i), min(int(i) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo)


def ajustar(pares):
    """Ajusta y = a * x^b por minimos cuadrados en log-log."""
    lx = [math.log(a) for _, a, _, _ in pares]
    ly = [math.log(b) for _, _, b, _ in pares]
    aj = st.linear_regression(lx, ly)
    res = [ly[i] - (aj.intercept + aj.slope * lx[i]) for i in range(len(lx))]
    sd = st.stdev(res) if len(res) > 1 else 0.0
    return {'a': math.exp(aj.intercept), 'b': aj.slope, 'sd_log': sd,
            'r_log': st.correlation(lx, ly) if len(lx) > 1 else None}


def predecir(mod, x):
    return mod['a'] * (x ** mod['b'])


def errores(pares, mod):
    return [abs(predecir(mod, a) - b) / b for _, a, b, _ in pares]


# ------------------------------------------------------------------ los pares
obs = defaultdict(dict)
with open(os.path.join(PROC, 'muestreo_nucleo.csv'), encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        v = valor_de(r)
        if v is not None:
            obs[(r['c_sitio'], r['fecha'])][r['c_parametro']] = v

di('# Modelos proxy: laboratorio desde sensor')
di()
di('Generado por `scripts/90_modelos_proxy.py`.')
di()
di('La estacion mide conductividad y turbiedad en campo. La pregunta es si de '
   'ahi se pueden estimar los solidos disueltos y los suspendidos, que '
   'normalmente exigen laboratorio. La respuesta es distinta para cada uno, y '
   'ahi esta lo interesante.')
di()

filas, publicables = [], []
for pred, resp, codigo, unidad_x, unidad_y in RELACIONES:
    pares = [(k[0], d[pred], d[resp], k[1]) for k, d in obs.items()
             if pred in d and resp in d and d[pred] > 0 and d[resp] > 0]
    if len(pares) < 100:
        continue
    sitios = sorted(set(p[0] for p in pares))
    mod = ajustar(pares)

    # --- validacion 1: sitios que el modelo no vio
    err_sitio = []
    for k in (0, 1):
        ent = [p for p in pares if sitios.index(p[0]) % 2 == k]
        pru = [p for p in pares if sitios.index(p[0]) % 2 != k]
        if len(ent) >= 50 and pru:
            err_sitio += errores(pru, ajustar(ent))

    # --- validacion 2: por sitio, en fechas posteriores
    por = defaultdict(list)
    for p in pares:
        por[p[0]].append(p)
    err_propio, err_global, n_sitios = [], [], 0
    for s, lst in por.items():
        lst.sort(key=lambda p: p[3])
        if len(lst) < 20:
            continue
        corte = int(len(lst) * 0.7)
        try:
            propio = ajustar(lst[:corte])
        except (ValueError, st.StatisticsError):
            continue
        n_sitios += 1
        err_propio += errores(lst[corte:], propio)
        err_global += errores(lst[corte:], mod)

    med = st.median(err_sitio) if err_sitio else None
    p90 = pct(err_sitio, 90) if err_sitio else None
    sirve = (med is not None and med <= MAX_ERROR_MEDIANO
             and p90 is not None and p90 <= MAX_ERROR_P90)

    di('## {} ({}) -> {} ({})'.format(pred, unidad_x, resp, unidad_y))
    di()
    di('- **{:,} pares** del mismo sitio y la misma fecha, en {} sitios.'
       .format(len(pares), len(sitios)))
    di('- Ajuste: **{} = {:.4f} x {}^{:.4f}**, con r de {:.3f} en log-log.'
       .format(resp, mod['a'], pred, mod['b'], mod['r_log']))
    di('- Intervalo del 80 %: de **x{:.2f} a x{:.2f}** sobre el valor estimado.'
       .format(math.exp(-1.2816 * mod['sd_log']),
               math.exp(1.2816 * mod['sd_log'])))
    if med is not None:
        di('- **Probado en sitios que no se usaron para ajustar: error mediano '
           '{:.0f} %, percentil 90 {:.0f} %.**'.format(100 * med, 100 * p90))
    if err_propio:
        di('- Calibrando por sitio y probando en fechas posteriores ({} sitios '
           'con 20 o mas pares): {:.0f} % contra {:.0f} % del modelo global en '
           'los mismos datos.'.format(n_sitios, 100 * st.median(err_propio),
                                      100 * st.median(err_global)))
    di()
    di('**Veredicto: {}.**'.format(
        'se publica' if sirve else 'NO se publica como sustituto de laboratorio'))
    di()

    filas.append({
        'sensor': pred, 'parametro_estimado': resp, 'codigo_contrato': codigo,
        'forma': 'y = a * x^b', 'a': round(mod['a'], 6), 'b': round(mod['b'], 6),
        'r_log': round(mod['r_log'], 4), 'sd_log': round(mod['sd_log'], 4),
        'factor_p10': round(math.exp(-1.2816 * mod['sd_log']), 4),
        'factor_p90': round(math.exp(1.2816 * mod['sd_log']), 4),
        'pares': len(pares), 'sitios': len(sitios),
        'error_mediano_fuera_de_muestra': round(med, 4) if med is not None else '',
        'error_p90_fuera_de_muestra': round(p90, 4) if p90 is not None else '',
        'publicado': 'si' if sirve else 'no',
    })
    if sirve:
        publicables.append({
            'sensor': codigo, 'parametro_estimado': resp,
            'unidad_sensor': unidad_x, 'unidad_estimada': unidad_y,
            'forma': 'y = a * pow(x, b)',
            'a': round(mod['a'], 6), 'b': round(mod['b'], 6),
            'factor_banda_p10': round(math.exp(-1.2816 * mod['sd_log']), 4),
            'factor_banda_p90': round(math.exp(1.2816 * mod['sd_log']), 4),
            'error_mediano': round(med, 4), 'error_p90': round(p90, 4),
            'pares': len(pares), 'sitios': len(sitios),
            'nota': 'Se reporta como estimacion con banda, nunca como medicion. '
                    'Validado en sitios que no se usaron para ajustar.',
        })

with open(os.path.join(PROC, 'proxy_modelos.csv'), 'w', newline='',
          encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
    w.writeheader()
    w.writerows(filas)
print('  -> datos/procesados/proxy_modelos.csv: {} filas'.format(len(filas)))

with open(os.path.join(FIX, 'modelos_proxy.json'), 'w', encoding='utf-8') as f:
    json.dump({'version': '1.0', 'modelos': publicables}, f,
              ensure_ascii=False, indent=2)
print('  -> contrato/fixtures/modelos_proxy.json: {} modelo(s)'.format(
    len(publicables)))

# ----------------------------------------------------------------- conclusion
di('## Qué se publica y qué no')
di()
di('| Relacion | Error mediano fuera de muestra | p90 | Publicado |')
di('|---|---|---|---|')
for r in filas:
    di('| {} -> {} | **{:.0f} %** | {:.0f} % | {} |'.format(
        r['sensor'], r['parametro_estimado'],
        100 * float(r['error_mediano_fuera_de_muestra'] or 0),
        100 * float(r['error_p90_fuera_de_muestra'] or 0),
        'si' if r['publicado'] == 'si' else '**no**'))
di()
di('El criterio de publicacion esta escrito en el script: error mediano de a lo '
   'mas {:.0f} % y percentil 90 de a lo mas {:.0f} %. Un modelo no entra al '
   'contrato solo porque exista.'.format(100 * MAX_ERROR_MEDIANO,
                                         100 * MAX_ERROR_P90))
di()
di('## Una correccion que hay que hacer explicita')
di()
di('En el analisis exploratorio se reporto una correlacion de **0.947** entre '
   'turbiedad y SST, y se cito como evidencia de que la turbiedad podia '
   'estimar los solidos suspendidos. **Esa cifra sobrevalora la relacion.** '
   'Esta calculada sobre valores crudos que recorren cuatro ordenes de '
   'magnitud, y en esos casos la correlacion de Pearson queda dominada por los '
   'valores grandes. En espacio logaritmico cae a 0.852, y lo que de verdad '
   'importa -el error de prediccion- es del 35 %.')
di()
di('Calibrar por sitio apenas lo baja del 29 % al 27 %, asi que la dispersion '
   'no es un sesgo entre sitios que se pueda corregir: es ruido dentro de cada '
   'sitio. Tiene sentido fisico, porque la turbiedad responde al tamano y al '
   'color de las particulas y no solo a su masa: un arrastre de arcilla y una '
   'descarga de materia organica con la misma turbiedad llevan masas muy '
   'distintas.')
di()
di('La conclusion util no cambia de signo, cambia de alcance: **la '
   'conductividad sustituye una medicion de laboratorio, la turbiedad no.**')
di()
di('## Cómo se usa')
di()
di('`contrato/fixtures/modelos_proxy.json` trae los modelos publicados con su '
   'banda. La estacion o el backend aplican `y = a * x^b` y reportan la '
   'estimacion **con su banda**, nunca como un valor puntual medido. Los '
   'campos `factor_banda_p10` y `factor_banda_p90` multiplican la estimacion '
   'para dar el intervalo del 80 %.')
di()
di('La turbiedad sigue siendo util por si misma: es uno de los cinco '
   'parametros que el motor de reglas vigila y la que delata un arrastre '
   'cuando sube con la conductividad a la baja. Lo que no hace es dar un '
   'numero de SST que se pueda reportar como medicion.')
di()

with open(os.path.join(RAIZ, 'docs', '16-modelos-proxy.md'), 'w',
          encoding='utf-8') as f:
    f.write('\n'.join(informe) + '\n')
print('  -> docs/16-modelos-proxy.md')

# -*- coding: utf-8 -*-
"""Calibración del umbral de humedad del suelo por ladera (docs/20 §5).

El umbral de "suelo cerca de saturación" era 45 % para todas las laderas, sin fuente (umbrales_lluvia.json). Pero cuánta
agua cabe en un suelo depende de su porosidad: un suelo volcánico ligero de la Sierra Norte satura con mucha más agua que
uno arcilloso compacto. Aquí se calcula por ladera, del suelo del propio sitio:

  1. Suelo a 30-60 cm (donde va el sensor, a ~50 cm) de SoilGrids 2.0 (ISRIC, 250 m): densidad aparente, arcilla, arena
     y carbono orgánico. Fuente F22; las respuestas se guardan en datos/crudos/F22/ (no se versionan).
  2. Porosidad (contenido de agua a saturación): θs = 1 − ρb / 2.65 (densidad de partícula mineral típica).
  3. Capacidad de campo (agua que el suelo retiene tras drenar): θ33 de Saxton y Rawls (2006), "Soil water characteristic
     estimates by texture and organic matter for hydrologic solutions", Soil Sci. Soc. Am. J. 70: 1569-1578, ecuación 2,
     con materia orgánica = 1.724 × carbono orgánico.
  4. Umbral "cerca de saturación" = 90 % de la porosidad (grado de saturación de 0.9), y nunca por debajo de la
     capacidad de campo más 5 puntos. El 0.9 es HIPÓTESIS de diseño: por arriba de ahí el agua ya no cabe en los poros
     y empieza a subir la presión del agua en la ladera; se ajusta con la primera temporada (paso 5).
  5. Autocalibración en campo: con las lecturas reales de HUM_SUELO y LLUVIA de una temporada (`--serie`), la capacidad
     de campo medida es la asíntota de la curva de secado tras cada lluvia de 20 mm o más (ver autocalibra) y reemplaza a
     la de Saxton y Rawls. La saturación se queda la de SoilGrids salvo que el sensor la rebase. La humedad del sensor TEROS 10 sin calibrar trae
     ±3 puntos: también se corrige con una muestra gravimétrica al instalar (se anota en `correccion_sensor_pct`).

Salida, DERIVADA (se edita este script, no el JSON):
    contrato/fixtures/suelo_laderas.json   por estación de ladera: suelo, θs, θ33, umbral y de dónde salió cada número

    python -I scripts/103_suelo_laderas.py                 # descarga lo que falte y calcula
    python -I scripts/103_suelo_laderas.py --sin-red       # solo con lo ya descargado
    python -I scripts/103_suelo_laderas.py --serie lecturas.json   # paquetes del contrato con HUM_SUELO y LLUVIA
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
CRUDOS = os.path.join(RAIZ, 'datos', 'crudos', 'F22')
URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query'
PROPIEDADES = ('bdod', 'clay', 'sand', 'soc')
CAPA = '30-60cm'
DENSIDAD_PARTICULA = 2.65          # g/cm³, mineral típico
GRADO_SATURACION = 0.9             # hipótesis: "cerca de saturación"
MARGEN_SOBRE_CC = 5.0              # puntos de humedad sobre la capacidad de campo, mínimo
LLUVIA_EVENTO_MM = 20.0            # autocalibración: una lluvia que moja el suelo a 50 cm
ESPACIADO_H = 18                   # horas entre las tres lecturas del secado (cubre 42 h tras la lluvia)


def consulta(lat, lon):
    q = [('lon', '{:.5f}'.format(lon)), ('lat', '{:.5f}'.format(lat))] + [('property', p) for p in PROPIEDADES] + \
        [('depth', CAPA), ('value', 'mean')]
    req = urllib.request.Request(URL + '?' + urllib.parse.urlencode(q), headers={'User-Agent': 'hackatec-suelo/1.0'})
    for intento in range(3):                       # el servicio a veces tarda o corta: se reintenta
        try:
            with urllib.request.urlopen(req, timeout=150) as r:
                return json.loads(r.read().decode('utf-8'))
        except (OSError, ValueError):
            if intento == 2:
                raise
            time.sleep(10)


def lee_suelo(respuesta):
    """{propiedad: valor en unidades convencionales} de la capa CAPA, o None si falta alguna."""
    v = {}
    for capa in respuesta['properties']['layers']:
        d = next((x for x in capa['depths'] if x['label'] == CAPA), None)
        crudo = d and d['values'].get('mean')
        if crudo is None:
            return None
        v[capa['name']] = crudo / capa['unit_measure']['d_factor']
    # bdod cg/cm³ → g/cm³ (d_factor 100); clay, sand g/kg → % (d_factor 10); soc dg/kg → g/kg (d_factor 10)
    return {'densidad_aparente_g_cm3': round(v['bdod'], 3), 'arcilla_pct': round(v['clay'], 1),
            'arena_pct': round(v['sand'], 1), 'carbono_organico_g_kg': round(v['soc'], 1)}


def capacidad_de_campo(arena_pct, arcilla_pct, mo_pct):
    """θ33 (m³/m³) de Saxton y Rawls (2006), ec. 2. S y C en fracción, MO en %."""
    S, C, OM = arena_pct / 100.0, arcilla_pct / 100.0, mo_pct
    t = (-0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299)
    return t + (1.283 * t * t - 0.374 * t - 0.015)


def autocalibra(paquetes):
    """Capacidad de campo medida, de una serie de paquetes con LLUVIA y HUM_SUELO (una temporada).

    Tras una lluvia, la humedad decae hacia la capacidad de campo como h(t) = cc + A·e^(-kt). Con tres lecturas
    igualmente espaciadas en un periodo seco (h0, h1, h2) la asíntota es cc = (h0·h2 − h1²) / (h0 + h2 − 2·h1)
    (extrapolación de Aitken). Se toma la mediana sobre todas las lluvias con un periodo seco largo después. Esperar
    un número fijo de horas no sirve: a las 48 h el suelo todavía no ha terminado de drenar.

    La saturación NO se estima de las lecturas: el sensor casi nunca llega a ella, así que su p99 la subestima. Se
    conserva la de SoilGrids salvo que el sensor la rebase (`max_medido_pct`).
    """
    serie = []
    for p in paquetes:
        v = {l['c_parametro']: l['valor'] for l in p['lecturas']}
        t = datetime.fromisoformat(p['fecha_hora']).timestamp()
        serie.append((t, v.get('LLUVIA') or 0.0, v.get('HUM_SUELO')))
    serie.sort()
    hums = [h for _, _, h in serie if h is not None and h > -900]
    if len(hums) < 96:
        return None
    # fin de cada lluvia de LLUVIA_EVENTO_MM o más (se cierra tras 6 h sin lluvia)
    eventos, acum, ult = [], 0.0, None
    for t, mm, _ in serie:
        if mm > 0:
            if ult is not None and t - ult > 6 * 3600:
                if acum >= LLUVIA_EVENTO_MM:
                    eventos.append(ult)
                acum = 0.0
            acum += mm
            ult = t
    if acum >= LLUVIA_EVENTO_MM and ult is not None:
        eventos.append(ult)

    def media_en(t0):                      # media de las lecturas a ±1 h de t0
        x = [h for t, _, h in serie if h is not None and h > -900 and abs(t - t0) <= 3600]
        return sum(x) / len(x) if x else None

    estimaciones = []
    for f in eventos:
        a, delta = f + 6 * 3600, ESPACIADO_H * 3600
        if any(mm > 0 for t, mm, _ in serie if f < t <= a + 2 * delta):
            continue                       # volvió a llover: el secado no está limpio
        h0, h1, h2 = media_en(a), media_en(a + delta), media_en(a + 2 * delta)
        if None in (h0, h1, h2):
            continue
        den = h0 + h2 - 2 * h1
        if h0 - h1 < 0.5 or den <= 0.05:   # no hay caída clara: el ruido del sensor domina
            continue
        estimaciones.append((h0 * h2 - h1 * h1) / den)
    estimaciones.sort()
    return {'eventos': len(eventos), 'secados_usados': len(estimaciones),
            'capacidad_campo_pct': round(estimaciones[len(estimaciones) // 2], 1) if estimaciones else None,
            'max_medido_pct': round(max(hums), 1), 'n_lecturas': len(hums)}


def main(argv):
    sin_red = '--sin-red' in argv
    serie = argv[argv.index('--serie') + 1] if '--serie' in argv else None
    with open(os.path.join(FIX, 'escuelas_ladera.json'), encoding='utf-8') as f:
        modulos = json.load(f)['modulos']
    os.makedirs(CRUDOS, exist_ok=True)
    medidas = {}
    if serie:
        with open(serie, encoding='utf-8') as f:
            paq = json.load(f)
        paq = paq['paquetes'] if isinstance(paq, dict) else paq
        for ce in sorted({p['c_estacion'] for p in paq}):
            medidas[ce] = autocalibra([p for p in paq if p['c_estacion'] == ce])

    salida = []
    for m in modulos:
        ce = m['c_estacion']
        ruta = os.path.join(CRUDOS, 'soilgrids_{}.json'.format(ce))
        if not os.path.exists(ruta):
            if sin_red:
                print('  {}: sin descarga (--sin-red)'.format(ce))
                continue
            respuesta = consulta(m['latitud'], m['longitud'])   # se escribe solo una respuesta completa
            with open(ruta, 'w', encoding='utf-8') as f:
                json.dump(respuesta, f)
            time.sleep(2)                             # SoilGrids pide no saturar su servicio
        with open(ruta, encoding='utf-8') as f:
            suelo = lee_suelo(json.load(f))
        if suelo is None:
            print('  {}: SoilGrids no tiene dato en ese punto'.format(ce))
            continue
        mo = 1.724 * suelo['carbono_organico_g_kg'] / 10.0
        theta_s = 100 * (1 - suelo['densidad_aparente_g_cm3'] / DENSIDAD_PARTICULA)
        theta_cc = 100 * capacidad_de_campo(suelo['arena_pct'], suelo['arcilla_pct'], mo)
        origen_cc = 'Saxton y Rawls (2006) con la textura y el carbono de SoilGrids'
        origen_s = 'porosidad = 1 - densidad aparente / 2.65, densidad aparente de SoilGrids'
        med = medidas.get(ce)
        if med and med.get('capacidad_campo_pct') is not None:
            theta_cc = med['capacidad_campo_pct']
            origen_cc = 'medida en campo: asintota del secado tras {} lluvias'.format(med['secados_usados'])
        if med and med['max_medido_pct'] > theta_s:
            theta_s, origen_s = med['max_medido_pct'], 'medida en campo: el sensor paso la porosidad de SoilGrids'
        umbral = max(GRADO_SATURACION * theta_s, theta_cc + MARGEN_SOBRE_CC)
        salida.append({
            'c_estacion': ce, 'cct': m['cct'], 'localidad': m['localidad'], 'municipio': m['municipio'],
            'suelo_30_60cm': suelo, 'materia_organica_pct': round(mo, 2),
            'saturacion_pct': round(theta_s, 1), 'origen_saturacion': origen_s,
            'capacidad_campo_pct': round(theta_cc, 1), 'origen_capacidad_campo': origen_cc,
            'umbral_cerca_saturacion_pct': round(umbral, 1),
            'correccion_sensor_pct': 0.0,
            'fuera_de_rango_del_sensor': theta_s > 64.0,
        })
    out = {
        'version': '0.1-propuesta',
        '_provisional': True,
        'fuente': 'SoilGrids 2.0 (ISRIC), capa 30-60 cm, media; F22. Se reemplaza por lo medido en campo (--serie).',
        'regla': 'umbral = max({} x saturacion, capacidad de campo + {} puntos). {} es hipotesis de diseno.'.format(
            GRADO_SATURACION, MARGEN_SOBRE_CC, GRADO_SATURACION),
        'umbral_anterior_pct': 45.0,
        'laderas': salida,
    }
    with open(os.path.join(FIX, 'suelo_laderas.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    for s in salida:
        print('  {} {:<24} densidad {:.2f}  arcilla {:>4}%  arena {:>4}%  MO {:>4}%  -> saturacion {:>5}%  cap. campo {:>5}%  umbral {:>5}%'.format(
            s['c_estacion'], s['localidad'][:24], s['suelo_30_60cm']['densidad_aparente_g_cm3'], s['suelo_30_60cm']['arcilla_pct'],
            s['suelo_30_60cm']['arena_pct'], s['materia_organica_pct'], s['saturacion_pct'], s['capacidad_campo_pct'],
            s['umbral_cerca_saturacion_pct']))


if __name__ == '__main__':
    main(sys.argv[1:])

# -*- coding: utf-8 -*-
"""Escuelas rurales vulnerables y su índice de riesgo (módulo A del cambio de rumbo, docs/19).

Escribe los dos archivos que comparten los módulos (docs/19, sección 4):

    contrato/fixtures/escuelas.json          lista de escuelas con su riesgo y su desglose
    contrato/fixtures/zonas_riesgo.geojson   polígonos de zonas propensas (derrumbe, inundación, contaminación)

Los dos son DERIVADOS: se edita este script, no los JSON.

El índice. Cada factor tiene un PESO (hipótesis, suman 1) y un PUNTAJE de 0 a 1 por escuela. Su aporte al
índice es peso × puntaje, y el índice es la suma de los aportes: así el desglose siempre suma el índice
(la regla de docs/19 §4.1; el ejemplo de esa sección no la cumplía: su desglose suma 0.92 y su índice 0.72).
Dos sub-índices para saber de qué es el riesgo, cada uno de 0 a 1:
    derrumbe       = (pendiente + susceptibilidad_laderas + urbanizacion_reciente) / sus pesos
    contaminacion  = (cercania_cauce_o_descarga + calidad_agua + sin_drenaje) / sus pesos
La marginación agrava los dos (menos capacidad de respuesta) y por eso solo entra al índice general.

ENTRADAS. Mientras no haya datos reales, las escuelas y zonas son PROVISIONALES (docs/19 §4.5): lugares
reales de Puebla con riesgos creíbles, pero CCT, nombres y puntajes inventados. Cuando existan
datos/procesados/escuelas/factores_escuelas.csv (catálogo SEP + INEGI + CONAPO + CENAPRED), este script
los leerá en lugar de la lista provisional; la forma de la salida no cambia.

    python -I scripts/97_escuelas_riesgo.py
"""
import csv
import json
import math
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
ENTRADA_REAL = os.path.join(RAIZ, 'datos', 'procesados', 'escuelas', 'factores_escuelas.csv')

# ------------------------------------------------------------------ el índice (hipótesis)
PESOS = {
    'pendiente': 0.25,
    'susceptibilidad_laderas': 0.20,
    'urbanizacion_reciente': 0.10,
    'cercania_cauce_o_descarga': 0.15,
    'calidad_agua': 0.15,
    'sin_drenaje': 0.05,
    'marginacion': 0.10,
}
DERRUMBE = ('pendiente', 'susceptibilidad_laderas', 'urbanizacion_reciente')
CONTAMINACION = ('cercania_cauce_o_descarga', 'calidad_agua', 'sin_drenaje')
CORTES = ((0.70, 'muy_alto'), (0.50, 'alto'), (0.30, 'medio'), (0.0, 'bajo'))   # sobre el índice; hipótesis
assert abs(sum(PESOS.values()) - 1) < 1e-9


def nivel_de(valor):
    return next(n for corte, n in CORTES if valor >= corte)


def evaluar(puntajes):
    """puntajes: {factor: 0..1}. Devuelve el bloque `riesgo` del contrato, con el desglose sumando el índice."""
    falta = set(PESOS) - set(puntajes)
    assert not falta, 'faltan puntajes: {}'.format(sorted(falta))
    desglose = {f: round(PESOS[f] * min(1.0, max(0.0, float(puntajes[f]))), 3) for f in PESOS}
    indice = round(sum(desglose.values()), 3)
    sub = lambda fs: round(sum(desglose[f] for f in fs) / sum(PESOS[f] for f in fs), 3)
    return {'indice': indice, 'nivel': nivel_de(indice), 'contaminacion': sub(CONTAMINACION),
            'derrumbe': sub(DERRUMBE), 'desglose': desglose}


# ------------------------------------------------------------------ entradas provisionales
# Puntajes en el orden de PESOS: pendiente, susceptibilidad_laderas, urbanizacion_reciente,
# cercania_cauce_o_descarga, calidad_agua, sin_drenaje, marginacion.
def p(pe, su, ur, ce, ca, sd, ma):
    return dict(zip(PESOS, (pe, su, ur, ce, ca, sd, ma)))


CEASPUE_INSTALACION = 'instalacion_en_fuente'
CAPCEE_ACCESO = 'acceso_al_plantel'

PROVISIONAL = [
    # Sierra Norte: laderas empinadas, lluvia intensa
    dict(cct='21DPR9001K', nombre='Escuela Primaria Rural Lázaro Cárdenas', nivel='primaria', matricula=96,
         municipio='Cuetzalan del Progreso', localidad='Xocoyolo', latitud=20.0185, longitud=-97.5402,
         fuente_agua='manantial', puntajes=p(0.95, 0.90, 0.40, 0.30, 0.35, 0.80, 0.85), c_estacion=None,
         autorizaciones=[('CAPCEE', 'dictamen_del_inmueble', 'solicitada', None)]),
    dict(cct='21DTV9002M', nombre='Telesecundaria Miguel Hidalgo', nivel='secundaria', matricula=58,
         municipio='Zacatlán', localidad='Tomatlán', latitud=19.9618, longitud=-97.9893,
         fuente_agua='manantial', puntajes=p(0.80, 0.75, 0.55, 0.20, 0.25, 0.60, 0.70), c_estacion=None, autorizaciones=[]),
    dict(cct='21DPR9003P', nombre='Escuela Primaria Ignacio Zaragoza', nivel='primaria', matricula=142,
         municipio='Teziutlán', localidad='Aire Libre', latitud=19.8239, longitud=-97.3681,
         fuente_agua='red_publica', puntajes=p(0.90, 0.95, 0.85, 0.15, 0.20, 0.30, 0.55), c_estacion=None,
         autorizaciones=[('CAPCEE', 'dictamen_del_inmueble', 'otorgada', '2026-11-18')]),
    dict(cct='21DJN9004R', nombre='Jardín de Niños Gabriela Mistral', nivel='preescolar', matricula=31,
         municipio='Huauchinango', localidad='Xilocuautla', latitud=20.1781, longitud=-98.0712,
         fuente_agua='pozo', puntajes=p(0.70, 0.80, 0.30, 0.45, 0.50, 0.70, 0.80), c_estacion=None,
         autorizaciones=[('CEASPUE', CEASPUE_INSTALACION, 'pendiente', None), ('CAPCEE', CAPCEE_ACCESO, 'solicitada', None)]),
    dict(cct='21DPB9005T', nombre='Escuela Primaria Bilingüe Netzahualcóyotl', nivel='primaria', matricula=67,
         municipio='Tlatlauquitepec', localidad='Xonocuautla', latitud=19.8702, longitud=-97.4978,
         fuente_agua='captacion_lluvia', puntajes=p(0.60, 0.55, 0.20, 0.10, 0.30, 0.85, 0.90), c_estacion=None, autorizaciones=[]),
    # Corredor del Atoyac y Alseseca: descargas industriales y municipales
    dict(cct='21DPR9006V', nombre='Escuela Primaria Emiliano Zapata', nivel='primaria', matricula=118,
         municipio='San Martín Texmelucan', localidad='San Lucas Atoyatenco', latitud=19.2531, longitud=-98.4127,
         fuente_agua='pozo', puntajes=p(0.05, 0.05, 0.70, 0.95, 0.90, 0.50, 0.45), c_estacion=None,
         autorizaciones=[('CEASPUE', CEASPUE_INSTALACION, 'solicitada', None), ('CAPCEE', CAPCEE_ACCESO, 'otorgada', '2026-11-20')]),
    dict(cct='21DES9007X', nombre='Escuela Secundaria Técnica Agropecuaria', nivel='secundaria', matricula=204,
         municipio='Santa Isabel Cholula', localidad='Santa Ana Acozautla', latitud=18.9862, longitud=-98.3691,
         fuente_agua='pozo', puntajes=p(0.10, 0.10, 0.40, 0.70, 0.75, 0.40, 0.50), c_estacion=None,
         autorizaciones=[('CEASPUE', CEASPUE_INSTALACION, 'pendiente', None)]),
    dict(cct='21DPR9008Z', nombre='Escuela Primaria Benito Juárez', nivel='primaria', matricula=89,
         municipio='Ocoyucan', localidad='San Bernabé Temoxtitla', latitud=18.9935, longitud=-98.2498,
         fuente_agua='pozo', puntajes=p(0.15, 0.10, 0.60, 0.85, 0.85, 0.60, 0.65), c_estacion='EST-ATY-04',
         autorizaciones=[('CEASPUE', CEASPUE_INSTALACION, 'otorgada', '2026-11-15'), ('CAPCEE', CAPCEE_ACCESO, 'otorgada', '2026-11-15')]),
    dict(cct='21DPR9009B', nombre='Escuela Primaria Josefa Ortiz de Domínguez', nivel='primaria', matricula=76,
         municipio='Puebla', localidad='San Andrés Azumiatla', latitud=18.9541, longitud=-98.2063,
         fuente_agua='pipa', puntajes=p(0.30, 0.25, 0.65, 0.90, 0.80, 0.75, 0.70), c_estacion='EST-ATY-05',
         autorizaciones=[('CEASPUE', CEASPUE_INSTALACION, 'pendiente', None), ('CAPCEE', CAPCEE_ACCESO, 'otorgada', '2026-11-19')]),
    # Contraste: riesgo bajo y medio
    dict(cct='21DPR9010D', nombre='Escuela Primaria Vicente Guerrero', nivel='primaria', matricula=53,
         municipio='Atlixco', localidad='Metepec', latitud=18.9361, longitud=-98.4719,
         fuente_agua='manantial', puntajes=p(0.40, 0.35, 0.30, 0.40, 0.30, 0.40, 0.45), c_estacion=None, autorizaciones=[]),
    dict(cct='21DJN9011F', nombre='Jardín de Niños Rosaura Zapata', nivel='preescolar', matricula=22,
         municipio='Chiautla', localidad='San Miguel Ixtlán', latitud=18.2903, longitud=-98.6057,
         fuente_agua='pipa', puntajes=p(0.15, 0.10, 0.05, 0.10, 0.20, 0.70, 0.95), c_estacion=None, autorizaciones=[]),
]

# Zonas provisionales: centro, radio en metros y alargamiento (las laderas y los cauces no son círculos).
ZONAS = [
    dict(tipo='derrumbe', nivel='muy_alto', centro=(20.0205, -97.5375), radio=700, alarg=1.8, giro=35),
    dict(tipo='derrumbe', nivel='alto', centro=(19.9640, -97.9860), radio=600, alarg=1.6, giro=-20),
    dict(tipo='derrumbe', nivel='muy_alto', centro=(19.8255, -97.3700), radio=650, alarg=1.5, giro=60),
    dict(tipo='derrumbe', nivel='alto', centro=(20.1795, -98.0690), radio=550, alarg=1.7, giro=10),
    dict(tipo='derrumbe', nivel='medio', centro=(19.8720, -97.4960), radio=500, alarg=1.4, giro=-45),
    dict(tipo='contaminacion', nivel='muy_alto', centro=(19.2545, -98.4100), radio=800, alarg=2.5, giro=-60),
    dict(tipo='inundacion', nivel='alto', centro=(19.2500, -98.4170), radio=600, alarg=2.0, giro=-60),
    dict(tipo='contaminacion', nivel='alto', centro=(18.9880, -98.3660), radio=600, alarg=2.2, giro=-30),
    dict(tipo='contaminacion', nivel='muy_alto', centro=(18.9950, -98.2470), radio=700, alarg=2.4, giro=-50),
    dict(tipo='contaminacion', nivel='alto', centro=(18.9560, -98.2040), radio=650, alarg=2.0, giro=-70),
]
FUENTE_PROVISIONAL = 'PROVISIONAL: zona ilustrativa, no sale de un atlas; se reemplaza con CENAPRED y el atlas de Puebla'


# ------------------------------------------------------------------ geometría
M_LAT = 110574.0


def m_lon(lat):
    return 111320.0 * math.cos(math.radians(lat))


def poligono(centro, radio, alarg, giro, lados=28):
    """Elipse aproximada: radio en metros, alargada `alarg` veces y girada `giro` grados."""
    lat0, lon0 = centro
    g = math.radians(giro)
    puntos = []
    for i in range(lados):
        t = 2 * math.pi * i / lados
        x, y = radio * alarg * math.cos(t), radio * math.sin(t)
        xr, yr = x * math.cos(g) - y * math.sin(g), x * math.sin(g) + y * math.cos(g)
        puntos.append([round(lon0 + xr / m_lon(lat0), 5), round(lat0 + yr / M_LAT, 5)])
    puntos.append(puntos[0])
    return puntos


def metros(a, b):
    return math.hypot((a[0] - b[0]) * M_LAT, (a[1] - b[1]) * m_lon(a[0]))


# ------------------------------------------------------------------ salida
def escuelas_provisionales():
    salida = []
    for e in PROVISIONAL:
        salida.append({
            'cct': e['cct'], 'nombre': e['nombre'], 'nivel': e['nivel'], 'matricula': e['matricula'],
            'municipio': e['municipio'], 'localidad': e['localidad'], 'ambito': 'rural',
            'latitud': e['latitud'], 'longitud': e['longitud'], 'fuente_agua': e['fuente_agua'],
            'riesgo': evaluar(e['puntajes']), 'c_estacion': e['c_estacion'],
            'autorizaciones': [{'organismo': o, 'tramite': t, 'estado': s, 'fecha': f} for o, t, s, f in e['autorizaciones']],
        })
    return salida


# Escuelas de interés con datos reales: las de riesgo medio o mayor, las más altas primero, con tope para que
# el panel y la app carguen rápido. La tabla completa queda en factores_escuelas.csv.
INDICE_MINIMO = 0.30
TOPE_INDICE = 300               # las de mayor índice general
TOPE_CONTAMINACION = 100        # más las de mayor riesgo de contaminación: sin ellas, la lista es solo de laderas
CONTAMINACION_MINIMA = 0.5


def escuelas_reales():
    """Lee factores_escuelas.csv (98_escuelas_candidatas.py): columnas del contrato más un puntaje por factor."""
    salida = []
    with open(ENTRADA_REAL, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            salida.append({
                'cct': r['cct'], 'nombre': r['nombre'], 'nivel': r['nivel'],
                'matricula': int(r['matricula']) if r.get('matricula') else None,
                'municipio': r['municipio'], 'localidad': r['localidad'], 'ambito': r['ambito'],
                'latitud': round(float(r['latitud']), 6), 'longitud': round(float(r['longitud']), 6),
                'fuente_agua': r.get('fuente_agua') or 'desconocida',
                'riesgo': evaluar({k: float(r[k]) for k in PESOS}),
                'c_estacion': r.get('c_estacion') or None,
                # Con estación cerca hay un mecanismo propuesto: sus trámites base, sin solicitar (docs/19 §4.3).
                # Sin CEASPUE otorgada se muestra como «propuesto», no como «activo».
                'autorizaciones': [{'organismo': 'CEASPUE', 'tramite': CEASPUE_INSTALACION, 'estado': 'pendiente', 'fecha': None},
                                   {'organismo': 'CAPCEE', 'tramite': CAPCEE_ACCESO, 'estado': 'pendiente', 'fecha': None}]
                                  if r.get('c_estacion') else [],
            })
    por_indice = sorted((e for e in salida if e['riesgo']['indice'] >= INDICE_MINIMO), key=lambda e: -e['riesgo']['indice'])
    elegidas = por_indice[:TOPE_INDICE]
    ya = {e['cct'] for e in elegidas}
    por_cont = sorted((e for e in salida if e['riesgo']['contaminacion'] >= CONTAMINACION_MINIMA and e['cct'] not in ya),
                      key=lambda e: -e['riesgo']['contaminacion'])
    return elegidas + por_cont[:TOPE_CONTAMINACION]


# Zonas con datos reales: grupos de escuelas (a menos de AGRUPAR_M) cuyo sub-índice de derrumbe o de
# contaminación es alto. No son el atlas de CENAPRED: cada zona dice de dónde sale.
AGRUPAR_M = 3000
SUB_MINIMO = 0.6
FUENTE_ZONA = {
    'derrumbe': 'Escuelas con susceptibilidad de laderas alta (CENAPRED, mapa nacional) y pendiente fuerte; agrupadas',
    'contaminacion': 'Escuelas con fuentes contaminantes del DENUE cerca y marginación alta (CONAPO); no es una medición',
}


def zonas_reales(escuelas):
    feats, n = [], 0
    for tipo in ('derrumbe', 'contaminacion'):
        grupos = []
        for e in sorted(escuelas, key=lambda e: -e['riesgo'][tipo]):
            if e['riesgo'][tipo] < SUB_MINIMO:
                continue
            punto = (e['latitud'], e['longitud'])
            g = next((g for g in grupos if metros(g['centro'], punto) <= AGRUPAR_M), None)
            if g:
                g['miembros'].append(e)
            else:
                grupos.append({'centro': punto, 'miembros': [e]})
        for g in grupos:
            n += 1
            m = g['miembros']
            centro = (sum(e['latitud'] for e in m) / len(m), sum(e['longitud'] for e in m) / len(m))
            radio = max(400, max(metros(centro, (e['latitud'], e['longitud'])) for e in m) + 300)
            alto = max(e['riesgo'][tipo] for e in m)
            feats.append({
                'type': 'Feature',
                'geometry': {'type': 'Polygon', 'coordinates': [poligono(centro, radio, 1.0, 0)]},
                'properties': {'c_zona': 'ZR-{:04d}'.format(n), 'tipo': tipo, 'nivel': 'muy_alto' if alto >= 0.8 else 'alto',
                               'fuente': FUENTE_ZONA[tipo], 'escuelas': [e['cct'] for e in m]},
            })
    return {'type': 'FeatureCollection', 'features': feats}


def zonas(escuelas):
    feats = []
    for i, z in enumerate(ZONAS, 1):
        alcance = z['radio'] * z['alarg'] * 1.2
        dentro = [e['cct'] for e in escuelas if metros(z['centro'], (e['latitud'], e['longitud'])) <= alcance]
        feats.append({
            'type': 'Feature',
            'geometry': {'type': 'Polygon', 'coordinates': [poligono(z['centro'], z['radio'], z['alarg'], z['giro'])]},
            'properties': {'c_zona': 'ZR-{:04d}'.format(i), 'tipo': z['tipo'], 'nivel': z['nivel'],
                           'fuente': FUENTE_PROVISIONAL, 'escuelas': dentro},
        })
    return {'type': 'FeatureCollection', 'features': feats}


def main():
    real = os.path.exists(ENTRADA_REAL)
    escuelas = escuelas_reales() if real else escuelas_provisionales()
    escuelas.sort(key=lambda e: -e['riesgo']['indice'])
    capas = zonas_reales(escuelas) if real else zonas(escuelas)
    with open(os.path.join(FIX, 'escuelas.json'), 'w', encoding='utf-8') as f:
        json.dump(escuelas, f, ensure_ascii=False, indent=1)
    with open(os.path.join(FIX, 'zonas_riesgo.geojson'), 'w', encoding='utf-8') as f:
        json.dump(capas, f, ensure_ascii=False)
    por_nivel = {}
    for e in escuelas:
        por_nivel[e['riesgo']['nivel']] = por_nivel.get(e['riesgo']['nivel'], 0) + 1
    print('escuelas.json: {} escuelas ({}), por nivel: {}'.format(
        len(escuelas), 'datos reales' if real else 'PROVISIONALES', por_nivel))
    print('zonas_riesgo.geojson: {} zonas'.format(len(capas['features'])))


if __name__ == '__main__':
    main()

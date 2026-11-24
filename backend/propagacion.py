# -*- coding: utf-8 -*-
"""Prediccion de propagacion (M3) servida por el backend.

M3 vive en scripts/80_propagacion.py, pero ese script calibra el modelo leyendo
muestreo_nucleo.csv, que no se versiona por tamano, y escribe archivos al
importarse. El backend no puede depender de eso en un despliegue.

Por eso aqui se usa lo que M3 PUBLICA en el repositorio:
    datos/procesados/red/tiempo_viaje.csv         ventanas de llegada por par
    datos/procesados/red/atenuacion_observada.csv banda de la razon abajo/arriba
    datos/procesados/sitio.csv                    nombre y tipo de cuerpo
    datos/procesados/red/sitio_aguas_abajo.csv    sitios marcados para revision

y se aplica la misma formula que `predecir()` de M3. Para que las dos no se
desincronicen, backend/prueba.py compara la salida de este modulo contra
contrato/fixtures/prediccion_ejemplo.json, que genera M3: si M3 cambia su
formula o sus constantes, esa prueba falla.
"""
import csv
import os
from collections import defaultdict
from datetime import timedelta

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(RAIZ, 'datos', 'procesados')
RED = os.path.join(PROC, 'red')

# Mismas constantes que scripts/80_propagacion.py. Si cambian alla, la prueba
# contra prediccion_ejemplo.json lo detecta.
VELOCIDAD_MIN_MS = 0.3
VELOCIDAD_MAX_MS = 1.0
FUENTE_VELOCIDAD = 'supuesto_declarado'
TRAMOS_PARA_CONFIANZA = 60
VERSION = '1.0'

# El contrato habla en codigos cortos (COND) y la atenuacion de M3 en claves de
# CONAGUA (CONDUC_CAMPO). La traduccion vive en parametro.csv.
def _leer(ruta):
    with open(ruta, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


class Propagacion:
    def __init__(self):
        self.sitios = {r['c_sitio']: r for r in _leer(os.path.join(PROC, 'sitio.csv'))}
        self.marcados = {r['c_sitio'] for r in _leer(os.path.join(RED, 'sitio_aguas_abajo.csv'))
                         if r.get('revisar')}
        self.atenuacion = {}
        for r in _leer(os.path.join(RED, 'atenuacion_observada.csv')):
            self.atenuacion[r['c_parametro']] = {
                'tramos': int(r['tramos']),
                'razon_p10': float(r['razon_p10']),
                'razon_mediana': float(r['razon_mediana']),
                'razon_p90': float(r['razon_p90']),
            }
        self.descendientes = defaultdict(list)
        for r in _leer(os.path.join(RED, 'tiempo_viaje.csv')):
            self.descendientes[r['c_sitio_arriba']].append({
                'c_sitio_abajo': r['c_sitio_abajo'],
                'distancia_cauce_m': float(r['distancia_cauce_m']),
                'saltos': int(r['saltos']),
                'horas_min': float(r['horas_min']),
                'horas_max': float(r['horas_max']),
                'dentro_de_alcance_util': r['dentro_de_alcance_util'],
            })
        for lst in self.descendientes.values():
            lst.sort(key=lambda f: f['distancia_cauce_m'])
        # codigo del contrato -> clave de CONAGUA
        self.a_conagua = {}
        for r in _leer(os.path.join(PROC, 'parametro.csv')):
            std = (r.get('c_parametro_std') or '').strip()
            if std and std not in self.a_conagua:
                self.a_conagua[std] = r['c_parametro']

    def clave_conagua(self, c_parametro):
        return self.a_conagua.get(c_parametro, c_parametro)

    def predecir(self, c_sitio, c_parametro, valor, cuando, c_alerta):
        """Misma salida que predecir() de scripts/80_propagacion.py.

        c_parametro va en clave de CONAGUA (DQO_TOT, CONDUC_CAMPO...), igual que en M3.
        """
        ate = self.atenuacion.get(c_parametro)
        destinos = []
        for i, f in enumerate(self.descendientes.get(c_sitio, []), start=1):
            cb = f['c_sitio_abajo']
            s = self.sitios.get(cb, {})
            lentico = 'NTIC' in (s.get('tipo_cuerpo') or '').upper()

            if ate and valor is not None:
                v_est = round(valor * ate['razon_mediana'], 3)
                v_min = round(valor * ate['razon_p10'], 3)
                v_max = round(valor * ate['razon_p90'], 3)
            else:
                v_est = v_min = v_max = None

            if f['dentro_de_alcance_util'] == 'no':
                conf = 'baja'
            elif (ate and ate['tramos'] >= TRAMOS_PARA_CONFIANZA
                    and cb not in self.marcados and c_sitio not in self.marcados):
                conf = 'alta' if f['saltos'] <= 3 else 'media'
            else:
                conf = 'media' if ate else 'baja'

            adv = []
            if lentico:
                adv.append('el destino es un cuerpo lentico (presa o laguna): la '
                           'adveccion no describe su tiempo de residencia ni la '
                           'sedimentacion, la llegada es indicativa')
            if cb in self.marcados or c_sitio in self.marcados:
                adv.append('uno de los dos sitios esta marcado para revision en la '
                           'topologia')
            if f['dentro_de_alcance_util'] == 'no':
                adv.append('a {:.0f} km, fuera del alcance operativamente util'
                           .format(f['distancia_cauce_m'] / 1000))

            destinos.append({
                'c_sitio_destino': cb, 'nombre': s.get('nombre', ''),
                'orden_aguas_abajo': i,
                'distancia_cauce_m': f['distancia_cauce_m'],
                'llegada_estimada': {
                    'desde': (cuando + timedelta(hours=f['horas_min'])).isoformat(timespec='seconds'),
                    'hasta': (cuando + timedelta(hours=f['horas_max'])).isoformat(timespec='seconds'),
                },
                'factor_dilucion': None,
                'valor_estimado': v_est,
                'valor_estimado_min': v_min,
                'valor_estimado_max': v_max,
                'c_parametro': c_parametro,
                # El nivel lo clasifica M2 contra la linea base del sitio destino.
                'nivel_esperado': 'Sin dato',
                'confianza': conf,
                'advertencia': '; '.join(adv) if adv else '',
            })

        notas = ('Transporte conservativo: k = 0 porque en {} tramos de este rio '
                 'muestreados el mismo dia la razon de concentracion aguas abajo '
                 'entre aguas arriba tiene mediana 1.00, sin tendencia con la '
                 'distancia. El valor se entrega como banda '
                 '(valor_estimado_min a valor_estimado_max) a partir de los '
                 'percentiles 10 y 90 de esa razon. factor_dilucion va nulo: la '
                 'dilucion ya esta contenida en esa banda medida, y el unico proxy '
                 'disponible (ARBSUM del INEGI) solo explica el 40 % de la '
                 'varianza del caudal en los 33 sitios que lo traen. '
                 'nivel_esperado lo llena M2.'
                 ).format(ate['tramos'] if ate else 0)

        return {
            'version': VERSION, 'c_alerta': c_alerta,
            'modelo': 'transporte_adveccion_decaimiento',
            'supuestos': {
                'velocidad_flujo_m_s': [VELOCIDAD_MIN_MS, VELOCIDAD_MAX_MS],
                'fuente_velocidad': FUENTE_VELOCIDAD,
                'k_decaimiento_por_dia': 0,
                'mezcla_completa': True,
                'caudal_constante': True,
                'notas': notas,
            },
            'destinos': destinos,
        }

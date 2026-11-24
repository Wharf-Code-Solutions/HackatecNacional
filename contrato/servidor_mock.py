# -*- coding: utf-8 -*-
"""Servidor mock del contrato de datos. Solo biblioteca estandar.

Existe por una razon: que nadie espere a nadie. El mapa, el panel y la app se
pueden desarrollar contra este servidor desde el primer dia, antes de que el
backend real exista, y el dispositivo simulado puede enviarle lecturas antes de
que el motor de reglas este escrito.

El evaluador que trae es un STUB deliberadamente tonto, marcado como tal en
cada respuesta (`"motor": "stub"`). El modulo de analisis lo reemplaza cuando
este listo, sin que el resto del equipo tenga que cambiar una linea.

Arranque:
    python contrato/servidor_mock.py            # http://127.0.0.1:8080
    python contrato/servidor_mock.py --puerto 9000

Rutas:
    GET  /salud
    GET  /estaciones
    GET  /linea_base
    GET  /sitios.geojson
    GET  /escenarios                 lista de escenarios disponibles
    GET  /escenarios/<nombre>        paquetes de lecturas de ese escenario
    POST /lecturas                   valida contra el esquema y evalua
    GET  /veredictos                 ultimos veredictos emitidos (?c_estacion= filtra)
    GET  /alertas                    alertas generadas
    PATCH /alertas/<c_alerta>        cambia estado y responsable (panel de autoridad)
    POST /reportes                   reporte ciudadano
    PATCH /reportes/<c_reporte>      cambia el estado de un reporte (panel de autoridad)
    POST /reportes/analizar-foto     la foto corresponde a algun tipo? (Gemini; ver analisis_foto.py)
    GET  /reportes
    GET  /huella                     calor sobre el rio por densidad de reportes (publica)
    GET  /prioridades                focos de reportes con prioridad y desglose (autoridad)
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict, deque
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

AQUI = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(AQUI, 'fixtures')
sys.path.insert(0, AQUI)
from validador import cargar_esquema, validar          # noqa: E402
import analisis_foto                                   # noqa: E402
import prioridad_huella                                # noqa: E402

ESQ_LECTURA = cargar_esquema('lectura')
ESQ_REPORTE = cargar_esquema('reporte_ciudadano')
ESQ_ALERTA = cargar_esquema('alerta')
# Lo unico que la autoridad cambia de una alerta. El resto lo decide el motor.
CAMPOS_GESTION = ('estado', 'responsable')
# De un reporte ciudadano la autoridad solo cambia su estado (Recibido, Validado, En atencion, Cerrado, Descartado).
CAMPOS_GESTION_REPORTE = ('estado',)

# El motor real de M2 vive en motor/reglas.py y se carga solo si se pide con
# --motor real. Por omision se usa el stub, que es la linea base medida contra
# la que M2 compite: sustituirlo en silencio borraria la vara.
MOTOR_REAL = None


def cargar_motor_real():
    import importlib.util
    ruta = os.path.join(os.path.dirname(AQUI), 'motor', 'reglas.py')
    spec = importlib.util.spec_from_file_location('reglas', ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.Motor()


def leer_json(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


ESTACIONES = {e['c_estacion']: e
              for e in leer_json(os.path.join(FIX, 'estaciones.json'))['estaciones']}
# Las estaciones reubicadas junto a escuelas (scripts/99_reubicacion.py), si existen.
if os.path.exists(os.path.join(FIX, 'mecanismos.json')):
    ESTACIONES.update({e['c_estacion']: e
                       for e in leer_json(os.path.join(FIX, 'mecanismos.json'))['estaciones']})
LB = defaultdict(dict)
for r in leer_json(os.path.join(FIX, 'linea_base.json'))['linea_base']:
    LB[r['c_sitio']][r['c_parametro']] = r

# Limite de la clase "Contaminada" de la escala CONAGUA para los parametros de
# campo que la tienen. Es lo unico que el stub sabe de normatividad.
LIMITES = {'TURB': 150.0, 'OD': 4.0}

VEREDICTOS = deque(maxlen=500)
ALERTAS = []
REPORTES = []
CONSECUTIVAS = defaultdict(int)


def evaluar_stub(paquete):
    """Evaluador minimo. Lo sustituye el modulo de analisis (M2)."""
    est = ESTACIONES.get(paquete['c_estacion'])
    sitio = est['c_sitio'] if est else None
    salida = {'version': '1.0', 'motor': 'stub',
              'c_estacion': paquete['c_estacion'],
              'fecha_hora': paquete['fecha_hora'],
              'parametros': [], 'indice_deterioro': None,
              'semaforo_publico': None, 'avisos_tecnicos': [], 'alertas': []}
    excedencias = []
    for l in paquete['lecturas']:
        cp, v = l['c_parametro'], l['valor']
        base = LB.get(sitio, {}).get(cp)
        item = {'c_parametro': cp, 'valor': v, 'clase_conagua': None,
                'veces_el_limite': None, 'posicion_en_banda': 'sin_linea_base',
                'z_robusto': None,
                'n_linea_base': int(base['n']) if base else None}
        if v is None:
            salida['avisos_tecnicos'].append(
                {'tipo': 'sin_reporte', 'c_parametro': cp,
                 'detalle': 'el sensor no envio valor'})
            salida['parametros'].append(item)
            continue
        if v < -100 or (cp == 'PH' and not 0 <= v <= 14):
            salida['avisos_tecnicos'].append(
                {'tipo': 'valor_imposible', 'c_parametro': cp,
                 'detalle': 'valor {} fuera del rango fisico del sensor'.format(v)})
            salida['parametros'].append(item)
            continue
        if base:
            p10, p90 = float(base['p10']), float(base['p90'])
            item['posicion_en_banda'] = (
                'bajo_p10' if v < p10 else 'sobre_p90' if v > p90 else 'normal')
        lim = LIMITES.get(cp)
        if lim:
            item['veces_el_limite'] = round(
                (lim / v if cp == 'OD' and v > 0 else v / lim), 3)
            excedencias.append(item['veces_el_limite'])
        salida['parametros'].append(item)

        clave = (paquete['c_estacion'], cp)
        if item['posicion_en_banda'] in ('bajo_p10', 'sobre_p90'):
            CONSECUTIVAS[clave] += 1
        else:
            CONSECUTIVAS[clave] = 0
        if CONSECUTIVAS[clave] >= 3:
            nivel = 'Critica' if (item['veces_el_limite'] or 0) > 2 else 'Informativa'
            folio = 'AL-{}-{}-{:02d}'.format(
                paquete['fecha_hora'][:10].replace('-', ''),
                paquete['c_estacion'].replace('EST-', '').replace('-', ''),
                len(ALERTAS) + 1)
            alerta = {'version': '1.0', 'c_alerta': folio,
                      'c_estacion': paquete['c_estacion'], 'c_sitio': sitio,
                      'fecha_hora': paquete['fecha_hora'], 'nivel': nivel,
                      'c_parametro': cp, 'valor': v,
                      'regla': 'desviacion_linea_base',
                      'criterio_aplicado': 'LINEA_BASE_SITIO',
                      'lecturas_consecutivas': CONSECUTIVAS[clave],
                      'fuente_probable': None, 'medidas_sugeridas': [],
                      'estado': 'Abierta', 'responsable': None}
            salida['alertas'].append(alerta)
            ALERTAS.append(alerta)
            CONSECUTIVAS[clave] = 0

    if (paquete.get('bateria') or 100) < 20:
        salida['avisos_tecnicos'].append(
            {'tipo': 'bateria_baja', 'c_parametro': None,
             'detalle': 'bateria al {} %'.format(paquete['bateria'])})
    if (paquete.get('senal') or 0) < -100:
        salida['avisos_tecnicos'].append(
            {'tipo': 'enlace_marginal', 'c_parametro': None,
             'detalle': 'RSSI {} dBm'.format(paquete['senal'])})
    if excedencias:
        peor = max(excedencias)
        salida['indice_deterioro'] = round(min(100.0, 100 * peor / 5.0), 1)
        salida['semaforo_publico'] = (
            'Rojo' if peor > 1 else 'Amarillo' if peor > 0.6 else 'Verde')
    VEREDICTOS.append(salida)
    return salida


class Manejador(BaseHTTPRequestHandler):
    server_version = 'ContratoAtoyacMock/1.0'

    def log_message(self, formato, *args):
        sys.stderr.write('%s %s\n' % (self.address_string(), formato % args))

    def _responder(self, codigo, cuerpo):
        datos = json.dumps(cuerpo, ensure_ascii=False).encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(datos)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.end_headers()
        self.wfile.write(datos)

    def do_OPTIONS(self):
        self._responder(204, {})

    def do_GET(self):
        ruta = urlparse(self.path).path.rstrip('/') or '/'
        if ruta == '/salud':
            return self._responder(200, {
                'estado': 'ok', 'version_contrato': '1.0',
                'motor': 'real' if MOTOR_REAL is not None else 'stub',
                'hora': datetime.now().astimezone().isoformat(timespec='seconds'),
                'estaciones': len(ESTACIONES), 'alertas_abiertas': len(ALERTAS),
                'reportes': len(REPORTES)})
        if ruta == '/estaciones':
            return self._responder(200, {'version': '1.0',
                                         'estaciones': list(ESTACIONES.values())})
        if ruta == '/linea_base':
            return self._responder(200, leer_json(os.path.join(FIX, 'linea_base.json')))
        if ruta in ('/sitios.geojson', '/sitios'):
            return self._responder(200, leer_json(os.path.join(FIX, 'sitios.geojson')))
        if ruta == '/escenarios':
            carpeta = os.path.join(FIX, 'escenarios')
            nombres = sorted(a[:-5] for a in os.listdir(carpeta) if a.endswith('.json'))
            return self._responder(200, {'escenarios': nombres})
        m = re.match(r'^/escenarios/([a-z_]+)$', ruta)
        if m:
            ruta_f = os.path.join(FIX, 'escenarios', m.group(1) + '.json')
            if not os.path.exists(ruta_f):
                return self._responder(404, {'error': 'escenario no encontrado'})
            return self._responder(200, leer_json(ruta_f))
        if ruta == '/veredictos':
            est = parse_qs(urlparse(self.path).query).get('c_estacion', [None])[0]
            lista = [v for v in VEREDICTOS if not est or v['c_estacion'] == est]
            return self._responder(200, {'veredictos': lista[-50:]})
        if ruta == '/alertas':
            return self._responder(200, {'alertas': ALERTAS})
        if ruta == '/reportes':
            publico = [{k: v for k, v in r.items() if k != 'correo'} for r in REPORTES]
            return self._responder(200, {'reportes': publico})
        if ruta == '/huella':
            # Calor sobre el rio segun la densidad de reportes abiertos (publica; ver prioridad_huella.py)
            return self._responder(200, prioridad_huella.huella(REPORTES))
        if ruta == '/prioridades':
            # Para la autoridad: foco por foco, con prioridad de 1 a 10 y su desglose
            return self._responder(200, prioridad_huella.prioridades(REPORTES, ALERTAS))
        m = re.match(r'^/reportes/(RC-[0-9]{8}-[0-9]{4})$', ruta)
        if m:
            # Consulta de folio para la app ciudadana (M8). Sin el correo.
            r = next((x for x in REPORTES if x['c_reporte'] == m.group(1)), None)
            if r is None:
                return self._responder(404, {'error': 'folio no encontrado'})
            return self._responder(200, {k: v for k, v in r.items() if k != 'correo'})
        return self._responder(404, {'error': 'ruta no encontrada', 'ruta': ruta})

    def _leer_cuerpo(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0:
            return None, 'cuerpo vacio'
        try:
            return json.loads(self.rfile.read(n).decode('utf-8')), None
        except (ValueError, UnicodeDecodeError) as e:
            return None, 'JSON invalido: {}'.format(e)

    def do_POST(self):
        ruta = urlparse(self.path).path.rstrip('/') or '/'
        cuerpo, problema = self._leer_cuerpo()
        if problema:
            return self._responder(400, {'error': problema})

        if ruta == '/lecturas':
            paquetes = cuerpo if isinstance(cuerpo, list) else [cuerpo]
            resultados, errores = [], []
            for i, p in enumerate(paquetes):
                e = validar(p, ESQ_LECTURA, '$[{}]'.format(i))
                if e:
                    errores += e
                    continue
                if p['c_estacion'] not in ESTACIONES:
                    errores.append('$[{}].c_estacion: {} no esta registrada'.format(
                        i, p['c_estacion']))
                    continue
                if MOTOR_REAL is not None:
                    v = MOTOR_REAL.evaluar(p)
                    v['motor'] = 'real'
                    VEREDICTOS.append(v)
                    ALERTAS.extend(v['alertas'])
                    resultados.append(v)
                else:
                    resultados.append(evaluar_stub(p))
            if errores:
                return self._responder(422, {'error': 'contrato no cumplido',
                                             'detalles': errores,
                                             'aceptados': len(resultados)})
            return self._responder(202, {'aceptados': len(resultados),
                                         'veredictos': resultados})

        if ruta == '/reportes/analizar-foto':
            # La app pregunta aqui si la foto corresponde a algun tipo, antes de dejar enviar el reporte
            ip = self.client_address[0]
            if not analisis_foto.permitir(ip):
                return self._responder(429, {'error': 'demasiadas solicitudes', 'detalle': 'espera un minuto'})
            r = analisis_foto.analizar(cuerpo.get('foto') if isinstance(cuerpo, dict) else None)
            return self._responder(422 if r['estado'] == 'rechazada' else 200, r)

        if ruta == '/reportes':
            cuerpo.setdefault('version', '1.0')
            cuerpo.setdefault('estado', 'Recibido')
            cuerpo.setdefault('exif_removido', False)
            cuerpo.setdefault('c_reporte', 'RC-{}-{:04d}'.format(
                datetime.now().strftime('%Y%m%d'), len(REPORTES) + 1))
            cuerpo.setdefault('fecha_hora',
                              datetime.now().astimezone().isoformat(timespec='seconds'))
            e = validar(cuerpo, ESQ_REPORTE)
            if e:
                return self._responder(422, {'error': 'contrato no cumplido',
                                             'detalles': e})
            if not cuerpo['exif_removido']:
                return self._responder(409, {
                    'error': 'la foto conserva metadatos EXIF',
                    'detalle': 'quita el EXIF antes de enviar: lleva coordenadas '
                               'y modelo del telefono'})
            REPORTES.append(cuerpo)
            return self._responder(201, {'c_reporte': cuerpo['c_reporte'],
                                         'estado': cuerpo['estado']})

        return self._responder(404, {'error': 'ruta no encontrada', 'ruta': ruta})

    def do_PATCH(self):
        ruta = urlparse(self.path).path.rstrip('/') or '/'
        r = re.match(r'^/reportes/(RC-[0-9]{8}-[0-9]{4})$', ruta)
        if r:
            reporte = next((x for x in REPORTES if x['c_reporte'] == r.group(1)), None)
            if reporte is None:
                return self._responder(404, {'error': 'folio no encontrado'})
            cuerpo, problema = self._leer_cuerpo()
            if problema:
                return self._responder(400, {'error': problema})
            if not isinstance(cuerpo, dict):
                return self._responder(422, {'error': 'se espera un objeto'})
            ajenos = sorted(set(cuerpo) - set(CAMPOS_GESTION_REPORTE))
            if ajenos:
                return self._responder(422, {'error': 'solo se puede cambiar el estado', 'detalles': ajenos})
            e = validar(dict(reporte, **cuerpo), ESQ_REPORTE)
            if e:
                return self._responder(422, {'error': 'contrato no cumplido', 'detalles': e})
            reporte.update(cuerpo)
            return self._responder(200, {k: v for k, v in reporte.items() if k != 'correo'})
        m = re.match(r'^/alertas/([A-Z0-9-]+)$', ruta)
        if not m:
            return self._responder(404, {'error': 'ruta no encontrada', 'ruta': ruta})
        alerta = next((a for a in ALERTAS if a['c_alerta'] == m.group(1)), None)
        if alerta is None:
            return self._responder(404, {'error': 'alerta no encontrada'})
        cuerpo, problema = self._leer_cuerpo()
        if problema:
            return self._responder(400, {'error': problema})
        if not isinstance(cuerpo, dict):
            return self._responder(422, {'error': 'se espera un objeto'})
        ajenos = sorted(set(cuerpo) - set(CAMPOS_GESTION))
        if ajenos:
            return self._responder(422, {
                'error': 'solo se pueden cambiar estado y responsable',
                'detalles': ajenos})
        if isinstance(cuerpo.get('responsable'), str):
            cuerpo['responsable'] = cuerpo['responsable'].strip() or None
        nueva = dict(alerta, **cuerpo)
        e = validar(nueva, ESQ_ALERTA)
        if e:
            return self._responder(422, {'error': 'contrato no cumplido', 'detalles': e})
        alerta.update(cuerpo)
        return self._responder(200, alerta)


def main():
    ap = argparse.ArgumentParser(description='Servidor mock del contrato')
    ap.add_argument('--puerto', type=int, default=8080)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--motor', choices=('stub', 'real'), default='stub',
                    help='stub es el evaluador provisional; real carga '
                         'motor/reglas.py (M2)')
    args = ap.parse_args()
    global MOTOR_REAL
    if args.motor == 'real':
        MOTOR_REAL = cargar_motor_real()
    # En Windows, SO_REUSEADDR deja que DOS servidores escuchen el mismo puerto y las peticiones van al mas
    # viejo: un mock olvidado con codigo anterior contesta en lugar del nuevo. Se desactiva para que el
    # segundo falle con un mensaje claro.
    ThreadingHTTPServer.allow_reuse_address = os.name != 'nt'
    try:
        srv = ThreadingHTTPServer((args.host, args.puerto), Manejador)
    except OSError as e:
        sys.exit('No se pudo abrir el puerto {}: {}\nOtro servidor lo esta usando (un mock anterior?). '
                 'Detenlo con Ctrl+C en su terminal y vuelve a arrancar este.'.format(args.puerto, e))
    print('Contrato 1.0 (motor: {}) en http://{}:{}'.format(
        args.motor, args.host, args.puerto))
    print('Estaciones cargadas: {}'.format(', '.join(sorted(ESTACIONES))))
    print('Ctrl+C para detener.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nDetenido.')


if __name__ == '__main__':
    main()

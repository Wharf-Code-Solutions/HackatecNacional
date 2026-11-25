# -*- coding: utf-8 -*-
"""Pruebas del backend M5. Sale con codigo 1 si alguna falla.

    backend\\.venv\\Scripts\\python -I backend/prueba.py

Con Postgres en lugar de SQLite (una base nueva por caso, sobre un servidor de prueba):

    $env:PRUEBA_POSTGRES = 'postgresql://postgres@127.0.0.1:55432/postgres'

Mide el criterio de terminado de M5 (docs/12-estado-y-traspaso.md):
  1. Los cinco escenarios pasan sin errores de contrato y dan las alertas del motor.
  2. Rechaza con los mismos codigos y detalles que el mock, comparado en vivo.
  3. Los datos persisten tras reiniciar, y dos instancias que se reparten un
     escenario (como las funciones de Vercel) dan las mismas alertas y folios que una.
Ademas: reenvio idempotente, PATCH, reportes, la prediccion de M3, carga
concurrente y la funcion de Vercel en /api.
"""
import importlib.util
import json
import warnings
import os
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from urllib import request as urlreq
from urllib.error import HTTPError

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
# Aviso de Starlette sobre httpx: no afecta a las pruebas.
warnings.filterwarnings('ignore', message='.*httpx.*')
from fastapi.testclient import TestClient   # noqa: E402
from app import crear_app, validador, ESQ    # noqa: E402

FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
ESCENARIOS = ['normal', 'descarga_organica', 'descarga_industrial', 'lluvia', 'falla_sensor']
# Lo que da el motor de M2 en cada escenario (motor/README.md).
ESPERADO = {'normal': 0, 'descarga_organica': 1, 'descarga_industrial': 5, 'lluvia': 3, 'falla_sensor': 0}

fallas = []


def revisar(cond, nombre, detalle=''):
    print('  {}  {}{}'.format('OK   ' if cond else 'FALLA', nombre, (' - ' + detalle) if detalle else ''))
    if not cond:
        fallas.append(nombre)


def paquetes(nombre):
    with open(os.path.join(FIX, 'escenarios', nombre + '.json'), encoding='utf-8') as f:
        d = json.load(f)
    return d['paquetes'] if isinstance(d, dict) else d


PRUEBA_POSTGRES = os.environ.get('PRUEBA_POSTGRES')


def base_temporal():
    """Una base vacia por caso: un archivo SQLite nuevo, o una base nueva en Postgres."""
    if not PRUEBA_POSTGRES:
        return os.path.join(tempfile.mkdtemp(prefix='atoyac_'), 'prueba.sqlite')
    import uuid
    import psycopg
    nombre = 'prueba_' + uuid.uuid4().hex[:12]
    with psycopg.connect(PRUEBA_POSTGRES, autocommit=True) as cx:
        cx.execute('CREATE DATABASE ' + nombre)
    return PRUEBA_POSTGRES.rsplit('/', 1)[0] + '/' + nombre


print('Base de las pruebas: {}'.format('Postgres' if PRUEBA_POSTGRES else 'SQLite'))


def enviar(cliente, lista, de_a_uno=True):
    if de_a_uno:
        return [cliente.post('/lecturas', json=p) for p in lista]
    return [cliente.post('/lecturas', json=lista)]


# ----------------------------------------------------------- 1. escenarios
print('\n1) Los cinco escenarios contra el motor real')
for esc in ESCENARIOS:
    with TestClient(crear_app(base_temporal())) as c:
        rs = enviar(c, paquetes(esc), de_a_uno=False)
        alertas = c.get('/alertas').json()['alertas']
        malas = [a for a in alertas if validador.validar(a, ESQ['alerta'])]
        revisar(rs[0].status_code == 202 and len(alertas) == ESPERADO[esc] and not malas,
                esc, '{} -> {} alertas (esperadas {}), {} fuera de contrato'.format(
                    rs[0].status_code, len(alertas), ESPERADO[esc], len(malas)))

# ------------------------------------------------ 2. mismos rechazos que el mock
print('\n2) Rechaza igual que el mock (comparado en vivo)')
spec = importlib.util.spec_from_file_location('mock', os.path.join(RAIZ, 'contrato', 'servidor_mock.py'))
mock = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mock)
mock.MOTOR_REAL = mock.cargar_motor_real()
srv = ThreadingHTTPServer(('127.0.0.1', 0), mock.Manejador)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL_MOCK = 'http://127.0.0.1:{}'.format(srv.server_address[1])


def al_mock(metodo, ruta, cuerpo):
    datos = cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo).encode('utf-8')
    req = urlreq.Request(URL_MOCK + ruta, data=datos, method=metodo, headers={'Content-Type': 'application/json'})
    try:
        with urlreq.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except HTTPError as e:
        return e.code, json.loads(e.read())


bueno = paquetes('normal')[0]
casos = [
    ('lectura sin c_estacion', 'POST', '/lecturas', {k: v for k, v in bueno.items() if k != 'c_estacion'}),
    ('lectura con estacion inexistente', 'POST', '/lecturas', dict(bueno, c_estacion='EST-XXX-99')),
    ('lectura con parametro fuera del contrato', 'POST', '/lecturas',
     dict(bueno, lecturas=[{'c_parametro': 'ORO', 'valor': 1}])),
    ('lote con uno bueno y uno malo', 'POST', '/lecturas', [bueno, {'c_estacion': 'EST-ATY-01'}]),
    ('JSON roto', 'POST', '/lecturas', b'{no es json'),
    ('reporte con foto con EXIF', 'POST', '/reportes',
     {'tipo': 'espuma', 'latitud': 19.2, 'longitud': -98.3, 'exif_removido': False}),
    ('reporte fuera de la cuenca', 'POST', '/reportes',
     {'tipo': 'espuma', 'latitud': 25.0, 'longitud': -98.3, 'exif_removido': True}),
    ('reporte de tipo inventado', 'POST', '/reportes',
     {'tipo': 'ovni', 'latitud': 19.2, 'longitud': -98.3, 'exif_removido': True}),
    ('ruta que no existe', 'GET', '/nada', None),
]
with TestClient(crear_app(base_temporal())) as c:
    for nombre, metodo, ruta, cuerpo in casos:
        if metodo == 'GET':
            rb = c.get(ruta)
            req = urlreq.Request(URL_MOCK + ruta)
            try:
                with urlreq.urlopen(req) as r:
                    cm, jm = r.status, json.loads(r.read())
            except HTTPError as e:
                cm, jm = e.code, json.loads(e.read())
        else:
            rb = c.request(metodo, ruta, content=cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo),
                           headers={'Content-Type': 'application/json'})
            cm, jm = al_mock(metodo, ruta, cuerpo)
        jb = rb.json()
        # Los folios de reporte dependen de cuantos guardo cada servidor; no aplican aqui.
        iguales = rb.status_code == cm and jb.get('error') == jm.get('error') and jb.get('detalles') == jm.get('detalles')
        revisar(iguales, nombre, 'backend {}, mock {}'.format(rb.status_code, cm))
srv.shutdown()

# ------------------------------------------------------------ 3. persistencia
print('\n3) Persistencia y reinicio a mitad de un escenario')
lista = paquetes('descarga_industrial')
with TestClient(crear_app(base_temporal())) as c:
    enviar(c, lista)
    de_corrido = c.get('/alertas').json()['alertas']
ruta = base_temporal()
mitad = len(lista) // 2
with TestClient(crear_app(ruta)) as c:
    enviar(c, lista[:mitad])
    al_apagar = c.get('/alertas').json()['alertas']
with TestClient(crear_app(ruta)) as c:      # "reinicio": app nueva, misma base
    al_encender = c.get('/alertas').json()['alertas']
    enviar(c, lista[mitad:])
    con_reinicio = c.get('/alertas').json()['alertas']
    salud = c.get('/salud').json()
revisar(al_encender == al_apagar, 'las alertas siguen tras reiniciar', '{} guardadas antes del reinicio'.format(len(al_apagar)))
revisar(salud['lecturas'] == len(lista), 'las lecturas siguen tras reiniciar', '{} de {}'.format(salud['lecturas'], len(lista)))
revisar([a['c_alerta'] for a in con_reinicio] == [a['c_alerta'] for a in de_corrido],
        'mismas alertas y folios que sin reiniciar', ', '.join(a['c_alerta'] for a in con_reinicio))
revisar(con_reinicio == de_corrido, 'mismo contenido de alertas que sin reiniciar')
revisar(len({a['c_alerta'] for a in con_reinicio}) == len(con_reinicio), 'ningun folio repetido')

# En Vercel cada lote puede caer en una instancia distinta. Dos apps sobre la misma
# base, turnandose lotes de 5 como los manda reproducir_escenario.py.
ruta = base_temporal()
with TestClient(crear_app(ruta)) as a, TestClient(crear_app(ruta)) as b:
    for k in range(0, len(lista), 5):
        (a if (k // 5) % 2 == 0 else b).post('/lecturas', json=lista[k:k + 5])
    turnadas = a.get('/alertas').json()['alertas']
revisar(turnadas == de_corrido, 'dos instancias turnandose lotes dan lo mismo que una',
        ', '.join(x['c_alerta'] for x in turnadas))

# Y las dos escribiendo la misma estacion al mismo tiempo: el candado por estacion
# las pone en fila; ningun folio se repite y no hay errores.
ruta = base_temporal()
otro_dia = paquetes('lluvia')
with TestClient(crear_app(ruta)) as a, TestClient(crear_app(ruta)) as b:
    def manda(par):
        cli, k = par
        return cli.post('/lecturas', json=otro_dia[k:k + 5]).status_code
    from concurrent.futures import ThreadPoolExecutor as _Pool
    with _Pool(max_workers=8) as pool:
        codigos = list(pool.map(manda, [((a, b)[(k // 5) % 2], k) for k in range(0, len(otro_dia), 5)]))
    juntas = a.get('/alertas').json()['alertas']
    salud_ab = a.get('/salud').json()
revisar(all(c == 202 for c in codigos) and salud_ab['lecturas'] == len(otro_dia),
        'dos instancias escribiendo a la vez, sin errores ni lecturas perdidas',
        '{} lecturas de {}'.format(salud_ab['lecturas'], len(otro_dia)))
revisar(len({x['c_alerta'] for x in juntas}) == len(juntas), 'ningun folio repetido entre instancias',
        '{} alertas'.format(len(juntas)))

# Lo anterior casi nunca choca: hace falta que dos lotes simultaneos de la misma
# estacion generen alerta. El candado se prueba directo: dos conexiones distintas
# (dos instancias) entran a la misma estacion; la segunda debe esperar a la primera.
import time as _t                    # noqa: E402
from almacen import Almacen          # noqa: E402
ruta = base_temporal()
uno, dos = Almacen(ruta), Almacen(ruta)
marcas = {}


def ocupa():
    with uno.transaccion('EST-ATY-01'):
        marcas['uno_entra'] = _t.monotonic()
        _t.sleep(0.6)
        marcas['uno_sale'] = _t.monotonic()


hilo = threading.Thread(target=ocupa)
hilo.start()
_t.sleep(0.15)
with dos.transaccion('EST-ATY-01'):
    marcas['dos_entra'] = _t.monotonic()
hilo.join()
with dos.transaccion('EST-ATY-02'):   # otra estacion no espera... salvo en SQLite, que bloquea toda la base
    pass
revisar(marcas['dos_entra'] >= marcas['uno_sale'],
        'el candado por estacion detiene a otra instancia hasta que la primera termina',
        'espero {:.2f} s'.format(marcas['dos_entra'] - marcas['uno_entra']))
uno.cerrar()
dos.cerrar()

# -------------------------------------------------------------- 4. lo demas
print('\n4) Reenvio, gestion, reportes y prediccion')
with TestClient(crear_app(base_temporal())) as c:
    p = lista[0]
    v1 = c.post('/lecturas', json=p).json()['veredictos'][0]
    v2 = c.post('/lecturas', json=p).json()['veredictos'][0]
    revisar(v1 == v2 and c.get('/salud').json()['lecturas'] == 1, 'un reenvio identico no se evalua dos veces')

    enviar(c, lista[1:])
    al = c.get('/alertas').json()['alertas'][0]
    r = c.patch('/alertas/' + al['c_alerta'], json={'estado': 'En atencion', 'responsable': '  Guardia  '})
    revisar(r.status_code == 200 and r.json()['responsable'] == 'Guardia', 'PATCH cambia estado y responsable')
    revisar(c.patch('/alertas/' + al['c_alerta'], json={'nivel': 'Informativa'}).status_code == 422, 'PATCH rechaza otros campos')
    revisar(c.patch('/alertas/' + al['c_alerta'], json={'estado': 'Resuelta'}).status_code == 422, 'PATCH rechaza un estado fuera del contrato')
    revisar(c.patch('/alertas/AL-0-X-01', json={'estado': 'Cerrada'}).status_code == 404, 'PATCH de una alerta inexistente da 404')
    r = c.post('/reportes', json={'tipo': 'espuma', 'latitud': 19.2, 'longitud': -98.3,
                                  'exif_removido': True, 'correo': 'persona@ejemplo.mx'})
    publico = c.get('/reportes').json()['reportes']
    revisar(r.status_code == 201 and len(publico) == 1 and 'correo' not in publico[0], 'reporte guardado sin exponer el correo')

    pr = c.get('/alertas/{}/prediccion'.format(al['c_alerta']))
    errores = validador.validar(pr.json(), ESQ['prediccion_propagacion'])
    revisar(pr.status_code == 200 and not errores and pr.json()['destinos'],
            'prediccion de M3 cumple el contrato', '{} destinos'.format(len(pr.json().get('destinos', []))))
    revisar(c.get('/alertas/AL-0-X-01/prediccion').status_code == 404, 'prediccion de alerta inexistente da 404')

    # La autoridad cambia el estado de un reporte ciudadano (mismas respuestas que el mock)
    rp = c.post('/reportes', json={'version': '1.0', 'fecha_hora': '2026-11-24T10:00:00Z', 'tipo': 'espuma',
                                   'latitud': 19.0, 'longitud': -98.2, 'exif_removido': True, 'correo': 'a@b.mx'})
    folio = rp.json()['c_reporte']
    r = c.patch('/reportes/' + folio, json={'estado': 'Validado'})
    revisar(r.status_code == 200 and r.json()['estado'] == 'Validado' and 'correo' not in r.json(), 'PATCH /reportes cambia el estado y no expone el correo')
    revisar(c.get('/reportes/' + folio).json()['estado'] == 'Validado', 'el estado del reporte persiste')
    revisar(c.patch('/reportes/' + folio, json={'estado': 'Hecho'}).status_code == 422, 'PATCH /reportes rechaza un estado fuera del contrato')
    revisar(c.patch('/reportes/' + folio, json={'tipo': 'mal_olor'}).status_code == 422, 'PATCH /reportes rechaza otros campos')
    revisar(c.patch('/reportes/RC-20260101-0001', json={'estado': 'Cerrado'}).status_code == 404, 'PATCH de un folio inexistente da 404')

# La prediccion del backend es la de M3: misma salida que el ejemplo que M3 genera.
from datetime import datetime, timedelta, timezone   # noqa: E402
from propagacion import Propagacion                     # noqa: E402
with open(os.path.join(FIX, 'prediccion_ejemplo.json'), encoding='utf-8') as f:
    ref = json.load(f)
mio = Propagacion().predecir('DLTLA2582', 'DQO_TOT', 400.0,
                             datetime(2026, 11, 23, 10, 0, tzinfo=timezone(timedelta(hours=-6))), ref['c_alerta'])
revisar(mio == ref, 'misma prediccion que M3 (contrato/fixtures/prediccion_ejemplo.json)',
        '{} destinos'.format(len(mio['destinos'])))

# ------------------------------------------------------- 5. peticiones a la vez
# El panel pide 8 cosas a la vez cada 3 s. Con el TestClient las peticiones van
# en fila, asi que esto se prueba contra un uvicorn de verdad en otro hilo.
print('\n5) Muchas peticiones a la vez, con un servidor real')
import socket                                   # noqa: E402
import time                                     # noqa: E402
from concurrent.futures import ThreadPoolExecutor   # noqa: E402
import uvicorn                                  # noqa: E402

with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    puerto = s.getsockname()[1]
# Base con un dia entero de lecturas, como la que fallo con el panel: las consultas
# tardan mas y los hilos se enciman de verdad.
ruta_carga = base_temporal()
with TestClient(crear_app(ruta_carga)) as c:
    enviar(c, paquetes('normal'), de_a_uno=False)
    enviar(c, lista, de_a_uno=False)
servidor = uvicorn.Server(uvicorn.Config(crear_app(ruta_carga), host='127.0.0.1', port=puerto, log_level='critical'))
threading.Thread(target=servidor.run, daemon=True).start()
while not servidor.started:
    time.sleep(0.05)
URL = 'http://127.0.0.1:{}'.format(puerto)
estaciones_cod = ['EST-ATY-0{}'.format(i) for i in range(1, 6)]
otro = paquetes('lluvia')


def golpe(i):
    if i % 10 == 0:   # escrituras mezcladas con lecturas, como en la demo
        req = urlreq.Request(URL + '/lecturas', data=json.dumps(otro[i // 10]).encode('utf-8'),
                             method='POST', headers={'Content-Type': 'application/json'})
    else:
        req = urlreq.Request(URL + ['/alertas', '/salud', '/veredictos?c_estacion=' + estaciones_cod[i % 5],
                                    '/veredictos?c_estacion=' + estaciones_cod[(i + 2) % 5]][i % 4])
    try:
        with urlreq.urlopen(req) as r:
            r.read()
            return r.status
    except HTTPError as e:
        return e.code


with ThreadPoolExecutor(max_workers=32) as pool:
    codigos = list(pool.map(golpe, range(1500)))
malos = [c for c in codigos if c >= 500]
revisar(not malos, '1500 peticiones con 32 a la vez sobre 960 lecturas, sin errores del servidor',
        '{} con error 5xx'.format(len(malos)))
servidor.should_exit = True

# ------------------------------------------------- 6. la funcion de Vercel
print('\n6) La funcion de Vercel (api/index.py) sirve el backend en /api')
os.environ['DATABASE_URL'] = base_temporal()
_spec = importlib.util.spec_from_file_location('funcion_vercel', os.path.join(RAIZ, 'api', 'index.py'))
funcion = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(funcion)   # importar no debe tocar la base: en Vercel se importa al compilar
del os.environ['DATABASE_URL']
with TestClient(funcion.app) as c:
    s = c.get('/api/salud')
    r = c.post('/api/lecturas', json=lista[:5])
    n = c.get('/api/nada')
    revisar(s.status_code == 200 and s.json()['persistencia'] in ('sqlite', 'postgres'), '/api/salud responde',
            'persistencia: {}'.format(s.json().get('persistencia')))
    revisar(r.status_code == 202 and r.json()['aceptados'] == 5, '/api/lecturas acepta un lote')
    revisar(n.status_code == 404 and n.json().get('error') == 'ruta no encontrada', 'ruta inexistente en /api da 404 del contrato')

# ------------------------------------------------------------- 7. Supabase
print('\n7) Lo que Supabase necesita')
from almacen import limpiar_url      # noqa: E402
sucia = ('postgres://postgres.abc:clave@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
         '?sslmode=require&supa=base-pooler.x')
limpia = limpiar_url(sucia)
revisar('supa=' not in limpia and 'sslmode=require' in limpia and ':6543/postgres' in limpia,
        'la URL de la integracion de Vercel pierde supa= y conserva sslmode', limpia.split('@')[1])
if PRUEBA_POSTGRES:
    import psycopg                   # noqa: E402
    ruta = base_temporal()
    Almacen(ruta).cerrar()
    with psycopg.connect(ruta) as cx:
        sin_rls = cx.execute("SELECT relname FROM pg_class WHERE relname IN ('lectura','veredicto','alerta','reporte') "
                             "AND relkind = 'r' AND NOT relrowsecurity").fetchall()
    revisar(not sin_rls, 'las cuatro tablas con RLS activo (la API REST de Supabase no las ve)',
            'sin RLS: {}'.format([r[0] for r in sin_rls]) if sin_rls else '')

# ------------------------------------------------------------- 8. aviso por correo
# El SMTP se reemplaza por uno falso que solo anota lo que se habría enviado: las pruebas nunca mandan correos.
print('\n8) Correos: recibo al crear y aviso en cada paso del reporte (SMTP falso)')
import correo as modulo_correo        # noqa: E402

class SMTPFalso:
    enviados = []
    falla = False

    def __init__(self, host, puerto, timeout=None, context=None):
        self.host, self.puerto = host, puerto

    def __enter__(self):
        if SMTPFalso.falla:
            raise OSError('sin red')
        return self

    def __exit__(self, *a):
        return False

    def login(self, usuario, clave):
        self.usuario, self.clave = usuario, clave

    def send_message(self, msg):
        SMTPFalso.enviados.append({'para': msg['To'], 'asunto': msg['Subject'], 'de': msg['From'],
                                   'html': msg.get_body(('html',)).get_content(), 'clave': self.clave})

_smtp_real = modulo_correo.smtplib.SMTP_SSL
_entorno = {k: os.environ.get(k) for k in ('SMTP_USER', 'SMTP_PASSWORD', 'APP_URL')}
modulo_correo.smtplib.SMTP_SSL = SMTPFalso
try:
    for k in _entorno:
        os.environ.pop(k, None)
    with TestClient(crear_app(base_temporal())) as c:
        personas = iter(range(1, 100))

        def nuevo_reporte(correo_persona):
            cuerpo = {'version': '1.0', 'fecha_hora': '2026-11-24T10:00:00Z', 'tipo': 'descarga_visible',
                      'latitud': 19.0262, 'longitud': -98.2335, 'exif_removido': True}
            if correo_persona:
                cuerpo['correo'] = correo_persona
            # cada reporte de otra persona: el freno antispam (prueba 9) juntaria los del mismo punto
            r = c.post('/reportes', json=cuerpo, headers={'X-Forwarded-For': '10.0.8.{}'.format(next(personas))})
            nuevo_reporte.aviso = r.headers.get('x-aviso-correo')
            return r.json()['c_reporte']

        f1 = nuevo_reporte('persona@ejemplo.mx')
        revisar(nuevo_reporte.aviso == 'no_configurado' and not SMTPFalso.enviados, 'sin credenciales no sale el recibo y el reporte se guarda')
        r = c.patch('/reportes/' + f1, json={'estado': 'Cerrado'})
        revisar(r.status_code == 200 and r.headers.get('x-aviso-correo') == 'no_configurado' and not SMTPFalso.enviados,
                'sin credenciales no se envía nada y el cierre se guarda igual', r.headers.get('x-aviso-correo'))
        revisar(c.get('/salud').json().get('aviso_por_correo') is False, '/salud dice que el correo no está configurado')

        os.environ['SMTP_USER'] = 'avisos@ejemplo.mx'
        os.environ['SMTP_PASSWORD'] = 'abcd efgh ijkl mnop'
        os.environ['APP_URL'] = 'https://atoyac.ejemplo.mx'
        revisar(c.get('/salud').json().get('aviso_por_correo') is True, '/salud dice que el correo está configurado')
        f2 = nuevo_reporte('persona@ejemplo.mx')
        e = SMTPFalso.enviados[-1] if SMTPFalso.enviados else {}
        revisar(nuevo_reporte.aviso == 'enviado' and len(SMTPFalso.enviados) == 1 and e.get('para') == 'persona@ejemplo.mx'
                and 'Recibimos' in e.get('asunto', '') and f2 in e.get('asunto', ''), 'al crear se manda el recibo con el folio')
        revisar('https://atoyac.ejemplo.mx/ciudadano/#/rastreo?folio=' + f2 in e.get('html', ''), 'el recibo lleva el enlace a su rastreo')
        r = c.patch('/reportes/' + f2, json={'estado': 'Validado'})
        e = SMTPFalso.enviados[-1] if SMTPFalso.enviados else {}
        revisar(r.headers.get('x-aviso-correo') == 'enviado' and len(SMTPFalso.enviados) == 2 and 'validado' in e.get('asunto', ''),
                'al validar se avisa', r.headers.get('x-aviso-correo'))
        r = c.patch('/reportes/' + f2, json={'estado': 'Validado'})
        revisar(r.headers.get('x-aviso-correo') == 'no_aplica' and len(SMTPFalso.enviados) == 2, 'el mismo estado no repite el correo')
        r = c.patch('/reportes/' + f2, json={'estado': 'En atencion'})
        e = SMTPFalso.enviados[-1] if SMTPFalso.enviados else {}
        revisar(r.headers.get('x-aviso-correo') == 'enviado' and len(SMTPFalso.enviados) == 3 and 'atención' in e.get('asunto', ''),
                'al pasar a atención se avisa', r.headers.get('x-aviso-correo'))
        r = c.patch('/reportes/' + f2, json={'estado': 'Cerrado'})
        e = SMTPFalso.enviados[-1] if SMTPFalso.enviados else {}
        revisar(r.headers.get('x-aviso-correo') == 'enviado' and len(SMTPFalso.enviados) == 4 and e.get('para') == 'persona@ejemplo.mx'
                and 'atendido' in e.get('asunto', ''),
                'al cerrar se avisa a quien dejó su correo', r.headers.get('x-aviso-correo'))
        revisar(f2 in e.get('asunto', '') and 'https://atoyac.ejemplo.mx/ciudadano/#/rastreo?folio=' + f2 in e.get('html', ''),
                'el correo lleva el folio y el enlace a su rastreo')
        revisar(e.get('clave') == 'abcdefghijklmnop', 'la contraseña de aplicación se usa sin los espacios con que la muestra Google')
        revisar('correo' not in r.json(), 'la respuesta del cierre no expone el correo')
        c.patch('/reportes/' + f2, json={'estado': 'Cerrado'})
        revisar(len(SMTPFalso.enviados) == 4, 'cerrar de nuevo un reporte cerrado no repite el correo')
        f3 = nuevo_reporte(None)
        revisar(nuevo_reporte.aviso == 'sin_correo', 'sin correo no hay recibo')
        r = c.patch('/reportes/' + f3, json={'estado': 'Cerrado'})
        revisar(r.headers.get('x-aviso-correo') == 'sin_correo' and len(SMTPFalso.enviados) == 4, 'sin correo no se intenta enviar')
        f5 = nuevo_reporte('quinta@ejemplo.mx')
        r = c.patch('/reportes/' + f5, json={'estado': 'Descartado'})
        e = SMTPFalso.enviados[-1] if SMTPFalso.enviados else {}
        revisar(r.headers.get('x-aviso-correo') == 'enviado' and 'descartado' in e.get('asunto', ''), 'al descartar se avisa')
        SMTPFalso.falla = True
        f4 = nuevo_reporte('otra@ejemplo.mx')
        revisar(nuevo_reporte.aviso == 'fallido' and c.get('/reportes/' + f4).status_code == 200,
                'si el SMTP falla al crear, el reporte se guarda igual')
        r = c.patch('/reportes/' + f4, json={'estado': 'Cerrado'})
        revisar(r.status_code == 200 and r.headers.get('x-aviso-correo') == 'fallido' and c.get('/reportes/' + f4).json()['estado'] == 'Cerrado',
                'si el SMTP falla, el cierre se guarda y se informa el fallo')
        SMTPFalso.falla = False
finally:
    modulo_correo.smtplib.SMTP_SSL = _smtp_real
    for k, v in _entorno.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
revisar(modulo_correo.enmascarar('persona@ejemplo.mx') == 'pe***@ejemplo.mx', 'los registros enmascaran el correo')

# ------------------------------------------------------------- 9. freno antispam
print('\n9) Freno a los envios repetidos de una misma persona')
with TestClient(crear_app(base_temporal())) as c:
    def mandar(ip, tipo='espuma', lat=19.3240, lon=-98.2512):
        return c.post('/reportes', json={'tipo': tipo, 'latitud': lat, 'longitud': lon, 'exif_removido': True},
                      headers={'X-Forwarded-For': ip + ', 10.255.0.1'})

    r1 = mandar('200.1.1.1')
    r2 = mandar('200.1.1.1', lat=19.3245)             # ~55 m, mismo tipo, misma persona
    revisar(r1.status_code == 201 and r2.status_code == 200 and r2.json().get('repetido') and r2.json()['c_reporte'] == r1.json()['c_reporte'],
            'misma persona, mismo tipo y mismo punto: devuelve su folio y no crea otro', r2.json().get('c_reporte'))
    revisar(c.get('/salud').json()['reportes'] == 1, 'el repetido no se guarda')
    revisar(mandar('200.1.1.1', tipo='mal_olor').status_code == 201, 'otro tipo en el mismo punto sí se recibe')
    revisar(mandar('200.1.1.1', lat=19.3300).status_code == 201, 'el mismo tipo a ~660 m sí se recibe')
    revisar(mandar('200.2.2.2').status_code == 201, 'otra persona en el mismo punto sí se recibe (corrobora)')
    lugares = [(19.10, -98.20), (19.12, -98.22), (19.14, -98.24)]
    codigos = [mandar('200.1.1.1', lat=la, lon=lo).status_code for la, lo in lugares]
    ultimo = codigos[-1]
    revisar(codigos[:2] == [201, 201] and ultimo == 429, 'mas de 5 reportes por minuto de una persona dan 429', str(codigos))
    revisar(mandar('200.3.3.3', lat=19.16, lon=-98.26).status_code == 201, 'el limite es por persona: otra sigue reportando')
    con_ip = c.get('/reportes').json()['reportes']
    revisar(all('200.1.1.1' not in json.dumps(x) for x in con_ip), 'la IP no aparece en los reportes')
    folio = r1.json()['c_reporte']
    consultas = [c.get('/reportes/' + folio, headers={'X-Forwarded-For': '200.9.9.9'}).status_code for _ in range(21)]
    revisar(consultas[:20] == [200] * 20 and consultas[20] == 429, 'mas de 20 consultas de folio por minuto dan 429')
    revisar(c.get('/reportes/' + folio, headers={'X-Forwarded-For': '200.8.8.8'}).status_code == 200, 'otra persona sigue consultando')

# ------------------------------------------------------------- 10. autorizaciones
print('\n10) Trámites de CEASPUE y CAPCEE registrados desde el panel')
_mec = json.load(open(os.path.join(RAIZ, 'contrato', 'fixtures', 'mecanismos.json'), encoding='utf-8'))['estaciones'][0]
_tr = _mec['autorizaciones'][0]
_db_aut = base_temporal()
with TestClient(crear_app(_db_aut)) as c:
    revisar(c.get('/autorizaciones').json() == {'autorizaciones': []}, 'sin registros, la lista está vacía')
    url = '/autorizaciones/' + _mec['c_estacion']
    base_t = {'organismo': _tr['organismo'], 'tramite': _tr['tramite']}
    r = c.patch(url, json=dict(base_t, estado='solicitada', encargado='Ana López', oficio='CEASPUE/123/2026'))
    j = r.json()
    revisar(r.status_code == 200 and j['estado'] == 'solicitada' and j['encargado'] == 'Ana López' and j['fecha'] and j['historial'] == [],
            'se registra un trámite con encargado y fecha', r.text[:120])
    r = c.patch(url, json=dict(base_t, estado='otorgada', encargado='Ana López'))
    revisar(r.status_code == 200 and r.json()['estado'] == 'otorgada' and len(r.json()['historial']) == 1
            and r.json()['historial'][0]['estado'] == 'solicitada', 'el cambio guarda el estado anterior en el historial')
    lista = c.get('/autorizaciones').json()['autorizaciones']
    revisar(len(lista) == 1 and lista[0]['estado'] == 'otorgada', 'GET /autorizaciones devuelve el último estado')
    revisar(c.patch(url, json=dict(base_t, estado='otorgada', encargado='')).status_code == 422, 'sin encargado se rechaza')
    revisar(c.patch(url, json=dict(base_t, estado='aprobadísima', encargado='Ana')).status_code == 422, 'un estado desconocido se rechaza')
    revisar(c.patch(url, json=dict(base_t, estado='otorgada', encargado='Ana', firma='x')).status_code == 422, 'un campo ajeno se rechaza')
    revisar(c.patch('/autorizaciones/EST-NO-EXISTE', json=dict(base_t, estado='otorgada', encargado='Ana')).status_code == 404,
            'un mecanismo que no existe da 404')
    revisar(c.patch(url, json={'organismo': 'CEASPUE', 'tramite': 'inventado', 'estado': 'otorgada', 'encargado': 'Ana'}).status_code == 404,
            'un trámite que el mecanismo no tiene da 404')
with TestClient(crear_app(_db_aut)) as c:
    revisar(c.get('/autorizaciones').json()['autorizaciones'][0]['estado'] == 'otorgada', 'el registro sobrevive a reiniciar el servidor')

print('\n{}'.format('Todo pasa.' if not fallas else '{} falla(s): {}'.format(len(fallas), ', '.join(fallas))))
sys.exit(1 if fallas else 0)

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
ESPERADO = {'normal': 0, 'descarga_organica': 2, 'descarga_industrial': 5, 'lluvia': 5, 'falla_sensor': 0}

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

print('\n{}'.format('Todo pasa.' if not fallas else '{} falla(s): {}'.format(len(fallas), ', '.join(fallas))))
sys.exit(1 if fallas else 0)

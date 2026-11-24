# -*- coding: utf-8 -*-
"""Backend real del monitoreo del rio Atoyac (M5), con FastAPI.

Reemplaza al servidor mock con las mismas rutas y las mismas respuestas. La
especificacion es `contrato/servidor_mock.py --motor real`: este backend valida
con el mismo validador, evalua con el mismo motor (motor/reglas.py, M2) y
rechaza con los mismos codigos. Lo que agrega:

- Persistencia en SQLite: lecturas, veredictos, alertas y reportes sobreviven a
  un reinicio.
- Al arrancar, el motor recupera su estado reproduciendo las ultimas lecturas
  guardadas, y sus folios continuan donde iban (no se repiten).
- Un reenvio identico de un paquete (el firmware reenvia lo que no recibio ACK)
  se acepta sin evaluarse dos veces.
- GET /alertas/<c_alerta>/prediccion: la propagacion aguas abajo de M3.

Frontera: el backend no inventa reglas. Decide el motor; propaga M3.
"""
import importlib.util
import json
import os
import re
import sys
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
sys.path.insert(0, AQUI)
from almacen import Almacen, huella          # noqa: E402
from propagacion import Propagacion           # noqa: E402

VERSION_CONTRATO = '1.0'
# Lo unico que la autoridad cambia de una alerta. El resto lo decide el motor.
CAMPOS_GESTION = ('estado', 'responsable')
# Paquetes por estacion que se reproducen al arrancar para recuperar el estado del
# motor. Sus ventanas abarcan 24 paquetes; 200 sobran y arrancan en menos de un segundo.
REHIDRATAR = 200
DB_POR_OMISION = os.path.join(AQUI, 'datos', 'atoyac.sqlite')


def _cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


validador = _cargar('validador', os.path.join(RAIZ, 'contrato', 'validador.py'))
reglas = _cargar('reglas', os.path.join(RAIZ, 'motor', 'reglas.py'))
ESQ = {n: validador.cargar_esquema(n) for n in ('lectura', 'reporte_ciudadano', 'alerta', 'prediccion_propagacion')}


def leer_json(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def error(codigo, cuerpo):
    return JSONResponse(cuerpo, status_code=codigo)


async def leer_cuerpo(request):
    """Mismo manejo que el mock: cuerpo vacio o JSON invalido -> 400."""
    crudo = await request.body()
    if not crudo:
        return None, 'cuerpo vacio'
    try:
        return json.loads(crudo.decode('utf-8')), None
    except (ValueError, UnicodeDecodeError) as e:
        return None, 'JSON invalido: {}'.format(e)


def crear_app(ruta_db=None):
    ruta_db = ruta_db or os.environ.get('BACKEND_DB') or DB_POR_OMISION
    estaciones = {e['c_estacion']: e for e in leer_json(os.path.join(FIX, 'estaciones.json'))['estaciones']}
    estado = {}

    @asynccontextmanager
    async def ciclo(app):
        almacen = Almacen(ruta_db)
        motor = reglas.Motor()
        # Recuperar el estado del motor: reproducir las ultimas lecturas guardadas
        # en el mismo orden. El motor es determinista, asi que queda igual que antes
        # del reinicio. Lo que devuelve se descarta: ya esta guardado.
        for ce in estaciones:
            for p in almacen.lecturas_recientes(ce, REHIDRATAR):
                motor.evaluar(p)
        # Los folios continuan desde el mayor guardado, nunca se repiten.
        for ce, n in almacen.folios_por_estacion().items():
            motor.folio[ce] = max(motor.folio[ce], n)
        estado.update(almacen=almacen, motor=motor, propagacion=Propagacion())
        yield
        almacen.cx.close()

    app = FastAPI(title='Monitoreo del río Atoyac', version=VERSION_CONTRATO, lifespan=ciclo,
                  description='Backend M5. Contrato de datos v1.0; ver contrato/README.md.')
    origenes = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origenes, allow_methods=['GET', 'POST', 'PATCH', 'OPTIONS'],
                       allow_headers=['Content-Type'])

    @app.exception_handler(StarletteHTTPException)
    async def no_encontrada(request, exc):
        if exc.status_code in (404, 405):
            return error(404, {'error': 'ruta no encontrada', 'ruta': request.url.path})
        return error(exc.status_code, {'error': str(exc.detail)})

    # ------------------------------------------------------------- lectura
    @app.get('/salud')
    def salud():
        a = estado['almacen']
        return {'estado': 'ok', 'version_contrato': VERSION_CONTRATO, 'motor': 'real',
                'persistencia': 'sqlite',
                'hora': datetime.now().astimezone().isoformat(timespec='seconds'),
                'estaciones': len(estaciones),
                'alertas_abiertas': sum(1 for x in a.alertas() if x.get('estado') in ('Abierta', 'En atencion')),
                'reportes': a.contar('reporte'), 'lecturas': a.contar('lectura')}

    @app.get('/estaciones')
    def get_estaciones():
        return {'version': VERSION_CONTRATO, 'estaciones': list(estaciones.values())}

    @app.get('/linea_base')
    def linea_base():
        return leer_json(os.path.join(FIX, 'linea_base.json'))

    @app.get('/sitios.geojson')
    @app.get('/sitios')
    def sitios():
        return leer_json(os.path.join(FIX, 'sitios.geojson'))

    @app.get('/escenarios')
    def escenarios():
        carpeta = os.path.join(FIX, 'escenarios')
        return {'escenarios': sorted(a[:-5] for a in os.listdir(carpeta) if a.endswith('.json'))}

    @app.get('/escenarios/{nombre}')
    def escenario(nombre: str):
        if not re.fullmatch(r'[a-z_]+', nombre):
            return error(404, {'error': 'escenario no encontrado'})
        ruta = os.path.join(FIX, 'escenarios', nombre + '.json')
        if not os.path.exists(ruta):
            return error(404, {'error': 'escenario no encontrado'})
        return leer_json(ruta)

    @app.get('/veredictos')
    def veredictos(c_estacion: str | None = None):
        return {'veredictos': estado['almacen'].veredictos(c_estacion, 50)}

    @app.get('/alertas')
    def alertas():
        return {'alertas': estado['almacen'].alertas()}

    @app.get('/alertas/{c_alerta}/prediccion')
    def prediccion(c_alerta: str):
        a = estado['almacen'].alerta(c_alerta)
        if a is None:
            return error(404, {'error': 'alerta no encontrada'})
        prop = estado['propagacion']
        sitio = a.get('c_sitio') or estaciones.get(a['c_estacion'], {}).get('c_sitio')
        p = prop.predecir(sitio, prop.clave_conagua(a['c_parametro']), a.get('valor'),
                          datetime.fromisoformat(a['fecha_hora']), a['c_alerta'])
        # M3 trabaja en claves de CONAGUA; hacia afuera se usa el codigo del contrato.
        for d in p['destinos']:
            d['c_parametro'] = a['c_parametro']
        return p

    @app.get('/reportes')
    def get_reportes():
        # El correo es solo para avisar del cierre: nunca sale por la API publica.
        return {'reportes': [{k: v for k, v in r.items() if k != 'correo'} for r in estado['almacen'].reportes()]}

    # ------------------------------------------------------------ escritura
    @app.post('/lecturas')
    async def lecturas(request: Request):
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        paquetes = cuerpo if isinstance(cuerpo, list) else [cuerpo]
        resultados, errores = [], []
        almacen, motor = estado['almacen'], estado['motor']
        for i, p in enumerate(paquetes):
            e = validador.validar(p, ESQ['lectura'], '$[{}]'.format(i))
            if e:
                errores += e
                continue
            if p['c_estacion'] not in estaciones:
                errores.append('$[{}].c_estacion: {} no esta registrada'.format(i, p['c_estacion']))
                continue
            h = huella(p)
            with almacen.candado:
                previo = almacen.veredicto_de_huella(h)
                if previo is not None:
                    resultados.append(previo)     # reenvio identico: no se evalua otra vez
                    continue
                v = motor.evaluar(p)
                v['motor'] = 'real'
                almacen.guardar_evaluacion(p, h, v)
            resultados.append(v)
        if errores:
            return error(422, {'error': 'contrato no cumplido', 'detalles': errores, 'aceptados': len(resultados)})
        return JSONResponse({'aceptados': len(resultados), 'veredictos': resultados}, status_code=202)

    @app.patch('/alertas/{c_alerta}')
    async def gestionar(c_alerta: str, request: Request):
        almacen = estado['almacen']
        alerta = almacen.alerta(c_alerta)
        if alerta is None:
            return error(404, {'error': 'alerta no encontrada'})
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        if not isinstance(cuerpo, dict):
            return error(422, {'error': 'se espera un objeto'})
        ajenos = sorted(set(cuerpo) - set(CAMPOS_GESTION))
        if ajenos:
            return error(422, {'error': 'solo se pueden cambiar estado y responsable', 'detalles': ajenos})
        if isinstance(cuerpo.get('responsable'), str):
            cuerpo['responsable'] = cuerpo['responsable'].strip() or None
        nueva = dict(alerta, **cuerpo)
        e = validador.validar(nueva, ESQ['alerta'])
        if e:
            return error(422, {'error': 'contrato no cumplido', 'detalles': e})
        with almacen.candado:
            almacen.actualizar_alerta(nueva)
        return nueva

    @app.post('/reportes')
    async def reportes(request: Request):
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        if not isinstance(cuerpo, dict):
            return error(422, {'error': 'contrato no cumplido', 'detalles': ['$: se espera un objeto']})
        almacen = estado['almacen']
        with almacen.candado:
            cuerpo.setdefault('version', VERSION_CONTRATO)
            cuerpo.setdefault('estado', 'Recibido')
            cuerpo.setdefault('exif_removido', False)
            cuerpo.setdefault('c_reporte', 'RC-{}-{:04d}'.format(
                datetime.now().strftime('%Y%m%d'), almacen.contar('reporte') + 1))
            cuerpo.setdefault('fecha_hora', datetime.now().astimezone().isoformat(timespec='seconds'))
            e = validador.validar(cuerpo, ESQ['reporte_ciudadano'])
            if e:
                return error(422, {'error': 'contrato no cumplido', 'detalles': e})
            if not cuerpo['exif_removido']:
                return error(409, {'error': 'la foto conserva metadatos EXIF',
                                   'detalle': 'quita el EXIF antes de enviar: lleva coordenadas y modelo del telefono'})
            almacen.guardar_reporte(cuerpo)
        return JSONResponse({'c_reporte': cuerpo['c_reporte'], 'estado': cuerpo['estado']}, status_code=201)

    return app

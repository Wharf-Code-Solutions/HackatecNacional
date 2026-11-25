# -*- coding: utf-8 -*-
"""Backend real del monitoreo del rio Atoyac (M5), con FastAPI.

Reemplaza al servidor mock con las mismas rutas y las mismas respuestas. La
especificacion es `contrato/servidor_mock.py --motor real`: este backend valida
con el mismo validador, evalua con el mismo motor (motor/reglas.py, M2) y
rechaza con los mismos codigos. Lo que agrega:

- Persistencia: SQLite en tu computadora, Postgres en Vercel (DATABASE_URL).
- Sin memoria entre peticiones, para correr como funcion serverless en Vercel:
  en cada lote, el motor de cada estacion se reconstruye con sus ultimas
  lecturas guardadas y sus folios siguen desde el mayor guardado. El motor es
  determinista, asi que da lo mismo que si nunca se hubiera apagado. Un candado
  por estacion en la base evita que dos instancias la evaluen a la vez.
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
import threading
from collections import OrderedDict
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
FIX = os.path.join(RAIZ, 'contrato', 'fixtures')
sys.path.insert(0, AQUI)
from almacen import Almacen, es_postgres, huella   # noqa: E402
from propagacion import Propagacion                 # noqa: E402
from asignacion import Asignador               # noqa: E402
import correo                                   # noqa: E402

# Reglas de derrumbe del motor (motor/reglas.py, modulo de ladera): ?modulo=ladera en GET /alertas
REGLAS_LADERA = ('movimiento_ladera', 'lluvia_acumulada', 'suelo_saturado')
import antispam                                 # noqa: E402
import time                                     # noqa: E402

VERSION_CONTRATO = '1.0'
# Lo unico que la autoridad cambia de una alerta. El resto lo decide el motor.
CAMPOS_GESTION = ('estado', 'responsable')
# De un reporte ciudadano la autoridad solo cambia su estado.
CAMPOS_GESTION_REPORTE = ('estado',)
# Trámites de CEASPUE y CAPCEE (docs/19 §4.3). El panel registra en qué va cada uno; no hay inicio de sesión: se pide el
# nombre de quien lo registra («encargado») y se guarda con la fecha. El objeto es un mecanismo (EST-...) o una escuela (CCT).
ESTADOS_TRAMITE = ('pendiente', 'solicitada', 'otorgada', 'negada')
CAMPOS_AUTORIZACION = ('organismo', 'tramite', 'estado', 'encargado', 'oficio', 'nota')
# Paquetes de la estacion con que se reconstruye el motor en cada lote. Sus
# ventanas abarcan 24 paquetes (VENTANA_RECIENTE + BRECHA_GUARDA en reglas.py);
# 200 sobran y cuestan unos milisegundos. Las de ladera suman la lluvia de 72 h (docs/20 §5): a 5 min por paquete,
# 864; con 900 alcanza aun con el muestreo adaptativo, y sus paquetes no pasan por las capas del agua (es barato).
REHIDRATAR = 200
REHIDRATAR_LADERA = 900
DB_POR_OMISION = os.path.join(AQUI, 'datos', 'atoyac.sqlite')


def _cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


validador = _cargar('validador', os.path.join(RAIZ, 'contrato', 'validador.py'))
analisis_foto = _cargar('analisis_foto', os.path.join(RAIZ, 'contrato', 'analisis_foto.py'))
prioridad_huella = _cargar('prioridad_huella', os.path.join(RAIZ, 'contrato', 'prioridad_huella.py'))
reglas = _cargar('reglas', os.path.join(RAIZ, 'motor', 'reglas.py'))
ESQ = {n: validador.cargar_esquema(n) for n in ('lectura', 'reporte_ciudadano', 'alerta', 'prediccion_propagacion')}
# Tablas que el motor lee al construirse: se cargan una vez por proceso.
TABLAS_MOTOR = dict(linea_base=reglas.cargar_linea_base(), estaciones=reglas.cargar_estaciones(),
                    umbrales=reglas.cargar_escala_conagua(), ladera=reglas.cargar_umbrales_ladera())


def url_base(url=None):
    """De donde sale la base, en orden: argumento, DATABASE_URL (la cadena del pooler
    de Supabase), POSTGRES_URL (la que crea la integracion de Supabase en Vercel),
    BACKEND_DB, y si no hay nada, SQLite local. En Vercel sin base configurada se usa
    /tmp, que se borra: /salud lo avisa."""
    url = url or os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL') or os.environ.get('BACKEND_DB')
    if url:
        return url, ('postgres' if es_postgres(url) else 'sqlite')
    if os.environ.get('VERCEL'):
        return '/tmp/atoyac.sqlite', 'temporal'
    return DB_POR_OMISION, 'sqlite'


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


def motor_de_estacion(almacen, c_estacion):
    """Motor con el estado que tendria si hubiera recibido todo sin apagarse.
    Llamar dentro de almacen.transaccion(c_estacion)."""
    motor = reglas.Motor(**TABLAS_MOTOR)
    mide_lluvia = 'LLUVIA' in (TABLAS_MOTOR['estaciones'].get(c_estacion, {}).get('parametros') or [])
    for p in almacen.lecturas_recientes(c_estacion, REHIDRATAR_LADERA if mide_lluvia else REHIDRATAR):
        motor.evaluar(p)     # lo que devuelve se descarta: ya esta guardado
    motor.folio[c_estacion] = almacen.folio_maximo(c_estacion)
    return motor


def crear_app(url=None):
    url, persistencia = url_base(url)
    sal = antispam.sal_de(url)      # para la huella de la IP en el freno antispam
    estaciones = TABLAS_MOTOR['estaciones']
    # Se crea al llegar la primera peticion, no al importar: en Vercel el modulo se
    # importa al compilar, sin base disponible.
    estado = {}
    candado_inicio = threading.Lock()

    def ctx():
        if not estado:
            with candado_inicio:
                if not estado:
                    # Todo de una vez: otro hilo que vea 'estado' no vacío ya lo tiene completo.
                    estado.update(propagacion=Propagacion(), asignacion=Asignador(), almacen=Almacen(url))
        return estado

    app = FastAPI(title='Monitoreo del río Atoyac', version=VERSION_CONTRATO,
                  description='Backend M5. Contrato de datos v1.0; ver contrato/README.md.')
    app.state.ctx = ctx
    origenes = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origenes, allow_methods=['GET', 'POST', 'PATCH', 'OPTIONS'],
                       allow_headers=['Content-Type'], expose_headers=['X-Aviso-Correo'])

    @app.exception_handler(StarletteHTTPException)
    async def no_encontrada(request, exc):
        if exc.status_code in (404, 405):
            return error(404, {'error': 'ruta no encontrada', 'ruta': request.url.path})
        return error(exc.status_code, {'error': str(exc.detail)})

    # ------------------------------------------------------------- lectura
    @app.get('/salud')
    def salud():
        a = ctx()['almacen']
        return {'estado': 'ok', 'version_contrato': VERSION_CONTRATO, 'motor': 'real',
                'persistencia': persistencia,
                'hora': datetime.now().astimezone().isoformat(timespec='seconds'),
                'estaciones': len(estaciones),
                'alertas_abiertas': sum(1 for x in a.alertas() if x.get('estado') in ('Abierta', 'En atencion')),
                'reportes': a.contar('reporte'), 'lecturas': a.contar('lectura'),
                # Si los avisos por correo (recibo y cierre) tienen credenciales SMTP (no dice cuáles)
                'aviso_por_correo': correo.configurado()}

    @app.get('/estaciones')
    def get_estaciones():
        # ultima_recepcion: hora real de la ultima lectura; el mapa pulsa solo si la estacion esta enviando ahora
        rec = ctx()['almacen'].ultimas_recepciones()
        return {'version': VERSION_CONTRATO,
                'estaciones': [dict(e, ultima_recepcion=rec.get(ce)) for ce, e in estaciones.items()]}

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
        ruta = os.path.join(FIX, 'escenarios', nombre + '.json')
        if not re.fullmatch(r'[a-z_]+', nombre) or not os.path.exists(ruta):
            return error(404, {'error': 'escenario no encontrado'})
        return leer_json(ruta)

    @app.get('/veredictos')
    def veredictos(c_estacion: str | None = None):
        return {'veredictos': ctx()['almacen'].veredictos(c_estacion, 50)}

    @app.get('/alertas')
    def alertas(request: Request):
        # Filtros opcionales, los mismos que el mock: ?nivel=Critica&abiertas=1&modulo=ladera (la app ciudadana consulta
        # su alarma cada pocos segundos y no debe bajar todas las alertas) y ?c_estacion=EST-LAD-01&estado=pendientes
        # (el simulador y el mapa; pendientes = Abierta o En atencion, el criterio del panel).
        q = request.query_params
        lista = ctx()['almacen'].alertas()
        if q.get('nivel'):
            lista = [a for a in lista if a.get('nivel') == q['nivel']]
        if q.get('abiertas') in ('1', 'true') or q.get('estado') == 'pendientes':
            lista = [a for a in lista if a.get('estado') in ('Abierta', 'En atencion')]
        elif q.get('estado'):
            lista = [a for a in lista if a.get('estado') == q['estado']]
        if q.get('c_estacion'):
            lista = [a for a in lista if a.get('c_estacion') == q['c_estacion']]
        if q.get('modulo') == 'ladera':
            lista = [a for a in lista if a.get('regla') in REGLAS_LADERA]
        return {'alertas': lista}

    @app.get('/alertas/{c_alerta}/prediccion')
    def prediccion(c_alerta: str):
        c = ctx()
        a = c['almacen'].alerta(c_alerta)
        if a is None:
            return error(404, {'error': 'alerta no encontrada'})
        prop = c['propagacion']
        sitio = a.get('c_sitio') or estaciones.get(a['c_estacion'], {}).get('c_sitio')
        p = prop.predecir(sitio, prop.clave_conagua(a['c_parametro']), a.get('valor'),
                          datetime.fromisoformat(a['fecha_hora']), a['c_alerta'])
        # M3 trabaja en claves de CONAGUA; hacia afuera se usa el codigo del contrato.
        for d in p['destinos']:
            d['c_parametro'] = a['c_parametro']
        return p

    @app.get('/reportes')
    def get_reportes():
        # El correo es solo para el recibo y el aviso de cierre: nunca sale por la API publica.
        return {'reportes': [{k: v for k, v in r.items() if k != 'correo'} for r in ctx()['almacen'].reportes()]}

    @app.get('/huella')
    def get_huella():
        # Calor sobre el rio por densidad de reportes abiertos. Publica; misma salida que el mock.
        return prioridad_huella.huella(ctx()['almacen'].reportes())

    @app.get('/prioridades')
    def get_prioridades():
        # Para la autoridad: focos de reportes con prioridad de 1 a 10 y su desglose.
        a = ctx()['almacen']
        return prioridad_huella.prioridades(a.reportes(), a.alertas())

    @app.get('/reportes/{c_reporte}')
    def get_reporte(c_reporte: str, request: Request):
        # Consulta de folio para la app ciudadana (M8). Devuelve un solo reporte
        # para no obligarla a descargar todos. El correo no sale, igual que en
        # la lista: es solo para avisar del cierre.
        almacen = ctx()['almacen']
        # 20 consultas por minuto por persona, como SIGRIV: que no se puedan probar folios en masa
        quien = antispam.origen(request, sal)
        with almacen.transaccion('envio:' + quien):
            mensaje = antispam.excede(almacen, 'rastreo', quien)
            if not mensaje:
                almacen.registrar_envio('rastreo', quien, time.time())
        if mensaje:
            return error(429, {'error': 'demasiadas solicitudes', 'detalle': mensaje})
        r = almacen.reporte(c_reporte)
        if r is None:
            return error(404, {'error': 'folio no encontrado',
                               'detalle': 'revisa que este completo, con el formato '
                                          'RC-AAAAMMDD-0000'})
        return {k: v for k, v in r.items() if k != 'correo'}

    # ------------------------------------------------------------ escritura
    @app.post('/lecturas')
    async def lecturas(request: Request):
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        almacen = ctx()['almacen']
        paquetes = cuerpo if isinstance(cuerpo, list) else [cuerpo]
        errores = []
        por_estacion = OrderedDict()   # c_estacion -> [(posicion, paquete)], en el orden recibido
        for i, p in enumerate(paquetes):
            e = validador.validar(p, ESQ['lectura'], '$[{}]'.format(i))
            if e:
                errores += e
                continue
            if p['c_estacion'] not in estaciones:
                errores.append('$[{}].c_estacion: {} no esta registrada'.format(i, p['c_estacion']))
                continue
            por_estacion.setdefault(p['c_estacion'], []).append((i, p))

        resultados = {}
        for ce, lista in por_estacion.items():
            with almacen.transaccion(ce):
                motor = None
                for i, p in lista:
                    h = huella(p)
                    previo = almacen.veredicto_de_huella(h)
                    if previo is not None:
                        resultados[i] = previo       # reenvio identico: no se evalua otra vez
                        continue
                    motor = motor or motor_de_estacion(almacen, ce)
                    v = motor.evaluar(p)
                    v['motor'] = 'real'
                    almacen.guardar_evaluacion(p, h, v)
                    if v.get('reglas_normalizadas'):
                        almacen.cerrar_alertas(ce, v['reglas_normalizadas'])
                    resultados[i] = v
        aceptados = [resultados[i] for i in sorted(resultados)]
        if errores:
            return error(422, {'error': 'contrato no cumplido', 'detalles': errores, 'aceptados': len(aceptados)})
        return JSONResponse({'aceptados': len(aceptados), 'veredictos': aceptados}, status_code=202)

    @app.post('/estaciones/{c_estacion}/reiniciar')
    def reiniciar(c_estacion: str):
        """Arranque de una simulacion: cierra las alertas pendientes de la estacion y el motor deja de recordar lo anterior."""
        if c_estacion not in estaciones:
            return error(404, {'error': 'estacion no encontrada'})
        almacen = ctx()['almacen']
        with almacen.transaccion(c_estacion):
            cerradas = almacen.reiniciar(c_estacion)
        return {'c_estacion': c_estacion, 'alertas_cerradas': cerradas}

    @app.patch('/alertas/{c_alerta}')
    async def gestionar(c_alerta: str, request: Request):
        almacen = ctx()['almacen']
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
        with almacen.transaccion('alerta:' + c_alerta):
            almacen.actualizar_alerta(nueva)
        return nueva

    def tramites_conocidos():
        """{objeto: {(organismo, tramite): estado inicial}} de mecanismos.json y escuelas.json."""
        conocidos = {}
        for nombre, clave, lista in (('mecanismos.json', 'c_estacion', 'estaciones'), ('escuelas.json', 'cct', None)):
            ruta = os.path.join(FIX, nombre)
            if not os.path.exists(ruta):
                continue
            datos = leer_json(ruta)
            for o in (datos.get(lista, []) if lista else datos):
                for a in o.get('autorizaciones') or []:
                    conocidos.setdefault(o[clave], {})[(a.get('organismo'), a.get('tramite'))] = a.get('estado')
        return conocidos

    @app.get('/autorizaciones')
    def get_autorizaciones():
        # Solo lo registrado desde el panel; el panel lo sobrepone a los fixtures.
        return {'autorizaciones': ctx()['almacen'].autorizaciones()}

    @app.patch('/autorizaciones/{objeto}')
    async def registrar_autorizacion(objeto: str, request: Request):
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        if not isinstance(cuerpo, dict):
            return error(422, {'error': 'se espera un objeto'})
        ajenos = sorted(set(cuerpo) - set(CAMPOS_AUTORIZACION))
        if ajenos:
            return error(422, {'error': 'campos no permitidos', 'detalles': ajenos})
        conocidos = tramites_conocidos()
        par = (cuerpo.get('organismo'), cuerpo.get('tramite'))
        if objeto not in conocidos or par not in conocidos[objeto]:
            return error(404, {'error': 'trámite no encontrado', 'objeto': objeto, 'organismo': par[0], 'tramite': par[1]})
        detalles = []
        if cuerpo.get('estado') not in ESTADOS_TRAMITE:
            detalles.append('estado: uno de ' + ', '.join(ESTADOS_TRAMITE))
        encargado = (cuerpo.get('encargado') or '').strip() if isinstance(cuerpo.get('encargado'), str) else ''
        if not encargado or len(encargado) > 80:
            detalles.append('encargado: el nombre de quien registra (1 a 80 caracteres)')
        for k, n in (('oficio', 60), ('nota', 200)):
            v = cuerpo.get(k)
            if v is not None and (not isinstance(v, str) or len(v) > n):
                detalles.append('{}: texto de hasta {} caracteres'.format(k, n))
        if detalles:
            return error(422, {'error': 'datos no válidos', 'detalles': detalles})
        almacen = ctx()['almacen']
        ahora = datetime.now().astimezone()
        with almacen.transaccion('autorizaciones'):
            previo = almacen.autorizacion(objeto, par[0], par[1])
            historial = (previo or {}).get('historial', [])
            if previo:
                historial = historial + [{k: previo.get(k) for k in ('estado', 'encargado', 'oficio', 'fecha', 'registrado')}]
            registro = {'objeto': objeto, 'organismo': par[0], 'tramite': par[1], 'estado': cuerpo['estado'],
                        'encargado': encargado, 'oficio': (cuerpo.get('oficio') or '').strip() or None,
                        'nota': (cuerpo.get('nota') or '').strip() or None,
                        'fecha': ahora.date().isoformat(), 'registrado': ahora.isoformat(timespec='seconds'),
                        'historial': historial[-20:]}
            almacen.guardar_autorizacion(registro)
        return registro

    @app.patch('/reportes/{c_reporte}')
    async def gestionar_reporte(c_reporte: str, request: Request):
        # Misma ruta y mismas respuestas que el mock: el panel de autoridad cambia el estado de un reporte.
        almacen = ctx()['almacen']
        if not re.match(r'^RC-[0-9]{8}-[0-9]{4}$', c_reporte):
            return error(404, {'error': 'ruta no encontrada', 'ruta': '/reportes/' + c_reporte})
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        if not isinstance(cuerpo, dict):
            return error(422, {'error': 'se espera un objeto'})
        ajenos = sorted(set(cuerpo) - set(CAMPOS_GESTION_REPORTE))
        if ajenos:
            return error(422, {'error': 'solo se puede cambiar el estado', 'detalles': ajenos})
        with almacen.transaccion('reportes'):
            reporte = almacen.reporte(c_reporte)
            if reporte is None:
                return error(404, {'error': 'folio no encontrado'})
            nuevo = dict(reporte, **cuerpo)
            e = validador.validar(nuevo, ESQ['reporte_ciudadano'])
            if e:
                return error(422, {'error': 'contrato no cumplido', 'detalles': e})
            almacen.actualizar_reporte(nuevo)
        # Cada vez que el reporte avanza a otro estado (validado, en atención, cerrado o descartado) se avisa a quien
        # dejó su correo; si el estado no cambia, no se repite. Fuera del candado y en un hilo:
        # el SMTP tarda hasta 10 s. Se espera aquí y no en segundo plano porque en Vercel la función se congela
        # al responder. El resultado va en una cabecera: el cuerpo sigue siendo el mismo que el del mock.
        aviso = 'no_aplica'
        if nuevo.get('estado') != reporte.get('estado'):
            from starlette.concurrency import run_in_threadpool
            base = '{}://{}'.format(request.headers.get('x-forwarded-proto', request.url.scheme), request.headers.get('host', ''))
            aviso = await run_in_threadpool(correo.avisar_estado, nuevo, base)
        return JSONResponse({k: v for k, v in nuevo.items() if k != 'correo'}, headers={'X-Aviso-Correo': aviso})

    @app.post('/reportes/analizar-foto')
    async def analizar_foto(request: Request):
        # Misma ruta y misma respuesta que el mock. La llamada a Gemini bloquea hasta 15 s: va en un hilo.
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        ip = request.client.host if request.client else 'desconocida'
        if not analisis_foto.permitir(ip):
            return error(429, {'error': 'demasiadas solicitudes', 'detalle': 'espera un minuto'})
        from starlette.concurrency import run_in_threadpool
        r = await run_in_threadpool(analisis_foto.analizar, cuerpo.get('foto') if isinstance(cuerpo, dict) else None)
        return JSONResponse(r, status_code=422 if r['estado'] == 'rechazada' else 200)

    @app.post('/reportes')
    async def reportes(request: Request):
        cuerpo, problema = await leer_cuerpo(request)
        if problema:
            return error(400, {'error': problema})
        if not isinstance(cuerpo, dict):
            return error(422, {'error': 'contrato no cumplido', 'detalles': ['$: se espera un objeto']})
        almacen = ctx()['almacen']
        # El folio sale del conteo: dos reportes a la vez no deben llevarse el mismo.
        with almacen.transaccion('reportes'):
            cuerpo.setdefault('version', VERSION_CONTRATO)
            cuerpo.setdefault('estado', 'Recibido')
            cuerpo.setdefault('exif_removido', False)
            cuerpo.setdefault('c_reporte', 'RC-{}-{:04d}'.format(
                datetime.now().strftime('%Y%m%d'), almacen.contar('reporte') + 1))
            cuerpo.setdefault('fecha_hora', datetime.now().astimezone().isoformat(timespec='seconds'))
            # El tramo lo decide el backend, no la app: asignar al sitio mas
            # cercano en linea recta esta mal, porque dos puntos a 200 m pueden
            # estar en barrancas que no se comunican. Se sigue el agua.
            if cuerpo.get('latitud') is not None and cuerpo.get('longitud') is not None:
                a = ctx()['asignacion'].asignar(cuerpo['latitud'], cuerpo['longitud'])
                cuerpo['c_sitio_asignado'] = a['c_sitio_asignado']
                cuerpo['distancia_al_cauce_m'] = a['distancia_al_cauce_m']
            e = validador.validar(cuerpo, ESQ['reporte_ciudadano'])
            if e:
                return error(422, {'error': 'contrato no cumplido', 'detalles': e})
            if not cuerpo['exif_removido']:
                return error(409, {'error': 'la foto conserva metadatos EXIF',
                                   'detalle': 'quita el EXIF antes de enviar: lleva coordenadas y modelo del telefono'})
            # Freno antispam (antispam.py), después de validar: un cuerpo inválido recibe el mismo error que en el mock.
            quien, ahora = antispam.origen(request, sal), time.time()
            mensaje = antispam.excede(almacen, 'reportes', quien, ahora)
            if mensaje:
                return error(429, {'error': 'demasiadas solicitudes', 'detalle': mensaje})
            previo = antispam.repetido(almacen, quien, cuerpo, ahora)
            if previo:
                # Misma persona, mismo tipo, mismo punto, hace poco: no se crea otro reporte, se le devuelve su folio
                anterior = almacen.reporte(previo) or {}
                return JSONResponse({'c_reporte': previo, 'estado': anterior.get('estado', 'Recibido'), 'repetido': True,
                                     'detalle': 'Ya recibimos tu reporte de este mismo problema aquí hace poco; '
                                                'este es su folio.'}, status_code=200)
            almacen.guardar_reporte(cuerpo)
            almacen.registrar_envio('reportes', quien, ahora, cuerpo['latitud'], cuerpo['longitud'], cuerpo['tipo'], cuerpo['c_reporte'])
        # Recibo por correo con el folio, para que la persona sepa que su reporte llegó. Fuera del candado y en un
        # hilo, esperando aquí por lo mismo que el aviso de cierre (Vercel congela la función al responder). Un
        # reporte repetido (arriba) devuelve su folio anterior y no manda otro recibo.
        aviso = 'sin_correo'
        if cuerpo.get('correo'):
            from starlette.concurrency import run_in_threadpool
            base = '{}://{}'.format(request.headers.get('x-forwarded-proto', request.url.scheme), request.headers.get('host', ''))
            aviso = await run_in_threadpool(correo.avisar_recibo, cuerpo, base)
        return JSONResponse({'c_reporte': cuerpo['c_reporte'], 'estado': cuerpo['estado']}, status_code=201,
                            headers={'X-Aviso-Correo': aviso})

    return app

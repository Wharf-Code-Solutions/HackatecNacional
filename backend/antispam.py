# -*- coding: utf-8 -*-
"""Freno a los envíos repetidos de una misma persona, como el de SIGRIV
(Wharf-Code-Solutions/HackatecRegional, api/index.py: check_rate_limit), con dos
diferencias:

1. El conteo vive en la base (tabla `envio`), no en la memoria del proceso. En
   Vercel cada petición puede caer en una instancia distinta, y un contador en
   memoria se reinicia en cada una: el de SIGRIV no frena ahí.
2. Además del límite por minuto, «misma persona, mismo punto»: un reporte del
   mismo tipo, desde el mismo origen, a menos de MISMO_PUNTO_M y en menos de
   MISMO_PUNTO_MIN no crea otro reporte; se devuelve el folio que ya tenía. Sin
   esto, una persona inflaba la corroboración ciudadana de su propio foco (D30).

«Origen» es la huella de la IP (SHA-256 con una sal secreta), nunca la IP: con
la sal no se puede reconstruir. La sal es ANTISPAM_SECRETO o, si no existe, la
cadena de conexión de la base, que ya es secreta e igual en todas las
instancias. Los registros se borran a la hora.

Límite conocido: muchas personas comparten IP (datos móviles de una compañía,
el wifi de una escuela). Por eso el bloqueo por punto solo aplica al mismo tipo,
a 150 m y por 30 minutos, y el límite general es holgado.
"""
import hashlib
import math
import os
import time

VENTANA_S = 60
LIMITES = {                  # cubeta -> (máximo en VENTANA_S, mensaje)
    'reportes': (5, 'Enviaste varios reportes seguidos. Espera un minuto antes de mandar otro.'),
    'rastreo': (20, 'Demasiadas consultas de folio. Espera un minuto y vuelve a intentar.'),
}
MISMO_PUNTO_M = 150          # el radio de un foco (contrato/prioridad_huella.py, FOCO_RADIO_M)
MISMO_PUNTO_MIN = 30


def ip_del_cliente(request):
    """Detrás del proxy de Vercel la IP real viene primero en X-Forwarded-For."""
    reenviada = request.headers.get('x-forwarded-for', '')
    return reenviada.split(',')[0].strip() or (request.client.host if request.client else 'desconocida')


def origen(request, sal):
    ip = ip_del_cliente(request)
    return hashlib.sha256((sal + '|' + ip).encode('utf-8')).hexdigest()[:32]


def sal_de(url_base):
    return os.environ.get('ANTISPAM_SECRETO') or url_base or 'atoyac'


def _metros(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def excede(almacen, cubeta, quien, ahora=None):
    """Mensaje si `quien` ya llegó al límite de la cubeta en la ventana; None si puede seguir.
    Llamar dentro de una transaccion()."""
    ahora = ahora or time.time()
    maximo, mensaje = LIMITES[cubeta]
    return mensaje if len(almacen.envios_recientes(cubeta, quien, ahora - VENTANA_S)) >= maximo else None


def repetido(almacen, quien, reporte, ahora=None):
    """El folio del reporte que esta misma persona ya mandó del mismo tipo y en el mismo punto hace poco, o None."""
    ahora = ahora or time.time()
    lat, lon, tipo = reporte.get('latitud'), reporte.get('longitud'), reporte.get('tipo')
    if lat is None or lon is None:
        return None
    for _momento, la, lo, ti, folio in almacen.envios_recientes('reportes', quien, ahora - MISMO_PUNTO_MIN * 60):
        if ti == tipo and la is not None and _metros(lat, lon, la, lo) <= MISMO_PUNTO_M:
            return folio
    return None

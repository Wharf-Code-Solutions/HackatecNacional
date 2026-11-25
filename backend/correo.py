# -*- coding: utf-8 -*-
"""Avisos por correo a quien deja su correo en un reporte ciudadano.

Dos y solo dos, como dicen el formulario y los términos de la app: el recibo al
crear el reporte (con su folio, para que la persona sepa que llegó y pueda
rastrearlo) y el aviso al pasar a «Cerrado». Ninguno en las etapas intermedias.

Por SMTP, como SIGRIV (Wharf-Code-Solutions/HackatecRegional, api/index.py).
Las credenciales van en variables de entorno, nunca en el repositorio:

    SMTP_USER       la cuenta que envía (p. ej. una de Gmail del proyecto)
    SMTP_PASSWORD   su contraseña de aplicación (Gmail exige verificación en dos pasos)
    SMTP_HOST       opcional, smtp.gmail.com
    SMTP_PORT       opcional, 465 (SSL)
    MAIL_FROM_NAME  opcional, el nombre que ve quien recibe
    APP_URL         opcional, la URL pública del sitio para el enlace al rastreo;
                    sin ella se usa la del propio backend sin /api

Sin SMTP_USER y SMTP_PASSWORD no se envía nada y todo lo demás sigue igual.
avisar_recibo() y avisar_cierre() nunca lanzan: un correo que falla no debe
deshacer un reporte o un cambio de estado que ya se guardó. Solo biblioteca estándar.
"""
import html
import os
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr

TIPO = {
    'descarga_visible': 'Descarga visible', 'espuma': 'Espuma', 'color_anormal': 'Color o espuma', 'deslave': 'Deslave',
    'mal_olor': 'Mal olor', 'basura_o_residuos': 'Basura o residuos', 'peces_muertos': 'Peces muertos', 'otro': 'Otro',
}
GUINDA, DORADO, VERDE, GRIS = '#9D2449', '#BC955C', '#0B231E', '#545454'


def _config():
    return {
        'host': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        'puerto': int(os.environ.get('SMTP_PORT', '465')),
        'usuario': (os.environ.get('SMTP_USER') or '').strip(),
        # Google muestra la contraseña de aplicación en grupos de 4 con espacios
        'clave': (os.environ.get('SMTP_PASSWORD') or '').replace(' ', ''),
        'nombre': os.environ.get('MAIL_FROM_NAME', 'CENTINELA'),
        'app_url': (os.environ.get('APP_URL') or '').rstrip('/'),
    }


def configurado():
    c = _config()
    return bool(c['usuario'] and c['clave'])


def enmascarar(correo):
    """persona@dominio.mx -> pe***@dominio.mx, para los registros: el correo completo no se escribe en logs."""
    usuario, _, dominio = (correo or '').partition('@')
    return (usuario[:2] + '***@' + dominio) if dominio else '***'


def _fecha(iso):
    try:
        d = datetime.fromisoformat(iso)
        return d.strftime('%d/%m/%Y')
    except (TypeError, ValueError):
        return ''


# Lo que cambia entre el recibo y el cierre; el resto del correo es el mismo.
TEXTOS = {
    'recibo': {
        'asunto': 'Recibimos tu reporte {folio}',
        'titulo': 'Recibimos tu reporte',
        'parrafo': 'Tu reporte llegó y ya está en la lista de la autoridad. Guarda tu folio para ver cómo avanza.',
        'texto': 'Recibimos tu reporte {folio} ({tipo}{fecha}). Ya está en la lista de la autoridad.\n\n'
                 'Guarda tu folio. Puedes ver cómo avanza aquí: {enlace}',
        'pie': 'Gracias por avisar. Te escribiremos cada vez que tu reporte avance; tu dirección no se usa para nada más.',
    },
    'validado': {
        'asunto': 'Tu reporte {folio} fue validado',
        'titulo': 'Tu reporte fue validado',
        'parrafo': 'La autoridad revisó tu reporte y lo marcó como <strong>validado</strong>: corresponde a un problema real y pasa a atención.',
        'texto': 'La autoridad revisó tu reporte {folio} ({tipo}{fecha}) y lo marcó como validado.\n\n'
                 'Puedes ver cómo avanza aquí: {enlace}',
        'pie': 'Gracias por avisar. Te escribiremos de nuevo cuando avance; tu dirección no se usa para nada más.',
    },
    'atencion': {
        'asunto': 'Tu reporte {folio} está en atención',
        'titulo': 'Tu reporte está en atención',
        'parrafo': 'La autoridad ya está <strong>atendiendo</strong> tu reporte.',
        'texto': 'La autoridad ya está atendiendo tu reporte {folio} ({tipo}{fecha}).\n\n'
                 'Puedes ver cómo avanza aquí: {enlace}',
        'pie': 'Gracias por avisar. Te escribiremos de nuevo cuando se cierre; tu dirección no se usa para nada más.',
    },
    'descartado': {
        'asunto': 'Tu reporte {folio} fue descartado',
        'titulo': 'Tu reporte fue descartado',
        'parrafo': 'La autoridad revisó tu reporte y lo marcó como <strong>descartado</strong>: no se pudo confirmar o ya estaba atendido por otro reporte.',
        'texto': 'La autoridad revisó tu reporte {folio} ({tipo}{fecha}) y lo marcó como descartado.\n\n'
                 'Puedes ver su seguimiento aquí: {enlace}',
        'pie': 'Gracias por avisar. Este es el último correo sobre este reporte; tu dirección no se usa para nada más.',
    },
    'cierre': {
        'asunto': 'Tu reporte {folio} fue atendido',
        'titulo': 'Tu reporte fue atendido',
        'parrafo': 'La autoridad marcó como <strong>cerrado</strong> tu reporte.',
        'texto': 'La autoridad marcó como cerrado tu reporte {folio} ({tipo}{fecha}).\n\n'
                 'Puedes ver su seguimiento aquí: {enlace}',
        'pie': 'Gracias por avisar. Este es el último correo sobre este reporte; tu dirección no se usa para nada más.',
    },
}
MARCA = 'CENTINELA · Prototipo HackaTec 2026. No es un sitio oficial del Gobierno de México.'


def construir(reporte, enlace, clase='cierre'):
    """(asunto, texto, html) del correo. Estilo gob.mx con CSS en línea, que es lo que leen los clientes de correo."""
    t = TEXTOS[clase]
    folio = reporte['c_reporte']
    tipo = TIPO.get(reporte.get('tipo'), reporte.get('tipo') or 'Reporte')
    fecha = _fecha(reporte.get('fecha_hora'))
    asunto = t['asunto'].format(folio=folio)
    texto = ('Hola:\n\n' + t['texto'].format(folio=folio, tipo=tipo, fecha=', del ' + fecha if fecha else '', enlace=enlace)
             + '\n\n' + t['pie'] + '\n\n' + MARCA)
    e = html.escape
    cuerpo = """<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#ebe7e4;font-family:'Noto Sans',Arial,sans-serif;color:{gris}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ebe7e4;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:{verde};padding:16px 24px;border-bottom:3px solid {dorado};color:#fff;font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:600">CENTINELA</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-family:Montserrat,Arial,sans-serif;font-size:20px;color:{guinda}">{titulo}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">{parrafo}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e0e0e0;border-radius:8px;margin:0 0 20px">
<tr><td style="padding:12px 16px;font-size:13px;color:#888">Folio</td><td style="padding:12px 16px;font-size:15px;font-weight:700;color:{verde}">{folio}</td></tr>
<tr><td style="padding:0 16px 12px;font-size:13px;color:#888">Problema</td><td style="padding:0 16px 12px;font-size:15px">{tipo}</td></tr>
{fila_fecha}
</table>
<p style="margin:0 0 24px"><a href="{enlace}" style="display:inline-block;background:{guinda};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:6px">Ver el seguimiento</a></p>
<p style="margin:0;font-size:13px;color:#777;line-height:1.5">{pie}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f6f6f6;font-size:12px;color:#888">{marca}</td></tr>
</table></td></tr></table></body></html>""".format(
        gris=GRIS, verde=VERDE, dorado=DORADO, guinda=GUINDA, folio=e(folio), tipo=e(tipo), enlace=e(enlace),
        titulo=e(t['titulo']), parrafo=t['parrafo'], pie=e(t['pie']), marca=e(MARCA),
        fila_fecha=('<tr><td style="padding:0 16px 12px;font-size:13px;color:#888">Reportado</td>'
                    '<td style="padding:0 16px 12px;font-size:15px">{}</td></tr>'.format(e(fecha)) if fecha else ''))
    return asunto, texto, cuerpo


def _avisar(reporte, base_url, clase):
    """Manda el correo `clase` a quien dejó su correo. Devuelve 'enviado', 'sin_correo', 'no_configurado' o
    'fallido'. Nunca lanza."""
    destino = (reporte.get('correo') or '').strip()
    if not destino:
        return 'sin_correo'
    c = _config()
    if not (c['usuario'] and c['clave']):
        print('[correo omitido] SMTP_USER/SMTP_PASSWORD no configurados ({}, {})'.format(clase, reporte.get('c_reporte')))
        return 'no_configurado'
    raiz = c['app_url'] or (base_url or '').rstrip('/')
    enlace = '{}/ciudadano/#/rastreo?folio={}'.format(raiz, reporte['c_reporte'])
    try:
        asunto, texto, cuerpo = construir(reporte, enlace, clase)
        msg = EmailMessage()
        msg['Subject'] = asunto
        msg['From'] = formataddr((c['nombre'], c['usuario']))
        msg['To'] = destino
        msg.set_content(texto)
        msg.add_alternative(cuerpo, subtype='html')
        with smtplib.SMTP_SSL(c['host'], c['puerto'], timeout=10, context=ssl.create_default_context()) as smtp:
            smtp.login(c['usuario'], c['clave'])
            smtp.send_message(msg)
        print('[correo] {} de {} enviado a {}'.format(clase, reporte['c_reporte'], enmascarar(destino)))
        return 'enviado'
    except Exception as ex:   # noqa: BLE001 -- cualquier falla de red o de SMTP se registra y no se propaga
        print('[correo] ERROR al enviar el {} de {} a {}: {}'.format(clase, reporte['c_reporte'], enmascarar(destino),
                                                                     type(ex).__name__))
        return 'fallido'


def avisar_recibo(reporte, base_url=''):
    """Recibo al crear el reporte: el folio y el enlace a su rastreo."""
    return _avisar(reporte, base_url, 'recibo')


def avisar_cierre(reporte, base_url=''):
    """Aviso al pasar a «Cerrado»."""
    return _avisar(reporte, base_url, 'cierre')


# Cada paso del reporte que se avisa: estado del contrato -> correo. «Recibido» es el recibo, al crear.
POR_ESTADO = {'Validado': 'validado', 'En atencion': 'atencion', 'Cerrado': 'cierre', 'Descartado': 'descartado'}


def avisar_estado(reporte, base_url=''):
    """Aviso al pasar a un estado nuevo (validado, en atención, cerrado o descartado). 'no_aplica' si el estado
    no tiene correo."""
    clase = POR_ESTADO.get(reporte.get('estado'))
    return _avisar(reporte, base_url, clase) if clase else 'no_aplica'

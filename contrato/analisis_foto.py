# -*- coding: utf-8 -*-
"""Revisa si la foto de un reporte ciudadano corresponde a alguno de los tipos que se pueden reportar.

La app ciudadana manda la miniatura (JPEG de 640 px, sin EXIF) y este modulo le pregunta a Gemini si
muestra una descarga, espuma, un color anormal del agua, basura en el cauce, peces muertos o un mal
olor (una orilla o un cuerpo de agua sospechoso), o si no tiene nada que ver (selfi, captura de
pantalla, comida, un interior). Sirve para que no entren fotos basura.

Solo biblioteca estandar, para que el mock y el backend lo carguen igual. Ninguno de los dos modulos
importa al otro: lo comparten por el contrato, igual que el validador.

Llave: variable de entorno GEMINI_API_KEY, o la misma linea en el .env de la raiz del repo (no se
versiona). Nunca se imprime ni se manda en una URL. Modelo: GEMINI_MODEL (por omision gemini-2.5-flash).

Politica: si el servicio no esta disponible (sin llave, sin red, error) responde estado
'no_disponible' y la app deja enviar con un aviso; no se bloquea a nadie por una falla nuestra.
"""
import base64
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TIPOS = ['descarga_visible', 'espuma', 'color_anormal', 'mal_olor', 'basura_o_residuos', 'peces_muertos']
UMBRAL = 0.6                  # menos confianza que esto cuenta como 'no corresponde'
MAX_BYTES = 600 * 1024        # la miniatura real pesa ~60 KB; esto corta abusos
TIEMPO_MAX_S = 15
POR_MINUTO = 10               # por IP, en este proceso (en Vercel es por instancia: es un freno, no una garantia)

PROMPT = (
    'Eres un filtro de calidad para reportes ciudadanos de contaminacion del rio Atoyac (Puebla y Tlaxcala). '
    'Mira la foto y elige el tipo de reporte que mejor la describe, o "ninguno" si no corresponde a ninguno.\n'
    'Tipos:\n'
    '- descarga_visible: un tubo, canal o ducto que vierte liquido al rio, arroyo o barranca.\n'
    '- espuma: espuma sobre el agua o en la orilla.\n'
    '- color_anormal: agua de un color inusual (rojo, negro, verde intenso, lechoso, aceitoso, con brillo).\n'
    '- mal_olor: un cuerpo de agua o una orilla con aspecto sucio o estancado donde se pueda sentir mal olor.\n'
    '- basura_o_residuos: basura, escombro o residuos en el cauce o en la orilla.\n'
    '- peces_muertos: peces u otros animales muertos en o junto al agua.\n'
    '- ninguno: la foto no muestra un rio, arroyo, canal, orilla ni ninguna de las situaciones anteriores '
    '(selfi, personas posando, captura de pantalla, comida, mascotas, interiores, memes, imagenes borrosas o negras).\n'
    'Reglas: evalua solo lo que se ve; no identifiques a ninguna persona. Si dudas entre un tipo y "ninguno", '
    'baja la confianza. "confianza" va de 0 a 1. "motivo" es una frase corta en espanol de lo que ves.'
)

ESQUEMA = {
    'type': 'OBJECT',
    'properties': {
        'tipo': {'type': 'STRING', 'enum': TIPOS + ['ninguno']},
        'confianza': {'type': 'NUMBER'},
        'motivo': {'type': 'STRING'},
    },
    'required': ['tipo', 'confianza', 'motivo'],
}

_visitas = {}
_cerrojo = threading.Lock()


def _llave():
    for nombre in ('GEMINI_API_KEY', 'GOOGLE_API_KEY'):
        v = os.environ.get(nombre)
        if v:
            return v.strip()
    ruta = os.path.join(RAIZ, '.env')
    try:
        with open(ruta, encoding='utf-8') as f:
            for linea in f:
                m = re.match(r'\s*(?:export\s+)?(GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.+?)\s*$', linea)
                if m:
                    return m.group(2).strip('"\'')
    except OSError:
        pass
    return None


def permitir(ip):
    """Freno simple por IP: POR_MINUTO solicitudes por minuto."""
    ahora = time.time()
    with _cerrojo:
        recientes = [t for t in _visitas.get(ip, []) if ahora - t < 60]
        if len(recientes) >= POR_MINUTO:
            _visitas[ip] = recientes
            return False
        recientes.append(ahora)
        _visitas[ip] = recientes
        return True


def _separar(foto):
    """Acepta un data URI o base64 pelon. Devuelve (mime, base64) o (None, motivo)."""
    if not isinstance(foto, str) or not foto:
        return None, 'falta la foto'
    mime = 'image/jpeg'
    if foto.startswith('data:'):
        m = re.match(r'data:(image/(?:jpeg|png|webp));base64,(.+)$', foto, re.S)
        if not m:
            return None, 'formato de imagen no admitido'
        mime, foto = m.group(1), m.group(2)
    try:
        crudo = base64.b64decode(foto, validate=True)
    except (ValueError, TypeError):
        return None, 'imagen mal codificada'
    if len(crudo) > MAX_BYTES:
        return None, 'imagen demasiado grande'
    return mime, foto


def analizar(foto):
    """Devuelve un dict. estado 'ok' trae tipo, confianza, motivo, valida y modelo; 'no_disponible' trae razon."""
    mime, datos = _separar(foto)
    if mime is None:
        return {'estado': 'rechazada', 'razon': datos}
    llave = _llave()
    if not llave:
        return {'estado': 'no_disponible', 'razon': 'sin_llave'}
    modelo = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    base = os.environ.get('GEMINI_URL_BASE', 'https://generativelanguage.googleapis.com/v1beta')
    cuerpo = {
        'contents': [{'parts': [{'text': PROMPT}, {'inline_data': {'mime_type': mime, 'data': datos}}]}],
        'generationConfig': {'temperature': 0, 'responseMimeType': 'application/json', 'responseSchema': ESQUEMA},
    }
    req = urllib.request.Request(
        '{}/models/{}:generateContent'.format(base, modelo),
        data=json.dumps(cuerpo).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': llave}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=TIEMPO_MAX_S) as r:
            resp = json.loads(r.read().decode('utf-8'))
        texto = resp['candidates'][0]['content']['parts'][0]['text']
        d = json.loads(texto)
        tipo = d['tipo']
        confianza = max(0.0, min(1.0, float(d['confianza'])))
        if tipo not in TIPOS + ['ninguno']:
            raise ValueError('tipo fuera del catalogo')
    except urllib.error.HTTPError as e:
        return {'estado': 'no_disponible', 'razon': 'http_{}'.format(e.code)}
    except (urllib.error.URLError, TimeoutError, OSError):
        return {'estado': 'no_disponible', 'razon': 'sin_red'}
    except (KeyError, IndexError, ValueError, TypeError):
        return {'estado': 'no_disponible', 'razon': 'respuesta_inesperada'}
    return {'estado': 'ok', 'tipo': tipo, 'confianza': round(confianza, 2),
            'motivo': str(d.get('motivo', ''))[:200], 'modelo': modelo,
            'valida': tipo != 'ninguno' and confianza >= UMBRAL}

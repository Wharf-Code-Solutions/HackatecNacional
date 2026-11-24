# -*- coding: utf-8 -*-
"""Funcion de Vercel: el backend (M5) servido en /api del mismo proyecto que el panel.

Vercel ejecuta este archivo como funcion de Python y le pasa todas las rutas
/api/... (ver vercel.json en la raiz). El backend vive en backend/; aqui solo se
monta bajo /api. Lee motor/, contrato/ y datos/procesados/, que vercel.json
incluye en la funcion.

Base de datos: la variable DATABASE_URL con la cadena del Transaction pooler de Supabase
(Postgres). Sin ella el backend usa /tmp, que Vercel borra, y /api/salud lo dice
con "persistencia": "temporal".
"""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, 'backend'))

from fastapi import FastAPI   # noqa: E402
from app import crear_app     # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount('/api', crear_app())

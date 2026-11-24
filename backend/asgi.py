# -*- coding: utf-8 -*-
"""Punto de entrada para un servidor ASGI en producción, desde backend/:

    uvicorn asgi:app --host 0.0.0.0 --port $PORT

Variables de entorno: BACKEND_DB (ruta del archivo SQLite) y CORS_ORIGINS
(orígenes permitidos separados por coma; por omisión, todos).
"""
from app import crear_app

app = crear_app()

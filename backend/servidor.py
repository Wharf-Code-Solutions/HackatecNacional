# -*- coding: utf-8 -*-
"""Arranca el backend en tu computadora.

    backend\\.venv\\Scripts\\python backend/servidor.py              # http://127.0.0.1:8080
    backend\\.venv\\Scripts\\python backend/servidor.py --limpiar    # empieza con la base vacia

Usa el mismo puerto que el mock (8080), así el panel, el mapa, el simulador y
reproducir_escenario.py lo encuentran sin cambiar nada. No corras los dos a la vez.
"""
import argparse
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)


def main():
    import uvicorn
    from app import DB_POR_OMISION, crear_app

    ap = argparse.ArgumentParser(description='Backend M5 del monitoreo del río Atoyac')
    ap.add_argument('--puerto', type=int, default=8080)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--db', default=os.environ.get('BACKEND_DB') or DB_POR_OMISION,
                    help='archivo SQLite (por omisión backend/datos/atoyac.sqlite)')
    ap.add_argument('--limpiar', action='store_true',
                    help='borra la base antes de arrancar (para empezar una demostración desde cero)')
    args = ap.parse_args()
    # Antes de borrar nada: si el puerto está ocupado (un mock u otro backend), uvicorn fallaría
    # después de haber vaciado la base.
    import socket
    with socket.socket() as s:
        try:
            s.bind((args.host, args.puerto))
        except OSError as e:
            sys.exit('No se pudo abrir el puerto {}: {}\nOtro servidor lo está usando (¿el mock?). '
                     'Detenlo y vuelve a arrancar este.'.format(args.puerto, e))
    if args.limpiar:
        for sufijo in ('', '-wal', '-shm'):
            if os.path.exists(args.db + sufijo):
                os.remove(args.db + sufijo)
        print('Base borrada: {}'.format(args.db))
    print('Backend M5 (motor real, SQLite en {}) en http://{}:{}'.format(args.db, args.host, args.puerto))
    print('Documentación interactiva: http://{}:{}/docs'.format(args.host, args.puerto))
    uvicorn.run(crear_app(args.db), host=args.host, port=args.puerto, log_level='warning')


if __name__ == '__main__':
    main()

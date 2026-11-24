# -*- coding: utf-8 -*-
"""Persistencia del backend en SQLite (biblioteca estandar).

Se guarda cada objeto del contrato como JSON tal cual, con unas pocas columnas
para filtrar y ordenar. Asi el esquema de la base no duplica el del contrato: si
el contrato gana un campo opcional, la base no cambia.

Un solo hilo usa la conexion a la vez (candado), para leer y para escribir.
FastAPI atiende las rutas en varios hilos y el panel pide 8 cosas a la vez: una
conexion de sqlite3 compartida sin candado falla con "bad parameter or other API
misuse". El motor de reglas tambien tiene estado y no es seguro bajo concurrencia.
Para el volumen del piloto (5 estaciones, 96 paquetes por dia cada una) basta.
"""
import functools
import hashlib
import json
import os
import sqlite3
import threading


def con_candado(metodo):
    @functools.wraps(metodo)
    def envuelto(self, *args, **kwargs):
        with self.candado:
            return metodo(self, *args, **kwargs)
    return envuelto

ESQUEMA = """
CREATE TABLE IF NOT EXISTS lectura (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    c_estacion TEXT NOT NULL,
    fecha_hora TEXT NOT NULL,
    huella TEXT NOT NULL UNIQUE,      -- sha256 del paquete: un reenvio identico no se evalua dos veces
    paquete TEXT NOT NULL,
    recibido TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS lectura_estacion ON lectura (c_estacion, id);

CREATE TABLE IF NOT EXISTS veredicto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lectura INTEGER NOT NULL REFERENCES lectura (id),
    c_estacion TEXT NOT NULL,
    veredicto TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS veredicto_estacion ON veredicto (c_estacion, id);

CREATE TABLE IF NOT EXISTS alerta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    c_alerta TEXT NOT NULL UNIQUE,
    c_estacion TEXT NOT NULL,
    alerta TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reporte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    c_reporte TEXT NOT NULL UNIQUE,
    reporte TEXT NOT NULL
);
"""


def huella(paquete):
    return hashlib.sha256(json.dumps(paquete, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()


class Almacen:
    def __init__(self, ruta):
        if ruta != ':memory:':
            os.makedirs(os.path.dirname(os.path.abspath(ruta)), exist_ok=True)
        self.ruta = ruta
        self.candado = threading.RLock()
        self.cx = sqlite3.connect(ruta, check_same_thread=False)
        self.cx.execute('PRAGMA journal_mode=WAL')
        self.cx.execute('PRAGMA foreign_keys=ON')
        self.cx.executescript(ESQUEMA)

    # ------------------------------------------------------------ lecturas
    @con_candado
    def veredicto_de_huella(self, h):
        """Si el paquete ya se recibio, devuelve su veredicto guardado."""
        fila = self.cx.execute(
            'SELECT v.veredicto FROM lectura l JOIN veredicto v ON v.id_lectura = l.id '
            'WHERE l.huella = ?', (h,)).fetchone()
        return json.loads(fila[0]) if fila else None

    @con_candado
    def guardar_evaluacion(self, paquete, h, veredicto):
        """Lectura, veredicto y alertas nuevas en una sola transaccion."""
        with self.cx:
            cur = self.cx.execute(
                'INSERT INTO lectura (c_estacion, fecha_hora, huella, paquete) VALUES (?, ?, ?, ?)',
                (paquete['c_estacion'], paquete['fecha_hora'], h, json.dumps(paquete, ensure_ascii=False)))
            self.cx.execute(
                'INSERT INTO veredicto (id_lectura, c_estacion, veredicto) VALUES (?, ?, ?)',
                (cur.lastrowid, paquete['c_estacion'], json.dumps(veredicto, ensure_ascii=False)))
            for a in veredicto.get('alertas', []):
                self.cx.execute(
                    'INSERT INTO alerta (c_alerta, c_estacion, alerta) VALUES (?, ?, ?)',
                    (a['c_alerta'], a['c_estacion'], json.dumps(a, ensure_ascii=False)))

    @con_candado
    def lecturas_recientes(self, c_estacion, n):
        filas = self.cx.execute(
            'SELECT paquete FROM lectura WHERE c_estacion = ? ORDER BY id DESC LIMIT ?',
            (c_estacion, n)).fetchall()
        return [json.loads(f[0]) for f in reversed(filas)]

    @con_candado
    def contar(self, tabla):
        assert tabla in ('lectura', 'veredicto', 'alerta', 'reporte')
        return self.cx.execute('SELECT COUNT(*) FROM ' + tabla).fetchone()[0]

    # ----------------------------------------------------------- veredictos
    @con_candado
    def veredictos(self, c_estacion=None, n=50):
        if c_estacion:
            filas = self.cx.execute(
                'SELECT veredicto FROM veredicto WHERE c_estacion = ? ORDER BY id DESC LIMIT ?',
                (c_estacion, n)).fetchall()
        else:
            filas = self.cx.execute('SELECT veredicto FROM veredicto ORDER BY id DESC LIMIT ?', (n,)).fetchall()
        return [json.loads(f[0]) for f in reversed(filas)]

    # -------------------------------------------------------------- alertas
    @con_candado
    def alertas(self):
        return [json.loads(f[0]) for f in self.cx.execute('SELECT alerta FROM alerta ORDER BY id')]

    @con_candado
    def alerta(self, c_alerta):
        fila = self.cx.execute('SELECT alerta FROM alerta WHERE c_alerta = ?', (c_alerta,)).fetchone()
        return json.loads(fila[0]) if fila else None

    @con_candado
    def actualizar_alerta(self, alerta):
        with self.cx:
            self.cx.execute('UPDATE alerta SET alerta = ? WHERE c_alerta = ?',
                            (json.dumps(alerta, ensure_ascii=False), alerta['c_alerta']))

    @con_candado
    def folios_por_estacion(self):
        """El mayor consecutivo de folio emitido por estacion (AL-fecha-EST-NN)."""
        mayor = {}
        for c_alerta, ce in self.cx.execute('SELECT c_alerta, c_estacion FROM alerta'):
            try:
                n = int(c_alerta.rsplit('-', 1)[1])
            except (IndexError, ValueError):
                continue
            mayor[ce] = max(mayor.get(ce, 0), n)
        return mayor

    # ------------------------------------------------------------- reportes
    @con_candado
    def guardar_reporte(self, reporte):
        with self.cx:
            self.cx.execute('INSERT INTO reporte (c_reporte, reporte) VALUES (?, ?)',
                            (reporte['c_reporte'], json.dumps(reporte, ensure_ascii=False)))

    @con_candado
    def reportes(self):
        return [json.loads(f[0]) for f in self.cx.execute('SELECT reporte FROM reporte ORDER BY id')]

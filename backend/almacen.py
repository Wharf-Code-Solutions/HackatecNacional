# -*- coding: utf-8 -*-
"""Persistencia del backend: SQLite en tu computadora, Postgres en Vercel.

    Almacen('backend/datos/atoyac.sqlite')          SQLite (biblioteca estandar)
    Almacen('postgresql://usuario@host/base')         Postgres (psycopg)

Se guarda cada objeto del contrato como JSON tal cual, con unas pocas columnas
para filtrar y ordenar. Asi el esquema de la base no duplica el del contrato.

Concurrencia. En Vercel cada peticion puede caer en una instancia distinta, asi
que el motor no guarda memoria entre peticiones: se reconstruye con las ultimas
lecturas de la estacion (backend/app.py). Para que dos instancias no evaluen la
misma estacion a la vez, `transaccion(c_estacion)` toma un candado por estacion
dentro de la base: pg_advisory_xact_lock en Postgres, BEGIN IMMEDIATE en SQLite.
Dentro de un mismo proceso, ademas, la conexion se comparte entre hilos bajo un
candado: sin el, las 8 peticiones simultaneas del panel daban "bad parameter or
other API misuse" en SQLite.
"""
import functools
import hashlib
import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager

TABLAS = ('lectura', 'veredicto', 'alerta', 'reporte')

ESQUEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS lectura (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    c_estacion TEXT NOT NULL,
    fecha_hora TEXT NOT NULL,
    huella TEXT NOT NULL UNIQUE,
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

ESQUEMA_POSTGRES = [
    """CREATE TABLE IF NOT EXISTS lectura (
        id BIGSERIAL PRIMARY KEY,
        c_estacion TEXT NOT NULL,
        fecha_hora TEXT NOT NULL,
        huella TEXT NOT NULL UNIQUE,
        paquete TEXT NOT NULL,
        recibido TIMESTAMPTZ NOT NULL DEFAULT now())""",
    'CREATE INDEX IF NOT EXISTS lectura_estacion ON lectura (c_estacion, id)',
    """CREATE TABLE IF NOT EXISTS veredicto (
        id BIGSERIAL PRIMARY KEY,
        id_lectura BIGINT NOT NULL REFERENCES lectura (id),
        c_estacion TEXT NOT NULL,
        veredicto TEXT NOT NULL)""",
    'CREATE INDEX IF NOT EXISTS veredicto_estacion ON veredicto (c_estacion, id)',
    """CREATE TABLE IF NOT EXISTS alerta (
        id BIGSERIAL PRIMARY KEY,
        c_alerta TEXT NOT NULL UNIQUE,
        c_estacion TEXT NOT NULL,
        alerta TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS reporte (
        id BIGSERIAL PRIMARY KEY,
        c_reporte TEXT NOT NULL UNIQUE,
        reporte TEXT NOT NULL)""",
    # Supabase publica toda tabla del esquema public por su API REST, y la llave
    # "anon" que la abre no es secreta. Con RLS activo y sin politicas, esa API no
    # ve ni escribe nada; el backend entra como el dueno de las tablas y RLS no lo
    # detiene. En un Postgres sin Supabase no cambia nada.
    'ALTER TABLE lectura ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE veredicto ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE alerta ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE reporte ENABLE ROW LEVEL SECURITY',
]

# Parametros que agregan las integraciones (Vercel + Supabase pone supa=base-pooler.x;
# Prisma usa pgbouncer=true) y que libpq rechaza con "invalid URI query parameter".
PARAMETROS_AJENOS = {'supa', 'pgbouncer', 'connection_limit', 'pool_timeout', 'schema'}


def limpiar_url(url):
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
    partes = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(partes.query) if k not in PARAMETROS_AJENOS]
    return urlunsplit(partes._replace(query=urlencode(query)))


def huella(paquete):
    return hashlib.sha256(json.dumps(paquete, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()


def es_postgres(url):
    return url.startswith(('postgres://', 'postgresql://'))


def con_candado(metodo):
    @functools.wraps(metodo)
    def envuelto(self, *args, **kwargs):
        with self.candado:
            return metodo(self, *args, **kwargs)
    return envuelto


class Almacen:
    def __init__(self, url):
        self.url = url
        self.pg = es_postgres(url)
        self.candado = threading.RLock()
        self.cx = None
        self._conectar()

    # ----------------------------------------------------------- conexion
    def _conectar(self):
        if self.pg:
            import psycopg   # solo hace falta en Postgres
            # autocommit: cada consulta suelta se confirma sola; las escrituras
            # van en transacciones explicitas (transaccion()).
            # prepare_threshold=None: sin sentencias preparadas. El pooler en modo
            # transaccion de Supabase (puerto 6543, el recomendado para serverless)
            # reparte las transacciones entre conexiones y una sentencia preparada en
            # una no existe en otra ("prepared statement ... does not exist").
            # Los candados son pg_advisory_xact_lock, de transaccion, y si funcionan ahi.
            self.cx = psycopg.connect(limpiar_url(self.url), autocommit=True, prepare_threshold=None)
            # El esquema solo se toca si falta algo. Cada instancia nueva de Vercel abre
            # su conexion, y ALTER TABLE toma un candado exclusivo de la tabla: aplicarlo
            # siempre bloqueaba (y hasta trababa: "deadlock detected") a las instancias
            # que estaban escribiendo. Consultar el catalogo no bloquea a nadie.
            if not self._esquema_listo():
                # Dos instancias que arrancan a la vez sobre una base vacia chocan al
                # crear las tablas ("duplicate key ... pg_type_typname_nsp_index"):
                # CREATE TABLE IF NOT EXISTS no es atomico en Postgres. Se crean en fila.
                with self.cx.transaction():
                    self.cx.execute("SELECT pg_advisory_xact_lock(hashtext('atoyac:esquema'))")
                    if not self._esquema_listo():
                        for sql in ESQUEMA_POSTGRES:
                            self.cx.execute(sql)
        else:
            if self.url != ':memory:':
                os.makedirs(os.path.dirname(os.path.abspath(self.url)), exist_ok=True)
            # timeout primero: si otra conexion esta escribiendo, el PRAGMA de abajo
            # espera en lugar de fallar con "database is locked".
            self.cx = sqlite3.connect(self.url, check_same_thread=False, isolation_level=None, timeout=10)
            self.cx.execute('PRAGMA busy_timeout=10000')
            # Pasar a WAL pide acceso exclusivo y SQLite no espera por el: si otra
            # conexion esta escribiendo, falla al instante aunque haya busy_timeout.
            # WAL queda guardado en el archivo, asi que solo se pide si falta, y si
            # otra conexion esta ocupada se reintenta un momento.
            for intento in range(100):
                try:
                    if self.cx.execute('PRAGMA journal_mode').fetchone()[0].lower() != 'wal':
                        self.cx.execute('PRAGMA journal_mode=WAL')
                    break
                except sqlite3.OperationalError:
                    if intento == 99:
                        raise
                    time.sleep(0.05)
            self.cx.execute('PRAGMA foreign_keys=ON')
            self.cx.executescript(ESQUEMA_SQLITE)

    def _esquema_listo(self):
        """Las cuatro tablas existen y tienen RLS. Solo lee el catalogo."""
        n = self.cx.execute(
            "SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace "
            "WHERE s.nspname = current_schema() AND c.relkind = 'r' AND c.relrowsecurity "
            "AND c.relname = ANY(%s)", (list(TABLAS),)).fetchone()[0]
        return n == len(TABLAS)

    def _vigente(self):
        # Supabase y otros Postgres administrados cierran conexiones ociosas; una
        # funcion de Vercel puede despertar con la suya cerrada.
        if self.pg and self.cx.closed:
            self._conectar()

    def _q(self, sql, args=()):
        if self.pg:
            sql = sql.replace('?', '%s')
        return self.cx.execute(sql, args)

    def cerrar(self):
        with self.candado:
            self.cx.close()

    # -------------------------------------------------------- transacciones
    @contextmanager
    def transaccion(self, llave=None):
        """Transaccion de escritura. Con `llave`, nadie mas escribe esa llave a la vez,
        ni en este proceso ni en otra instancia que use la misma base."""
        with self.candado:
            self._vigente()
            if self.pg:
                with self.cx.transaction():
                    if llave:
                        self.cx.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', (llave,))
                    yield self
            else:
                # IMMEDIATE toma el candado de escritura de toda la base desde el inicio.
                self.cx.execute('BEGIN IMMEDIATE')
                try:
                    yield self
                except BaseException:
                    self.cx.execute('ROLLBACK')
                    raise
                self.cx.execute('COMMIT')

    # --------------------------------------- dentro de transaccion(c_estacion)
    def veredicto_de_huella(self, h):
        """Si el paquete ya se recibio, devuelve su veredicto guardado."""
        fila = self._q('SELECT v.veredicto FROM lectura l JOIN veredicto v ON v.id_lectura = l.id '
                       'WHERE l.huella = ?', (h,)).fetchone()
        return json.loads(fila[0]) if fila else None

    def lecturas_recientes(self, c_estacion, n):
        filas = self._q('SELECT paquete FROM lectura WHERE c_estacion = ? ORDER BY id DESC LIMIT ?',
                        (c_estacion, n)).fetchall()
        return [json.loads(f[0]) for f in reversed(filas)]

    def folio_maximo(self, c_estacion):
        """El mayor consecutivo de folio emitido para la estacion (AL-fecha-EST-NN)."""
        mayor = 0
        for (c_alerta,) in self._q('SELECT c_alerta FROM alerta WHERE c_estacion = ?', (c_estacion,)).fetchall():
            try:
                mayor = max(mayor, int(c_alerta.rsplit('-', 1)[1]))
            except (IndexError, ValueError):
                continue
        return mayor

    def guardar_evaluacion(self, paquete, h, veredicto):
        """Lectura, veredicto y alertas nuevas. Llamar dentro de transaccion()."""
        id_lectura = self._q(
            'INSERT INTO lectura (c_estacion, fecha_hora, huella, paquete) VALUES (?, ?, ?, ?) RETURNING id',
            (paquete['c_estacion'], paquete['fecha_hora'], h, json.dumps(paquete, ensure_ascii=False))).fetchone()[0]
        self._q('INSERT INTO veredicto (id_lectura, c_estacion, veredicto) VALUES (?, ?, ?)',
                (id_lectura, paquete['c_estacion'], json.dumps(veredicto, ensure_ascii=False)))
        for a in veredicto.get('alertas', []):
            self._q('INSERT INTO alerta (c_alerta, c_estacion, alerta) VALUES (?, ?, ?)',
                    (a['c_alerta'], a['c_estacion'], json.dumps(a, ensure_ascii=False)))

    def guardar_reporte(self, reporte):
        """Llamar dentro de transaccion('reportes')."""
        self._q('INSERT INTO reporte (c_reporte, reporte) VALUES (?, ?)',
                (reporte['c_reporte'], json.dumps(reporte, ensure_ascii=False)))

    def actualizar_alerta(self, alerta):
        """Llamar dentro de transaccion()."""
        self._q('UPDATE alerta SET alerta = ? WHERE c_alerta = ?',
                (json.dumps(alerta, ensure_ascii=False), alerta['c_alerta']))

    # ------------------------------------------------------------- lecturas
    @con_candado
    def contar(self, tabla):
        assert tabla in TABLAS
        self._vigente()
        return self._q('SELECT COUNT(*) FROM ' + tabla).fetchone()[0]

    @con_candado
    def veredictos(self, c_estacion=None, n=50):
        self._vigente()
        if c_estacion:
            filas = self._q('SELECT veredicto FROM veredicto WHERE c_estacion = ? ORDER BY id DESC LIMIT ?',
                            (c_estacion, n)).fetchall()
        else:
            filas = self._q('SELECT veredicto FROM veredicto ORDER BY id DESC LIMIT ?', (n,)).fetchall()
        return [json.loads(f[0]) for f in reversed(filas)]

    @con_candado
    def alertas(self):
        self._vigente()
        return [json.loads(f[0]) for f in self._q('SELECT alerta FROM alerta ORDER BY id').fetchall()]

    @con_candado
    def alerta(self, c_alerta):
        self._vigente()
        fila = self._q('SELECT alerta FROM alerta WHERE c_alerta = ?', (c_alerta,)).fetchone()
        return json.loads(fila[0]) if fila else None

    @con_candado
    def reportes(self):
        self._vigente()
        return [json.loads(f[0]) for f in self._q('SELECT reporte FROM reporte ORDER BY id').fetchall()]

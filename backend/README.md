# Backend (M5)

El servidor real del monitoreo: recibe las lecturas de las estaciones, las evalúa con el motor
de reglas (M2), guarda todo en una base SQLite y sirve alertas, veredictos, reportes y la
predicción de propagación (M3). Hecho con FastAPI (decisión D24).

Tiene **las mismas rutas y las mismas respuestas que el mock** (`contrato/servidor_mock.py
--motor real`), así que el panel, el mapa, el simulador y `reproducir_escenario.py` funcionan
con él sin cambiar nada.

## Correrlo en tu computadora

La primera vez, desde la raíz del repositorio. Usa el Python de python.org, no el de MSYS2:
el de MSYS2 no tiene paquetes precompilados de `pydantic-core` y pide Rust para compilarlo.

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe" -m venv backend\.venv
```

```powershell
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

Arrancarlo (en el puerto 8080, el mismo del mock; no corras los dos a la vez):

```powershell
backend\.venv\Scripts\python backend\servidor.py
```

Para empezar una demostración desde cero, con la base vacía:

```powershell
backend\.venv\Scripts\python backend\servidor.py --limpiar
```

Mandarle un día de lecturas con un incidente:

```powershell
python contrato\reproducir_escenario.py descarga_industrial --url http://127.0.0.1:8080
```

Documentación interactiva de la API: `http://127.0.0.1:8080/docs`.

## Pruebas

```powershell
backend\.venv\Scripts\python -I backend\prueba.py
```

Sale con código 1 si algo falla. Comprueba:

1. Los cinco escenarios pasan sin errores de contrato y dan las alertas del motor (0, 2, 5, 5, 0).
2. Rechaza con el mismo código y el mismo detalle que el mock, comparando en vivo contra el mock
   arrancado en el mismo proceso (lectura incompleta, estación inexistente, parámetro fuera del
   contrato, lote mixto, JSON roto, foto con EXIF, reporte fuera de la cuenca, ruta inexistente).
3. Los datos persisten tras reiniciar, y reiniciar a mitad de un escenario da exactamente las
   mismas alertas y folios que no reiniciar.
4. Reenvío idempotente, `PATCH`, reportes sin correo y la predicción de M3, que debe ser idéntica
   a `contrato/fixtures/prediccion_ejemplo.json` (la genera M3).
5. 1500 peticiones con 32 a la vez sobre una base con un día de lecturas, sin errores del
   servidor. Sin el candado de `almacen.py` esta prueba falla.

## Rutas

Las del contrato (`contrato/README.md`) más una:

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/alertas/<c_alerta>/prediccion` | Propagación aguas abajo de esa alerta (M3): sitios, ventana de llegada y banda de valor. Cumple `prediccion_propagacion.schema.json` |

## Qué agrega al mock

- **Persistencia.** Lecturas, veredictos, alertas y reportes en SQLite (`backend/datos/atoyac.sqlite`,
  no versionado). Cada objeto se guarda como el JSON del contrato, así la base no duplica los esquemas.
- **Reinicio sin perder el hilo.** Al arrancar, el motor reproduce las últimas 200 lecturas de cada
  estación para recuperar sus ventanas, y sus folios siguen desde el mayor guardado: no se repiten.
- **Reenvío idempotente.** El firmware reenvía lo que no recibió ACK. Un paquete idéntico a uno ya
  recibido se acepta y devuelve su veredicto guardado, sin evaluarse dos veces.
- **Predicción de M3.** `scripts/80_propagacion.py` necesita `muestreo_nucleo.csv`, que no se
  versiona. El backend usa lo que M3 publica (`datos/procesados/red/tiempo_viaje.csv` y
  `atenuacion_observada.csv`) con la misma fórmula; la prueba 4 garantiza que dan lo mismo.

## Desplegarlo

Vercel no sirve para el backend: sus funciones no guardan archivos entre peticiones y SQLite se
perdería. Sirve cualquier servicio que corra un proceso de Python con un disco persistente
(Render, Railway, Fly.io o un servidor propio):

- Directorio raíz del servicio: `backend` (el servicio debe tener el repositorio completo, porque
  lee `../motor/`, `../contrato/` y `../datos/`).
- Instalación: `pip install -r requirements.txt`
- Arranque: `uvicorn asgi:app --host 0.0.0.0 --port $PORT`
- Variables: `BACKEND_DB` con una ruta dentro del disco persistente, y `CORS_ORIGINS` con la URL del
  panel en Vercel (por omisión acepta cualquier origen).

Después, en Vercel, poner `VITE_API_URL` del panel con la URL del backend.

## Fronteras

- No inventa reglas: decide `motor/reglas.py` (M2), propaga la fórmula de M3.
- Valida con el mismo `contrato/validador.py` que el mock.
- Lo que la autoridad puede cambiar de una alerta es solo `estado` y `responsable`.

## Lo que falta

- **Autenticación.** Cualquiera que llegue a la URL puede escribir. Antes de un uso real hace falta
  una llave por estación para `POST /lecturas` y sesión para `PATCH /alertas`.
- **`nivel_esperado` en la predicción** va en "Sin dato", como en M3: clasificarlo es de M2.
- **Base de datos para varios servidores.** SQLite basta para un proceso; con varios, Postgres.

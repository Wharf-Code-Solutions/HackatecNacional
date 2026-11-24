# Backend (M5)

El servidor real del monitoreo: recibe las lecturas de las estaciones, las evalúa con el motor
de reglas (M2), guarda todo y sirve alertas, veredictos, reportes y la predicción de propagación
(M3). Hecho con FastAPI (D24). Corre en tu computadora con SQLite y en Vercel, en el mismo proyecto
que el panel, con Postgres (D25).

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

Con Postgres en lugar de SQLite (crea una base nueva por caso en ese servidor):

```powershell
$env:PRUEBA_POSTGRES = 'postgresql://postgres@127.0.0.1:55432/postgres'
```

Sale con código 1 si algo falla. Comprueba:

1. Los cinco escenarios pasan sin errores de contrato y dan las alertas del motor (0, 2, 5, 5, 0).
2. Rechaza con el mismo código y el mismo detalle que el mock, comparando en vivo contra el mock
   arrancado en el mismo proceso (lectura incompleta, estación inexistente, parámetro fuera del
   contrato, lote mixto, JSON roto, foto con EXIF, reporte fuera de la cuenca, ruta inexistente).
3. Los datos persisten tras reiniciar. Dos instancias sobre la misma base que se turnan los lotes
   de un escenario, como las funciones de Vercel, dan las mismas alertas y folios que una sola. El
   candado por estación detiene a una segunda conexión hasta que la primera termina (sin el
   candado, esa prueba falla).
4. Reenvío idempotente, `PATCH`, reportes sin correo y la predicción de M3, que debe ser idéntica
   a `contrato/fixtures/prediccion_ejemplo.json` (la genera M3).
5. 1500 peticiones con 32 a la vez sobre una base con un día de lecturas, sin errores del
   servidor. Sin el candado de la conexión en `almacen.py` esta prueba falla.
6. La función de Vercel (`api/index.py`) sirve el backend en `/api`.

## Rutas

Las del contrato (`contrato/README.md`) más una:

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/alertas/<c_alerta>/prediccion` | Propagación aguas abajo de esa alerta (M3): sitios, ventana de llegada y banda de valor. Cumple `prediccion_propagacion.schema.json` |

## Qué agrega al mock

- **Persistencia.** Lecturas, veredictos, alertas y reportes en SQLite (`backend/datos/atoyac.sqlite`,
  no versionado) o en Postgres si existe `DATABASE_URL`. Cada objeto se guarda como el JSON del
  contrato, así la base no duplica los esquemas.
- **Sin memoria entre peticiones.** En cada lote, el motor de cada estación se reconstruye con sus
  últimas 200 lecturas guardadas y sus folios siguen desde el mayor guardado. El motor es
  determinista, así que da lo mismo que si nunca se hubiera apagado; por eso puede correr en
  funciones de Vercel, donde cada petición puede caer en una instancia distinta. Un candado por
  estación en la base (`pg_advisory_xact_lock` en Postgres) evita que dos instancias la evalúen a
  la vez.
- **Reenvío idempotente.** El firmware reenvía lo que no recibió ACK. Un paquete idéntico a uno ya
  recibido se acepta y devuelve su veredicto guardado, sin evaluarse dos veces.
- **Predicción de M3.** `scripts/80_propagacion.py` necesita `muestreo_nucleo.csv`, que no se
  versiona. El backend usa lo que M3 publica (`datos/procesados/red/tiempo_viaje.csv` y
  `atenuacion_observada.csv`) con la misma fórmula; la prueba 4 garantiza que dan lo mismo.

## Desplegarlo en Vercel (mismo proyecto que el panel)

El backend corre como función de Python en `/api` del mismo proyecto que el panel: un solo
despliegue, mismo dominio y sin CORS. Lo configuran tres archivos en la raíz del repositorio:

- `vercel.json`: compila el panel (`panel/dist`), declara la función `api/index.py` con los archivos
  que lee (`backend/`, `motor/`, `contrato/`, `datos/procesados/`) y manda `/api/*` a ella.
- `api/index.py`: monta el backend bajo `/api`.
- `requirements.txt`: lo que instala Vercel para la función (FastAPI y psycopg).

Pasos en Vercel:

1. Importar el repositorio con **Root Directory vacío** (la raíz). Framework: **Other**; lo demás
   lo toma de `vercel.json`.
2. La base es **Supabase** (D26). En Supabase: **Connect → Direct · Connection string**, Method
   **Transaction pooler** (puerto 6543, host `...pooler.supabase.com`), y cambiar `[YOUR-PASSWORD]`
   por la contraseña de la base. En Vercel, agregar esa cadena como `DATABASE_URL` (Sensitive,
   Production y Preview). No usar "Direct connection" (`db.<ref>.supabase.co:5432`): solo IPv6. No
   hacen falta `@supabase/supabase-js` ni las llaves `anon` o `service_role`: el backend habla
   Postgres. Sin `DATABASE_URL` el backend usa `/tmp`, que Vercel borra, y `/api/salud` dice
   `"persistencia": "temporal"`. Las tablas se crean solas en la primera petición, con RLS activo.
3. En **Settings → Environment Variables**, agregar `VITE_API_URL` = `/api` (Production y Preview).
   Sin ella el panel abre en modo demostración.
4. **Redeploy** (Vite mete `VITE_API_URL` al compilar).
5. Comprobar `https://<tu-proyecto>.vercel.app/api/salud`: debe decir `"persistencia": "postgres"`.
6. Cargar un día de lecturas:
   `python contrato\reproducir_escenario.py descarga_industrial --url https://<tu-proyecto>.vercel.app/api`

Documentación interactiva de la API en producción: `/api/docs`.

### En otro servicio

También corre como proceso normal (Render, Railway, un servidor propio): directorio raíz `backend`
con el repositorio completo, `pip install -r requirements.txt` y
`uvicorn asgi:app --host 0.0.0.0 --port $PORT`, con `DATABASE_URL` (o `BACKEND_DB` en un disco
persistente) y `CORS_ORIGINS` con la URL del panel.

## Fronteras

- No inventa reglas: decide `motor/reglas.py` (M2), propaga la fórmula de M3.
- Valida con el mismo `contrato/validador.py` que el mock.
- Lo que la autoridad puede cambiar de una alerta es solo `estado` y `responsable`.

## Lo que falta

- **Autenticación.** Cualquiera que llegue a la URL puede escribir. Antes de un uso real hace falta
  una llave por estación para `POST /lecturas` y sesión para `PATCH /alertas`.
- **`nivel_esperado` en la predicción** va en "Sin dato", como en M3: clasificarlo es de M2.
- **Plan gratuito de Supabase.** Pausa el proyecto tras una semana sin actividad; se reactiva desde su
  tablero.

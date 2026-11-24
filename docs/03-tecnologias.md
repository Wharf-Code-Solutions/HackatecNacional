# Tecnologías

Dos listas separadas, y la separación importa: **lo que ya se usa** y **lo que está
elegido pero no implementado**. Documentar lo segundo como si fuera lo primero es el
error más común y el más fácil de detectar.

---

## Lo que ya se usa

### Python 3.11+ (probado en 3.13.1)

Todo el procesamiento de datos, el contrato y el servidor mock.

**Por qué:** es lo que el equipo ya tiene instalado y lo que lee formatos de gobierno sin
pelear. La decisión fuerte no es Python, es la siguiente.

### Biblioteca estándar primero, dependencias solo donde no hay salida

El contrato completo —validador, servidor mock, reproductor de escenarios— **no tiene una
sola dependencia externa**. Corre con `python` a secas.

**Por qué:** en una hackathon, "no me funciona el `pip install`" es media hora perdida de
una persona y un bloqueo para quien esperaba su módulo. Si la pieza que todos comparten
no necesita instalar nada, nadie se queda fuera. El costo fue escribir un validador de
JSON Schema a mano (unas 120 líneas que cubren el subconjunto que el contrato usa) en
lugar de usar `jsonschema`. Valió la pena.

Las tres dependencias existen solo en los scripts de datos, que corre una persona una vez:

| Paquete | Para qué | Por qué no hay alternativa |
|---|---|---|
| `openpyxl` | leer los `.xlsx` de CONAGUA | es el estándar de facto en Python |
| `pyxlsb` | leer `RESULTADOS-PUEBLA.xlsb` | CONAGUA publica algunos estados en **Excel binario**. `pyxlsb` es prácticamente el único lector de ese formato en Python |
| `pypdf` | extraer los hipervínculos del PDF de transparencia | los enlaces de descarga de la fuente F01 **no están en el texto del PDF**, son anotaciones `/URI`. Sin leer las anotaciones, esos archivos son inencontrables |

### JavaScript plano y Node para el simulador del dispositivo

`dispositivo/simulador/`: modelo, firmware y montaje sin dependencias ni paso de compilación;
una interfaz web que los anima y `prueba.js`, que los prueba en Node (probado en Node 24).

**Por qué:** el firmware es una máquina de estados pura, así que el mismo archivo se prueba
sin navegador y se anima con él. Y no instala nada, por la misma razón que el contrato.
La decisión está en D18.

### CSV para las tablas procesadas

`datos/procesados/*.csv`, codificados en **UTF-8 con BOM** (`utf-8-sig`).

**Por qué CSV y no una base de datos o Parquet:**

- Se ve en el diff de git. Un cambio en los datos es revisable.
- Se abre en Excel. La mitad del equipo y toda la gente de una dependencia pública
  trabaja en Excel, y un entregable que solo se lee con código no se usa.
- No necesita servidor. Cualquiera clona y trabaja.
- El tamaño lo permite: la tabla grande son 145 703 filas y 10.7 MB. A este volumen
  Parquet no aporta nada.

**Por qué el BOM:** sin él, Excel en Windows abre el CSV en la página de códigos del
sistema y destroza los acentos. "RÍO ATOYAC" se vuelve "RÃO ATOYAC". Con BOM, Excel lo
detecta como UTF-8 y abre bien. Es fealdad a cambio de que el archivo sea usable.

### JSON Schema para el contrato de datos

Siete esquemas en `contrato/esquemas/`.

**Por qué:** el contrato lo tienen que respetar un firmware de microcontrolador (C++), un
backend (Python o Node) y tres frontends (JavaScript). JSON Schema es declarativo y
agnóstico del lenguaje: es una definición, no código de nadie. Y es verificable, que es lo
que convierte el acuerdo en algo que se puede probar.

### JSON y GeoJSON para los fixtures

**Por qué GeoJSON para los sitios:** cualquier librería de mapas (Leaflet, MapLibre,
Mapbox) lo consume sin conversión. `contrato/fixtures/sitios.geojson` se arrastra a un
mapa y aparecen los 219 puntos.

### `http.server` de la biblioteca estándar para el mock

**Por qué y no Flask o FastAPI:** porque sería una dependencia, y el mock existe
precisamente para que nadie dependa de nada. Es un servidor de desarrollo para cinco
personas; `ThreadingHTTPServer` sobra. Tiene CORS abierto para que un frontend en otro
puerto lo consuma sin configurar nada.

### Shapefile para la red hidrográfica

Es el formato en que el INEGI publica la Red Hidrográfica 1:50 000 edición 2.0. No se
elige: se recibe. Las capas que importan son `_hl` (líneas de flujo, que traen la
dirección del escurrimiento), `_subc` (divisorias de subcuenca) y `_ha` (cuerpos de agua).

### Leaflet y relieve sombreado de Esri para el mapa

`mapa/`. Leaflet 1.9.4 se carga desde unpkg (con hash de integridad). El fondo son dos capas de
teselas de Esri en `server.arcgisonline.com`: relieve sombreado (`World_Hillshade`) aclarado y,
encima, solo los nombres de lugares (`World_Light_Gray_Reference`). **No piden llave ni cuenta.**
El relieve no trae calles ni ríos propios, así que la red del INEGI es lo único que se lee como
agua.

**Por qué:** es lo que lee GeoJSON sin conversión y permite el zoom animado a una estación.
**Costo conocido:** el mapa base necesita internet. Sin red, los ríos, subcuencas y sitios se
siguen viendo (son nuestros) y solo desaparece el fondo. El uso sin cuenta de las teselas de Esri
es para desarrollo y demostración: para la defensa sobra; para uso público habría que contratar un
proveedor.

### Git y GitHub

Con una regla que se verifica: `datos/crudos/` y `datos/geo/` **no se versionan**. Son
138 MB y 61 MB de archivos de gobierno que se vuelven a bajar con un script, y meterlos al
repositorio lo volvería lento para todos. Lo que sí se versiona es la URL exacta de cada
uno, en `datos/bitacora.md`.

---

## Elegido pero no implementado

Esto es intención, no realidad. Está aquí para que el equipo converja, no para
documentarlo como construido.

| Tecnología | Para qué | Estado y por qué se eligió |
|---|---|---|
| **PostgreSQL + PostGIS** | base de datos del backend (M5) | **No instalado.** Se eligió porque las consultas del sistema son geoespaciales por naturaleza —qué está aguas arriba, qué sitio es el más cercano sobre el cauce, qué reportes caen en un tramo— y PostGIS las resuelve en SQL. El equipo ya tiene experiencia de SIGRIV. |
| **ESP32** | microcontrolador de la estación (M4) | **No comprado.** Trae WiFi y Bluetooth integrados, consume poco, tiene convertidor analógico-digital suficiente para sondas industriales y cuesta una fracción de un datalogger comercial. |
| **LoRa / LoRaWAN** | comunicación en sitios sin cobertura celular | **No evaluado en campo.** Varios sitios del Atoyac están en barrancas donde la señal celular es mala. La decisión real depende de medir cobertura punto por punto, y eso no se puede hacer desde una computadora. |
| **Panel solar + batería** | energía de la estación | **No dimensionado.** Un sitio en barranca no tiene toma de corriente. La autonomía hay que calcularla, no suponerla. |

### Sin decidir

- **Framework de los frontends** (M6, M7, M8). Deliberadamente abierto: cada módulo
  consume el contrato por HTTP, así que puede ser React, Svelte, Vue o HTML con
  JavaScript a secas. Quien lo desarrolle elige lo que domine; es la clase de libertad que
  el contrato permite y que acelera a un equipo que no comparte el mismo stack.
- **Hospedaje.** Depende de M5.

---

## Lo que se descartó, y por qué

| Descartado | Razón |
|---|---|
| **`jsonschema` de PyPI** | Habría metido una dependencia a la pieza que todos comparten. Se escribió un validador del subconjunto necesario. Los esquemas siguen siendo válidos para `jsonschema` si alguien lo quiere usar. |
| **Flask / FastAPI para el mock** | Misma razón. Para el backend real (M5) sí son candidatos razonables. |
| **pandas para el procesamiento** | Está instalado y se usó para explorar, pero los scripts de construcción usan `csv` y lectura por filas. El motivo es la memoria: `RESULTADOS-PUEBLA.xlsb` declara 126 070 filas de las cuales 123 165 están vacías, y recorrerlo por filas evita materializar una tabla de 325 columnas que es casi toda nula. |
| **SQLite o Parquet para las tablas procesadas** | Habrían ganado velocidad que nadie necesita y perdido la revisabilidad en git y la apertura en Excel. |
| **Modelos de pronóstico temporal (LSTM, Prophet)** | Los datos no lo soportan: 49 días de mediana entre muestreos consecutivos del mismo sitio, con un hueco de densidad entre 2019 y 2024. No es una serie de tiempo. El razonamiento completo está en [10-revision-critica-plan.md](10-revision-critica-plan.md). |
| **Streeter-Phelps como modelo de propagación** | Requiere constantes calibradas contra un tramo donde el oxígeno caiga y se recupere, y aquí el río está en hipoxia permanente. Se sustituyó por transporte advectivo con decaimiento. |
| **Teselas de CARTO (Dark Matter)** | Se probaron primero y ahora devuelven "API KEY REQUIRED". Se sustituyeron por OpenStreetMap, que no pide llave. |
| **Teselas de OpenStreetMap** | Sus calles, manchas urbanas y ríos propios competían con la red del INEGI aun en gris. Se sustituyeron por el relieve sombreado de Esri. |
| **Wokwi para simular el dispositivo** | No trae modelos de sondas de OD, pH ni conductividad, vive fuera de nuestra interfaz y no permite inyectar incidentes ni deriva. Se sustituyó por un simulador propio (D18). |
| **Base de datos desde el inicio** | Habría hecho que nadie pudiera correr el proyecto sin instalar y poblar un servidor. Con CSV y JSON, se clona y funciona. |

---

## Cómo levantar el entorno

Para usar el contrato (lo que necesita quien desarrolla cualquier módulo), nada:

```powershell
python contrato/servidor_mock.py
```

Para reconstruir los datos desde las fuentes originales:

```powershell
pip install openpyxl pyxlsb pypdf
```

Los comandos de reconstrucción están en el [README del repositorio](../README.md) y los
que son obligatorios antes de declarar un cambio terminado están en
[contexto/04-verificacion-obligatoria.md](contexto/04-verificacion-obligatoria.md).

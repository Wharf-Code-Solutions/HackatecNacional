# Mapa del repositorio

Qué es cada archivo, quién lo genera y si se puede editar a mano. **La columna más
importante es la última.**

Leyenda de "editable":

- **sí** — se edita a mano, es fuente de verdad
- **NO** — lo genera un script; editarlo pierde el cambio en la siguiente corrida
- **nunca** — inmutable por invariante
- **histórico** — se conserva como registro, no se actualiza

---

## Raíz

| Ruta | Qué es | Lo genera | Editable |
|---|---|---|---|
| `README.md` | Punto de entrada del repositorio | — | sí |
| `.gitignore` | Excluye crudos, geo y las dos tablas grandes | — | sí |

---

## `contrato/` — la frontera entre módulos

| Ruta | Qué es | Fuente de verdad de | Editable |
|---|---|---|---|
| `contrato/README.md` | Cómo usar el contrato, rutas del mock, tabla del stub | — | sí |
| `contrato/esquemas/lectura.schema.json` | Lo que una estación envía | **el vocabulario de parámetros del contrato** (`enum`) | sí, con protocolo |
| `contrato/esquemas/veredicto.schema.json` | Salida del motor de reglas | la frontera M2 ↔ resto | sí, con protocolo |
| `contrato/esquemas/alerta.schema.json` | Alerta ambiental | niveles, reglas, criterios, tipos de fuente probable | sí, con protocolo |
| `contrato/esquemas/estacion.schema.json` | Estación de monitoreo | — | sí, con protocolo |
| `contrato/esquemas/linea_base.schema.json` | Banda histórica | — | sí, con protocolo |
| `contrato/esquemas/escuela.schema.json` | Escuela de interés con su riesgo y desglose (docs/19 §4.1) | forma de `escuelas.json` | sí, con protocolo |
| `contrato/esquemas/zona_riesgo.schema.json` | Zona propensa (properties de cada polígono, docs/19 §4.2) | forma de `zonas_riesgo.geojson` | sí, con protocolo |
| `contrato/esquemas/prediccion_propagacion.schema.json` | Predicción aguas abajo | modelos permitidos | sí, con protocolo |
| `contrato/esquemas/reporte_ciudadano.schema.json` | Reporte ciudadano | catálogo de tipos de reporte | sí, con protocolo |
| `contrato/validador.py` | Validador de JSON Schema sin dependencias | — | sí |
| `contrato/servidor_mock.py` | Servidor HTTP con evaluador stub | las rutas de la API | sí |
| `contrato/analisis_foto.py` | Pregunta a Gemini si la foto de un reporte corresponde a algún tipo (cadena de modelos, llave en `GEMINI_API_KEY`); lo cargan el mock y el backend | `POST /reportes/analizar-foto` | sí |
| `contrato/prioridad_huella.py` | Huella de calor sobre el río y prioridad de los reportes; los pesos son hipótesis ajustables arriba del archivo | `GET /huella`, `GET /prioridades` | sí |
| `contrato/reproducir_escenario.py` | Envía un escenario a un servidor | — | sí |
| `contrato/fixtures/estaciones.json` | Las 5 estaciones de la red propuesta (docs/18) | `40_generar_fixtures.py`, que las toma de `red/red_estaciones.csv` | **NO** |
| `contrato/fixtures/linea_base.json` | Banda de esas 5 estaciones | — | **NO** |
| `contrato/fixtures/sitios.geojson` | Los 219 sitios para el mapa | — | **NO** |
| `contrato/fixtures/escenarios/*.json` | 5 escenarios de un día | — | **NO** |

Los fixtures los genera `scripts/40_generar_fixtures.py`.

---

## `mapa/` — prototipo de M6

| Ruta | Qué es | Editable |
|---|---|---|
| `mapa/index.html`, `mapa.js`, `estilos.css` | Mapa de la cuenca con ríos, subcuencas, 219 sitios y 5 estaciones. Al hacer clic en una estación se acerca y muestra el simulador en un marco | sí |

El mapa **no importa código** del simulador: lo muestra por URL
(`dispositivo/simulador/index.html?incrustado=1&estacion=...`) y se entera del estado de las
estaciones leyendo `GET /alertas` del backend. Se sirve desde la raíz del repo.

---

## `panel/` — prototipo de M7

| Ruta | Qué es | Editable |
|---|---|---|
| `panel/src/` | Aplicación React (Vite): `App.jsx`, `componentes/` (resumen, lista, expediente, avisos, `Reportes.jsx`, `MapaReportes.jsx` y `DashboardReportes.jsx`: tablero de reportes y sus estadísticas, con la forma del dashboard de SIGRIV), `graficas/` (SVG a mano), `lib/` (datos, formato, etiquetas) | sí |
| `panel/scripts/copiar-datos.mjs` | Copia las tablas que el panel lee a `panel/public/datos/` antes de `dev` y `build`, y recorta la red hidrográfica a `rios.json` para el mapa del panel | sí |
| `panel/public/datos/` | Copia de `contrato/fixtures/` y `datos/procesados/red/` | **NO** (generado, no versionado) |
| `panel/scripts/ensamblar-sitio.mjs` | Junta en `panel/dist` la app ciudadana (`/ciudadano/`), el mapa (`/mapa/`, con sus capas y su `config.js` escrito desde `MAPBOX_ACCESS_TOKEN`) y el simulador (`/dispositivo/simulador/`) para el despliegue único | sí |
| `panel/scripts/capturar-demo.mjs` | Captura la foto del backend para el modo demostración | sí |
| `panel/public/demo/foto.json` | Respuestas del mock con `--motor real` sobre `descarga_industrial` | **NO**: se regenera con `npm run capturar-demo` |
| `panel/package.json` | Dependencias y scripts del panel | sí |

El panel **no evalúa nada**: lee `GET /alertas`, `GET /veredictos`, `GET /reportes`, `GET /prioridades` y
`GET /huella`, y escribe con `PATCH /alertas/<c_alerta>` y `PATCH /reportes/<c_reporte>`. Tiene dos secciones: el
monitoreo del prototipo (alertas y avisos) y la gestión de los reportes de las personas (D30). Por su cuenta solo lee tablas publicadas. Se corre con
`npm run dev` dentro de `panel/` (D23).

---

## `ciudadano/` — M8, app ciudadana

| Ruta | Qué es | Editable |
|---|---|---|
| `ciudadano/src/` | PWA en React (Vite): `App.jsx`, `components/` (mapa, hoja inferior, formulario, rastreo, términos), `lib/` (backend, foto, ubicación, almacén local, etiquetas) | sí |
| `ciudadano/scripts/copiar-datos.mjs` | Copia `sitios.geojson`, `cuenca.geojson` y `rios_orden3.json` a `ciudadano/public/datos/` y compacta los ríos de orden ≥ 4 en `rios.json`, antes de `dev` y `build` | sí |
| `ciudadano/public/datos/` | Copia de lo anterior | **NO** (generado, no versionado) |
| `ciudadano/public/demo/foto.json` | Reportes de ejemplo para el modo demostración (no son reales) | sí |
| `ciudadano/public/sw.js`, `manifest.webmanifest` | Service worker mínimo e instalación | sí |

La app **no evalúa nada**: manda `POST /reportes` y `POST /reportes/analizar-foto`, y lee `GET /reportes`,
`GET /reportes/<folio>` y `GET /huella`. Se corre con `npm run dev` dentro de `ciudadano/` (D28).

---

## Raíz: despliegue en Vercel (D25)

| Ruta | Qué es | Editable |
|---|---|---|
| `vercel.json` | Un solo proyecto: compila panel y app ciudadana contra `/api`, ensambla el simulador y declara la función del backend en `/api` con los archivos que lee | sí |
| `api/index.py` | Función de Python de Vercel: monta `backend/` bajo `/api` | sí |
| `requirements.txt` | Dependencias de esa función (FastAPI, psycopg). Para correr el backend en local: `backend/requirements.txt` | sí |

## `backend/` — módulo M5

| Ruta | Qué es | Editable |
|---|---|---|
| `backend/app.py` | Aplicación FastAPI: las rutas del contrato, igual que el mock, más `GET /alertas/<c_alerta>/prediccion` | sí |
| `backend/almacen.py` | Persistencia en SQLite o Postgres (`DATABASE_URL`), con candado por estación en la base | sí |
| `backend/propagacion.py` | Predicción de M3 a partir de las tablas que M3 publica | sí, pero debe dar lo mismo que `scripts/80_propagacion.py` (la prueba lo exige) |
| `backend/servidor.py`, `backend/asgi.py` | Arranque local (`--limpiar`, `--db`) y punto de entrada para producción | sí |
| `backend/prueba.py` | Criterio de terminado de M5 y más | sí |
| `backend/requirements.txt` | FastAPI, uvicorn, httpx (pruebas) | sí |
| `backend/datos/atoyac.sqlite` | La base | **NO** (generada, no versionada) |

El backend no inventa reglas: decide `motor/reglas.py`, valida `contrato/validador.py`.

---

## `dispositivo/` — módulo M4

| Ruta | Qué es | Fuente de verdad de | Editable |
|---|---|---|---|
| `dispositivo/README.md` | Cómo correr y probar el simulador | — | sí |
| `dispositivo/ficha-tecnica.md` | Bloques, rangos, ciclo, consumos, lo medido y lo pendiente | **las especificaciones de diseño del dispositivo** | sí |
| `dispositivo/simulador/modelo.js` | El agua, las sondas (`ESPEC`), la energía y el enlace | los rangos y errores de sonda, los eventos inyectables | sí |
| `dispositivo/simulador/firmware.js` | Máquina de estados del ESP32 | el ciclo, los umbrales de muestreo adaptativo y los consumos por fase (`CFG`, `CARGA`) | sí |
| `dispositivo/simulador/montaje.js` | Arma una estación desde los fixtures | el RSSI supuesto por estación | sí |
| `dispositivo/simulador/prueba.js` | Siete pruebas del firmware en Node | — | sí |
| `dispositivo/simulador/escena.js` | Figura: sonda en el río, estación y plataforma con su resultado (alarma o no) | — | sí |
| `dispositivo/simulador/index.html`, `ui.js`, `estilos.css` | Interfaz del simulador | — | sí |

El simulador **lee** `contrato/fixtures/` y no los duplica. Se sirve desde la raíz del
repositorio (`python -m http.server 8000`).

---

## `datos/`

| Ruta | Qué es | Lo genera | Editable |
|---|---|---|---|
| `datos/README.md` | Descripción del conjunto de datos, reglas de limpieza, limitaciones | — | sí |
| `datos/bitacora.md` | **URL exacta de cada fuente**, correcciones al inventario, pendientes | — | sí |
| `datos/crudos/**` | Archivos tal cual se descargaron | `scripts/00_descargar_fuentes.py` | **nunca** |
| `datos/geo/F08_red_hidrografica/**` | Red hidrográfica del INEGI extraída | descarga + descompresión | **nunca** |
| `datos/procesados/sitio.csv` | 219 sitios con coordenadas, cuenca, semáforo | `10_construir_tablas.py` | **NO** |
| `datos/procesados/parametro.csv` | 347 parámetros, **la traducción de vocabularios** | `10_construir_tablas.py` | **NO** |
| `datos/procesados/muestreo.csv` | 145 703 resultados en formato largo | `10_construir_tablas.py` | **NO** |
| `datos/procesados/muestreo_nucleo.csv` | Subconjunto de 74 801 del núcleo analítico | `10_construir_tablas.py` | **NO** |
| `datos/procesados/umbral.csv` | Escalas CONAGUA y límites NOM-001 | `10_construir_tablas.py` | **NO** |
| `datos/procesados/indicador_sitio_periodo.csv` | Indicadores CONAGUA por sitio | `10_construir_tablas.py` | **NO** |
| `datos/procesados/diccionario_conagua.csv` | Diccionario oficial de campos | `10_construir_tablas.py` | **NO** |
| `datos/procesados/proxy_modelos.csv` | Los dos modelos proxy con su validación y si se publican | `90_modelos_proxy.py` | **NO** |
| `datos/procesados/mapa/red_vigilada.geojson` | Los tramos del mapa que vigila cada estación (20 km aguas arriba), con su `estacion` | `96_red_estaciones.py` | **NO** |
| `datos/procesados/mapa/rios_orden3.json` | Cauces de orden 3 (barrancas) para el mapa de la app ciudadana, que los pide solo al acercar | `61_rios_menores_para_app.py` | **NO** |
| `datos/procesados/mapa/*.geojson` (el resto) | Cauces (orden ≥ 4), subcuencas, contorno de la cuenca, confluencias principales y toponimia hidrográfica, simplificados para el mapa | `60_red_para_mapa.py` | **NO** |
| `datos/procesados/analisis/*.csv` | Línea base, ranking, temporada, tendencia, cobertura, correlaciones | `20_analisis_exploratorio.py` | **NO** |
| `datos/procesados/red/tramo.csv` | 65 342 tramos con orden de Strahler, longitud y tramo de aguas abajo. **No se versiona** (8.2 MB) | `70_topologia_red.py` | **NO** |
| `datos/procesados/red/sitio_red.csv` | Dónde quedó enganchado cada sitio y con qué calidad | `70_topologia_red.py` | **NO** |
| `datos/procesados/red/sitio_aguas_abajo.csv` | **El siguiente sitio aguas abajo y su distancia sobre el cauce** | `70_topologia_red.py` | **NO** |
| `datos/procesados/red/sitio_pares.csv` | Los 6 276 pares arriba-abajo | `70_topologia_red.py` | **NO** |
| `datos/procesados/red/red_asignacion.json` | 11 765 tramos con su trazo simplificado y su sitio aguas abajo, 1.6 MB. **Se versiona**: la función de Vercel la necesita | `71_red_para_asignacion.py` | **NO** |
| `datos/procesados/red/atenuacion_observada.csv` | Razón medida abajo/arriba por parámetro: la calibración del modelo | `80_propagacion.py` | **NO** |
| `datos/procesados/red/red_estaciones.csv` | Curva de cobertura (establecimientos DENUE vigilados por 1 a 12 estaciones) y las 5 elegidas con su número | `96_red_estaciones.py` | **NO** |
| `datos/procesados/red/tiempo_viaje.csv` | Ventana horaria de llegada de los 5 769 pares utilizables | `80_propagacion.py` | **NO** |
| `contrato/fixtures/prediccion_ejemplo.json` | Una predicción completa para que el panel y el mapa trabajen sin M5 | `80_propagacion.py` | **NO** |

`muestreo.csv` y `muestreo_nucleo.csv` están en `.gitignore` por tamaño: quien clona debe
regenerarlas.

---

## `scripts/`

El prefijo numérico indica el orden de ejecución. `_comun.py` no se ejecuta solo.

| Ruta | Qué hace | Lee | Escribe |
|---|---|---|---|
| `scripts/_comun.py` | **Fuente de verdad de** el parseo de censurados, la normalización de texto, las fechas y la lectura de Excel | — | — |
| `scripts/00_descargar_fuentes.py` | Descarga las fuentes. **Fuente de verdad de las URL resueltas** | — | `datos/crudos/` |
| `scripts/01_inspeccionar_crudos.py` | Diagnóstico: hojas, dimensiones, primeras filas de un Excel | un archivo que le pases | stdout |
| `scripts/02_explorar_f02.py` | Diagnóstico: columnas, cuencas y escalas del archivo de indicadores | `datos/crudos/F02/` | stdout |
| `scripts/10_construir_tablas.py` | Construye el modelo de datos. **Fuente de verdad de `en_area()`, el núcleo analítico y los límites NOM-001 transcritos** | `datos/crudos/` | `datos/procesados/` |
| `scripts/20_analisis_exploratorio.py` | Línea base y análisis | `datos/procesados/` | `datos/procesados/analisis/`, `docs/09-...` |
| `scripts/30_verificacion_datos.py` | Verifica integridad y emite veredictos | `datos/crudos/`, `datos/procesados/` | `docs/08-...` |
| `scripts/40_generar_fixtures.py` | Genera los fixtures del contrato | `datos/procesados/` | `contrato/fixtures/` |
| `scripts/60_red_para_mapa.py` | Lee las capas de la red hidrográfica y las simplifica para pintar el mapa. **Fuente de verdad de** qué orden de cauce se dibuja (`ORDEN_MINIMO`) y de las tolerancias de simplificación. Calcula el contorno de la cuenca y las confluencias por longitud de red acumulada; **no** ordena los sitios (eso es M1, `70_topologia_red.py`) | `datos/geo/F08_red_hidrografica/` | `datos/procesados/mapa/` |
| `scripts/61_rios_menores_para_app.py` | Saca los cauces de orden 3 de la red del INEGI para la app ciudadana; reutiliza la lectura y la simplificación de `60_red_para_mapa.py` | `datos/geo/F08_red_hidrografica/` | `datos/procesados/mapa/rios_orden3.json` |
| `scripts/97_escuelas_riesgo.py` | Índice de riesgo de escuelas (pesos como hipótesis; el índice es la suma del desglose). Escribe `escuelas.json` (las 400 de mayor riesgo) y `zonas_riesgo.geojson` (agrupadas a partir de los datos); con la lista provisional si no existe `factores_escuelas.csv` | `datos/procesados/escuelas/factores_escuelas.csv` | `contrato/fixtures/escuelas.json`, `zonas_riesgo.geojson` |
| `scripts/98_escuelas_candidatas.py` | Escuelas públicas rurales de Puebla (catálogo SEP) con un puntaje por factor: pendiente, urbanización reciente, fuente contaminante cercana, calidad del agua, sin drenaje y marginación | `datos/crudos/F12`, `F16`, `F17`, `F18`, `F19` | `datos/procesados/escuelas/factores_escuelas.csv` |
| `scripts/70_topologia_red.py` | **M1.** Engancha los sitios a la red del INEGI, orienta los tramos y calcula el siguiente sitio aguas abajo. **Fuente de verdad de la topología** | `datos/geo/`, `sitio.csv` | `datos/procesados/red/`, `docs/13-...` |
| `scripts/80_propagacion.py` | **M3.** Calibra la atenuación con los datos, calcula ventanas de llegada y produce la predicción. **Fuente de verdad de la velocidad supuesta y del alcance útil** | `red/`, `muestreo_nucleo.csv` | `red/atenuacion_observada.csv`, `red/tiempo_viaje.csv`, `contrato/fixtures/prediccion_ejemplo.json`, `docs/14-...` |
| `motor/reglas.py` | **M2.** `evaluar(paquete) → veredicto`. **Fuente de verdad de los umbrales de deteccion y de la firma de fuente probable** | fixtures, `umbral.csv` | nada en disco |
| `motor/prueba.py` | Banco de pruebas de M2: mide el criterio de terminado | escenarios | `docs/15-...` |
| `scripts/90_modelos_proxy.py` | Ajusta y **valida fuera de muestra** los modelos proxy sensor→laboratorio. **Fuente de verdad del criterio de publicación** (`MAX_ERROR_MEDIANO`) | `muestreo_nucleo.csv` | `proxy_modelos.csv`, `contrato/fixtures/modelos_proxy.json`, `docs/16-...` |
| `scripts/96_red_estaciones.py` | Elige la red de estaciones: sitios con historia de campo que más establecimientos DENUE vigilan a 20 km aguas arriba. **Fuente de verdad de `N_ESTACIONES`** | `sitio.csv`, `analisis/linea_base_...`, `red/`, `denue/establecimientos_cuenca.csv`, `mapa/red_hidrografica.geojson` | `red/red_estaciones.csv`, `mapa/red_vigilada.geojson` |
| `scripts/71_red_para_asignacion.py` | Poda la red a los tramos que alcanzan un sitio en 20 km y la simplifica, para que la asignación quepa en la función de Vercel. **Fuente de verdad de `ALCANCE_M`** | `datos/geo/`, `red/` | `red/red_asignacion.json` |
| `scripts/50_verificar_repo.py` | **Revisión de salud del repositorio.** Automatiza nueve comprobaciones de invariantes y sale con código 1 si falla. **Fuente de verdad de los conteos esperados** (`FILAS_ESPERADAS`) | todo | stdout |

**Orden de ejecución.** Reconstruir todo desde las fuentes originales requiere
`pip install openpyxl pyxlsb pypdf` y esta secuencia:

```powershell
python -I scripts/00_descargar_fuentes.py
```

```powershell
python -I scripts/10_construir_tablas.py
```

```powershell
python -I scripts/20_analisis_exploratorio.py
```

```powershell
python -I scripts/30_verificacion_datos.py
```

```powershell
python -I scripts/40_generar_fixtures.py
```

```powershell
python -I scripts/60_red_para_mapa.py
```

```powershell
python -I scripts/61_rios_menores_para_app.py
```

```powershell
python -I scripts/70_topologia_red.py
```

```powershell
python -I scripts/80_propagacion.py
```

```powershell
python -I scripts/50_verificar_repo.py
```

Las dependencias reales: 30, 40 y 70 necesitan lo que produce el 20; el 80 necesita el 70;
el 50 comprueba el resultado de todos y es el único que corre sin los archivos crudos. Los
scripts `01` y `02` son diagnóstico y no forman parte de la secuencia.

---

## `docs/`

| Ruta | Qué es | Editable |
|---|---|---|
| `docs/README.md` | Índice de las dos secciones | sí |
| `docs/01-que-construimos.md` | Problema, solución, **qué existe vs. qué está planeado** | sí |
| `docs/02-arquitectura.md` | Cómo encajan las piezas, recorrido de un dato | sí |
| `docs/03-tecnologias.md` | Stack con justificación, lo descartado | sí |
| `docs/04-fuentes-de-datos.md` | De dónde, cómo y por qué cada fuente | sí |
| `docs/05-decisiones-tecnicas.md` | D1 a D21 con justificación y consecuencia | sí |
| `docs/06-glosario.md` | Términos del dominio y del proyecto | sí |
| `docs/07-plan-recoleccion-datos.md` | Plan original de la Etapa 1 | **histórico** |
| `docs/08-verificacion-datos.md` | Estado del conjunto de datos | **NO** (script 30) |
| `docs/09-hallazgos-exploratorio.md` | Qué dicen los datos | **NO** (script 20) |
| `docs/10-revision-critica-plan.md` | Seis objeciones al plan, con alternativas | sí |
| `docs/11-metodologia-modulos.md` | Módulos, criterios de terminado, degradación | sí |
| `docs/12-estado-y-traspaso.md` | Estado por módulo y qué puede tomarse hoy | sí |
| `docs/contexto/**` | Esta carpeta | sí, salvo el registro, que es de solo añadir |

---

## Dónde está la fuente de verdad de cada cosa

Tabla de consulta rápida. Si vas a cambiar uno de estos conceptos, es el único archivo que
debes tocar.

| Concepto | Único lugar donde se define |
|---|---|
| Qué sitios entran al área de estudio | `en_area()` en `scripts/10_construir_tablas.py` |
| Cómo se interpreta un valor censurado | `parse_valor()` en `scripts/_comun.py` |
| Cómo se escribe el nombre de un estado | `normaliza_estado()` en `scripts/_comun.py` |
| Qué sitio está aguas abajo de cuál | `datos/procesados/red/sitio_aguas_abajo.csv` (no `sitio.csv`) |
| Tolerancia de enganche de un sitio al cauce | `ENGANCHE_BUENO` y `ENGANCHE_DUDOSO` en `scripts/70_topologia_red.py` |
| Velocidad de flujo supuesta | `VELOCIDAD_MIN_MS` y `VELOCIDAD_MAX_MS` en `scripts/80_propagacion.py` |
| Cuándo una lectura dispara alerta | `Z_ESCALON`, `BRECHA_GUARDA` y `PERSISTENCIA` en `motor/reglas.py` |
| Cómo se clasifica la fuente probable | `_fuente_probable()` en `motor/reglas.py` |
| Si un modelo proxy se publica o no | `MAX_ERROR_MEDIANO` y `MAX_ERROR_P90` en `scripts/90_modelos_proxy.py` |
| Hasta qué distancia se asigna un reporte a un sitio | `TOLERANCIA_M` en `backend/asignacion.py` |
| Hasta qué distancia la predicción es útil | `DISTANCIA_UTIL_M` en `scripts/80_propagacion.py` |
| Los conteos esperados de cada tabla | `FILAS_ESPERADAS` en `scripts/50_verificar_repo.py` |
| Traducción entre claves CONAGUA y códigos cortos | `datos/procesados/parametro.csv`, columna `c_parametro_std` |
| Qué parámetros son del núcleo analítico | constante `NUCLEO` en `scripts/10_construir_tablas.py` |
| Qué parámetros son medibles en campo | constante `EN_CAMPO` en `scripts/10_construir_tablas.py` |
| Límites de la NOM-001 transcritos | constante `NOM001` en `scripts/10_construir_tablas.py` |
| Escalas de calidad de CONAGUA | se extraen de la hoja `Escalas Superficial` de F02; el resultado queda en `datos/procesados/umbral.csv` |
| Vocabulario de parámetros del contrato | `enum` de `c_parametro` en `contrato/esquemas/lectura.schema.json` |
| Rutas de la API | `contrato/servidor_mock.py` y la tabla de `contrato/README.md` |
| Selección de las 5 estaciones del piloto | `scripts/40_generar_fixtures.py` |
| Firma de cada escenario | funciones `f_organica`, `f_industrial`, `f_lluvia` en `scripts/40_generar_fixtures.py` |
| URL de cada fuente de datos | `scripts/00_descargar_fuentes.py`, registradas en `datos/bitacora.md` |
| Rangos y errores de las sondas, ciclo y consumos del dispositivo | `ESPEC` en `dispositivo/simulador/modelo.js`, `CFG` y `CARGA` en `dispositivo/simulador/firmware.js`; descritos en `dispositivo/ficha-tecnica.md` |
| Criterio de terminado de cada módulo | `docs/11-metodologia-modulos.md` |
| Justificación de una decisión | `docs/05-decisiones-tecnicas.md` |

# Etapa 1 — Recolección, procesamiento y análisis de datos
**HackaTec 2026 · Reto SECIHTI Puebla**
*Soluciones tecnológicas para identificar, monitorear y reducir la contaminación de ríos, barrancas y cuerpos de agua del estado de Puebla*

---

## 1. Planteamiento del problema

La cuenca del Alto Atoyac concentra descargas de aguas residuales municipales e industriales, residuos sólidos y escurrimientos que deterioran la calidad del agua de ríos, barrancas y presas del estado de Puebla. La información que existe sobre este deterioro tiene tres limitaciones:

1. **Está dispersa.** Las mediciones de calidad del agua, la geografía de los ríos, las descargas registradas y la actividad económica cercana viven en fuentes distintas (CONAGUA, INEGI, SMN, normas oficiales), con formatos y claves diferentes.
2. **Es esporádica.** El monitoreo oficial se basa en muestreos de laboratorio pocas veces al año por sitio. Entre una medición y otra, un evento de contaminación puede pasar sin registrarse.
3. **No se traduce en decisiones.** Los datos existen, pero no se presentan de forma que una autoridad o un ciudadano pueda responder rápido: *¿dónde está el problema, qué tan grave es, qué lo causa y qué se puede hacer?*

**Problema que atiende esta etapa:** no existe un conjunto de datos integrado, limpio y georreferenciado de la cuenca del Alto Atoyac que permita identificar puntos críticos, caracterizar su contaminación y servir de línea base para un sistema de monitoreo y alertamiento.

## 2. Objetivo de la etapa

Construir un **conjunto de datos base del Alto Atoyac**, integrado, limpio y documentado, que permita:

- Ubicar en un mapa los sitios de monitoreo y su estado de calidad del agua.
- Conocer el rango "normal" de cada parámetro en cada sitio (línea base).
- Identificar patrones: sitios más afectados, temporadas, tendencias y posibles fuentes.
- Definir umbrales de alerta con respaldo normativo.
- Alimentar los módulos posteriores (plataforma, modelos de análisis y app ciudadana).

## 3. Preguntas que deben responder los datos

Toda la recolección se orienta a responder estas preguntas. Un dato que no ayude a responder ninguna queda fuera del alcance.

| # | Pregunta | Datos que la responden |
|---|---|---|
| P1 | ¿Dónde están los puntos críticos de contaminación? | Sitios de monitoreo, coordenadas, semáforo |
| P2 | ¿Qué tan contaminado está cada punto y en qué parámetros? | Resultados por parámetro y escalas de calidad |
| P3 | ¿Cuál es el rango normal de cada parámetro en cada punto? | Series históricas por sitio |
| P4 | ¿La contaminación cambia por temporada o con los años? | Fechas de muestreo y precipitación |
| P5 | ¿Qué tipo de fuente provoca la contaminación en cada punto? | Combinaciones de parámetros, descargas, actividad económica |
| P6 | ¿Qué puntos quedan aguas arriba y aguas abajo de cuáles? | Red hidrográfica |
| P7 | ¿A partir de qué valor se considera anormal o peligroso? | Escalas de CONAGUA y NOM-001-SEMARNAT-2021 |
| P8 | ¿Qué medidas aplican según el tipo de contaminación? | Literatura técnica y casos documentados |

## 4. Alcance

- **Geográfico:** cuenca del Alto Atoyac en el estado de Puebla: río Atoyac, sus afluentes y barrancas, y la presa Manuel Ávila Camacho (Valsequillo). Si un sitio de Tlaxcala está aguas arriba y afecta a Puebla, se incluye y se marca.
- **Temporal:** lo más reciente disponible, con historial desde 2012 cuando exista.
- **Temático:** calidad del agua superficial. El agua subterránea queda fuera de esta etapa.

## 5. Inventario de fuentes

### 5.1 Prioridad A: indispensables

| ID | Dato | Fuente | Enlace | Formato esperado | Responde |
|---|---|---|---|---|---|
| F01 | Sitios y resultados de calidad del agua del Alto Atoyac (73 sitios superficiales, con hoja de sitios y manual de consulta) | CONAGUA – RENAMECA | https://files.conagua.gob.mx/transparencia/CalidaddelAgua.pdf (el enlace de descarga del archivo viene dentro del PDF) | Excel/DOCX | P1, P2, P3 |
| F02 | Indicadores de calidad del agua 2023 (1,056 sitios, nacional) | CONAGUA – Datos abiertos | https://datos.conagua.gob.mx/views/index_datos_abiertos.html | ZIP/CSV | P1, P2 |
| F03 | Datos de calidad del agua de ~4,500–5,000 sitios y su diccionario de datos | CONAGUA – Datos abiertos | https://datos.conagua.gob.mx/views/index_datos_abiertos.html | ZIP/CSV | P2, P3, P4 |
| F04 | Calidad del agua superficial 2012–2021 y 2021 | CONAGUA | https://www.gob.mx/conagua/articulos/calidad-del-agua | Excel, KMZ | P3, P4 |
| F05 | Resultados RENAMECA 2012–2025 (revisar si hay datos de 2024–2025) | CONAGUA | https://www.gob.mx/conagua/articulos/resultados-de-la-red-nacional-de-medicion-de-calidad-del-agua-renameca | Por confirmar | P2, P3, P4 |
| F06 | Escala de calificación y semáforo de calidad del agua superficial | CONAGUA (incluido en F01 y en el diccionario de F03) | Ver F01 | PDF | P2, P7 |
| F07 | Límites permisibles en descargas de aguas residuales (NOM-001-SEMARNAT-2021, DOF 11/03/2022) | SEMARNAT – DOF | https://platiica.economia.gob.mx/wp-content/uploads/sites/2/PDF_Normas_Publicas/001semarnat2021.pdf | PDF | P7 |
| F08 | Red hidrográfica 1:50 000 (trazo y dirección de flujo de los ríos) | INEGI – SIATL / Topografía | https://antares.inegi.org.mx/analisis/red_hidro/siatl/ · https://www.inegi.org.mx/temas/topografia/ | SHP/GeoJSON | P6 |

### 5.2 Prioridad B: contexto y causas

| ID | Dato | Fuente | Enlace | Formato esperado | Responde |
|---|---|---|---|---|---|
| F09 | Permisos de descarga de aguas residuales (titular, ubicación, volumen) | CONAGUA – REPDA | https://www.gob.mx/conagua/acciones-y-programas/acerca-del-repda | Consulta web | P5 |
| F10 | Inventario Nacional de Descargas de Aguas Residuales (IDAR) | CONAGUA | Por localizar (no se encontró enlace público directo) | Por confirmar | P5 |
| F11 | Plantas de tratamiento de aguas residuales municipales (ubicación, capacidad, si operan) | CONAGUA – Inventario de plantas | Por localizar | PDF/Excel | P5 |
| F12 | Establecimientos económicos cerca del río (industria textil, química, alimentaria, etc.) | INEGI – DENUE | https://www.inegi.org.mx/app/descarga/ · https://www.inegi.org.mx/app/mapa/denue/ | CSV/SHP | P5 |
| F13 | Precipitación mensual por estación climatológica | SMN – CONAGUA | https://smn.conagua.gob.mx/es/climatologia/informacion-climatologica/informacion-estadistica-climatologica | TXT/CSV | P4 |
| F14 | Caudales en estaciones hidrométricas | CONAGUA – BANDAS | Por localizar (puede tener datos antiguos) | Por confirmar | P6 |
| F15 | Diagnósticos de ríos prioritarios (si existe uno del Atoyac) | CONAGUA | https://files.conagua.gob.mx/conagua/riosprioritarios/ | PDF | P2, P4, P5 |

### 5.3 Prioridad C: soporte documental

| ID | Dato | Fuente | Responde |
|---|---|---|---|
| F16 | Estudios académicos de la cuenca (BUAP, UNAM, IPN, CIESAS, etc.) | Repositorios institucionales, Google Scholar | P2, P5, P8 |
| F17 | Medidas de mitigación por tipo de contaminación (humedales artificiales, tratamiento, control de descargas) | Literatura técnica, CONAGUA, SEMARNAT | P8 |
| F18 | Notas periodísticas y denuncias de contaminación en el Atoyac (para validar puntos críticos) | Medios locales y nacionales | P1, P5 |

> Los enlaces marcados como **"Por localizar"** o **"Por confirmar"** se verifican durante la recolección y se actualizan en este documento.

## 6. Modelo de datos destino

Todo lo recolectado se normaliza a estas tablas. Se usan **claves naturales o códigos** (prefijo `c_`), no identificadores autoincrementables.

### 6.1 `sitio`: puntos de monitoreo

| Campo | Tipo | Descripción |
|---|---|---|
| `c_sitio` (PK) | texto | Clave oficial del sitio CONAGUA (ej. `OCNOR4071`) |
| `nombre` | texto | Nombre del sitio |
| `cuerpo_agua` | texto | Río, barranca, presa, etc. |
| `tipo_cuerpo` | texto | Lótico (río) / léntico (presa, lago) |
| `municipio` | texto | Municipio |
| `estado` | texto | Puebla / Tlaxcala |
| `cuenca` | texto | Cuenca CONAGUA |
| `latitud` | decimal | WGS84, grados decimales |
| `longitud` | decimal | WGS84, grados decimales |
| `c_sitio_aguas_abajo` | texto (FK) | Siguiente sitio sobre el mismo cauce (se llena con F08) |
| `fuente` | texto | ID de fuente (F01, F02…) |

### 6.2 `parametro`: catálogo de parámetros

| Campo | Tipo | Descripción |
|---|---|---|
| `c_parametro` (PK) | texto | Código corto: `OD`, `DBO5`, `DQO`, `SST`, `SDT`, `CF`, `ECOLI`, `ENTEROC`, `TOX`, `PH`, `TEMP`, `COND`, `TURB` |
| `nombre` | texto | Nombre completo |
| `unidad` | texto | mg/L, NMP/100 mL, UT, °C, µS/cm, NTU… |
| `medible_en_campo` | booleano | ¿Se puede medir con sensor en sitio? (sí: OD, pH, temp., conductividad, turbidez; no: DBO, DQO, coliformes, toxicidad) |
| `descripcion` | texto | Qué indica el parámetro |

### 6.3 `muestreo`: resultados

| Campo | Tipo | Descripción |
|---|---|---|
| `c_sitio` (PK, FK) | texto | Sitio |
| `fecha` (PK) | fecha | Fecha del muestreo (AAAA-MM-DD) |
| `c_parametro` (PK, FK) | texto | Parámetro |
| `valor` | decimal | Valor numérico (nulo si no se reportó) |
| `bajo_limite_deteccion` | booleano | `true` si el original venía como `<0.01` o similar |
| `limite_deteccion` | decimal | El número que acompañaba al `<` |
| `calificacion` | texto | Excelente / Buena / Aceptable / Contaminada / Fuertemente contaminada (si la fuente la trae) |
| `fuente` | texto | ID de fuente |

### 6.4 `umbral`: escalas y límites

| Campo | Tipo | Descripción |
|---|---|---|
| `c_parametro` (PK, FK) | texto | Parámetro |
| `c_escala` (PK) | texto | `CONAGUA_SUP` o `NOM001_2021_RIO` |
| `categoria` (PK) | texto | Excelente / Buena / … o "Límite permisible" |
| `min` | decimal | Límite inferior del rango |
| `max` | decimal | Límite superior del rango |
| `color_semaforo` | texto | Verde / Amarillo / Rojo |
| `fuente` | texto | F06 / F07 |

### 6.5 `fuente_contaminacion`: posibles causas

| Campo | Tipo | Descripción |
|---|---|---|
| `c_fuente_cont` (PK) | texto | Folio REPDA, clave DENUE o clave de la planta de tratamiento |
| `tipo` | texto | Descarga con permiso / Industria / Planta de tratamiento / Denuncia |
| `giro` | texto | Actividad (textil, alimentos, municipal…) |
| `latitud`, `longitud` | decimal | Ubicación |
| `c_sitio_cercano` | texto (FK) | Sitio de monitoreo más cercano aguas abajo |
| `fuente` | texto | F09, F10, F11, F12 |

### 6.6 `precipitacion`

| Campo | Tipo | Descripción |
|---|---|---|
| `c_estacion` (PK) | texto | Clave de la estación del SMN |
| `anio` (PK), `mes` (PK) | entero | Periodo |
| `precipitacion_mm` | decimal | Lluvia acumulada del mes |
| `latitud`, `longitud` | decimal | Ubicación de la estación |

## 7. Procedimiento de recolección

1. **Preparar el registro.** Crear la estructura de carpetas (sección 10) y la bitácora de fuentes (sección 9).
2. **Descargar las fuentes de prioridad A** (F01–F08). Guardar cada archivo **sin modificar** en `datos/crudos/<ID>/` y registrar en la bitácora: fecha de descarga, URL exacta, nombre del archivo y notas.
3. **Leer los diccionarios de datos** de CONAGUA antes de procesar nada: nombres de columnas, unidades, claves de sitio y códigos de calificación.
4. **Filtrar al área de estudio:** quedarse con los sitios de la cuenca Alto Atoyac (por campo de cuenca o, si no existe, por estado y coordenadas).
5. **Cruzar fuentes por `c_sitio`:** el mismo sitio puede aparecer en F01, F02, F03 y F04 con años distintos; se unen por clave, no por nombre.
6. **Extraer umbrales** de F06 y F07 a la tabla `umbral`.
7. **Recortar la red hidrográfica** (F08) a la cuenca y determinar el orden aguas arriba → aguas abajo de los sitios.
8. **Descargar las fuentes de prioridad B** (F09–F15), filtrando por municipios de la cuenca.
9. **Recopilar los documentos de prioridad C** (F16–F18) en `docs/` con una ficha de una línea por documento: qué aporta y a qué pregunta responde.

## 8. Procesamiento y limpieza

| Problema esperado | Regla de tratamiento |
|---|---|
| Valores con `<` (ej. `<0.01`) | `valor` = nulo, `bajo_limite_deteccion` = true, `limite_deteccion` = 0.01. Para análisis se puede usar la mitad del límite, documentándolo. |
| Valores con `>` (ej. `>24000` en coliformes) | Guardar el número y marcar como censurado superior. |
| Texto en celdas numéricas ("ND", "S/D", "-") | Convertir a nulo. |
| Unidades distintas entre años o fuentes | Normalizar a la unidad del catálogo `parametro`. |
| Formatos de fecha mezclados | Convertir a ISO `AAAA-MM-DD`. |
| Coordenadas en grados-minutos-segundos o con signo incorrecto | Convertir a grados decimales y validar que caigan dentro de Puebla o Tlaxcala (en México la longitud es negativa). |
| Nombres de sitio con variantes | Unir siempre por `c_sitio`, nunca por nombre. |
| Registros duplicados entre fuentes | Conservar uno por (`c_sitio`, `fecha`, `c_parametro`) y priorizar la fuente más reciente. |
| Sitios sin coordenadas | Buscarlas en otra fuente; si no aparecen, excluirlos del mapa y anotarlo. |

**Regla de oro:** nunca se edita un archivo crudo. Toda transformación se hace con un script o un cuaderno reproducible que lee `crudos/` y escribe en `procesados/`.

## 9. Bitácora de fuentes (plantilla)

| ID | Fecha de descarga | Responsable | URL exacta | Archivo | Periodo cubierto | Registros | Notas / problemas |
|---|---|---|---|---|---|---|---|
| F01 | | | | | | | |
| F02 | | | | | | | |
| … | | | | | | | |

## 10. Estructura de carpetas

```
datos/
├── crudos/            # archivos tal cual se descargaron, uno por fuente
│   ├── F01/
│   ├── F02/
│   └── ...
├── procesados/        # tablas limpias del modelo de datos (CSV o GeoJSON)
│   ├── sitio.csv
│   ├── parametro.csv
│   ├── muestreo.csv
│   ├── umbral.csv
│   ├── fuente_contaminacion.csv
│   └── precipitacion.csv
├── geo/               # red hidrográfica y límites, recortados a la cuenca
└── bitacora.md        # registro de fuentes (sección 9)
docs/                  # estudios, normas y notas (prioridad C)
scripts/               # código de limpieza y transformación
```

## 11. Análisis exploratorio inicial

Con los datos procesados, este primer análisis responde las preguntas de la sección 3:

1. **Mapa de sitios** coloreados por su semáforo más reciente (P1).
2. **Ranking de sitios** por número de parámetros fuera de norma (P1, P2).
3. **Rango normal por sitio y parámetro:** media, desviación estándar, mínimo, máximo y percentiles 10 y 90 (P3). Es la línea base del sistema.
4. **Comparación por temporada:** estiaje (noviembre–mayo) contra lluvias (junio–octubre), por parámetro (P4).
5. **Tendencia por año** en los sitios con historial suficiente (P4).
6. **Correlación entre parámetros:** qué parámetros suben juntos, como pista del tipo de fuente (P5). Por ejemplo, DBO con coliformes sugiere aguas residuales urbanas, y toxicidad con conductividad sugiere descargas industriales.
7. **Perfil longitudinal del río:** parámetros ordenados de aguas arriba a aguas abajo, para ver dónde empeora el agua y dónde se recupera (P6).
8. **Cruce con fuentes de contaminación:** descargas y establecimientos aguas arriba de cada punto crítico (P5).
9. **Parámetros medibles en campo:** cuáles de los parámetros con datos históricos se pueden medir con sensores (OD, pH, temperatura, conductividad, turbidez) y qué tan bien se relacionan con los de laboratorio (por ejemplo, turbidez con SST, o conductividad con SDT).

## 12. Limitaciones conocidas

- Los datos oficiales son **muestreos periódicos**, no mediciones continuas: sirven como línea base, no como registro en tiempo real.
- Puede haber **años o sitios incompletos**; el análisis debe indicar cuántos datos respaldan cada conclusión.
- Algunas fuentes de contexto (IDAR, plantas de tratamiento, caudales) pueden estar **desactualizadas o no ser públicas** en formato descargable.
- Las fechas de corte de cada fuente se reportan siempre junto con los resultados (ej. "datos 2012–2023").

## 13. Entregables de la etapa

- [ ] Fuentes de prioridad A descargadas y registradas en la bitácora.
- [ ] Tablas `sitio`, `parametro`, `muestreo` y `umbral` limpias.
- [ ] Red hidrográfica recortada y orden aguas arriba → aguas abajo de los sitios.
- [ ] Fuentes de prioridad B descargadas y la tabla `fuente_contaminacion` construida.
- [ ] Tabla `precipitacion` para los municipios de la cuenca.
- [ ] Análisis exploratorio (sección 11) con gráficas y un resumen de hallazgos.
- [ ] Lista de puntos críticos priorizados, con su justificación.
- [ ] Documento de limitaciones y supuestos actualizado.

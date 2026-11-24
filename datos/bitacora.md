# Bitácora de fuentes

Etapa 1 — Recolección, procesamiento y análisis de datos · Reto SECIHTI Puebla (HackaTec 2026).
Plan de referencia: [`docs/07-plan-recoleccion-datos.md`](../docs/07-plan-recoleccion-datos.md).

Todas las descargas de esta sesión: **2026-11-23**. Nada de lo que está en `crudos/` se edita;
se puede volver a bajar con `python -I scripts/00_descargar_fuentes.py`.

## Descargadas

| ID | Archivo | URL exacta | Bytes | Periodo | Registros / contenido | Notas |
|---|---|---|---|---|---|---|
| F01 | `crudos/F01/CalidaddelAgua.pdf` | `https://files.conagua.gob.mx/transparencia/CalidaddelAgua.pdf` | 3 344 040 | — | Guía RENAMECA, 38 págs. | Los enlaces de descarga **no están en el texto**: son anotaciones `/URI` del PDF (págs. 5, 11 y 22). De ahí salieron las tres filas siguientes. |
| F01 | `crudos/F01/Resultados_Rio_Atoyac.xlsx` | `https://files.conagua.gob.mx/conagua/GobiernoAbierto/Resultados_Rio_Atoyac.xlsx` | 2 117 913 | 2012–2018 | 73 sitios, 2 140 muestreos, 234 parámetros | **Fuente más densa de la cuenca**: muestreo casi mensual. Hojas `SITIOS`, `RESULTADOS 2012-2018`, `SIMBOLOGÍA`. |
| F01 | `crudos/F01/Manual_Rio_Atoyac.docx` | `.../GobiernoAbierto/Manual_Rio_Atoyac.docx` | 1 516 760 | — | Manual de consulta del archivo anterior | Pendiente de leer a detalle. |
| F01 | `crudos/F01/Calidad_Agua_Superficial.xlsx` | `.../GobiernoAbierto/Calidad_Agua_Superficial.xlsx` | 1 279 797 | — | 4 202 sitios nacionales | Respaldo nacional; no se usó todavía. |
| F02 | `crudos/F02/Calidad_del_Agua_Superficial_p_2012-2025.xlsx` | `https://www.gob.mx/cms/uploads/attachment/file/1084133/Calidad_del_Agua_Superficial_p_2012-2025.xlsx` | 1 378 410 | 2012–2025 | 5 033 sitios, 46 columnas | Trae **semáforo**, **contaminantes señalados**, coordenadas, hoja `Diccionario_datos_Superficial` y hoja `Escalas Superficial`. Cubre F02, F03 y F06 del plan. |
| F02 | `crudos/F02/Calidad_del_Agua_Superficial_a_2025.xlsx` | `.../file/1084132/Calidad_del_Agua_Superficial_a_2025.xlsx` | 269 494 | 2025 | 1 043 sitios | Corte anual más reciente. |
| F03 | `crudos/F03/Calidad_del_Agua_Superficial_p.zip` | `https://files.conagua.gob.mx/conagua/generico/sequia/Calidad_del_Agua_Superficial_p.zip` | 596 039 | 2012–2025 | KMZ de los sitios | Geometría lista para mapa. |
| F03 | `crudos/F03/Calidad_del_Agua_Superficial_a.zip` | `.../sequia/Calidad_del_Agua_Superficial_a.zip` | 88 952 | 2025 | KMZ de los sitios | — |
| F05 | `crudos/F05/RESULTADOS-PUEBLA.xlsb` | `https://files.conagua.gob.mx/aguasnacionales/RESULTADOS-PUEBLA.xlsb` | 2 060 893 | 2012–2025 | 208 sitios, 2 905 muestreos, 325 parámetros | RENAMECA por estado. Hojas `SITIOS`, `RESULTADOS`, `SIMBOLOGÍA`. Formato `.xlsb` (requiere `pyxlsb`). |
| F05 | `crudos/F05/RESULTADOS-TLAXCALA.xlsx` | `.../aguasnacionales/RESULTADOS-TLAXCALA.xlsx` | 17 718 279 | 2012–2025 | Incluye los sitios de Tlaxcala aguas arriba | El Zahuapan y el Atoyac tlaxcalteca entran a Puebla: se incluyen y quedan marcados por `estado`. |
| F06 | `crudos/F06/Generalidades_Indicadores_de_calidad_del_agua_2025.pdf` | `https://www.gob.mx/cms/uploads/attachment/file/1084347/Generalidades_Indicadores_de_calidad_del_agua_2025.pdf` | 2 807 301 | 2025 | Metodología del semáforo | Las escalas numéricas se tomaron de la hoja `Escalas Superficial` de F02. |
| F07 | `crudos/F07/NOM-001-SEMARNAT-2021.pdf` | `https://platiica.economia.gob.mx/wp-content/uploads/sites/2/PDF_Normas_Publicas/001semarnat2021.pdf` | 518 369 | DOF 11/03/2022 | 19 págs., Tablas 1 y 2 | **La versión 2021 ya no fija límite de DBO5**; usa DQO y COT. Transcrito a `umbral.csv`. |
| F08 | `crudos/F08/702825006881_RedHidrografica_Cuenca_R_Atoyac_RH_Balsas.zip` | `https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/hidrogeolo/cuenca/702825006881_s.zip` | 36 822 852 | ed. 2.0, 1:50 000 | 10 subcuencas RH18Aa–RH18Aj | Red hidrográfica edición 2.0, Cuenca R. Atoyac, Región H. Balsas. Capas por subcuenca: `_hl` líneas de flujo, `_subc` divisorias, `_dr` puntos de drenaje, `_ha` cuerpos de agua, `_to` toponimia. Extraído en `geo/F08_red_hidrografica/`. El enlace está detrás del buscador con JavaScript del INEGI (upc 702825006881). |
| F12 | `crudos/F12/denue_21_puebla_csv.zip` | `https://www.inegi.org.mx/contenidos/masiva/denue/denue_21_csv.zip` | 37 421 731 | DENUE vigente | CSV de 217 MB + diccionario | Establecimientos de Puebla, con coordenadas y SCIAN. |
| F12 | `crudos/F12/denue_29_tlaxcala_csv.zip` | `.../denue/denue_29_csv.zip` | 8 840 434 | DENUE vigente | CSV de 53 MB + diccionario | Establecimientos de Tlaxcala. |
| F15 | `crudos/F15/Diagnostico_Rio_Atoyac_2012-2024.pdf` | `https://files.conagua.gob.mx/conagua/riosprioritarios/Diagnóstico_Río_Atoyac_2012-2024.pdf` | 19 673 817 | 2012–2024 | Diagnóstico oficial del río prioritario | El más reciente que publica CONAGUA. |
| F16 | `crudos/F16/iter_21_cpv2020_csv.zip` | `https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_21_cpv2020_csv.zip` | 1 923 541 | Censo 2020 | CSV de 5.9 MB, 7 059 localidades | Localidades de Puebla: coordenadas, población, vivienda. Bajado el 2026-11-24. |
| F17 | `crudos/F17/terrarium/12/x/y.png` | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/{x}/{y}.png` | varía | — | PNG con la elevación codificada (Terrarium) | Caché de los mosaicos que pide `98_escuelas_candidatas.py` para la pendiente. Públicos, sin llave. |
| F18 | `crudos/F18/cnct2026.csv` | `https://repodatos.atdt.gob.mx/api_update/secretaria_educacion/catalogo_centros_trabajo_sep/cnct2026.csv` | 198 202 489 | 2026 | CSV nacional | Catálogo de centros de trabajo de la SEP: CCT, nivel, ámbito, coordenadas. **Bajado a mano** (el servidor rechaza clientes que no sean un navegador). |
| F19 | `crudos/F19/IML_2020.zip` | `https://conapo.segob.gob.mx/work/models/CONAPO/Datos_Abiertos/Localidad/IML_2020.zip` | 13 635 279 | 2020 | XLS (BIFF) de 39 MB | Índice y grado de marginación por localidad (CONAPO). Se lee con `xlrd`. |
| F15 | `crudos/F15/2023_Diagnostico_rio_Atoyac_Pue_2012-2022.pdf` | `https://www.gob.mx/cms/uploads/attachment/file/925318/2023_Diagn_stico_r_o_Atoyac_Pue_2012-2022.pdf` | 8 240 717 | 2012–2022 | Diagnóstico anterior | Útil para comparar criterios entre ediciones. |

## Correcciones al inventario del plan

| ID | En el plan | Lo que se encontró |
|---|---|---|
| F01 | "el enlace de descarga viene dentro del PDF" | Confirmado, y resuelto: son tres anotaciones de hipervínculo. Las URL quedaron en `scripts/00_descargar_fuentes.py`. |
| F02 / F03 | `datos.conagua.gob.mx/views/index_datos_abiertos.html` | Ese portal está detrás de Imperva/Incapsula y responde **403** a cualquier cliente que no sea un navegador. El mismo contenido (y más reciente, 2012–2025) está en `gob.mx/conagua/articulos/indicadores-de-calidad-del-agua`, que sí es accesible. |
| F04 | Calidad superficial 2012–2021 + KMZ | Sustituida por F02 (2012–2025) y los KMZ de F03, que son la versión vigente del mismo producto. |
| F05 | "revisar si hay datos de 2024–2025" | **Sí hay**: la serie llega a 2025-12-08. Los archivos son por estado y por tipo de cuerpo de agua. |
| F06 | PDF aparte | Las escalas numéricas están dentro de F02, hoja `Escalas Superficial`; el PDF de generalidades es el respaldo metodológico. |
| F08 | SIATL / Topografía | El producto correcto es "Red hidrográfica edición 2.0, Cuenca R. Atoyac, Región H. Balsas" (1:50 000), upc 702825006881. |
| F15 | "si existe uno del Atoyac" | Existen cinco ediciones (2012–2018, –2020, –2021, –2022 y –2024). Se bajaron las dos más recientes. |

## Pendientes

| ID | Dato | Estado | Siguiente paso |
|---|---|---|---|
| F09 | Permisos de descarga REPDA | Pendiente | La consulta pública es un formulario web; hay que revisar si publica un padrón descargable por entidad. |
| F10 | Inventario Nacional de Descargas (IDAR) | Pendiente | No se localizó archivo público; pedirlo por transparencia o sustituirlo con REPDA + plantas de tratamiento. |
| F11 | Plantas de tratamiento municipales | Pendiente | Está en el *Inventario Nacional de Plantas de Tratamiento* y en las Estadísticas del Agua en México. |
| F13 | Precipitación mensual por estación | Pendiente | Las páginas del SMN cargan los enlaces con JavaScript y las rutas antiguas `tools/RESOURCES/...` responden **500**. Hay que entrar al buscador de normales por estado. |
| F14 | Caudales BANDAS | Pendiente | La serie puede estar congelada en años anteriores; la columna `CAUDAL` de F01/F05 ya trae caudal puntual en varios muestreos. |
| F16–F18 | Estudios, medidas de mitigación y notas | Pendiente | Prioridad C; se recopilan en `docs/` con una ficha por documento. |

## Reproducibilidad

```
python -I scripts/00_descargar_fuentes.py     # baja los crudos
python -I scripts/10_construir_tablas.py      # crudos -> datos/procesados
python -I scripts/20_analisis_exploratorio.py # procesados -> analisis + hallazgos
```

Dependencias de Python: `openpyxl`, `pyxlsb`, `pypdf` (solo para leer los enlaces del PDF de F01).

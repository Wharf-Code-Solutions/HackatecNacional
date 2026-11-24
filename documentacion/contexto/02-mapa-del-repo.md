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
| `contrato/esquemas/prediccion_propagacion.schema.json` | Predicción aguas abajo | modelos permitidos | sí, con protocolo |
| `contrato/esquemas/reporte_ciudadano.schema.json` | Reporte ciudadano | catálogo de tipos de reporte | sí, con protocolo |
| `contrato/validador.py` | Validador de JSON Schema sin dependencias | — | sí |
| `contrato/servidor_mock.py` | Servidor HTTP con evaluador stub | las rutas de la API | sí |
| `contrato/reproducir_escenario.py` | Envía un escenario a un servidor | — | sí |
| `contrato/fixtures/estaciones.json` | 5 estaciones del piloto | — | **NO** |
| `contrato/fixtures/linea_base.json` | Banda de esas 5 estaciones | — | **NO** |
| `contrato/fixtures/sitios.geojson` | Los 219 sitios para el mapa | — | **NO** |
| `contrato/fixtures/escenarios/*.json` | 5 escenarios de un día | — | **NO** |

Los fixtures los genera `scripts/40_generar_fixtures.py`.

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
| `datos/procesados/analisis/*.csv` | Línea base, ranking, temporada, tendencia, cobertura, correlaciones | `20_analisis_exploratorio.py` | **NO** |

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
| `scripts/20_analisis_exploratorio.py` | Línea base y análisis | `datos/procesados/` | `datos/procesados/analisis/`, `documentacion/09-...` |
| `scripts/30_verificacion_datos.py` | Verifica integridad y emite veredictos | `datos/crudos/`, `datos/procesados/` | `documentacion/08-...` |
| `scripts/40_generar_fixtures.py` | Genera los fixtures del contrato | `datos/procesados/` | `contrato/fixtures/` |
| `scripts/50_verificar_repo.py` | **Revisión de salud del repositorio.** Automatiza nueve comprobaciones de invariantes y sale con código 1 si falla. **Fuente de verdad de los conteos esperados** (`FILAS_ESPERADAS`) | todo | stdout |

**Orden de dependencia:** 00 → 10 → 20 → 30 y 40. El 30 y el 40 dependen del 20 porque
usan la línea base.

---

## `documentacion/`

| Ruta | Qué es | Editable |
|---|---|---|
| `documentacion/README.md` | Índice de las dos secciones | sí |
| `documentacion/01-que-construimos.md` | Problema, solución, **qué existe vs. qué está planeado** | sí |
| `documentacion/02-arquitectura.md` | Cómo encajan las piezas, recorrido de un dato | sí |
| `documentacion/03-tecnologias.md` | Stack con justificación, lo descartado | sí |
| `documentacion/04-fuentes-de-datos.md` | De dónde, cómo y por qué cada fuente | sí |
| `documentacion/05-decisiones-tecnicas.md` | D1 a D16 con justificación y consecuencia | sí |
| `documentacion/06-glosario.md` | Términos del dominio y del proyecto | sí |
| `documentacion/07-plan-recoleccion-datos.md` | Plan original de la Etapa 1 | **histórico** |
| `documentacion/08-verificacion-datos.md` | Estado del conjunto de datos | **NO** (script 30) |
| `documentacion/09-hallazgos-exploratorio.md` | Qué dicen los datos | **NO** (script 20) |
| `documentacion/10-revision-critica-plan.md` | Seis objeciones al plan, con alternativas | sí |
| `documentacion/11-metodologia-modulos.md` | Módulos, criterios de terminado, degradación | sí |
| `documentacion/contexto/**` | Esta carpeta | sí, salvo el registro, que es de solo añadir |

---

## Dónde está la fuente de verdad de cada cosa

Tabla de consulta rápida. Si vas a cambiar uno de estos conceptos, es el único archivo que
debes tocar.

| Concepto | Único lugar donde se define |
|---|---|
| Qué sitios entran al área de estudio | `en_area()` en `scripts/10_construir_tablas.py` |
| Cómo se interpreta un valor censurado | `parse_valor()` en `scripts/_comun.py` |
| Cómo se escribe el nombre de un estado | `normaliza_estado()` en `scripts/_comun.py` |
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
| Criterio de terminado de cada módulo | `documentacion/11-metodologia-modulos.md` |
| Justificación de una decisión | `documentacion/05-decisiones-tecnicas.md` |

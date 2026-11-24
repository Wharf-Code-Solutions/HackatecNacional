# Datos — cuenca del Alto Atoyac

Conjunto de datos base para el Reto SECIHTI Puebla (HackaTec 2026): calidad del agua
superficial del río Atoyac, sus afluentes y barrancas en Puebla y Tlaxcala.

- Plan de la etapa: [`docs/07-plan-recoleccion-datos.md`](../docs/07-plan-recoleccion-datos.md)
- Registro de fuentes: [`bitacora.md`](bitacora.md)
- Hallazgos del análisis: [`docs/09-hallazgos-exploratorio.md`](../docs/09-hallazgos-exploratorio.md)

## Estructura

```
crudos/<ID>/     archivos tal cual se descargaron, uno por fuente (no se editan)
geo/             red hidrográfica INEGI extraída
procesados/      tablas del modelo de datos
procesados/analisis/  salidas del análisis exploratorio
```

`crudos/`, `geo/` y las dos tablas grandes de `procesados/` no se versionan: se
regeneran con los scripts. Todo lo demás sí está en el repositorio.

## Tablas de `procesados/`

| Archivo | Filas | Clave | Qué contiene |
|---|---|---|---|
| `sitio.csv` | 219 | `c_sitio` | Sitios de monitoreo superficial del área de estudio, con coordenadas WGS84, municipio, cuerpo de agua, semáforo CONAGUA 2012–2025 y contaminantes señalados. `c_sitio_aguas_abajo` está vacío hasta ordenar la red hidrográfica. |
| `parametro.csv` | 347 | `c_parametro` | Catálogo de parámetros con unidad, si es medible con sensor en campo (`medible_en_campo`), código corto del plan (`c_parametro_std`) y si pertenece al núcleo analítico. |
| `muestreo.csv` | 145 703 | `c_sitio` + `fecha` + `c_parametro` | Resultados en formato largo, 2012-11-06 a 2025-12-08. Trata los censurados: `bajo_limite_deteccion` + `limite_deteccion` para los `<x`, `censurado_superior` para los `>x`. |
| `muestreo_nucleo.csv` | 74 801 | igual | Subconjunto con los ~38 parámetros del núcleo analítico. Es el que usa el análisis. |
| `umbral.csv` | 146 | `c_parametro` + `c_escala` + `categoria` | Escala de semáforo de CONAGUA (`CONAGUA_SUP`) y límites permisibles de la NOM-001-SEMARNAT-2021 para ríos y para embalses. |
| `indicador_sitio_periodo.csv` | 212 | `clave_sitio` | Fila de indicadores de CONAGUA por sitio para el periodo 2012–2025, con su semáforo y sus contaminantes. |
| `diccionario_conagua.csv` | 48 | `campo` | Diccionario de datos oficial de los indicadores de agua superficial. |

## Criterio de recorte al área de estudio

Un sitio entra si **no** es subterráneo, su estado es Puebla o Tlaxcala y además:

- su cuenca es Alto Atoyac, Río Atoyac, Zahuapan, Alsaseca o Alto Balsas, **o**
- su cuerpo de agua es el Atoyac, el Zahuapan, el Alsaseca, el San Francisco,
  el Xonecuila o la presa Manuel Ávila Camacho (Valsequillo).

La condición de estado es necesaria: hay ríos llamados Atoyac en Oaxaca y Guerrero
que no forman parte de esta cuenca. El criterio vive en `en_area()` de
[`scripts/10_construir_tablas.py`](../scripts/10_construir_tablas.py).

## Reglas de limpieza aplicadas

- `<0.01` → `valor` nulo, `bajo_limite_deteccion` = true, `limite_deteccion` = 0.01.
  En el análisis se usa LD/2 y queda documentado.
- `>24000` → se guarda 24000 y se marca `censurado_superior`.
- `ND`, `S/D`, `-`, `NA` y texto no numérico → nulo.
- Fechas a ISO `AAAA-MM-DD` (los crudos vienen como serial de Excel o como texto).
- Longitudes forzadas a negativas y coordenadas validadas contra la ventana
  17.5–20.5 N, 99.5–97.0 W.
- Nombres de estado unificados: F01 escribe `PUEBLA` y F05 escribe `PUEBLA DE ZARAGOZA`,
  que es el nombre oficial de la capital y no del estado. `normaliza_estado()` de
  `scripts/_comun.py` los canoniza a `PUEBLA` y `TLAXCALA`. Sin eso, agrupar por estado
  partía la cuenca en tres grupos.
- Ante un duplicado `(c_sitio, fecha, c_parametro)` gana la fuente más reciente
  (F05, RENAMECA 2012–2025) y F01 rellena el historial mensual 2012–2018.

## Limitaciones conocidas

- El monitoreo es **periódico, no continuo**: sirve como línea base, no como registro
  en tiempo real.
- La densidad cae mucho entre 2019 y 2024 (de ~10 000 resultados del núcleo por año
  en 2013–2018 a entre 500 y 1 800), y repunta en 2025. Toda tendencia de esos años
  descansa en pocos muestreos.
- 1 de los 219 sitios no tiene ningún resultado asociado en las fuentes descargadas.
- Las fuentes de contexto (REPDA, IDAR, plantas de tratamiento, caudales BANDAS,
  precipitación del SMN) todavía no están incorporadas; ver los pendientes de la bitácora.

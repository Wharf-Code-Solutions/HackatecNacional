# Registro de cambios

Bitácora de cambios relevantes. **Es de solo añadir: no se borran entradas ni se reescribe
el pasado.** Si una decisión se revierte, se anota la reversión como entrada nueva.

Orden inverso: lo más reciente arriba.

El criterio de qué cuenta como relevante está en
[`05-protocolo-de-cambios.md`](05-protocolo-de-cambios.md).

## Formato

```markdown
## AAAA-MM-DD · Título corto

**Qué cambió.** Una o dos frases.
**Por qué.** La razón, con el número si lo hay.
**Qué arrastró.** Archivos y documentos que hubo que actualizar.
**Impacto en otros módulos.** Qué tiene que saber el resto del equipo, o "ninguno".
```

---

## 2026-11-23 · Verificación mecánica del repositorio y normalización de estados

**Qué cambió.** Se creó `scripts/50_verificar_repo.py`, que automatiza nueve
comprobaciones de invariantes y sale con código 1 si alguna falla. En su primera corrida
detectó que `sitio.csv` tenía tres valores de `estado` para dos estados: F01 escribe
`PUEBLA` y F05 escribe `PUEBLA DE ZARAGOZA`. Se agregó `normaliza_estado()` a
`scripts/_comun.py` y se reconstruyeron las tablas.

**Por qué.** Una invariante que no se puede comprobar no es una invariante. Y la variante
de nombre habría roto cualquier agrupación por estado en el mapa, el panel y las
estadísticas, de una forma difícil de notar: los totales simplemente no cuadrarían.

**Qué arrastró.** `scripts/_comun.py`, `scripts/10_construir_tablas.py`, las tablas
procesadas y los fixtures (regenerados), la invariante I6, la decisión D17,
`04-verificacion-obligatoria.md` (que ahora apunta al script en lugar de a comandos de una
línea), `02-mapa-del-repo.md` y las reglas de limpieza de `datos/README.md`.

**Impacto en otros módulos.** La columna `estado` de `sitio.csv` cambió de valor para 7
sitios que venían de F01. Quien filtre por `PUEBLA DE ZARAGOZA` debe cambiar a `PUEBLA`.
Los conteos de filas no cambiaron.

---

## 2026-11-23 · Documentación reorganizada en dos secciones

**Qué cambió.** `docs/` pasó a `documentacion/`, con los cinco documentos existentes
renumerados del 07 al 11 y seis documentos nuevos escritos a mano (01 a 06): qué
construimos, arquitectura, tecnologías, fuentes de datos, decisiones técnicas y glosario.
Se creó `documentacion/contexto/` con siete documentos para agentes de IA y
desarrolladores: este registro, las invariantes, el mapa del repositorio, las fronteras
entre módulos, la verificación obligatoria y el protocolo de cambios.

**Por qué.** El integrante a cargo de la documentación necesita el contexto del prototipo
en un solo lugar, y un agente que vigile el repositorio necesita saber qué no puede romper
antes de modificar algo. Son dos audiencias con necesidades distintas y por eso son dos
secciones separadas.

**Qué arrastró.** Rutas de salida de `scripts/20_analisis_exploratorio.py` y
`scripts/30_verificacion_datos.py`; enlaces en `README.md`, `datos/README.md`,
`datos/bitacora.md` y en los documentos movidos. El plan original (ahora 07) se dejó
intacto como registro histórico, incluidas sus referencias a la vieja carpeta `docs/`.

**Impacto en otros módulos.** Ninguno en código. Quien tenga un enlace guardado a
`docs/...` debe actualizarlo.

---

## 2026-11-23 · Contrato de datos v1.0, fixtures y servidor mock

**Qué cambió.** Se creó `contrato/` con siete esquemas JSON Schema (`lectura`,
`veredicto`, `alerta`, `estacion`, `linea_base`, `prediccion_propagacion`,
`reporte_ciudadano`), un validador sin dependencias, un servidor mock con evaluador stub,
un reproductor de escenarios y fixtures generados con la banda histórica real: 5
estaciones, 25 filas de línea base, 219 sitios en GeoJSON y 5 escenarios de un día
completo.

**Por qué.** Para que ocho módulos puedan avanzar en paralelo sin que nadie espere a
nadie. El esquema `veredicto` no estaba en el plan original y es la frontera más
transitada del sistema: sin él, el motor de reglas y la plataforma no se pueden
desacoplar.

**Qué arrastró.** `scripts/40_generar_fixtures.py` nuevo. `README.md` del repositorio.
`documentacion/11-metodologia-modulos.md`, que se apoya en estas piezas.

**Impacto en otros módulos.** Es la base de todos. Contrato congelado en v1.0 a la espera
de la revisión del equipo. Los 2 016 paquetes de fixtures validan con cero errores.

---

## 2026-11-23 · Medición de la línea base del evaluador stub

**Qué cambió.** Se midió cuántas alertas produce la regla ingenua del plan (salir de la
banda p10–p90 tres lecturas seguidas) en cada escenario, con un servidor limpio por
escenario: 31 en `normal`, 28 en `descarga_organica`, 35 en `descarga_industrial`, 36 en
`lluvia`, 7 en `falla_sensor`.

**Por qué.** 31 alertas en un día sin ningún incidente contra 35 con una descarga
industrial demuestra que la regla ingenua **no discrimina**. Por construcción, el 20 % de
las lecturas normales cae fuera de la banda p10–p90. Esto convierte una opinión de diseño
en un número.

**Qué arrastró.** Tabla en `contrato/README.md`, decisión D10 de
`05-decisiones-tecnicas.md`, criterio de terminado de M2 en
`11-metodologia-modulos.md` y la objeción 4 de `10-revision-critica-plan.md`.

**Impacto en otros módulos.** Es la vara del módulo M2: llegar a dos alertas o menos en
`normal` sin perder el evento en los otros escenarios.

---

## 2026-11-23 · Seis objeciones al plan de etapas 2 a 8

**Qué cambió.** Se escribió `10-revision-critica-plan.md`. Decisiones que se derivan:
el semáforo deja de ser el eje analítico y pasa a ser solo la capa ciudadana (D9); la
desviación de la línea base pasa a ser la regla primaria y el umbral fijo solo gradúa la
gravedad (D10); Streeter-Phelps se reemplaza por transporte advectivo con decaimiento
(D11); no se intenta pronóstico temporal (D12); la NOM-001 se aplica solo a puntos de
descarga (D13).

**Por qué.** Cada una con su número: 176 de 198 sitios en rojo, así que el color no ordena
nada; OD mediano de 1.38 mg/L y caudal en solo el 32.5 % de los muestreos, así que no hay
con qué calibrar Streeter-Phelps; 49 días de mediana entre muestreos, así que no hay serie
de tiempo; y la NOM-001 regula descargas, no cuerpos receptores.

**Qué arrastró.** `05-decisiones-tecnicas.md` (D9 a D13), los esquemas `veredicto`,
`alerta` y `prediccion_propagacion`, que implementan estas decisiones.

**Impacto en otros módulos.** M2 y M3 cambian de enfoque respecto del plan original. M6,
M7 y M8 reciben tres capas de salida en lugar de un solo semáforo.

---

## 2026-11-23 · Verificación del conjunto de datos

**Qué cambió.** Se creó `scripts/30_verificacion_datos.py`, que emite un veredicto por
sección. Resultados: el solapamiento entre F01 y F05 coincide en 99.3 % de los casos (OK);
cero choques de unidades entre fuentes (OK); línea base suficiente en los cinco parámetros
medibles con sensor (OK); caudal en solo 32.5 % de los muestreos (ATENCIÓN); 11 sitios que
en realidad son descargas y no cauce (ATENCIÓN); el semáforo no discrimina (ATENCIÓN); el
modelo de propagación tal como se planteó no se sostiene (BLOQUEANTE); la topología del río
está sin calcular (BLOQUEANTE).

**Por qué.** Antes de declarar concluida la Etapa 1 había que saber si el conjunto de datos
aguanta lo que las etapas siguientes le van a pedir.

**Qué arrastró.** `documentacion/08-verificacion-datos.md`, generado. Refactor de
`scripts/10_construir_tablas.py` para extraer la lógica compartida a `scripts/_comun.py`,
verificado con salida byte a byte idéntica.

**Impacto en otros módulos.** La topología (M1) queda identificada como el verdadero camino
crítico: alimenta a M3, M7 y M8 a la vez.

---

## 2026-11-23 · Etapa 1: conjunto de datos del Alto Atoyac

**Qué cambió.** Se descargaron 17 archivos de CONAGUA e INEGI (138 MB) y se construyeron
las tablas del modelo de datos: 219 sitios, 347 parámetros, 145 703 resultados de
2012-11-06 a 2025-12-08, 146 umbrales entre la escala de CONAGUA y la NOM-001. Más el
análisis exploratorio: línea base por sitio y parámetro, ranking de sitios críticos,
comparación por temporada, tendencia anual, cobertura y correlaciones.

**Por qué.** Es la base de todo el sistema: en un río permanentemente fuera de norma, la
línea base histórica de cada punto es el único mecanismo capaz de detectar un evento nuevo.

**Qué arrastró.** Todo el repositorio: `scripts/`, `datos/`, `datos/bitacora.md`,
`datos/README.md`.

**Impacto en otros módulos.** Tres hallazgos que cambian decisiones de diseño: turbiedad
correlaciona 0.947 con SST y conductividad 0.971 con SDT, lo que permite estimar dos
parámetros de laboratorio desde sensores baratos; la DBO mediana se duplica en estiaje
frente a lluvias; y los metales suben juntos (Cu-Ni 0.885), firma distinta de la de aguas
residuales urbanas.

**Correcciones al inventario de fuentes del plan.** Los archivos de F01 estaban como
anotaciones de hipervínculo dentro del PDF de transparencia, no en su texto.
`datos.conagua.gob.mx` está detrás de Imperva y responde 403 a clientes que no son
navegador; el mismo contenido, más reciente, está en `gob.mx/conagua`. La red hidrográfica
correcta del INEGI es el upc 702825006881, detrás de un buscador con JavaScript. Las
páginas del SMN cargan sus enlaces con JavaScript y las rutas antiguas responden error 500.

---

## Inconsistencias detectadas

Contradicciones entre documentación y código que todavía no se resuelven. El código manda
cuando hay duda, pero la contradicción se anota aquí hasta que alguien la cierre.

*(ninguna por ahora)*

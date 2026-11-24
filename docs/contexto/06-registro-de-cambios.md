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

## 2026-11-24 · M2: motor de reglas, de 31 falsas alarmas a 0

**Qué cambió.** Nuevo módulo `motor/` con `reglas.py` (`evaluar(paquete) → veredicto`),
`prueba.py` (banco de pruebas que mide el criterio de terminado y sale con código 1 si no
se cumple) y su README. `contrato/servidor_mock.py` acepta `--motor real`. Se agregó MAD a
la línea base (`scripts/20` y `scripts/40`).

**Resultado.** Día de control: **0 alertas**, contra 31 del evaluador provisional. Sensor
roto: **0 alertas ambientales** y 19 avisos técnicos. Los tres eventos detectados y su
fuente correctamente clasificada: municipal 0.90, industrial 0.80, arrastre 0.70.

**Las cuatro decisiones que lo lograron.** La salud del sensor se evalúa **primero** y saca
el parámetro de la evaluación ambiental: una turbiedad congelada en 37.5 donde la mediana
histórica es 368 habría parecido un evento enorme. El disparador es el **escalón** contra
las últimas horas, no la banda histórica: estas series están tan sesgadas que la media queda
muy por encima de la mediana y usar el z histórico como disparador daba **35** alertas en el
día de control, peor que la regla ingenua. La ventana de referencia lleva una **brecha de
guarda** de 2 h, porque sin ella una descarga en rampa contamina su propia referencia y el
evento no se detecta. Y se exigen **dos parámetros** coherentes, que es lo que distingue una
descarga de una sonda rota.

**El intercambio, explícito.** El criterio original pedía detección en menos de 45 min. Se
cumple en la industrial (15 min) pero no en la orgánica (75) ni la lluvia (90). Se probaron
cuatro variantes de umbral y persistencia y el tiempo **no cambió en ninguna**: el límite es
la exigencia de coherencia. Quitarla detectaría a los 45 min al precio de confundir sensores
rotos con eventos. Se prefirió no alarmar en falso y el criterio quedó replanteado:
detectar antes de que el evento alcance su intensidad plena, que los tres cumplen.

**El mismo error, dos veces más.** Clasificar la fuente falló primero por puntuar "pH fuera
de 6 a 9" como firma industrial, cuando en estos sitios el pH ya está normalmente bajo 6; y
después por juzgar "conductividad multiplicada" con el z, que depende del ruido de base, de
modo que una subida del 35 % daba z = 8. La lección: **el z sirve para detectar que algo
cambió, no para clasificar qué fue.** Clasificar exige las unidades de la cosa física.

**Qué arrastró.** `README.md`, `CLAUDE.md`, `docs/01`, `docs/12`, `docs/README.md`,
`docs/contexto/02-mapa-del-repo.md`, y los fixtures regenerados con MAD.

**Impacto en otros módulos.** El stub sigue siendo el valor por omisión del servidor a
propósito: es la vara medida y sustituirlo en silencio la borraría. `nivel_esperado` de M3
ya se puede llenar llamando a este motor. `riesgo_por_uso` sigue vacío: necesita los
criterios por uso destinado (F19).

---

## 2026-11-24 · M3: propagacion, y el modelo que los datos rechazaron

**Qué cambió.** Nuevo `scripts/80_propagacion.py`. Dada una alerta, devuelve a qué sitios
aguas abajo llega, en qué ventana horaria y con qué concentración, cumpliendo
`prediccion_propagacion.schema.json`. Escribe `red/atenuacion_observada.csv`,
`red/tiempo_viaje.csv` (5 769 pares), `contrato/fixtures/prediccion_ejemplo.json` y
`docs/14-propagacion.md`.

**Por qué el modelo no es el del plan, ni el que yo mismo había propuesto.** Antes de
escribir una línea se midió la razón entre la concentración aguas abajo y la de aguas
arriba, en tramos adyacentes muestreados **el mismo día**. Resultado: **mediana 1.00 en
los once parámetros, sin tendencia con la distancia** entre 0 y 20 km. No hay atenuación
neta medible: entre dos sitios entran tantas descargas como la autodepuración quita.
Declarar una constante de decaimiento de literatura habría quedado contradicho por 90
mediciones de este mismo río, así que **k = 0 y el transporte es conservativo**.

Es el segundo modelo que los datos descartan, después de Streeter-Phelps. No es un
fracaso: es el río diciendo lo que es.

**Un error de método que hubo que corregir.** La primera medición dio mediana 1.06 y una
k negativa, porque usaba los 6 276 pares de ancestría y contaba el mismo tramo físico
muchas veces. Con una razón por tramo adyacente la mediana cae a 1.00. Y la banda
predictiva se estima con las observaciones individuales, no con las medianas por tramo:
estimarla con medianas la dejaba demasiado angosta y la cobertura caía al 41 % en E_COLI.

**Lo que se descartó.** `ARBSUM_1` como proxy de caudal para calcular dilución: solo
explica el 40 % de la varianza (r = 0.63) en los 33 sitios con caudal medido. Y resultó
innecesario, porque la dilución ya está contenida en la banda medida. `factor_dilucion`
va nulo con su motivo escrito.

**Validación.** Monotonía de los tiempos: 210 de 210 sitios. Cobertura de la banda **fuera
de muestra** (estimada con la mitad de los tramos, medida contra la otra mitad, en las dos
direcciones): 71 a 81 %, **mediana 78 %**, frente al 80 % esperado. Lo que no se validó es
la velocidad del flujo: no hay un solo dato de velocidad ni de tiempo de viaje en la
cuenca. Es el supuesto más fuerte del modelo y se cierra con un aforo de flotador en campo.

**Qué arrastró.** Tres campos **opcionales** nuevos en
`prediccion_propagacion.schema.json` (`valor_estimado_min`, `valor_estimado_max`,
`advertencia`). Es un cambio aditivo, así que por la invariante I7 **no sube la versión del
contrato**. Más `docs/01-que-construimos.md`, `docs/12-estado-y-traspaso.md`,
`docs/README.md`, `docs/contexto/02-mapa-del-repo.md` y `CLAUDE.md`.

**Impacto en otros módulos.** El panel (M7) y el mapa (M6) ya pueden consumir
`prediccion_ejemplo.json` sin esperar a M5. `nivel_esperado` sale en `Sin dato` a
propósito: esa clasificación es de **M2** y escribirla aquí habría duplicado la regla.
Cuando M2 exista, se llena llamándolo.

---

## 2026-11-24 · M1: topologia de la red calculada

**Qué cambió.** Nuevo `scripts/70_topologia_red.py`. Engancha los 219 sitios a la red
hidrográfica del INEGI, orienta los 65 342 tramos hacia la salida de su componente y
calcula, para cada sitio, el siguiente aguas abajo y la distancia **sobre el cauce**.
Escribe `datos/procesados/red/` (cuatro tablas) y `docs/13-topologia-red.md`. Se quitó la
columna vacía `c_sitio_aguas_abajo` de `sitio.csv`.

**Resultado.** 210 de 219 sitios con sucesor, 6 276 pares arriba-abajo, mediana de
distancia al siguiente sitio 1 749 m. Enganche: mediana 11 m, 195 buenos de 219. Validado
por tres vías: los 4 pares que declaran su posición en el nombre coinciden, 204 de 210
pares consecutivos tienen orden de Strahler no decreciente, y la cadena cruza de Tlaxcala
a Puebla en 2 570 pares, que es la relación que importa porque el Zahuapan desagua en el
Atoyac.

**Dos errores que hubo que corregir.** El primero: enraizar cada subcuenca en el nodo más
cercano a su punto de drenaje dejaba sin orientar el 99 % de la red en 4 de las 10
subcuencas, porque la raíz caía en un fragmento suelto de 8 a 30 nodos. Se calculan las 52
componentes conexas y se orienta cada una desde su propio desagüe, identificado como el
nodo de grado 1 cuyo tramo tiene mayor `ARBSUM_1`. Pasó de 42 % a 100 % de tramos
orientados. El segundo: ocho sitios enganchaban a más de 500 m del cauce, uno a 11 km; son
jagüeyes y presas que la red 1:50 000 no conecta con el Atoyac. No se encadenan y quedan
con su motivo escrito, en lugar de inventarles un recorrido.

**Qué queda marcado.** 14 sitios con `revisar = si`: los 8 de enganche lejano y 6 donde el
orden de Strahler baja hacia su sucesor, que es físicamente imposible y apunta a un
enganche en la rama equivocada de una confluencia. Se publican marcados; quien consuma la
tabla puede filtrarlos.

**Qué arrastró.** `scripts/10_construir_tablas.py` (quita la columna),
`scripts/30_verificacion_datos.py` (su sección 10 pasó de BLOQUEANTE a OK y ahora lee la
tabla nueva), `docs/01-que-construimos.md`, `docs/12-estado-y-traspaso.md`,
`docs/README.md`, `docs/contexto/02-mapa-del-repo.md`, `datos/README.md` y `CLAUDE.md`.

**Impacto en otros módulos.** **M3 queda desbloqueada**: ya tiene la secuencia de sitios y
las distancias sobre el cauce que necesitaba. M7 puede responder "qué hay aguas arriba de
este punto" con `sitio_pares.csv`. M8 puede asignar un reporte al tramo correcto con
`sitio_red.csv`. Quien leía `c_sitio_aguas_abajo` de `sitio.csv` debe leer
`red/sitio_aguas_abajo.csv`. `red/tramo.csv` pesa 8.2 MB y no se versiona; las otras tres
tablas suman 0.25 MB y sí, para que nadie necesite bajar la red del INEGI.

## 2026-11-24 · La carpeta `documentacion/` pasa a llamarse `docs/`

**Qué cambió.** Renombrada con `git mv`, conservando el historial. Se actualizaron las 90
referencias a la ruta en 17 archivos, incluidas las rutas de salida de
`scripts/20_analisis_exploratorio.py` y `scripts/30_verificacion_datos.py`, y `CLAUDE.md`.
La estructura interna no cambió: siguen las dos secciones, con `contexto/` dentro.

**Por qué.** Lo pidió el usuario. `docs` es la convención que GitHub reconoce y es más
corta de escribir en los enlaces.

**Qué arrastró.** `CLAUDE.md`, `README.md`, `datos/README.md`, `datos/bitacora.md`,
`dispositivo/README.md`, los nueve documentos de `docs/` que se referenciaban entre sí,
y los tres scripts que mencionaban la ruta. Los dos documentos generados (`08-` y `09-`)
se regeneraron en la ruta nueva.

**Nota.** La entrada del 2026-11-23 dice que `docs/` pasó a `documentacion/`. Queda como
está: el registro es de solo añadir y el cambio de ida y de vuelta forma parte del
historial.

**Impacto en otros módulos.** Cualquier enlace o ruta guardada a `documentacion/...` hay
que cambiarla por `docs/...`. Ningún cambio de código ni de datos.

---

## 2026-11-24 · Documento de estado y traspaso

**Qué cambió.** Nuevo `docs/12-estado-y-traspaso.md`: estado por módulo, lo que puede
tomarse hoy sin esperar a nadie (M2, M1, M5, M10) con sus entradas, su criterio y cómo probar, y lo
que sigue siendo supuesto.
**Por qué.** Que un compañero pueda avanzar en otro módulo sin reconstruir el contexto.
**Qué arrastró.** `docs/README.md` (índice y ficha del dispositivo ya no pendiente),
`contexto/02-mapa-del-repo.md`, `contexto/00-LEEME-PRIMERO.md` (qué está construido),
`11-metodologia-modulos.md` (M4 y M6 hechos), `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

## 2026-11-24 · Fondo de relieve en el mapa y componentes en la figura del simulador

**Qué cambió.** El mapa usa como fondo el relieve sombreado de Esri con los nombres de lugares encima, en lugar
de OpenStreetMap. En la figura del simulador, la caja "Estación" muestra sus tres componentes en renglones
separados por filetes: controlador (ESP32, reloj y SD: estado y paquetes en la SD), comunicación (módem
LTE-M: señal en dBm o "sin red") y energía (panel 5 W y 2 × 18650: batería y potencia solar), más un panel
solar y una antena dibujados en línea fina que solo cambian con el dato.

**Por qué.** El fondo de OpenStreetMap, aun en gris, tenía calles, manchas urbanas y ríos propios que
competían con la red del INEGI. En la figura, el usuario prefería ver los componentes descritos, dentro de
la misma figura y sin ruido.

**Qué arrastró.** `mapa/mapa.js`, `mapa/estilos.css`, `mapa/index.html`, `mapa/README.md`,
`dispositivo/simulador/escena.js`, `dispositivo/simulador/index.html` (`aria-label`),
`dispositivo/README.md`, `docs/03-tecnologias.md`, `CLAUDE.md`.

**Impacto en otros módulos.** Ninguno: no cambia el contrato ni los datos.

## 2026-11-24 · Simulador reducido a lo esencial

**Qué cambió.** La pantalla del simulador muestra ahora solo tres cosas: qué mide la estación, qué
análisis devuelve la plataforma y si hay alarma. Una figura (sonda en el río → estación →
plataforma), una tabla de cinco filas (valor, rango habitual del sitio con su `n` y su fecha, y el
análisis) y la franja de pruebas. El principio de medición de cada sonda queda plegado en su fila,
y las fallas de sonda, el mantenimiento, el clima, la dirección del backend y el último paquete
están en un bloque plegado. Se quitaron la gráfica, el registro del firmware, la barra de fases y
las ilustraciones por sonda.

**Por qué.** Las vistas existen para mostrar el funcionamiento del dispositivo mientras no hay
prototipo físico. Lo que hay que ver es qué analiza el sensor y si se envía una alarma, no la
documentación del dispositivo, que ya está en `dispositivo/ficha-tecnica.md`.

**Qué arrastró.** `dispositivo/simulador/` (`index.html`, `estilos.css`, `escena.js`, `ui.js`) y
dos filas de documentación. El análisis y la alarma que se muestran son la respuesta de
`POST /lecturas` (`veredictos[].parametros[].posicion_en_banda` y `veredictos[].alertas`); la pantalla
no calcula nada por su cuenta, de modo que cuando M2 sustituya al evaluador provisional se verá
su resultado sin tocar la interfaz.

**Impacto en otros módulos.** Ninguno. Sin el backend conectado, la plataforma aparece como
"sin conexión" y la tabla no muestra análisis.

---

## 2026-11-24 · Rediseño visual del mapa y del simulador

**Qué cambió.** El mapa y el simulador del dispositivo se rehicieron con otro criterio visual: tema
claro, un azul para el agua y tinta para las estaciones, trazo fino, filetes en lugar de tarjetas y
sin brillos ni animaciones decorativas. El mapa pasó a una barra lateral plana que hace de índice
y de leyenda (la lista de las 5 estaciones), con los sitios del monitoreo oficial en gris. El
simulador pasó a una lámina técnica de la instalación con rótulos y a una tabla de medición por
sonda; la barra de fases tiene el ancho proporcional a la duración real de cada fase.

**Por qué.** Los puntos del mapa no se entendían: 176 de 198 sitios con dato están en rojo, así
que pintarlos por semáforo (decisión D9) producía una nube roja sin información, y las
estaciones no se distinguían de ellos. Las pantallas anteriores usaban recursos de diseño
genérico (paneles translúcidos, resplandores, rótulos en mayúsculas espaciadas, tarjetas
idénticas, numerales encerrados) que no aportaban nada.

**Qué arrastró.** Solo `mapa/` y `dispositivo/simulador/` (`index.html`, `estilos.css`,
`escena.js`, `ui.js`, `mapa.js`). Sin cambios en el contrato ni en los datos.

**Impacto en otros módulos.** Ninguno. M6, M7 y M8 pueden tomar los criterios como referencia.

---

## 2026-11-23 · Mapa de la cuenca y red hidrográfica para pintar

**Qué cambió.** Se descargó la red hidrográfica del INEGI (F08, 36.8 MB, con
`scripts/00_descargar_fuentes.py F08`) y se extrajo a `datos/geo/`. Nuevo
`scripts/60_red_para_mapa.py`, que genera `datos/procesados/mapa/` con 8 184 tramos de orden ≥ 4,
las 10 subcuencas (con a cuál drena cada una) y los nombres de ríos, barrancas y presas. Nueva
carpeta `mapa/`: mapa con Leaflet, los 219 sitios, las 5 estaciones y zoom animado que abre el
simulador de la estación. El simulador acepta ahora parámetros de URL (`estacion`, `incrustado`,
`vel`, `backend`) y se rediseñó su vista: corte de la estación en el río y tarjetas con el
principio de medición de cada sonda.

**Por qué.** El mecanismo debe mostrarse dentro del mapa de la cuenca. La geometría oficial del
INEGI es la fuente que el proyecto ya había elegido (F08) y la que M1 necesita igual. Los
datos traen `ORDER_1` y el acumulado aguas arriba por tramo, útiles para el orden de los sitios.

**Qué arrastró.** `01-que-construimos.md`, `03-tecnologias.md` (Leaflet y OSM en uso; teselas de
CARTO descartadas porque ahora exigen llave), `02-mapa-del-repo.md`, `README.md`.

**Impacto en otros módulos.** M1: el shapefile ya está extraído y `60_red_para_mapa.py` incluye un
lector de shapefile y dbf sin dependencias que puede reutilizar (no calcula topología). M6: hay un
prototipo de mapa; el definitivo puede partir de él. El mapa necesita internet solo para el fondo.

---

## 2026-11-23 · Simulador web del dispositivo (M4) y ficha técnica

**Qué cambió.** Se creó `dispositivo/` con el simulador de la estación centinela: modelo del
agua (con la banda histórica real de cada sitio), sondas con sesgo, deriva, ensuciamiento,
saturación y fallas, energía solar y enlace celular, y un firmware como máquina de estados
pura (dormir, medir, guardar en SD, enviar, reintentar, muestreo adaptativo, ahorro por
batería). Incluye una interfaz web que anima los cuatro bloques (sondas, controlador,
comunicación, energía), una prueba en Node y la ficha técnica.

**Por qué.** El mecanismo debe demostrarse dentro de una interfaz web propia que después se
comunique con los demás módulos, y no exigir comprar hardware antes de validar el diseño
(D18). Resultados medidos: 96 paquetes por día y estación; 0 pérdidas ni duplicados en un
corte de red de 4 h; 486 paquetes validan con cero errores contra `lectura.schema.json`;
`POST /lecturas` responde 202; consumo ≈ 1.4 Wh/día y autonomía sin sol ≈ 14 días.

**Qué arrastró.** `05-decisiones-tecnicas.md` (D18), `03-tecnologias.md` (Wokwi descartado,
JavaScript plano y Node en uso), `01-que-construimos.md` y `02-arquitectura.md` (estado de M4),
`11-metodologia-modulos.md` (menciones a Wokwi), `02-mapa-del-repo.md` y `README.md`.

**Impacto en otros módulos.** Ninguno en el contrato: el simulador no lo toca. M5, M6 y M7
tienen ahora un emisor de lecturas con ciclo, retardo y cola realistas, además de
`reproducir_escenario.py`. Los números de energía son del modelo, no medidos en banco, y la
estimación a mano de la conversación de diseño (1.1 Wh/día, 19 días) queda corregida.

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

**Qué cambió.** `docs/` pasó a `docs/`, con los cinco documentos existentes
renumerados del 07 al 11 y seis documentos nuevos escritos a mano (01 a 06): qué
construimos, arquitectura, tecnologías, fuentes de datos, decisiones técnicas y glosario.
Se creó `docs/contexto/` con siete documentos para agentes de IA y
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
`docs/11-metodologia-modulos.md`, que se apoya en estas piezas.

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

**Qué arrastró.** `docs/08-verificacion-datos.md`, generado. Refactor de
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

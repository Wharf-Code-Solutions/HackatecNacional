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

## 2026-11-24 · M7: el panel toma el aspecto de la app ciudadana y deja de amontonar consultas

**Qué cambió.** El panel deja la hoja del SND y usa el aspecto de la app ciudadana (kit gob.mx v3 como SIGRIV):
barra verde oscuro con el logotipo y las dos secciones a la derecha (en teléfono, «Monitoreo» y «Reportes»),
Montserrat en títulos y Noto Sans en el texto, guinda, dorado y fondo cálido, tarjetas redondeadas, pie verde.
La consulta al backend sale 3 s después de que termina la anterior, no cada 3 s fijos, y se pausa con la pestaña
oculta.
**Por qué.** El usuario pidió que el panel se vea como la app ciudadana. Al probarlo contra producción, el panel
se quedaba en «Comprobando conexión»: con `setInterval`, las 10 peticiones de cada vuelta se amontonaban y cada
respuesta tardaba ~36 s. Ahora la mediana es 1.5 s y el máximo 2.2 s (30 peticiones en 20 s).
**Qué arrastró.** D31 (revisada), `CLAUDE.md`, `panel/README.md`. Las clases del SND (`mensajeInformativo`,
`boton__primario`, `h0b`, `b1`) pasan a clases propias.
**Impacto en otros módulos.** Ninguno en datos. Quien lleva M7: el panel ya no carga `snd-guinda.css` y muestra
el logotipo oficial, que D31 evitaba; el pie sigue diciendo que es un prototipo.

---

## 2026-11-24 · M8: ríos del INEGI en el mapa de la app ciudadana, botón «Ríos» y carga sin esperas en cadena

**Qué cambió.** La app dibuja encima de la base los ríos de orden ≥ 4 (los de `mapa/`, compactados al compilar en
`rios.json`) y, desde zoom 12, los cauces de orden 3 (`rios_orden3.json`, nuevo, de `61_rios_menores_para_app.py`).
El flujo animado aguas abajo solo corre desde zoom 14. Botón «Ríos» para ocultarlos (recordado por navegador); los
cauces de la base se apagan mientras se ven los nuestros. Se ocultan los rótulos de comercios, transporte, números
de casa y aeropuertos de la base. Se quita `maxBounds`. La biblioteca del mapa se importa fija (alias
`biblioteca-mapa` en `vite.config.js`), con precarga, y los ríos se piden al terminar de dibujarse la base.
**Por qué.** En la base el cauce se pierde y la persona tiene que poner el pin sobre él. Con `maxBounds` a 0.5° de
la ventana, a zoom ≤ 8 el mapa no se dejaba arrastrar (a zoom 7 se movía 0 y saltaba a 7.68). En producción el
mapa tardaba ~7.5 s con una red irregular: la biblioteca se pedía hasta que la app ya había llegado y arrancado
(~1.3 s más en cadena), y los reportes y la huella se pedían dos veces al abrir. Medido en local: con y sin ríos,
60 cuadros por segundo al mover y sin bloqueos; por debajo de zoom 14 el mapa no redibuja nada.
**Qué arrastró.** `02-mapa-del-repo.md`, `CLAUDE.md`. Pesos: 215 KB comprimidos al abrir y ~240 KB más al acercar.
**Impacto en otros módulos.** Ninguno. `rios_orden3.json` sale de la red completa del INEGI (`datos/geo/`, no
versionada): si cambia el criterio, se regenera con el script, no se edita.

---

## 2026-11-24 · M7: la huella muestra una sola estación

**Qué cambió.** "Huella de las últimas horas" muestra una estación con una fila grande y separada por sonda,
con un selector propio. Sigue a la estación elegida en el mapa, la tabla o el filtro; sin elección, la
primera con alerta por atender. El selector no filtra la lista de alertas.
**Por qué.** Petición del usuario: las 5 estaciones juntas daban celdas diminutas y se leía raro.
**Qué arrastró.** `Huella.jsx`, `Panorama.jsx`, `App.jsx` (pasa `elegida`), `estilos.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: en el expediente se elige la sonda que se grafica

**Qué cambió.** Un clic en cualquier miniatura de "Todas las sondas de la estación" la muestra en la serie
grande de "Evidencia", con la banda de su sitio. Empieza en la sonda de la alerta y vuelve a ella al cambiar
de alerta; regla, criterio y respaldo solo se muestran para esa sonda.
**Por qué.** Petición del usuario: ver la serie de cualquier parámetro de la estación, no solo el alterado.
**Qué arrastró.** `Expediente.jsx`, `Serie.jsx` (prop `parametro`), `Miniaturas.jsx` (`elegido`, `onElegir`),
`estilos.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: el mapa vuelve a la mitad, junto al estado de las estaciones

**Qué cambió.** Corrige el orden de la entrada "orden de la vista de alertas": resumen; mapa y "Cómo están
las estaciones ahora" lado a lado; tabla de estaciones a todo el ancho; alertas con expediente; y al final
las gráficas (huella, por hora, por estación, por parámetro, avance).
**Por qué.** Al usuario no le gustó el mapa a todo el ancho; prefiere el arreglo original con la tabla y las
alertas antes de las gráficas.
**Qué arrastró.** Nada más.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el mapa con las estaciones se publica en /mapa/

**Qué cambió.** `panel/scripts/ensamblar-sitio.mjs` publica también el mapa: `mapa/` en `/mapa/`, sus capas
en `/datos/procesados/mapa/` y `sitios.geojson` con los fixtures. Su `config.js` se escribe al armar el sitio
desde la variable `MAPBOX_ACCESS_TOKEN` de Vercel (sin ella, MapLibre con OpenFreeMap). Desplegado, el mapa
lee las alertas de `/api` del mismo dominio y se lo pasa al simulador que abre, como ya hacía el simulador.
**Por qué.** El despliegue publicaba solo el simulador de una estación; faltaba el mapa desde el que se elige.
Probado armando el sitio en local y sirviéndolo: todas las capas responden 200 y al elegir una estación se
abre su simulador.
**Qué arrastró.** `mapa/mapa.js?v=21`, `backend/README.md`, D25, `02-mapa-del-repo.md`, `CLAUDE.md`.
**Impacto en otros módulos.** M7: ninguno en código; el sitio armado ahora incluye `/mapa/`.

---

## 2026-11-24 · Integración: simulador, backend, app y panel sincronizados y en un solo despliegue

**Qué cambió.** (1) El reloj del simulador arranca en la hora real cuando hay backend, o justo después de la
última lectura guardada; sin backend sigue desde `T0_DEFECTO`. (2) En la prioridad (D30), una alerta cuenta
como «mismo punto» si su sitio está a menos de 1 km sobre el cauce del sitio del reporte (`MISMO_PUNTO_CAUCE_M`).
(3) `vercel.json` compila también la app ciudadana y publica el simulador (`panel/scripts/ensamblar-sitio.mjs`),
todos contra `/api`; el simulador desplegado usa `/api` del mismo dominio. (4) `includeFiles` pasa a `contrato/*.py`.
(5) `backend/servidor.py --limpiar` revisa el puerto antes de borrar la base.
**Por qué.** (1) El simulador fechaba siempre el 2026-11-23 y los reportes llevan la hora real: la prioridad
solo los cruza a menos de 24 h, así que nunca se cruzaban; y cada recarga mandaba lecturas al pasado que se
mezclaban en el motor. (2) Un reporte en la estación ATY-01 se asigna a DLTLA0279RNL, 167 m aguas abajo de
DLTLA2554, y no recibía el bono de su propia alerta; ahora recibe +3 (prioridad 4 → 7). (4) Desde M8 el backend
carga `analisis_foto.py` y `prioridad_huella.py` al arrancar y la función de Vercel no los llevaba.
(5) Con el puerto ocupado borraba la base y luego no arrancaba.
**Qué arrastró.** `backend/README.md`, `02-mapa-del-repo.md`, D25 (ampliada), `17-plan-app-ciudadana.md`,
`12-estado-y-traspaso.md`, `CLAUDE.md`. Probado de punta a punta con el backend real y con una copia que solo
lleva lo que `includeFiles` incluye, servida en un origen como en Vercel. `vercel.json` es de quien lleva M5/M7:
el cambio lo pidió el usuario.
**Impacto en otros módulos.** Desplegado, quien abra el simulador escribe en la base real; dos simuladores a la
vez cruzan lecturas de las mismas estaciones. A 900× el reloj se adelanta unas 17 h por minuto: pasadas 24 h
simuladas, un reporte nuevo ya no se cruza con la alerta. `VITE_API_URL` ya no se configura en Vercel.

---

## 2026-11-24 · M4: la trayectoria del envío queda dibujada en la vista de comunicación

**Qué cambió.** Al abrir la vista de comunicación (antena o torre), la línea punteada de la antena a la
torre se queda visible todo el tiempo, no solo mientras un paquete viaja; se pone roja si el sitio no
tiene cobertura. En la vista general sigue apareciendo solo durante el envío.
**Por qué.** Lo pidió el usuario: entre envíos no se veía por dónde viajan los datos.
**Qué arrastró.** `escena.js?v=33`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: estados en palabras llanas, envío visible en comunicación y líneas sin cruzar rótulos

**Qué cambió.** Los estados se dicen sin jerga del firmware: "En reposo hasta las 10:30" en lugar de
"Dormido", "Preparando las sondas", "Enviando los datos", "Datos recibidos", "Esperando la próxima
medición". La vista de comunicación ya no frena el enlace y el envío a tiempo real: a la velocidad elegida
cada envío se dibuja completo y se repite a los pocos segundos. En las vistas de cerca, un rótulo que no
cabe afuera de su pieza (antena y torre, en los bordes) va junto a ella del lado de adentro, y su línea ya
no lo atraviesa.
**Por qué.** El usuario encontró los estados poco claros, el paquete aparecía pocas veces en la vista de
comunicación y las líneas de los rótulos de los extremos los cruzaban.
**Qué arrastró.** `escena.js?v=32`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: rótulos legibles y vistas de cerca del gabinete, la energía y la comunicación

**Qué cambió.** Los rótulos de la figura 3D son tinta con contorno blanco grueso (sin fondo) y la vista
general queda con cinco cortos: Sondas, Gabinete, Energía, Comunicación y Corriente, con su dato vivo.
Como las sondas, el gabinete, la energía y la comunicación tienen vista de cerca con un rótulo por pieza
(qué es y su estado). En cada vista van a tiempo real las fases que muestra (`Escena.tiempoReal`, que
usa `ui.js`).
**Por qué.** Los textos se perdían contra la vegetación, había especificaciones repetidas en la vista
general y el usuario pidió ver cada componente de cerca. Pidió explícitamente no usar fondo blanco.
**Qué arrastró.** `escena.js?v=30`, `ui.js?v=9`, `estilos.css?v=9`, D19, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno: la lógica del firmware y los paquetes no cambian.

---

## 2026-11-24 · M7: orden de la vista de alertas

**Qué cambió.** La vista de alertas del panel va en este orden: resumen, mapa de la red a todo el ancho,
lista de alertas con expediente, tabla y estado de las estaciones (matriz y huella) y al final los
conteos (por hora, por estación, por parámetro y avance). `Panorama.jsx` recibe `parte`.
**Por qué.** Petición del usuario: el mapa filtra la lista de alertas y estaban separados por cinco
gráficas; ahora cada bloque colinda con lo que tiene que ver.
**Qué arrastró.** Nada más.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: sin sitios de CONAGUA en el mapa de la red de estaciones

**Qué cambió.** `panel/src/graficas/MapaEstaciones.jsx` ya no dibuja los 219 sitios oficiales en gris
ni su ventana al pasar el cursor; tampoco descarga `sitios.geojson` ni los acredita.
**Por qué.** Petición del usuario: eran ruido visual sin información (D9) en una vista que solo debe
mostrar la red de estaciones.
**Qué arrastró.** Nada más.
**Impacto en otros módulos.** Ninguno; `mapa/` (M6) sigue mostrando sus sitios.

---

## 2026-11-24 · M6: el flujo se anima con una imagen de patrón, no con line-dasharray

**Qué cambió.** El flujo es un `line-pattern` con un guion blanco sobre fondo transparente; la imagen
(128 × 16 px) se redibuja en cada cuadro corrida unos píxeles (`StyleImageInterface.render`). Antes se
cambiaba `line-dasharray` cada 70 ms.
**Por qué.** Con el flujo en los 8 184 tramos, cambiar `line-dasharray` obliga a Mapbox GL 3 a rehacer los
teselados de toda la red en cada paso: el usuario vio el mapa lento y ríos que desaparecían al desplazarlo.
Subir una imagen pequeña a la tarjeta gráfica no toca la geometría.
**Qué arrastró.** `mapa.js?v=20`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el flujo en todos los ríos, con casilla para apagarlo

**Qué cambió.** Los guiones blancos del flujo corren en todos los ríos del mapa (y en los tramos que
conectan una estación con la red), no solo en los vigilados. Una casilla "Flujo del agua" en la barra
lateral lo enciende y apaga; al apagarlo se detiene también la animación.
**Por qué.** Lo pidió el usuario. Consecuencia: el mapa ya no distingue a simple vista qué tramos vigila
cada estación; eso sigue en `red_vigilada.geojson` y en docs/18.
**Qué arrastró.** `mapa.js?v=19`, `index.html`, `estilos.css?v=10`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el flujo vuelve a ser de guiones blancos

**Qué cambió.** Se quitan los puntos del flujo y vuelven los guiones blancos animados, ahora del mismo
grosor que el río (los ríos vigilados ya no son más anchos) y en el sentido corregido, aguas abajo.
**Por qué.** Al usuario no le gustaron los círculos; las líneas anteriores estaban bien.
**Qué arrastró.** `mapa.js?v=18`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: un solo estilo para los ríos, flujo blanco, cursor visible y base sin calles

**Qué cambió.** Todos los ríos con el mismo azul y un grosor que crece poco con el orden (de 0.85 a 1.6
veces); los tramos vigilados ya no son más anchos: se distinguen solo por el flujo, ahora puntos blancos
con borde azul. Se quitan las subcuencas (línea discontinua) y, de la base, las líneas de calles,
carreteras y vías; las fronteras estatales quedan en gris muy claro. El cursor sobre el mapa es una flecha
en tinta con borde blanco.
**Por qué.** El usuario veía cuatro tipos de línea mezclados (ríos de distinto color y grosor, flujo,
líneas de la base) y el cursor blanco del sistema se perdía sobre la base clara.
**Qué arrastró.** `mapa.js?v=17`, `estilos.css?v=9`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el flujo del mapa con puntos y el simulador se carga después del desplazamiento

**Qué cambió.** El trazo discontinuo se cambia por puntos azul oscuro con borde blanco, uno cada 2.2 km
de tramo vigilado, que avanzan del inicio al final de cada línea a 900 m de mapa por segundo (se
recalculan unas 30 veces por segundo). El sentido se comprobó con los datos: en 195 de 245 tramos de
`red_asignacion.json` la línea termina junto a su sitio aguas abajo. Al elegir una estación, el
simulador se carga cuando el mapa termina de desplazarse (o a los 0.9 s).
**Por qué.** El usuario no veía el trazo y notaba una pausa al hacer clic: el simulador arma su escena
3D en el mismo hilo que el mapa y lo detenía a mitad del desplazamiento.
**Qué arrastró.** `mapa.js?v=16`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: flujo en el sentido correcto, trazo visible, selección fluida y sin capas opcionales

**Qué cambió.** La animación del flujo se recorre al revés: el usuario vio que iba contra la corriente.
El trazo pasa de blanco a azul oscuro (#0b2e4a), más ancho, sobre tramos vigilados más anchos. Al elegir
una estación el diseño cambia de golpe (se quitó la transición de 0.22 s, que redibujaba el mapa en cada
paso) y el mapa se desliza en 0.6 s con `easeTo` en lugar del `flyTo` de 1.1 s. Se quitan las capas
opcionales: satélite, relieve y los 219 sitios oficiales. `96_red_estaciones.py` agrega a
`red_vigilada.geojson` los tramos que desembocan en cada estación a 3 km o menos: el Alseseca en
Totimehuacán es de orden 2 y la estación quedaba lejos de cualquier río dibujado.
**Por qué.** Lo pidió el usuario para dar claridad al mapa: una sola cosa a la vista.
**Qué arrastró.** `mapa.js?v=14`, `index.html`, `estilos.css?v=8`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno. La decisión D21 (satélite de Esri) queda sin uso en el mapa.

---

## 2026-11-24 · M6: los ríos vuelven a su estilo y el flujo se anima en los tramos vigilados

**Qué cambió.** Se quita el azul tenue de la red: todos los ríos vuelven a su azul de siempre. Los tramos
vigilados van un poco más anchos y con un trazo blanco discontinuo que avanza aguas abajo hacia la
estación (patrón de guiones que cambia cada 70 ms). Las líneas del INEGI están trazadas en el sentido
del flujo: en 321 nodos terminan dos o más líneas y en ninguno empiezan dos. Con
`prefers-reduced-motion` no se anima.
**Por qué.** Al usuario no le gustó el difuminado y pidió ver el flujo de los ríos en el mapa: el
movimiento dice qué agua llega a cada estación sin leyenda.
**Qué arrastró.** `mapa.js?v=12`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el mapa abre en la zona de la red y resalta lo que vigila cada estación

**Qué cambió.** El encuadre inicial (y al cerrar una estación) es la zona de la red: tramos vigilados,
estaciones y la presa de Valsequillo, en lugar de toda la cuenca. La red de ríos va en azul tenue y,
encima, en el azul del agua y más gruesos, los 305 tramos del mapa que vigila alguna estación a 20 km
aguas arriba. `96_red_estaciones.py` los calcula y escribe `datos/procesados/mapa/red_vigilada.geojson`
(84 KB): un tramo del mapa es vigilado si su vértice central cae a menos de ~120 m de un tramo de
`red_asignacion.json` que llega a una estación.
**Por qué.** Con la cuenca completa (31 480 km²) las 5 estaciones quedaban amontonadas en una esquina y
parecía que casi nada estaba vigilado; el usuario lo notó. El contraste dice qué cubre la red y qué no.
**Qué arrastró.** `mapa.js?v=11`, `mapa/README.md`, `02-mapa-del-repo.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: el mapa de la red de estaciones es el mismo que el de mapa/

**Qué cambió.** "La red de estaciones" del panel deja el SVG dibujado y usa el mapa del módulo M6:
MapLibre con la base positron de OpenFreeMap (sus ríos y rótulos de calles apagados), las mismas
capas del INEGI (máscara y contorno de la cuenca, subcuencas, red hidrográfica por orden, nombres de
ríos, confluencias), los 219 sitios de CONAGUA y el mismo marcador de estación (negro, rojo con una
alerta por atender). Nuevo `panel/src/graficas/MapaEstaciones.jsx`; `scripts/copiar-datos.mjs` copia
las capas de `datos/procesados/mapa/`. No importa código de `mapa/`: lee los mismos archivos.

**Diferencias con mapa/.** Un clic en una estación filtra la lista de alertas del panel (en mapa/
abre el simulador). Encuadra las 5 estaciones, no toda la cuenca. El zoom con la rueda pide Ctrl,
para no secuestrar el desplazamiento de la página.

**Por qué.** El equipo pidió el mismo mapa que el módulo del mapa en lugar de uno dibujado.

**Verificación.** Escritorio, 375 px sin desborde y modo demostración sin llamadas al backend; el
clic en la estación 2 filtró la lista (0 de 5 alertas) y la marcó como elegida.

**Pendiente.** El mapa de la pluma ("Hasta dónde llega") sigue en SVG (`MapaRed.jsx`).

---

## 2026-11-24 · M7: plantilla del SND y más gráficas en el panel

**Qué cambió.** El panel enlaza la hoja de estilos del Sistema Nacional de Diseño, tema guinda (D31):
títulos en Patria, Noto Sans, botón primario y mensajes informativos del SND, encabezado y pie propios
en guinda (el pie dice que es un prototipo). Tres gráficas nuevas: mapa de la red (ríos de orden ≥ 5
del INEGI, los 219 sitios de CONAGUA y las 5 estaciones con su alerta más grave abierta), huella de las
últimas horas (cada sonda de cada estación por lectura, coloreada por el z robusto del motor en 7
pasos con los cortes del motor, 2, 3.5 y 6) y mapa de la pluma en "Hasta dónde llega" (sitios aguas
abajo por hora de llegada). "Fuente probable" va a todo lo ancho para la tabla de candidatos del DENUE.
`scripts/copiar-datos.mjs` copia `sitios.geojson` y recorta la red hidrográfica a `rios.json` (1 030
tramos, 134 kB). La foto de demostración se recapturó con las estaciones nuevas (D27), los candidatos
del DENUE, las predicciones y las prioridades de reportes.

**Por qué.** El equipo pidió la plantilla del gobierno y un tablero más visual.

**Verificación.** Escritorio y 375 px sin desborde; modo demostración sin llamadas al backend, con las
dos secciones (monitoreo y reportes); los colores nuevos pasan el validador de paletas (los dos brazos
de la escala divergente y la pluma como escalas ordinales). Al integrar se combinó con la división del
panel en dos secciones: sus pestañas quedan en la barra guinda.

**Qué arrastró.** D31, `panel/README.md`, `02-mapa-del-repo.md`, `03-tecnologias.md`.

---

## 2026-11-24 · M7: el panel se divide en monitoreo y gestión de reportes ciudadanos

**Qué cambió.** El panel de autoridad tiene dos secciones. «Monitoreo del prototipo» conserva las alertas y los avisos
técnicos. «Reportes ciudadanos» pasa de una tabla de lectura a gestión: mapa con la huella de calor y un pin por foco
(MapLibre, se descarga al abrir la sección), tabla de «Qué atender» con el desglose de la prioridad, fotos y selector
de estado por foco y por reporte. Nueva ruta `PATCH /reportes/<c_reporte>` (solo `estado`) en el mock y el backend
(D30). El mock ya no deja que dos instancias compartan el puerto en Windows.
**Por qué.** El usuario pidió separar lo que mide el prototipo de lo que gestiona la autoridad con los reportes de las
personas; sin poder cambiar el estado, la autoridad no podía atender nada.
**Qué arrastró.** `contrato/README.md` (ruta), `02-mapa-del-repo.md`, `CLAUDE.md`, `12-estado-y-traspaso.md`, D30,
`backend/prueba.py` (5 comprobaciones), `panel/package.json` (maplibre-gl 4.7.1).
**Impacto en otros módulos.** El panel lee `/prioridades` y `/huella` si existen y sigue funcionando sin ellas. En
Vercel, el panel necesita internet para la base del mapa. Sin inicio de sesión: cualquiera con la URL cambia estados.

## 2026-11-24 · M8: huella de calor y prioridad de reportes; el panel muestra qué atender primero

**Qué cambió.** `contrato/prioridad_huella.py` y las rutas `GET /huella` y `GET /prioridades` en el mock y el
backend. La app ciudadana pinta la huella sobre el río; el panel de autoridad muestra «Qué atender primero»
con el desglose de cada prioridad (D30).
**Por qué.** El usuario pidió definir la huella por densidad de reportes y la prioridad con todo lo que tiene
el proyecto. Pesos y umbrales son hipótesis sin datos reales.
**Qué arrastró.** `contrato/README.md` (rutas), `02-mapa-del-repo.md`, `05-decisiones-tecnicas.md` (D30),
`50_verificar_repo.py` (los módulos del propio contrato no cuentan como dependencia externa), `panel/`.
**Impacto en otros módulos.** El panel lee `/prioridades` si existe y sigue funcionando sin ella.
**Vercel.** `prioridad_huella.py` debe entrar en `includeFiles` de `vercel.json`.

## 2026-11-24 · M8: la foto de un reporte se valida con Gemini

**Qué cambió.** `POST /reportes/analizar-foto` (`contrato/analisis_foto.py`) en el mock y el backend. La app no
deja enviar una foto que no corresponda a ninguno de los 6 tipos; si falla el servicio, avisa y deja enviar
(D29). Los términos pasan a v2: la foto reducida va a Google.
**Por qué.** Evitar datos basura. `gemini-2.5-flash` ya responde 404 a cuentas nuevas: cadena de modelos.
**Qué arrastró.** `contrato/README.md`, `02-mapa-del-repo.md`, `03-tecnologias.md`, D29.
**Impacto en otros módulos.** Variable `GEMINI_API_KEY` en el `.env` local y en Vercel; `analisis_foto.py` en
`includeFiles` de `vercel.json`. Precisión con fotos reales sin medir.

## 2026-11-24 · M8: app ciudadana, prototipo con el flujo de SIGRIV

**Qué cambió.** Nueva carpeta `ciudadano/`: PWA en React y Vite con mapa y pin central, reporte con cámara o
galería, folio, rastreo, términos, cola sin señal y modo demostración (D28).
**Por qué.** M8 estaba pendiente; el usuario pidió replicar el flujo y el aspecto de SIGRIV (kit gob.mx v3).
**Qué arrastró.** `12-estado-y-traspaso.md`, `CLAUDE.md` (tabla de módulos, cómo correrla, excepción de diseño),
`02-mapa-del-repo.md`, `03-tecnologias.md`, D28.
**Impacto en otros módulos.** Ninguno en código. Falta el `buildCommand` de `vercel.json` y probarla en teléfono
real; la geolocalización exige HTTPS (túnel con cloudflared).

---

## 2026-11-24 · M10, M0: red de 5 estaciones elegida por cobertura; fixtures con esas 5

**Qué cambió.** `scripts/96_red_estaciones.py` elige la red entre los 69 sitios con historia de campo
por el número de establecimientos DENUE que vigila cada uno a 20 km aguas arriba, y escribe
`red/red_estaciones.csv`. `40_generar_fixtures.py` toma de ahí las estaciones: EST-ATY-01 Zahuapan
(DLTLA2554), 02 Tepetitla (DLTLA2577), 03 Papalotla (DLTLA2544), 04 Puebla (DLPUE1977) y 05 Alseseca
(DLPUE2064), numeradas de aguas arriba hacia aguas abajo. Nuevo `docs/18-red-de-estaciones.md` con la
curva de cobertura, el enlace por la red celular existente y costos por cotizar; D27.
**Por qué.** El número de estaciones lo limita el presupuesto. Las 5 anteriores, elegidas por ser las
más deterioradas, vigilaban 265 establecimientos (9 %); estas, 1 124 (39 %). De la sexta en adelante
cada estación agrega menos de 70.
**Qué arrastró.** Fixtures y escenarios regenerados; el motor da 0, 1, 5, 3 y 0 alertas (antes 0, 2, 5,
5, 0) y cumple su criterio (`docs/15` regenerado); `backend/prueba.py` (`ESPERADO`) y
`backend/README.md`; el mock reproduce los cinco escenarios sin errores de contrato; `ficha-tecnica.md`,
`docs/12`, `docs/README.md`, `02-mapa-del-repo.md`, `CLAUDE.md`.
**Impacto en otros módulos.** M5: `backend/prueba.py` no se corrió aquí (falta el entorno del backend).
M7: `panel/public/demo/foto.json` sigue con las estaciones anteriores; hay que recapturarlo con el backend
real (`npm run capturar-demo`). `prediccion_ejemplo.json` sigue sobre DLTLA2582: es un ejemplo de M3 y
regenerarlo pide `muestreo_nucleo.csv`.

---

## 2026-11-24 · M6, M4: menú del mapa plegable y estación bien encuadrada; sin volcán

**Qué cambió.** La barra lateral del mapa se pliega con un botón junto al título y queda una columna
con los números de las estaciones. Al abrir una estación se pliega sola, el mapa ocupa ≈ 40 % y centra
la estación a zoom 12.6 al terminar la transición, y el simulador ocupa 58 %; en el marco, la figura 3D
limita su alto al de la ventana para verse completa. Al cerrar, el menú vuelve como estaba. En la
figura 3D se quita el volcán del fondo.
**Por qué.** Con el menú fijo de 220 px el mapa quedaba en una franja de ≈ 170 px y la figura se cortaba
por abajo; el usuario pidió un menú desplegable y ver bien la zona y la figura.
**Qué arrastró.** `mapa/index.html`, `mapa.js?v=9`, `estilos.css?v=7`, `mapa/README.md`; en el
simulador `estilos.css?v=8` (modo incrustado) y `escena.js?v=28`; D19, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: vuelven las nubes difusas; cielo más azul

**Qué cambió.** Se quitan los cúmulos de base plana y vuelven las nubes difusas de antes, en su lugar.
El cielo pasa a un azul más intenso (cenit 3A7FCB, horizonte AECBE6) que llega casi hasta el horizonte.
**Por qué.** El usuario prefirió las nubes originales y pidió el cielo aún más azul.
**Qué arrastró.** D19, `escena.js?v=27`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: cielo más azul con cúmulos y zacatón en lugar de arbustos

**Qué cambió.** El cielo es azul hasta pocos grados sobre el horizonte y lleva ocho cúmulos de base
plana, bajos para que entren en la vista general. Los 40 arbustos redondos pasan a macollos de
zacatón: hojas finas que se arquean desde el centro, en tono paja.
**Por qué.** Lo pidió el usuario; los bultos redondos, como los árboles anteriores, distraían.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js?v=26`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: el envío a la torre se ve, con su confirmación

**Qué cambió.** La punta de la antena se ilumina al buscar red y al enviar; cada envío se dibuja en
2.3 s reales: el paquete sube a la torre, la torre se enciende, la confirmación (ACK) regresa y los
cubos de la SD desaparecen. Los rótulos acompañan: "Enviando", "Recibido: confirma a la
estación", "Confirmado: borra de la SD".
**Por qué.** A 300× el envío de 4 s simulados duraba 13 ms y no se veía; el usuario eligió la punta
que se ilumina, un envío con duración mínima y la confirmación de vuelta.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js?v=24`.
**Impacto en otros módulos.** Ninguno: el firmware y los paquetes no cambian.

---

## 2026-11-24 · M4: el agua se dibuja 4 veces más rápido

**Qué cambió.** La corriente visible del agua avanza 4 veces más rápido que la velocidad simulada; el
rótulo "Corriente" sigue dando la del modelo.
**Por qué.** A 0.6 m/s y desde la distancia de la cámara casi no se percibía el movimiento.
**Qué arrastró.** D19, `escena.js?v=23`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: ahuejotes en lugar de árboles de copa redonda

**Qué cambió.** Los 26 árboles de copa redonda (cuatro bultos cada uno) pasan a 12 ahuejotes de copa
angosta y alta, en verde grisáceo, al fondo y a los lados, dibujados con mallas instanciadas. Los
arbustos bajan de 70 a 40.
**Por qué.** El usuario notó que el árbol no se veía bien y que, al ser varios, distraía de la
estación. El ahuejote es el árbol de las orillas y canales del valle Puebla-Tlaxcala.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js?v=22`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: cielo, vegetación y corriente del río en la figura 3D

**Qué cambió.** Cielo con degradado y nubes; pasto, carrizo, arbustos y 14 árboles más, con mallas
instanciadas; el agua corre aguas abajo a la velocidad de `Agua.velocidad` (nueva en `modelo.js`) y
un rótulo "Corriente" la muestra como simulada.
**Por qué.** El usuario pidió cielo, vegetación y el flujo según los datos. No hay velocidad medida
en la cuenca y el caudal puntual solo existe en 1 de los 5 sitios de estación (DLPUE2063, mediana
671 L/s, n = 21): se simula con el centro del intervalo de M3 (0.6 m/s) y crece con la lluvia (Q^0.4).
**Qué arrastró.** D19, `CLAUDE.md`, `dispositivo/README.md`, `escena.js`, `modelo.js`; versiones en
`index.html`.
**Impacto en otros módulos.** Ninguno: la velocidad simulada no viaja en los paquetes ni la usa M3.

---

## 2026-11-24 · M4: vista de cerca de las sondas

**Qué cambió.** Clic en el tubo de las sondas o en su rótulo: la cámara se acerca y cada una de las
cinco sondas muestra su cabeza propia, qué mide y cómo, y su estado vivo (estabilizando con cuenta
regresiva, lectura k de 5, valor enviado o falla). Durante el calentamiento y la medición el
simulador va a tiempo real; "Vista general" o Esc regresa.
**Por qué.** El usuario quiere ver de cerca el funcionamiento de la sonda.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js` (vistas, selección, cabezas), `ui.js` (tiempo real en
la vista de cerca), `estilos.css`; versiones en `index.html`.
**Impacto en otros módulos.** Ninguno: el firmware y los paquetes no cambian.

---

## 2026-11-24 · M4: la figura 3D va fluida y siempre de día soleado

**Qué cambió.** La figura se dibuja en cada cuadro (antes 20 veces por segundo, junto con textos y
gráfica): girarla y el viaje del paquete pasan a 60 cuadros por segundo en el navegador integrado
con gráficos AMD integrados. La luz es fija de día soleado a media mañana, con gestión de color sRGB y
mapeo de tonos ACES; sombras calculadas una vez, con filtro PCF.
**Por qué.** El usuario notó poca fluidez y, al ser una demostración, quiere ver todos los mecanismos
de día. Los datos no cambian: el rótulo del panel sigue la hora del modelo de energía.
**Qué arrastró.** D19, `CLAUDE.md`, `ui.js` (bucle), `escena.js?v=15` y `ui.js?v=6` en `index.html`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: la figura 3D con realismo moderado

**Qué cambió.** `escena.js` usa materiales físicos (acero, policarbonato, vidrio del panel, circuito
impreso), texturas dibujadas en código para suelo, corte, follaje y agua, árboles con copas de varios
bultos y sombras del sol. Los reflejos de un cielo degradado van solo en metal, vidrio y agua.
**Por qué.** El usuario pidió una figura más realista sin descargar modelos; se eligió el nivel que
no añade peso de carga ni movimiento decorativo.
**Qué arrastró.** D19 (revisión), `dispositivo/README.md`, `CLAUDE.md`, `escena.js?v=10` en el
`index.html` del simulador.
**Impacto en otros módulos.** Ninguno: el mapa muestra el simulador por URL y la lógica no cambió.

---

## 2026-11-24 · M7: el panel muestra hasta dónde llega la contaminación

**Qué cambió.** El expediente de cada alerta pide `GET /alertas/<c_alerta>/prediccion` (M3, servida
por el backend) y muestra: una frase con el primer sitio aguas abajo y su ventana de llegada, tres
cifras (llegada al primer sitio, sitios a menos de 50 km, valor esperado), una gráfica de ventanas
de llegada por sitio coloreada por confianza, la tabla con el valor esperado como banda p10 a p90 y
los supuestos del modelo. Con el mock, que no tiene esa ruta, lo dice y muestra la topología. La foto
del modo demostración (`panel/public/demo/foto.json`) se recapturó del backend y trae las 5
predicciones. Con esto M7 cumple su criterio de terminado y pasa a construido.

**Por qué.** Era lo único que le faltaba al criterio de M7, y responde lo que una autoridad pregunta
primero ante una descarga: a quién le llega y cuándo.

**Verificación.** Contra el backend local: la alerta de conductividad de ATY-01 llega primero a 0.5 km
entre +9 y +31 min, 22 sitios dentro de 50 km. Con el mock (`?api=`): mensaje y topología. Compilación
de producción sin backend: modo demostración con la predicción y ninguna llamada de red al backend.
A 375 px sin desborde. Los colores de confianza pasan el validador de paletas como escala ordinal.

**Qué arrastró.** `panel/README.md`, `CLAUDE.md`, `01-que-construimos.md`, `12-estado-y-traspaso.md`.

**Impacto en otros módulos.** Ninguno. M6 puede usar la misma ruta para pintar la pluma.

---

## 2026-11-24 · M5: la base en producción es Supabase

**Qué cambió.** El backend en Vercel guarda en el Postgres de Supabase por su Transaction pooler
(D26): conexión sin sentencias preparadas, URL limpia de parámetros de integraciones (`supa=`), las
cuatro tablas con RLS activo y el esquema solo se toca si falta algo. Documentación de Neon cambiada
a Supabase (`backend/README.md`, `panel/README.md`, `03-tecnologias.md`, `CLAUDE.md`, `api/index.py`).

**Tres errores que aparecieron al probar.** (1) Aplicar el esquema en cada conexión, ya con
`ENABLE ROW LEVEL SECURITY`, trababa a las instancias que escribían: Postgres reportó "deadlock
detected" en la prueba de dos instancias. Ahora se consulta `pg_class` primero. (2) En SQLite,
`PRAGMA journal_mode=WAL` corría antes de `busy_timeout`. (3) Aun con `busy_timeout`, pasar a WAL
falla al instante si otra conexión escribe (1 de 3 corridas daba "database is locked"); ahora solo
se pide si falta y se reintenta.

**Verificación.** `backend/prueba.py`: SQLite 37 de 37 en 8 corridas seguidas, Postgres 17 38 de 38
en 5 corridas seguidas. Nuevas: limpieza de la URL de la integración y, en Postgres, RLS activo en las
cuatro tablas.

**No verificado.** Supabase mismo: se probó contra un Postgres 17 local. El pooler de Supabase no se
probó; la opción `prepare_threshold=None` es la que documentan psycopg y Supabase para él.

**Impacto en otros módulos.** Ninguno. Nadie usa `@supabase/supabase-js`: el panel habla con el
backend.

---

## 2026-11-24 · M5: el backend corre en Vercel junto al panel, con Postgres

**Qué cambió.** Panel y backend se despliegan en un solo proyecto de Vercel (D25): `vercel.json`,
`api/index.py` y `requirements.txt` en la raíz; se quitó `panel/vercel.json`. El backend guarda en
Postgres cuando existe `DATABASE_URL` y en SQLite en local. El motor ya no vive en memoria: en cada
lote se reconstruye por estación con sus últimas 200 lecturas, bajo un candado por estación en la
base. Revisa D24 y D23.

**Verificación.** `backend/prueba.py` (36 comprobaciones) pasa en SQLite y en un Postgres 17 de
prueba, tres veces seguidas en Postgres. Dos instancias que se turnan los lotes de
`descarga_industrial` dan las mismas cinco alertas y folios que una. Sin el candado por estación, la
prueba directa del candado falla (la segunda conexión entra a los 0.15 s en vez de esperar). Con el
panel compilado con `VITE_API_URL=/api` y servido junto a `api/index.py` sobre Postgres:
`reproducir_escenario.py descarga_industrial --url .../api` da 5 alertas, el panel las muestra
conectado a `/api`, guarda el responsable y la predicción de M3 responde con 26 destinos.

**Dos errores que aparecieron al probar.** Dos instancias que arrancan a la vez sobre una base vacía
chocaban al crear las tablas en Postgres ("duplicate key ... pg_type_typname_nsp_index"); se crean
bajo un candado. Y desde Git Bash `VITE_API_URL=/api` llega como `C:/Program Files/Git/api`: en local
se compila desde PowerShell.

**No verificado.** El despliegue en Vercel mismo (lo hace el equipo a mano) ni Neon: se probó con un
Postgres 17 local.

**Qué arrastró.** `backend/README.md`, `panel/README.md`, D25 y notas de revisión en D23 y D24,
`03-tecnologias.md`, `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`, `CLAUDE.md`.

**Impacto en otros módulos.** El mapa y el simulador pueden apuntar a `https://<proyecto>.vercel.app/api`
con `?mock=` y `?backend=`. En Vercel, Root Directory deja de ser `panel`.

---

## 2026-11-24 · M5: backend real con FastAPI y SQLite

**Qué cambió.** Nueva carpeta `backend/` (D24): FastAPI con las rutas del contrato y las mismas
respuestas que `servidor_mock.py --motor real`, persistencia en SQLite, el motor de M2 y la
predicción de M3 en `GET /alertas/<c_alerta>/prediccion`. Al arrancar reproduce las últimas 200
lecturas de cada estación para recuperar el estado del motor, y sus folios siguen desde el mayor
guardado. Un reenvío idéntico de un paquete no se evalúa dos veces. `scripts/50_verificar_repo.py`
ya no revisa `node_modules/` ni `dist/`.

**Verificación.** `backend/prueba.py`, 29 comprobaciones, todas pasan: los cinco escenarios dan
0, 2, 5, 5 y 0 alertas como el motor; nueve rechazos con el mismo código y detalle que el mock,
comparado en vivo; reiniciar a mitad de `descarga_industrial` da las mismas cinco alertas y folios
que no reiniciar; la predicción es idéntica a `prediccion_ejemplo.json` de M3 (26 destinos); 1500
peticiones con 32 a la vez sin errores. Con servidores reales: `reproducir_escenario.py normal --url`
termina sin errores de contrato y con 0 alertas, `descarga_industrial` con 5, y tras matar y volver a
arrancar el proceso siguen las 960 lecturas, las 5 alertas y el reporte. El panel funciona contra él
sin cambios.

**Un error que hubo que corregir.** La conexión de SQLite se compartía entre hilos con candado solo
para escribir. El panel pide 8 cosas a la vez y algunas lecturas fallaban con "bad parameter or other
API misuse"; el navegador lo mostraba como error de CORS porque la respuesta 500 sale sin esas
cabeceras. Ahora todo pasa por el candado. La prueba 5 reproduce el fallo sin él (2 errores en 1500)
y pasa con él.

**Qué arrastró.** `contrato/README.md` (ruta nueva, solo en el backend), `01-que-construimos.md`,
`02-arquitectura.md`, `03-tecnologias.md`, D24, `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`,
`CLAUDE.md`, `.gitignore` (`backend/datos/`).

**Impacto en otros módulos.** El panel, el mapa, el simulador y `reproducir_escenario.py` funcionan
con el backend sin cambiar nada: mismo puerto 8080 y mismas respuestas. Si M3 cambia su fórmula o sus
constantes, `backend/prueba.py` falla y hay que actualizar `backend/propagacion.py`. M6 ya puede pintar
la pluma con `GET /alertas/<c_alerta>/prediccion`, pero el mock no tiene esa ruta.

---

## 2026-11-24 · M7: el panel pasa a React con Vite para desplegarse en Vercel

**Qué cambió.** `panel/` deja el HTML plano y es una aplicación React 18 con Vite (D23), con las
mismas vistas, gráficas y reglas. `scripts/copiar-datos.mjs` copia las cuatro tablas que lee a
`public/datos/` (no versionado) antes de `dev` y `build`. Sin backend configurado, la compilación
de producción entra en modo demostración con `public/demo/foto.json` (5 alertas y 2 reportes del
mock con `--motor real` sobre `descarga_industrial`). Dos arreglos que estaban pendientes en el
HTML plano quedaron incluidos: la columna de fuente probable ya no se aplasta y el texto de
propagación ya no dice que M3 está pendiente.

**Por qué.** Desplegar en Vercel. El HTML plano leía los datos con rutas `../` que no existen
cuando la raíz del proyecto en Vercel es `panel/`.

**Verificación.** `npm run build` sin errores (181 kB de JS, 59 kB comprimido). En desarrollo,
contra el mock: pestañas, expediente y guardado de responsable con clics reales (el texto escrito
sobrevive al sondeo de 3 s). La compilación de producción sin backend abre en modo demostración
y no hace ninguna llamada al puerto 8080. Sin desborde horizontal a 375 px.

**Qué arrastró.** `03-tecnologias.md`, D23, `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`,
`CLAUDE.md`, `panel/README.md`.

**Impacto en otros módulos.** Ninguno en el contrato. Quien abría `http://127.0.0.1:8000/panel/`
ahora usa `npm run dev` en `panel/`.

---

## 2026-11-24 · Terreno de la figura 3D parecido a la cuenca

**Qué cambió.** `escena.js` reemplaza las cajas del corte por un valle con el río en un cauce de
taludes que serpentea, agua turbia (verde grisácea a café según la turbiedad), árboles en las
orillas y un volcán tenue al fondo. Las sondas, el cable y la torre se recolocaron sobre el terreno.
**Por qué.** La superficie anterior no se parecía a la cuenca.
**Qué arrastró.** `dispositivo/simulador/escena.js`, `index.html` (versión), `dispositivo/README.md`,
`05-decisiones-tecnicas.md` (consecuencia de D19), `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

## 2026-11-24 · M8 especificada, y sus dos dependencias de backend resueltas

**Qué cambió.** Nuevo `docs/17-plan-app-ciudadana.md`: la especificación completa de la app
ciudadana como **PWA en React y Vite** bajo `/ciudadano/`, con las decisiones tomadas y
justificadas, las alternativas descartadas, el contrato campo por campo y un criterio de
terminado medible. Y se implementaron las dos piezas de backend que el plan listaba como
dependencias:

- **`GET /reportes/{c_reporte}`** en el backend y en el servidor de pruebas. Devuelve un
  reporte sin el campo `correo` y 404 si el folio no existe.
- **Asignación al tramo del río** en `POST /reportes`, vía `backend/asignacion.py` y la red
  podada que produce `scripts/71_red_para_asignacion.py`.

**Por qué PWA y no Flutter.** El equipo ya tiene React, Vite y Vercel funcionando con el
backend en el mismo despliegue; Flutter sería un segundo toolchain, un APK que distribuir y
un emulador en la máquina del pitch. Y para una app de participación, pedir una instalación
es una barrera de adopción real: el reporte se levanta junto al río o no se levanta. SIGRIV
se quedó en web, así que tampoco hay código Flutter que reutilizar.

**La red podada.** La red completa son 65 342 tramos y 61 MB de shapefiles: no cabe en una
función de Vercel. Se conservan los tramos cuya cadena aguas abajo alcanza un sitio en
20 km o menos, que son **11 765**, con el trazo simplificado a unos 30 m. Resultado:
**1.6 MB**, versionado porque la función lo necesita desde el repositorio.

**Dos decisiones del asignador que conviene conocer.** La tolerancia es de **1 500 m**, no
los 150 m que se usaron para los sitios de monitoreo: un sitio de muestreo está en el río,
una persona reporta desde donde puede pararse y el GPS falla en una barranca. Si el punto
queda más lejos, el sitio va en `null` pero la distancia se reporta igual. Y se asigna el
sitio **aguas abajo**, no el más cercano, porque ahí es donde la contaminación reportada se
va a medir y es lo que permite cruzar el reporte con una alerta de sensor.

**Comprobado.** Las coordenadas exactas de un sitio enganchan entre 2 y 8 m; un punto en el
centro de Puebla da 1 064 m y se asigna; uno en Ciudad de México se rechaza. De punta a
punta contra el backend real, un reporte junto al río San Francisco quedó asignado a
`DLPUE1975` a 4.5 m del cauce. Las pruebas de `backend/prueba.py` siguen pasando, incluidas
las de concurrencia y la de la función de Vercel.

**Qué arrastró.** `backend/almacen.py` (busca un reporte por folio),
`contrato/servidor_mock.py` (misma ruta, el mock es la referencia ejecutable), `vercel.json`
(incluye el JSON en el bundle), `docs/README.md`,
`docs/contexto/02-mapa-del-repo.md`, `docs/12-estado-y-traspaso.md` y `CLAUDE.md`.

**Impacto en otros módulos.** Quien construya M8 ya no tiene dependencias de backend. Queda
pendiente a propósito el `buildCommand` de `vercel.json`, que no se puede aplicar antes de
que `ciudadano/` exista o el despliegue se rompe: va junto con el andamio.

---

## 2026-11-24 · Modelos proxy: uno sirve, el otro no, y una correccion

**Qué cambió.** Nuevo `scripts/90_modelos_proxy.py`. Ajusta las dos relaciones
sensor→laboratorio como leyes de potencia en espacio logarítmico y las **valida fuera de
muestra** de dos formas: ajustando con la mitad de los sitios y probando en los otros, y
calibrando por sitio para probar en fechas posteriores. Escribe
`datos/procesados/proxy_modelos.csv`, `contrato/fixtures/modelos_proxy.json` y
`docs/16-modelos-proxy.md`.

**Resultado.** `SDT = 0.788 × COND^0.972`: **2 %** de error mediano en sitios que el modelo
no vio, 7 % en el percentil 90. Es un sustituto real de una medición de laboratorio y se
publica. `SST` desde turbiedad: **35 %** de error mediano y 135 % en el percentil 90.
Calibrar por sitio apenas lo baja al 27 %, así que la dispersión es ruido dentro de cada
sitio y no un sesgo corregible. **No se publica.**

**La corrección.** El análisis exploratorio reportó correlaciones de 0.947 y 0.971 y yo las
cité repetidamente como evidencia de que ambos proxy servían. Esa cifra sobrevalora la
relación: está calculada sobre valores crudos que recorren cuatro órdenes de magnitud, donde
Pearson queda dominada por los valores grandes. En espacio logarítmico la de turbiedad cae a
0.852. Tiene sentido físico: la turbiedad responde al tamaño y al color de las partículas,
no solo a su masa, así que un arrastre de arcilla y una descarga orgánica con la misma
turbiedad llevan masas muy distintas.

**Qué arrastró.** Se corrigieron las afirmaciones en `docs/05-decisiones-tecnicas.md` (D12),
`docs/10-revision-critica-plan.md` (objeción 6 y la tabla de cambios a la etapa 3.1),
`docs/01-que-construimos.md` y **`dispositivo/ficha-tecnica.md`**, que decía que SST se
estimaría en el backend. El script `20_analisis_exploratorio.py` ahora imprime una
advertencia junto a su tabla de correlaciones para que nadie vuelva a leerla como capacidad
predictiva. Más `docs/README.md`, `docs/contexto/02-mapa-del-repo.md`,
`docs/12-estado-y-traspaso.md` y `CLAUDE.md`.

**Impacto en otros módulos.** M4 ya no debe anunciar SST entre lo que reporta la estación.
M5 puede aplicar el modelo de SDT desde `modelos_proxy.json`, siempre con su banda. El
criterio de publicación quedó escrito en el script: un modelo no entra al contrato solo
porque exista.

## 2026-11-24 · M6: el token de Mapbox se toma del .env

**Qué cambió.** Nuevo `mapa/generar_config.py`: lee `MAPBOX_ACCESS_TOKEN` del `.env` de la raíz y
escribe `mapa/config.js`. `.env` entra a `.gitignore`.

**Por qué.** El equipo quiere el token en un solo lugar, el `.env`. La página del mapa no puede
leerlo (corre en el navegador), así que el script lo copia al `config.js` que ya existía (D21). Se
niega a escribir un token secreto `sk.` o algo que no tenga forma de token público, y no lo
imprime completo. El token público sigue siendo visible en el navegador; la protección es la
restricción por URL en la cuenta de Mapbox, no esconderlo.

**Qué arrastró.** `mapa/README.md`.

**Impacto en otros módulos.** Ninguno. Quien ya tenía `mapa/config.js` a mano puede seguir así.

---

## 2026-11-24 · M7: gráficas en el panel y arreglo de las pestañas

**Qué cambió.** El panel suma un panorama de cinco gráficas arriba de la lista: alertas por
hora del día apiladas por nivel, una matriz estación × sonda con la posición de la última
lectura en la banda del sitio (sobre, dentro, bajo; viene de `posicion_en_banda` del
veredicto), alertas por atender por estación, alertas por parámetro y el avance de la
atención (abiertas, en atención, cerradas, descartadas). En el expediente se agregan
miniaturas de las cinco sondas de la estación contra su banda. Las pestañas de avisos y
reportes tienen su gráfica. Todas llevan tooltip, leyenda y nivel escrito, nunca solo color.
Se arregló que las pestañas no cambiaban: el JS buscaba la clase `.vistas` que el rediseño
renombró a `.subnav`.

**Colores de las gráficas.** Niveles: Crítica #9B0F15, Preventiva #A57F2C (dorado600 del
SND; el amarillo500 #684700 del SND se confunde con el rojo en deuteranopia, ΔE 2.4),
Informativa #224497. Validado con el script de paletas: separación para daltonismo ΔE ≥ 17 y
contraste ≥ 3:1; el azul queda más oscuro que la banda recomendada, compensado con etiqueta.

**Qué arrastró.** `panel/README.md`, D22 en `05-decisiones-tecnicas.md`.

**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: el panel adopta el Sistema Nacional de Diseño y se rediseña

**Qué cambió.** `panel/` cambia a la paleta y tipografía del SND, tema guinda (decisión D22), y
se reorganiza: cabecera institucional, resumen arriba (críticas por atender, por atender, sin
responsable, estaciones con falla técnica, con su hora de corte), tabla de las 5 estaciones
que filtra la lista al hacer clic, y en el expediente tres cifras clave (valor medido, banda
habitual con su `n`, lecturas seguidas fuera) antes de la gráfica. La gráfica se dibuja al
ancho real para que se lea en teléfono.

**Por qué.** El panel es para autoridades federales y la guía gráfica de gob.mx manda migrar al
SND. El diseño anterior no le gustó al equipo.

**Qué arrastró.** `05-decisiones-tecnicas.md` (D22), `panel/README.md`, `CLAUDE.md`.

**Impacto en otros módulos.** Ninguno en el contrato. Si M6 y M8 quieren verse igual, D22 dice
qué valores usar.

---

## 2026-11-24 · M7: prototipo del panel de autoridad y PATCH /alertas en el mock

**Qué cambió.** Nueva carpeta `panel/` (HTML, CSS y JS sin dependencias, mismo estilo que
el mapa). Lista las alertas con filtros por estado, nivel y estación; el expediente de cada
una muestra regla, criterio, lecturas seguidas, la banda p10 a p90 del sitio con su `n` y sus
fechas, una gráfica de las lecturas recientes contra esa banda, fuente probable, medidas
sugeridas y los sitios aguas abajo y aguas arriba con distancia sobre el cauce (M1). Permite
cambiar estado y asignar responsable. Avisos técnicos y reportes ciudadanos van en pestañas
separadas (I8). En el mock: `PATCH /alertas/<c_alerta>` (solo `estado` y `responsable`,
validado contra `alerta.schema.json`) y filtro `?c_estacion=` en `GET /veredictos`.

**Por qué.** El criterio de terminado de M7 pide cambiar estado y asignar responsable, y el
mock no tenía cómo escribir una alerta. El filtro por estación hace falta porque los últimos
50 veredictos globales cubren unas 2.5 h por estación, poco para ver la evidencia.

**Qué arrastró.** Tabla de rutas de `contrato/README.md`, `02-mapa-del-repo.md`,
`12-estado-y-traspaso.md` y `CLAUDE.md`. El esquema `alerta` no cambia: `estado` y
`responsable` ya existían.

**Lo que falta para terminar M7.** Predicción de llegada (espera a M3: hoy se dice "sin
predicción" y se lista la topología), fuente probable con puntaje (el stub no la calcula),
sesión de usuario y la ruta equivalente en el backend real (M5).

**Impacto en otros módulos.** M5 debe implementar `PATCH /alertas/<c_alerta>` con la misma
regla: solo `estado` y `responsable`, 422 para lo demás. El resto de frontends, ninguno.

---

## 2026-11-24 · Mapbox opcional por token

**Qué cambió.** Con `mapa/config.js` el mapa usa Mapbox GL JS (estilo claro y relieve); sin él,
MapLibre con OpenFreeMap. La casilla "Satélite" usa Esri World Imagery en ambos casos, porque el
satélite de Mapbox respondió 429 a todas las teselas con nuestra cuenta. `mapbox.txt` y `mapa/config.js` quedan en `.gitignore`.
**Por qué.** Se pidió usar Mapbox; el token no debe subirse al repositorio del equipo (D21).
**Qué arrastró.** `mapa/index.html`, `mapa/mapa.js`, `mapa/estilos.css`, `mapa/config.ejemplo.js`,
`mapa/README.md`, `.gitignore`, `03-tecnologias.md`, `05-decisiones-tecnicas.md` (D21),
`12-estado-y-traspaso.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

## 2026-11-24 · MapLibre en el mapa y vistas sin información de más

**Qué cambió.** El mapa pasa a MapLibre GL con la base vectorial de OpenFreeMap (ríos de la base
apagados, nombres en español) y relieve opcional. Se quitaron la leyenda, las notas, las fuentes
visibles y el estado del backend del mapa; y del simulador, la línea de fase, la tabla de
parámetros, las notas de la recepción y el panel "Más pruebas". Los valores medidos van en las
pestañas de la línea de tiempo; el simulador se conecta solo al backend.
**Por qué.** El usuario pidió varias veces quitar lo que nadie va a leer, y un mapa más capaz con
el relieve opcional (D20).
**Qué arrastró.** `mapa/` (todo), `dispositivo/simulador/` (`index.html`, `ui.js`, `recepcion.js`,
`estilos.css`), `dispositivo/README.md`, `dispositivo/ficha-tecnica.md`, `mapa/README.md`,
`03-tecnologias.md`, `05-decisiones-tecnicas.md` (D20), `12-estado-y-traspaso.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno: el contrato y las URL de incrustación no cambian
(`?backend=` ahora es opcional).

## 2026-11-24 · Cuenca delimitada con confluencias y estación en 3D

**Qué cambió.** `scripts/60_red_para_mapa.py` escribe dos capas nuevas: `cuenca.geojson` (contorno
exterior de las 10 subcuencas, 31 480 km²) y `confluencias.geojson` (14 uniones principales, por
longitud de red acumulada aguas arriba, con nombre de la toponimia). El mapa aclara lo de fuera de la
cuenca, traza el contorno y marca las confluencias. El simulador cambia la figura 2D por una escena
3D (Three.js) y el cuadro de la plataforma por una línea de tiempo de lo recibido (`recepcion.js`).
**Por qué.** Se pidió que la cuenca y sus bifurcaciones se vean con claridad y que el mecanismo se
vea más detallado y en 3D, sin ruido; y que el envío no sea un cuadro de "enviado o no" (D19).
**Qué arrastró.** `mapa/` (js, css, html, README), `dispositivo/simulador/` (`escena.js`,
`recepcion.js`, `ui.js`, `index.html`, `estilos.css`), `dispositivo/README.md`, `README.md`,
`03-tecnologias.md`, `05-decisiones-tecnicas.md` (D19), `contexto/02-mapa-del-repo.md`,
`12-estado-y-traspaso.md`, `CLAUDE.md`.
**Impacto en otros módulos.** M1 puede reutilizar el recorrido de la red de `confluencias()`. El
contrato no cambia.

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

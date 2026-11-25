# CLAUDE.md · HackaTec 2026, reto SECIHTI Puebla

Sistema de monitoreo y alertamiento de contaminación del río Atoyac (cuenca del Alto Atoyac, Puebla y
Tlaxcala). Idioma del proyecto, de la documentación y de la conversación: **español**.

## Antes de tocar algo

Trabajo local = solo código y datos. **No releas ni actualices los `.md` de contexto en cada cambio.**

1. Al empezar una sesión, lee solo lo que necesites: `docs/contexto/01-invariantes.md` si tocas datos o
   contrato, y `02-mapa-del-repo.md` si dudas de si un archivo es derivado (CSV procesados, fixtures,
   `datos/procesados/mapa/`, `08-` y `09-`: **no se editan, se edita su generador**). No leas el resto
   por rutina.
2. Mientras trabajas, verifica solo lo que tocaste (el script o `node dispositivo/simulador/prueba.js`
   si fue el simulador).
3. **Solo cuando el usuario pida commit/push** (o cierres un módulo): busca el tipo de cambio en
   `docs/contexto/05-protocolo-de-cambios.md`, actualiza la documentación que arrastre, añade una
   entrada arriba en `06-registro-de-cambios.md`, actualiza `docs/12-estado-y-traspaso.md` si cambió el
   estado de un módulo y corre `python -I scripts/50_verificar_repo.py` (debe decir "Todas las
   comprobaciones mecanicas pasan").

## La idea central

En un río que ya está permanentemente fuera de norma, un umbral fijo está encendido desde 2012 y no informa
nada. **Lo que detecta un evento nuevo es la desviación respecto de la historia del propio punto.** El
semáforo de CONAGUA existe solo en la vista ciudadana: 176 de 198 sitios con dato están en rojo, así que el
color no ordena nada y **no se usa para pintar el mapa** (decisión D9).

La presentación va en dos tiempos: primero la **medición** (mapa y simulador justifican la estación),
después el **análisis**. Las vistas actuales no anuncian el análisis en pantalla.

## Estado de los módulos

| Módulo | Estado |
|---|---|
| M0 datos y contrato | Construido: 219 sitios, 145 703 resultados 2012-2025, 7 esquemas v1.0, fixtures, servidor mock |
| M4 dispositivo | Simulador web construido y probado (`dispositivo/`): figura 3D con vista de cerca de cada componente (sondas, gabinete, energía, comunicación) y línea de tiempo de recepción. **Sin hardware**: las especificaciones son supuestos de diseño. **Colector de residuos flotantes** simulado en la misma figura (ver "Lo construido"); falta su ficha. **Módulo de ladera** (docs/20): estaciones `EST-LAD-` con pluviómetro, humedad de suelo e inclinómetro, su propia figura y pruebas de tormenta, lluvia prolongada y deslave. Modelos comerciales y nomenclatura de piezas en `dispositivo/catalogo-componentes.md` |
| M6 mapa | Prototipo (`mapa/`): abre en la zona de la red, ríos del INEGI con el flujo animado aguas abajo, 14 confluencias y las 5 estaciones con su simulador. Sin sitios oficiales ni capas opcionales. No colorea por índice ni está probado a ancho de teléfono |
| M1 topología (orden aguas arriba → abajo) | **Construida** (`scripts/70_topologia_red.py` → `datos/procesados/red/`): 210 de 219 sitios con sucesor y distancia sobre el cauce; 14 marcados para revisión |
| M2 motor de reglas | **Construido** (`motor/reglas.py`): 0 alertas en el día de control contra 31 del stub, 0 ambientales con el sensor roto, los tres eventos detectados antes de su intensidad plena y su fuente bien clasificada. `servidor_mock.py --motor real` lo usa |
| M3 propagación | **Construida** (`scripts/80_propagacion.py`): transporte conservativo con k = 0, porque la razón medida abajo/arriba en 90 tramos tiene mediana 1.00. Ventana de llegada por velocidad declarada 0.3-1.0 m/s; valor como banda p10-p90; cobertura 78 % fuera de muestra |
| M7 panel de autoridad | **Construido** (`panel/`), reenfocado a escuelas (módulo B, docs/19 §6). Cuatro pestañas: **Alertas** (mapa de los dispositivos, estaciones, lista y expediente con evidencia, fuente probable y **escuelas afectadas**), **Escuelas** (cifras, mapa de escuelas y zonas de riesgo, lista por índice con ficha: desglose del riesgo, agua, mecanismo, alertas, zonas y trámites; gráficas por nivel, tipo y municipio; análisis de urbanización), **Autorizaciones** (tablero CEASPUE y CAPCEE; mecanismo «propuesto» sin autorización de CEASPUE) y **Reportes ciudadanos**. Solo escuelas de Puebla en las cuatro subcuencas del Alto Atoyac (205 de 503); alertas de ladera contra los umbrales del motor. Ocultos sin borrar: predicción aguas abajo y sitios aguas arriba. React con Vite en Vercel; sin inicio de sesión |
| Modelos proxy | Conductividad→SDT **publicado** (2 % de error fuera de muestra); turbiedad→SST **descartado** (35 %) |
| M5 backend | **Construido** (`backend/`): FastAPI, SQLite en local y Postgres en Vercel (`/api` del mismo proyecto que el panel, D25); mismas respuestas que el mock (`backend/prueba.py` lo compara en vivo); motor sin memoria entre peticiones; `GET /alertas/<c_alerta>/prediccion` con M3; aviso por correo al cerrar un reporte (`backend/correo.py`, SMTP con `SMTP_USER` y `SMTP_PASSWORD`); freno antispam por persona en la base (`backend/antispam.py`). Sin autenticación |
| M8 app ciudadana | **Prototipo** (`ciudadano/`): PWA con mapa y pin central al estilo SIGRIV, reporte con cámara o galería, foto validada con Gemini (`POST /reportes/analizar-foto`), folio, rastreo, cola sin señal y modo demostración. Ríos del INEGI encima de la base (orden ≥ 4 al abrir, orden 3 desde zoom 12, flujo animado desde zoom 14) con botón «Ríos» para ocultarlos. Falta probarla en teléfono real. Huella de calor (`GET /huella`) y prioridad (`GET /prioridades`) construidas en `contrato/prioridad_huella.py`, con pesos que son hipótesis |
| Red de estaciones | **Decidida** (`scripts/96_red_estaciones.py`, `docs/18-red-de-estaciones.md`): 5 estaciones con historia de campo que vigilan 1 124 de 2 863 establecimientos DENUE (39 %) a 20 km aguas arriba; las anteriores vigilaban 265. Enlace por la red celular existente, sin antenas propias. Los fixtures son estas 5 |
| M9, M10 | Pendientes (M10: falta cotizar, manual y propuesta por fases) |

No conviertas "pendiente" en "construido" sin verificarlo contra el repo.

## Lo construido

**Dispositivo (`dispositivo/`)**: la estación centinela, simulada (D18: simulador propio, no Wokwi ni hardware).
- Cuatro bloques: sondas (OD, pH, conductividad K=1, temperatura, turbiedad), controlador (ESP32 + RTC + SD),
  comunicación (módem LTE-M, `POST /lecturas`) y energía (estación de agua: panel 10 W + 8×18650, 89 Wh, por la
  turbiedad real de 6 W; ladera: 5 W + 2×18650). Detalle en `ficha-tecnica.md`; modelos en `catalogo-componentes.md`.
- `simulador/`: `modelo.js` (agua con la banda histórica real, sondas con sesgo, deriva, ensuciamiento y fallas,
  energía, enlace), `firmware.js` (máquina de estados pura), `montaje.js`, `prueba.js`, `escena.js`,
  `recepcion.js`, `ui.js`.
- **Pantalla (D19, D20)**: solo tres cosas.
  - Figura 3D (Three.js r149 desde unpkg, `escena.js`, D19). Siempre de día soleado aunque la hora simulada sea de
    noche; materiales físicos y texturas dibujadas en código (sin descargas); se dibuja en cada cuadro.
    - Escena: valle con el río en un cauce de taludes, agua que se vuelve café con la turbiedad y corre aguas abajo
      a la velocidad simulada (`Agua.velocidad`, dibujada 4× más rápido), cielo azul con nubes difusas, 12
      ahuejotes al fondo, pasto, carrizo y zacatón; sin volcán. Corte frontal con el perfil en tinta. Estación a
      1.6× respecto al río. Se gira arrastrando.
    - Vista general: cinco rótulos cortos (Sondas, Gabinete, Energía, Comunicación, Corriente) con nombre y dato
      vivo, en tinta con contorno blanco grueso, **sin fondo**.
    - Vistas de cerca: clic en el rótulo o en la pieza (zonas invisibles `G.zonas`) abre sondas, gabinete (ESP32,
      reloj, microSD, módem, baterías), energía (panel, baterías, consumo) o comunicación (antena, SD, paquete,
      torre). Un rótulo por pieza con qué es (ficha técnica) y su estado vivo, con una línea a la pieza que nunca
      lo atraviesa. Sondas y gabinete pasan a tiempo real las fases que muestran (`Escena.tiempoReal`, lo usa
      `ui.js`); comunicación no, así el envío se repite cada pocos segundos, y deja la trayectoria antena-torre
      siempre dibujada (roja sin cobertura). "Vista general" o Esc regresa.
    - Estados en palabras llanas (`ESTADO` y `estado()` en `escena.js`): "En reposo hasta las 10:30", "Preparando
      las sondas", "Enviando los datos", "Datos recibidos".
    - Cada envío (ACK del firmware, `stats.posts`) se dibuja en 2.3 s reales: antena encendida, paquete a la torre,
      confirmación de vuelta y la SD se vacía; el reloj de la simulación no se detiene.
  - Recepción: pestañas con el último valor de cada parámetro y línea de tiempo de 12 h; punto lleno =
    recibido por la plataforma, vacío = en la SD; franja de fondo = rango habitual del sitio.
  - Cuatro pruebas: descarga industrial, descarga orgánica, lluvia, corte de enlace. Si el backend abre una
    alerta, una línea en rojo.
  - Las fallas de sonda, mantenimiento y clima siguen en el modelo y en `prueba.js`, no en pantalla.
- Medido: 96 paquetes por día y estación, 0 pérdidas en un corte de 4 h; estación de agua ≈ 5.0 Wh/día y ≈ 16 días
  sin sol; de ladera ≈ 0.9 Wh/día y ≈ 21 días.
- Reglas del firmware: escribe en la SD antes de enviar y borra tras el ACK; reenvía con la hora original;
  no corrige valores (manda el crudo, `null` si la sonda no responde, `-999` si está rota); **nunca emite
  alertas** (eso es del backend, invariante I10); muestreo adaptativo; ahorro por batería.

**Colector de residuos (`dispositivo/simulador/recolector.js`, escena y pruebas 8-15)**: el mecanismo de recolección que
pide el reto SECIHTI ("robots o mecanismos automatizados para la recolección de residuos"); la estación mide el agua,
esto retira lo flotante. Sin hardware ni contrato: todo número es supuesto de diseño.
- Diseño: interceptor de orilla **en la orilla derecha, aguas arriba de la estación** (≈ 10 m, para no ensuciar la sonda
  de turbiedad): barrera flotante en diagonal (≈ 17 m) → embudo → banda con paletas y motor de 24 V → contenedor de 240 L
  sobre báscula; cámara que cuenta y clasifica (la IA sería Gemini, como en la app); sensor de nivel del río; panel de 100 W,
  batería 12 V (256 Wh) y módem LTE-M propios.
- `recolector.js`: máquina de estados pura como `firmware.js`. Revisa cada 15 min (alineado a la estación), sube objetos,
  pesa y manda paquete. **Nunca emite alertas** (I10); solo decide seguridad: crecida (> 65 cm: barrera arriba, banda parada),
  atasco (2 reversas y se bloquea hasta la cuadrilla), contenedor lleno (95 %), batería < 25 %. Manda el dato crudo (kg_ciclo
  puede ser negativo: es un retiro). Retiro simulado 8 h después del aviso al 80 %.
- Supuestos a medir en piloto: 4 objetos/h (6× con lluvia), captura 90 % (cae con la corriente), 24 kg de capacidad,
  tirante base 35 cm. Medido en la simulación: captura 89 % normal y 75 % con lluvia, 54 Wh/día con 100 objetos, autonomía
  sin sol ≈ 4.2 días.
- El paquete (`version: '0.1-propuesta'`, `c_colector`, `kg_ciclo`, `kg_contenedor`, `llenado`, `objetos`, `nivel_rio_cm`,
  `estado`, `bateria`, `senal`) **no está en el contrato v1.0** y el simulador no lo manda al backend. Agregarlo toca
  contrato y backend (Evaristo y Carlos): protocolo de `05-protocolo-de-cambios.md`.
- Figura: rótulos Barrera, Banda y Contenedor (sin fondo, estados en palabras llanas) y una vista de cerca por cada uno
  (`VISTAS.barrera/banda/contenedor`). Los objetos que flotan se dibujan en tiempo real al recibir el evento del modelo
  (`Escena.objeto`); el contenedor se llena con los kg del modelo. `Agua.lluvia(t)` (en `modelo.js`) alimenta llegada y nivel.
  Colector a 1.5× en la orilla (estación a 1.6×), barrera a escala real. La prueba "Lluvia" también lo mueve.
- **Cauce ensanchado** a ≈ 12 m de espejo y ≈ 16 m de corona (antes ≈ 8.5 m): `EXT = 1.75` y `ejeRio` corridos a la derecha
  en `escena.js`; la orilla de la estación no se movió. **El ancho real no está medido** (el INEGI solo da el eje): supuesto,
  por medir en imagen satelital en los 5 puentes. La torre celular pasó a (16.5, -12) y la cámara general ve más de frente.

**Mapa (`mapa/`)** (D20, D21):
- Con token en `mapa/config.js` usa **Mapbox GL JS 3.8** (`light-v11`). Sin token usa **MapLibre GL** con la base
  vectorial de OpenFreeMap `positron`. `index.html` elige la biblioteca; `mapa.js` usa solo la API común (`gl.`).
- La base se recorta al cargar: se apagan sus ríos y rótulos de calles y comercios; nombres en español.
- Una sola casilla, "Flujo del agua". Satélite, relieve y los 219 sitios oficiales se quitaron.
- Abre encuadrado en la zona de la red (tramos vigilados, estaciones y Valsequillo); la cuenca completa al alejar.
- Todos los ríos con un solo estilo: el mismo azul, grosor que crece poco con el orden (4 a 7). Lo vigilado se
  distingue solo por el flujo. Sin subcuencas; de la base se apagan calles, carreteras y vías, y las fronteras
  quedan en gris muy claro. Cursor propio: flecha en tinta con borde blanco (la del sistema se perdía).
- Flujo: guiones blancos del mismo grosor que el río que avanzan aguas abajo en **todos** los ríos, más los
  tramos que conectan una estación con la red (`red_vigilada.geojson`, `conexion: true`, de `96_red_estaciones.py`).
  Es un `line-pattern` cuya imagen se redibuja cada cuadro (no `line-dasharray`: en Mapbox GL 3 rehace los teselados
  de toda la red en cada paso y los ríos desaparecen al desplazar). Se enciende y apaga con la casilla "Flujo del agua" (encendida; apagada con `prefers-reduced-motion`). El sentido
  está comprobado: en 195 de 245 tramos de `red_asignacion.json` la línea termina junto a su sitio aguas abajo.
  El simulador se carga cuando el mapa termina de desplazarse (armar la escena 3D detenía el desplazamiento).
- Cuenca RH18A (31 480 km²) delimitada: máscara fuera, contorno en tinta. 14 confluencias; se rotulan solo las
  que el INEGI nombra como río en ambos brazos.
- Barra lateral plegable (botón junto al título): título, estaciones y la casilla del flujo; plegada queda una
  columna con los números.
  Fuentes en el botón de atribución.
- Al elegir una estación la barra se pliega de golpe (sin transición), el mapa (≈ 40 %) se desliza a la estación en
  0.6 s (zoom 12.6) y su simulador (58 %) se abre en un marco **por URL**, con la figura 3D completa a la vista
  (`?incrustado=1&estacion=...&vel=...&backend=...`). Lee `GET /alertas` solo para poner en rojo la estación.

**Datos para el mapa**: `scripts/60_red_para_mapa.py` lee la red del INEGI (F08) y escribe
`datos/procesados/mapa/`: red (8 184 tramos de orden ≥ 4), subcuencas, toponimia, `cuenca.geojson` (contorno
por cancelación de lados compartidos) y `confluencias.geojson` (longitud de red acumulada aguas arriba, sobre
todos los órdenes; donde un cauce se divide, lo acumulado pasa solo a la salida de mayor orden). No ordena
los sitios: eso es M1 (`70_topologia_red.py`).

## Cómo correrlo

Desde la raíz del repo:

```powershell
python -m http.server 8000
```

```powershell
python contrato/servidor_mock.py
```

- Backend real (M5) en lugar del mock, mismo puerto 8080: `backend\.venv\Scripts\python backend\servidor.py`
  (`--limpiar` empieza con la base vacía). Instalación y pruebas en `backend/README.md`. Usa el Python de
  python.org: el de MSYS2 pide Rust para compilar `pydantic-core`.
- Mapa: `http://127.0.0.1:8000/mapa/`
- Panel de autoridad (React): en `panel/`, `npm install` la primera vez y `npm run dev` → `http://localhost:5173/`
  (para ver alertas: backend o mock con `--motor real`, y `python contrato/reproducir_escenario.py descarga_industrial`)
- App ciudadana: en `ciudadano/`, `npm install` la primera vez y `npm run dev` → `http://localhost:5174/ciudadano/`
  (con el mock o el backend en el 8080; para probar en teléfono, `cloudflared tunnel --url http://localhost:5174`,
  porque la geolocalización exige HTTPS; la llave de Gemini va en `GEMINI_API_KEY` del `.env` de la raíz)
- Simulador solo: `http://127.0.0.1:8000/dispositivo/simulador/`
- Pruebas del firmware: `node dispositivo/simulador/prueba.js`
- Validar paquetes del simulador: `python contrato/validador.py lectura $env:TEMP\paquetes_simulador.json`
- Regenerar las capas del mapa: `python -I scripts/60_red_para_mapa.py`
- Reiniciar el mock limpia sus alertas (el stub acumula estado entre corridas).

Los frontends leen `contrato/fixtures/` y `datos/procesados/`, así que **hay que servir el repo desde su
raíz**; con doble clic (`file://`) el navegador bloquea la lectura. Mapa y simulador necesitan internet
(bibliotecas por CDN y base) y WebGL.

## Fronteras

- Un módulo solo puede estar bloqueado por el contrato, nunca por el código de otro. **Ningún módulo importa
  código de otro**: se hablan por JSON, HTTP o CSV.
- M4 es dueño de `dispositivo/` y no toca el contrato. `mapa/` muestra el simulador por URL.
- **Un frontend no decide el análisis ni el color por su cuenta**: lo recibe de la plataforma. El simulador
  manda cada lote a `POST /lecturas` (backend por defecto `http://127.0.0.1:8080` en localhost y `/api` del
  mismo dominio desplegado; `?backend=` vacío lo apaga) y solo muestra las `alertas` que devuelva; si no
  responde, sigue igual y no inventa nada. Con backend, su reloj arranca en la hora real o justo después de
  la última lectura guardada (recargar continúa, no rebobina); sin backend, desde `T0_DEFECTO`.
- Los datos de entrada del simulador y del mapa se **leen** de `contrato/fixtures/` y `datos/procesados/`;
  no se duplican.

## Preferencias de diseño del usuario (importante)

El usuario rechazó explícitamente el diseño con aspecto "hecho por IA" y lo ha repetido varias veces:

- **Nada que no se lea de un vistazo.** Sin tablas, notas bajo gráficas, paneles plegados de pruebas,
  leyendas largas, textos de fuentes ni de estado del backend. Nadie se detiene en estas vistas: solo
  justifican la medición. Lo que sobra va a la documentación, no a la pantalla.
- **Evitar:** fondo azul marino con acento turquesa, brillos y resplandores, paneles translúcidos flotantes,
  todo en tarjetas idénticas, etiquetas en mayúsculas pequeñas con espaciado, píldoras y chips, numerales
  encerrados (①②③), partículas y movimiento decorativo, leyendas que repiten lo evidente, color sin
  información (por ejemplo semáforo en 219 sitios).
- **Hacer:** tema claro, trazo fino, un azul para el agua, tinta para las estaciones, rojo solo para una alarma
  real, filetes en lugar de tarjetas, jerarquía clara, tipografía Public Sans. Solo se mueve lo que cambia
  con el dato.
- Le gusta ver los componentes del dispositivo descritos dentro de la figura, sin separarlos en otra sección, y
  poder abrir cada uno de cerca.
- Lo que ya decidió en la figura 3D y el mapa (no volver a proponer lo contrario):
  - Rótulos **sin fondo blanco**: tinta con contorno blanco. Estados en palabras llanas, no jerga del firmware.
  - Realismo moderado, día soleado fijo, árboles en huso (ahuejotes), zacatón en vez de arbustos redondos,
    nubes difusas (no cúmulos), cielo azul intenso.
  - Mapa: ríos de un solo estilo (nada de unos más gruesos o más tenues que otros), flujo en **guiones blancos**
    (no círculos ni trazo oscuro), sin satélite, relieve, sitios oficiales, subcuencas ni calles.
  - Cambios de vista rápidos y sin pausas: nada que bloquee el hilo durante una animación.
- La red de estaciones es chica a propósito (presupuesto): no proponer más estaciones sin justificar el costo.
- **Excepción, el panel de autoridad (`panel/`)**: mismo aspecto que la app ciudadana (kit gob.mx v3 como
  SIGRIV): barra verde oscuro con el logotipo, Montserrat y Noto Sans, guinda y dorado, tarjetas redondeadas.
  Los niveles de alerta van en rojo, amarillo y azul (D22). Ya no carga la hoja del SND (D31, revisada).
- **Excepción, la app ciudadana (`ciudadano/`)**: replica el aspecto de SIGRIV a pedido del usuario: kit gob.mx v3,
  Montserrat y Noto Sans, guinda y dorado, barra verde oscuro con el logotipo del Gobierno de México, mapa a
  pantalla completa y hoja inferior (D28). Ahí sí hay botones redondeados y sombras.
- Toda cifra mostrada lleva su `n` y su fecha (I12). "Sin dato" es un estado visible, no un hueco (I13).

## Trampas conocidas

- Leer CSV con `encoding='utf-8-sig'`, no `utf-8` (invariante I4).
- Scripts de datos con `python -I`; `_comun.py` se importa con `importlib` y ruta explícita.
- Un script nuevo no debe duplicar lo que vive en `scripts/_comun.py`.
- `datos/crudos/` y `datos/geo/` no se versionan y no se editan nunca (I1, I15).
- **Token de Mapbox**: vive en el `.env` de la raíz (`MAPBOX_ACCESS_TOKEN`) y `python -I mapa/generar_config.py`
  lo copia a `mapa/config.js`; `.env`, `config.js` y `mapbox.txt` están en `.gitignore`. Nunca lo escribas en un
  archivo versionado ni lo repitas en la conversación. `mapa/config.ejemplo.js` muestra el formato.
- **Caché del navegador**: `index.html` del mapa y del simulador cargan sus `.js` y `.css` con `?v=N`. Sube el
  número al cambiarlos o el navegador seguirá usando la versión vieja.
- **Panel del navegador de la app**: si está oculto, `requestAnimationFrame` se pausa y MapLibre/Mapbox y
  Three.js no dibujan (capturas en blanco). Muéstralo antes de verificar; para el estado sin animación usa
  `window.mapaAtoyac.jumpTo({center, zoom})`. Con el panel angosto (< 900 px) la barra lateral del mapa empieza plegada y, con una estación abierta, el mapa se oculta.
- Barras invertidas y comillas dentro de un heredoc de `python -` se estropean al pasar por la herramienta de
  shell: escribe un archivo `.py` en el scratchpad y ejecútalo.
- Los nombres de las confluencias salen de la toponimia dispersa del INEGI y pueden fallar en barrancas; por eso
  solo se rotulan las de río en ambos brazos.
- Descargar archivos requiere permiso explícito del usuario: dilo con nombre, origen y tamaño antes.
- **Verificar en el navegador de la app**: con el panel oculto, la base de Mapbox puede no terminar de cargar
  nunca (el mapa no se puede revisar: pide al usuario que muestre el panel o que lo revise él). El simulador sí
  carga. La captura recorta a 800 × 600: usa `resize_window` a 1280 × 800 y regresa a `desktop` al terminar.
- Los servidores de vista previa están en `.claude/launch.json` de la carpeta **padre** (`nacional/`, fuera del
  repo): `estatico` (8000), `mock` (8080, `--motor real`) y `sitio` (8001, sirve `panel/dist` para probar el
  despliegue ensamblado). El mock guarda alertas entre corridas: reinícialo.
- **Despliegue**: lo que se publica lo decide `panel/scripts/ensamblar-sitio.mjs` (copia mapa, simulador, capas
  y fixtures a `panel/dist`, y escribe `mapa/config.js` desde `MAPBOX_ACCESS_TOKEN`). Si una vista nueva lee otro
  archivo, agrégalo ahí o en Vercel dará 404. Para probarlo en local sin compilar: crea `panel/dist/index.html` y
  `ciudadano/dist/index.html` de relleno, corre el script, sirve con `sitio` y borra ambos `dist` al terminar.
- **Dos simuladores a la vez en el sitio desplegado** mandan historias distintas de las mismas estaciones al
  mismo backend. La base no se corrompe (candado por estación, reenvío idempotente), pero el motor se rehidrata
  por orden de llegada y las alertas pueden salir mezcladas. Propuesto y sin respuesta del usuario: un "turno"
  (un solo simulador alimenta la plataforma y los demás solo miran). Toca backend y contrato (Evaristo y
  Carlos): no implementarlo sin su visto bueno.
- **Rebase con conflicto en `06-registro-de-cambios.md`**: pasa casi siempre (todos escriben arriba). Se conservan
  las entradas de los dos lados, las nuestras primero, separadas por `---`; luego se vuelve a verificar.
- Mapbox GL 3: no animar `line-dasharray` (rehace los teselados de toda la red); usar una imagen `line-pattern`
  que se redibuja (`StyleImageInterface`). Las líneas del INEGI van en el sentido del flujo.
- El simulador incrustado arma su escena en el mismo hilo que el mapa: se carga después del desplazamiento.

## Lo que sigue (en orden)

Ya hay datos (M0), sensor simulado (M4), mapa (M6), topología (M1), motor de reglas (M2), propagación (M3),
backend (M5), panel de autoridad (M7), prototipo de app ciudadana (M8) y la red de estaciones decidida. Falta:

0. **Cambio de rumbo (docs/19): mecanismos junto a escuelas rurales.** El usuario eligió el **colector completo** (banda,
   motor, cámara, panel y módem propios), que va con cada estación reubicada. `scripts/99_reubicacion.py` escribe
   `contrato/fixtures/mecanismos.json` (`EST-ESC-01..05` con `COL-ESC-01..05`); simulador y mapa ya los leen, y el motor y el
   mock los registran junto a las 5 del Atoyac. Pendiente: línea base de sus sitios CONAGUA (hoy ninguno está en
   `linea_base.json`: el motor solo los compara contra su historia reciente y el simulador usa `banda_simulacion`;
   regenerarla pide los crudos F05). **Todos los mecanismos están en el Alto Atoyac** (`_comun.SUBCUENCAS_ALTO_ATOYAC`) y junto
   a un cauce; `escuelas.json` incluye todas las escuelas del catálogo de esa zona. Ficha del colector
   (`dispositivo/ficha-colector.md`), D32 y propuesta de contrato para su paquete; costos (M10).
   **Módulo de ladera** construido en el simulador (`EST-LAD-01..05`) y **reglas de derrumbe en el motor** (`_ladera` en
   `motor/reglas.py`), con el umbral de humedad calibrado por el suelo de cada ladera (`scripts/103_suelo_laderas.py`,
   SoilGrids, 43.5 a 49.9 %); la figura de ladera tiene un arroyo al pie del cerro que crece con la lluvia. Falta calibrar en campo (muestra
   gravimétrica al instalar y una temporada del sensor con `--serie`) y confirmar el umbral de saturación (0.9 es hipótesis).
1. **Pendientes de la red nueva de estaciones** (fixtures regenerados con las 5 de docs/18):
   - correr `backend/prueba.py` (ya espera 0, 1, 5, 3 y 0 alertas; necesita el entorno del backend);
   - recapturar `panel/public/demo/foto.json` con el backend real (`npm run capturar-demo`);
   - `contrato/fixtures/prediccion_ejemplo.json` sigue sobre DLTLA2582; regenerarlo pide `muestreo_nucleo.csv`.
2. Confirmar en pantalla, con el panel del navegador visible, que el flujo del mapa va aguas abajo y que el mapa
   se desplaza fluido (se cambió a `line-pattern` y no se vio animado).
3. Un solo proyecto de Vercel con panel (`/`), app (`/ciudadano/`), mapa con las estaciones (`/mapa/`), simulador
   (`/dispositivo/simulador/`) y backend (`/api`); `MAPBOX_ACCESS_TOKEN` opcional para la base de Mapbox; falta confirmar `DATABASE_URL` de Supabase y `GEMINI_API_KEY` (pasos en `backend/README.md`).
   `/mapa/` se agregó en `43de9b7` y se probó en local ensamblado; falta confirmar que carga en Vercel. Decidir
   el "turno" de simuladores (ver Trampas).
   Antes de un uso real, autenticación en `POST /lecturas` y `PATCH /alertas`, e inicio de sesión en M7.
4. M6: pluma aguas abajo con la ventana de llegada de M3 (`GET /alertas/<c_alerta>/prediccion`) y color por el
   índice de la plataforma; probar a ancho de teléfono. Sin añadir ruido a la vista.
5. M8: probar la app en un teléfono real.
6. M9 demo de punta a punta y M10: cotizar (empezar por la sonda de turbiedad con limpiador), medir señal LTE-M
   en los 5 sitios, confirmar flujo todo el año en Zahuapan y Alseseca, manual y propuesta por fases.

## Convenciones

- Commits: **cortos y concretos.** Prefijo del módulo, primera línea de una sola idea, y a lo
  más tres o cuatro líneas de cuerpo con el por qué y el número si lo hay. El detalle largo va
  al registro de cambios (`docs/contexto/06-registro-de-cambios.md`), no al mensaje del commit.
- El `README.md` es una descripción general del proyecto para quien llega. Las instrucciones
  para agentes de IA van en este archivo y en `docs/contexto/`, no ahí.
- **No editar `README.md` hasta el cierre del proyecto.** Cambiaba en cada iteración, lo que
  volvía su historial ruido. Se actualiza una vez, al final, cuando el estado de los módulos
  ya no se mueva. El estado vivo se lleva en `docs/12-estado-y-traspaso.md` y en la tabla de
  módulos de este archivo.
- **No hacer `commit` ni `push` sin preguntar al usuario.** Dejar el trabajo listo y
  verificado en el árbol, decir qué cambió, y esperar.
- Ante una decisión técnica con dos caminos razonables, **elegir el más coherente y
  justificable y explicar por qué**, en lugar de devolverle la elección al usuario. Las
  preguntas se reservan para lo que de verdad es su decisión: alcance, prioridad y permiso.
- Rama `main` del remoto del equipo. Sin líneas de coautor en los commits.
- El estado para traspaso vive en `docs/12-estado-y-traspaso.md`: se actualiza al hacer push, no en cada cambio.
- Commit y push solo cuando el usuario lo pide. Remoto: `Wharf-Code-Solutions/HackatecNacional`.
- Decisiones técnicas numeradas en `docs/05-decisiones-tecnicas.md` (hoy D1 a D31).
- Cada cifra de la documentación sale de un archivo o de una corrida; si no puedes rastrearla, verifícala.

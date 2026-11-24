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
| M4 dispositivo | Simulador web construido y probado (`dispositivo/`), figura 3D y línea de tiempo de recepción. **Sin hardware**: las especificaciones son supuestos de diseño |
| M6 mapa | Prototipo (`mapa/`): cuenca RH18A delimitada, red del INEGI, 14 confluencias, 219 sitios, 5 estaciones con su simulador. No colorea por índice ni está probado a ancho de teléfono |
| M1 topología (orden aguas arriba → abajo) | **Construida** (`scripts/70_topologia_red.py` → `datos/procesados/red/`): 210 de 219 sitios con sucesor y distancia sobre el cauce; 14 marcados para revisión |
| M2 motor de reglas | **Construido** (`motor/reglas.py`): 0 alertas en el día de control contra 31 del stub, 0 ambientales con el sensor roto, los tres eventos detectados antes de su intensidad plena y su fuente bien clasificada. `servidor_mock.py --motor real` lo usa |
| M3 propagación | **Construida** (`scripts/80_propagacion.py`): transporte conservativo con k = 0, porque la razón medida abajo/arriba en 90 tramos tiene mediana 1.00. Ventana de llegada por velocidad declarada 0.3-1.0 m/s; valor como banda p10-p90; cobertura 78 % fuera de muestra |
| M7 panel de autoridad | **Construido** (`panel/`): alertas con evidencia y gráficas, fuente probable con puntaje, predicción de M3 (ventanas de llegada aguas abajo), estado y responsable vía `PATCH /alertas/<c_alerta>`; React con Vite en Vercel, modo demostración sin backend (D23). Sin inicio de sesión |
| Modelos proxy | Conductividad→SDT **publicado** (2 % de error fuera de muestra); turbiedad→SST **descartado** (35 %) |
| M5 backend | **Construido** (`backend/`): FastAPI, SQLite en local y Postgres en Vercel (`/api` del mismo proyecto que el panel, D25); mismas respuestas que el mock (`backend/prueba.py` lo compara en vivo); motor sin memoria entre peticiones; `GET /alertas/<c_alerta>/prediccion` con M3. Sin autenticación |
| M8 app, M9, M10 | Pendientes |

No conviertas "pendiente" en "construido" sin verificarlo contra el repo.

## Lo construido

**Dispositivo (`dispositivo/`)**: la estación centinela, simulada (D18: simulador propio, no Wokwi ni hardware).
- Cuatro bloques: sondas (OD, pH, conductividad K=1, temperatura, turbiedad), controlador (ESP32 + RTC + SD),
  comunicación (módem LTE-M, `POST /lecturas`) y energía (panel 5 W + 2×18650). Detalle en `ficha-tecnica.md`.
- `simulador/`: `modelo.js` (agua con la banda histórica real, sondas con sesgo, deriva, ensuciamiento y fallas,
  energía, enlace), `firmware.js` (máquina de estados pura), `montaje.js`, `prueba.js`, `escena.js`,
  `recepcion.js`, `ui.js`.
- **Pantalla (D19, D20)**: solo tres cosas.
  - Figura 3D (Three.js r149 desde unpkg; materiales físicos, texturas dibujadas en código sin descargas,
    sombras y luz fija de día soleado aunque la hora simulada sea de noche, D19; se dibuja en cada cuadro): valle casi plano con el río en un cauce de taludes de tierra que
    serpentea, agua verde grisácea que se vuelve café con la turbiedad, cielo con nubes, 12 ahuejotes al fondo, pasto, carrizo y macollos de zacatón en las orillas, corriente simulada (`Agua.velocidad`) que mueve el agua y un volcán
    tenue al fondo (niebla); corte frontal con el perfil en tinta. Sondas en su tubo, cable, gabinete abierto con
    controlador, SD (un cubo por paquete pendiente), módem y baterías, panel, antena y torre celular. Rótulos
    HTML con nombre y dato vivo. La estación está a 1.6× respecto al río para que se lea. Se gira arrastrando.
    Clic en las sondas (o su rótulo): vista de cerca con la cabeza de cada sonda, qué mide y su estado vivo;
    calentamiento y medición a tiempo real mientras está abierta; "Vista general" o Esc regresa.
    Cada envío (ACK del firmware) se dibuja en 2.3 s reales: antena encendida, paquete a la torre,
    confirmación de vuelta y la SD se vacía; el reloj no se detiene.
  - Recepción: pestañas con el último valor de cada parámetro y línea de tiempo de 12 h; punto lleno =
    recibido por la plataforma, vacío = en la SD; franja de fondo = rango habitual del sitio.
  - Cuatro pruebas: descarga industrial, descarga orgánica, lluvia, corte de enlace. Si el backend abre una
    alerta, una línea en rojo.
  - Las fallas de sonda, mantenimiento y clima siguen en el modelo y en `prueba.js`, no en pantalla.
- Medido: 96 paquetes por día y estación, 0 pérdidas en un corte de 4 h, consumo ≈ 1.4 Wh/día, autonomía sin
  sol ≈ 14 días.
- Reglas del firmware: escribe en la SD antes de enviar y borra tras el ACK; reenvía con la hora original;
  no corrige valores (manda el crudo, `null` si la sonda no responde, `-999` si está rota); **nunca emite
  alertas** (eso es del backend, invariante I10); muestreo adaptativo; ahorro por batería.

**Mapa (`mapa/`)** (D20, D21):
- Con token en `mapa/config.js` usa **Mapbox GL JS 3.8** (`light-v11`, relieve de Mapbox). Sin token usa
  **MapLibre GL** con la base vectorial de OpenFreeMap `positron` y relieve Terrarium de AWS. `index.html` elige
  la biblioteca; `mapa.js` usa solo la API común (`gl.`).
- La base se recorta al cargar: se apagan sus ríos y rótulos de calles y comercios; nombres en español.
- Capas opcionales, apagadas por defecto: **Satélite** (Esri World Imagery, sin llave, en ambos modos; el
  satélite de Mapbox respondió 429 con nuestra cuenta) y **Relieve**. **Sitios oficiales** encendida.
- Cuenca RH18A (10 subcuencas, 31 480 km²) delimitada: máscara fuera, contorno en tinta. Ríos con grosor por
  orden y zoom. 14 confluencias; se rotulan solo las que el INEGI nombra como río en ambos brazos.
- Barra lateral: título, 5 estaciones y las casillas. Fuentes en el botón de atribución.
- Al elegir una estación se acerca y abre su simulador en un marco **por URL**
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
- Simulador solo: `http://127.0.0.1:8000/dispositivo/simulador/`
- Pruebas del firmware: `node dispositivo/simulador/prueba.js`
- Validar paquetes del simulador: `python contrato/validador.py lectura $env:TEMP\paquetes_simulador.json`
- Regenerar las capas del mapa: `python -I scripts/60_red_para_mapa.py`
- Reiniciar el mock limpia sus alertas (el stub acumula estado entre corridas).

Los frontends leen `contrato/fixtures/` y `datos/procesados/`, así que **hay que servir el repo desde su
raíz**; con doble clic (`file://`) el navegador bloquea la lectura. Mapa y simulador necesitan internet
(bibliotecas por CDN, base, satélite, relieve) y WebGL.

## Fronteras

- Un módulo solo puede estar bloqueado por el contrato, nunca por el código de otro. **Ningún módulo importa
  código de otro**: se hablan por JSON, HTTP o CSV.
- M4 es dueño de `dispositivo/` y no toca el contrato. `mapa/` muestra el simulador por URL.
- **Un frontend no decide el análisis ni el color por su cuenta**: lo recibe de la plataforma. El simulador
  manda cada lote a `POST /lecturas` (backend por defecto `http://127.0.0.1:8080`, `?backend=` vacío lo
  apaga) y solo muestra las `alertas` que devuelva; si no responde, sigue igual y no inventa nada.
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
- Le gusta ver los componentes del dispositivo descritos dentro de la figura, sin separarlos en otra sección.
- **Excepción, el panel de autoridad (`panel/`)**: usa el Sistema Nacional de Diseño del gobierno (snd.gob.mx),
  tema guinda, Noto Sans; los niveles de alerta van en rojo, amarillo y azul semánticos del SND (D22).
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
  `window.mapaAtoyac.jumpTo({center, zoom})`. Con el panel angosto (< 900 px) la barra lateral del mapa se oculta.
- Barras invertidas y comillas dentro de un heredoc de `python -` se estropean al pasar por la herramienta de
  shell: escribe un archivo `.py` en el scratchpad y ejecútalo.
- Los nombres de las confluencias salen de la toponimia dispersa del INEGI y pueden fallar en barrancas; por eso
  solo se rotulan las de río en ambos brazos.
- Descargar archivos requiere permiso explícito del usuario: dilo con nombre, origen y tamaño antes.

## Lo que sigue (en orden)

Ya hay datos (M0), sensor simulado (M4), mapa (M6), topología (M1), motor de reglas (M2), propagación
(M3), backend (M5) y panel de autoridad (M7), desplegados en Vercel. Falta:

1. Desplegar panel y backend en un solo proyecto de Vercel con la base en Supabase (pasos en `backend/README.md`). Antes de un uso real, autenticación en `POST /lecturas` y `PATCH /alertas`.
2. M6: pluma aguas abajo con la ventana de llegada de M3 (ya la sirve `GET /alertas/<c_alerta>/prediccion`)
   y color por el índice de la plataforma; probar a ancho de teléfono. Sin añadir ruido a la vista.
3. M8 app ciudadana. En M7, inicio de sesión antes de un uso real.
4. M9 demo de punta a punta y M10 costos, manual y propuesta por fases.
5. Hardware: validar especificaciones de sondas, medir consumo en banco y cobertura celular por sitio; cotizar
   costos incluyendo calibración y reposición de sondas.

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
- Decisiones técnicas numeradas en `docs/05-decisiones-tecnicas.md` (hoy D1 a D21).
- Cada cifra de la documentación sale de un archivo o de una corrida; si no puedes rastrearla, verifícala.

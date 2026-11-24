# CLAUDE.md · HackaTec 2026, reto SECIHTI Puebla

Sistema de monitoreo y alertamiento de contaminación del río Atoyac (cuenca del Alto Atoyac, Puebla y
Tlaxcala). Idioma del proyecto, de la documentación y de la conversación: **español**.

## Antes de tocar algo

1. Lee `docs/contexto/00-LEEME-PRIMERO.md` y `01-invariantes.md`. Son las reglas que no se rompen.
2. Ubica el archivo en `docs/contexto/02-mapa-del-repo.md`. Si es derivado (CSV procesados,
   fixtures, `08-` y `09-` de documentación), **no lo edites: edita su generador**.
3. Busca tu tipo de cambio en `05-protocolo-de-cambios.md`. Casi todo cambio arrastra documentación.
4. Al terminar corre `python -I scripts/50_verificar_repo.py` (debe decir "Todas las comprobaciones
   mecanicas pasan"). Si el cambio es relevante, añade una entrada al registro
   (`docs/contexto/06-registro-de-cambios.md`, solo se añade, lo más reciente arriba).

## La idea central

En un río que ya está permanentemente fuera de norma, un umbral fijo está encendido desde 2012 y no informa
nada. **Lo que detecta un evento nuevo es la desviación respecto de la historia del propio punto.** El
semáforo de CONAGUA existe solo en la vista ciudadana: 176 de 198 sitios con dato están en rojo, así que el
color no ordena nada y **no se usa para pintar el mapa** (decisión D9).

## Estado de los módulos

| Módulo | Estado |
|---|---|
| M0 datos y contrato | Construido: 219 sitios, 145 703 resultados 2012-2025, 7 esquemas v1.0, fixtures, servidor mock |
| M4 dispositivo | Simulador web construido y probado (`dispositivo/`). **Sin hardware**: las especificaciones son supuestos de diseño |
| M6 mapa | Prototipo (`mapa/`): ríos, subcuencas, 219 sitios y 5 estaciones con zoom al simulador |
| M1 topología (orden aguas arriba → abajo) | **Construida** (`scripts/70_topologia_red.py` → `datos/procesados/red/`): 210 de 219 sitios con sucesor y distancia sobre el cauce; 14 marcados para revisión |
| M2 motor de reglas | **Pendiente**. El mock trae un evaluador `stub` que no discrimina (31 alertas en un día sin incidente) |
| M3 propagación | **Pendiente, desbloqueada**: ya tiene la topología |
| M5 backend, M7 panel, M8 app, M9, M10 | Pendientes |

No conviertas "pendiente" en "construido" sin verificarlo contra el repo.

## Lo que se construyó en esta sesión

**Dispositivo (`dispositivo/`)**: la estación centinela, simulada.
- La figura del simulador muestra la estación como una caja con tres renglones (controlador, comunicación,
  energía), cada uno con su dato vivo, más el panel solar y la antena. El usuario quiere ver los componentes
  ahí, sin separarlos en otra sección ni añadir ruido: es información de paso.
- Cuatro bloques: sondas (OD, pH, conductividad K=1, temperatura, turbiedad), controlador (ESP32 + RTC + SD),
  comunicación (módem LTE-M, `POST /lecturas`) y energía (panel 5 W + 2×18650).
- `ficha-tecnica.md`: rangos, ciclo, consumos, lo medido y lo pendiente de validar.
- `simulador/modelo.js` (agua con la banda histórica real, sondas con sesgo, deriva, ensuciamiento y fallas,
  energía, enlace), `firmware.js` (máquina de estados pura), `montaje.js`, `prueba.js`, `escena.js`, `ui.js`.
- Decisión D18: simulador propio, no Wokwi ni hardware.
- Resultados medidos: 96 paquetes por día y estación, 0 pérdidas en un corte de 4 h, consumo ≈ 1.4 Wh/día,
  autonomía sin sol ≈ 14 días. La estimación a mano de 1.1 Wh/día y 19 días quedó corregida.
- Reglas del firmware: escribe en la SD antes de enviar y borra tras el ACK; reenvía con la hora original;
  no corrige valores (manda el crudo, `null` si la sonda no responde, `-999` si está rota); **nunca emite
  alertas** (eso es del backend, invariante I10); muestreo adaptativo; ahorro por batería.

**Mapa (`mapa/`)**: Leaflet + relieve sombreado de Esri con nombres de lugares encima (sin llave; sin calles
ni ríos propios, para que la red del INEGI sea lo único que se lee como agua). Barra lateral plana con
la lista de las 5 estaciones como índice y leyenda. Al elegir una estación se acerca y muestra su simulador en
un marco **por URL**, sin importar código (`?incrustado=1&estacion=...&vel=...&backend=...`). Lee `GET /alertas`.

**Datos para el mapa**: `scripts/60_red_para_mapa.py` lee la red hidrográfica del INEGI (F08) y escribe
`datos/procesados/mapa/` (8 184 tramos de orden ≥ 4, 10 subcuencas, toponimia). No calcula topología.
CARTO ya exige llave y OpenStreetMap competía con los ríos; por eso se usa el relieve de Esri.

## Cómo correrlo

```powershell
python -m http.server 8000
```

```powershell
python contrato/servidor_mock.py
```

- Mapa: `http://127.0.0.1:8000/mapa/`
- Simulador solo: `http://127.0.0.1:8000/dispositivo/simulador/`
- Pruebas del firmware: `node dispositivo/simulador/prueba.js`
- Validar paquetes del simulador: `python contrato/validador.py lectura $env:TEMP\paquetes_simulador.json`
- Reiniciar el mock limpia sus alertas (el stub acumula estado entre corridas).

Los frontends leen `contrato/fixtures/`, así que **hay que servir el repo desde su raíz**; con doble clic
(`file://`) el navegador bloquea la lectura.

## Fronteras

- Un módulo solo puede estar bloqueado por el contrato, nunca por el código de otro. **Ningún módulo importa
  código de otro**: se hablan por JSON, HTTP o CSV.
- M4 es dueño de `dispositivo/` y no toca el contrato. `mapa/` muestra el simulador por URL.
- **Un frontend no decide el análisis ni el color por su cuenta**: lo recibe en el veredicto de la plataforma.
  El simulador muestra `veredictos[].parametros[].posicion_en_banda` y `veredictos[].alertas` de la respuesta
  de `POST /lecturas`; si el backend no está conectado, dice "sin conexión" y no inventa un resultado.
- Los datos de entrada del simulador y del mapa se **leen** de `contrato/fixtures/` y `datos/procesados/`;
  no se duplican.

## Preferencias de diseño del usuario (importante)

El usuario rechazó explícitamente el diseño con aspecto "hecho por IA" y pidió quitar ruido visual.

- **Mostrar solo información útil.** Las vistas de demo existen porque no hay prototipo físico: deben mostrar
  qué mide el sensor, qué análisis hace la plataforma y si hay alarma. Lo demás va plegado o fuera.
- **Evitar:** fondo azul marino con acento turquesa, brillos y resplandores, paneles translúcidos flotantes,
  todo en tarjetas idénticas, etiquetas en mayúsculas pequeñas con espaciado, píldoras y chips, numerales
  encerrados (①②③), partículas y movimiento decorativo, leyendas que repiten lo evidente, color sin
  información (por ejemplo semáforo en 219 sitios).
- **Hacer:** tema claro, trazo fino, un azul para el agua, tinta para las estaciones, rojo solo para una alarma
  real, filetes en lugar de tarjetas, jerarquía clara, tipografía Public Sans. Solo se mueve lo que cambia
  con el dato.
- Toda cifra mostrada lleva su `n` y su fecha (I12). "Sin dato" es un estado visible, no un hueco (I13).

## Trampas conocidas

- Leer CSV con `encoding='utf-8-sig'`, no `utf-8` (invariante I4).
- Scripts de datos con `python -I`; `_comun.py` se importa con `importlib` y ruta explícita.
- Un script nuevo no debe duplicar lo que vive en `scripts/_comun.py`.
- `datos/crudos/` y `datos/geo/` no se versionan y no se editan nunca (I1, I15).
- En el panel del navegador de la app, las animaciones con `requestAnimationFrame` se pausan si el panel
  está oculto; el zoom animado del mapa y el movimiento del simulador no avanzan ahí. Para verificar el estado
  final usa `window.mapaAtoyac.setView(..., {animate: false})` o abre la página en el navegador normal.
- Barras invertidas dentro de un heredoc de `python -` se estropean al pasar por la herramienta de shell:
  escribe un archivo `.py` o usa `chr(92)`.
- Descargar archivos requiere permiso explícito del usuario: dilo con nombre, origen y tamaño antes.

## Lo que sigue (en orden)

En palabras llanas: ya hay **datos** (M0), un **sensor simulado** (M4) y un **mapa** (M6). Falta el cerebro.
M1 dice qué sitio está río arriba de cuál; M2 decide si una lectura es alarma comparándola con la historia
del punto; M3 usa ambos para estimar hasta dónde y cuándo llega la contaminación. M5 es el servidor real que
reemplaza al mock; M7 y M8 son pantallas para la autoridad y la ciudadanía; M9 es la demo de punta a punta.
**M1 y M2 no dependen de nada pendiente y pueden empezarse ya, en paralelo.**

1. M1, topología: proyectar los 219 sitios sobre la red del INEGI y ordenarlos (la red ya está en `datos/geo/`;
   `60_red_para_mapa.py` incluye un lector de shapefile y dbf sin dependencias). Los tramos traen `ORDER_1`,
   `ARBSUM_1` y `FLOWDIR`.
2. M2, motor de reglas real: criterio de terminado, a lo más 2 alertas en `normal` y evento detectado en menos
   de 45 minutos simulados.
3. M3, propagación sobre la topología; luego mostrar la pluma aguas abajo en el mapa.
4. Hardware: validar especificaciones de sondas, medir consumo en banco y cobertura celular por sitio; cotizar
   costos incluyendo calibración y reposición de sondas.

## Convenciones

- Commits: prefijo del módulo, primera línea corta, cuerpo con el por qué y el número si lo hay.
- Rama `main` del remoto del equipo. Sin líneas de coautor en los commits.
- El estado para traspaso a compañeros vive en `docs/12-estado-y-traspaso.md`: actualízalo al
  terminar un módulo.
- Cada cifra de la documentación sale de un archivo o de una corrida; si no puedes rastrearla, verifícala.

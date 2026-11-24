# Estado actual y traspaso

**Corte: 2026-11-24.** Para quien se incorpora o toma un módulo nuevo: qué hay, qué falta, qué
puede empezarse hoy sin esperar a nadie y por dónde entrar. Los criterios de terminado completos
están en [11-metodologia-modulos.md](11-metodologia-modulos.md); las reglas del repositorio, en
[`contexto/00-LEEME-PRIMERO.md`](contexto/00-LEEME-PRIMERO.md).

## En una frase

Hay **datos** (M0), un **dispositivo simulado** (M4), un **mapa** (M6), la **topología del río**
(M1), el **motor de reglas** (M2) y la **propagación** (M3). Lo que falta es juntarlo: un backend
real (M5), las pantallas que consumen sus resultados (M6 completo, M7, M8) y la demo de punta a
punta (M9).

## Lo que se hizo, en el orden en que se hizo

1. **Recolección de datos de la cuenca del Alto Atoyac** (M0): 219 sitios, 145 703 resultados de
   2012 a 2025, línea base por sitio y parámetro, contrato de datos v1.0 con 7 esquemas, fixtures con
   5 estaciones y 5 escenarios de un día, y un servidor mock.
2. **Diseño del dispositivo a partir de esos datos** (M4): una estación centinela con cuatro bloques
   (sondas, controlador, comunicación, energía), con rangos elegidos contra lo que el río registra.
   No hay hardware: se presenta con un simulador web que corre la lógica del firmware.
3. **Representación de la cuenca y del mecanismo** (M6): mapa con la cuenca delimitada, la red del
   INEGI, sus confluencias, los 219 sitios oficiales y las 5 estaciones; al elegir una estación se
   abre su simulador en 3D.
4. **El análisis** (M1, M2, M3): orden de los sitios sobre el cauce, motor de reglas contra la
   historia de cada punto y ventana de llegada aguas abajo.

## Estado por módulo

| Módulo | Estado | Dónde |
|---|---|---|
| M0 Datos y contrato | **Construido** | `datos/`, `contrato/`, `scripts/` |
| M1 Topología | **Construida.** 210 de 219 sitios con sucesor; 14 marcados para revisión | `datos/procesados/red/`, `docs/13-topologia-red.md` |
| M2 Motor de reglas | **Construido.** 0 alertas en el día de control contra 31 del provisional; los tres eventos detectados y clasificados | `motor/`, `docs/15-motor-reglas.md` |
| M3 Propagación | **Construida.** Modelo calibrado con 90 tramos del propio río, cobertura 78 % fuera de muestra | `scripts/80_propagacion.py`, `docs/14-propagacion.md` |
| M4 Dispositivo | **Simulador construido y probado; sin hardware.** Figura 3D y línea de tiempo de recepción | `dispositivo/` |
| M5 Backend | **Construido.** FastAPI; SQLite en local y Postgres en Vercel, en `/api` del mismo proyecto que el panel; mismas respuestas que el mock, comparado en vivo; sin memoria entre peticiones; predicción de M3. Sin autenticación | `backend/`, `api/` |
| M6 Mapa | **Prototipo**: cuenca delimitada y confluencias (aún no colorea por índice ni está probado a ancho de teléfono) | `mapa/` |
| M7 Panel de autoridad | **Construido.** Alertas con evidencia y gráficas, fuente probable con puntaje, predicción de M3 y cambio de estado y responsable; React con Vite, desplegado en Vercel. Dos secciones: monitoreo del prototipo y gestión de reportes ciudadanos (mapa con huella, prioridad con desglose, fotos y cambio de estado). Sin inicio de sesión | `panel/` |
| M8 App ciudadana | **Prototipo.** PWA con el flujo de SIGRIV: mapa con pin central, reporte con cámara o galería, foto validada con Gemini, folio, rastreo, cola sin señal y modo demostración. Probada contra el mock a 390 px; **falta probarla en un teléfono real** y la validación con fotos reales | `ciudadano/`, `docs/17-plan-app-ciudadana.md` |
| M9 Integración | Pendiente | — |
| M10 Documentación y costos | En curso. **Red de 5 estaciones decidida** (cobertura, enlace por la red celular existente y costos por cotizar, `docs/18`); faltan cotización, manual por usuario y propuesta por fases | `docs/`, `scripts/96_red_estaciones.py` |

## Qué se puede tomar hoy sin esperar a nadie

### M5, backend (recomendado: es lo que une todo)

- **Qué es.** El servidor real que reemplaza al mock: recibe `POST /lecturas`, llama a
  `motor/reglas.py` (M2), guarda lecturas y alertas, y sirve `GET /alertas` y la predicción de M3.
- **Entradas listas.** El mock (`contrato/servidor_mock.py --motor real`) es la especificación
  ejecutable; `contrato/fixtures/prediccion_ejemplo.json` muestra la salida de M3.
- **Terminado.** `reproducir_escenario.py normal --url <backend>` corre sin errores de contrato,
  rechaza con 422 lo mismo que el mock y los datos persisten tras reiniciar.
- **Frontera.** El simulador y el mapa ya hablan por el contrato: al apuntarlos al backend real
  (`?backend=` y `?mock=`) funcionan sin tocar su código.

### M6, mapa con el análisis

- Mostrar la pluma aguas abajo de una alerta con la ventana de llegada de M3
  (`datos/procesados/red/tiempo_viaje.csv`, `prediccion_ejemplo.json`) y colorear por el índice que
  devuelva la plataforma, no por el semáforo (D9). Probarlo a ancho de teléfono.
- Las vistas siguen la regla del proyecto: solo lo que se lee de un vistazo (D20).

### M7 y M8, panel y app

- Pueden empezarse contra el mock con `--motor real`: lista de alertas con su evidencia y
  predicción (M7), reporte ciudadano con foto sin EXIF y folio (M8).

### M10, documentación del reto

- La red está decidida en [18-red-de-estaciones.md](18-red-de-estaciones.md): 5 estaciones en cadena
  del Zahuapan y Tepetitla a Puebla y el Alseseca, elegidas por cobertura de establecimientos DENUE.
  Los fixtures ya son esas 5. Falta cotizar (empezar por la sonda de turbiedad con limpiador) y medir
  la señal LTE-M en cada sitio.
- Pendientes que no dependen de código: manual breve por tipo de usuario y propuesta de implementación por fases. La ficha del
  dispositivo ya existe: [`dispositivo/ficha-tecnica.md`](../dispositivo/ficha-tecnica.md).

## App ciudadana (M8)

Construida como prototipo en `ciudadano/` (D28). La especificación original está en
[17-plan-app-ciudadana.md](17-plan-app-ciudadana.md); **se desvió de ella en tres cosas**, por pedido
del usuario: lleva mapa (el plan descartaba librería de mapas), sigue el estilo de SIGRIV con el kit
gob.mx y valida la foto con Gemini (D29). Pendiente:

- Probarla en un teléfono real (cámara, GPS, un solo pulgar) con un túnel HTTPS: la geolocalización
  exige HTTPS.
- Medir la validación de fotos con imágenes reales del Atoyac; los umbrales son un punto de partida.
- El `buildCommand` y el `includeFiles` (`contrato/analisis_foto.py`, `prioridad_huella.py`) de
  `vercel.json`, que son de quien lleva M5/M7, y la llave `GEMINI_API_KEY` en Vercel.
- Huella de calor y prioridad (D30): construidas, con pesos que son hipótesis sin calibrar.
- `GET /reportes` expone la coordenada exacta de cada reporte: las vistas la redondean, pero la API
  pública no. Decidir si se redondea en el servidor.

## Modelos proxy

La conductividad estima los sólidos disueltos con un **2 %** de error mediano, validado en
sitios que el modelo no vio: eso convierte la estación en una que reporta un parámetro de
laboratorio. Está en `contrato/fixtures/modelos_proxy.json` para que la estación o el
backend lo apliquen, siempre con su banda.

La turbiedad **no** estima los sólidos suspendidos: 35 % de error mediano y 135 % en el
percentil 90. Ver [16-modelos-proxy.md](16-modelos-proxy.md).

## Lo que está a medias o es supuesto

- **Hardware.** Las especificaciones de sondas, el consumo y la cobertura celular son supuestos de
  diseño; están separados de lo medido en la ficha técnica.
- **Huecos de datos.** Precipitación del SMN y REPDA/DENUE filtrado siguen sin integrarse.
- **Contrato v1.0.** Escrito; falta la sesión del equipo para congelarlo.
- **Mapa base.** Con token de Mapbox en `mapa/config.js` usa Mapbox; sin él, OpenFreeMap y Terrarium sin
  cuenta. El token no está en el repositorio: pídelo o usa el tuyo (copia `mapa/config.ejemplo.js`).

## Cómo correr lo que existe

Desde la raíz del repositorio (los frontends leen `contrato/fixtures/` y `datos/procesados/`, así que
con doble clic no funcionan):

```powershell
python -m http.server 8000
```

```powershell
python contrato/servidor_mock.py
```

- Mapa: `http://127.0.0.1:8000/mapa/`
- Backend real (M5), en lugar del mock y en el mismo puerto: ver `backend/README.md`
- Panel de autoridad: `cd panel`, `npm install` la primera vez y `npm run dev` → `http://localhost:5173/`
- Simulador: `http://127.0.0.1:8000/dispositivo/simulador/`
- Pruebas del firmware: `node dispositivo/simulador/prueba.js`
- Verificación del repositorio, antes de entregar cualquier cambio: `python -I scripts/50_verificar_repo.py`

Si `datos/procesados/muestreo.csv` no existe (no se versiona por tamaño), la verificación avisa; se
genera con `python -I scripts/10_construir_tablas.py` después de bajar los crudos.

## Reglas que no hay que olvidar

- Ningún módulo importa código de otro: se hablan por JSON, HTTP o CSV.
- Los archivos derivados no se editan: se edita su generador (`contexto/02-mapa-del-repo.md`).
- El firmware nunca emite alertas; eso es del backend.
- El semáforo de CONAGUA no pinta el mapa: 176 de 198 sitios con dato están en rojo.
- Cada cambio relevante se anota arriba en `contexto/06-registro-de-cambios.md`.

# Red de estaciones: cuántas, dónde y cómo se comunican

**Corte: 2026-11-24.** La propuesta son **5 estaciones**, no una por sitio. Cada estación cuesta
equipo, instalación, visitas de limpieza y calibración y reposición de sondas, así que el número
es una restricción del presupuesto. Este documento justifica el número, los sitios y el enlace.
Las cifras de cobertura salen de `scripts/96_red_estaciones.py`
(`datos/procesados/red/red_estaciones.csv`); los costos son estimaciones por cotizar.

## Cómo se eligieron los sitios

Dos condiciones, en este orden:

1. **Historia propia de campo.** Solo puede ser estación un sitio con al menos 4 de los 5
   parámetros que mide la estación (OD, pH, conductividad, temperatura, turbiedad) con 12 o más
   mediciones. Sin esa historia el motor de reglas no tiene contra qué comparar (D9, M2). Cumplen
   **69 de los 219 sitios**.
2. **Lo que vigila aguas arriba.** Un establecimiento con giro contaminante del DENUE (2 863 en la
   cuenca, filtrados por `95_denue_cuenca.py`) queda vigilado si hay una estación aguas abajo a
   20 km o menos sobre el cauce. Se eligen sitios uno a uno, siempre el que más establecimientos
   nuevos agrega.

| Estaciones | Establecimientos vigilados | Qué agrega la última |
|---|---|---|
| 1 | 467 (16.3 %) | 467 |
| 3 | 873 (30.5 %) | 189 |
| **5** | **1 124 (39.3 %)** | 99 |
| 8 | 1 284 (44.8 %) | 42 |
| 12 | 1 404 (49.0 %) | 25 |

Después de la quinta, cada estación agrega menos de 70 establecimientos: con 12 se pagaría más
del doble para vigilar 10 puntos porcentuales más. Las 5 estaciones del prototipo anterior,
elegidas por ser los sitios más deteriorados, vigilaban **265 (9 %)**: un sitio muy contaminado
no es necesariamente un buen punto de vigilancia.

Límites que se declaran:

- El DENUE dice que el establecimiento existe y su giro, **no que descargue ni cuánto**.
- **1 189 establecimientos** no tienen ningún sitio oficial a 20 km aguas abajo: ninguna red
  construida sobre la red oficial de monitoreo los vigila.
- El Zahuapan (EST-ATY-01) y el Alseseca (EST-ATY-05) figuran como intermitente o "en operación"
  en la red del INEGI. Hay que confirmar en campo que llevan agua todo el año.

## Las 5 estaciones

Numeradas de aguas arriba hacia aguas abajo; la red termina en la presa Manuel Ávila Camacho
(Valsequillo), que no lleva estación porque no tiene historia de campo: es lo que la red protege.

| Estación | Sitio | Lugar | Qué vigila |
|---|---|---|---|
| EST-ATY-01 | DLTLA2554 | Río Zahuapan, Tlaxcala | El brazo del Zahuapan: Tlaxcala y Apizaco |
| EST-ATY-02 | DLTLA2577 | Río Atoyac, Tepetitla de Lardizábal | El corredor industrial de San Martín Texmelucan |
| EST-ATY-03 | DLTLA2544 | Río Atoyac, Papalotla (Panzacola) | El Atoyac antes de recibir al Zahuapan |
| EST-ATY-04 | DLPUE1977 | Río Atoyac, Puebla, después del río San Francisco | La ciudad de Puebla |
| EST-ATY-05 | DLPUE2064 | Río Alseseca, puente de San Francisco Totimehuacán | El oriente de Puebla, antes de la presa |

Ventanas de llegada entre ellas (M3, velocidad declarada 0.3 a 1.0 m/s):

| De | A | Distancia sobre el cauce | Llegada |
|---|---|---|---|
| Tepetitla (02) | Papalotla (03) | 23.4 km | 6.5 a 21.6 h |
| Zahuapan (01) | Papalotla (03) | 25.7 km | 7.1 a 23.8 h |
| Papalotla (03) | Puebla (04) | 20.5 km | 5.7 a 19.0 h |
| Puebla (04) | Valsequillo | 30.7 km | 8.5 a 28.5 h |
| Alseseca (05) | Valsequillo | 11.4 km | 3.2 a 10.6 h |

La cadena hace dos cosas que una estación sola no hace: avisa con horas de anticipación al sitio
siguiente, y **dice de qué brazo viene un evento**. Si Papalotla alerta y el Zahuapan no, el origen
está en el Atoyac, no en Tlaxcala.

**Si el presupuesto alcanza para 3:** Puebla (04), Alseseca (05) y Zahuapan (01), que vigilan 873
establecimientos (30.5 %).

## Enlace: la red celular que ya existe

La estación no necesita antenas propias. Su módem LTE-M usa una SIM de datos para dispositivos de
un operador comercial y manda cada lote por HTTPS al backend (`POST /lecturas`). La torre que
aparece en el simulador es la del operador.

- **Por qué no torres propias.** Exigen terreno, permisos, espectro y un enlace de salida a
  internet; solo se justifican en una red de cientos de puntos.
- **Lo que hay que verificar.** Cobertura LTE-M en cada sitio, medida con el módem o un teléfono
  junto al río y bajo el puente, no solo en el mapa del operador. Los −66 a −84 dBm del simulador
  son supuestos. Los cinco sitios están en el corredor urbano Puebla-Tlaxcala, donde la cobertura
  es muy probable; el riesgo está en el fondo de una barranca, y por eso la antena va arriba del
  mástil.
- **Si un sitio no tiene señal.** Un concentrador LoRaWAN en un punto alto cercano (azotea o
  cerro), con salida celular, cubre varios kilómetros y varias estaciones. El enlace satelital
  existe, pero su costo por mensaje no es razonable para una lectura cada 15 minutos.
- **Lo que el firmware ya resuelve.** Sin red, la estación guarda en la SD y reenvía con la hora
  original; en el simulador, un corte de 4 h no pierde ningún paquete (`prueba.js`).

## Costo por estación: órdenes de magnitud, por cotizar

Ninguna cifra de esta sección es una cotización. Sirven para comparar alternativas y para saber
qué hay que cotizar primero.

| Concepto | Con sondas de bajo costo | Con sonda multiparamétrica comercial |
|---|---|---|
| Sondas (OD, pH, conductividad, temperatura) | cientos de USD a ≈ 1 000 USD en total | incluidas en la sonda |
| Turbiedad de campo con limpiador | la pieza más cara: del orden de 1 000 a 3 000 USD | incluida |
| Sonda multiparamétrica | — | del orden de 10 000 a 20 000 USD |
| Controlador, reloj, SD y módem | del orden de 100 USD | del orden de 100 USD |
| Panel, baterías y regulador | del orden de 100 USD | del orden de 100 USD |
| Gabinete, mástil, tubo de protección y anclaje | cientos de USD | cientos de USD |
| **Total de equipo por estación** | **del orden de 2 500 a 5 000 USD** | **del orden de 15 000 a 25 000 USD** |

**Lo que más pesa al año no es el equipo.** Por estación: una visita al mes de limpieza y
calibración, reactivos de calibración, reposición del electrodo de pH cada 1 a 2 años, la SIM de
datos y reposición por vandalismo o crecidas. Es la razón principal para no multiplicar
estaciones.

## Qué falta para cerrar esta propuesta

1. Cotizar las sondas, empezando por la de turbiedad con limpiador.
2. Medir la señal LTE-M en los cinco sitios.
3. Confirmar en campo el flujo todo el año en el Zahuapan y el Alseseca.
4. Revisar con CONAGUA o el gobierno estatal el acceso y la seguridad de cada punto: casi todos
   son puentes, buenos para el montaje y para la visita mensual.

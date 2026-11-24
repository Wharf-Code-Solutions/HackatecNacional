# Metodología de trabajo por módulos independientes

El objetivo de este documento es uno solo: **que nadie espere a nadie**. Si una persona
se atrasa, se enferma o abandona una parte, el resto sigue avanzando y la demo final
sigue corriendo.

No se logra con buena voluntad ni con reuniones. Se logra con tres mecanismos concretos
que ya están construidos en [`contrato/`](../contrato/README.md).

---

## La regla que ordena todo

> **Un módulo solo puede estar bloqueado por el contrato de datos, nunca por el código de
> otra persona.**

Si necesitas datos de un módulo que no existe, usas su fixture. Si necesitas un servicio
que no existe, usas el servidor mock. Si alguien no terminó, su reemplazo ya está en el
repositorio.

### Los tres mecanismos

| Mecanismo | Qué resuelve | Dónde está |
|---|---|---|
| **Contrato** | Define la frontera de cada módulo como esquema, no como conversación. Dos personas que respetan el esquema no necesitan hablarse para que su código encaje. | `contrato/esquemas/` |
| **Fixtures** | Datos de ejemplo realistas, generados con la historia real del Atoyac. Sustituyen al módulo vecino mientras no exista. | `contrato/fixtures/` |
| **Servidor mock con stub** | Un backend que funciona desde hoy, con un evaluador tonto pero honesto (`"motor": "stub"`). El frontend se desarrolla contra él desde la primera hora. | `contrato/servidor_mock.py` |

Los fixtures son deterministas: misma semilla, archivos idénticos. Todo el equipo mira
exactamente los mismos datos, y si alguien reporta un problema con el paquete 237 del
escenario de lluvia, los demás pueden abrir ese mismo paquete.

---

## Los módulos

Los cuatro módulos que pide el reto se reparten en once módulos de trabajo. La diferencia
importa: los del reto son categorías de entregable, los de trabajo son unidades que una
persona puede terminar sola.

| ID | Módulo de trabajo | Módulo del reto que cubre | Consume | Produce |
|---|---|---|---|---|
| **M0** | Datos y contrato | base de todos | fuentes oficiales | tablas, esquemas, fixtures, mock |
| **M1** | Topología de la red | base de M3, M5, M8 | red hidrográfica INEGI, `sitio.csv` | `tramo.csv`, `sitio_orden.csv`, `red.geojson` |
| **M2** | Motor de reglas | Modelos · Alertamiento temprano | `muestreo`, `umbral`, línea base, `lectura` | librería `evaluar()` → `veredicto` |
| **M3** | Propagación | Modelos | M1 + `alerta` | `prediccion_propagacion` |
| **M4** | Dispositivo y simulador | Dispositivos electrónicos · Automatización · Energía · Comunicaciones | esquema `lectura` | firmware Wokwi, ficha técnica, render |
| **M5** | Backend y API | Plataformas digitales · Bases de datos | contrato | endpoints, base geoespacial |
| **M6** | Mapa público | Plataformas digitales · Geolocalización | API | web pública |
| **M7** | Panel de autoridad | Plataformas digitales | API | web con sesión |
| **M8** | App ciudadana | Aplicaciones móviles | API | app o web móvil |
| **M9** | Integración, pruebas y demo | Pruebas · Resultados obtenidos | todo | evidencia y guion |
| **M10** | Documentación, costos e implementación | Documentación técnica · Costos · Propuesta | todo | documento y tablas |

### Dependencias reales

```
M0 (hecho) ──► M1 ──► M3 ──┐
   │            │          │
   │            └──────────┼──► M5 ──┬──► M6
   ├──► M2 ────────────────┘         ├──► M7
   ├──► M4 ──────────────────────────┘    └──► M8
   │                                            │
   └────────────────────────────────────────────┴──► M9 ──► pitch
M10 corre en paralelo desde el primer día
```

Las flechas son **dependencias de contrato, no de código**. M6 depende del esquema que
M5 sirve, no de que M5 exista: hasta que exista, M6 lee del mock.

---

## Cómo avanza cada módulo solo

Esta es la columna que vuelve la metodología real. Si una fila no se puede llenar, el
módulo está mal cortado.

| Módulo | Prueba sin nadie más porque... | Comando con el que trabaja desde el minuto cero |
|---|---|---|
| **M1** | Los shapefiles del INEGI ya están en `datos/geo/`. Valida contra los nombres de los sitios: hay decenas que dicen *"antes de la confluencia con X"*, así que el propio nombre revela el orden esperado. | `python -I scripts/...` sobre `datos/geo/` |
| **M2** | Los cinco escenarios son su suite de pruebas. Cada uno tiene una firma esperada declarada. | `python contrato/reproducir_escenario.py <esc> --en-seco` y su propia prueba unitaria |
| **M3** | Si M1 no terminó, usa un `sitio_orden.csv` de cinco filas hecho a mano con las cinco estaciones del piloto. | fixture de orden + `alerta` de ejemplo |
| **M4** | El simulador de Wokwi solo necesita el esquema `lectura` y una URL. Le manda al mock. | `POST http://127.0.0.1:8080/lecturas` |
| **M5** | Las pruebas de contrato del mock son sus pruebas. Si acepta y rechaza lo mismo que el mock, está bien. | `python contrato/reproducir_escenario.py normal --url <su backend>` |
| **M6** | `sitios.geojson` tiene los 219 puntos con su índice y su semáforo. No necesita backend. | `python contrato/servidor_mock.py` |
| **M7** | El mock genera alertas de verdad al reproducir un escenario. | `servidor_mock.py` + `reproducir_escenario.py descarga_industrial` |
| **M8** | `POST /reportes` del mock valida, asigna folio y rechaza fotos con EXIF. | `servidor_mock.py` |
| **M9** | Empieza el día uno escribiendo el guion, no al final. | los escenarios |
| **M10** | No depende de código, depende de decisiones. Las decisiones ya están en `documentacion/`. | — |

---

## Plan de degradación: qué pasa si alguien no termina

Cada módulo declara de antemano **qué muestra la demo si él no está**. Esto se decide
ahora, en frío, no a las tres de la mañana del día del pitch.

| Si falta | La demo muestra | Se pierde |
|---|---|---|
| **M1** topología | Orden de las 5 estaciones hecho a mano | Propagación sobre toda la cuenca |
| **M2** motor de reglas | El evaluador stub del mock, marcado como tal | Discriminación real; se dice en el pitch |
| **M3** propagación | Tabla de llegadas precalculada para el escenario de la demo | La predicción en vivo |
| **M4** dispositivo | `reproducir_escenario.py` manda el mismo payload; el dispositivo se presenta como render y ficha técnica | La demostración de hardware |
| **M5** backend | **Los frontends siguen contra el mock** | Persistencia; la demo igual corre |
| **M6** mapa | El panel carga la demo | La vista pública |
| **M7** panel | El mapa carga la demo | La vista de autoridad |
| **M8** app | Un reporte enviado con `curl` a `/reportes`, mostrando que llega al panel | La experiencia móvil |

**La demo sobrevive la ausencia de cualquier módulo individual.** Eso es lo que quita el
cuello de botella: nadie es indispensable, y por lo tanto nadie es un riesgo.

---

## Criterio de terminado, medible, por módulo

Un módulo no está listo cuando su autor lo dice. Está listo cuando pasa su criterio, y el
criterio no requiere a nadie más.

| Módulo | Criterio de terminado |
|---|---|
| **M1** | Los 219 sitios tienen `c_sitio_aguas_abajo` o una razón documentada de por qué no. Distancias medidas sobre el cauce, no en línea recta. Validado contra al menos 10 sitios cuyo nombre declara su posición relativa. |
| **M2** | Sobre los cinco escenarios: **a lo más 2 alertas** en `normal` (el stub da 31), evento detectado en menos de 45 min simulados en los tres escenarios de incidente, y en `falla_sensor` **cero alertas ambientales** con al menos 4 avisos técnicos. |
| **M3** | Dada una alerta en `EST-ATY-01`, devuelve para cada sitio aguas abajo una ventana de llegada, un factor de dilución y los supuestos llenos. Cumple `prediccion_propagacion.schema.json`. |
| **M4** | El circuito de Wokwi emite un payload que `POST /lecturas` responde **202**. Ficha técnica con rango, precisión, mantenimiento y costo por sensor. |
| **M5** | `reproducir_escenario.py normal --url <backend>` termina sin errores de contrato, y rechaza con 422 el mismo payload inválido que rechaza el mock. Los datos persisten tras reiniciar. |
| **M6** | Pinta los 219 sitios, colorea por índice, muestra `n` y fecha del último dato, y funciona a ancho de teléfono. |
| **M7** | Lista alertas con su evidencia, su fuente probable con puntaje, su predicción, y permite cambiar el estado y asignar responsable. |
| **M8** | Flujo completo: foto, ubicación, tipo, envío, folio devuelto, consulta por folio. Rechaza foto con EXIF. |
| **M9** | Los cinco escenarios corren de punta a punta con evidencia capturada y los números de la Etapa 6 llenos. |
| **M10** | Documento técnico completo y tabla de costos con cifras, no con celdas vacías. |

El criterio de M2 merece atención: **la tabla del stub es la vara**. 31 alertas en un día
sin incidentes y 35 con una descarga industrial significa que la regla ingenua no sirve.
Bajar eso a cerca de cero sin perder el evento es el trabajo, y es un resultado reportable
en la Etapa 6.

---

## El día cero: lo único que sí es secuencial

Hay dos tareas que no se pueden paralelizar porque todas las demás dependen de ellas. Son
las únicas.

1. **Congelar el contrato v1.0.** Ya está escrito. Se revisa entre todos en una sesión de
   una hora, se corrige lo que haga falta y se declara congelado.
2. **M1, la topología.** Es el verdadero camino crítico del proyecto: de ella dependen la
   propagación (M3), la vista de fuentes aguas arriba (M7) y la asignación de reportes al
   tramo correcto (M8). El plan original la tenía como el paso 7 de la Etapa 1, casi como
   un detalle. Es un día de trabajo y debe ser lo primero.

Después del día cero, **todo lo demás arranca el mismo día**.

---

## Reparto sugerido

Base de cinco personas. Las notas dicen cómo colapsar si son menos.

| Persona | Módulos | Carga |
|---|---|---|
| A | **M1** topología → **M3** propagación | La parte con más contenido técnico de datos |
| B | **M2** motor de reglas | El corazón analítico; es el que compite contra el stub |
| C | **M5** backend → ayuda a **M9** | La pieza de integración |
| D | **M6** mapa + **M7** panel | Las dos vistas comparten componentes |
| E | **M4** dispositivo + **M8** app ciudadana | Dos piezas vistosas e independientes entre sí |
| todos | **M9** integración y **M10** documentación | M10 lo lleva quien tenga menos carga en cada momento |

- **Con cuatro personas**: D absorbe M8 y E se concentra en M4; el panel se simplifica.
- **Con seis**: se separa M6 de M7 y la sexta persona toma M10 de tiempo completo, que
  suele ser lo que más se abandona y lo que el reto evalúa de forma explícita.
- **Con tres**: A toma M1+M2+M3, B toma M4+M5, C toma M6+M7+M8, y la demo se apoya fuerte
  en el plan de degradación.

---

## Reglas de integración

1. **Una rama por módulo**, con su identificador: `m2-motor-reglas`, `m6-mapa-publico`.
2. **`main` siempre demostrable.** Un merge no entra si rompe la demo. Esta es la regla
   que evita el pánico del último día.
3. **Puerta de entrada de cada PR**, tres comandos que cualquiera puede correr:
   ```powershell
   python -I scripts/10_construir_tablas.py
   ```
   ```powershell
   python contrato/reproducir_escenario.py normal --en-seco
   ```
   ```powershell
   python contrato/validador.py lectura contrato/fixtures/estaciones.json
   ```
4. **PR chicos y frecuentes.** Un PR de tres días es un cuello de botella con otro
   nombre.
5. **Nadie toca el contrato en silencio.** Agregar un campo opcional no rompe nada.
   Quitar un campo, volverlo obligatorio o cambiar un enum sube la versión y se anuncia.
6. **Nadie toca `datos/crudos/`.** Es la regla de oro de la Etapa 1: toda transformación
   pasa por un script que lee de `crudos/` y escribe en `procesados/`.
7. **Lo que no está en el repositorio no existe.** Incluye los fixtures que generaste, el
   guion de la demo y la tabla de costos a medio llenar.

---

## Ritmo

**Sincronización de 15 minutos, con una agenda fija de tres preguntas.** No es un reporte
de avance; es una revisión de bloqueos de contrato.

1. ¿Alguien necesita un cambio en el contrato? (si sí, se decide ahí mismo)
2. ¿Alguien necesita un fixture que no existe?
3. ¿Qué módulo está en riesgo y confirmamos su degradación?

Nada más. El avance se ve en el repositorio.

**Congelamiento del contrato** a la mitad del tiempo disponible. A partir de ahí solo
cambios aditivos. Un contrato que se mueve el último día es la forma más eficiente de
perder una hackathon.

---

## Qué ya está hecho y qué sigue

**Hecho (M0):**

- Tablas de datos verificadas: 219 sitios, 145 703 resultados, 2012–2025.
- Siete esquemas del contrato, incluido `veredicto`, que el plan original no tenía y que
  es la frontera más compartida del sistema.
- Fixtures con cinco estaciones reales, su línea base real, los 219 sitios en GeoJSON y
  cinco escenarios de un día completo.
- Servidor mock funcionando, con validación de contrato y evaluador stub medido.
- Validador de esquemas sin dependencias.

**Lo que sigue, en orden:**

1. Revisar y congelar el contrato v1.0 entre todos (1 h).
2. **M1, topología** (1 día). Es el camino crítico.
3. Cerrar los dos huecos de datos que quedan: precipitación del SMN y REPDA/DENUE
   filtrado (1.5 días, en paralelo con todo lo demás).
4. Arranque simultáneo de M2 a M8.

El detalle de por qué estos huecos importan y de qué partes del plan objeto está en
[`03-revision-critica-plan.md`](10-revision-critica-plan.md).

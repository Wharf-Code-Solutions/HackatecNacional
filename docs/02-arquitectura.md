# Arquitectura

## Vista general

```
   FUENTES OFICIALES                      CAMPO
   CONAGUA · INEGI · DOF                  estación con sensores
          │                                      │
          │ scripts/00_descargar_fuentes.py      │ cada 15 min
          ▼                                      │
   datos/crudos/            (nunca se editan)    │
          │                                      │
          │ scripts/10_construir_tablas.py       │
          ▼                                      │
   datos/procesados/                             │
   sitio · parametro · muestreo · umbral         │
          │                                      │
          │ scripts/20_analisis_exploratorio.py  │
          ▼                                      │
   línea base por sitio y parámetro              │
          │                                      │
          └──────────────┬───────────────────────┘
                         ▼
                 MOTOR DE REGLAS  (M2)
                 compara la lectura contra:
                   1. la banda histórica del sitio   ← regla primaria
                   2. el criterio normativo           ← gradúa la gravedad
                   3. el rango físico del sensor      ← aviso técnico
                         │
                         ▼
                   veredicto  ─────► alerta ─────► PROPAGACIÓN (M3)
                         │                          qué sitio de abajo,
                         │                          cuándo y con qué dilución
                         ▼                                │
                  BACKEND Y API  (M5) ◄───────────────────┘
                  persiste, publica, notifica
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     MAPA PÚBLICO   PANEL AUTORIDAD   APP CIUDADANA
         (M6)            (M7)             (M8)
                                            │
                                   reporte_ciudadano
                                            │
                                            └──► se asigna al tramo del río
                                                 y se cruza con las alertas
```

La **red hidrográfica** (M1) alimenta tres cosas a la vez, y por eso es el camino
crítico: la propagación necesita el orden de los sitios, el panel necesita saber qué
fuentes están aguas arriba de un punto, y la app necesita asignar un reporte al tramo
correcto del cauce, no al punto más cercano en línea recta.

## El recorrido de un dato, de principio a fin

Vale la pena seguirlo completo porque explica casi todas las decisiones de diseño.

1. **Una estación mide** oxígeno disuelto, pH, conductividad, temperatura y turbiedad, y
   arma un paquete JSON con la hora en ISO 8601 **con zona horaria**.
2. **Lo envía** al backend. El backend valida contra `lectura.schema.json` antes de
   mirarlo: un payload que no cumple el contrato se rechaza con 422 y no entra al sistema.
3. **El motor de reglas lo evalúa** y produce un `veredicto`. Para cada parámetro
   determina tres cosas distintas que no se confunden entre sí:
   - **Dónde cae respecto de la historia del propio sitio**: bajo el percentil 10, normal,
     sobre el percentil 90. Esta es la señal que detecta un evento.
   - **Qué clase de la escala de CONAGUA le corresponde** y cuántas veces excede el
     límite. Esto gradúa la gravedad.
   - **Si el valor es físicamente posible**. Un pH de −999 no es contaminación, es un
     sensor roto, y produce un aviso técnico, nunca una alerta ambiental.
4. **Si la anomalía persiste** tres lecturas seguidas, se emite una `alerta` con folio,
   nivel, la regla que la disparó y el criterio contra el que se comparó.
5. **El modelo de propagación** toma esa alerta, recorre la red hidrográfica hacia abajo y
   devuelve, para cada sitio siguiente, una **ventana horaria de llegada** y un factor de
   dilución. Ventana, no hora exacta: la velocidad del flujo se estima.
6. **El backend lo publica.** El mapa pinta, el panel lista, y si la alerta es crítica se
   notifica.
7. **Un ciudadano manda un reporte** con foto. Se le quita el EXIF antes de almacenarla,
   se asigna al tramo del río y, si coincide en tiempo y lugar con una alerta de sensor,
   se vinculan. Un reporte que coincide con una alerta vale mucho más que cualquiera de
   los dos por separado.

## Las tres capas de salida

Una sola clasificación no puede servir a un ciudadano y a un inspector: necesitan cosas
opuestas. El sistema produce tres capas desde el mismo veredicto.

| Capa | Pregunta que responde | Para quién | Forma |
|---|---|---|---|
| **Índice de deterioro** | ¿Qué tan mal está y cómo se compara con los otros puntos? | Técnico, autoridad | número continuo, ranking, serie en el tiempo |
| **Diagnóstico por parámetro** | ¿Qué parámetro incumple, cuánto y contra qué criterio? | Autoridad, con valor probatorio | tabla parámetro × criterio × excedencia × fecha × n |
| **Riesgo por uso** | ¿Puedo tocar el agua? ¿Riego con esto? | Ciudadano | lenguaje natural, por actividad |

El semáforo de colores vive **solo** en la capa ciudadana, derivado del índice. No es el
eje analítico, y el motivo está medido: 176 de 198 sitios están en rojo, así que el color
no ordena nada. El razonamiento completo está en
[10-revision-critica-plan.md](10-revision-critica-plan.md).

## El contrato como frontera

Cada módulo se define por lo que consume y lo que produce, expresado como esquema. Esa es
la única frontera que existe entre dos personas del equipo.

| Esquema | Lo produce | Lo consume |
|---|---|---|
| `lectura` | dispositivo o simulador | backend |
| `veredicto` | motor de reglas | backend, panel, mapa |
| `alerta` | motor de reglas | panel, notificaciones, propagación |
| `estacion` | configuración | todos |
| `linea_base` | análisis de datos | motor de reglas |
| `prediccion_propagacion` | modelo de propagación | panel |
| `reporte_ciudadano` | app ciudadana | backend, panel, mapa |

`veredicto` es la frontera más transitada del sistema y no estaba en el plan original. Es
el contrato exacto entre el motor de reglas y todo lo demás: mientras no cambie, el
análisis y la plataforma avanzan sin hablarse.

## Dos vocabularios de parámetros

Esto confunde a todo el que llega, así que conviene explicarlo antes de que lo descubra
por error:

- **El contrato habla en códigos cortos**: `OD`, `PH`, `COND`, `TEMP`, `TURB`, `SDT`.
- **Las tablas históricas hablan en claves de CONAGUA**: `OD_mg/L`, `pH_CAMPO`,
  `CONDUC_CAMPO`, `TEMP_AGUA`, `TURBIEDAD`, `SDT`.

La traducción vive en una sola parte: `datos/procesados/parametro.csv`, columna
`c_parametro_std`. La razón de mantener los dos es que las claves de CONAGUA son la
trazabilidad al dato oficial (hay 347 parámetros, con variantes de superficie, medio y
fondo) y los códigos cortos son lo que un firmware de microcontrolador puede manejar sin
desperdiciar memoria.

## Lo que el prototipo usa hoy en lugar de lo que usará

Mientras los módulos no existen, sus reemplazos sí:

| En lugar de | Hoy se usa | Se reemplaza cuando |
|---|---|---|
| Dispositivo físico | `dispositivo/simulador/` (firmware simulado) o `contrato/reproducir_escenario.py`, que emiten el mismo payload | M4 tenga hardware armado y medido |
| Motor de reglas | el evaluador stub del mock, marcado `"motor": "stub"` | M2 esté listo |
| Backend real | `contrato/servidor_mock.py` | M5 esté listo |
| Orden del río | un orden a mano de las 5 estaciones del piloto | M1 esté listo |

Esto no es deuda técnica accidental: es el mecanismo que permite que ocho módulos avancen
en paralelo. El detalle está en [11-metodologia-modulos.md](11-metodologia-modulos.md).

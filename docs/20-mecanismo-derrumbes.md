# 20 · Mecanismo de derrumbes: sensores de ladera y cómo viajan sus datos

> Fecha: 24 de noviembre de 2026. Para quien lleva el dispositivo y el simulador (módulo A, `dispositivo/`) y para la
> sesión que lleva los datos y las reglas de derrumbe. Cierra la pregunta abierta de `docs/19` §5: *"decidir si el
> mecanismo suma sensores para derrumbe (pluviómetro, humedad de suelo, inclinómetro)"*. La respuesta es **sí, como un
> módulo de la misma estación, no como un dispositivo aparte.**

## 1. Por qué así

Contaminación y derrumbe no son dos proyectos: comparten la unidad (la escuela), las causas (sin drenaje, urbanización
en pendiente, marginación) y **el detonante, la lluvia**. Una tormenta en la Sierra Norte satura la ladera y, en la misma
hora, arrastra tierra y desechos a la fuente de agua. Por eso:

- **Un solo dispositivo.** Mismo controlador (ESP32), misma comunicación (LTE-M, `POST /lecturas`), misma energía (panel
  y baterías). Se agrega un **módulo de ladera** con sus sensores.
- **El pluviómetro sirve a los dos riesgos:** dice cuándo la lluvia llega a un umbral peligroso para la ladera, y le dice
  al motor que una turbiedad alta viene de la lluvia y no de una descarga.
- **Misma regla de siempre (invariante I10):** el dispositivo mide y envía; **nunca decide ni emite alertas**. Las reglas
  de derrumbe viven en la plataforma (`motor/`, `backend/`), no en el firmware.

## 2. Sensores del módulo de ladera

Todos son **supuestos de diseño**: no hay hardware comprado ni medido. En el simulador se dicen así, igual que las sondas
de agua (`dispositivo/ficha-tecnica.md`).

| Código (contrato) | Sensor de diseño | Qué reporta en cada paquete | Unidad | Rango de diseño | Dónde se pone |
|---|---|---|---|---|---|
| `LLUVIA` | Pluviómetro de balancín (0.2 mm por basculada), por interrupción | **Lluvia acumulada desde el paquete anterior** (no intensidad, no total del día) | mm | 0 – 200 por paquete | Toda estación con módulo de ladera; opcional en las de agua |
| `HUM_SUELO` | Sensor capacitivo de humedad volumétrica, enterrado a ~50 cm en la ladera sobre la escuela | Humedad volumétrica en el momento de la medición | % (m³/m³ × 100) | 0 – 60 | Solo con módulo de ladera |
| `INCL` | Inclinómetro de 2 ejes (acelerómetro) fijado a una estaca anclada en la ladera | **Cambio de inclinación respecto a la instalación**, la mayor de los dos ejes | grados | −15 – +15 | Solo en escuelas de riesgo de derrumbe muy alto |

Reglas de los valores, iguales a las de las sondas de agua: el valor va **crudo**, sin corregir; `null` si el sensor no
respondió; `-999` si está roto. El pluviómetro se cuenta con una interrupción mientras el controlador duerme: no gasta
energía entre mediciones.

## 3. Cómo viajan los datos (el contrato)

### 3.1 Lecturas: mismo paquete, tres códigos nuevos

El módulo de ladera **no crea otro tipo de paquete**: sus valores van en el mismo `POST /lecturas`, como tres entradas más
de `lecturas[]`. Ejemplo de una estación que solo tiene módulo de ladera:

```json
{
  "version": "1.0",
  "c_estacion": "EST-LAD-01",
  "fecha_hora": "2026-11-24T17:15:00-06:00",
  "lecturas": [
    { "c_parametro": "LLUVIA", "valor": 4.2 },
    { "c_parametro": "HUM_SUELO", "valor": 38.5 },
    { "c_parametro": "INCL", "valor": 0.1 }
  ],
  "bateria": 3.95,
  "senal": -88
}
```

Cambio de contrato que esto pide (se hace **una vez**, avisando al grupo, con `docs/contexto/05-protocolo-de-cambios.md`):

| Esquema | Cambio | Compatible |
|---|---|---|
| `lectura.schema.json` | `c_parametro.enum` suma `LLUVIA`, `HUM_SUELO`, `INCL` | Sí: los paquetes actuales siguen siendo válidos |
| `estacion.schema.json` | `parametros.items.enum` suma los mismos tres | Sí |

Estos tres códigos **no tienen clave CONAGUA** (no salen de `parametro.csv`) ni línea base histórica: el motor no los
compara contra la banda de un sitio, sino contra umbrales (§5). Hay que decirle eso al validador o a `50_verificar_repo.py`
si revisan que todo código del contrato exista en `parametro.csv` (invariante I5).

### 3.2 Dónde van: `mecanismos.json`

Lo sigue generando `scripts/99_reubicacion.py` (del dispositivo). Se agregan estaciones de ladera con la forma de
estación v2.0 que ya existe:

```json
{
  "c_estacion": "EST-LAD-01",
  "c_sitio": null,
  "nombre": "Ladera de Tecuantla (los Reyes)",
  "municipio": "Jopala",
  "estado": "Puebla",
  "latitud": 20.164262,
  "longitud": -97.69145,
  "parametros": ["LLUVIA", "HUM_SUELO", "INCL"],
  "estado_dispositivo": "Activo",
  "cct": "21KTV0122C",
  "escuela": "...",
  "escuelas_protegidas": ["21KTV0122C"],
  "autorizaciones": [
    { "organismo": "CAPCEE", "tramite": "vinculacion_con_plantel", "estado": "pendiente", "fecha": null }
  ]
}
```

- Mismas claves que las estaciones `EST-ESC-` que ya genera `99_reubicacion.py` (las coordenadas son las de la escuela
  en `escuelas.json`).
- **Prefijo `EST-LAD-`** para las de ladera; las de agua siguen como `EST-ESC-`.
- **Sin colector, sin `c_sitio` y sin `banda_simulacion`:** no están en un cauce.
- **Autorizaciones:** CAPCEE (`vinculacion_con_plantel`, como en las de agua). CEASPUE solo si el módulo se monta en una
  estación que toca una fuente de agua.
- **Si una escuela ya tiene estación de agua y también riesgo de derrumbe alto,** se le suman los tres parámetros a esa
  misma estación (y su escuela a `escuelas_protegidas`) en lugar de crear otra.

**Qué escuelas.** Las elige la sesión de datos de derrumbe a partir de `escuelas.json` (criterio propuesto: sub-índice de
derrumbe ≥ 0.7 y susceptibilidad CENAPRED Alta o Muy alta; `INCL` solo con Muy alta). Mientras no esté el criterio final,
el simulador puede usar las tres primeras escuelas de `escuelas.json` por `riesgo.derrumbe`.

### 3.3 Lo que el simulador recibe de la parte de datos

Para que la lluvia del simulador sea creíble en cada sitio, la sesión de derrumbe dejará en `contrato/fixtures/`:

| Archivo | Qué trae | Para qué |
|---|---|---|
| `lluvia_sitios.json` | Por estación de ladera: lluvia diaria típica de la temporada y percentiles de tormenta (p50, p90, p99), de una fuente abierta (CHIRPS o estaciones del SMN) | Que la lluvia simulada salga de la historia real del lugar, como el agua sale de `linea_base.json` |
| `escenarios/tormenta_ladera.json`, `lluvia_prolongada.json`, `deslave.json` | Series de paquetes de ejemplo con los tres códigos nuevos | Probar el motor y el backend igual que con los escenarios del agua |

Hasta que existan, el simulador usa supuestos declarados en su código y en `ficha-tecnica.md`.

## 4. Lo que tendría que hacer el simulador

Sin cambiar su forma de trabajar (`modelo.js` → `firmware.js` → `escena.js`):

1. **Modelo** (`modelo.js`): una ladera por estación de ladera.
   - `LLUVIA`: sale de `Agua.lluvia(t)` que ya existe, para que río y ladera reciban la misma tormenta.
   - `HUM_SUELO`: modelo de cubeta simple: sube con la lluvia, baja con el drenaje lento; satura alrededor de 45–50 %.
     Parámetros declarados como supuestos.
   - `INCL`: quieto (ruido de ±0.05°) mientras el suelo no esté saturado; con suelo saturado y lluvia sostenida puede
     empezar a moverse; en el evento de deslave da un salto. Todo como supuesto, sin pretender predecir.
2. **Firmware** (`firmware.js`): muestreo base de 15 min como el agua; **adaptativo a 5 min mientras llueve fuerte**
   (umbral de basculadas por minuto, supuesto). Guarda en SD antes de enviar, reenvía con la hora original, nunca alerta.
3. **Pruebas en pantalla**: además de las cuatro actuales, «Tormenta» (lluvia intensa corta), «Lluvia prolongada» (varios
   días) y «Deslave» (salto del inclinómetro). La prueba «Lluvia» actual puede mover también la ladera.
4. **Figura 3D** (`escena.js`): la ladera detrás de la escuela con el pluviómetro, la estaca del inclinómetro y el sensor
   enterrado, rotulados con su dato vivo como las sondas. Sin decoración extra (preferencias de `CLAUDE.md`).
5. **`prueba.js`**: que los paquetes con `LLUVIA`, `HUM_SUELO` e `INCL` validen contra el contrato, que el firmware no emita
   alertas de ladera y que el muestreo adaptativo se active con lluvia fuerte.

## 5. Lo que hace la plataforma (no el simulador)

Lo lleva la sesión de datos y reglas de derrumbe; aquí solo para que se sepa qué esperar:

- Reglas de alerta de derrumbe en el motor: lluvia acumulada (24 h y 72 h) contra umbrales detonantes **tomados de la
  literatura y presentados como hipótesis**, humedad del suelo cerca de saturación, y cualquier cambio de `INCL` mayor a un
  umbral. Cada alerta dice qué escuela(s) afecta (`escuelas_afectadas`, `docs/19` §4.4).
- El panel y la app ya muestran el riesgo de derrumbe por escuela; las alertas de ladera llegan al mismo lugar que las del
  agua.

## 6. Quién hace qué

| Pieza | Dueño |
|---|---|
| Sensores, firmware, figura y pruebas del módulo de ladera (§4) | Dispositivo y simulador |
| Agregar estaciones `EST-LAD-` en `99_reubicacion.py` (§3.2) | Dispositivo, con el criterio de escuelas de la sesión de derrumbe |
| Los tres códigos en `lectura` y `estacion` (§3.1) | Quien llegue primero, en un commit aparte que solo toque los dos esquemas, avisando al grupo |
| `lluvia_sitios.json`, escenarios de ladera, criterio de escuelas y reglas del motor (§3.3, §5) | Sesión de datos y reglas de derrumbe |

## 7. Lo que no prometemos

- No predecimos deslaves. El índice dice qué escuelas reúnen más condiciones de riesgo; el módulo vigila el detonante.
- Los umbrales y los modelos de humedad e inclinación son **hipótesis declaradas** hasta que haya datos de campo.
- No hay datos reales de humedad del suelo ni de inclinación en estas laderas: esa ausencia es, como la de calidad del
  agua, la razón de instalar el mecanismo.

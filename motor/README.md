# Motor de reglas (M2)

Decide si una lectura amerita una alerta. `evaluar(paquete) → veredicto`, conforme a
[`contrato/esquemas/veredicto.schema.json`](../contrato/esquemas/veredicto.schema.json).

Sin dependencias externas. No persiste nada: eso es del backend.

```powershell
python -I motor/prueba.py
```

Corre los cinco escenarios y mide el criterio de terminado. Sale con código 1 si no se
cumple. El informe queda en [`docs/15-motor-reglas.md`](../docs/15-motor-reglas.md).

```powershell
python contrato/servidor_mock.py --motor real
```

Levanta el servidor usando este motor en lugar del evaluador provisional.

## El problema que resuelve

El evaluador provisional del servidor implementa la regla obvia —salió de la banda
p10–p90, tres lecturas seguidas— y da **31 alertas en un día sin ningún incidente contra
35 con una descarga industrial**: no discrimina. La razón es aritmética: por construcción
el 20 % de las lecturas normales cae fuera de esa banda, así que con 96 lecturas al día por
5 parámetros y 5 estaciones las rachas de tres aparecen solas.

| Escenario | Este motor | Provisional |
|---|---|---|
| `normal`, sin incidente | **0** | 31 |
| `descarga_organica` | 2 | 28 |
| `descarga_industrial` | 5 | 35 |
| `lluvia` | 5 | 36 |
| `falla_sensor` | **0 ambientales**, 19 avisos técnicos | 7 |

## Las cuatro capas, y por qué en ese orden

**1. Salud del sensor, antes que nada.** Un valor imposible, una lectura congelada o un
salto imposible producen un aviso técnico y **sacan ese parámetro de la evaluación
ambiental**. Si no fuera primero, una turbiedad congelada en 37.5 en un sitio cuya mediana
histórica es 368 parecería un evento enorme. Esta capa es la que hace que un sensor roto no
se confunda con contaminación.

**2. Desviación respecto de la historia del sitio**, con z robusto sobre mediana y MAD.
Viaja en el veredicto como contexto y gradúa la gravedad, **pero no dispara**. Estas series
están muy sesgadas a la derecha, así que la media queda muy por encima de la mediana y en
un día normal varios parámetros se ven altos de forma permanente contra el z histórico.
Usarlo de disparador daba 35 alertas en el día de control, más que la regla ingenua que
veníamos a mejorar.

**3. Escalón respecto de las últimas horas de la propia estación.** Este es el disparador.
Detecta que algo *acaba de cambiar* aunque el valor absoluto siga dentro de la banda
histórica, que es lo que distingue "aquí acaba de pasar algo" de "este río siempre está
mal".

La referencia se toma de 6 h a 2 h antes, con una **brecha de guarda** de 2 h. Sin ella,
una descarga que sube en rampa contamina su propia ventana de referencia: la mediana
reciente sube con el evento y la señal se diluye hasta desaparecer. Con la descarga
orgánica, cuya rampa dura 90 minutos, el evento no se detectaba en absoluto.

**4. Coherencia y persistencia.** Se exigen **dos parámetros** moviéndose de forma
coherente. Una descarga real mueve varios a la vez con una firma física; una sonda rota
mueve uno. Esta es la regla que más falsas alarmas quita, y la que tiene el precio que se
explica abajo.

## El intercambio que se eligió

El criterio original pedía detectar el evento en menos de 45 minutos. Se cumple en la
descarga industrial, que entra de golpe: 15 minutos. **No se cumple en los otros dos**: 75
minutos la orgánica y 90 la lluvia.

Se probaron cuatro variantes de umbral y persistencia y **el tiempo de detección no cambió
en ninguna**. El factor limitante no es el umbral: es la exigencia de dos parámetros
coherentes, y el segundo no se mueve lo suficiente hasta el minuto 75. Quitar esa exigencia
detectaría la orgánica a los 45 minutos, al precio de volver a confundir una sonda averiada
con un evento.

Se prefirió no alarmar en falso. El criterio quedó replanteado: **el evento debe detectarse
antes de alcanzar su intensidad plena** —la orgánica sube en rampa durante 90 minutos y la
lluvia durante 120—, y los tres pasan.

## Clasificar no es detectar

La fuente probable se razona en **razones** contra la mediana reciente, no en z:

| Escenario | Fuente que señala | Puntaje |
|---|---|---|
| `descarga_organica` | aguas residuales municipales | 0.90 |
| `descarga_industrial` | descarga industrial | 0.80 |
| `lluvia` | escurrimiento o arrastre | 0.70 |

Llegar ahí costó corregir el mismo error dos veces, y conviene no repetirlo:

- **Puntuar "pH fuera del intervalo 6 a 9" como firma industrial.** En estos sitios el pH
  ya está normalmente por debajo de 6: el p10 histórico de la estación 1 anda en 5.2. Ese
  criterio fijo está cumplido de forma permanente y no distingue nada. Es exactamente el
  mismo error que el semáforo.
- **Juzgar "conductividad multiplicada" por el z.** El z depende del ruido de base, así que
  una subida del 35 % puede dar z = 8 si el ruido es estrecho. Con eso, una descarga
  orgánica se clasificaba como industrial con 0.85 de confianza.

La lección, que vale para cualquier módulo: **el z sirve para detectar que algo cambió, no
para clasificar qué fue.** Clasificar exige las unidades de la cosa física.

## Lo que no hace

- **No propaga.** Eso es M3, que consume la alerta ya emitida.
- **No persiste nada.** Eso es M5.
- **No llena `riesgo_por_uso`.** Esa capa necesita los criterios de calidad por uso
  destinado, que siguen sin conseguirse. Inventarla sería dar por normativa una opinión
  nuestra.
- **No distingue municipal de industrial por la razón DQO/DBO**, que es el mejor
  discriminador que existe: la estación mide cinco parámetros de campo y ninguno es DQO ni
  DBO. Queda para el análisis histórico.
- **La detección de deriva no está validada.** Un día de datos no alcanza: una sonda se
  descalibra en semanas. La regla monótona que trae es un marcador conservador.

## Constantes

Todas en la cabecera de [`reglas.py`](reglas.py). Las que importan:

| Constante | Valor | Qué controla |
|---|---|---|
| `Z_ESCALON` | 3.5 | cuánto tiene que moverse un parámetro para ser candidato |
| `Z_FUERTE` | 6.0 | con esto la persistencia baja de 3 lecturas a 2 |
| `VENTANA_RECIENTE` | 16 | 4 h de referencia |
| `BRECHA_GUARDA` | 8 | 2 h entre la referencia y la lectura actual |
| `PERSISTENCIA` | 3 | lecturas consecutivas antes de emitir |
| `N_MINIMO_BANDA` | 12 | mediciones mínimas para usar una línea base |

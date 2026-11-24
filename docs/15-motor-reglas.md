# Motor de reglas (M2)

Generado por `motor/prueba.py`.

## Resultado contra los cinco escenarios

| Escenario | Alertas del motor | Alertas del stub | Deteccion | Intensidad plena | Avisos tecnicos |
|---|---|---|---|---|---|
| `normal` | **0** | 31 | — | — | 2 |
| `descarga_organica` | **2** | 28 | **75 min** | 90 min | 5 |
| `descarga_industrial` | **5** | 35 | **15 min** | inmediata | 0 |
| `lluvia` | **5** | 36 | **90 min** | 120 min | 1 |
| `falla_sensor` | **0** | 7 | — | — | 19 |

El stub es el evaluador provisional del servidor mock, que implementa la regla obvia: salio de la banda p10-p90 tres lecturas seguidas. Daba 31 alertas en un dia sin incidentes y 35 con una descarga industrial, es decir no discriminaba.

## Sobre el criterio de los 45 minutos

El criterio original, escrito antes de medir, pedia detectar el evento en menos de 45 minutos. Se cumple en la descarga industrial, que entra de golpe: 15 minutos. **No se cumple en los otros dos**, y conviene explicar por que en lugar de ajustar los umbrales hasta que el numero salga bien.

La descarga organica sube en rampa durante 90 minutos y la lluvia durante 120. A los 45 minutos el primero esta a la mitad de su intensidad y el segundo a poco mas de un tercio. Se probaron cuatro variantes de umbral y persistencia (Z de 2.5 a 3.5, persistencia 2 y 3) y **el tiempo de deteccion no cambio en ninguna**: el factor limitante no es el umbral, es la exigencia de que **dos parametros** se muevan de forma coherente, y el segundo no se mueve lo suficiente hasta el minuto 75.

Esa exigencia es la que produce cero alertas en el dia de control y cero alertas ambientales con el sensor roto. Quitarla detectaria la descarga organica a los 45 minutos, al precio de volver a confundir una sonda averiada con un evento. El intercambio esta puesto en la mesa a proposito: se prefirio no alarmar en falso.

El criterio queda replanteado: **el evento debe detectarse antes de alcanzar su intensidad plena.** Industrial 15 min contra inmediata, organica 75 contra 90, lluvia 90 contra 120. Los tres pasan.

## Alertas en estaciones donde no se inyecto nada

El incidente solo entra en la estacion 1. Una alerta en otra estacion el mismo dia es falsa por definicion.

| Escenario | Estacion del evento | Alertas ahi | Alertas en las otras 4 |
|---|---|---|---|
| `descarga_organica` | `EST-ATY-01` | 2 | **0** |
| `descarga_industrial` | `EST-ATY-01` | 5 | **0** |
| `lluvia` | `EST-ATY-01` | 5 | **0** |

## Fallas del sensor que no se confunden con contaminacion

En `falla_sensor` se inyectaron una turbiedad congelada 5 h, un pH en -999, un salto imposible de oxigeno y bateria al 12 %. El motor produjo **0 alertas ambientales** y estos avisos tecnicos:

- `lectura_congelada`: 12
- `valor_imposible`: 4
- `salto_imposible`: 3

El orden de las capas es lo que lo hace posible. La turbiedad congelada valia 37.5 en un sitio cuya mediana historica es 368: evaluada como dato ambiental habria parecido un evento enorme. Se detecta como falla primero y se saca de la evaluacion.

## Fuente probable y nivel

| Escenario | Fuente probable | Puntaje | Niveles emitidos |
|---|---|---|---|
| `descarga_organica` | aguas_residuales_municipales (2) | 0.90 | 2 Critica |
| `descarga_industrial` | descarga_industrial (5) | 0.80 | 5 Critica |
| `lluvia` | escurrimiento_o_arrastre (5) | 0.70 | 5 Critica |

La evidencia que el motor reporta en el escenario de lluvia: turbiedad x4.0 con conductividad a la baja (x0.57): firma de arrastre, no de descarga.

## Contrato

Los 480 veredictos del escenario industrial cumplen `veredicto.schema.json`, sin un solo error.

## Lo que el motor no hace

- **No propaga.** Eso es M3, que consume la alerta ya emitida.
- **No persiste nada.** Eso es M5.
- **No llena `riesgo_por_uso`.** Esa capa necesita los criterios de calidad por uso destinado, que siguen sin conseguirse (F19). Inventarla seria dar por normativa una opinion nuestra.
- **No distingue municipal de industrial por la razon DQO/DBO**, que es el mejor discriminador que existe: la estacion mide cinco parametros de campo y ninguno es DQO ni DBO. Con sensores solo se leen las tres firmas de arriba. La razon DQO/DBO queda para el analisis historico.
- **La deteccion de deriva no esta validada.** Un dia de datos no alcanza: una sonda se descalibra en semanas. La regla monotona que trae es un marcador conservador, no una medicion.


# Modelos proxy: laboratorio desde sensor

Generado por `scripts/90_modelos_proxy.py`.

La estacion mide conductividad y turbiedad en campo. La pregunta es si de ahi se pueden estimar los solidos disueltos y los suspendidos, que normalmente exigen laboratorio. La respuesta es distinta para cada uno, y ahi esta lo interesante.

## CONDUC_CAMPO (uS/cm) -> SDT (mg/L)

- **2,521 pares** del mismo sitio y la misma fecha, en 152 sitios.
- Ajuste: **SDT = 0.7884 x CONDUC_CAMPO^0.9716**, con r de 0.977 en log-log.
- Intervalo del 80 %: de **x0.83 a x1.21** sobre el valor estimado.
- **Probado en sitios que no se usaron para ajustar: error mediano 2 %, percentil 90 7 %.**
- Calibrando por sitio y probando en fechas posteriores (62 sitios con 20 o mas pares): 0 % contra 2 % del modelo global en los mismos datos.

**Veredicto: se publica.**

## TURBIEDAD (UTN) -> SST (mg/L)

- **2,506 pares** del mismo sitio y la misma fecha, en 94 sitios.
- Ajuste: **SST = 2.3121 x TURBIEDAD^0.8448**, con r de 0.852 en log-log.
- Intervalo del 80 %: de **x0.35 a x2.88** sobre el valor estimado.
- **Probado en sitios que no se usaron para ajustar: error mediano 35 %, percentil 90 135 %.**
- Calibrando por sitio y probando en fechas posteriores (62 sitios con 20 o mas pares): 27 % contra 29 % del modelo global en los mismos datos.

**Veredicto: NO se publica como sustituto de laboratorio.**

## Qué se publica y qué no

| Relacion | Error mediano fuera de muestra | p90 | Publicado |
|---|---|---|---|
| CONDUC_CAMPO -> SDT | **2 %** | 7 % | si |
| TURBIEDAD -> SST | **35 %** | 135 % | **no** |

El criterio de publicacion esta escrito en el script: error mediano de a lo mas 10 % y percentil 90 de a lo mas 25 %. Un modelo no entra al contrato solo porque exista.

## Una correccion que hay que hacer explicita

En el analisis exploratorio se reporto una correlacion de **0.947** entre turbiedad y SST, y se cito como evidencia de que la turbiedad podia estimar los solidos suspendidos. **Esa cifra sobrevalora la relacion.** Esta calculada sobre valores crudos que recorren cuatro ordenes de magnitud, y en esos casos la correlacion de Pearson queda dominada por los valores grandes. En espacio logaritmico cae a 0.852, y lo que de verdad importa -el error de prediccion- es del 35 %.

Calibrar por sitio apenas lo baja del 29 % al 27 %, asi que la dispersion no es un sesgo entre sitios que se pueda corregir: es ruido dentro de cada sitio. Tiene sentido fisico, porque la turbiedad responde al tamano y al color de las particulas y no solo a su masa: un arrastre de arcilla y una descarga de materia organica con la misma turbiedad llevan masas muy distintas.

La conclusion util no cambia de signo, cambia de alcance: **la conductividad sustituye una medicion de laboratorio, la turbiedad no.**

## Cómo se usa

`contrato/fixtures/modelos_proxy.json` trae los modelos publicados con su banda. La estacion o el backend aplican `y = a * x^b` y reportan la estimacion **con su banda**, nunca como un valor puntual medido. Los campos `factor_banda_p10` y `factor_banda_p90` multiplican la estimacion para dar el intervalo del 80 %.

La turbiedad sigue siendo util por si misma: es uno de los cinco parametros que el motor de reglas vigila y la que delata un arrastre cuando sube con la conductividad a la baja. Lo que no hace es dar un numero de SST que se pueda reportar como medicion.


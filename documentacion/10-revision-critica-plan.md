# Revisión crítica del plan de etapas 2 a 8

Este documento objeta partes del plan con los datos ya construidos en la mano. No es una
reescritura: la estructura de ocho etapas es correcta y el contrato de datos como puerta
previa al reparto de trabajo es la mejor decisión del documento. Lo que sigue son seis
objeciones concretas, cada una con el número que la respalda, y lo que propongo en su
lugar.

Fuente de los números: [`01-verificacion-datos.md`](08-verificacion-datos.md) y
[`02-hallazgos-exploratorio.md`](09-hallazgos-exploratorio.md).

---

## Resumen

| Del plan | Veredicto |
|---|---|
| Estructura de 8 etapas y dependencias | **Se conserva** |
| Contrato de datos antes de repartir trabajo (§2.7) | **Se conserva y se amplía**: le faltaba el esquema `veredicto` |
| Semáforo como clasificación central (§2.1) | **Se degrada** a capa de comunicación pública; no puede ser el eje analítico |
| Línea base por sitio (§2.2) | **Se asciende** a mecanismo principal de detección |
| Umbral fijo como regla primaria (§2.3) | **Se invierte**: aquí es la regla secundaria |
| NOM-001 como criterio de "peligroso" (§2.3, P7 de Etapa 1) | **Se corrige**: no aplica a cuerpos receptores |
| Streeter-Phelps (§2.5) | **Se reemplaza** por transporte advectivo con decaimiento |
| Tabla de fuente probable (§2.4) | **Se convierte** en puntaje con evidencia |
| Pronóstico temporal con IA | **No se intenta**: los datos no lo soportan |

---

## Objeción 1. El semáforo, y por qué tu intuición es correcta pero por la razón inversa

Dijiste que el semáforo simplifica demasiado y que es información que vería alguien
especializado, no un ciudadano. La segunda mitad está al revés: **el semáforo es un
instrumento de comunicación pública**, CONAGUA lo diseñó precisamente para que alguien
sin formación técnica entienda el estado de un cuerpo de agua. El que *no* puede usarlo
es el especialista.

Pero tu intuición de fondo es correcta, y los datos la respaldan de manera contundente:

- **176 de los 198 sitios con dato están en rojo: el 89 %.**
- Un índice continuo sencillo (la mediana de `valor / límite de la clase Contaminada`
  sobre siete parámetros) separa a esos mismos sitios en un rango de **0.15 a 12.9**.
- **Dentro de los sitios en rojo, el índice va de 0.15 a 12.9.** El color los iguala. El
  número los ordena.

Una variable que toma el mismo valor en 176 de 198 casos no tiene poder de
discriminación. En términos prácticos, el semáforo del Alto Atoyac **no puede**:

1. **Priorizar.** ¿Qué punto intervengo primero si todos son rojos?
2. **Detectar que algo empeoró.** Un rojo que se pone más rojo sigue siendo rojo.
3. **Medir si una medida funcionó.** Esta es la peor. La regla del semáforo es "el peor
   parámetro determina el color". Si un municipio sanea sus descargas y la DBO baja de
   120 a 40 mg/L, pero los coliformes siguen altos, el sitio sigue rojo. Le estás
   diciendo a quien invirtió el dinero que no cambió nada. Ningún organismo operador va
   a adoptar un sistema que no puede mostrarle su propio avance.

Hay un dato que lo vuelve tangible. La estación 1 de los fixtures (`DLTLA2582`, río
Xopanac, Nativitas) tiene como **comportamiento normal histórico**: OD mediano
0.9 mg/L, turbiedad 368 UTN, conductividad 2 246 µS/cm. Su estado normal ya incumple
todos los criterios. Un semáforo ahí está pegado en rojo desde 2012 y lo seguirá estando
pase lo que pase.

### Lo que propongo: tres capas de salida, no una

El error del plan no es usar el semáforo; es tener **una sola capa de salida para dos
audiencias con necesidades opuestas**.

| Capa | Pregunta que responde | Para quién | Forma |
|---|---|---|---|
| **Índice de deterioro** | ¿Qué tan mal está y cómo se compara con los otros puntos? | Técnico, autoridad | número continuo 0–100, ranking, serie en el tiempo |
| **Diagnóstico por parámetro** | ¿Qué parámetro específico incumple, cuánto, y contra qué criterio? | Autoridad, con valor probatorio | tabla parámetro × criterio × excedencia × fecha × n |
| **Riesgo por uso** | ¿Puedo tocar el agua? ¿Riego con esto? ¿Es peligroso vivir al lado? | Ciudadano | lenguaje natural, por actividad |

La tercera capa es la que falta por completo en el plan y es la verdaderamente ciudadana.
A una persona de Nativitas no le sirve "rojo" ni le sirve "DQO 203 mg/L". Le sirve:

> *No metas las manos ni los pies. No riegues hortalizas de hoja con esta agua. El olor
> que percibes es consistente con lo que miden los sensores: hay descarga de aguas
> residuales aguas arriba de tu punto.*

Eso es información accionable, es honesta y no simplifica: **reencuadra**. Y de paso
resuelve tu objeción sin perder al público, porque el especialista se queda con las dos
primeras capas, que sí tienen resolución.

En el contrato esto ya está implementado: `veredicto.schema.json` tiene
`indice_deterioro`, `parametros[]` con `veces_el_limite` y `posicion_en_banda`,
`semaforo_publico` marcado explícitamente como *solo para la vista ciudadana*, y
`riesgo_por_uso` con las tres actividades.

---

## Objeción 2. La NOM-001-SEMARNAT-2021 no regula cuerpos receptores

El plan la usa para responder "¿a partir de qué valor se considera anormal o peligroso?"
(P7 de la Etapa 1, §2.3 de la Etapa 2). Eso es un error técnico y legal: esa norma
**establece los límites permisibles de contaminantes en las descargas de aguas
residuales**. Regula lo que sale de un tubo, no la calidad del río que lo recibe.

Comparar una medición de cauce contra la NOM-001 es, estrictamente, la pregunta
equivocada. Un río puede estar devastado y ninguna medición "incumple" la norma, porque
la norma no le aplica.

Qué usar en cada caso:

| Tipo de punto | Criterio correcto | Dónde está |
|---|---|---|
| Sitio de cauce (la gran mayoría) | Escala de calidad del agua superficial de CONAGUA | `umbral.csv`, escala `CONAGUA_SUP` |
| Punto de descarga o efluente | NOM-001-SEMARNAT-2021, tablas 1 y 2 | `umbral.csv`, escalas `NOM001_2021_RIO` y `NOM001_2021_EMBALSE` |
| Capa de riesgo por uso | Criterios ecológicos de calidad del agua por uso destinado | **falta**, ver abajo |

Dos consecuencias prácticas:

1. **Hay que separar los puntos de descarga de los de cauce.** Encontré 11 candidatos:
   2 marcados por subtipo de cuerpo de agua y 9 más que el nombre delata sin que el
   subtipo lo refleje (`DESCARGA EL CARMEN`, `AGUAS ABAJO DE LA DESCARGA TEXTIL ZALDO`,
   `DESCARGA CIX 1 TETLA`, `AGUAS ABAJO DESCARGA POLAQUIMIA`, `DESCARGAS REGIONALES
   NATIVITAS`, entre otros). Mezclarlos con los sitios de cauce infla el deterioro
   aparente del río, y son justo los únicos donde la NOM-001 sí tiene valor probatorio.
   El contrato ya prevé la bandera `es_descarga` en `estacion.schema.json`.

2. **Falta una fuente para la capa de riesgo por uso.** Lo convencional en México son los
   *Criterios Ecológicos de Calidad del Agua CE-CCA-001/89* (DOF 13/12/1989), que fijan
   valores por uso destinado: fuente de abastecimiento, riego agrícola, recreativo con
   contacto primario, protección de vida acuática. Es un acuerdo viejo y conviene
   verificar su vigencia y complementarlo con guías de la OMS para contacto recreativo,
   pero es la referencia que la literatura mexicana sigue citando para cuerpos
   receptores. **Propongo agregarlo como fuente F19 de la Etapa 1.** Sin él, la capa
   ciudadana no tiene respaldo normativo y se queda en opinión.

Y una nota útil para el pitch: **la NOM-001 de 2021 ya no fija límite de DBO5.** La
sustituyó por DQO y carbono orgánico total. Si alguien del jurado conoce la norma vieja y
pregunta por la DBO, saber esto demuestra que leyeron la norma vigente y no la de 1996.

---

## Objeción 3. Streeter-Phelps no se sostiene con estos datos

El plan propone Streeter-Phelps para estimar cómo baja el oxígeno aguas abajo de una
descarga y cómo se recupera. El modelo es correcto, bien conocido y se ve muy bien en una
presentación. Aquí no funciona, por tres razones medidas:

1. **El río vive en hipoxia severa permanente.** OD mediano **1.38 mg/L**, saturación
   mediana **19 %**, y el **59 %** de las mediciones por debajo de 2 mg/L. El descenso de
   oxígeno que el modelo predice ya ocurrió y es crónico: el déficit está casi en su tope
   y no hay margen que modelar. (Para ser justo con el modelo: no hay anoxia total, ningún
   valor baja de 0.5 mg/L, así que no explotaría numéricamente. Simplemente no tiene nada
   que decir.)

2. **No hay con qué calibrarlo.** Streeter-Phelps necesita la constante de
   desoxigenación y la de reaireación. Se calibran observando un tramo donde el oxígeno
   cae y luego se recupera. En estos datos no hay un tramo así identificado, entre otras
   cosas porque todavía no tenemos el orden aguas arriba → aguas abajo de los sitios.

3. **Falta la hidráulica.** El modelo se resuelve sobre tiempo de viaje, que depende de
   la velocidad del flujo. No tenemos velocidad, y **caudal solo en el 32.5 % de los
   muestreos, en 33 de 219 sitios**.

Un modelo calibrado con constantes de literatura, sobre un río que ya está en el piso,
sin velocidad medida, produce una curva bonita sin poder predictivo. Si el jurado tiene a
alguien de hidráulica, es la pregunta que va a hacer y no hay buena respuesta.

### Lo que propongo: transporte advectivo con decaimiento

Mismo objetivo, supuestos que sí podemos sostener:

- **Topología** de la red hidrográfica del INEGI: secuencia de tramos y longitud de cada
  uno sobre el cauce, no en línea recta.
- **Velocidad declarada como intervalo**, por ejemplo 0.3 a 1.0 m/s, derivada del caudal
  donde lo hay. La salida es una **ventana horaria de llegada**, no una hora exacta. Dar
  una hora exacta es inventar precisión que no tenemos.
- **Dilución** por balance de masa en cada confluencia, donde haya caudal.
- **Dos comportamientos distintos según el contaminante**, y esto es lo que lo vuelve más
  útil que Streeter-Phelps:
  - **Degradable** (materia orgánica): decaimiento de primer orden, pierde intensidad en
    el camino.
  - **Conservativo** (conductividad, sales, metales): **no decae**. Solo se diluye. Un
    trazador conservativo te permite afirmar que la contaminación *va a llegar*, con
    mucho menos supuesto.

La salida es más accionable para una autoridad: *"la pluma llega al sitio X entre 4 y 11
horas, con un factor de dilución de 0.6"* mueve a cerrar una toma. Una curva de oxígeno
no mueve a nada.

Streeter-Phelps queda en el contrato como valor alternativo de `modelo`
(`prediccion_propagacion.schema.json`), para aplicarlo si aparece un tramo con
recuperación observable. Y si no aparece, decirlo en el pitch es una fortaleza: *"lo
intentamos, los datos no lo sostienen, hicimos esto otro"*. Eso es ingeniería; forzar el
modelo es decorado.

---

## Objeción 4. El umbral fijo no puede ser la regla primaria

El plan pone dos reglas de detección "que se complementan" (§2.3): umbral fijo y
desviación de la línea base. En este río no son equivalentes y el orden importa.

**El umbral fijo se dispara siempre.** En la estación 1, el comportamiento normal ya
excede todos los criterios. Una alarma por umbral fijo ahí está encendida de forma
permanente desde 2012, y una alarma permanentemente encendida es ruido que la gente
aprende a ignorar.

**Lo único que detecta un evento nuevo es la desviación respecto de la propia historia
del punto.** Que la conductividad pase de su mediana de 2 246 a 14 700 µS/cm es
detectable aunque el sitio ya estuviera en rojo.

Así que la jerarquía correcta es:

1. **Primaria: desviación de la línea base del propio sitio** (percentiles, o z robusto
   sobre mediana y MAD, que aguanta mejor los extremos reales que no son errores).
2. **Secundaria: umbral fijo**, no para disparar la alerta sino para **graduar su
   gravedad** y para la capa de diagnóstico normativo.
3. **Persistencia obligatoria**, no opcional.

Sobre la persistencia hay un número que mide el problema. El evaluador stub del contrato
usa exactamente la regla ingenua del plan (salió de la banda p10–p90, tres lecturas
seguidas). Medimos lo que produce:

| Escenario | Alertas del stub |
|---|---|
| **`normal`, sin ningún incidente** | **31** |
| `descarga_organica` | 28 |
| `descarga_industrial` | 35 |
| `lluvia` | 36 |

**Treinta y una alertas en un día sin nada, y treinta y cinco con una descarga
industrial.** La regla ingenua no discrimina. Eso no es un defecto del stub: es la
demostración empírica de que la banda p10–p90 por sí sola no sirve, porque por
construcción el 20 % de las lecturas normales cae fuera de ella.

Esta tabla es ahora la vara del módulo de análisis: llegar a cerca de cero en `normal`
sin perder el evento en los otros tres. Es un criterio de terminado medible, y es un
resultado que se reporta en la Etapa 6.

---

## Objeción 5. "Fuente probable": de tabla de consulta a puntaje con evidencia

La tabla de §2.4 es una buena heurística pero como está es una consulta cualitativa
("DBO y coliformes altos → municipal") que no dice *cuánto* de cada firma hay ni *qué
tan seguro* es. Tenemos los datos para hacerla cuantitativa.

Discriminadores que el conjunto de datos ya soporta:

| Firma | Indicadores | Respaldo en los datos |
|---|---|---|
| **Municipal** | DBO y coliformes altos, OD bajo, **SAAM** (detergentes), nitrógeno amoniacal, **razón DQO/DBO baja** (1.5 a 2.5) | COLI_FEC y E_COLI correlacionan 0.987; SAAM cae 70.8 % en lluvias, lo que delata origen de descarga y no de arrastre |
| **Industrial** | conductividad y SDT altos, pH fuera de rango, **fenoles**, metales, toxicidad, **razón DQO/DBO alta** (mayor que 3, materia poco biodegradable) | los metales suben juntos: Cu-Ni 0.885, Cd-Cu 0.878, Cu-Pb 0.874, Cr-Cu 0.791. Fenoles caen 96.2 % en lluvias |
| **Arrastre o escurrimiento** | SST y turbiedad altos **con conductividad a la baja**, en temporada de lluvias | SST-turbiedad correlacionan 0.947; es la firma que el escenario `lluvia` reproduce |

La **razón DQO/DBO** merece mención aparte: es el discriminador estándar entre descarga
municipal e industrial y tenemos ambos parámetros en 2 769 mediciones conjuntas. Es una
sola división y vale más que media tabla de heurísticas.

Propongo que `fuente_probable` devuelva un tipo, un **puntaje de 0 a 1** y la **lista de
razones medibles** que llevaron a esa conclusión. Ya está así en
`alerta.schema.json`. Y una advertencia importante:

> Mientras no incorporemos REPDA y el DENUE filtrado, "fuente probable" es una etiqueta,
> no una pista. Decir "descarga industrial" sin poder nombrar un establecimiento aguas
> arriba no le sirve a una autoridad. El campo `candidatos_aguas_arriba` del esquema está
> vacío hoy y es la razón por la que esas dos fuentes importan más de lo que el plan
> sugiere.

---

## Objeción 6. Dónde la inteligencia artificial aporta, y dónde sería decorado

El reto pide "inteligencia artificial y análisis de información" y el plan lo deja
implícito. Conviene decidirlo explícitamente, porque hay una trampa evidente.

**Lo que sí tiene sustento:**

1. **Detección de anomalías multivariada por sitio.** Con 69 a 80 sitios que tienen 12 o
   más mediciones en los parámetros de campo, se puede ajustar un modelo del
   comportamiento conjunto normal de cada punto y medir qué tan improbable es una lectura
   nueva. Esto es el núcleo real del aprendizaje del proyecto y resuelve el problema de
   las falsas alarmas de la objeción 4.

2. **Modelos proxy: estimar un parámetro de laboratorio desde un sensor barato.** Este es
   el hallazgo más aprovechable de la Etapa 1:

   | Se puede estimar | Desde | Correlación | n |
   |---|---|---|---|
   | SST (laboratorio) | turbiedad (sensor) | **0.947** | 2 506 |
   | SDT (laboratorio) | conductividad (sensor) | **0.971** | 2 521 |

   Son dos regresiones pequeñas que convierten una estación de 3 000 pesos en una que
   reporta parámetros que normalmente exigen laboratorio. Es el puente entre la Etapa 1 y
   la Etapa 3, es honesto si se reporta el R² y el intervalo de predicción, y es
   exactamente el tipo de cosa por la que un jurado premia un trabajo de datos.

3. **Clasificación de la fuente probable** con el puntaje de la objeción 5, validado
   contra los sitios donde el nombre ya dice qué hay aguas arriba (son etiquetas débiles,
   pero son etiquetas).

4. **Clasificación de la foto del reporte ciudadano** (§5.4). Funciona, es vistoso, es
   opcional. Última prioridad.

**Lo que no hay que intentar: pronóstico temporal.** Nada de LSTM, Prophet ni series de
tiempo. Entre muestreos consecutivos del mismo sitio pasan **49 días de mediana, 220 en
el percentil 90 y hasta 3 294 días**, con un hueco de densidad entre 2019 y 2024. No es
una serie de tiempo, es una colección de visitas espaciadas. Cualquier modelo de
pronóstico entrenado sobre eso es una curva sin información, y la primera pregunta del
jurado va a ser "¿con cuántos datos?".

Vale la pena tener la respuesta preparada: *"no pronosticamos en el tiempo porque la
cadencia del monitoreo oficial no lo permite; pronosticamos en el espacio, que es donde
la física sí nos da una base."*

---

## Lo que el plan no contempla y debería

1. **Carga másica, no solo concentración.** Una barranca con 300 mg/L de DBO y 5 L/s
   aporta mucho menos al río que un colector con 80 mg/L y 2 000 L/s. Priorizar por
   concentración castiga a los arroyos chicos y deja libre al que más contamina. Tenemos
   caudal en 33 sitios: se puede calcular carga en kg/día ahí y declararlo faltante en el
   resto. Es un criterio de priorización mucho más defendible.

2. **Deriva de los sensores.** El plan contempla falla del sensor (valores imposibles,
   lecturas congeladas) pero no la **deriva**, que es el modo de falla real de las sondas
   de OD y pH: se descalibran en semanas, sin dar ningún síntoma de falla. Un sitio que
   "empeora lentamente" puede ser una membrana sucia. Impacta tres etapas: el contrato
   necesita `ultima_calibracion` (ya está), el motor necesita un aviso de
   `posible_deriva` (ya está en el enum), y la Etapa 7 necesita contemplar el costo
   recurrente de calibración, que es el que hunde los proyectos de monitoreo reales.

3. **El n y la fecha, visibles en pantalla, siempre.** El plan dice "indicar cuántas
   mediciones la respaldan" (§2.2) y está bien, pero no lo propaga a la interfaz. Toda
   banda, todo índice y todo semáforo debe mostrar con cuántos datos se calculó y de
   cuándo es el último. Hay 21 sitios sin semáforo y 1 sin ningún dato: la interfaz tiene
   que tratar "no sé" como un estado de primera clase, no como un espacio en blanco.

4. **Gobernanza de los umbrales.** Para que una autoridad adopte esto, los criterios
   tienen que ser una tabla editable y versionada, no constantes en el código. Ya lo son
   (`umbral.csv`), pero conviene que el panel lo muestre: *"evaluado contra la escala
   CONAGUA_SUP, versión tal"*.

5. **Privacidad del reporte ciudadano.** El plan menciona el aviso de privacidad. Falta
   lo operativo: la foto de un teléfono trae EXIF con coordenadas y modelo del aparato, y
   publicarla tal cual expone al denunciante, que en un conflicto por descargas
   industriales no es un riesgo teórico. El contrato ya exige `exif_removido: true` y el
   servidor mock rechaza la foto si no viene, además de no exponer el correo en la API
   pública. Hay que redondear también la coordenada que se publica en el mapa.

---

## ¿Concluyó la Etapa 1?

**No, y hay tres bloqueantes.** Lo bueno es que ninguno es del tipo "los datos no
sirven": lo que ya está, está limpio y verificado. El solapamiento entre fuentes coincide
en 99.3 % de los casos, no hay un solo choque de unidades entre fuentes, y hay línea base
suficiente en los cinco parámetros que un sensor puede medir, que era la condición que la
Etapa 3 necesitaba.

| # | Bloqueante | A qué bloquea | Esfuerzo |
|---|---|---|---|
| 1 | **Topología del río.** `c_sitio_aguas_abajo` está vacío en los 219 sitios. La red hidrográfica ya está descargada y extraída (10 subcuencas), falta proyectar los sitios sobre ella y ordenarlos. | Modelo de propagación (Etapa 2), vista de "fuentes aguas arriba" (Etapa 4) **y** asignación de reportes ciudadanos al tramo correcto (Etapa 5) | 1 día |
| 2 | **Precipitación (F13).** Las páginas del SMN cargan los enlaces con JavaScript y las rutas viejas dan error 500. | El escenario "lluvia" de las Etapas 3 y 6. Sin lluvia medida no se puede distinguir un arrastre de una descarga clandestina, y es uno de los cuatro escenarios de prueba del reto | medio día |
| 3 | **REPDA (F09) y DENUE filtrado (F12).** El DENUE ya está descargado, sin procesar. | "Fuente probable" con nombre y apellido, panel de autoridad | 1 día |

**El bloqueante 1 es el verdadero camino crítico del proyecto, no el semáforo.** Tres
etapas distintas dependen de él y nadie puede avanzar en propagación sin el orden de los
sitios. El plan lo tiene como el paso 7 de la Etapa 1, casi como un detalle; debería ser
la primera tarea del siguiente bloque de trabajo, junto con el contrato.

Dos cosas más, menores, que conviene cerrar: separar los 11 puntos de descarga de los de
cauce, y conseguir el criterio por uso (F19) para que la capa ciudadana tenga respaldo.

---

## Cambios concretos propuestos, etapa por etapa

| Etapa | Cambio |
|---|---|
| 1 | Agregar F19 (criterios de calidad por uso destinado). Marcar `es_descarga` en los 11 candidatos. Calcular la topología como primera tarea, no como la séptima. |
| 2.1 | El semáforo deja de ser la clasificación central. Se calcula un **índice de deterioro continuo** y el color se deriva de él solo para el público. Se agrega la capa **riesgo por uso**. |
| 2.2 | Sin cambios de fondo: la línea base sube de prioridad y pasa a ser el mecanismo de detección principal. Usar mediana y MAD además de media y desviación estándar. |
| 2.3 | Invertir la jerarquía de reglas: desviación de línea base primaria, umbral fijo secundario para graduar gravedad. Persistencia obligatoria. Agregar detección de **deriva**, no solo de falla. |
| 2.4 | La tabla de fuente probable se vuelve un **puntaje con evidencia**. Incorporar la razón DQO/DBO como discriminador. |
| 2.5 | Sustituir Streeter-Phelps por **transporte advectivo con decaimiento**, con velocidad como intervalo y distinción entre contaminante degradable y conservativo. |
| 2.7 | Agregar el esquema **`veredicto`** (la salida del motor de reglas), que era el que faltaba y es el más compartido. Ya está en `contrato/esquemas/`. |
| 3.1 | Los cinco parámetros de campo quedan confirmados por los datos: SDT y turbiedad tienen línea base en 80 sitios; OD, pH, conductividad y temperatura del agua en 69. Agregar los **modelos proxy** turbiedad→SST y conductividad→SDT como funcionalidad del dispositivo. |
| 4.3 | Toda cifra en pantalla lleva su `n` y su fecha. "Sin dato" es un estado visible. El criterio aplicado se nombra explícitamente. |
| 5.2 | `exif_removido` obligatorio, coordenada redondeada en el mapa público, correo fuera de la API pública. |
| 6.2 | Reportar las falsas alarmas **contra la línea base medida del stub** (31 alertas en el día de control). Es una comparación concreta en lugar de un porcentaje abstracto. |
| 7.2 | Incluir el costo recurrente de **calibración y reposición de sondas**, que es el que decide si el sistema sobrevive al año dos. |
| 8.2 | Preparar tres respuestas: por qué no hay pronóstico temporal, por qué no usamos Streeter-Phelps, y por qué el semáforo no es el centro del análisis. Las tres son fortalezas si se cuentan bien. |

# Glosario

Para quien escribe la documentación o el pitch sin ser especialista en calidad del agua.
Los términos están agrupados por origen, no en orden alfabético, porque lo que se necesita
normalmente es entender un grupo completo.

---

## Instituciones y normas

| Término | Qué es |
|---|---|
| **CONAGUA** | Comisión Nacional del Agua. Autoridad federal del agua en México y origen de casi todos los datos del proyecto. |
| **RENAMECA** | Red Nacional de Medición de la Calidad del Agua, operada por CONAGUA. Monitorea sistemáticamente los principales cuerpos de agua del país con laboratorios acreditados. Es la fuente de la línea base. |
| **SECIHTI** | Secretaría de Ciencia, Humanidades, Tecnología e Innovación. Quien plantea el reto. |
| **INEGI** | Instituto Nacional de Estadística y Geografía. Origen de la red hidrográfica y del DENUE. |
| **SMN** | Servicio Meteorológico Nacional, parte de CONAGUA. Origen de los datos de precipitación (pendientes). |
| **DOF** | Diario Oficial de la Federación. Donde se publican las normas. |
| **NOM-001-SEMARNAT-2021** | Norma que fija los límites permisibles de contaminantes **en las descargas** de aguas residuales. Publicada en el DOF el 11/03/2022. **No regula la calidad de los ríos**, solo lo que se descarga en ellos. |
| **REPDA** | Registro Público de Derechos de Agua. Padrón de concesiones y permisos de descarga, con titular y volumen. |
| **DENUE** | Directorio Estadístico Nacional de Unidades Económicas. Todos los establecimientos del país con giro y coordenada. |
| **IDAR** | Inventario Nacional de Descargas de Aguas Residuales. |
| **CE-CCA-001/89** | Criterios Ecológicos de Calidad del Agua. Acuerdo de 1989 que fija valores por uso destinado del agua (abastecimiento, riego, contacto recreativo, vida acuática). Es la referencia convencional para cuerpos receptores y está pendiente de incorporar. |

---

## Parámetros de calidad del agua

Los que importan en este proyecto, con lo que cada uno delata.

| Clave | Nombre | Unidad | Qué indica |
|---|---|---|---|
| **OD** | Oxígeno disuelto | mg/L | El oxígeno que el agua tiene disponible para la vida acuática. **Es el indicador de salud más directo.** Un río sano trae 7 a 9 mg/L; el Alto Atoyac tiene una mediana de 1.38 mg/L. |
| **OD %** | Saturación de oxígeno | % | El OD como porcentaje del máximo que esa agua podría disolver a su temperatura. Permite comparar sitios con temperaturas distintas. |
| **DBO5** | Demanda bioquímica de oxígeno | mg/L | Cuánto oxígeno consumen los microorganismos al degradar la materia orgánica. **Alta = materia orgánica biodegradable**, típica de aguas residuales urbanas. |
| **DQO** | Demanda química de oxígeno | mg/L | Cuánto oxígeno se requiere para oxidar químicamente toda la materia orgánica, degradable o no. |
| **Razón DQO/DBO** | — | — | **El discriminador clave.** Cercana a 2 sugiere descarga municipal (materia biodegradable). Mayor que 3 sugiere industrial (materia que los microorganismos no pueden degradar). |
| **SST** | Sólidos suspendidos totales | mg/L | Partículas en suspensión. Altas con conductividad baja y en lluvias indican arrastre de suelo. |
| **SDT** | Sólidos disueltos totales | mg/L | Sales y minerales disueltos. Correlaciona 0.97 con la conductividad. |
| **Turbiedad** | — | UTN | Qué tan turbia está el agua. Medible con sensor barato y correlaciona 0.95 con SST. |
| **Conductividad** | Conductividad eléctrica | µS/cm | Capacidad del agua de conducir electricidad, que depende de las sales disueltas. **Sube con descargas industriales y baja con lluvia.** Medible con sensor barato. |
| **pH** | — | UpH | Acidez o alcalinidad. Fuera del rango 6 a 9 indica descarga química. |
| **CF** | Coliformes fecales | NMP/100 mL | Bacterias de origen intestinal. **Indicador de contaminación por aguas residuales.** |
| **E. coli** | Escherichia coli | NMP/100 mL | Coliforme más específico de origen fecal. Correlaciona 0.99 con coliformes fecales en estos datos. |
| **Enterococos fecales** | — | NMP/100 mL | Otro indicador fecal, se usa cuando la conductividad es alta. |
| **TOX** | Toxicidad aguda | UT | Qué tan tóxica es el agua, medida con organismos vivos (*Daphnia magna* o *Vibrio fischeri*). **Delata descarga industrial.** |
| **SAAM** | Sustancias activas al azul de metileno | mg/L | Detergentes. Indicador de descarga doméstica. |
| **Fenoles** | — | mg/L | Compuestos de origen industrial. Caen 96 % en lluvias, lo que confirma que son de descarga y no de arrastre. |
| **Grasas y aceites** | — | mg/L | Descarga doméstica o industrial. |
| **Nitrógeno amoniacal** | — | mg/L | Descarga reciente de aguas residuales. |
| **NMP** | Número más probable | — | Método de conteo de bacterias. No es una unidad de concentración sino una estimación estadística. |
| **Límite de detección** | — | — | El valor mínimo que un laboratorio puede medir. Un resultado `<0.01` significa "hay menos de 0.01, no sé cuánto". El 37 % de los resultados viene así. |

---

## Hidrología y geografía

| Término | Qué es |
|---|---|
| **Cuenca** | El territorio cuya agua de lluvia escurre hacia un mismo punto de salida. La unidad natural de análisis del agua. |
| **Alto Atoyac** | La parte alta de la cuenca del río Atoyac, entre Puebla y Tlaxcala. El área de estudio de este proyecto. |
| **Cuenca R. Atoyac (RH18A)** | Clave de la cuenca en la nomenclatura del INEGI, dentro de la Región Hidrológica 18 (Balsas). Se subdivide en 10 subcuencas, RH18Aa a RH18Aj. |
| **Lótico** | Cuerpo de agua **en movimiento**: río, arroyo, barranca. |
| **Léntico** | Cuerpo de agua **quieto**: presa, lago, laguna. La distinción importa porque las escalas de calidad y los límites normativos son distintos. |
| **Valsequillo** | Presa Manuel Ávila Camacho, que recibe el Atoyac aguas abajo de la zona metropolitana de Puebla. |
| **Zahuapan** | Río de Tlaxcala que desagua en el Atoyac. Por eso Tlaxcala entra al área de estudio. |
| **Estiaje** | Temporada seca, de noviembre a mayo. **La contaminación se concentra**: la DBO mediana duplica la de lluvias porque hay menos agua para diluir. |
| **Lluvias** | De junio a octubre. Diluye las descargas pero arrastra sedimento y basura. |
| **Aguas arriba / aguas abajo** | Posición relativa sobre el cauce. Lo que pasa aguas arriba llega aguas abajo, y esa es la base del modelo de propagación. |
| **Caudal** | Volumen de agua que pasa por un punto por unidad de tiempo, en L/s. |
| **Carga másica** | Caudal × concentración, en kg/día. **Mide cuánto contaminante aporta realmente un punto**, a diferencia de la concentración, que solo dice qué tan sucia está el agua. Un arroyo muy sucio y muy pequeño aporta menos que un colector grande y medianamente sucio. |
| **Línea de flujo** | En la red hidrográfica del INEGI, el segmento que modela un tramo de escurrimiento, con su dirección. |

---

## Términos del proyecto

Lo que nombramos nosotros. Si aparece en el código o en un esquema, está aquí.

| Término | Qué es |
|---|---|
| **Línea base** | La banda de comportamiento normal de un parámetro en un sitio, calculada con su propia historia: media, mediana, desviación, percentiles 10 y 90, mínimo y máximo, **más el número de mediciones que la respaldan**. Es el mecanismo de detección del sistema. |
| **Índice de deterioro** | Medida continua de qué tan mal está un punto. Sustituye al semáforo como variable para ordenar y comparar. |
| **Semáforo** | Clasificación en verde, amarillo y rojo. En este proyecto vive **solo en la vista ciudadana**, porque 176 de 198 sitios están en rojo y el color no ordena nada. |
| **Riesgo por uso** | La capa ciudadana: qué puedes y qué no puedes hacer con esta agua (contacto directo, riego de hortalizas, abrevadero). |
| **Veredicto** | La salida del motor de reglas para una lectura: clasificación por parámetro, posición en la banda, índice, avisos técnicos y alertas. Es la frontera más compartida del sistema. |
| **Aviso técnico** | Problema del **dispositivo**, no del río: valor imposible, lectura congelada, salto imposible, batería baja, enlace marginal, deriva. **Nunca se mezcla con una alerta ambiental.** |
| **Deriva** | Que un sensor se descalibre poco a poco sin dar síntoma de falla. Es el modo de falla real de las sondas de OD y pH, que se descalibran en semanas. Un sitio que "empeora lentamente" puede ser una membrana sucia. |
| **Persistencia** | Exigir varias lecturas anómalas seguidas antes de emitir una alerta, para no alarmar por ruido. |
| **Fuente probable** | Estimación del tipo de origen de una contaminación —municipal, industrial, arrastre— con un **puntaje de 0 a 1** y la lista de razones medibles. Es una estimación, no un diagnóstico, y se presenta así. |
| **Fixture** | Archivo de datos de ejemplo que sustituye a un módulo que todavía no existe. Los de este proyecto se generan con la banda histórica real de cada sitio. |
| **Escenario** | Un día completo de lecturas de las cinco estaciones con un incidente inyectado: descarga orgánica, descarga industrial, lluvia o falla de sensor. Son la suite de pruebas del motor de reglas. |
| **Stub** | El evaluador tonto que trae el servidor mock, marcado como `"motor": "stub"`. Existe para que el frontend tenga datos y para dar una vara medible al motor real. |
| **Contrato de datos** | El conjunto de esquemas que define la frontera de cada módulo. La única dependencia legítima entre dos personas del equipo. |
| **Censurado** | Un valor que se sabe mayor o menor que un umbral pero no exactamente. `<0.01` es censurado por abajo; `>24000` por arriba. |
| **M0 a M10** | Los once módulos de trabajo. Ver [11-metodologia-modulos.md](11-metodologia-modulos.md). |
| **F01 a F19** | Los identificadores de las fuentes de datos. Ver [04-fuentes-de-datos.md](04-fuentes-de-datos.md) y [`datos/bitacora.md`](../datos/bitacora.md). |
| **`c_` (prefijo)** | Marca una clave o código en los nombres de campo: `c_sitio`, `c_parametro`, `c_alerta`. Es una convención del proyecto para distinguir llaves de atributos. |

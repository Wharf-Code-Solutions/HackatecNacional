# Fuentes de datos: de dónde, cómo y por qué

Este documento explica el **razonamiento** detrás de cada fuente. El registro operativo
—URL exacta, fecha de descarga, tamaño, número de registros— está en
[`datos/bitacora.md`](../datos/bitacora.md).

## El principio que ordena la recolección

> Un dato que no ayude a responder una de las ocho preguntas del plan queda fuera del
> alcance.

No se recolectó "todo lo que hubiera sobre el Atoyac". Cada fuente entró porque responde
una pregunta concreta, y las que no responden ninguna se dejaron fuera a propósito. Las
preguntas están en la sección 3 de [07-plan-recoleccion-datos.md](07-plan-recoleccion-datos.md);
en resumen: dónde están los puntos críticos, qué tan contaminados están, cuál es su rango
normal, cómo cambian por temporada, qué los causa, qué queda aguas arriba de qué, a partir
de qué valor algo es anormal, y qué medidas aplican.

## Por qué CONAGUA y no otra fuente

La **Red Nacional de Medición de la Calidad del Agua (RENAMECA)** es el monitoreo oficial
del país. Tres razones por las que es la base y no una fuente más:

1. **Es la autoridad del dato.** Si el sistema va a alertar a una dependencia pública, la
   línea base tiene que ser la del propio gobierno. Un umbral calculado con datos
   académicos es discutible; uno calculado con datos de CONAGUA no.
2. **Tiene continuidad.** 2012 a 2025 en el mismo esquema de claves de sitio, lo que
   permite series por punto.
3. **Usa laboratorios acreditados** y publica su metodología, así que los valores son
   legalmente defendibles.

Su límite es la frecuencia: muestreos de laboratorio pocas veces al año. Precisamente el
hueco que el proyecto llena con sensores continuos.

---

## Las fuentes, por lo que aportan

### Calidad del agua: el corazón del conjunto de datos

| ID | Qué es | Por qué esta y no otra |
|---|---|---|
| **F01** `Resultados_Rio_Atoyac.xlsx` | 73 sitios, 2 140 muestreos **casi mensuales** de 2012 a 2018, 234 parámetros | Es la fuente más densa que existe de esta cuenca. Sin ella no habría línea base estadísticamente defendible: es la que aporta 75 298 de los 145 703 resultados |
| **F05** `RESULTADOS-PUEBLA.xlsb` y `RESULTADOS-TLAXCALA.xlsx` | RENAMECA por estado, **hasta 2025-12-08** | Extiende la serie al presente. F01 se detiene en 2018 |
| **F02** `Calidad_del_Agua_Superficial_p_2012-2025.xlsx` | 5 033 sitios nacionales con **semáforo oficial**, contaminantes señalados, coordenadas, diccionario de datos y **las escalas numéricas** | Un solo archivo cubre tres cosas que el plan listaba por separado (F02, F03 y F06). Trae la clasificación oficial, que es lo que permite decir "CONAGUA considera este sitio contaminado" en lugar de "nosotros lo consideramos" |
| **F03** KMZ de los sitios | geometría lista para mapa | Ahorra construir la capa desde coordenadas |

**Cómo se obtuvieron, y por qué vale la pena contarlo:** el PDF de transparencia de
CONAGUA dice "para descargar el archivo haga clic en la siguiente liga", pero **esas ligas
no están en el texto del PDF**: son anotaciones de hipervínculo del documento. Hubo que
leer las anotaciones `/URI` con `pypdf` para encontrarlas. Son tres archivos que de otro
modo son inencontrables, incluido el más valioso de todos (F01).

Y el portal `datos.conagua.gob.mx`, que es el que el plan original señalaba, **está detrás
de Imperva y responde 403 a cualquier cliente que no sea un navegador**. El mismo
contenido, y más reciente, está en las páginas de `gob.mx/conagua`, que sí son accesibles.
Esto queda documentado porque alguien lo va a volver a intentar.

### Criterios: a partir de qué valor algo es anormal

| ID | Qué es | Para qué se usa |
|---|---|---|
| **F06** Escalas de CONAGUA | Clases Excelente / Buena / Aceptable / Contaminada / Fuertemente contaminada por parámetro | **El criterio para sitios de cauce.** Es el que aplica a la gran mayoría de los puntos |
| **F07** NOM-001-SEMARNAT-2021 | Límites permisibles en **descargas** de aguas residuales | **Solo para puntos de descarga.** Ver la advertencia de abajo |

> **Advertencia que cambia el diseño:** la NOM-001-SEMARNAT-2021 regula lo que sale de un
> tubo, no la calidad del río que lo recibe. Comparar una medición de cauce contra esa
> norma es, estrictamente, la pregunta equivocada. Se usa únicamente en los puntos que son
> descargas —identificamos 11 candidatos— y para los sitios de cauce se usa la escala de
> CONAGUA. El plan original las confundía; el razonamiento está en
> [10-revision-critica-plan.md](10-revision-critica-plan.md).
>
> Dato útil para el pitch: **la versión 2021 de la norma ya no fija límite de DBO5.** La
> sustituyó por DQO y carbono orgánico total.

### Geografía: qué está aguas arriba de qué

| ID | Qué es | Por qué importa tanto |
|---|---|---|
| **F08** Red Hidrográfica INEGI 1:50 000 edición 2.0, Cuenca R. Atoyac, Región H. Balsas | 10 subcuencas (RH18Aa a RH18Aj) con líneas de flujo, divisorias, puntos de drenaje y cuerpos de agua | Alimenta **tres módulos distintos**: la propagación necesita el orden de los sitios, el panel necesita saber qué descargas quedan aguas arriba de un punto, y la app necesita asignar un reporte al tramo correcto del cauce. Sin ella, "aguas arriba" es una palabra sin dato detrás |

**Cómo se obtuvo:** el buscador de descargas del INEGI se renderiza con JavaScript, así
que el enlace no aparece en el HTML de la página. Hubo que operar el buscador en un
navegador para extraer la URL del producto (upc 702825006881). Queda registrada en
`scripts/00_descargar_fuentes.py` para que nadie repita el ejercicio.

**Por qué 1:50 000 y no 1:250 000:** a 250 000 las barrancas urbanas de Puebla no existen
como geometría, y las barrancas son justo donde están varios de los puntos más
contaminados.

### Causas probables: quién contamina

| ID | Qué es | Estado |
|---|---|---|
| **F12** DENUE de Puebla y Tlaxcala | establecimientos económicos con giro SCIAN y coordenada | **Descargado, sin procesar.** 271 MB de CSV sin comprimir |
| **F09** REPDA | padrón de permisos de descarga, con titular y volumen | **Pendiente.** La consulta pública es un formulario web |
| **F11** Plantas de tratamiento municipales | ubicación, capacidad y si operan | **Pendiente** |

> **Por qué estas dos pendientes importan más de lo que el plan sugiere:** sin ellas,
> "fuente probable" es una etiqueta y no una pista. Decir "descarga industrial" sin poder
> nombrar un establecimiento aguas arriba no le sirve a una autoridad que tiene que
> decidir a quién inspeccionar. El campo `candidatos_aguas_arriba` del esquema de alerta
> existe y está vacío por esto.

### Contexto temporal e hidráulico

| ID | Qué es | Estado y por qué |
|---|---|---|
| **F13** Precipitación por estación del SMN | lluvia mensual o diaria | **Pendiente.** Las páginas del SMN cargan sus enlaces con JavaScript y las rutas antiguas `tools/RESOURCES/...` responden error 500. Sin lluvia medida **no se puede distinguir un arrastre por tormenta de una descarga clandestina**, y ese es uno de los cuatro escenarios de prueba del reto |
| **F14** Caudales BANDAS | series hidrométricas | **Pendiente.** Mientras tanto, la columna `CAUDAL` de F01 y F05 da caudal puntual en el 32.5 % de los muestreos, en 33 de 219 sitios |

### Soporte documental

| ID | Qué es | Para qué |
|---|---|---|
| **F15** Diagnósticos del río Atoyac 2012–2024 y 2012–2022 | diagnósticos oficiales del río prioritario | Validar los puntos críticos contra el análisis propio y citar conclusiones oficiales en el pitch |
| **F19** Criterios de calidad del agua por uso destinado | valores por uso: contacto primario, riego agrícola, vida acuática | **Falta y se propone agregar.** Es el respaldo normativo de la capa de "riesgo por uso", que es la capa verdaderamente ciudadana. La referencia convencional en México son los Criterios Ecológicos CE-CCA-001/89 (DOF 13/12/1989), que conviene verificar y complementar con guías de la OMS |

---

## Qué se hizo con los datos crudos

Tres reglas que explican las decisiones de limpieza. El detalle está en
[`datos/README.md`](../datos/README.md); aquí va el por qué.

**1. Nunca se edita un archivo crudo.** Toda transformación es un script que lee de
`crudos/` y escribe en `procesados/`. La razón es reproducibilidad: si alguien pregunta de
dónde salió un número, se puede rastrear hasta el byte original de CONAGUA. Un Excel
editado a mano rompe esa cadena y no hay forma de recuperarla.

**2. Los valores censurados no se tiran ni se inventan.** El 37 % de los resultados viene
como "menor que el límite de detección" (`<0.01`). Tirarlos sesga el análisis hacia arriba;
tratarlos como cero sesga hacia abajo. Se guarda el valor como nulo, se marca la bandera
`bajo_limite_deteccion` y se conserva el límite. En el análisis se usa la mitad del límite,
que es la convención, **y queda documentado**.

**3. El recorte geográfico exige cuenca Y estado.** Hay ríos llamados Atoyac en Oaxaca y
en Guerrero que no tienen nada que ver con esta cuenca. Filtrar solo por nombre de cuenca
los habría incluido. El criterio vive en una sola función, `en_area()` de
`scripts/10_construir_tablas.py`, para que no se duplique con variantes.

## Lo que el conjunto de datos no puede sostener

Decirlo explícitamente evita que alguien construya sobre arena:

- **No es una serie de tiempo continua.** Entre muestreos consecutivos del mismo sitio
  pasan 49 días de mediana, 220 en el percentil 90, y hasta 3 294 días. Sirve para la
  banda normal de cada punto, no para entrenar un modelo de pronóstico temporal.
- **La densidad cae mucho entre 2019 y 2024.** De unos 10 000 resultados del núcleo por
  año en 2013–2018 a entre 500 y 1 800. Cualquier tendencia de esos años se apoya en pocos
  muestreos y hay que decirlo cuando se reporte.
- **Caudal en solo un tercio de los muestreos.** Eso impide priorizar por carga másica
  (kg/día) de forma general, que sería mejor criterio que la concentración: una barranca
  con 300 mg/L y 5 L/s aporta mucho menos que un colector con 80 mg/L y 2 000 L/s.
- **Un sitio sin ningún resultado y 21 sin semáforo.** La interfaz tiene que tratar "no
  sé" como un estado visible, no como un espacio en blanco.

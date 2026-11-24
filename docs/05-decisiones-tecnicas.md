# Decisiones técnicas

Cada decisión con su contexto, la alternativa que se descartó y la consecuencia de
haberla tomado. Si una decisión se revierte, se anota en
[contexto/06-registro-de-cambios.md](contexto/06-registro-de-cambios.md) y se actualiza
aquí.

El formato es deliberadamente seco: quien documenta necesita la justificación, no la
narración.

---

## D1 · Claves naturales, no identificadores autoincrementables

**Decisión.** Toda tabla usa la clave oficial del dato como llave primaria: `c_sitio` es
la clave CONAGUA del sitio (`DLPUE1975`), `c_parametro` es la clave CONAGUA del parámetro
(`DBO_TOT`), `c_estacion` es un código legible (`EST-ATY-01`).

**Por qué.** Cruzar cinco fuentes de gobierno por un identificador inventado por nosotros
obliga a mantener una tabla de equivalencias que nadie más entiende. Con la clave oficial,
cualquiera puede verificar un dato contra la fuente original, y si mañana CONAGUA publica
2026, se une por clave sin trabajo.

**Alternativa descartada.** Enteros autoincrementables. Más cortos, pero pierden la
trazabilidad al dato oficial, que es justo lo que le da valor legal al sistema.

**Consecuencia.** Las llaves son más largas y hay que unir siempre por clave, nunca por
nombre: los nombres de sitio tienen variantes de escritura entre fuentes.

---

## D2 · Nunca se edita un archivo crudo

**Decisión.** `datos/crudos/` es inmutable. Toda transformación es un script que lee de
ahí y escribe en `datos/procesados/`.

**Por qué.** Reproducibilidad. Si alguien pregunta de dónde salió un número, se rastrea
hasta el byte original. Un Excel corregido a mano rompe la cadena de custodia del dato y no
hay forma de recuperarla.

**Consecuencia.** Corregir un error de la fuente cuesta más: hay que hacerlo en el script,
con un comentario que explique por qué. Es el precio correcto.

---

## D3 · CSV en UTF-8 con BOM para las tablas procesadas

**Decisión.** `utf-8-sig`, no `utf-8` liso.

**Por qué.** Sin BOM, Excel en Windows abre el CSV con la página de códigos del sistema y
destroza los acentos: "RÍO ATOYAC" se vuelve "RÃO ATOYAC". Con BOM, Excel lo reconoce como
UTF-8. La mitad del equipo y toda la gente de una dependencia pública trabaja en Excel, y
un entregable que solo se lee con código no se usa.

**Consecuencia.** Quien lea estos archivos con código debe usar `encoding='utf-8-sig'`. Si
usa `utf-8`, el primer nombre de columna llega con un carácter invisible pegado y las
búsquedas por nombre de columna fallan de forma desconcertante.

---

## D4 · Dos vocabularios de parámetros, con una sola tabla de traducción

**Decisión.** Las tablas históricas usan claves CONAGUA (`OD_mg/L`, `pH_CAMPO`); el
contrato usa códigos cortos (`OD`, `PH`). La traducción vive **solo** en
`datos/procesados/parametro.csv`, columna `c_parametro_std`.

**Por qué.** Las claves CONAGUA son la trazabilidad y hay 347, con variantes de superficie,
medio y fondo. Los códigos cortos son lo que un firmware de microcontrolador maneja sin
desperdiciar memoria, y lo que un desarrollador de frontend puede leer sin consultar un
diccionario.

**Alternativa descartada.** Un solo vocabulario. Usar solo claves CONAGUA habría metido
`OD_mg/L` —con barra y mayúsculas mezcladas— en el firmware y en las URL. Usar solo códigos
cortos habría perdido la trazabilidad.

**Consecuencia.** Hay una traducción que mantener. Está en un solo lugar a propósito: si
aparece una segunda tabla de equivalencias en cualquier parte del repositorio, es un error.

---

## D5 · Ante un duplicado gana la fuente más reciente

**Decisión.** Si el mismo `(c_sitio, fecha, c_parametro)` aparece en F05 (RENAMECA
2012–2025) y en F01 (Atoyac 2012–2018), se conserva el de F05.

**Por qué.** F05 es la publicación más reciente del mismo monitoreo, así que incorpora
cualquier corrección posterior.

**Riesgo que se midió antes de decidir.** Las dos fuentes coinciden en 17 031
combinaciones. De esas, **el 99.3 % son idénticas y ninguna difiere más de 5 %**. La regla
no introduce sesgo apreciable.

**Consecuencia conocida.** El conflicto se descarta sin registrarse. Si en algún momento
importa, hay que guardar la discrepancia en lugar de perderla. Está anotado como pendiente
en [08-verificacion-datos.md](08-verificacion-datos.md).

---

## D6 · Los valores censurados se marcan, no se inventan

**Decisión.** `<0.01` se guarda como valor nulo, `bajo_limite_deteccion = true` y
`limite_deteccion = 0.01`. `>24000` se guarda como 24000 con `censurado_superior = true`.
En el análisis se usa la mitad del límite de detección.

**Por qué.** El **37 % de los resultados** viene censurado por abajo. Tirarlos sesga el
análisis hacia arriba (se pierden justo los sitios limpios); tratarlos como cero sesga
hacia abajo. Guardar la bandera deja la decisión analítica en manos de quien analiza, no
escondida en la limpieza.

**Consecuencia.** Toda consulta sobre la tabla `muestreo` tiene que decidir qué hace con
esas filas. La función `valor_de()` de los scripts de análisis es la implementación de
referencia: úsala en lugar de escribir otra.

---

## D7 · El recorte geográfico exige cuenca Y estado

**Decisión.** Un sitio entra si no es subterráneo, su estado es Puebla o Tlaxcala, y su
cuenca o su cuerpo de agua corresponden al sistema Atoyac.

**Por qué.** Hay ríos llamados Atoyac en Oaxaca y en Guerrero. Filtrar solo por nombre de
cuenca los habría incluido y habría contaminado toda la línea base.

**Por qué se incluye Tlaxcala.** El Zahuapan tlaxcalteca desagua en el Atoyac. Excluirlo
dejaría fuera parte de la causa de lo que se mide en Puebla. Entran marcados por `estado`.

**Consecuencia.** El criterio vive en una sola función, `en_area()` de
`scripts/10_construir_tablas.py`. Si se necesita ajustar el área de estudio, se ajusta ahí
y en ningún otro lado.

---

## D8 · El contrato de datos no tiene dependencias externas

**Decisión.** Validador, servidor mock y reproductor de escenarios corren con `python` a
secas. Se escribió un validador de JSON Schema a mano en lugar de usar `jsonschema`.

**Por qué.** En una hackathon, "no me funciona el `pip install`" es media hora perdida de
una persona y un bloqueo para quien esperaba su módulo. La pieza que todos comparten no
puede exigir instalar nada.

**Alternativa descartada.** `jsonschema` y Flask. Más completos, pero habrían puesto una
barrera de entrada en el punto exacto donde no debe haber ninguna.

**Consecuencia.** El validador cubre un subconjunto de JSON Schema: `type`, `required`,
`additionalProperties`, `properties`, `enum`, `const`, `pattern`, mínimos y máximos,
`minItems`, `maxItems`, `items` y `maxLength`. **No resuelve `$ref`.** Los esquemas siguen
siendo válidos para `jsonschema` si alguien lo necesita.

---

## D9 · El índice continuo sustituye al semáforo como eje analítico

**Decisión.** El sistema calcula un índice de deterioro continuo. El semáforo de colores se
deriva de él y vive **solo** en la vista ciudadana.

**Por qué, con el número.** **176 de los 198 sitios con dato están en rojo: el 89 %.** Un
índice continuo separa a esos mismos sitios entre 0.15 y 12.9 veces el límite. El color los
iguala; el número los ordena. Y la regla del semáforo es "el peor parámetro manda", así que
si un municipio sanea sus descargas y la DBO baja de 120 a 40 mg/L pero los coliformes
siguen altos, el sitio sigue rojo: **le estaríamos diciendo a quien invirtió el dinero que
no cambió nada.**

**Consecuencia.** Hay que definir y documentar la fórmula del índice. La versión de
referencia del exploratorio es la mediana de `valor / límite de la clase Contaminada` sobre
siete parámetros. El módulo M2 puede refinarla, pero debe dejarla escrita.

---

## D10 · La desviación de la línea base es la regla primaria; el umbral fijo gradúa

**Decisión.** Se invierte la jerarquía del plan original. Primero se compara la lectura
contra la banda histórica del propio sitio; el criterio normativo sirve para graduar la
gravedad de la alerta, no para dispararla. La persistencia es obligatoria.

**Por qué, con el número.** En la estación 1 el **comportamiento normal histórico** es OD
de 0.9 mg/L y turbiedad de 368 UTN: su estado normal ya incumple todos los criterios. Una
alarma por umbral fijo ahí está encendida desde 2012, y una alarma permanentemente
encendida es ruido que la gente aprende a ignorar.

**Y la prueba de que la regla ingenua tampoco basta sola.** El evaluador stub implementa
exactamente "salió de la banda p10–p90, tres lecturas seguidas" y produce:

| Escenario | Alertas |
|---|---|
| `normal`, sin incidente | **31** |
| `descarga_industrial` | 35 |

No discrimina. Por construcción, el 20 % de las lecturas normales cae fuera de la banda
p10–p90.

**Consecuencia.** Esa tabla es el criterio de terminado del módulo M2: llegar a dos alertas
o menos en `normal` sin perder el evento en los otros escenarios.

---

## D11 · Transporte advectivo con decaimiento, no Streeter-Phelps

**Decisión.** El modelo de propagación es advección con decaimiento de primer orden sobre
la red hidrográfica, con la velocidad declarada como **intervalo** y distinguiendo
contaminante degradable de conservativo. Streeter-Phelps queda como valor alternativo del
esquema, aplicable solo si aparece un tramo con recuperación observable.

**Por qué, con los números.** Streeter-Phelps describe una caída de oxígeno y su
recuperación. Aquí: OD mediano **1.38 mg/L**, saturación mediana **19 %**, **59 %** de las
mediciones bajo 2 mg/L. El descenso ya ocurrió y es crónico. No hay un tramo con
recuperación contra el cual calibrar las constantes, y falta la hidráulica: **caudal en
solo el 32.5 % de los muestreos**, sin velocidad medida.

**Por qué la alternativa es mejor y no solo más barata.** Distinguir degradable de
conservativo es más útil: un trazador conservativo (conductividad, sales, metales) no
decae, solo se diluye, así que se puede afirmar que **va a llegar** con mucho menos
supuesto. Y la salida mueve a la acción: "la pluma llega al sitio X entre 4 y 11 horas, con
dilución de 0.6" hace que alguien cierre una toma. Una curva de oxígeno no.

**Consecuencia.** La salida es una ventana horaria, nunca una hora exacta. Dar una hora
exacta sería inventar precisión que los datos no tienen.

---

## D12 · No se intenta pronóstico temporal

**Decisión.** Nada de LSTM, Prophet ni modelos de series de tiempo.

**Por qué, con el número.** Entre muestreos consecutivos del mismo sitio pasan **49 días de
mediana, 220 en el percentil 90 y hasta 3 294**, con un hueco de densidad entre 2019 y
2024. No es una serie de tiempo, es una colección de visitas espaciadas.

**Dónde sí hay aprendizaje con sustento.** Detección de anomalías multivariada por sitio, y
dos modelos proxy que son el hallazgo más aprovechable del conjunto de datos:

| Se estima | Desde | Correlación | n |
|---|---|---|---|
| SST (laboratorio) | turbiedad (sensor) | 0.947 | 2 506 |
| SDT (laboratorio) | conductividad (sensor) | 0.971 | 2 521 |

Dos regresiones pequeñas que convierten una estación barata en una que reporta parámetros
que normalmente exigen laboratorio.

**Consecuencia.** Hay que tener la respuesta lista para el jurado: *no pronosticamos en el
tiempo porque la cadencia del monitoreo oficial no lo permite; pronosticamos en el espacio,
donde la física sí da una base.*

---

## D13 · La NOM-001 se aplica solo a puntos de descarga

**Decisión.** Los sitios de cauce se evalúan contra la escala de CONAGUA. La
NOM-001-SEMARNAT-2021 se aplica únicamente a los puntos que son descargas.

**Por qué.** Esa norma establece límites para **descargas de aguas residuales**: regula lo
que sale de un tubo, no la calidad del cuerpo receptor. Comparar una medición de río contra
ella es la pregunta equivocada, y legalmente no aplica.

**Consecuencia.** Hay que marcar qué sitios son descargas. Se identificaron **11
candidatos**: 2 marcados por subtipo de cuerpo de agua y 9 que el nombre delata sin que el
subtipo lo refleje. El campo `es_descarga` existe en el esquema de estación y hay que
poblarlo a mano, revisando los 11. Falta además una fuente para los criterios por uso
destinado (F19), que es el respaldo de la capa ciudadana.

---

## D14 · Los fixtures son deterministas y salen de datos reales

**Decisión.** `scripts/40_generar_fixtures.py` usa semilla fija y sortea los valores
normales dentro de la **banda histórica real** de cada sitio.

**Por qué.** Dos razones distintas. La determinista: todo el equipo ve exactamente los
mismos datos, y si alguien reporta un problema con el paquete 237 del escenario de lluvia,
los demás pueden abrir ese mismo paquete. La de los datos reales: el ruido de fondo es el
del Atoyac, no un número inventado, así que un motor de reglas afinado contra los fixtures
sirve en producción.

**Consecuencia.** Si se cambia la semilla o la selección de estaciones, los fixtures
cambian para todos. Es un cambio que se anuncia.

---

## D15 · La foto del reporte ciudadano se almacena sin EXIF

**Decisión.** `exif_removido` es obligatorio y el servidor rechaza con 409 la foto que no
lo traiga. El correo no se expone en la API pública.

**Por qué.** La cámara de un teléfono graba coordenadas y modelo del aparato en el archivo.
Publicar la foto tal cual expone al denunciante, y en un conflicto por descargas
industriales ese no es un riesgo teórico.

**Consecuencia.** El módulo M8 tiene que quitar el EXIF antes de enviar, no después. Falta
además redondear la coordenada que se publica en el mapa público.

---

## D17 · Los nombres de estado se canonizan a `PUEBLA` y `TLAXCALA`

**Decisión.** `normaliza_estado()` en `scripts/_comun.py` unifica las variantes antes de
escribir `sitio.csv`.

**Por qué.** F01 escribe `PUEBLA`; F05 escribe `PUEBLA DE ZARAGOZA`, que en realidad es el
nombre oficial de la capital, no del estado. Sin unificar, la columna `estado` tenía tres
valores para dos estados y cualquier agrupación partía la cuenca.

**Cómo se encontró.** Lo detectó `scripts/50_verificar_repo.py` en su primera corrida,
contra la invariante I6. Es el ejemplo de por qué conviene automatizar las invariantes en
lugar de confiar en que se respeten.

**Consecuencia.** La columna `estado` de `sitio.csv` solo tiene `PUEBLA` y `TLAXCALA`.
`indicador_sitio_periodo.csv` conserva los valores tal como los publica F02, porque es un
reflejo fiel de esa fuente; si se agrupa por estado, hay que normalizar al leerlo.

---

## D16 · Los archivos crudos no se versionan

**Decisión.** `datos/crudos/` y `datos/geo/` están en `.gitignore`. Lo que se versiona es
la URL exacta de cada archivo, en `datos/bitacora.md`, y el script que los vuelve a bajar.

**Por qué.** Son 138 MB y 61 MB de archivos de gobierno. Meterlos al repositorio lo
volvería lento para todo el equipo, y git no comprime bien un `.xlsb`.

**Consecuencia.** Quien clona el repositorio **no tiene los datos crudos** y no puede
correr `scripts/10_construir_tablas.py` hasta ejecutar
`scripts/00_descargar_fuentes.py`. Las tablas procesadas sí están versionadas, así que
quien solo las consume no necesita descargar nada.

---

## D18 · El mecanismo se demuestra con un simulador web, no con Wokwi ni con hardware

**Decisión.** El MVP de M4 es un simulador en JavaScript plano (`dispositivo/simulador/`)
cuyo firmware es una máquina de estados pura, probada en Node y animada en el navegador.
Emite paquetes del contrato v1.0 y puede enviarlos al backend con `POST /lecturas`.

**Por qué.** El mecanismo tiene que mostrarse dentro de una interfaz web propia y
comunicarse después con los demás módulos. Wokwi vive en otro sitio y no trae modelos de las
sondas de OD, pH ni conductividad. Un simulador propio permite además inyectar incidentes,
cortes de red, fallas y deriva, que es lo que demuestra el diseño. Y no exige comprar nada
antes de validar la arquitectura.

**Alternativa descartada.** Wokwi con potenciómetros (no modela el comportamiento real de
una sonda) y un prototipo físico en banco (requiere comprar hardware antes de tener el
diseño validado). El prototipo físico sigue siendo el paso siguiente natural.

**Consecuencia.** Las especificaciones de las sondas y los consumos son **supuestos de
diseño** y la ficha técnica los declara así. Una autoridad puede revisar la lógica del
firmware, no el desempeño de un componente que nadie ha medido.

## D19 · La estación se muestra en 3D y el envío como una línea de tiempo de recepción

**Decisión.** La figura del simulador es una escena 3D con Three.js: un corte del río con las
sondas en su tubo, el cable, el gabinete abierto (controlador, SD, módem, baterías), el panel,
la antena y una torre celular. El envío ya no es un cuadro de "enviado o no": el paquete viaja
de la antena a la torre y llega a una línea de tiempo de 12 h donde cada medición es un punto en
su hora de medición, lleno si la plataforma lo recibió y vacío si sigue en la SD.

**Por qué.** Sin prototipo físico, la figura tiene que justificar la solución como objeto y como
mecanismo de medición. La línea de tiempo muestra a la vez que el dato llega, cuándo llega y que
un corte de red no lo pierde: los huecos se llenan con la hora original. La franja del rango
habitual del sitio queda de fondo sin decir nada más.

**Alternativa descartada.** Mantener la figura en 2D (más ligera, sin WebGL) y un indicador de
envío por paquete (dice si se envió, no qué llegó ni cuándo).

**Consecuencia.** La página depende de WebGL y de bajar Three.js; sin WebGL lo avisa. Las
proporciones de la estación están exageradas 1.6× respecto al río para que se lea; no es un
plano de instalación.

## D20 · El mapa usa MapLibre con base vectorial y las vistas solo muestran lo que se ve

**Decisión.** El mapa pasa de Leaflet con teselas raster a MapLibre GL con la base vectorial de
OpenFreeMap, con sus ríos apagados y el relieve como capa opcional. En las dos vistas se quita
todo lo que no se lee de un vistazo: en el mapa, la leyenda, las notas, las fuentes (pasan al botón
de atribución) y el estado del backend; en el simulador, la línea de fase, la tabla de parámetros,
las notas y el panel de pruebas avanzadas (fallas, mantenimiento, clima, dirección del backend y
paquete crudo). Los valores medidos pasan a las pestañas de la línea de tiempo y el simulador se
conecta solo al backend si está encendido.

**Por qué.** Las vistas existen para justificar la medición en una presentación; nadie se detiene a
leer tablas ni notas. Leaflet con raster limitaba el control sobre la base y el relieve fijo no
siempre ayudaba a leer la red.

**Alternativa descartada.** Mantener los paneles plegados "para quien quiera verlos": en la
práctica son ruido y desvían la atención de la figura.

**Consecuencia.** Las fallas de sonda, la deriva y el clima siguen en el modelo y los prueba
`prueba.js`, pero ya no se disparan desde la pantalla. El paquete crudo se valida con
`contrato/validador.py`, no se lee en la vista.

## D21 · Mapbox opcional por token, con MapLibre como respaldo

**Decisión.** El mapa usa Mapbox GL JS cuando hay un token público en `mapa/config.js` y MapLibre
con OpenFreeMap cuando no. El token no se versiona.

**Por qué.** Mapbox da mejor cartografía, relieve y satélite, pero exige cuenta y token. Hacerlo
opcional deja que cualquiera del equipo corra el mapa sin cuenta y evita publicar el token en el
repositorio del equipo.

**Alternativa descartada.** Solo Mapbox (rompe el mapa a quien no tenga token) o solo MapLibre
(sin satélite ni la cartografía de Mapbox).

**Consecuencia.** Hay dos bibliotecas posibles; el código usa solo la API común. El token debe
restringirse a las URL de la demo en la cuenta de Mapbox. En la primera prueba, el satélite
(`mapbox.satellite`) respondió 429 a todas las teselas mientras el estilo y el relieve cargaban.
Por eso la casilla "Satélite" usa Esri World Imagery (sin llave) con cualquiera de las dos
bibliotecas; es imagen para demostración, no para uso público sin acuerdo con Esri.

---

## D22 · El panel de autoridad sigue el Sistema Nacional de Diseño, tema guinda

**Decisión.** `panel/` usa la paleta y la tipografía del Sistema Nacional de Diseño (SND,
snd.gob.mx): gama guinda como color principal (`--pguinda900` #611232 en cabecera y botón
primario), dorado `--dorado600` #A57F2C solo como acento de títulos y foco, neutros del SND
para texto y filetes, y los colores semánticos del SND para los niveles: Crítica en
`--rojo500` #9B0F15 (error), Preventiva en `--dorado600` #A57F2C e Informativa en
`--azul500` #224497 (info). Para Preventiva se usa el dorado y no `--amarillo500` #684700 porque
este se confunde con el rojo en deuteranopia (ΔE 2.4 medido con el validador de paletas). Tipografía Noto Sans. Los valores se copiaron de las variables CSS
publicadas en snd.gob.mx el 2026-11-24.

**Por qué.** Es una herramienta para autoridades del gobierno federal. La Gráfica base v3 de
gob.mx (gob.mx/guias/grafica/v3) declara que todas las plataformas deben migrar al SND, así que
se toma el estándar vigente y no la v3. El SND pide elegir una sola gama primaria (guinda para
proyectos federales) y no asignar significados distintos a los colores de validación.

**Alternativa descartada.** La paleta de la Gráfica base v3 (#611232, #9d2449, #a57f2c…) y la de
v1 y v2 (#9F2241, #235B4E, #691C32…): son versiones anteriores que el propio sitio manda
migrar. Tampoco se enlaza el CSS del SND desde su CDN: trae su propia retícula y componentes, y
el panel solo necesita los colores y la fuente.

**Consecuencia.** El rojo de alerta crítica y el guinda institucional son cercanos; por eso el
nivel siempre va escrito junto a su color y el guinda no se usa para nada que signifique
alarma. Patria (la tipografía de encabezados del SND) no está en Google Fonts y no se usa. El
mapa (`mapa/`) conserva por ahora su estilo anterior; si se quiere unificar, se aplica la misma
paleta allí.

# Invariantes

Reglas que **no se rompen**. Cada una trae cómo detectar que se rompió, porque una regla
que no se puede verificar no es una regla.

Si crees que una invariante debe cambiar, no la cambies: anótalo, dilo al equipo y cambia
primero la decisión en
[`../05-decisiones-tecnicas.md`](../05-decisiones-tecnicas.md).

---

## I1 · `datos/crudos/` es inmutable

Ningún script, agente o persona modifica un archivo bajo `datos/crudos/`. Toda
transformación lee de ahí y escribe en `datos/procesados/`.

**Por qué:** si alguien pregunta de dónde salió un número, se rastrea hasta el byte
original de CONAGUA. Un archivo corregido a mano rompe esa cadena y no se recupera.

**Cómo detectar que se rompió:** `git status` nunca debe mostrar cambios ahí (está en
`.gitignore`, así que la señal real es una fecha de modificación posterior a la descarga
registrada en `datos/bitacora.md`). Si un script abre un archivo de `crudos/` en modo `w`,
`a` o `r+`, es un error.

---

## I2 · Los archivos derivados no se editan a mano

| Archivo | Lo genera |
|---|---|
| `datos/procesados/*.csv` | `scripts/10_construir_tablas.py` |
| `datos/procesados/analisis/*.csv` | `scripts/20_analisis_exploratorio.py` |
| `docs/09-hallazgos-exploratorio.md` | `scripts/20_analisis_exploratorio.py` |
| `docs/08-verificacion-datos.md` | `scripts/30_verificacion_datos.py` |
| `contrato/fixtures/**` | `scripts/40_generar_fixtures.py` |

**Por qué:** la siguiente corrida los sobrescribe y la edición se pierde en silencio.

**Cómo detectar que se rompió:** corre el script y mira si el archivo cambia. Si cambia
sin que tú tocaras su entrada, alguien lo había editado a mano.

**Qué hacer en su lugar:** corregir el script.

---

## I3 · La lógica compartida vive en `scripts/_comun.py`

El parseo de valores censurados (`parse_valor`), la normalización de texto
(`sin_acentos`), la conversión de fechas (`serial_a_fecha`) y la lectura de los Excel de
CONAGUA están ahí y **solo** ahí.

**Por qué:** la regla de los valores censurados afecta al 37 % de los datos. Dos
implementaciones distintas de esa regla producen dos conjuntos de datos distintos, y la
discrepancia aparece semanas después en un número que nadie puede explicar.

**Cómo detectar que se rompió:** `grep -rn "def parse_valor\|def sin_acentos\|def serial_a_fecha" scripts/`
debe devolver exactamente una definición de cada una, en `_comun.py`.

**Nota de implementación:** los scripts se cargan con `python -I`, que no agrega la carpeta
del script a `sys.path`. Por eso `_comun.py` se importa con `importlib` y ruta explícita.
No lo cambies a un `import _comun` normal: fallaría.

---

## I4 · Los CSV se leen y escriben en `utf-8-sig`

**Por qué:** sin BOM, Excel en Windows destroza los acentos. El BOM es el precio de que
los archivos sean usables por gente que no programa.

**Cómo detectar que se rompió:** si abres un CSV con `encoding='utf-8'`, el primer nombre
de columna llega como `'﻿c_sitio'` en lugar de `'c_sitio'`, y las búsquedas por nombre
de columna fallan sin dar error. Es el síntoma más desconcertante de este repositorio.

---

## I5 · Hay un solo lugar donde se traducen los códigos de parámetro

`datos/procesados/parametro.csv`, columna `c_parametro_std`.

Las tablas históricas usan claves CONAGUA (`OD_mg/L`, `pH_CAMPO`, `CONDUC_CAMPO`,
`TEMP_AGUA`, `TURBIEDAD`). El contrato usa códigos cortos (`OD`, `PH`, `COND`, `TEMP`,
`TURB`).

**Cómo detectar que se rompió:** si aparece un diccionario de equivalencias entre esos dos
vocabularios en cualquier otro archivo, hay dos fuentes de verdad. La excepción conocida y
aceptada es el diccionario `CAMPO` de `scripts/40_generar_fixtures.py`, que además guarda
el rango físico de cada sensor; si crece, hay que unificarlo.

---

## I6 · El criterio del área de estudio vive en una sola función

`en_area()` de `scripts/10_construir_tablas.py`.

**Por qué:** hay ríos llamados Atoyac en Oaxaca y Guerrero. El criterio exige cuenca **y**
estado. Una segunda implementación que olvide el estado mete sitios de otra cuenca y
contamina toda la línea base.

**Cómo detectar que se rompió:** `datos/procesados/sitio.csv` debe tener exactamente dos
valores en la columna `estado`: `PUEBLA` y `TLAXCALA`. Cualquier otro es un error de
filtrado o de normalización. Lo comprueba `scripts/50_verificar_repo.py`.

**Nota sobre los nombres de estado.** Las fuentes escriben el mismo estado de formas
distintas: F01 pone `PUEBLA` y F05 pone `PUEBLA DE ZARAGOZA`, que es el nombre oficial de
la capital y no del estado. `normaliza_estado()` de `scripts/_comun.py` los unifica. Sin
esa normalización, agrupar por estado partía la cuenca en tres grupos; lo detectó la
verificación mecánica.

---

## I7 · Un cambio incompatible del contrato sube la versión

Todo payload lleva `"version"`. Agregar un campo opcional no sube la versión. **Quitar un
campo, volverlo obligatorio o cambiar un `enum` sí**, y se anuncia al equipo.

**Por qué:** el contrato lo consumen un firmware, un backend y tres frontends. Un cambio
silencioso los rompe a todos a la vez y nadie sabe por qué.

**Cómo detectar que se rompió:** `git diff` sobre `contrato/esquemas/` que elimine una
propiedad, agregue a `required` o modifique un `enum`, sin cambiar el `const` de `version`
ni añadir entrada al registro de cambios.

---

## I8 · Los fixtures son deterministas

`scripts/40_generar_fixtures.py` usa `random.seed(20261123)`. Dos corridas producen
archivos idénticos.

**Por qué:** todo el equipo ve los mismos datos. Si alguien reporta un problema con el
paquete 237 del escenario de lluvia, los demás pueden abrir ese mismo paquete.

**Cómo detectar que se rompió:** regenera y corre `git diff contrato/fixtures/`. Si cambia
sin que tocaras el generador ni los datos de entrada, se perdió el determinismo.

---

## I9 · El contrato no tiene dependencias externas

`contrato/validador.py`, `contrato/servidor_mock.py` y
`contrato/reproducir_escenario.py` corren con `python` a secas.

**Por qué:** es la pieza que todos comparten. Si exige instalar algo, bloquea a quien no
pueda instalarlo.

**Cómo detectar que se rompió:** `grep -n "^import\|^from" contrato/*.py` solo debe
mostrar módulos de la biblioteca estándar. Un `import requests` o `import jsonschema` ahí
es una violación.

---

## I10 · Los avisos técnicos nunca se mezclan con las alertas ambientales

Un pH de −999 es un sensor roto, no contaminación. Va en `avisos_tecnicos`, nunca en
`alertas`.

**Por qué:** si el panel de una autoridad mezcla "el río está contaminado" con "el sensor
falló", pierde credibilidad la primera vez que alguien revisa una alerta y encuentra una
membrana sucia.

**Cómo detectar que se rompió:** el escenario `falla_sensor` debe producir **cero alertas
ambientales** y varios avisos técnicos. Es parte del criterio de terminado del módulo M2.

---

## I11 · La NOM-001 se aplica solo a puntos de descarga

Los sitios de cauce se evalúan contra la escala de CONAGUA (`CONAGUA_SUP`). La
NOM-001-SEMARNAT-2021 regula descargas, no cuerpos receptores.

**Por qué:** es un error técnico y legal. Esa norma fija límites para lo que sale de un
tubo.

**Cómo detectar que se rompió:** una alerta con `criterio_aplicado` igual a
`NOM001_2021_RIO` en una estación cuyo sitio no está marcado `es_descarga`.

---

## I12 · Toda cifra que se muestre lleva su `n` y su fecha

Una banda histórica calculada con 3 mediciones no significa nada. El esquema
`linea_base` tiene `n` como campo obligatorio y `veredicto` lleva `n_linea_base` por
parámetro.

**Por qué:** es la diferencia entre un sistema que una autoridad puede defender y uno que
se cae en la primera pregunta. Convención del proyecto: **n ≥ 12 para usar una banda en
reglas de alerta.**

**Cómo detectar que se rompió:** una vista que muestre un promedio, una banda o un índice
sin decir con cuántos datos se calculó ni de cuándo es el último.

---

## I13 · "Sin dato" es un estado visible, no un espacio en blanco

Hay 1 sitio sin ningún resultado y 21 sin semáforo. La interfaz debe decir "sin dato", no
dejar la celda vacía ni pintarla de verde.

**Cómo detectar que se rompió:** un mapa o panel donde un sitio sin información se vea
igual que un sitio en buen estado.

---

## I14 · La foto del reporte ciudadano se almacena sin EXIF

`exif_removido` es obligatorio y el servidor rechaza con 409 la foto que no lo traiga. El
correo del denunciante no se expone en la API pública.

**Por qué:** la cámara graba coordenadas y modelo del teléfono. En un conflicto por
descargas industriales, exponer al denunciante no es un riesgo teórico.

**Cómo detectar que se rompió:** `GET /reportes` que devuelva el campo `correo`, o un
`POST` aceptado con `exif_removido: false`.

---

## I15 · Los archivos crudos y geográficos no se versionan

`datos/crudos/` y `datos/geo/` están en `.gitignore`. Lo que se versiona es la URL exacta
de cada archivo, en `datos/bitacora.md`, y el script que los vuelve a bajar.

**Por qué:** son 138 MB y 61 MB. Git no comprime bien un `.xlsb` y el repositorio se
volvería lento para todos.

**Cómo detectar que se rompió:** `git add -An . | grep "datos/crudos\|datos/geo"` debe
devolver solo los `.gitkeep`.

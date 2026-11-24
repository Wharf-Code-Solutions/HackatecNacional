# Protocolo de cambios

Casi ningún cambio en este repositorio es local. Esta tabla dice qué arrastra cada uno.

---

## Si cambias X, entonces tienes que Y

| Si cambias... | Entonces debes... |
|---|---|
| **Un esquema de `contrato/esquemas/`** | 1. Decidir si es compatible (campo opcional nuevo) o incompatible (quitar campo, volverlo obligatorio, cambiar un `enum`).<br>2. Si es incompatible, subir `version` y **anunciarlo al equipo**.<br>3. Validar todos los fixtures contra los esquemas: cero errores.<br>4. Actualizar la tabla de entidades de `02-arquitectura.md` y la de `contrato/README.md`.<br>5. Anotar en el registro. |
| **El `enum` de `c_parametro` en `lectura.schema.json`** | Además de lo anterior: revisar que el nuevo código exista en `datos/procesados/parametro.csv`, columna `c_parametro_std`. Un código del contrato sin equivalente CONAGUA no tiene línea base y no se puede evaluar. |
| **`scripts/_comun.py`** | Reconstruir las tablas y verificar los seis conteos. Esta es la pieza de mayor alcance del repositorio: `parse_valor()` toca el 37 % de los datos. |
| **`en_area()` en `10_construir_tablas.py`** | Reconstruir, verificar que `sitio.csv` solo tenga Puebla y Tlaxcala, y actualizar la sección "Criterio de recorte al área de estudio" de `datos/README.md` y el conteo de 219 sitios en toda la documentación que lo cite. |
| **Las constantes `NUCLEO` o `EN_CAMPO`** | Reconstruir. Cambia el tamaño de `muestreo_nucleo.csv` y la línea base, y por lo tanto los fixtures. Regenerar también los fixtures. |
| **La constante `NOM001`** | Reconstruir y verificar el conteo de `umbral.csv`. Citar el artículo o tabla de la norma en un comentario. |
| **`scripts/40_generar_fixtures.py`** | Regenerar los fixtures, revisar el diff y confirmar que sigue siendo determinista. Si cambió la selección de estaciones, avisar: todos los módulos trabajan contra esas cinco. |
| **El evaluador stub de `servidor_mock.py`** | Volver a medir las alertas por escenario con servidor limpio y actualizar **tres** tablas: `contrato/README.md`, `04-verificacion-obligatoria.md` y la decisión D10 de `05-decisiones-tecnicas.md`. |
| **Las rutas del servidor mock** | Actualizar la tabla de rutas de `contrato/README.md` y avisar a los módulos de frontend. |
| **Algo en `datos/procesados/`** (vía script) | Actualizar los conteos en `datos/README.md`, en la tabla de verificación y en `01-que-construimos.md` si cambió el número de sitios o de resultados. |
| **Agregar una fuente de datos** | 1. URL en `scripts/00_descargar_fuentes.py`.<br>2. Fila en `datos/bitacora.md` con fecha, URL exacta, tamaño y notas.<br>3. Explicación del "por qué esta fuente" en `04-fuentes-de-datos.md`.<br>4. Si deja de estar pendiente, quitarla de la tabla de pendientes. |
| **Elegir o descartar una tecnología** | Moverla en `03-tecnologias.md` entre "lo que ya se usa", "elegido pero no implementado" y "lo que se descartó". Una tecnología elegida pero no instalada **no se documenta como en uso**. |
| **Tomar o revertir una decisión técnica** | Agregar o actualizar su entrada `D*` en `05-decisiones-tecnicas.md`, con decisión, por qué, alternativa descartada y consecuencia. Si la reviertes, no borres la entrada: anota que se revirtió y por qué. |
| **Terminar un módulo** | 1. Mover su fila de "pendiente" a "construido" en `01-que-construimos.md`.<br>2. Actualizar la tabla de reemplazos de `02-arquitectura.md`.<br>3. Confirmar que la demo sigue corriendo **sin** ese módulo (plan de degradación).<br>4. Anotar en el registro. |
| **Una invariante** | No la cambies sola. Primero cambia la decisión en `05-decisiones-tecnicas.md`, dilo al equipo, y después ajusta `01-invariantes.md`. Una invariante que se cambia en silencio deja de servir. |
| **Mover o renombrar un archivo** | Arreglar todos los enlaces y correr la verificación de enlaces de `04-verificacion-obligatoria.md`. |
| **Algo que rompe la demo sin otro módulo** | Revertirlo o compensarlo. Si el mapa empezó a depender de un endpoint que solo existe en el backend real, **agrega ese endpoint al mock**; no quites la independencia del frontend. |

---

## Qué cuenta como cambio relevante

Va al registro de cambios si cumple **al menos una** de estas:

- Cambia un esquema del contrato.
- Cambia el número de filas de cualquier tabla procesada.
- Agrega, quita o reemplaza una fuente de datos.
- Toma, cambia o revierte una decisión técnica.
- Cambia una invariante.
- Termina o abandona un módulo.
- Cambia la estructura de carpetas.
- Cambia una cifra que la documentación cita.
- Elige o descarta una tecnología.

**No va al registro:** corregir una falta de ortografía, reformular un párrafo, añadir un
comentario, ajustar formato.

En duda, anótalo. Una entrada de más cuesta dos líneas; una de menos cuesta que alguien
deshaga una decisión sin saber que existía.

---

## Cómo hacer un cambio, de principio a fin

1. **Lee** `01-invariantes.md` y ubica tu archivo en `02-mapa-del-repo.md`. Si es derivado,
   edita su generador.
2. **Busca tu cambio** en la tabla de arriba y anota lo que arrastra.
3. **Haz el cambio.** Si es en un script, deja un comentario que explique el *por qué*, no
   el *qué*: el qué se lee en el código.
4. **Corre la verificación** de `04-verificacion-obligatoria.md`.
5. **Actualiza la documentación** que la tabla te indicó. Esto no es opcional: una
   documentación desincronizada es peor que no tenerla, porque se le cree.
6. **Anota en el registro** si es relevante.
7. **Commit** con un mensaje que diga el por qué.

---

## Para el agente que vigila el repositorio

Si detectas un cambio que no siguió este protocolo:

1. **No lo revierte**s por tu cuenta. Puede haber una razón que no está escrita.
2. **Completa lo que falta**: si el cambio es correcto pero no actualizó la documentación
   que arrastraba, actualízala y anótalo en el registro señalando que fue una corrección
   posterior.
3. **Marca la inconsistencia** si la documentación y el código se contradicen y no puedes
   saber cuál tiene razón. Una línea en el registro bajo el encabezado
   `Inconsistencias detectadas` es suficiente. **El código manda sobre la documentación**
   cuando hay duda, pero la contradicción se anota.
4. **Nunca cambies un número de la documentación** para que coincida con el código sin
   haber verificado el número contra el archivo o la corrida que lo produce.

---

## Mensajes de commit

Formato sugerido, con el prefijo del módulo o del área:

```
M2: motor de reglas con z robusto en lugar de percentiles

Los percentiles p10/p90 producen 31 falsas alarmas en el escenario de
control porque por construccion el 20 % de las lecturas normales cae
fuera de la banda. El z robusto sobre mediana y MAD baja a 2.
```

Primera línea corta y en imperativo o descriptiva. El cuerpo explica **por qué**, con el
número si lo hay. El qué ya está en el diff.

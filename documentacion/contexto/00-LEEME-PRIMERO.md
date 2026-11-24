# LÉEME PRIMERO

**Si eres un agente de IA o un desarrollador que va a modificar este repositorio, este es
tu punto de entrada.** No el README del proyecto.

Esta carpeta existe porque el repositorio tiene estructura: hay archivos que son fuente de
verdad y archivos que son derivados, hay reglas que si se rompen invalidan los datos, y hay
fronteras entre módulos que si se cruzan convierten ocho trabajos paralelos en uno
secuencial. Nada de eso es visible leyendo un archivo suelto.

---

## Protocolo de arranque

Haz esto **antes** de tu primera modificación, en este orden:

1. **Lee [`01-invariantes.md`](01-invariantes.md).** Son las reglas que no se rompen. Es el
   documento más importante de esta carpeta.
2. **Lee [`02-mapa-del-repo.md`](02-mapa-del-repo.md)** y ubica el archivo que vas a tocar.
   Averigua si es fuente de verdad o derivado. **Si es derivado, no lo edites: edita su
   generador.**
3. **Lee [`05-protocolo-de-cambios.md`](05-protocolo-de-cambios.md)** y busca tu tipo de
   cambio en la tabla "si cambias X, entonces Y". Casi todo cambio arrastra obligaciones.
4. **Revisa las últimas entradas de
   [`06-registro-de-cambios.md`](06-registro-de-cambios.md).** Te dice qué se movió
   recientemente y por qué, y evita que deshagas una decisión deliberada.
5. Haz el cambio.
6. **Corre lo de [`04-verificacion-obligatoria.md`](04-verificacion-obligatoria.md).** Si
   algo falla, tu cambio no está terminado.
7. **Anota la entrada en el registro** si tu cambio es relevante según el criterio del
   protocolo.

Si tu cambio toca un módulo que no es el tuyo, lee también
[`03-fronteras-y-dependencias.md`](03-fronteras-y-dependencias.md).

---

## Las cinco cosas que más se rompen

Si solo vas a leer un párrafo, que sea este.

1. **Editar un archivo generado.** `documentacion/08-verificacion-datos.md` y
   `documentacion/09-hallazgos-exploratorio.md` los sobrescribe un script. Igual
   `datos/procesados/*.csv` y `contrato/fixtures/*`. Tu edición se pierde en la siguiente
   corrida.
2. **Tocar `datos/crudos/`.** Es inmutable. Sin excepciones.
3. **Leer un CSV con `encoding='utf-8'`.** Están en `utf-8-sig`. Con `utf-8` el primer
   nombre de columna llega con un carácter invisible pegado y las búsquedas por nombre de
   columna fallan de forma desconcertante.
4. **Duplicar lógica que ya existe en `scripts/_comun.py`.** El parseo de valores
   censurados, la normalización de texto y la conversión de fechas viven ahí y en un solo
   lugar.
5. **Cambiar un esquema del contrato sin subir la versión ni avisar.** Rompe a todos los
   módulos a la vez y de forma silenciosa.

---

## Contexto mínimo del proyecto

Lo necesario para que un cambio tenga sentido. Si necesitas más, la sección 1 de
`documentacion/` lo explica a fondo.

- **Qué es.** Sistema de monitoreo y alertamiento de contaminación del río Atoyac, entre
  Puebla y Tlaxcala, para el reto SECIHTI de HackaTec 2026.
- **Qué está construido.** El conjunto de datos (219 sitios, 145 703 resultados,
  2012–2025), el contrato de datos v1.0 con sus fixtures, un servidor mock funcionando, el
  simulador del dispositivo (M4, sin hardware) y un prototipo del mapa (M6).
- **Qué falta.** Topología del río (M1), motor de reglas (M2), propagación (M3), backend
  (M5), panel y app (M7, M8). El estado al día y qué puede tomarse hoy están en
  [`../12-estado-y-traspaso.md`](../12-estado-y-traspaso.md).
- **La idea central.** En un río que ya está permanentemente fuera de norma, un umbral fijo
  está encendido desde 2012 y no informa nada. **Lo que detecta un evento nuevo es la
  desviación respecto de la historia del propio punto.** Por eso la línea base no es
  contexto: es el instrumento.
- **La decisión que más confunde.** El semáforo de colores existe pero vive **solo** en la
  vista ciudadana. El eje analítico es un índice continuo. El motivo está medido: 176 de
  198 sitios están en rojo, así que el color no ordena nada.

---

## Para el agente que vigila el repositorio

Si tu trabajo es mantener esta documentación al día conforme el repositorio cambia:

**Qué revisar en cada cambio relevante**

| Si cambió | Revisa que siga siendo cierto |
|---|---|
| `contrato/esquemas/` | Las tablas de entidades en `02-arquitectura.md` y `contrato/README.md` |
| `scripts/` | La tabla de scripts del `README.md` del repositorio y de `02-mapa-del-repo.md` |
| `datos/procesados/` | Los conteos de filas en `datos/README.md`, `01-que-construimos.md` y `08-verificacion-datos.md` |
| Se implementó un módulo | La tabla "qué existe hoy y qué está planeado" de `01-que-construimos.md` y la tabla de reemplazos de `02-arquitectura.md` |
| Se eligió una tecnología | `03-tecnologias.md`, moviéndola de "elegido pero no implementado" a "lo que ya se usa" |
| Se tomó o revirtió una decisión | `05-decisiones-tecnicas.md`, con su justificación y su alternativa descartada |
| Apareció una fuente de datos | `04-fuentes-de-datos.md` y `datos/bitacora.md` |

**Qué NO hacer**

- No reescribas `07-plan-recoleccion-datos.md`. Es el plan original y se conserva como
  registro histórico, aunque partes de él ya estén superadas.
- No edites `08` ni `09`: los generan scripts.
- No borres entradas del registro de cambios. Es de solo añadir.
- No conviertas "pendiente" en "construido" sin verificarlo contra el repositorio. La
  distinción entre lo construido y lo planeado es lo más valioso de esta documentación y
  lo primero que se degrada.
- No inventes cifras. Cada número de esta documentación sale de un archivo o de una
  corrida de script, y si no puedes rastrear uno, verifícalo antes de repetirlo.

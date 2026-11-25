# Fixtures del contrato

| Archivo | Estado | Lo genera |
|---|---|---|
| `escuelas.json` | **Datos reales** (2026-11-24) | `scripts/97_escuelas_riesgo.py` a partir de `scripts/98_escuelas_candidatas.py` |
| `zonas_riesgo.geojson` | **Derivadas de los datos**, no de un atlas | `scripts/97_escuelas_riesgo.py` |
| `protocolos.json` | `"_provisional": true`, **por validar** con CEASPUE, CAPCEE y Protección Civil | A mano (no es derivado): acciones de respuesta por tipo de incidente que muestra el panel en «Qué hacer» |

`escuelas.json` trae 400 escuelas públicas rurales de Puebla, de 7 384 en el catálogo de centros de trabajo de la
SEP 2026: las 300 de mayor índice de riesgo y las 100 siguientes de mayor riesgo de contaminación (sin estas, la
lista quedaría casi toda de laderas). La tabla completa, con los valores crudos de cada
factor, está en `datos/procesados/escuelas/factores_escuelas.csv`.

Lo que hay que saber al mostrarlos:

- **Los pesos del índice y los cortes de los puntajes son hipótesis** (están en los dos scripts). El índice ordena
  escuelas por condiciones de riesgo; no predice cuándo ocurre un evento.
- **`susceptibilidad_laderas` sale del Mapa Nacional de Susceptibilidad por Inestabilidad de Laderas de CENAPRED**
  (servicio ArcGIS público, leído a ~55 m). 0 donde CENAPRED da la zona por libre (pendiente < 6°).
- **`calidad_agua` vale 0 por falta de fuente, no por falta de riesgo,** si no hay un sitio CONAGUA a menos de 2 km
  (la mayoría). La columna `sin_dato` del CSV dice en qué escuelas faltó.
- **`matricula` es `null`** (el catálogo SEP no la trae) y **`fuente_agua` es `desconocida`** en todas.
- **Las zonas** agrupan escuelas cercanas con sub-índice alto: las de derrumbe salen de la pendiente del terreno y
  las de contaminación de fuentes contaminantes cercanas y marginación. Las de derrumbe ya usan el mapa de laderas de
  CENAPRED. Su campo `fuente` lo dice.
- **Autorizaciones:** solo las escuelas junto a una estación existente traen trámites, en estado `pendiente`.

No se editan a mano: se edita el script.

# Fixtures del contrato

| Archivo | Estado | Lo genera |
|---|---|---|
| `escuelas.json` | **Datos reales** (2026-11-24) | `scripts/97_escuelas_riesgo.py` a partir de `scripts/98_escuelas_candidatas.py` |
| `zonas_riesgo.geojson` | **Derivadas de los datos**, no de un atlas | `scripts/97_escuelas_riesgo.py` |

`escuelas.json` trae las 400 escuelas públicas rurales de Puebla con mayor índice de riesgo (índice ≥ 0.30), de
7 384 en el catálogo de centros de trabajo de la SEP 2026. La tabla completa, con los valores crudos de cada
factor, está en `datos/procesados/escuelas/factores_escuelas.csv`.

Lo que hay que saber al mostrarlos:

- **Los pesos del índice y los cortes de los puntajes son hipótesis** (están en los dos scripts). El índice ordena
  escuelas por condiciones de riesgo; no predice cuándo ocurre un evento.
- **Dos factores casi siempre valen 0 por falta de fuente, no por falta de riesgo:** `susceptibilidad_laderas`
  (sin el mapa de CENAPRED, 0 en todas) y `calidad_agua` (0 si no hay un sitio CONAGUA a menos de 2 km). Suman 0.35
  de los pesos, así que hoy ninguna escuela llega a «muy alto». La columna `sin_dato` del CSV dice cuáles faltaron
  en cada escuela.
- **`matricula` es `null`** (el catálogo SEP no la trae) y **`fuente_agua` es `desconocida`** en todas.
- **Las zonas** agrupan escuelas cercanas con sub-índice alto: las de derrumbe salen de la pendiente del terreno y
  las de contaminación de fuentes contaminantes cercanas y marginación. Su campo `fuente` lo dice. No sustituyen al
  atlas de riesgos.
- **Autorizaciones:** solo las escuelas junto a una estación existente traen trámites, en estado `pendiente`.

No se editan a mano: se edita el script.

# Fixtures del contrato

| Archivo | Estado | Lo genera |
|---|---|---|
| `escuelas.json` | `"_provisional": true` | `scripts/97_escuelas_riesgo.py` |
| `zonas_riesgo.geojson` | `"_provisional": true` | `scripts/97_escuelas_riesgo.py` |

Los dos marcados como provisionales (docs/19, sección 4.5) tienen la forma definitiva del contrato
(`contrato/esquemas/escuela.schema.json` y `zona_riesgo.schema.json`) pero contenido ilustrativo: lugares
reales de Puebla con riesgos creíbles, y CCT, nombres, puntajes y polígonos inventados. Sirven para que el
panel (módulo B) y la app ciudadana (módulo C) trabajen sin esperar los datos reales. Cuando el módulo A
tenga los datos reales, el mismo script reescribe los dos archivos con la misma forma.

No se editan a mano: se edita el script.

# Contrato de datos v1.0

Este es el único acuerdo que todos los módulos tienen que respetar. Mientras no cambie,
cada persona del equipo puede trabajar sola, probar sola y terminar sola.

**Regla del proyecto: un módulo solo puede estar bloqueado por el contrato, nunca por el
código de otro módulo.** Si necesitas datos de un módulo que no existe todavía, usas su
fixture. Si necesitas un servicio que no existe todavía, usas el servidor mock.

## Qué hay aquí

```
esquemas/                 JSON Schema de cada entidad (la fuente de verdad)
fixtures/                 datos de ejemplo generados con los datos REALES del Atoyac
fixtures/escenarios/      días completos de lecturas con incidentes inyectados
validador.py              valida un payload contra un esquema, sin dependencias
servidor_mock.py          servidor HTTP que sirve los fixtures y recibe lecturas
reproducir_escenario.py   envía un escenario a cualquier servidor, como el dispositivo real
```

Todo corre con el Python que ya tienes. **Cero dependencias externas.**

## Arrancar en treinta segundos

```powershell
python contrato/servidor_mock.py
```

```powershell
python contrato/reproducir_escenario.py descarga_industrial
```

El primer comando levanta el servidor en `http://127.0.0.1:8080`. El segundo le manda un
día entero de lecturas de cinco estaciones con una descarga industrial inyectada a las
10:00. Mientras eso corre, el mapa y el panel ya tienen de dónde leer.

## Rutas del servidor mock

| Método | Ruta | Qué devuelve |
|---|---|---|
| GET | `/salud` | versión del contrato, estaciones cargadas, alertas abiertas |
| GET | `/estaciones` | las 5 estaciones del piloto |
| GET | `/linea_base` | banda histórica de cada estación y parámetro |
| GET | `/sitios.geojson` | los 219 sitios de monitoreo, listos para pintar en un mapa |
| GET | `/escenarios` | nombres de los escenarios disponibles |
| GET | `/escenarios/<nombre>` | los paquetes de lecturas de ese escenario |
| POST | `/lecturas` | valida contra el esquema y evalúa; acepta un objeto o un arreglo |
| GET | `/veredictos` | los últimos 50 veredictos emitidos |
| GET | `/alertas` | alertas generadas |
| POST | `/reportes` | reporte ciudadano (rechaza fotos con EXIF) |
| GET | `/reportes` | reportes sin el campo `correo` |

Tiene CORS abierto, así que un frontend en otro puerto lo consume sin configurar nada.

## Entidades

| Esquema | Quién lo produce | Quién lo consume |
|---|---|---|
| `lectura` | dispositivo o simulador | backend |
| `veredicto` | motor de reglas | backend, panel, mapa |
| `alerta` | motor de reglas | panel, notificaciones |
| `estacion` | configuración | todos |
| `linea_base` | análisis de datos (Etapa 1) | motor de reglas |
| `prediccion_propagacion` | modelo de propagación | panel |
| `reporte_ciudadano` | app ciudadana | backend, panel, mapa |

`veredicto` es el esquema que el plan original no tenía y es el que más se comparte: es
la frontera exacta entre el motor de reglas y todo lo demás.

## Dos vocabularios de parámetros, y por qué

- **El contrato habla en códigos cortos**: `OD`, `PH`, `COND`, `TEMP`, `TURB`, `SDT`.
- **Las tablas históricas hablan en claves de CONAGUA**: `OD_mg/L`, `pH_CAMPO`,
  `CONDUC_CAMPO`, `TEMP_AGUA`, `TURBIEDAD`, `SDT`.

La traducción está en `datos/procesados/parametro.csv`, columna `c_parametro_std`. No
inventes códigos nuevos: si hace falta uno, se agrega al enum de `lectura.schema.json` y
se avisa al equipo, porque es un cambio de contrato.

## Los escenarios

Cada uno es un día completo (24 h, lectura cada 15 min, 5 estaciones = 480 paquetes).
Los valores normales se sortean dentro de la **banda histórica real** de cada sitio, así
que el ruido de fondo es el del Atoyac, no un número inventado. El incidente se inyecta
solo en `EST-ATY-01`, para que el modelo de propagación tenga algo que predecir hacia
aguas abajo.

| Escenario | Qué pasa | Firma esperada |
|---|---|---|
| `normal` | nada | **control: no debe generar ninguna alerta ambiental** |
| `descarga_organica` | descarga municipal a las 08:00, 6 h | OD baja, turbiedad y conductividad suben, pH algo ácido |
| `descarga_industrial` | descarga industrial a las 10:00, 3 h | conductividad hasta 14 700 µS/cm, pH hasta 9.5, OD cae |
| `lluvia` | tormenta de 15:00 a 20:00 | turbiedad al tope **con conductividad a la baja** |
| `falla_sensor` | turbiedad congelada 5 h, pH en −999, salto imposible de OD, batería al 12 % | avisos **técnicos**, nunca alertas ambientales |

Lo que distingue lluvia de descarga es el signo de la conductividad: el arrastre diluye
sales, la descarga las aporta. Esa es la señal que el motor de reglas tiene que aprender
a leer.

## La vara a superar

El servidor mock trae un evaluador **stub** deliberadamente tonto, marcado como
`"motor": "stub"` en cada respuesta. Medimos lo que hace, para que el motor real tenga
un número contra el que competir:

| Escenario | Alertas del stub |
|---|---|
| `normal` (sin incidente) | **31** |
| `descarga_organica` | 28 |
| `descarga_industrial` | 35 |
| `lluvia` | 36 |
| `falla_sensor` | 7 |

Treinta y una alertas en un día sin nada y treinta y cinco con una descarga industrial:
**el stub no discrimina**. Eso no es un defecto del stub, es la demostración de que la
regla ingenua de "salió de la banda p10–p90" no sirve sola. El motor real tiene que
llegar a cerca de cero en `normal` sin perder el evento de los otros escenarios, y eso
es exactamente el criterio de terminado del módulo de análisis.

## Versionado

Todo payload lleva `"version": "1.0"`.

- Agregar un campo opcional no rompe nada y no sube la versión.
- Quitar un campo, volverlo obligatorio o cambiar un enum **es un cambio incompatible**:
  sube a `1.1`, se avisa en el canal del equipo y el servidor mock sirve las dos
  versiones hasta que todos migren.
- Nadie cambia un esquema sin decirlo. Un contrato que se mueve en silencio es peor que
  no tener contrato.

## Regenerar los fixtures

```powershell
python -I scripts/40_generar_fixtures.py
```

Es determinista: misma semilla, archivos idénticos. Todo el equipo ve exactamente los
mismos datos, y si alguien reporta un error con el paquete 237 del escenario de lluvia,
los demás pueden mirar ese mismo paquete.

## Validar a mano

```powershell
python contrato/validador.py lectura mi_payload.json
```

El validador cubre el subconjunto de JSON Schema que este contrato usa. No es un
validador completo: si necesitas uno, `jsonschema` de PyPI lee estos mismos archivos.

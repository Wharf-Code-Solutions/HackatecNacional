# Verificación obligatoria

Un cambio no está terminado hasta que estos comandos pasan. No es una recomendación: es la
puerta de entrada de cualquier PR.

---

## El comando que resume casi todo

```powershell
python -I scripts/50_verificar_repo.py
```

Automatiza las invariantes que se pueden comprobar mecánicamente y **sale con código 1 si
algo falla**, así que sirve en un hook o en integración continua. Comprueba:

| # | Qué revisa | Invariante |
|---|---|---|
| 1 | Los conteos de las siete tablas procesadas | I2 |
| 2 | Que `sitio.csv` solo tenga Puebla y Tlaxcala | I6 |
| 3 | Que todos los CSV traigan BOM (`utf-8-sig`) | I4 |
| 4 | Que la lógica compartida esté solo en `_comun.py` | I3 |
| 5 | Que el contrato no importe nada externo | I9 |
| 6 | Que los 2 016 paquetes de fixtures cumplan su esquema | — |
| 7 | Que cada código del contrato tenga equivalente en `parametro.csv` | I5 |
| 8 | Que ningún enlace relativo de los `.md` esté roto | — |
| 9 | Que `.gitignore` cubra crudos, geo y las tablas grandes | I15 |

Distingue **FALLA** (hay que arreglarlo) de **AVISO** (normalmente significa que falta
correr un script, por ejemplo después de clonar). Si una comprobación falla porque tu
cambio modificaba esa cifra a propósito, actualiza `FILAS_ESPERADAS` en el script y la
documentación que la cita.

Lo que ese script **no** cubre está abajo: hay que correrlo a mano.

---

## Siempre, además del script

**1. El contrato sigue siendo válido**

```powershell
python contrato/reproducir_escenario.py normal --en-seco
```

Debe terminar con `Todos los paquetes cumplen el contrato.` Valida los 480 paquetes del
escenario contra `lectura.schema.json` sin enviar nada.

**2. El servidor mock arranca y responde**

```powershell
python contrato/servidor_mock.py --puerto 8099
```

Y en otra terminal:

```powershell
curl http://127.0.0.1:8099/salud
```

Debe devolver `"estado": "ok"` con 5 estaciones cargadas.

**3. No se metieron archivos que no van al repositorio**

```powershell
git add -An . | Select-String "datos/crudos|datos/geo|muestreo.csv"
```

Solo deben aparecer los `.gitkeep`. Si aparece un `.xlsb`, un shapefile o
`muestreo.csv`, hay que corregir el `.gitignore` o deshacer el `add`.

> El script de verificación comprueba que `.gitignore` tenga los patrones, pero no puede
> saber si alguien ya agregó un archivo al índice. Esta comprobación es manual.

---

## Según lo que cambiaste

### Si tocaste `scripts/_comun.py`, `scripts/10_construir_tablas.py` o los datos crudos

Reconstruye y compara. La salida debe ser idéntica salvo que el cambio buscara
modificarla:

```powershell
python -I scripts/10_construir_tablas.py
```

Verifica los conteos contra los esperados:

| Tabla | Filas esperadas |
|---|---|
| `sitio.csv` | 219 |
| `parametro.csv` | 347 |
| `muestreo.csv` | 145 703 |
| `muestreo_nucleo.csv` | 74 801 |
| `umbral.csv` | 146 |
| `indicador_sitio_periodo.csv` | 212 |

Si un conteo cambió y tú no lo buscabas, **para y averigua por qué** antes de seguir. Si lo
buscabas, actualiza `FILAS_ESPERADAS` en `scripts/50_verificar_repo.py`, esta tabla,
`datos/README.md` y [`06-registro-de-cambios.md`](06-registro-de-cambios.md).

Después corre el script de verificación: comprueba los conteos y el recorte del área de
estudio por ti.

### Si tocaste `scripts/20_analisis_exploratorio.py`

```powershell
python -I scripts/20_analisis_exploratorio.py
```

Regenera `documentacion/09-hallazgos-exploratorio.md` y las seis tablas de
`datos/procesados/analisis/`. Revisa el diff del documento: si una cifra del exploratorio
cambió, es probable que haya que actualizar los documentos escritos a mano que la citan
(`01-que-construimos.md`, `05-decisiones-tecnicas.md`, `10-revision-critica-plan.md`).

### Si tocaste `scripts/30_verificacion_datos.py`

```powershell
python -I scripts/30_verificacion_datos.py
```

Regenera `documentacion/08-verificacion-datos.md`. Revisa que ningún veredicto pasó de
**OK** a **ATENCION** o **BLOQUEANTE** sin que lo esperaras.

### Si tocaste un esquema de `contrato/esquemas/`

```powershell
python -I scripts/50_verificar_repo.py
```

Las comprobaciones 6 y 7 validan los 2 016 paquetes de fixtures contra los esquemas y que
cada código del contrato tenga equivalente en `parametro.csv`. Cero fallas.

Además: si el cambio es incompatible según la invariante I7, hay que subir la versión,
anunciarlo y anotarlo en el registro.

### Si tocaste `scripts/40_generar_fixtures.py`

```powershell
python -I scripts/40_generar_fixtures.py
```

Luego revisa el diff. Si cambió algo que no buscabas, se perdió el determinismo
(invariante I8). Conteos esperados: 5 estaciones, 25 filas de línea base, 219 puntos en el
GeoJSON, 480 paquetes por escenario y 96 en `falla_sensor`.

### Si tocaste `contrato/servidor_mock.py` o el evaluador stub

Reproduce los cinco escenarios **con un servidor limpio cada vez** (el stub acumula estado
entre corridas) y compara con la línea base medida:

| Escenario | Alertas esperadas del stub |
|---|---|
| `normal` | 31 |
| `descarga_organica` | 28 |
| `descarga_industrial` | 35 |
| `lluvia` | 36 |
| `falla_sensor` | 7 |

Si cambiaste el stub a propósito, actualiza esta tabla, la de `contrato/README.md` y la de
`05-decisiones-tecnicas.md` (D10), porque es la vara del módulo M2.

Prueba también el rechazo del reporte con EXIF:

```powershell
curl -X POST http://127.0.0.1:8099/reportes -H "Content-Type: application/json" -d '{\"tipo\":\"espuma\",\"latitud\":19.02,\"longitud\":-98.21,\"exif_removido\":false}'
```

Debe responder 409 (invariante I14).

### Si tocaste la documentación

```powershell
python -I scripts/50_verificar_repo.py
```

La comprobación 8 revisa todos los enlaces relativos de todos los `.md` del repositorio.

---

## Verificación del flujo completo

Antes de una entrega o una demo, el recorrido de punta a punta. Levanta el mock, reproduce
un escenario con incidente y confirma que se generaron alertas:

```powershell
python contrato/reproducir_escenario.py descarga_industrial --url http://127.0.0.1:8099
```

Debe reportar paquetes enviados y alertas generadas mayores que cero.

```powershell
curl http://127.0.0.1:8099/alertas
```

---

## Si algo falla

1. **No sigas adelante.** Un conteo que cambió sin explicación es una señal, no un
   detalle.
2. **Revisa [`01-invariantes.md`](01-invariantes.md).** Cada invariante trae cómo detectar
   que se rompió; es probable que sea una de ellas.
3. **Si el fallo es legítimo** porque tu cambio sí modificaba esa cifra, actualiza las
   tablas de este documento y de los documentos que la citan, y anótalo en el registro.
4. **Si no entiendes por qué falla**, dilo en lugar de ajustar el número esperado para que
   pase. Cambiar la cifra esperada para silenciar una verificación es la forma más rápida
   de perder la confianza en los datos.

# HackaTec 2026 — Reto SECIHTI Puebla

Sistema de monitoreo y alertamiento de contaminación del agua en la cuenca del **Alto
Atoyac**, entre Puebla y Tlaxcala.

El problema que atiende no es la contaminación en sí, que es de infraestructura y de
aplicación de la ley, sino el de información: los datos existen pero están dispersos, el
monitoreo oficial pasa en promedio 49 días entre una medición y la siguiente, y nada de eso
responde rápido dónde está el problema, qué tan grave es, qué lo causa y qué se puede
hacer.

De los 219 sitios de medición del área de estudio, **176 están en semáforo rojo** y el
oxígeno disuelto mediano es de 1.38 mg/L. Un río sano trae entre 7 y 9.

## La idea

En un río que ya está permanentemente fuera de norma, una alarma por umbral fijo está
encendida desde 2012 y no informa nada. **Lo que detecta un evento nuevo es la desviación
respecto de la historia del propio punto.** Por eso la línea base histórica de cada sitio
no es un dato de contexto: es el instrumento de detección, y construirla fue la primera
etapa del proyecto.

## Qué hay construido

| Pieza | Estado |
|---|---|
| Datos de la cuenca y contrato de datos | 219 sitios, 145 703 resultados de 2012 a 2025, línea base por sitio, 7 esquemas y un servidor de pruebas |
| Topología del río | 210 de 219 sitios con su siguiente sitio aguas abajo y la distancia sobre el cauce |
| Propagación aguas abajo | Transporte conservativo calibrado con 90 tramos del propio río, con ventana horaria de llegada |
| Estación de monitoreo | Diseñada y simulada; sin hardware |
| Mapa de la cuenca | Prototipo con la red del INEGI, los sitios y las estaciones |
| Motor de reglas | Cero falsas alarmas en el día de control, contra 31 del evaluador provisional |
| Backend, panel de autoridad, app ciudadana | Pendientes |

El estado detallado por módulo está en
[`docs/12-estado-y-traspaso.md`](docs/12-estado-y-traspaso.md).

## Cómo correrlo

Requiere Python 3.11+. El contrato y el servidor de pruebas no necesitan instalar nada.

```powershell
python contrato/servidor_mock.py
```

```powershell
python contrato/reproducir_escenario.py descarga_industrial
```

El primer comando levanta un servidor con los datos reales del Atoyac; el segundo le manda
un día de lecturas de cinco estaciones con una descarga industrial inyectada a las 10:00.

Para ver el mapa y el simulador hace falta servir el repositorio desde su raíz:

```powershell
python -m http.server 8000
```

Mapa en `http://127.0.0.1:8000/mapa/` y simulador en
`http://127.0.0.1:8000/dispositivo/simulador/`.

## Documentación

El índice completo está en [`docs/README.md`](docs/README.md). Los cuatro documentos que
dan el panorama:

| Documento | Contenido |
|---|---|
| [`docs/01-que-construimos.md`](docs/01-que-construimos.md) | El problema, la solución y qué existe hoy frente a qué está planeado |
| [`docs/02-arquitectura.md`](docs/02-arquitectura.md) | Cómo encajan las piezas y el recorrido de un dato |
| [`docs/04-fuentes-de-datos.md`](docs/04-fuentes-de-datos.md) | De dónde salen los datos, cómo se obtuvieron y por qué |
| [`docs/10-revision-critica-plan.md`](docs/10-revision-critica-plan.md) | Las objeciones al plan original y qué se hizo en su lugar |

Y los de referencia: [`datos/README.md`](datos/README.md) describe el conjunto de datos,
[`contrato/README.md`](contrato/README.md) el contrato entre módulos, y
[`datos/bitacora.md`](datos/bitacora.md) registra la URL exacta de cada fuente.

## Estructura

```
contrato/         esquemas, datos de ejemplo, servidor de pruebas y validador
datos/crudos/     archivos tal cual se descargaron (no versionados, no se editan)
datos/geo/        red hidrográfica del INEGI extraída (no versionada)
datos/procesados/ tablas del modelo de datos, análisis y topología de la red
dispositivo/      la estación centinela: ficha técnica y simulador del firmware
docs/             documentación del prototipo y convenciones del repositorio
mapa/             mapa de la cuenca
scripts/          descarga, construcción, análisis, verificación y topología
```

Los archivos crudos no se versionan, son 138 MB. Se vuelven a bajar con
`python -I scripts/00_descargar_fuentes.py`, que guarda las URL resueltas, y ningún script
los modifica. La secuencia completa de reconstrucción y la lista de scripts están en
[`docs/contexto/02-mapa-del-repo.md`](docs/contexto/02-mapa-del-repo.md).

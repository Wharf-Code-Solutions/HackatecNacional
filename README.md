# HackaTec 2026 — Reto SECIHTI Puebla

Soluciones tecnológicas para identificar, monitorear y reducir la contaminación de
ríos, barrancas y cuerpos de agua del estado de Puebla, con foco en la cuenca del
**Alto Atoyac**.

## Estado del proyecto

Etapa 1 (datos) construida y verificada. Contrato de datos v1.0 listo para congelar.
Las etapas 2 a 8 pueden arrancar en paralelo.

## Por dónde empezar

| Si eres... | Lee esto |
|---|---|
| **Un agente de IA que va a modificar el repositorio** | [`docs/contexto/00-LEEME-PRIMERO.md`](docs/contexto/00-LEEME-PRIMERO.md) |
| Quien va a escribir código de cualquier módulo | [`contrato/README.md`](contrato/README.md) — arranca en 30 segundos |
| Quien reparte el trabajo | [`docs/11-metodologia-modulos.md`](docs/11-metodologia-modulos.md) |
| Quien quiere saber qué objetamos del plan y por qué | [`docs/10-revision-critica-plan.md`](docs/10-revision-critica-plan.md) |
| Quien va a trabajar con los datos | [`datos/README.md`](datos/README.md) |

## Documentos

El índice completo, con las dos secciones, está en
[`docs/README.md`](docs/README.md).

| Documento | Contenido |
|---|---|
| [`docs/01-que-construimos.md`](docs/01-que-construimos.md) | El problema, la solución y **qué existe hoy frente a qué está planeado** |
| [`docs/02-arquitectura.md`](docs/02-arquitectura.md) | Cómo encajan las piezas y el recorrido de un dato |
| [`docs/03-tecnologias.md`](docs/03-tecnologias.md) | Stack con justificación y lo que se descartó |
| [`docs/04-fuentes-de-datos.md`](docs/04-fuentes-de-datos.md) | De dónde salen los datos, cómo se obtuvieron y por qué |
| [`docs/05-decisiones-tecnicas.md`](docs/05-decisiones-tecnicas.md) | D1 a D18, con alternativa descartada y consecuencia |
| [`docs/06-glosario.md`](docs/06-glosario.md) | Términos del dominio y del proyecto |
| [`docs/07-plan-recoleccion-datos.md`](docs/07-plan-recoleccion-datos.md) | Plan original de la Etapa 1 |
| [`docs/08-verificacion-datos.md`](docs/08-verificacion-datos.md) | Verificación del conjunto de datos, con veredicto por sección |
| [`docs/09-hallazgos-exploratorio.md`](docs/09-hallazgos-exploratorio.md) | Hallazgos del análisis exploratorio |
| [`docs/10-revision-critica-plan.md`](docs/10-revision-critica-plan.md) | Seis objeciones al plan de etapas 2 a 8, con alternativas |
| [`docs/11-metodologia-modulos.md`](docs/11-metodologia-modulos.md) | Módulos independientes, criterios de terminado y plan de degradación |
| [`datos/bitacora.md`](datos/bitacora.md) | Registro de fuentes, correcciones al inventario y pendientes |
| [`datos/README.md`](datos/README.md) | Descripción del conjunto de datos |
| [`contrato/README.md`](contrato/README.md) | Contrato de datos v1.0 |
| [`dispositivo/ficha-tecnica.md`](dispositivo/ficha-tecnica.md) | La estación centinela: bloques, ciclo del firmware, lo medido y lo supuesto |

## Arranque rápido

Requiere Python 3.11+. El contrato y el servidor mock no necesitan ninguna dependencia.

```powershell
python contrato/servidor_mock.py
```

```powershell
python contrato/reproducir_escenario.py descarga_industrial
```

Eso levanta un backend con los datos reales del Atoyac y le manda un día de lecturas con
una descarga industrial inyectada. Cualquier frontend ya tiene de dónde leer.

## Reconstruir los datos desde cero

Para esto sí hacen falta tres paquetes: `pip install openpyxl pyxlsb pypdf`.

```powershell
python -I scripts/00_descargar_fuentes.py
```

```powershell
python -I scripts/10_construir_tablas.py
```

```powershell
python -I scripts/20_analisis_exploratorio.py
```

```powershell
python -I scripts/30_verificacion_datos.py
```

```powershell
python -I scripts/40_generar_fixtures.py
```

Y para comprobar que todo quedó consistente, sin necesidad de los archivos crudos:

```powershell
python -I scripts/50_verificar_repo.py
```

Los archivos crudos no se versionan (son 138 MB); el primer script los vuelve a bajar
desde las URL registradas en la bitácora. Ningún script modifica un archivo crudo.

## Estructura

```
contrato/        contrato de datos: esquemas, fixtures, servidor mock, validador
dispositivo/     estación centinela (M4): ficha técnica y simulador web del firmware
mapa/            mapa de la cuenca con las estaciones y zoom al simulador (prototipo de M6)
datos/crudos/    archivos tal cual se descargaron (no versionados, no se editan)
datos/geo/       red hidrográfica del INEGI extraída (no versionada)
datos/procesados/ tablas del modelo de datos y salidas del análisis
docs/            sección 1: el prototipo · sección 2 (contexto/): reglas para agentes
scripts/         descarga, construcción, análisis, verificación y fixtures
```

## Scripts

| Script | Qué hace |
|---|---|
| `_comun.py` | Lectura de los Excel de CONAGUA, fechas y valores censurados. Compartido. |
| `00_descargar_fuentes.py` | Descarga cada fuente a `datos/crudos/<ID>/`. |
| `01_inspeccionar_crudos.py` | Imprime hojas, dimensiones y primeras filas de un Excel. Diagnóstico. |
| `02_explorar_f02.py` | Explora columnas, cuencas y escalas del archivo de indicadores. |
| `10_construir_tablas.py` | Construye `sitio`, `parametro`, `muestreo`, `umbral` y auxiliares. |
| `20_analisis_exploratorio.py` | Línea base, ranking, temporada, tendencia, cobertura y correlaciones. |
| `30_verificacion_datos.py` | Verifica el conjunto de datos y escribe el informe con veredictos. |
| `40_generar_fixtures.py` | Genera los fixtures del contrato con la línea base real. |
| `60_red_para_mapa.py` | Simplifica la red hidrográfica del INEGI (ríos, subcuencas, nombres) para el mapa. |
| `50_verificar_repo.py` | Revisión de salud: comprueba nueve invariantes y sale con código 1 si alguna falla. |

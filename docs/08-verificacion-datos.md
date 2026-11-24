# Verificacion del conjunto de datos de la Etapa 1

Generado por `scripts/30_verificacion_datos.py`. Cada seccion termina en un veredicto: **OK**, **ATENCION** o **BLOQUEANTE** para las etapas siguientes.

## 1. Volumen

- `datos/crudos/`: 138.0 MB
- `datos/geo/`: 61.0 MB
- `datos/procesados/`: 19.4 MB
- **Total en disco: 218.3 MB.** De eso, 138.0 MB son archivos crudos que no se versionan y se vuelven a bajar con un script.

| Tabla | Filas |
|---|---|
| `sitio.csv` | 219 |
| `parametro.csv` | 347 |
| `muestreo.csv` | 145,703 |
| `muestreo_nucleo.csv` | 74,801 |
| `umbral.csv` | 146 |
| `indicador_sitio_periodo.csv` | 212 |

## 2. Conflictos entre fuentes para el mismo dato

- F01 (Atoyac 2012-2018) aporta 43,359 valores del nucleo; F05 (RENAMECA por estado) aporta 29,268.
- Coinciden en **17,031** combinaciones (sitio, fecha, parametro), es decir 39.3 % de F01 y 58.2 % de F05.
- De los coincidentes, **99.3 %** son identicos y **0.0 %** difieren mas de 5 %.
- Diferencia relativa mediana: 0.0000.

**Veredicto: OK.** El solapamiento es pequeno y los valores coinciden, asi que la regla de prioridad (F05 gana, F01 rellena) no introduce sesgo apreciable.

## 3. Consistencia de unidades entre fuentes

- Parametros presentes en las dos fuentes con unidad declarada: 339.

**Veredicto: OK.** Ninguna clave de parametro cambia de unidad entre fuentes, asi que las series se pueden unir sin conversion.

## 4. Caudal: se puede calcular carga, no solo concentracion

- Muestreos totales: **2,999**. Con caudal medido: **976** (32.5 %), en 33 de 219 sitios.
- Caudal mediano 202.00, minimo 0.003, maximo 329970.2 (unidad: L/s).

**Veredicto: ATENCION.** Con caudal en menos de la mitad de los muestreos no se puede priorizar por carga (kg/dia) de forma general, solo por concentracion. Para los sitios que si lo traen conviene calcularla, porque la carga es lo que decide a quien inspeccionar.

## 5. Sitios que en realidad son descargas

- Clasificados como descarga por el **subtipo de cuerpo de agua**: **2** de 219.
  - `DLPUE1983` SABORMEX, S.A. DE C.V. (ANTES CAFES DE VERACRUZ, S.A. DE C.V (PUEBLA)
  - `DLPUE1984` SABORMEX, S.A. DE C.V. (ANTES CAFES DE VERACRUZ, S.A. DE C.V (PUEBLA)
- Ademas, sitios cuyo **nombre** dice que son o estan junto a una descarga, sin que el subtipo lo refleje: **9**.
  - `DLPUE0108RNL` DESCARGA EL CARMEN (HUEJOTZINGO)
  - `DLPUE1988` AGUAS ABAJO DE LA DESCARGA TEXTIL ZALDO (CUAUTLANCINGO)
  - `DLPUE2062` ER8 RÍO ALSESECA AGUAS ARRIBA DE LA DESCARGA PTAR ALSESECA S (PUEBLA)
  - `DLTLA0105RNL` DESCARGA CIX 1 TETLA (TETLA)
  - `DLTLA0124RNL` AGUAS ABAJO DESCARGA POLAQUIMIA (SAN COSME XALOZTOC)
  - `DLTLA0249RNL` DESCARGA HUMEDAL ATLANGATEPEC (ATLANGATEPEC)
  - `DLTLA0270RNL` DESCARGAS REGIONALES NATIVITAS (NATIVITAS)
  - `DLTLA2587` BARRANCA SAMBRANO ANTES DESCARGA POLAQUIMIA (XALOZTOC)
  - `DLTLA2608` RÍO ZAHUAPAN ANTES DESCARGA APIZACO "B" (YAUHQUEMEHCAN)

**Veredicto: ATENCION.** El subtipo de cuerpo de agua esta mal poblado: solo marca dos descargas cuando los nombres delatan 9. Estos puntos no miden la calidad del rio sino la de un efluente, y son los unicos a los que aplica legalmente la NOM-001-SEMARNAT-2021. Mezclarlos con los sitios de cauce infla el deterioro aparente del rio. Hace falta una bandera `es_descarga` curada a mano sobre estos 11 candidatos.

## 6. Poder de discriminacion del semaforo

- Reparto del semaforo CONAGUA 2012-2025 en la cuenca: 176 ROJO, 21 sin dato, 16 VERDE, 6 AMARILLO.
- **89 % de los sitios con dato estan en rojo.**
- Un indice continuo sencillo (mediana de `valor / limite de clase Contaminada`, sobre 7 parametros) separa los mismos sitios en un rango de **0.15 a 12.9**, con mediana 1.99.
- Los cinco peores por ese indice:
  - `DLTLA2582` RA-10 RÍO XOPANAC, ANTES DE LA CONFLUENCIA CON EL RÍ -> 12.9 veces el limite
  - `DLTLA0105RNL` DESCARGA CIX 1 TETLA -> 11.5 veces el limite
  - `DLPUE1979M1` BARRANCA SAN DIEGO LOS ALAMOS -> 10.7 veces el limite
  - `DLTLA2587` BARRANCA SAMBRANO ANTES DESCARGA POLAQUIMIA -> 8.0 veces el limite
  - `DLTLA2594` RÍO ATENCO PUENTE A TLAXCO -> 6.7 veces el limite
- Dentro de los sitios **en rojo**, el indice va de 0.15 a 12.9: el color los iguala, el indice los ordena.

**Veredicto: ATENCION.** Con casi todo en rojo, el semaforo no sirve para priorizar, ni para detectar que algo empeoro, ni para medir si una medida funciono. Sirve solo para comunicar al publico. El sistema necesita ademas una medida continua.

## 7. Viabilidad de la linea base por sitio

- todos los parametros: 14,361 pares sitio-parametro; **4,385** con 12 o mas mediciones y 1,933 con 30 o mas. Sitios con al menos un parametro de 12+ mediciones: **80**.
- parametros medibles en campo: 1,473 pares sitio-parametro; **696** con 12 o mas mediciones y 391 con 30 o mas. Sitios con al menos un parametro de 12+ mediciones: **80**.

Por parametro de campo, sitios con 12 o mas mediciones:

| Parametro | Sitios con linea base | Mediciones totales |
|---|---|---|
| `CONDUC_CAMPO` | 69 | 2,658 |
| `CONDUC_CAMPO_FON` | 5 | 123 |
| `CONDUC_CAMPO_MED` | 7 | 135 |
| `CONDUC_CAMPO_SUP` | 11 | 235 |
| `OD_%` | 69 | 2,241 |
| `OD_%_FON` | 4 | 104 |
| `OD_%_MED` | 7 | 115 |
| `OD_%_SUP` | 10 | 168 |
| `OD_mg/L` | 69 | 2,620 |
| `OD_mg/L_FON` | 4 | 104 |
| `OD_mg/L_MED` | 7 | 115 |
| `OD_mg/L_SUP` | 11 | 203 |
| `POT_REDOX_CAMPO` | 0 | 30 |
| `PROFUNDIDAD` | 11 | 153 |
| `SDT` | 80 | 2,782 |
| `TEMP_AGUA` | 69 | 2,702 |
| `TEMP_AMB` | 80 | 2,878 |
| `TRANSPARENCIA` | 11 | 191 |
| `TURBIEDAD` | 80 | 2,514 |
| `pH_CAMPO` | 69 | 2,601 |
| `pH_CAMPO_FON` | 5 | 106 |
| `pH_CAMPO_MED` | 7 | 117 |
| `pH_CAMPO_SUP` | 11 | 208 |

**Veredicto: OK.** Hay linea base suficiente para los parametros que un sensor puede medir, que es la condicion que pide la Etapa 3.

## 8. Cadencia del muestreo

- Dias entre muestreos consecutivos del mismo sitio: mediana **49**, percentil 90 **220**, maximo **3,294**.
- Resultados por anio: 2012: 4,195, 2013: 14,864, 2014: 20,399, 2015: 20,587, 2016: 20,216, 2017: 22,044, 2018: 20,984, 2019: 2,865, 2020: 1,494, 2021: 1,067, 2022: 1,465, 2023: 1,534, 2024: 1,855, 2025: 12,134.

**Veredicto: ATENCION.** No es una serie continua: es una coleccion de muestreos espaciados, con un hueco de densidad entre 2019 y 2024. Sirve para la banda normal de cada sitio, no para entrenar un modelo de pronostico temporal.

## 9. Oxigeno disuelto y el modelo de propagacion

- Mediciones de OD en mg/L: **2,620**. Mediana **1.38 mg/L**.
- Por debajo de 2 mg/L (hipoxia severa): **59 %**. Por debajo de 0.5 mg/L (practicamente anoxico): **0 %**.
- Saturacion de OD: mediana **19.0 %**.

**Veredicto: BLOQUEANTE para el modelo tal como esta planteado.** No por anoxia total (ningun valor baja de 0.5 mg/L), sino por tres cosas: el rio vive de forma permanente en hipoxia severa, asi que el descenso de oxigeno que Streeter-Phelps predice ya ocurrio y el deficit esta casi en su tope; no hay en los datos un tramo con recuperacion clara contra el cual calibrar las constantes de desoxigenacion y reaireacion; y falta la hidraulica (velocidad del flujo, y caudal en 67 % de los muestreos). Un modelo calibrado con constantes de literatura sobre un rio que ya esta en el piso daria una curva bonita sin poder predictivo. Ver la revision critica del plan para la alternativa.

## 10. Topologia del rio

- Sitios con sucesor aguas abajo definido: **0 de 219**.
- Capas de lineas de flujo disponibles en `datos/geo/`: **10** (una por subcuenca).

**Veredicto: BLOQUEANTE.** El orden aguas arriba -> aguas abajo es la entrada de tres cosas distintas: el modelo de propagacion (Etapa 2), la vista de "fuentes aguas arriba de este punto" (Etapa 4) y la asignacion de un reporte ciudadano al tramo correcto (Etapa 5). La red ya esta descargada, pero falta proyectar los 219 sitios sobre ella y ordenarlos.

## 11. Fuentes que faltan y a que etapa bloquean

| Falta | Bloquea | Consecuencia si no se consigue |
|---|---|---|
| Precipitacion diaria o mensual (F13) | Escenario "lluvia" de las Etapas 3 y 6 | No se puede distinguir un arrastre por lluvia de una descarga clandestina, y ese es uno de los cuatro escenarios de prueba |
| Padron de descargas REPDA (F09) | "Fuente probable" de la Etapa 2 y panel de autoridad de la Etapa 4 | La fuente probable queda como una categoria abstracta, sin un titular ni un domicilio al que apuntar |
| DENUE filtrado a la cuenca (F12, ya descargado sin procesar) | Igual que el anterior | Se pierde la unica capa de establecimientos con giro y coordenada |
| Plantas de tratamiento (F11) | Catalogo de mitigacion de la Etapa 2.6 | No se sabe si el tramo ya tiene infraestructura que no opera |
| Caudal continuo (F14) | Carga masica y dilucion | Solo se prioriza por concentracion, que castiga a los arroyos pequenos |


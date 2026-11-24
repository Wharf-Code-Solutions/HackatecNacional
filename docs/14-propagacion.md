# Propagacion aguas abajo (M3)

Generado por `scripts/80_propagacion.py`.

## 1. Lo que dicen los datos, no la literatura

Razon entre la concentracion aguas abajo y la de aguas arriba, medida en tramos adyacentes muestreados **el mismo dia**. Una razon por tramo, para no contar el mismo tramo varias veces.

| Parametro | Tramos | Observ. | p10 | Mediana por tramo | p90 | % de tramos donde sube |
|---|---|---|---|---|---|---|
| `DQO_TOT` | 90 | 732 | 0.39 | **1.04** | 3.65 | 57 % |
| `DBO_TOT` | 87 | 713 | 0.30 | **0.99** | 5.83 | 48 % |
| `SST` | 87 | 722 | 0.33 | **1.00** | 6.87 | 48 % |
| `CONDUC_CAMPO` | 77 | 692 | 0.59 | **1.00** | 1.87 | 48 % |
| `SDT` | 85 | 699 | 0.58 | **0.99** | 1.83 | 45 % |
| `COLI_FEC` | 64 | 634 | 0.19 | **1.00** | 9.24 | 31 % |
| `E_COLI` | 35 | 611 | 0.19 | **1.00** | 7.33 | 9 % |
| `OD_mg/L` | 84 | 685 | 0.30 | **1.00** | 2.80 | 29 % |
| `N_NH3` | 84 | 701 | 0.29 | **1.00** | 6.13 | 45 % |
| `P_TOT` | 59 | 643 | 0.34 | **1.00** | 3.48 | 34 % |
| `TURBIEDAD` | 40 | 615 | 0.32 | **1.03** | 8.32 | 55 % |

**La mediana es 1.00 en todos los parametros.** Sobre las distancias que separan a dos sitios consecutivos (mediana 1 749 m, hasta 20 km) no hay atenuacion neta medible: entre dos sitios entran tantas descargas como la autodepuracion quita. Por eso el modelo es de **transporte conservativo**, con k = 0, y no un decaimiento con constante de literatura, que quedaria contradicho por estas 90 mediciones.

Lo que si informa es la dispersion. Para la DQO, el 80 % central de las observaciones esta entre **0.39 y 3.65** veces la concentracion de arriba. Eso se publica como **banda de llegada**, no como un valor puntual. Los percentiles se estiman con las observaciones individuales y no con las medianas por tramo, porque la banda tiene que cubrir una observacion futura.

## 2. Ventana de llegada

`tiempo = distancia sobre el cauce / velocidad`. La distancia la calculo M1. La velocidad **no existe medida** en esta cuenca: se declara el intervalo 0.3 a 1.0 m/s y la salida es una ventana, nunca una hora exacta.

- **5,769** pares con ventana calculada; 3,453 dentro de los 50 km que considero operativamente utiles.
- Llegada mas temprana a un sitio cualquiera aguas abajo: mediana **6.7 h**, percentil 10 1.1 h. Son todos los pares de ancestria, no solo los consecutivos.

Sensibilidad: a 1 km de distancia, la ventana va de 0.3 a 0.9 horas. Si la velocidad real fuera 0.2 o 1.5 m/s, iria de 0.2 a 1.4. Quien mida un aforo con flotador en un tramo puede cerrar ese intervalo y estrechar todas las predicciones de golpe.

## 3. Que se puede validar y que no

No hay un evento real registrado con monitoreo continuo, asi que el modelo no se puede validar contra un episodio. Lo que si se comprobo:

**a) Monotonia.** Los tiempos de llegada crecen con la distancia en 210 de 210 sitios con descendientes. Fallos: 0.

**b) Cobertura de la banda, fuera de muestra.** La banda se estima con la mitad de los tramos y se mide contra la otra mitad, en las dos direcciones. Si cubre cerca del 80 % de las observaciones que no uso para estimarla, generaliza. Medirla contra los mismos datos con que se estimo habria dado 80 % por construccion y no probaria nada.

| Parametro | Observaciones de prueba | Dentro de la banda |
|---|---|---|
| `DQO_TOT` | 732 | **79 %** |
| `DBO_TOT` | 713 | **81 %** |
| `SST` | 722 | **77 %** |
| `CONDUC_CAMPO` | 692 | **77 %** |
| `SDT` | 699 | **78 %** |
| `COLI_FEC` | 634 | **79 %** |
| `E_COLI` | 611 | **80 %** |
| `OD_mg/L` | 685 | **71 %** |
| `N_NH3` | 701 | **78 %** |
| `P_TOT` | 643 | **75 %** |
| `TURBIEDAD` | 615 | **76 %** |

Mediana de cobertura: **78 %**.

**c) Lo que no se validó.** La velocidad del flujo, porque no hay ningun dato de velocidad ni de tiempo de viaje en la cuenca. Es el supuesto mas fuerte del modelo y el mas facil de cerrar en campo: un aforo con flotador en un tramo conocido bastaria.

## 4. Ejemplo

`contrato/fixtures/prediccion_ejemplo.json`: una descarga de DQO de 400 mg/L en `DLTLA2582` (RA-10 Rio Xopanac, Nativitas) a las 10:00. Alcanza **26 sitios** aguas abajo. Los tres primeros:

| Sitio | Distancia | Llegada | DQO estimada | Confianza |
|---|---|---|---|---|
| `DLTLA0008RNL` RÍO ATOYAC DESPUES DE CONFLU | 0.5 km | 10:09 a 10:30 | 416 (154 a 1458) mg/L | alta |
| `DLTLA2597` RÍO ATOYAC DOMINGO ARENAS | 4.8 km | 11:19 a 14:24 | 416 (154 a 1458) mg/L | alta |
| `DLTLA2546` TLAPALAC ANTES DE CONFLUENCI | 11.5 km | 13:11 a 20:37 | 416 (154 a 1458) mg/L | alta |

La DQO estimada **no baja con la distancia**, y eso no es un error del calculo: es lo que miden los 90 tramos de la seccion 1. Lo que cambia con la distancia es la ventana horaria y la confianza.

El panel y el mapa pueden consumir ese archivo desde hoy, sin esperar a M5.

## 5. Fronteras

- M3 **no decide si hay alerta**: consume una ya emitida por M2.
- M3 **no clasifica el nivel**. `nivel_esperado` va en `Sin dato` hasta que M2 exista; esa regla es suya y escribirla aqui la duplicaria.
- M3 **no modela embalses**. Los destinos lenticos salen con advertencia: la adveccion no describe el tiempo de residencia ni la sedimentacion de una presa.
- M3 **no modela quimica ni resuspension de sedimento**.


# Topologia de la red hidrografica (M1)

Generado por `scripts/70_topologia_red.py`.

## 1. Red cargada

- `RH18Aa`: 6,343 tramos
- `RH18Ab`: 7,282 tramos
- `RH18Ac`: 408 tramos
- `RH18Ad`: 6,097 tramos
- `RH18Ae`: 8,870 tramos
- `RH18Af`: 18,425 tramos
- `RH18Ag`: 5,581 tramos
- `RH18Ah`: 6,683 tramos
- `RH18Ai`: 5,262 tramos
- `RH18Aj`: 391 tramos

Total: **65,342 tramos** en 10 subcuencas. La longitud la trae el propio INEGI en el campo `LENGTHM`, asi que no se recalcula.

Reparto por orden de Strahler: orden -1: 40, orden 1: 32,961, orden 2: 15,426, orden 3: 8,731, orden 4: 4,447, orden 5: 1,920, orden 6: 1,249, orden 7: 568.

> Se usan **todos** los tramos, incluidos los de orden 1 a 3. `60_red_para_mapa.py` filtra a orden 4 o mas para que el mapa no se arrastre, pero muchas barrancas urbanas son de orden bajo y son justo los puntos mas contaminados de la cuenca.

## 2. Grafo de la red

- 65,344 nodos distintos, uniendo extremos a menos de 2 m.
- 27,879 nodos con un solo tramo (cabeceras y salidas).

- 52 componentes conexas en total: la red principal de cada subcuenca mas fragmentos sueltos del propio producto del INEGI.
- **65,342 de 65,342 tramos orientados** hacia la salida de su componente (100.0 %).
- Validacion con `ARBSUM_1`: **98.9 %** de los enlaces tienen suma arborescente no decreciente hacia aguas abajo (64,597 de 65,300).
- 0 subcuencas cosidas a la red de la vecina (tolerancia 500 m).

## 3. Enganche de los sitios al cauce

- Sitios con coordenadas: **219**.
- Calidad del enganche: 195 bueno, 16 dudoso, 8 malo (bueno <= 150 m, dudoso <= 500 m).
- Distancia de enganche: mediana **11 m**, percentil 90 174 m, maxima 11234 m.
- **38** sitios lenticos (presa, laguna). No estan sobre una linea de flujo: se enganchan al cauce mas cercano y quedan marcados, porque su tiempo de residencia no se modela como un tramo de rio.

## 4. Siguiente sitio aguas abajo

- **8** sitios quedan fuera de la cadena por enganche mayor a 500 m: `DLPUE0107RNL`, `DLPUE2065`, `DLTLA0102RNL`, `DLTLA0103RNL`, `DLTLA0104RNL`, `DLTLA0161RNL`, `DLTLA0162RNL`, `DLTLA0288RNL`.

- **210 de 219** sitios tienen sucesor aguas abajo. De los 9 restantes, 1 llegan al final de su cauce (nadie los sigue, no es un error) y 8 son los que quedaron fuera de la cadena por enganche lejano.
- Distancia al siguiente sitio: mediana **1749 m**, minima 1 m, maxima 151321 m.

- **6,276 pares** (sitio arriba, sitio abajo) con su distancia sobre el cauce. Es la relacion que necesita el panel para responder "que hay aguas arriba de este punto".

## 5. Validacion

Decenas de sitios declaran su posicion en el nombre. Si el orden calculado contradice el nombre, el calculo esta mal.

**a) Pares "aguas arriba" y "aguas abajo" del mismo punto.** 4 pares revisados: 4 coinciden con el calculo, 0 lo contradicen, 0 sin relacion de ancestria (pueden estar en ramas distintas).
   - `DLPUE077RNL` -> `DLPUE079RNL` (RÍO ALSESECA)
   - `DLPUE1984` -> `DLPUE1983` (SABORMEX, S.A. DE C.V. (ANTES CAFES DE VERAC)
   - `DLTLA2560` -> `DLTLA2561` (RÍO ZAHUAPAN  DE LA CASCADA ATLIHUETZIA)
   - `DLTLA2563` -> `DLTLA2562` (PROCTER & GAMBLE MANUFACTURA, S. DE R.L. DE )

**b) Orden de Strahler.** De 210 pares consecutivos, **204** tienen orden no decreciente hacia aguas abajo y 6 lo tienen decreciente.
   Un orden que baja puede ser legitimo si el enganche puso dos sitios en ramas distintas de una confluencia; conviene revisar esos casos.

**c) Final de las cadenas.** 9 sitios sin sucesor: 1 porque su cadena llega a la salida de la red, 8 porque engancharon lejos del cauce y no se encadenan, y 0 con el recorrido truncado.

**d) Marcados para revision.** 14 sitios llevan `revisar = si`: 8 por enganche lejano y 6 porque el orden de Strahler baja hacia su sucesor. No se ocultan ni se corrigen a mano: quien consuma la tabla puede filtrarlos.
   - `DLPUE0107RNL` XOXTLA 2 enganche a 800 m del cauce mas cercano; no se encadena
   - `DLPUE2052` RA-21 RIO ATOYAC, ANTES DE LA DERIVADORA ECHEV -> `DLPUE2056`, orden decreciente
   - `DLPUE2059 M1` RÍO ALSESECA COLONIA LA HACIENDA -> `DLPUE2064`, orden decreciente
   - `DLPUE2059M1` RIO ALSESECA COLONIA LA HACIENDA -> `DLPUE2064`, orden decreciente
   - `DLPUE2065` PRESA MANUEL AVILA CAMACHO 5 enganche a 797 m del cauce mas cercano; no se encadena
   - `DLPUE2068` PRESA MANUEL AVILA CAMACHO 6 -> `DLPUE2070`, orden decreciente
   - `DLTLA0102RNL` PRESA EL MUERTO ZONA BUENA VISTA enganche a 4028 m del cauce mas cercano; no se encadena
   - `DLTLA0103RNL` CANAL DE LLEGADA JOSE M.M BUENA VISTA A PRESA  enganche a 3117 m del cauce mas cercano; no se encadena
   - `DLTLA0104RNL` PRESA EL MUERTO SAN ANDRES BUENA VISTA enganche a 3398 m del cauce mas cercano; no se encadena
   - `DLTLA0161RNL` JAGUEY LOS DOS CERRITOS ENTRADA enganche a 11129 m del cauce mas cercano; no se encadena
   - `DLTLA0162RNL` JAGUEY LOS DOS CERRITOS SALIDA enganche a 11234 m del cauce mas cercano; no se encadena
   - `DLTLA0288RNL` AA EFLUENTE CIX 1 enganche a 501 m del cauce mas cercano; no se encadena
   - `DLTLA0311RNL` ZACATELCO -> `DLTLA2548`, orden decreciente
   - `DLTLA2604` RÍO ZAHUAPAN TETLATLAHUCA -> `DLTLA2549`, orden decreciente

## 6. Tablas producidas

| Archivo | Filas | Para que |
|---|---|---|
| `red/tramo.csv` | 65,342 | La red con su orden, longitud y tramo de aguas abajo |
| `red/sitio_red.csv` | 219 | Donde quedo enganchado cada sitio y con que calidad |
| `red/sitio_aguas_abajo.csv` | 219 | El siguiente sitio aguas abajo y su distancia sobre el cauce |
| `red/sitio_pares.csv` | 6,276 | Todos los pares arriba-abajo, para responder "que hay aguas arriba de aqui" |

`c_sitio_aguas_abajo` vive aqui y no en `sitio.csv`: `sitio.csv` lo genera `10_construir_tablas.py`, que corre antes de este script y no puede conocer la topologia.


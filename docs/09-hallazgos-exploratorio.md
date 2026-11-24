# Hallazgos del analisis exploratorio inicial

Generado por `scripts/20_analisis_exploratorio.py` sobre las tablas de `datos/procesados/`. Fuentes: F01, F02, F05 (CONAGUA).

## Cobertura

- **219** sitios de monitoreo superficial en el area de estudio; 219 con coordenadas validas.
- **145,703** resultados en la tabla `muestreo` (74,801 en el nucleo analitico), de **2,962** muestreos.
- Periodo: **2012-11-06 a 2025-12-08**.
- Resultados del nucleo por anio: 2012: 2,674, 2013: 9,445, 2014: 10,472, 2015: 10,606, 2016: 10,918, 2017: 10,971, 2018: 10,653, 2019: 1,747, 2020: 886, 2021: 564, 2022: 584, 2023: 889, 2024: 1,065, 2025: 3,327.

## Semaforo CONAGUA del periodo 2012-2025 (F02)

- ROJO: **176** sitios
- (sin dato): **21** sitios
- VERDE: **16** sitios
- AMARILLO: **6** sitios

Contaminantes que CONAGUA senala con mas frecuencia en la cuenca: DQO (170), DBO (138), CF (113), SST (55), E_COLI (45), OD_PORC (23), TOX_V (21), TOX_D (8), OD%M (4), OD%F (4).

## 10 sitios mas criticos

Orden: numero de parametros fuera de clase en su ultima medicion, luego porcentaje historico de mediciones en clase mala.

| Sitio | Nombre | Cuerpo de agua | Municipio | Param. fuera | % malas |
|---|---|---|---|---|---|
| DLTLA2582 | RA-10 RÍO XOPANAC, ANTES DE LA CONFLUENCIA CON | RÍO ATOYAC | NATIVITAS | 8 | 84.7 |
| DLPUE2051 | ANTES DE LA CONFLUENCIA CON EL RIO ATOYAC | ARROYO ATENCO | OCOYUCAN | 8 | 80.6 |
| DLPUE2019 | RA-8 RÍO XOCHIAC, AGUAS ARRIBA DE LA CONFLUENC | RÍO XOCHIAC | HUEJOTZINGO | 8 | 47.2 |
| DLPUE2063 | PUEBLA ALSESECA  (A) AGUAS ARRIBA | RÍO ALSESECA | CUAUTLANCINGO | 7 | 77.2 |
| DLTLA2547 | RA-12 RÍO ATOYAC, ANTES DE LA CONFLUENCIA CON  | RÍO ATOYAC | PAPALOTLA DE XICOHTÉ | 7 | 75.1 |
| DLPUE2015M1 | ARROYO LA PRESA | RÍO CHIQUITO | SAN MARTÍN TEXMELUCA | 7 | 74.6 |
| DLTLA2546 | TLAPALAC ANTES DE CONFLUENCIA CON RÍO ATOYAC | TLAPALAC | PAPALOTLA DE XICOHTE | 7 | 73.6 |
| DLPUE1976 | PUEBLA SAN FRANCISCO  (A) AGUAS ARRIBA | RÍO ATOYAC | H. PUEBLA DE ZARAGOZ | 7 | 68.8 |
| DLTLA2548 | RÍO VIEJO ANTES DE LA CONFLUENCIA CON EL RÍO Z | RÍO VIEJO | ZACATELCO | 7 | 63.8 |
| DLPUE0131RNL | POSCO | XOPANAC | HUEJOTZINGO | 6 | 100.0 |

## Efecto de la temporada

Mediana en lluvias (junio-octubre) frente a estiaje (noviembre-mayo), parametros con mayor cambio relativo:

| Parametro | Unidad | Mediana estiaje | Mediana lluvias | Cambio |
|---|---|---|---|---|
| OD_% | % Saturación | 10.0 | 27.3 | +173.0% |
| OD_mg/L | mg/L | 1.0 | 2.055 | +105.5% |
| FENOLES_TOT | mg/L | 0.0235 | 0.0009 | -96.2% |
| SAAM | mg/L | 3.1135 | 0.91 | -70.8% |
| DBO_SOL | mg/L | 27.17 | 11.0 | -59.5% |
| N_NH3 | mg/L | 4.9 | 2.281 | -53.4% |
| DBO_TOT | mg/L | 66.67 | 33.33 | -50.0% |
| N_TOT | mg/L | 11.391 | 5.724 | -49.7% |

## Parametros que suben juntos (pista del tipo de fuente)

| A | B | n | Pearson |
|---|---|---|---|
| COLI_FEC | E_COLI | 2444 | 0.987 |
| CONDUC_CAMPO | SDT | 2521 | 0.971 |
| DBO_SOL | DBO_TOT | 2445 | 0.95 |
| SST | TURBIEDAD | 2506 | 0.947 |
| OD_% | OD_mg/L | 2237 | 0.94 |
| DBO_SOL | DQO_SOL | 2445 | 0.925 |
| DQO_SOL | DQO_TOT | 2439 | 0.905 |
| DBO_TOT | DQO_TOT | 2769 | 0.895 |
| DBO_TOT | DQO_SOL | 2436 | 0.891 |
| COLI_TOT | E_COLI | 2182 | 0.887 |
| CU_TOT | NI_TOT | 423 | 0.885 |
| CD_TOT | CU_TOT | 440 | 0.878 |
| CU_TOT | PB_TOT | 440 | 0.874 |
| DBO_SOL | DQO_TOT | 2437 | 0.858 |
| CR_TOT | CU_TOT | 435 | 0.791 |

## Pendiente

- Orden aguas arriba -> aguas abajo de los sitios (requiere F08, red hidrografica).
- Cruce con descargas y establecimientos (F09-F12) y con precipitacion (F13).
- Limites de la NOM-001-SEMARNAT-2021 cargados a `umbral` (F07 ya descargado).

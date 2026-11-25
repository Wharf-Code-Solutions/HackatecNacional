# Catálogo de componentes y nomenclatura

> 24 de noviembre de 2026. Modelo comercial propuesto para cada componente de los mecanismos (estación de agua,
> colector de residuos y módulo de ladera) y una clave única para cada pieza instalada, que dice **en qué estado
> (entidad federativa) y municipio está** y, aparte, **en qué estado operativo se encuentra**.
>
> **Nada está comprado ni medido.** Cada modelo se marca como *verificado* (número de parte y especificación clave
> confirmados en la página del fabricante o de un distribuidor) o *por confirmar* (modelo razonable cuyo número de
> parte o hoja de datos hay que revisar al cotizar). Las especificaciones de diseño siguen en
> [`ficha-tecnica.md`](ficha-tecnica.md) y [`docs/20`](../docs/20-mecanismo-derrumbes.md).

## 1. Nomenclatura

### 1.1 Clave del componente

```
EE-MMM-TTTNN-SS-CCC-n
21-157-ESC01-SD-TUR-1
```

| Campo | Qué es | Valores | Ejemplo |
|---|---|---|---|
| `EE` | **Entidad federativa**, clave INEGI de 2 dígitos. Es la misma que abre la CCT de la SEP | `21` Puebla, `29` Tlaxcala | `21` |
| `MMM` | Municipio, clave INEGI de 3 dígitos (de `cve_loc` en `factores_escuelas.csv`) | `157` Tehuitzingo | `157` |
| `TTTNN` | Mecanismo: tipo y número, los mismos de `c_estacion` del contrato sin guiones | `ESC` agua, `LAD` ladera, `ATY` Atoyac (red anterior) | `ESC01` ↔ `EST-ESC-01` |
| `SS` | Subsistema | `SD` sondas de agua, `LD` ladera, `CO` colector, `CT` control, `CM` comunicación, `EN` energía, `ES` estructura | `SD` |
| `CCC` | Componente (tabla de la sección 2) | `TUR` turbiedad | `TUR` |
| `n` | Número de la pieza dentro del mecanismo | `1`, `2`… | `1` |

Reglas:

- La clave **no cambia** mientras la pieza siga en ese lugar. Si una sonda se reemplaza, la nueva conserva la clave
  y la vieja pasa a `RT` en el registro con su número de serie del fabricante.
- De la clave se recupera el mecanismo del contrato: `21-157-ESC01-…` → `EST-ESC-01`. No hace falta otra tabla.
- La etiqueta física de cada pieza lleva la clave en texto y en código QR.

### 1.2 Estado operativo

Va **después** de la clave, separado por un punto medio, y sí cambia: `21-157-ESC01-SD-TUR-1 · OP`.
Cada código corresponde a algo que el contrato o el simulador ya expresan, así que se puede asignar solo.

| Código | Estado | Cuándo | De dónde sale hoy |
|---|---|---|---|
| `PR` | Propuesto | El mecanismo no tiene la autorización que le toca (CEASPUE en cauce, CAPCEE en plantel) | `instalacion: "propuesta"` en `mecanismos.json` |
| `AU` | Autorizado | Autorizado pero aún sin montar | `instalacion: "autorizada"` |
| `OP` | Operando | Mide y envía con normalidad | `estado_dispositivo: "Activo"` y valor válido |
| `SS` | Sin señal | No hay enlace; los paquetes se guardan en la SD | `estado_dispositivo: "Sin senal"`; cola de la SD creciendo |
| `BB` | Batería baja | Carga bajo 20 %: ciclo de 30 min | Firmware: evento `bateria_baja` |
| `MT` | Mantenimiento | Calibración, limpieza, vaciado del contenedor | `estado_dispositivo: "Mantenimiento"` |
| `SG` | Pausa de seguridad | Solo colector: crecida (barrera arriba), contenedor lleno o atasco bloqueado | Fases del colector en `recolector.js` |
| `FN` | Falla: no responde | El sensor no entrega valor | Valor `null` en el paquete |
| `FR` | Falla: roto | El sensor devuelve el código de error | Valor `-999` en el paquete |
| `FC` | Falla: congelado | Repite el mismo valor ciclo tras ciclo | Aviso técnico `lectura_congelada` del motor |
| `RT` | Retirado | Fuera de servicio o reemplazado | Registro de mantenimiento |

El estado del **mecanismo** es el peor de sus componentes, en este orden: `F*` > `SG` > `SS` > `BB` > `MT` > `OP`.
`PR`, `AU` y `RT` describen el mecanismo completo, no cada pieza.

### 1.3 Prefijos de los mecanismos actuales

| Mecanismo (contrato) | Prefijo | Municipio | Localidad | Estado operativo hoy |
|---|---|---|---|---|
| EST-ESC-01 | `21-157-ESC01` | Tehuitzingo | San Vicente Ferrer | `PR` |
| EST-ESC-02 | `21-114-ESC02` | Puebla | Guadalupe Tlatelpa | `PR` |
| EST-ESC-03 | `21-134-ESC03` | San Matías Tlalancaleca | San Matías Tlalancaleca | `PR` |
| EST-ESC-04 | `21-034-ESC04` | Coronango | San Martín Zoquiapan | `PR` |
| EST-ESC-05 | `21-132-ESC05` | San Martín Texmelucan | San Cristóbal Tepatlaxco | `PR` |
| EST-LAD-01 | `21-089-LAD01` | Jopala | Tecuantla (los Reyes) | `PR` |
| EST-LAD-02 | `21-197-LAD02` | Xicotepec | El Tabacal | `PR` |
| EST-LAD-03 | `21-078-LAD03` | Huitzilan de Serdán | Xinachapan de Allende | `PR` |
| EST-LAD-04 | `21-109-LAD04` | Pahuatlán | San Pablito | `PR` |
| EST-LAD-05 | `21-202-LAD05` | Xochitlán de Vicente Suárez | Bonillagco | `PR` |

Las 5 estaciones del Atoyac (`EST-ATY-`) siguen en los fixtures. Las de Tlaxcala llevarían `29-` y las de Puebla `21-`:
por eso la entidad va primero.

## 2. Componentes y modelos

### 2.1 Estación de agua (`ESC`): sondas (`SD`)

| Código | Componente | Modelo propuesto | Por qué ese | Verificación |
|---|---|---|---|---|
| `PHS` | Sonda de pH | Atlas Scientific **ENV-40-pH** con circuito **EZO-pH** | 0–14, misma familia que las demás: un solo protocolo (I²C) | Por confirmar: un distribuidor la lista como grado laboratorio; revisar si hay versión industrial |
| `ODS` | Sonda de oxígeno disuelto | Atlas Scientific **ENV-50-DO** (industrial, galvánica) con circuito **EZO-DO** | Sonda galvánica: no necesita calentarse; trae PT-1000 propio | Verificado el número de parte; por confirmar la exactitud bajo 2 mg/L (el 59 % del histórico) |
| `CES` | Sonda de conductividad | Atlas Scientific **ENV-40-EC-K1.0** con circuito **EZO-EC** | 5–200 000 µS/cm: es exactamente el rango de diseño; no satura en la descarga industrial (14 700) | Verificado |
| `TES` | Sonda de temperatura | Atlas Scientific **PT-1000** (clase A) con circuito **EZO-RTD** | Compensa las demás sondas | Verificado el número de parte de la sonda |
| `TUR` | Sonda de turbiedad con limpiador | Pyxis Lab **LT-633** (parte 10002) | 0–4 000 NTU, limpiador automático, RS-485 Modbus y 4–20 mA. Es el único rango que coincide con el de diseño | Verificado el rango y las salidas. **Pide 24 V y 6 W**: ver 3.1 |
| `AIS` | Aislador de voltaje (×3: pH, OD, conductividad) | Aislador en línea de Atlas Scientific para circuitos EZO | Varias sondas en la misma agua se interfieren si no están aisladas (ficha técnica) | Por confirmar el número de parte |
| `TUB` | Tubo de protección | PVC hidráulico de 4" cédula 40, perforado | Protege las sondas de basura y golpes; fabricado | Sin modelo comercial |

### 2.2 Estación de agua (`ESC`): colector de residuos (`CO`)

| Código | Componente | Modelo propuesto | Por qué ese | Verificación |
|---|---|---|---|---|
| `BAR` | Barrera flotante | Flotadores de HDPE con faldón de malla, ≈ 17 m | Fabricada a la medida del cauce | Sin modelo comercial |
| `BAN` | Banda con paletas | Banda de PVC con paletas y rodillos de acero inoxidable | Fabricada | Sin modelo comercial |
| `MOT` | Motorreductor | **MY1016Z2**, 24 V y 250 W, con reducción | Común, barato y con refacciones | Por confirmar el par a la velocidad de la banda |
| `DRV` | Controlador del motor | **BTS7960** (módulo IBT-2) | Mide la corriente: así el firmware detecta el atasco y da reversa | Por confirmar |
| `CEL` | Báscula (×4 celdas) | 4 celdas de carga de 50 kg y conversor **HX711** | Pesa el contenedor de 240 L lleno (≈ 24 kg de diseño, con holgura) | Por confirmar |
| `CON` | Contenedor | Contenedor de basura de 240 L con ruedas | El de recolección municipal: se vacía con el mismo camión | Sin modelo único |
| `CAM` | Cámara que cuenta y clasifica | Seeed Studio **XIAO ESP32S3 Sense** | Cámara y Wi-Fi en una placa pequeña; la foto se clasifica con Gemini, como en la app | Verificado. El sensor de imagen cambia según el lote (OV3660 u OV5640) |
| `NIV` | Nivel del río | MaxBotix **MB7389** (HRXL-MaxSonar-WRMT) | Ultrasónico IP67, 0.3–5 m: cubre el tirante y la crecida (> 65 cm) | Verificado |
| `MCU` | Controlador y módem del colector | LILYGO **T-SIM7080G-S3** | La misma placa que la estación: una sola refacción | Verificado |
| `PAN` | Panel solar | Monocristalino de 100 W y 12 V | El de diseño (`recolector.js`) | Sin marca fija |
| `BAT` | Batería | LiFePO4 de 12.8 V y 20 Ah (256 Wh) con BMS | La de diseño | Sin marca fija |
| `REG` | Regulador solar | Victron Energy **SmartSolar MPPT 75/10** | Admite LiFePO4 y baterías de 12 V; se configura por Bluetooth | Verificado |

### 2.3 Estación de ladera (`LAD`): sensores de ladera (`LD`)

| Código | Componente | Modelo propuesto | Por qué ese | Verificación |
|---|---|---|---|---|
| `PLU` | Pluviómetro de balancín | Davis Instruments **6466M** (AeroCone métrico, base para poste) | 0.2 mm por basculada, igual que el contrato y el simulador; contacto seco que cuenta por interrupción; cable de 12 m | Verificado |
| `HUM` | Humedad del suelo | METER Group **TEROS 10** | Capacitivo, 0–64 % de humedad volumétrica en suelo mineral, salida analógica. Exactitud ±3 % sin calibrar | Verificado |
| `INC` | Inclinómetro | Murata **SCL3300-D01** en caja IP67 | Resolución de 0.0055°, más fina que el ruido de diseño (±0.05°) | Verificado |
| `EST` | Estaca del inclinómetro | Tubo galvanizado de 1½" y 1.6 m, 0.6 m anclados en concreto | Fabricada | Sin modelo comercial |

### 2.4 Común a las dos estaciones: control (`CT`), comunicación (`CM`), energía (`EN`) y estructura (`ES`)

| Código | Componente | Modelo propuesto | Por qué ese | Verificación |
|---|---|---|---|---|
| `CT-MCU` | Controlador | LILYGO **T-SIM7080G-S3**: ESP32-S3, módem SIM7080G, gestor de energía, entrada solar de 4.4–6 V y portapila 18650 | Junta controlador, módem y cargador solar en una placa | Verificado |
| `CT-RTC` | Reloj de tiempo real | **DS3231SN** con pila CR2032 | El de la ficha técnica: deriva de ±2 ppm | Por confirmar |
| `CT-MSD` | Memoria | Tarjeta microSD industrial de 8 GB (SanDisk Industrial) | Aguanta calor y escrituras constantes | Por confirmar el número de parte |
| `CT-WDT` | Perro guardián | Texas Instruments **TPL5010** | Reinicia el controlador si se cuelga; consume nanoamperes | Por confirmar |
| `CT-485` | Transceptor RS-485 (solo `ESC`, para la turbiedad) | **MAX3485** (3.3 V) | La sonda Pyxis habla Modbus RTU por RS-485 | Por confirmar |
| `CT-B24` | Elevador a 24 V (solo `ESC`, para la turbiedad) | Convertidor elevador **XL6009** | La sonda Pyxis pide 24 V | Por confirmar |
| `CM-MOD` | Módem | SIMCom **SIM7080G**, integrado en `CT-MCU` (lleva la clave de la placa) | LTE-M y NB-IoT de bajo consumo | Verificado. **No tiene 4G de respaldo** |
| `CM-ANT` | Antena celular | Antena LTE de banda ancha (698–2 700 MHz), SMA, con 3 m de cable | Sale del gabinete al punto más alto del mástil | Sin marca fija |
| `CM-SIM` | SIM de datos | SIM IoT de un operador con LTE-M en el sitio | Ver 3.2 | Por medir la cobertura en cada sitio |
| `EN-PAN` | Panel solar | Monocristalino de 6 V: **10 W** en la estación de agua, 5 W en la de ladera | Recupera en un día de sol lo de varios nublados (sección 3.1) | Sin marca fija |
| `EN-CAR` | Cargador solar (solo `ESC`) | Cargador MPPT de una celda de litio, **CN3791** | La placa carga a lo más 500 mA: el panel de 10 W necesita su propio cargador | Por confirmar |
| `EN-BAT` | Baterías | Samsung **INR18650-30Q** (3 000 mAh): **8** en la estación de agua (dos portapilas de 4 en paralelo, ≈ 89 Wh), 2 en la de ladera (≈ 22 Wh) | Ver 3.1 | Por confirmar |
| `ES-GAB` | Gabinete | Policarbonato IP66 de ≈ 300 × 200 × 150 mm con puerta abisagrada | El de la figura | Sin marca fija |
| `ES-MAS` | Mástil | Tubo galvanizado de 2" y 3 m, anclado en concreto | Lleva el panel y la antena | Sin modelo comercial |

## 3. Lo que los modelos reales cambian de la ficha técnica

1. **La turbiedad cambió el presupuesto de energía (resuelto subiendo panel y baterías).** La Pyxis LT-633 pide 24 V y
   6 W; con el elevador, ≈ 7 W durante los ≈ 20 s de cada medición. Medido en el simulador: el consumo de la estación de
   agua sube de 1.4 a **5.0 Wh/día** y, con las dos baterías de antes, la autonomía sin sol cae a 4 días. Con **8 celdas
   (89 Wh) y panel de 10 W** vuelve a **15.9 días** sin sol y termina 4 días nublados al 98 %. La de ladera no lleva
   esa sonda: 0.9 Wh/día, 22 Wh y 5 W le dan 21 días. Los dos números salen de `prueba.js` (pruebas 6 y 18).
2. **El módem no tiene 4G de respaldo.** El SIM7080G solo usa LTE-M y NB-IoT. Antes de instalar hay que medir en cada
   sitio que el operador tenga LTE-M; la ficha decía "LTE-M/4G".
3. **La placa trae portapila para una sola 18650 y carga a 500 mA.** En la estación de agua las 8 celdas van en dos
   portapilas de 4 en paralelo, con protección, y las carga el `EN-CAR`, no la placa.
4. **La humedad del suelo trae ±3 % de error sin calibrar.** Contra un umbral de 45 % eso es mucho. Lo corrige
   calibrar el TEROS 10 con el suelo de cada ladera, que es el análisis de suelo propuesto.
5. **El inclinómetro sobra en resolución.** El SCL3300 resuelve 0.0055°. Los umbrales de 0.5° y 2° quedan holgados:
   lo que domina es el anclaje de la estaca, no el sensor.

## 4. Ejemplo: la estación de agua EST-ESC-01 etiquetada completa

| Clave | Pieza | Estado |
|---|---|---|
| `21-157-ESC01-SD-PHS-1` | Sonda de pH | `PR` |
| `21-157-ESC01-SD-ODS-1` | Sonda de oxígeno disuelto | `PR` |
| `21-157-ESC01-SD-CES-1` | Sonda de conductividad | `PR` |
| `21-157-ESC01-SD-TES-1` | Sonda de temperatura | `PR` |
| `21-157-ESC01-SD-TUR-1` | Sonda de turbiedad | `PR` |
| `21-157-ESC01-SD-AIS-1` … `-3` | Aisladores | `PR` |
| `21-157-ESC01-CT-MCU-1` | Controlador y módem | `PR` |
| `21-157-ESC01-CO-NIV-1` | Nivel del río del colector | `PR` |
| `21-157-ESC01-CO-MCU-1` | Controlador del colector | `PR` |
| … | (una fila por pieza de 2.1, 2.2 y 2.4) | |

Una vez instalada, si la sonda de turbiedad empieza a mandar `-999`, su etiqueta en el registro pasa a
`21-157-ESC01-SD-TUR-1 · FR` y el mecanismo `21-157-ESC01` queda en `FR` hasta que se repare.

## 5. Fuentes de los modelos verificados

- Atlas Scientific ENV-40-EC-K1.0: [DigiKey](https://www.digikey.ca/en/products/detail/atlas-scientific/ENV-40-EC-K1-0/16002997); ENV-40-pH: [DigiKey](https://www.digikey.ca/en/products/detail/atlas-scientific/ENV-40-PH/16003032)
- Atlas Scientific ENV-50-DO: [Atlas Scientific](https://atlas-scientific.com/probes/industrial-dissolved-oxygen-probe/); EZO-DO: [Atlas Scientific](https://atlas-scientific.com/circuits/ezo-dissolved-oxygen-circuit/)
- Atlas Scientific PT-1000: [DigiKey](https://www.digikey.ca/en/products/detail/atlas-scientific/PT-1000/16003086)
- Pyxis LT-63X (LT-633): [hoja de datos](https://pyxis-lab.com/wp-content/uploads/2024/07/LT-63X-Data-Sheet.pdf), [Instrumart](https://www.instrumart.com/products/135624/pyxis-lt-63x-series-self-wiping-submersible-turbidity-sensors)
- LILYGO T-SIM7080G-S3: [wiki de LILYGO](https://wiki.lilygo.cc/products/t-sim-series/t-sim7080-s3/), [repositorio](https://www.Github.com/Xinyuan-LilyGO/LilyGo-T-SIM7080G)
- Davis 6466M: [Davis Instruments](https://davisinstruments.com/products/aerocone-rain-collector-with-vantage-pro2-mounting-base), [hoja de Weather Shop](https://www.weathershop.co.uk/productpdf/download/file/id/3841/name/Davis_Metric_AeroCone_Rain_Collector_with_Pro2_Pole_Mount_Base_6466M.pdf/)
- METER TEROS 10: [especificaciones](https://metergroup.com/products/teros-10/teros-10-tech-specs/)
- Murata SCL3300: [hoja de datos](https://www.murata.com/~/media/webrenewal/products/sensor/pdf/datasheet/datasheet_scl3300-d01.pdf)
- MaxBotix MB7389: [MaxBotix](https://maxbotix.com/products/mb7389)
- Victron SmartSolar MPPT 75/10: [manual, especificaciones](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/technical-specifications.html)
- Seeed XIAO ESP32S3 Sense: [wiki de Seeed](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started)

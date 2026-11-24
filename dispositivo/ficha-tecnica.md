# Ficha técnica · estación centinela (M4)

Qué es el dispositivo, cómo está compuesto y qué hace su firmware. Cada número está
marcado como **medido en el simulador**, **tomado de los datos reales** o **supuesto de
diseño**. La diferencia importa: la estación se presenta simulada, no instalada.

## Alcance y honestidad

- El MVP es un **simulador web** (`dispositivo/simulador/`) que ejecuta la misma lógica que
  correría en el microcontrolador y emite paquetes que cumplen el contrato v1.0.
- **No hay hardware comprado ni medido.** Lo que depende de una hoja de datos o de una
  medición en banco está en la sección "Pendiente de validar".
- El agua que mide el simulador sale de la **banda histórica real** de cada sitio
  (`contrato/fixtures/linea_base.json`). Los incidentes se inyectan con las firmas de los
  escenarios del contrato.

## Los cuatro bloques

| # | Bloque | Componente de diseño | Función |
|---|---|---|---|
| ① | **Sondas** | OD, pH, conductividad (K = 1.0), temperatura, turbiedad óptica con limpiador. Grado de campo. Circuitos de interfaz **aislados entre sí**. | Mide cinco señales cada 15 minutos. |
| ② | **Controlador** | ESP32, reloj en tiempo real (DS3231), tarjeta microSD, perro guardián. | Duerme, mide, empaqueta, guarda y envía. |
| ③ | **Comunicación** | Módem celular LTE-M/4G con `POST /lecturas` por HTTPS. LoRa queda como alternativa para barrancas sin cobertura. | Entrega el JSON del contrato sin traducción. |
| ④ | **Energía** | Panel solar de 5 W y dos baterías 18650 (≈22 Wh). | Autonomía sin toma de corriente. |

El aislamiento entre sondas no es un lujo: varias sondas en la misma agua conductiva se
interfieren y dan lecturas erráticas.

## Rangos de diseño frente a los datos reales

| Parámetro | Rango histórico en el piloto | Rango de la sonda de diseño | Por qué |
|---|---|---|---|
| OD | 0.5 – 6.8 mg/L | 0 – 20 mg/L, resolución 0.01 | El 59 % de lo histórico está bajo 2 mg/L: importa la resolución fina. |
| pH | 4.4 – 10.0 | 0 – 14 | Cubre lo histórico y la descarga industrial (hasta 9.5). |
| Conductividad | 320 – 3 800 µS/cm | 5 – 200 000 µS/cm | El escenario industrial llega a 14 700. Una sonda de rango corto saturaría justo en el evento. |
| Temperatura | 12 – 29 °C | −5 – 50 °C | Compensa las demás sondas. |
| Turbiedad | 0.7 – 8 610 NTU | 0 – **4 000 NTU** | **Satura** en lluvia fuerte; el simulador lo marca. Es un límite declarado, no un defecto escondido. |

SDT y SST no se miden: se estiman en el backend desde conductividad y turbiedad
(correlaciones 0.971 y 0.947 en los datos de la Etapa 1).

## Ciclo del firmware

Una lectura cada 15 minutos, alineada al reloj de pared (:00, :15, :30, :45), de modo que la
medición termine justo en la marca.

| Fase | Duración simulada | Consumo (supuesto) |
|---|---|---|
| Sueño | resto del ciclo | 8 mW |
| Calentamiento de sondas | 15 s (la más lenta, el OD) | 1 020 mW |
| Medición (mediana de 5 lecturas por sonda) | 5 s | 1 020 mW |
| Empaquetado y escritura en la SD | 1 s | 300 mW |
| Enlace con la red | 8 s | 1 800 mW |
| Envío | 4 s | 2 400 mW |

### Reglas que el firmware respeta

1. **Escribe en la SD antes de enviar y borra solo tras el ACK.** Si cae el enlace o se
   reinicia el equipo a media transmisión, no se pierde ni se duplica nada.
2. **Los paquetes viejos conservan su hora original** al reenviarse, en orden cronológico.
3. **No corrige ni recorta.** Manda el valor crudo, como exige `lectura.schema.json`. Una
   sonda que no responde se reporta `null`; una sonda rota que devuelve `-999` se manda tal
   cual. Decidir qué es una falla le toca al backend (I10): el firmware nunca emite alertas.
4. **Muestreo adaptativo.** Ante un cambio brusco (conductividad ±40 %, pH ±0.7, OD ±50 %,
   turbiedad ×2, temperatura ±2 °C) pasa a ciclos de 5 minutos y vuelve a 15 tras tres ciclos
   estables. No altera el contrato: solo llegan más paquetes.
5. **Reintentos con espera exponencial** (20 s, 40 s) y, tras tres fallos, duerme con la cola
   intacta.
6. **Ahorro por batería.** Bajo 20 %: ciclo de 30 minutos. Bajo 8 %: se apaga hasta
   recuperar 15 % de carga solar; los ciclos perdidos quedan como hueco, no como dato falso.

## Fallas y deriva que se simulan

| Modo | Cómo se ve en el paquete |
|---|---|
| Sonda congelada | el mismo valor ciclo tras ciclo |
| Sonda sin respuesta | `null` |
| Sonda rota | `-999` |
| Sesgo de fábrica | cada sonda sale con un error propio dentro de su tolerancia |
| Deriva | pH y OD +0.01 por día, conductividad +0.05 % por día desde la última calibración |
| Ensuciamiento | turbiedad +1.5 NTU por día desde la última limpieza |
| Saturación | turbiedad clavada en 4 000 NTU |
| Corte de red | la cola crece en la SD y se vacía al volver el enlace |

Este es el costo recurrente real del sistema: **calibrar y limpiar**. La deriva y el
ensuciamiento están en el modelo (`modelo.js`); la vista ya no los dispara, para no cargarla (D20).

## Contrato

El paquete es exactamente `lectura.schema.json` v1.0:

```json
{ "version": "1.0", "c_estacion": "EST-ATY-01",
  "fecha_hora": "2026-11-23T10:00:00-06:00",
  "lecturas": [ {"c_parametro": "COND", "valor": 9760.3}, ... ],
  "bateria": 87, "senal": -66 }
```

Los paquetes del simulador validan con cero errores contra el validador del contrato y el
servidor mock los acepta con `202`.

## Resultados medidos en el simulador

Con `node dispositivo/simulador/prueba.js` (todos los datos de entrada, de los fixtures):

| Propiedad | Resultado |
|---|---|
| Día normal, 5 estaciones | 96 paquetes cada una, SD vacía, 0 duplicados |
| Lecturas normales dentro del rango histórico real | 480 de 480 |
| Descarga industrial a las 10:00 | la conductividad llega a más de 10 000 µS/cm; pasa a ciclo de 5 min y regresa |
| Corte de red de 4 h | 0 paquetes perdidos, 0 duplicados, horas originales, orden cronológico |
| Sonda rota y sonda muda | `-999` y `null` respectivamente, sin alertas del firmware |
| Turbiedad en lluvia fuerte | satura en 4 000 NTU |
| Consumo medio | **≈ 1.4 Wh/día** |
| Autonomía sin sol desde 90 % | **≈ 14 días** |

> **Corrección.** En la conversación de diseño se estimó a mano 1.1 Wh/día y 19 días. El
> modelo, con las duraciones y consumos de arriba, da 1.4 Wh/día y 14 días. Manda el modelo.

## Pendiente de validar

Todo lo siguiente es **supuesto de diseño** hasta que alguien lo mida o lo cotice:

- **Especificaciones de las sondas** (sesgo, ruido, deriva, tiempos de estabilización).
  Verificar contra la hoja de datos del modelo elegido, sobre todo la exactitud del OD por
  debajo de 2 mg/L.
- **Consumo por fase.** Medir en banco; el módem celular tiene picos de hasta 2 A.
- **Cobertura celular por sitio.** Las intensidades de señal del simulador (−66 a −84 dBm)
  están en el rango que traen los fixtures, no medidas en campo.
- **Costos.** No hay cotización. Corresponde a M10 y debe incluir calibración y reposición
  de sondas.
- **Carcasa, montaje y antivandalismo.** Sin diseñar.

## Cómo correrlo

```powershell
python -m http.server 8000
```

Y abrir `http://127.0.0.1:8000/dispositivo/simulador/`. Para que cada lote llegue al
backend, arrancar también `python contrato/servidor_mock.py` y marcar la casilla del panel
izquierdo. Ver [`README.md`](README.md).

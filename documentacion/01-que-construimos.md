# Qué estamos construyendo

## El problema

La cuenca del Alto Atoyac, entre Puebla y Tlaxcala, concentra descargas de aguas
residuales municipales e industriales que han degradado el río, sus afluentes y sus
barrancas. Los números del propio monitoreo oficial lo dicen sin matices: de los 219
sitios de medición del área de estudio, **176 están en semáforo rojo**, y el oxígeno
disuelto mediano es de **1.38 mg/L**, un 19 % de saturación. Un río sano trae entre 7 y
9 mg/L.

Pero el problema que este proyecto atiende no es la contaminación en sí, que es un
problema de infraestructura y de aplicación de la ley. Es un problema de **información**,
y tiene tres caras:

1. **Está dispersa.** Las mediciones, la geografía del río, las descargas registradas y
   la actividad económica cercana viven en fuentes distintas, con formatos y claves
   distintas.
2. **Es esporádica.** Entre un muestreo y el siguiente del mismo sitio pasan **49 días de
   mediana, y hasta 3 294 días** en el peor caso. Un evento de contaminación puede
   ocurrir y terminar sin que quede registro.
3. **No se traduce en decisiones.** Los datos existen pero no responden rápido las cuatro
   preguntas que importan: dónde está el problema, qué tan grave es, qué lo causa y qué
   se puede hacer.

## La solución

Un sistema de cuatro piezas que convierte datos en decisiones:

1. **Línea base histórica** de cada punto del río, construida con 13 años de monitoreo
   oficial. Es lo que permite distinguir "este río está mal" de "aquí acaba de pasar
   algo".
2. **Estaciones de monitoreo continuo** con sensores de bajo costo en los puntos más
   críticos, que reportan cada pocos minutos en lugar de cada cincuenta días.
3. **Plataforma central** que recibe las lecturas, las compara contra la línea base del
   propio sitio, emite alertas, estima hacia dónde y cuándo viaja la contaminación, y
   sugiere la fuente probable y la medida aplicable.
4. **App de participación ciudadana** para que la gente que vive junto al río aporte
   evidencia de campo y reciba información útil sobre el agua que tiene enfrente.

### La idea que lo distingue

En un río que ya está permanentemente fuera de norma, **una alarma por umbral fijo está
encendida desde 2012**. No informa nada. Lo único que detecta un evento nuevo es la
desviación respecto de la historia del propio punto.

Por eso la línea base no es un dato de contexto: es el mecanismo de detección. Y por eso
la Etapa 1 de datos no fue un trámite previo, fue la construcción del instrumento.

Hay una prueba cuantificada de esto en el repositorio. El servidor mock trae un evaluador
que usa la regla ingenua (salió de la banda, tres lecturas seguidas) y produce **31
alertas en un día sin ningún incidente, contra 35 en un día con una descarga
industrial**. No discrimina. Ese número es la vara que el motor real tiene que superar.

## Qué existe hoy y qué está planeado

Esta tabla es la más importante de este documento. La distinción entre lo construido y lo
planeado es lo primero que se pierde al documentar y lo primero que un jurado detecta.

| Pieza | Estado | Dónde está |
|---|---|---|
| Conjunto de datos del Alto Atoyac: 219 sitios, 145 703 resultados, 2012–2025 | **Construido y verificado** | `datos/procesados/` |
| Línea base por sitio y parámetro | **Construido**: 4 385 pares con 12 o más mediciones | `datos/procesados/analisis/linea_base_sitio_parametro.csv` |
| Escalas de calidad de CONAGUA y límites de la NOM-001 | **Construido** | `datos/procesados/umbral.csv` |
| Red hidrográfica del INEGI, 10 subcuencas | **Descargada y extraída**, sin procesar | `datos/geo/` |
| Contrato de datos v1.0: 7 esquemas | **Construido** | `contrato/esquemas/` |
| Fixtures con 5 estaciones reales y 5 escenarios de un día | **Construido** | `contrato/fixtures/` |
| Servidor mock con evaluador stub | **Construido y funcionando** | `contrato/servidor_mock.py` |
| Orden aguas arriba → aguas abajo de los sitios | **Pendiente**, es el camino crítico | módulo M1 |
| Motor de reglas real | **Pendiente** | módulo M2 |
| Modelo de propagación | **Pendiente** | módulo M3 |
| Dispositivo físico y su simulación | **Pendiente** | módulo M4 |
| Backend y base de datos | **Pendiente** | módulo M5 |
| Mapa público, panel de autoridad, app ciudadana | **Pendiente** | módulos M6, M7, M8 |
| Estimación de costos y propuesta de implementación | **Pendiente** | módulo M10 |

El reparto de módulos y el criterio de terminado de cada uno están en
[11-metodologia-modulos.md](11-metodologia-modulos.md).

## Alcance declarado

- **Geográfico:** cuenca del Alto Atoyac en Puebla, más los sitios de Tlaxcala que están
  aguas arriba y afectan a Puebla. El Zahuapan tlaxcalteca desagua en el Atoyac, así que
  excluirlo dejaría fuera parte de la causa. Se incluyen y quedan marcados por `estado`.
- **Temático:** agua superficial. El agua subterránea queda fuera.
- **Temporal:** 2012 a 2025, que es lo que publica el monitoreo oficial.
- **Naturaleza del prototipo:** demostrativo. El dispositivo se presenta simulado, no
  instalado en campo. Esto se dice explícitamente en el pitch; es una decisión, no una
  carencia que se esconda.

## Lo que este sistema no hace

Conviene tenerlo escrito, porque es lo que evita prometer de más:

- **No pronostica en el tiempo.** La cadencia del monitoreo oficial no lo permite. Se
  pronostica en el espacio, donde la física da una base.
- **No sustituye al laboratorio.** Los sensores miden cinco parámetros; la toxicidad, los
  coliformes y la DBO siguen requiriendo análisis. Lo que sí hace es estimar dos
  parámetros de laboratorio desde sensores baratos, con una correlación medida.
- **No determina responsables.** Señala una fuente probable con un puntaje y su
  evidencia. Quien sanciona es la autoridad.
- **No es un sistema de monitoreo oficial.** Es un complemento al monitoreo de CONAGUA,
  no un reemplazo.

# Registro de cambios

Bitácora de cambios relevantes. **Es de solo añadir: no se borran entradas ni se reescribe
el pasado.** Si una decisión se revierte, se anota la reversión como entrada nueva.

Orden inverso: lo más reciente arriba.

El criterio de qué cuenta como relevante está en
[`05-protocolo-de-cambios.md`](05-protocolo-de-cambios.md).

## Formato

```markdown
## AAAA-MM-DD · Título corto

**Qué cambió.** Una o dos frases.
**Por qué.** La razón, con el número si lo hay.
**Qué arrastró.** Archivos y documentos que hubo que actualizar.
**Impacto en otros módulos.** Qué tiene que saber el resto del equipo, o "ninguno".
```

---

## 2026-11-24 · Módulo B: «Qué hacer», protocolos de respuesta por tipo de incidente

**Qué cambió.** `contrato/fixtures/protocolos.json` (nuevo, provisional): 11 protocolos (4 de agua por fuente probable, 2
de ladera por nivel, 5 de reportes por tipo), cada acción con plazo, responsable y fuente (NOM-127, NOM-001, Ley General
de Protección Civil o «guía del equipo, por validar»). Ninguno recomienda verter químicos. El panel (`Protocolo.jsx`) lo
muestra en el expediente de cada alerta y en el detalle de cada reporte (escuelas a menos de 1 km). Las acciones que
dependen del agua de la escuela se filtran si su fuente se conoce; si no, la primera acción es confirmarla y las ramas se
muestran como condición. Casillas para marcar lo hecho, solo en pantalla.
**Por qué.** Petición del usuario: recomendar qué hacer según el incidente. La fuente de agua falta en todas las escuelas.
**Qué arrastró.** `LEEME.md` de fixtures, `copiar-datos.mjs`, `datos.js`, `Expediente.jsx`, `Reportes.jsx`, `estilos.css`.
**Impacto en otros módulos.** Todos: el contenido de `protocolos.json` debe revisarlo alguien antes de presentarlo. C:
`Reportes.jsx` suma la caja «Qué hacer».

---

## 2026-11-24 · M4 y mapa: deslave a lo largo del relieve, inundación, sirena y pulso de radar

**Qué cambió.** Deslave: cicatriz y lámina de lodo (mallas que siguen el relieve) que avanzan por toda la ladera, de la escuela al fondo, con 150 bloques que ruedan al arroyo; con la tierra en el cauce el agua sube y se tiende sobre la explanada. Sirena con luz en el techo de la escuela que enciende la plataforma: ámbar con una alerta Preventiva, roja con ondas y el texto «Alerta: posible deslave» con una Crítica. En el mapa 2D, una alerta abierta emite ondas rojas desde el círculo de la estación, como el pulso de un radar (también con «reducir animaciones»).
**Por qué.** Pedido del usuario: que se vea cómo baja la tierra y se inunda, que las alarmas se noten en el mapa y que se avise a la comunidad.
**Qué arrastró.** `escena.js`, `index.html` del simulador y del mapa (versiones), `mapa/estilos.css`. Verificado en Chrome sin ventana contra `servidor_mock.py --motor real`. Sin el mock la sirena nunca se enciende (las alertas vienen de la plataforma).
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · Módulo B: calor de reportes alejado, pines de cerca

**Qué cambió.** `MapaReportes.jsx` agrega una capa `heatmap` con un punto por foco, pesado por sus reportes. Por
debajo del zoom 11 se ve el calor y los pines se ocultan (clase `sin-pines`, con `visibility` porque MapLibre fija la
opacidad del marcador en línea); al acercarse el calor se desvanece y aparecen los pines. El botón «Mapa de calor»
sigue prendiendo la huella sobre el río.
**Por qué.** Petición del usuario. Verificado por código con los reportes de Vercel (zoom 9: calor y sin pines; zoom
13: pines y sin calor); no se vio dibujado porque el panel del navegador estaba oculto.
**Qué arrastró.** `MapaReportes.jsx`, `estilos.css`.
**Impacto en otros módulos.** C: cambió su mapa de reportes en el panel.

---

## 2026-11-24 · Módulo B: la vista del panel vive en la URL

**Qué cambió.** `panel/src/lib/ruta.js` (nuevo) guarda sección, vista, escuela abierta y página de reportes en el hash
(`#/alertas`, `#/alertas/avisos`, `#/escuelas/<cct>`, `#/autorizaciones`, `#/reportes`, `#/reportes/estadisticas`).
Atrás y Adelante del navegador funcionan, una recarga conserva la vista y un enlace abre una escuela. Elegir otra
escuela dentro de la lista reemplaza la entrada del historial en lugar de sumar una.
**Por qué.** Petición del usuario: al cambiar de pestaña no se podía regresar a la anterior.
**Qué arrastró.** `App.jsx`.
**Impacto en otros módulos.** Ninguno. Se usa el hash para no depender de reescrituras en Vercel.

---

## 2026-11-24 · M4: deslave gráfico, lluvia que oscurece y rótulos al pasar el cursor

**Qué cambió.** Deslave: cicatriz en la ladera, hasta 64 bloques que ruedan al arroyo, polvo y lodo, en tiempo real. La lluvia oscurece más el día (sol, cielo, nubes). Tubo de descarga al inicio del tramo, con la pluma corriendo río abajo. En las dos vistas generales los rótulos salen al pasar el cursor sobre un punto; fijos: Escuela y Cauce (ladera), Corriente (río) y los que estén en alarma.
**Por qué.** Pedido del usuario: el deslave no se veía, la lluvia no oscurecía y las etiquetas se encimaban.
**Qué arrastró.** `escena.js`, `estilos.css`, `index.html` (versiones). Verificado en Chrome sin ventana (río con descarga y lluvia, ladera con deslave); el hover no se probó con cursor real ni en pantalla táctil.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M5: aviso por correo en cada paso del reporte

**Qué cambió.** Además del recibo al crear, `PATCH /reportes/<c_reporte>` manda un correo cada vez que el reporte pasa
a otro estado: Validado, En atención, Cerrado o Descartado (`correo.avisar_estado`, textos nuevos en `correo.py`). Si
el estado no cambia, no se repite. La app ciudadana dice «te avisamos cada vez que avance» y sus términos ya no
prometen «solo esos dos correos».
**Por qué.** Petición del usuario: las personas no se enteraban de los pasos intermedios. `backend/prueba.py` (prueba 8,
con SMTP falso) cubre cada paso: todo pasa.
**Qué arrastró.** `backend/correo.py`, `backend/app.py`, `backend/prueba.py`, `backend/README.md`,
`ciudadano/src/components/FormularioReporte.jsx`, `ciudadano/src/lib/terminos.js` (solo texto).
**Impacto en otros módulos.** C: cambió el texto del formulario y de los términos de la app ciudadana.

---

## 2026-11-24 · M5 y módulo B: distancia al cauce con la red del INEGI y agua visible en el mapa de reportes

**Qué cambió.** `backend/asignacion.py` mide la distancia al cauce también contra `datos/procesados/mapa/red_hidrografica.geojson`
(INEGI, orden >= 4); el sitio aguas abajo sigue saliendo solo de `red_asignacion.json`. `vercel.json` incluye ese archivo en
la función. El panel (`lib/cauce.js`, nuevo) calcula la distancia de los reportes que llegaron sin ella y ya no dice "sin
cauce" cuando solo falta el punto de monitoreo ("Sin punto de monitoreo aguas abajo · a 12 m del cauce"). El mapa de
reportes dibuja la red del INEGI en el azul del agua y oscurece el agua de la base.
**Por qué.** 5 de 8 reportes en Vercel decían "sin cauce" estando a 5–50 m de un río: la red de asignación solo trae
tramos con un sitio CONAGUA a menos de 20 km. `backend/prueba.py`: todo pasa.
**Qué arrastró.** `asignacion.py`, `vercel.json`, `cauce.js`, `Reportes.jsx`, `DashboardReportes.jsx`, `MapaReportes.jsx`.
**Impacto en otros módulos.** C: `contrato/prioridad_huella.py` usa la misma red recortada y da `distancia_al_cauce_m`
nula fuera de ella; el panel lo compensa al mostrar, conviene corregirlo en el cálculo.

---

## 2026-11-24 · M4: la descarga entra al inicio del río y la pluma corre río abajo

**Qué cambió.** El tubo de descarga pasa al inicio del tramo y el agua solo se tiñe río abajo de él: un frente avanza con la corriente dibujada y, al terminar, una cola lo persigue. El chorro es de gotas y lluvia, clima y descarga entran y salen suavizados en tiempo real. `Agua.valor` acepta una lista de eventos a ignorar para separar la turbiedad de la descarga.
**Por qué.** Pedido del usuario: el color cambiaba en todo el río desde el inicio aunque lo vertido entra después, y el chorro no se veía fluido.
**Qué arrastró.** `escena.js`, `modelo.js`, `index.html` (versiones). Las lecturas de las sondas no cambian.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: los botones de prueba inician y detienen la simulación

**Qué cambió.** Cada botón de prueba del simulador inicia la simulación y se pone azul; al pulsarlo de nuevo la detiene y recupera su color. En el agua la prueba sale con la rampa de 30 min; en la ladera la lluvia se corta y lo acumulado (humedad, inclinación) se queda (`detiene` y `enCurso` en `modelo.js`).
**Por qué.** Pedido del usuario: el botón era confuso porque solo iniciaba.
**Qué arrastró.** `modelo.js`, `ui.js`, `estilos.css`, `index.html` (versiones).

---

## 2026-11-24 · Módulo B: cifras de Escuelas como tarjetas separadas

**Qué cambió.** Las tres cifras de la pestaña Escuelas son tarjetas separadas, con 16 px entre ellas y hacia el mapa,
la misma separación que entre el mapa y la lista. Las de Alertas y Autorizaciones no cambian.
**Por qué.** Petición del usuario.
**Qué arrastró.** `estilos.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: escuela grande, modelos por pieza y pruebas visibles en el simulador

**Qué cambió.** Ladera: escuela a 1.7×, textos más cortos y, en las vistas de cerca (río y ladera), el modelo comercial de cada
pieza (`catalogo-componentes.md`). Las pruebas se ven en la figura: lluvia fuerte oscurece el día y hace llover; la descarga
industrial vira el agua a ocre, acelera su flujo dibujado y vierte por un tubo en la orilla; la orgánica la vira a verde oscuro;
el deslave baja una lengua de lodo desde la estaca y vuelve marrón el arroyo.
**Por qué.** Pedido del usuario: que cada prueba se note en la figura y que cada componente diga qué es.
**Qué arrastró.** `escena.js`, `estilos.css`, `index.html` (versiones). El aumento de flujo con la descarga es solo del dibujo: el modelo no lo cambia.

---

## 2026-11-24 · Módulo B: escuelas con mapa y lista lado a lado

**Qué cambió.** La pestaña Escuelas quita la cifra de alumnos (la matrícula no viene en los datos), pone el mapa y la
lista lado a lado con la misma altura y la ficha abajo a todo el ancho. En teléfono se apilan.
**Por qué.** Petición del usuario.
**Qué arrastró.** `Escuelas.jsx`, `estilos.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · Módulo B: alertas de ladera, 10 mecanismos y escuelas del Alto Atoyac

**Qué cambió.** El panel pide lecturas de las 15 estaciones (las 5 del Atoyac y los 10 mecanismos), no solo de las 5.
Las alertas de ladera (LLUVIA, HUM_SUELO, INCL) se muestran contra los umbrales del motor, leídos de
`umbrales_lluvia.json`, `suelo_laderas.json` y `lluvia_sitios.json` con la lógica de `cargar_umbrales_ladera`: cifras
de valor, umbral alcanzado y siguiente; serie de la lluvia acumulada en la ventana de la alerta (24 o 72 h) con los
umbrales como líneas. Una escuela tiene los mecanismos que la listan en `escuelas_protegidas` o su `c_estacion` (43, no
8); un mecanismo de ladera queda activo con la autorización de CAPCEE, uno de agua con la de CEASPUE. El filtro de
escuelas pasa de la cuenca RH18A a las cuatro subcuencas del Alto Atoyac (`SUBCUENCAS_ALTO_ATOYAC`): 205 de 503 (la
RH18A daba 216, con 11 en Nexapa, Tehuitzingo, Balcón del Diablo y Acatlán).
**Por qué.** Datos nuevos del módulo A (`d1cb636`: 503 escuelas, 10 mecanismos) y reglas de derrumbe de M2 (`188dfeb`).
Probado con `deslave` en un backend aparte: 4 alertas de `EST-LAD-01` con sus umbrales y 2 escuelas afectadas.
**Qué arrastró.** `App.jsx`, `contexto.js`, `datos.js`, `etiquetas.js`, `copiar-datos.mjs`, `Serie.jsx`, `Miniaturas.jsx`,
`Expediente.jsx`, `FichaEscuela.jsx`, `Escuelas.jsx`, `Autorizaciones.jsx`.
**Impacto en otros módulos.** El backend regresa 50 veredictos por estación: una alerta vieja puede quedar fuera de la
serie. Si cambian los umbrales o su lógica en el motor, cambiarlos aquí.

---

## 2026-11-24 · Módulo C: botón de emergencia en la app ciudadana

**Qué cambió.** Botón rojo de solo icono bajo «Ríos» (que también pasa a solo icono). Abre una hoja con «Llamar al 911»,
Protección Civil de Puebla (222 246 27 50) y la ubicación del mapa para dictarla. Son enlaces `tel:`: la app no avisa a nadie
por su cuenta, y la hoja lo dice.
**Por qué.** Un derrumbe con personas en riesgo pide una llamada, no un reporte que se revisa después. El número de Protección
Civil sale del Programa Especial de Protección Civil para la Temporada de Lluvias y Ciclones Tropicales 2024 (p. 91, «atención
24 horas»); su sitio web da el mismo número con horario de oficina, por eso el 911 va primero.
**Qué arrastró.** `ciudadano/src/components/Emergencia.jsx` (nuevo), `MapaPage.jsx`, `componentes.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M5 y C: recibo por correo al crear un reporte

**Qué cambió.** Si la persona deja su correo, `POST /reportes` manda un recibo con el folio y el enlace al rastreo
(`correo.avisar_recibo`, mismo estilo que el aviso de cierre) y responde `X-Aviso-Correo`; la app dice «Te enviamos el folio
a tu correo». Un reporte repetido no manda otro recibo. El campo del correo y los términos dicen ahora que son dos correos:
el folio y el cierre. El remitente y el encabezado pasan de «Monitoreo del río Atoyac» a «Reportes ciudadanos».
**Por qué.** Pedido del usuario: que quien reporta sepa que su reporte llegó y se sienta escuchado.
**Qué arrastró.** `backend/app.py`, `backend/correo.py`, `backend/prueba.py` (casos del recibo), `ciudadano/src/`.
**Impacto en otros módulos.** Con correo, el envío tarda unos segundos más (en Vercel se espera al SMTP). El mock no manda correos.

---

## 2026-11-24 · Módulo B: menú de Reportes ciudadanos y tarjeta de reporte sin franja

**Qué cambió.** La pestaña "Reportes ciudadanos" de la barra es un menú desplegable (`MenuSeccion.jsx`, nuevo) con
Reportes y Estadísticas, que marca la opción actual; la página la lleva `App.jsx` y se quitó el botón "Dashboard" de la
cabecera de la lista. La tarjeta de detalle de un reporte (`.incidente-cabeza`) ya no tiene la franja dorada superior.
**Por qué.** Petición del usuario: el botón quedaba amontonado y la franja se confundía con la navegación.
**Qué arrastró.** `App.jsx`, `Reportes.jsx` (recibe `pagina` y `setPagina`), `estilos.css`.
**Impacto en otros módulos.** C: `Reportes.jsx` cambió poco (sin botón Dashboard; la página llega por props).

---

## 2026-11-24 · Módulo A: los 10 mecanismos, en el Alto Atoyac y junto a cauces

**Qué cambió.** Los mecanismos se limitan al Alto Atoyac: las cuatro subcuencas del INEGI que drenan a Valsequillo (RH18Ad
Texmelucan, RH18Ai Zahuapan, RH18Aj Alseseca, RH18Ac Valsequillo; `_comun.SUBCUENCAS_ALTO_ATOYAC`, con `en_alto_atoyac` y la
distancia a cauces movidas a `_comun.py`). `97_escuelas_riesgo.py` agrega a `escuelas.json` todas las escuelas del catálogo
en esa zona (503 en lugar de 330; las anteriores no cambian). Estaciones de agua (`99`): Tehuitzingo (Mixteca) sale y entra
Santa Elena (Huejotzingo); se renumeran. Estaciones de ladera (`100`): de la Sierra Norte al Alto Atoyac, con susceptibilidad
CENAPRED Alta, a menos de 500 m de un cauce y por riesgo de derrumbe (sin el mínimo de 0.7, que solo cumple una escuela en la
zona), con inclinómetro en las cinco (no hay Muy alta): Tlalancaleca, San Isidro Petlácatl (Ocoyucan), La Preciosita y El
Pipirín (Tlahuapan) y Buenavista Tetela (Puebla), a 84-210 m de su cauce (`distancia_cauce_m` y `cuerpo_agua`, nuevos en la
estación de ladera). Lluvia (F21, los 12 puntos descargados de nuevo con las coordenadas nuevas en `00_descargar_fuentes.py`)
y suelo (F22; `103` detecta si el punto guardado ya no es el de la estación) regenerados: umbrales de humedad 43.5-49.9 %.
La figura de ladera tiene un arroyo al pie del cerro que crece, corre más y se enturbia con la lluvia del modelo, y un rótulo
«Cauce» con la distancia real. El simulador arranca el suelo en capacidad de campo (temporada de lluvias).
**Por qué.** Pedido del usuario: los puntos, cerca de la cuenca y de cuerpos de agua (la ladera que vigila es la que un río
socava en su pie); en la Sierra Norte el mapa no tiene red de ríos y el panel filtraba esas escuelas.
**Qué arrastró.** `catalogo-componentes.md` (prefijos), `04-fuentes-de-datos.md`, `02-mapa-del-repo.md`, `docs/20`, `CLAUDE.md`,
`estacion.schema.json` (`distancia_cauce_m`), escenarios de ladera (EST-LAD-01 es ahora Tlalancaleca), `prueba.js`.
**Impacto en otros módulos.** Panel y app: `escuelas.json` crece a 503 y las 10 estaciones caen dentro de la cuenca que
filtran. El p99 de lluvia del Alto Atoyac (≈ 26 mm en 24 h) es mucho menor que el de la Sierra Norte (≈ 66): la alerta
Informativa llega antes. Motor y escenarios: tormenta Informativa y Preventiva; lluvia prolongada Crítica (72 h sobre suelo
saturado, 45.91 % contra 45.8 %); deslave Crítica por la estaca. Los del agua no cambian.

---

## 2026-11-24 · M2 y módulo A: reglas de derrumbe y umbral de humedad calibrado por ladera

**Qué cambió.** `motor/reglas.py` evalúa el módulo de ladera (`_ladera`): lluvia acumulada en 24 y 72 h (Informativa al p99
del sitio, Preventiva al mínimo de Caine, Crítica a la lluvia de Teziutlán 1999; con suelo saturado la Preventiva sube a
Crítica), suelo cerca de saturación (Informativa) e inclinómetro (aviso: Informativa, o Preventiva con lluvia o suelo
saturado; crítico: Crítica). Avisa cuando una regla sube de nivel y se rearma al volver a cero. Toda alerta de una estación
reubicada lleva `escuelas_afectadas`. `alerta.schema.json` suma las reglas `lluvia_acumulada`, `suelo_saturado` y
`movimiento_ladera` y sus criterios (compatible). El backend rehidrata 900 paquetes en las estaciones con lluvia
(`REHIDRATAR_LADERA`). Nuevo `scripts/103_suelo_laderas.py` (fuente F22, SoilGrids) → `suelo_laderas.json`: umbral =
máx(0.9 × porosidad, capacidad de campo + 5); da 46.5 a 57.7 % en lugar del 45 % sin fuente. `102_escenarios_ladera.py` y el
simulador usan ese suelo (drena a su capacidad de campo, satura en su porosidad; solo drena lo que pasa de la capacidad de
campo); rango del sensor de humedad a 0-64 % (TEROS 10). En la figura de ladera los tres sensores se dibujan a 3× (no se
distinguían a 1.6×), el pluviómetro se aparta del gabinete y el sensor de humedad se ve en el corte dentro de su hoyo de relleno.
**Por qué.** docs/20 §5; el 45 % no tenía fuente y la saturación depende del suelo de cada ladera.
**Qué arrastró.** `04-fuentes-de-datos.md` y `datos/bitacora.md` (F22), `02-mapa-del-repo.md`, `docs/20`, `CLAUDE.md`,
`prueba.js`, escenarios de ladera regenerados.
**Impacto en otros módulos.** Escenarios: `tormenta_ladera` da Informativa y Preventiva; `lluvia_prolongada`, Crítica por lluvia
de 72 h sobre suelo saturado (47.96 % contra 47.9 %); `deslave`, Crítica por la estaca (3.81°). Los del agua no cambian
(0, 1, 5, 3 y 0). Rehidratando 200 paquetes, como antes, se perdía la Crítica de la lluvia prolongada. Bonillagco (EST-LAD-05)
satura en 64.2 %: al tope del TEROS 10. La autocalibración con el sensor (`--serie`) recupera la capacidad de campo por la
curva de secado: 39.3 % contra 38.8 % en una serie simulada de 12 días.

---

## 2026-11-24 · Módulo B: tipografía del Sistema Nacional de Diseño en el panel

**Qué cambió.** Títulos en Patria y texto en Noto Sans (snd.gob.mx) en lugar de Montserrat. Patria se carga con
`@font-face` desde los archivos del CDN del SND (`framework-gb.cdn.gob.mx/snd/v1/fuentes/`, permite origen cruzado), los
mismos que declara `snd-guinda.css`; Noto Sans sigue de Google Fonts. No se enlaza la hoja ni el cargador del SND (D31).
**Por qué.** Petición del usuario: las fuentes conforme a la plantilla del gobierno.
**Qué arrastró.** `estilos.css`, `index.html`.
**Impacto en otros módulos.** La app ciudadana sigue con Montserrat.

---

## 2026-11-24 · Módulo B: sin aviso de conexión, cifra crítica sin franja y pie sobrio

**Qué cambió.** La pestaña Alertas ya no muestra "Conectado a …"; la cifra destacada (crítica) conserva el número en
rojo pero sin la franja superior; el pie pasa de tres columnas (fuentes, diseño) a una franja del verde de la barra con
el nombre, "Cuenca del Alto Atoyac, Puebla" y el aviso de que no es un sitio oficial. Corrige el doble punto tras la hora.
**Por qué.** Petición del usuario: la franja se confundía con la navegación y el pie no decía nada útil.
**Qué arrastró.** `App.jsx`, `estilos.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · Módulo A: módulo de ladera en el simulador y en los mecanismos

**Qué cambió.** `99_reubicacion.py` agrega a `mecanismos.json` las 5 estaciones `EST-LAD-01..05` de `escuelas_ladera.json`
(sin colector ni `c_sitio`; CAPCEE como única autorización). El simulador mide `LLUVIA`, `HUM_SUELO` e `INCL`: `Ladera` y
`Pluviometro` en `modelo.js` (humedad con los mismos parámetros de `102_escenarios_ladera.py`); el firmware mide los parámetros
de cada estación, lee el pluviómetro una vez por paquete y pasa a 5 min con lluvia de 7.6 mm/h o más, o un movimiento de 0.2°.
Figura de ladera en `escena.js` (escuela, cerro de ≈ 32°, pluviómetro, sensor en el corte, estaca que se inclina 5 veces lo
medido, lluvia que cae con la intensidad) y pruebas «Tormenta», «Lluvia prolongada» y «Deslave». Pruebas 17 a 19 en `prueba.js`.
**Por qué.** docs/20 §4 y §3.2.
**Qué arrastró.** `50_verificar_repo.py` (colector solo en `EST-ESC`), `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Medido: tormenta 120 mm en 24 h; lluvia prolongada 95 mm en 24 h y 245 en 72 h, humedad de 30 a
44.6 %; deslave con la estaca en 3.83°. Los paquetes validan contra el contrato (1 446 en `prueba.js`). Las reglas de derrumbe del
motor siguen pendientes (docs/20 §5): las pruebas no encienden ninguna alarma.

---

## 2026-11-24 · M2: la lluvia ya no se lee como contaminación

**Qué cambió.** `motor/reglas.py` deja fuera de las capas del agua los códigos `LLUVIA`, `HUM_SUELO` e `INCL`
(`PARAMETROS_LADERA`): salen en el veredicto como `sin_linea_base` y no generan alertas ni avisos técnicos.
**Por qué.** Con los escenarios de ladera el motor daba 16 alertas falsas de contaminación en `lluvia_prolongada` y 8 en
`deslave`, y hasta 136 avisos técnicos (0 mm de lluvia seguidos se leían como sonda congelada). Ahora 0 en los tres.
**Qué arrastró.** Nada más. Los escenarios del agua no cambian (5 alertas en `descarga_industrial`, 0 en `normal`).
**Impacto en otros módulos.** Las reglas de derrumbe (docs/20 §5) van en ese mismo punto del motor.

---

## 2026-11-24 · M4: catálogo de componentes y energía de la estación de agua

**Qué cambió.** Nuevo `dispositivo/catalogo-componentes.md`: modelo comercial de cada componente (verificado o por confirmar)
y clave de cada pieza `EE-MMM-TTTNN-SS-CCC-n` (entidad y municipio del INEGI, mecanismo, subsistema, componente) con su estado
operativo (`PR`, `OP`, `FN`, `FR`…). Con la turbiedad real (Pyxis LT-633, 6 W a 24 V) `ESPEC.TURB` pasa de 250 a 7 000 mW y la
estación de agua lleva 8 celdas 18650 (89 Wh) y panel de 10 W con cargador propio (`ENERGIA` en `modelo.js`); la de ladera
sigue con 2 celdas y 5 W. La figura dibuja las celdas y el panel de cada tipo.
**Por qué.** Con la sonda real el consumo sube de 1.4 a 5.0 Wh/día y la autonomía sin sol caía a 4 días; ahora 15.9. La de
ladera gasta 0.9 Wh/día: 21 días.
**Qué arrastró.** `ficha-tecnica.md`, `prueba.js` (pruebas 6 y 18 exigen al menos 14 días sin sol), `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno en el contrato. El SIM7080G no tiene 4G de respaldo: medir LTE-M en cada sitio.

---

## 2026-11-24 · Módulo B: cierre del panel reenfocado a escuelas

**Qué cambió.** En teléfono las cuatro pestañas van en una segunda fila, "Autorizaciones" se llama "Trámites" y se ocultan
los contadores (antes se cortaban). Estado del panel actualizado en `docs/12-estado-y-traspaso.md` y `CLAUDE.md`.
**Por qué.** Paso 8 del módulo B (docs/19 §6, terminado cuando). Verificado: a 375 px ninguna pestaña se desborda; con el
`escuelas.json` provisional y con una escuela sin riesgo ni campos opcionales el panel no falla; en Vercel cargan las
cuatro pestañas y la alerta de `EST-ESC-04` muestra su escuela afectada; `npm run build` pasa.
**Qué arrastró.** `App.jsx`, `estilos.css`, `CLAUDE.md`, `docs/12-estado-y-traspaso.md`.
**Impacto en otros módulos.** Pendientes de A y del motor: matrícula y fuente de agua, zonas del atlas, un factor de
urbanización que distinga y `escuelas_afectadas` desde el motor.


---

## 2026-11-24 · Módulo C: «Generar Reporte» se apaga fuera de Puebla

**Qué cambió.** Nuevo `scripts/103_area_reportes.py` → `datos/procesados/mapa/area_reportes.json`: Puebla aproximada por las
6 568 localidades del ITER 2020 (celdas de 0.05° con localidad, más una de margen; 1 573 celdas, 19 KB). La app la copia a
`public/datos/` y, con el centro del mapa fuera, apaga el botón y dice «Fuera de Puebla: aquí no se puede reportar».
**Por qué.** Antes solo había un rectángulo que dejaba Oaxaca, la Ciudad de México o Tlaxcala, y el rechazo llegaba al enviar.
**Qué arrastró.** `ciudadano/` (MapaPage, FormularioReporte, ubicacion.js, backend.js, copiar-datos.mjs, CSS), `02-mapa-del-repo.md`.
**Impacto en otros módulos.** El backend y el esquema siguen aceptando el rectángulo: un cliente que se salte la app aún puede
enviar fuera de Puebla. Tlaxcala queda fuera de la app.

---

## 2026-11-24 · Módulo B: análisis de urbanización

**Qué cambió.** `Urbanizacion.jsx` (nuevo), al final de la pestaña Escuelas: cuántas escuelas tienen urbanización reciente,
falta de drenaje y pendiente; índice medio con y sin urbanización reciente; y las 15 escuelas con más de esos tres
factores, cada uno de 0 a 1 (desglose entre su peso; pesos copiados de `97_escuelas_riesgo.py`).
**Por qué.** Paso 7 del módulo B (docs/19 §6, punto 3).
**Qué arrastró.** `Escuelas.jsx`, `estilos.css`.
**Impacto en otros módulos.** A: el factor de urbanización vale casi lo mismo en 36 de 43 escuelas de la cuenca, así que
no distingue; el índice medio sale 0.40 con urbanización y 0.48 sin ella. Si cambian los pesos, cambiarlos en el panel.

---

## 2026-11-24 · Módulo B: tablero de autorizaciones

**Qué cambió.** La pestaña Autorizaciones tiene cifras (mecanismos activos, trámites pendientes, solicitados y
otorgados), trámites por organismo y estado, quién autoriza qué (CEASPUE y CAPCEE, nombres no oficiales), la tabla de los
5 mecanismos de `mecanismos.json` (propuesto mientras CEASPUE no otorgue) y los trámites de las escuelas, con enlace a la
ficha. Hoy: 0 de 5 activos y 24 trámites pendientes.
**Por qué.** Paso 6 del módulo B (docs/19 §4.3 y §6, punto 5).
**Qué arrastró.** `Autorizaciones.jsx`, `App.jsx`, `estilos.css`.
**Impacto en otros módulos.** Ninguno.


---

## 2026-11-24 · Módulo C: «Color o espuma» y nuevo tipo «Deslave» en los reportes

**Qué cambió.** La app ofrece 6 tipos: «Espuma» se junta con «Color anormal» (código `color_anormal`, etiqueta «Color o espuma»)
y entra `deslave`. `reporte_ciudadano.schema.json` suma `deslave` y sigue aceptando `espuma` para los reportes viejos. Gemini
(`analisis_foto.py`) reconoce deslaves sin exigir agua; `prioridad_huella.py` le da gravedad 4 (hipótesis); etiquetas del panel
y del correo actualizadas.
**Por qué.** Cambio de rumbo a derrumbes (docs/19, docs/20); el usuario pidió un número par de opciones.
**Qué arrastró.** `ciudadano/src/lib/etiquetas.js`, `CategoriaIcono.jsx`, `backend/correo.py`, `panel/src/lib/etiquetas.js`.
**Impacto en otros módulos.** Compatible. Un reporte de deslave no se valida por cercanía al agua. El título de la app y el
mensaje de ubicación fuera de rango siguen hablando del río Atoyac.

---

## 2026-11-24 · Módulo B: alertas con escuelas afectadas

**Qué cambió.** `alerta.schema.json` admite `escuelas_afectadas` (lista de CCT, opcional y compatible; docs/19 §4.4).
El panel lee `mecanismos.json` y, para cada alerta, toma las escuelas que manda el motor o, si no las manda, las que
protege su mecanismo o las que tienen ese `c_estacion`. La lista de alertas dice cuántas escuelas afecta y el expediente
tiene "Escuelas afectadas" con enlace a la ficha. Las estaciones `EST-ESC-xx` se nombran por su escuela.
**Por qué.** Paso 5 del módulo B (docs/19 §6, punto 4).
**Qué arrastró.** `contexto.js` (`escuelasDe`), `datos.js`, `copiar-datos.mjs`, `ListaAlertas.jsx`, `Expediente.jsx`,
`App.jsx`, `estilos.css`. Validador: alerta con CCT válidas pasa, con un valor mal formado falla.
**Impacto en otros módulos.** Motor y backend: pueden mandar `escuelas_afectadas` en cada alerta.

---

## 2026-11-24 · Módulo B: un mapa para dispositivos y otro para escuelas

**Qué cambió.** El mapa de Alertas vuelve a mostrar solo las estaciones (sin escuelas ni zonas). El de la pestaña
Escuelas muestra solo escuelas y zonas, sin las estaciones del Atoyac. `MapaEstaciones.jsx` abre en la cuenca si no
tiene puntos que encuadrar.
**Por qué.** Petición del usuario: no mezclar los dispositivos con las escuelas.
**Qué arrastró.** `App.jsx`, `Panorama.jsx`, `Escuelas.jsx`, `MapaEstaciones.jsx`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · Módulo B: mapa en la pestaña Escuelas y zonas visibles de lejos

**Qué cambió.** La pestaña Escuelas tiene el mismo mapa ("Dónde están") arriba de la lista: un clic en una escuela abre su
ficha y la escuela elegida se marca con un anillo en tinta y el mapa se acerca. Las zonas de riesgo, que miden menos de
1 km, se dibujan alejadas como anillo de color en su centro (tierra: derrumbe; verde oliva: contaminación) y desde zoom 12
como polígono. Las gráficas de escuelas pasan al final.
**Por qué.** El usuario no veía las zonas y se perdía cambiando de pestaña para ubicar cada escuela.
**Qué arrastró.** `MapaEstaciones.jsx` (`escuelaElegida`), `Escuelas.jsx`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · Módulo B: zonas de riesgo en el mapa

**Qué cambió.** `MapaEstaciones.jsx` dibuja las zonas de `zonas_riesgo.geojson` que contienen alguna escuela de la
cuenca (16 de 107: 11 de contaminación, 5 de derrumbe), con relleno por tipo (tierra, azul del agua, verde oliva) más
opaco cuanto mayor el nivel y ventana al cursor. Quedan debajo de las escuelas.
**Por qué.** Paso 4 del módulo B (docs/19 §6, punto 6).
**Qué arrastró.** `Panorama.jsx` pasa `zonas`.
**Impacto en otros módulos.** A: las zonas actuales son círculos de unos 800 m alrededor de cada escuela; solo se ven de
cerca. Con polígonos de CENAPRED o del atlas de Puebla dirían algo por sí mismas.

---

## 2026-11-24 · Módulo B: ficha de escuela

**Qué cambió.** `FichaEscuela.jsx` (nuevo): encabezado, índice y subíndices, desglose del riesgo en barras (suma el
índice; pesos hipótesis), fuente de agua, mecanismo ("propuesto" sin autorización otorgada de CEASPUE), alertas de su
mecanismo, zonas de riesgo que la contienen y trámites. La pestaña Escuelas pone lista y ficha lado a lado; un clic en
una escuela del mapa de Alertas abre su ficha.
**Por qué.** Paso 3 del módulo B (docs/19 §6, punto 2).
**Qué arrastró.** `Escuelas.jsx`, `App.jsx`, `Panorama.jsx`, `MapaEstaciones.jsx`, `estilos.css`.
**Impacto en otros módulos.** Ninguno.


---

## 2026-11-24 · Módulo A: historia de lluvia y 7 puntos más (contraste Sierra Norte, cuenca y ciudad)

**Qué cambió.** `101_lluvia_sitios.py` escribe ahora `lluvia_historia.json`: por punto, cuántos episodios de lluvia pasaron cada
nivel de `umbrales_lluvia.json` en 2001-2025 (con el último y los 10 mayores), lluvia por año y por mes, y 3 años de lluvia
diaria para graficar. `lluvia_sitios.json` pasa de 5 a 12 puntos, con campo `tipo` (`ladera`, `agua`, `referencia`): se suman
las 5 estaciones de agua de `mecanismos.json` y 2 puntos de referencia en la ciudad de Puebla (Centro y Cholula). Descarga
F21 ampliada a esos 7 puntos (≈ 143 KB cada uno).
**Por qué.** Más contenido para el panel y el contraste entre zonas: Sierra Norte 930-1 376 mm/año, 1 a 6 episodios sobre el
mínimo de Caine; cuenca 717-994 mm, 0 o 1; ciudad 888-973 mm, 0. Es satélite: subestima tormentas de montaña, y es la
frecuencia con que la lluvia pasó un umbral, no la de deslaves.
**Qué arrastró.** `00_descargar_fuentes.py`, `datos/bitacora.md`, `docs/04-fuentes-de-datos.md`, `02-mapa-del-repo.md`.
**Impacto en otros módulos.** Panel: filtrar por `tipo`; las temporadas difieren (jun-oct en la Sierra Norte, may-sep en la
cuenca). EST-LAD-03 y 05, y EST-ESC-03 y 05, comparten celda de IMERG y por eso la misma serie. Los puntos REF-PUE no son
estaciones (`cct` nulo).

---

## 2026-11-24 · Módulo B: panorama de escuelas

**Qué cambió.** La pestaña Escuelas tiene cuatro cifras (riesgo alto o muy alto, escuelas en la cuenca, con mecanismo,
alumnos), barras por nivel de riesgo, por el riesgo que pesa más (el mayor de los subíndices de contaminación y derrumbe)
y por municipio, y la lista ordenada por índice con filtros de riesgo, tipo y municipio. Colores del mapa. El mapa ignora
el AbortError de MapLibre al desmontarse mientras carga.
**Por qué.** Paso 2 del módulo B (docs/19 §6, punto 1).
**Qué arrastró.** `Escuelas.jsx`, `MapaEstaciones.jsx`, `estilos.css`.
**Impacto en otros módulos.** A: faltan `matricula` en todas y `fuente_agua` en casi todas; el panel muestra "sin dato".


---

## 2026-11-24 · Módulo A: datos y escenarios del módulo de ladera (docs/20 §3)

**Qué cambió.** (1) Criterio y lista de las 5 escuelas con módulo de ladera (`100_escuelas_ladera.py` → `escuelas_ladera.json`):
`riesgo.derrumbe` ≥ 0.7 y susceptibilidad CENAPRED Alta o Muy alta, a más de 5 km entre sí, `INCL` solo con Muy alta; salen 248
elegibles (56 Muy alta) y 5 módulos en la Sierra Norte (Jopala, Xicotepec, Huitzilan de Serdán, Pahuatlán, Xochitlán). (2) Lluvia
por sitio (`101_lluvia_sitios.py` → `lluvia_sitios.json`) de NASA POWER/IMERG 2001-2025 en esos 5 puntos (fuente F21), y los
umbrales detonantes (`umbrales_lluvia.json`): Informativa = p99 del sitio, Preventiva = mínimo global de Caine (1980; 103 mm en
24 h, 201 mm en 72 h), Crítica = lluvia de Teziutlán en octubre de 1999 (360 mm en 24 h, 660 mm en dos días). (3) Tres
escenarios (`102_escenarios_ladera.py`): `tormenta_ladera`, `lluvia_prolongada` y `deslave`, de EST-LAD-01. (4) Los códigos
`LLUVIA`, `HUM_SUELO` e `INCL` entran al `enum` de `lectura.schema.json` y `estacion.schema.json`; la comprobación I5 de
`50_verificar_repo.py` los exime de la clave CONAGUA.
**Por qué.** docs/20 pide estos insumos para que el grupo agregue los sensores al simulador y las reglas al motor. No hay umbral
publicado de lluvia para deslaves en la Sierra Norte (Lugo-Hubp et al., 2005, dicen que no se puede fijar uno absoluto): los
umbrales son hipótesis con la fuente de cada número, y los de humedad (45 %) e inclinación (0.5° y 2°) son supuestos de
diseño sin fuente. La lluvia es de satélite: subestima tormentas de montaña (930 a 1 376 mm/año en los 5 puntos).
**Qué arrastró.** `00_descargar_fuentes.py` (F21), `datos/bitacora.md`, `docs/04-fuentes-de-datos.md`, `02-mapa-del-repo.md`.
Compatible: los paquetes del agua siguen siendo válidos. Las alertas de ladera y `escuelas_afectadas` **no** están hechas:
`motor/reglas.py` y `alerta.schema.json` quedan para el grupo. Nota: el ejemplo de docs/20 §3.1 trae `bateria: 3.95` y el
contrato exige un entero 0-100.
**Impacto en otros módulos.** Dispositivo y simulador: pueden usar `LLUVIA`, `HUM_SUELO` e `INCL`, y leer `escuelas_ladera.json`
(que `99_reubicacion.py` convierta en `EST-LAD-`) y `lluvia_sitios.json`. Motor y backend: leer `umbrales_lluvia.json` y los
escenarios nuevos. EST-LAD-03 y 05 comparten celda de IMERG y por eso la misma serie de lluvia.

---

## 2026-11-24 · Módulo B: escuelas encimadas se agrupan en el mapa

**Qué cambió.** `MapaEstaciones.jsx` junta las escuelas que comparten coordenada en un solo punto con el número de
escuelas y el color del mayor riesgo; la ventana al cursor las lista todas. Las 43 de la cuenca quedan en 28 puntos
(15 pares). Puntos un poco más grandes para distinguirlos de las estaciones.
**Por qué.** El usuario veía muy pocas: 14 escuelas caían exactamente sobre otra.
**Qué arrastró.** Nada más.
**Impacto en otros módulos.** A: revisar si esas coordenadas son del plantel o de la localidad (otro turno en el
mismo edificio explicaría la coincidencia).

---

## 2026-11-24 · Módulo B: el panel solo muestra escuelas de la cuenca

**Qué cambió.** `panel/src/lib/datos.js` filtra `escuelas.json` a las escuelas de Puebla (CCT 21…) dentro del
contorno de `cuenca.geojson`: 43 de 330 (10 de riesgo alto, 30 medio, 3 bajo; las 7 con mecanismo quedan dentro). Aplica
al mapa, la lista de escuelas y las autorizaciones; el mapa abre centrado en la cuenca.
**Por qué.** Petición del usuario: el reto se centra en la cuenca.
**Qué arrastró.** Nada más; `escuelas.json` no se toca.
**Impacto en otros módulos.** A: si todo el proyecto se limita a la cuenca, conviene filtrar en `97_escuelas_riesgo.py`
para que la app ciudadana y el mapa usen las mismas escuelas.


---

## 2026-11-24 · Módulo A: diseño del mecanismo de derrumbes (docs/20)

**Qué cambió.** Nuevo `docs/20-mecanismo-derrumbes.md`: responde la pregunta abierta de docs/19 §5. El derrumbe se vigila con
un módulo de ladera en la misma estación (pluviómetro `LLUVIA`, humedad del suelo `HUM_SUELO`, inclinómetro `INCL`), no con
un dispositivo aparte. Define los tres códigos nuevos del contrato, la forma de las estaciones `EST-LAD-` en
`mecanismos.json`, lo que hace el simulador y lo que hace la plataforma, y quién hace qué.
**Por qué.** Contaminación y derrumbe comparten unidad (la escuela), causas y detonante (la lluvia): un solo mecanismo y una
sola plataforma. El pluviómetro sirve a los dos riesgos.
**Qué arrastró.** Nada todavía: es el diseño. Los cambios de contrato y de simulador los hace cada dueño (docs/20 §6).
**Impacto en otros módulos.** Dispositivo: sensores, firmware y escena del módulo de ladera. Todos: tres códigos nuevos en
`lectura` y `estacion` (compatibles con lo actual).

## 2026-11-24 · Módulo B: Alertas vuelve primero y el mapa marca las escuelas

**Qué cambió.** Alertas es la primera pestaña y abre por defecto; vuelven el mapa de la red, la matriz y la tabla de
estaciones. `MapaEstaciones.jsx` dibuja las escuelas de `escuelas.json` (punto guinda, más oscuro y grande cuanto
mayor su nivel de riesgo, con ventana al cursor) y la vista inicial abarca estaciones y escuelas.
**Por qué.** Petición del usuario: sin el mapa el panel perdía sentido; las escuelas van sobre el mapa existente.
**Qué arrastró.** `App.jsx`, `Panorama.jsx`, `MapaEstaciones.jsx`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · Módulo A: susceptibilidad de laderas de CENAPRED en el índice de escuelas

**Qué cambió.** `98_escuelas_candidatas.py` lee el Mapa Nacional de Susceptibilidad por Inestabilidad de Laderas de CENAPRED
desde su servicio ArcGIS público (`servicios1.cenapred.unam.mx:6080/.../Inestabilidad_Laderas/MapServer`), exportado en bloques
de 0.25° (~55 m por pixel; caché en `datos/crudos/F20`) y leído por el color de la leyenda. En las 7 384 escuelas: 79 Muy alto,
2 194 Alto, 1 064 Moderada, 475 Bajo, 3 572 zona libre. `escuelas.json` pasa a 330 escuelas (las 300 de mayor índice más 30 de
contaminación ≥ 0.5): 1 muy alto, 150 alto, 176 medio, 3 bajo. 107 zonas (96 de derrumbe, 11 de contaminación), agrupadas a 3 km.
**Por qué.** El factor valía 0 en todas por falta de fuente. La página del atlas no tiene descarga, pero su visor usa un servicio
público. Pedir el mapa por bloques evita 7 384 consultas punto por punto. Sin las 30 de contaminación la lista quedaba solo de laderas.
**Qué arrastró.** `contrato/fixtures/LEEME.md`. El sitio del atlas solo responde por `http://`.
**Impacto en otros módulos.** Misma forma del contrato. `calidad_agua` sigue en 0 lejos de los sitios CONAGUA. Se regeneró `mecanismos.json` con `99_reubicacion.py` (deriva de `escuelas.json`): siguen las 5 estaciones
`EST-ESC-01` a `05`, que ahora protegen 16 escuelas en lugar de 13.

## 2026-11-24 · Módulo B (cambio de rumbo): el panel se organiza por escuelas

**Qué cambió.** El panel tiene cuatro pestañas: Escuelas (abre por defecto; lista por índice de riesgo), Alertas,
Autorizaciones (trámites por escuela) y Reportes ciudadanos. Lee `escuelas.json` y `zonas_riesgo.geojson`
(`copiar-datos.mjs`, `datos.js`; si faltan, listas vacías). La vista de alertas ya no muestra el mapa de la red, la
matriz ni la tabla de estaciones del Atoyac, y el expediente ya no muestra "Hasta dónde llega" ni "Aguas arriba":
el código se conserva (docs/19 §6). Título, pie y `<title>` hablan de escuelas en riesgo y del reto CAPCEE.
**Por qué.** Paso 1 del módulo B (docs/19 §6): la unidad del panel es la escuela.
**Qué arrastró.** `App.jsx`, `Escuelas.jsx` y `Autorizaciones.jsx` nuevos, `Expediente.jsx`, `datos.js`,
`copiar-datos.mjs`, `index.html`. Probado con las 400 escuelas reales sin cambiar código.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · Módulo A: los 5 mecanismos se reubican junto a escuelas rurales

**Qué cambió.** `scripts/99_reubicacion.py` escribe `contrato/fixtures/mecanismos.json` y `datos/procesados/mapa/red_mecanismos.geojson`:
5 mecanismos (`EST-ESC-01..05`, cada uno con su colector `COL-ESC-01..05`) en el punto del cauce más cercano a escuelas de
`escuelas.json` con un cauce a menos de 2.5 km, en orden de riesgo de contaminación y a más de 3 km entre sí. Protegen 13
escuelas (Tehuitzingo, Guadalupe Tlatelpa en Puebla, San Matías Tlalancaleca, Coronango y San Martín Texmelucan); quedan 23
elegibles sin mecanismo y 364 sin cauce en la red que tenemos. `estacion.schema.json` pasa a v2.0 compatible: `c_sitio` admite
`null` y se agregan escuela, escuelas protegidas, autorizaciones (CEASPUE y CAPCEE), `banda_simulacion` y colector. El motor y el
mock registran también los mecanismos; simulador y mapa los muestran en lugar de las 5 del Atoyac.
**Por qué.** Cambio de rumbo (docs/19 §5). La estación y el colector son instrumentos de cauce: van donde la escuela tiene uno.
Los 5 se conservan por presupuesto (docs/18).
**Qué arrastró.** `02-mapa-del-repo.md`, `CLAUDE.md` (pendiente 0), `50_verificar_repo.py` (valida `mecanismos.json`),
`prueba.js` (prueba 16), `ensamblar-sitio.mjs` (publica los dos archivos nuevos).
**Impacto en otros módulos.** Ninguno de sus sitios CONAGUA está en `linea_base.json`: el motor los compara solo contra su
historia reciente (en la simulación, 0 alertas en un día normal y la descarga industrial detectada a los 20 min en los 5) y el
simulador fabrica su agua con la banda del sitio con línea base más cercano. `GET /estaciones` devuelve 10 (las 5 del Atoyac
siguen para los escenarios y el panel). Todos quedan como «propuesta»: ninguna escuela tiene aún la autorización de CEASPUE.

---

## 2026-11-24 · M4: colector de residuos flotantes en el simulador

**Qué cambió.** `dispositivo/simulador/recolector.js` (máquina de estados pura, como `firmware.js`) y su figura en `escena.js`:
barrera flotante, banda con motor, contenedor de 240 L sobre báscula, cámara, sensor de nivel, panel de 100 W, batería y módem
propios; `montaje.js` arma uno por estación y `prueba.js` suma las pruebas 8 a 15. Cauce de la escena ensanchado a ≈ 12 m.
**Por qué.** El reto pide mecanismos automatizados de recolección de residuos; el usuario eligió el colector completo sobre la
versión simple de canasta.
**Qué arrastró.** `CLAUDE.md`. Pendiente: ficha del colector y D32.
**Impacto en otros módulos.** Su paquete (`0.1-propuesta`) no está en el contrato y el simulador no lo manda al backend.

---

## 2026-11-24 · Módulo A: escuelas y zonas con datos reales

**Qué cambió.** `escuelas.json` y `zonas_riesgo.geojson` dejan de ser provisionales. `98_escuelas_candidatas.py` toma el
catálogo de centros de trabajo de la SEP 2026 (F18, bajado a mano) y deja `factores_escuelas.csv`: 7 384 escuelas públicas
rurales de Puebla (preescolar a media superior) con su localidad (7 298 por nombre, 82 por cercanía, 4 sin localidad),
marginación y drenaje (CONAPO, F19), pendiente (F17), fuente contaminante cercana y altas recientes del DENUE, y calidad del
agua del sitio CONAGUA a menos de 2 km. `97_escuelas_riesgo.py` escribe las 400 de mayor índice (11 alto, 389 medio) y 21
zonas agrupadas de los datos (10 de derrumbe, 11 de contaminación). Las 7 escuelas junto a `EST-ATY-05` traen sus trámites
CEASPUE y CAPCEE en `pendiente`.
**Por qué.** Que el panel (B) y la app (C) usen datos reales. El DENUE solo tenía 473 escuelas rurales; la SEP, 7 384 y con CCT.
**Qué arrastró.** `contrato/fixtures/LEEME.md`, `02-mapa-del-repo.md`, `04-fuentes-de-datos.md`, `datos/bitacora.md`,
`00_descargar_fuentes.py` (F16 y F19; F18 se baja a mano). Se quita `escuelas_candidatas.csv`.
**Impacto en otros módulos.** Misma forma del contrato. `matricula` viene `null` y `fuente_agua` `desconocida`. Dos factores
valen 0 por falta de fuente (laderas de CENAPRED en todas; calidad del agua lejos de sitios CONAGUA), así que hoy nadie llega
a «muy alto»: no es ausencia de riesgo. Propuesta para el grupo: agregar `sin_dato` al contrato para mostrarlo.

---

## 2026-11-24 · Módulo A (cambio de rumbo): contrato de escuelas y zonas, fixtures provisionales y primeros datos reales

**Qué cambió.** Esquemas `escuela` y `zona_riesgo` (docs/19 §4.1 y §4.2). `scripts/97_escuelas_riesgo.py` escribe
`escuelas.json` (11 escuelas) y `zonas_riesgo.geojson` (10 zonas) PROVISIONALES (docs/19 §4.5; marcados en
`contrato/fixtures/LEEME.md`): lugares reales de Puebla, CCT, nombres, puntajes y polígonos inventados; dos escuelas
ligadas a `EST-ATY-04` y `EST-ATY-05` para cruzar alertas. `50_verificar_repo.py` valida los dos y que el desglose sume
el índice. `scripts/98_escuelas_candidatas.py`: 473 escuelas públicas rurales de Puebla (de 4 809 públicas del DENUE)
con drenaje y agua de su localidad (censo 2020), pendiente de la ladera (percentil 75 en 250 m, mosaicos de elevación
terrarium) y fuente contaminante más cercana.
**Por qué.** Que el panel (B) y la app (C) trabajen sin esperar los datos reales. El índice se calcula como la suma del
desglose porque el ejemplo de docs/19 §4.1 no la cumplía (desglose 0.92, índice 0.72). Pesos: hipótesis.
**Qué arrastró.** `02-mapa-del-repo.md`. Fuentes nuevas en `datos/crudos/` (no versionadas): F16 ITER 2020 de Puebla
(INEGI), F17 mosaicos de elevación (AWS terrarium), F19 marginación por localidad 2020 (CONAPO, `.xls`: falta `xlrd`
para leerla). Pendiente: anotarlas en `00_descargar_fuentes.py`, la bitácora y `04-fuentes-de-datos.md`.
**Impacto en otros módulos.** B y C leen `escuelas.json` y `zonas_riesgo.geojson` con la forma definitiva. El DENUE
registra pocas escuelas en localidades pequeñas: los datos reales dependen del catálogo de centros de trabajo de la SEP,
que bloquea descargas automáticas y se baja a mano a `datos/crudos/F18`.

---

## 2026-11-24 · Cambio de rumbo: escuelas rurales vulnerables (reto CAPCEE)

**Qué cambió.** Nuevo `docs/19-cambio-de-rumbo-capcee.md`: el proyecto pasa a prevenir contaminación y derrumbes
en comunidades rurales con escuelas vulnerables; lleva el reto el CAPCEE y los mecanismos deben contemplar
autorizaciones de CEASPUE. Define el contrato común (`escuelas.json`, `zonas_riesgo.geojson`, autorizaciones,
cambios v2.0 a alerta, reporte y estación) y reparte tres módulos independientes.
**Por qué.** Cambio de reto; los módulos de análisis del agua, alertas y participación ciudadana se conservan
con enfoque en infraestructura y urbanización.
**Qué arrastró.** Solo el documento nuevo. `CLAUDE.md`, esquemas y fixtures aún no cambian.
**Impacto en otros módulos.** Reubicación (Manuel), dashboard en `panel/` (Evaristo) y reportes en `ciudadano/`
(Carlos) trabajan contra los fixtures de §4 del documento, sin importar código entre sí.

---

## 2026-11-24 · M5 y M8: freno a los reportes repetidos de una misma persona

**Qué cambió.** `backend/antispam.py` y la tabla `envio`. Por persona (huella SHA-256 de la IP con sal secreta; la IP no se
guarda): más de 5 reportes por minuto dan 429; el mismo tipo a menos de 150 m en 30 minutos no crea otro reporte, responde 200
con `repetido: true` y el folio anterior; más de 20 consultas de folio por minuto dan 429. La app muestra «Ya teníamos tu
reporte» con el mismo folio, o el mensaje de espera; en la cola sin señal un 429 se reintenta y no se pierde.
**Por qué.** SIGRIV frenaba 5 reportes por minuto por IP, pero en memoria, que en Vercel se reinicia en cada instancia. Aquí
`POST /reportes` no tenía freno: una persona podía mandar el mismo reporte muchas veces y cada uno contaba como corroboración
ciudadana de su propio foco (D30).
**Qué arrastró.** `backend/README.md`, `CLAUDE.md`, `backend/prueba.py` (prueba 9, 10 comprobaciones; la 8 ahora manda cada
reporte desde otra IP). Probado en la app: el segundo envío igual devuelve el mismo folio y el sexto del minuto pide esperar.
**Impacto en otros módulos.** Ninguno en el contrato: el freno va después de validar, así que el mock y el backend siguen
rechazando igual. Límite conocido: personas que comparten IP (datos móviles, wifi de una escuela) que reporten el mismo tipo
en el mismo punto en 30 minutos quedan como un solo reporte.

---

## 2026-11-24 · M5: aviso por correo al cerrar un reporte ciudadano

**Qué cambió.** `backend/correo.py`: al pasar un reporte a «Cerrado» por primera vez, el backend avisa por SMTP a quien
dejó su correo, con el folio, el tipo y un enlace a `/ciudadano/#/rastreo?folio=<c_reporte>` (la app ya abre el rastreo con
ese folio). Credenciales solo en variables de entorno (`SMTP_USER`, `SMTP_PASSWORD`; opcionales `SMTP_HOST`, `SMTP_PORT`,
`MAIL_FROM_NAME`, `APP_URL`). El resultado va en la cabecera `X-Aviso-Correo`, expuesta por CORS, y el panel dice a cuántas
personas se avisó. `/salud` agrega `aviso_por_correo`.
**Por qué.** La app pedía el correo «solo para avisarte cuando se cierre» y el backend lo guardaba, pero nadie lo enviaba. Se
avisa solo al cierre, no en cada etapa como SIGRIV, porque eso es lo que dicen la app y los términos.
**Qué arrastró.** `backend/README.md`, `CLAUDE.md`, `backend/prueba.py` (prueba 8, 12 comprobaciones con un SMTP falso:
sin credenciales no envía, validar no envía, cerrar envía una vez, sin correo no intenta, si el SMTP falla el cierre se guarda).
**Impacto en otros módulos.** Ninguno en el contrato: el cuerpo de `PATCH /reportes` no cambia y el mock no envía correos.
En un foco con varios reportes del mismo correo, cada reporte cerrado manda su aviso.

---

## 2026-11-24 · M7 y M8: reportes ciudadanos con la forma del dashboard de SIGRIV; la foto antes del tipo

**Qué cambió.** La sección de reportes del panel replica el dashboard de SIGRIV (Wharf-Code-Solutions/HackatecRegional,
`Dashboard.jsx`, `IncidentDetails.jsx`, `DashboardInfo.jsx`): a toda la altura bajo la barra, lista con pestañas
Activas/Cerrados/Descartados, filtros (Todos, Urgentes, por tipo, Actualizar) y tarjetas con borde por prioridad; mapa con
pines en gota, botón «Mapa de calor» y leyenda; detalle encima del mapa con foto, desglose de la prioridad, pasos Recibido →
Validado → En atención → Cerrado y acciones (cerrar y descartar con confirmación, restaurar). Botón «Dashboard» a una página de
estadísticas: periodo 7/30/90 días o todo, municipio y tipo, indicadores, dona por estado y barras por tipo y por punto de
monitoreo. Los avisos de demostración y de motor provisional solo salen en Monitoreo. En la app ciudadana, la foto va antes de
«¿Qué ves?»; si la revisión de la foto reconoce un tipo y no se ha elegido ninguno, se preselecciona.
**Por qué.** Lo pidió el equipo: que la gestión de reportes se vea como SIGRIV. El aviso del motor provisional empujaba el
tablero fuera de la pantalla.
**Qué arrastró.** `CLAUDE.md`, `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`. Diferencias con SIGRIV por los datos: la
incidencia es un foco de `/prioridades`; el calor es la huella sobre el río (D30); no se listan personas porque el correo no sale
de la API; el descarte no lleva motivo porque `PATCH /reportes` solo cambia el estado; «colonias» son puntos de monitoreo (el
municipio sale de `sitios.geojson`); en lugar del tiempo de atención, que el backend no guarda, van los focos con alerta de una
estación. Se quitó la tabla «Todos los reportes».
**Impacto en otros módulos.** Ninguno en el contrato. Probado contra un backend local con 7 reportes: agrupación, flujo de
estados, filtros de periodo y municipio, y ancho de teléfono.

---

## 2026-11-24 · M7: el panel toma el aspecto de la app ciudadana y deja de amontonar consultas

**Qué cambió.** El panel deja la hoja del SND y usa el aspecto de la app ciudadana (kit gob.mx v3 como SIGRIV):
barra verde oscuro con el logotipo y las dos secciones a la derecha (en teléfono, «Monitoreo» y «Reportes»),
Montserrat en títulos y Noto Sans en el texto, guinda, dorado y fondo cálido, tarjetas redondeadas, pie verde.
La consulta al backend sale 3 s después de que termina la anterior, no cada 3 s fijos, y se pausa con la pestaña
oculta.
**Por qué.** El usuario pidió que el panel se vea como la app ciudadana. Al probarlo contra producción, el panel
se quedaba en «Comprobando conexión»: con `setInterval`, las 10 peticiones de cada vuelta se amontonaban y cada
respuesta tardaba ~36 s. Ahora la mediana es 1.5 s y el máximo 2.2 s (30 peticiones en 20 s).
**Qué arrastró.** D31 (revisada), `CLAUDE.md`, `panel/README.md`. Las clases del SND (`mensajeInformativo`,
`boton__primario`, `h0b`, `b1`) pasan a clases propias.
**Impacto en otros módulos.** Ninguno en datos. Quien lleva M7: el panel ya no carga `snd-guinda.css` y muestra
el logotipo oficial, que D31 evitaba; el pie sigue diciendo que es un prototipo.

---

## 2026-11-24 · M8: ríos del INEGI en el mapa de la app ciudadana, botón «Ríos» y carga sin esperas en cadena

**Qué cambió.** La app dibuja encima de la base los ríos de orden ≥ 4 (los de `mapa/`, compactados al compilar en
`rios.json`) y, desde zoom 12, los cauces de orden 3 (`rios_orden3.json`, nuevo, de `61_rios_menores_para_app.py`).
El flujo animado aguas abajo solo corre desde zoom 14. Botón «Ríos» para ocultarlos (recordado por navegador); los
cauces de la base se apagan mientras se ven los nuestros. Se ocultan los rótulos de comercios, transporte, números
de casa y aeropuertos de la base. Se quita `maxBounds`. La biblioteca del mapa se importa fija (alias
`biblioteca-mapa` en `vite.config.js`), con precarga, y los ríos se piden al terminar de dibujarse la base.
**Por qué.** En la base el cauce se pierde y la persona tiene que poner el pin sobre él. Con `maxBounds` a 0.5° de
la ventana, a zoom ≤ 8 el mapa no se dejaba arrastrar (a zoom 7 se movía 0 y saltaba a 7.68). En producción el
mapa tardaba ~7.5 s con una red irregular: la biblioteca se pedía hasta que la app ya había llegado y arrancado
(~1.3 s más en cadena), y los reportes y la huella se pedían dos veces al abrir. Medido en local: con y sin ríos,
60 cuadros por segundo al mover y sin bloqueos; por debajo de zoom 14 el mapa no redibuja nada.
**Qué arrastró.** `02-mapa-del-repo.md`, `CLAUDE.md`. Pesos: 215 KB comprimidos al abrir y ~240 KB más al acercar.
**Impacto en otros módulos.** Ninguno. `rios_orden3.json` sale de la red completa del INEGI (`datos/geo/`, no
versionada): si cambia el criterio, se regenera con el script, no se edita.

---

## 2026-11-24 · M7: la serie del expediente marca el evento completo

**Qué cambió.** La serie de "Evidencia" sombrea el evento de la alerta: las alertas de la misma estación
encadenadas con menos de 90 min entre sí, de la primera a la última, y avisa cuándo empezó si la alerta
abierta es posterior. Las tarjetas de la lista ya no muestran el responsable (solo en el expediente).
**Por qué.** En Vercel, AL-20261128-ATY01-31 (pH 7.59, 20:00) marcaba su hora bien, pero la descarga fue
a las 14:50: el motor (M2) sigue abriendo alertas de "cambio brusco" mientras el valor regresa a la banda.
**Qué arrastró.** `Serie.jsx`, `Expediente.jsx`, `ListaAlertas.jsx`, `App.jsx` (pasa `alertas`).
**Impacto en otros módulos.** M2: revisar que `cambio_brusco` no abra alertas en la recuperación.

---

## 2026-11-24 · M7: la huella se explica sola

**Qué cambió.** La huella dice qué es cada cuadro y cuánto dura ("cada cuadro = 15 min", mediana del
intervalo real entre lecturas), tiene eje de horas en punto con líneas guía, leyenda con nombres
(de "Mucho más bajo" a "Mucho más alto", y "Sin dato") y ventana al cursor en palabras en lugar del z.
**Por qué.** Petición del usuario: no se entendía qué significaba cada cuadro.
**Qué arrastró.** `Huella.jsx`, `estilos.css`.
**Impacto en otros módulos.** Ninguno; los cortes siguen siendo los del motor.

---

## 2026-11-24 · M7: la huella muestra una sola estación

**Qué cambió.** "Huella de las últimas horas" muestra una estación con una fila grande y separada por sonda,
con un selector propio. Sigue a la estación elegida en el mapa, la tabla o el filtro; sin elección, la
primera con alerta por atender. El selector no filtra la lista de alertas.
**Por qué.** Petición del usuario: las 5 estaciones juntas daban celdas diminutas y se leía raro.
**Qué arrastró.** `Huella.jsx`, `Panorama.jsx`, `App.jsx` (pasa `elegida`), `estilos.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: en el expediente se elige la sonda que se grafica

**Qué cambió.** Un clic en cualquier miniatura de "Todas las sondas de la estación" la muestra en la serie
grande de "Evidencia", con la banda de su sitio. Empieza en la sonda de la alerta y vuelve a ella al cambiar
de alerta; regla, criterio y respaldo solo se muestran para esa sonda.
**Por qué.** Petición del usuario: ver la serie de cualquier parámetro de la estación, no solo el alterado.
**Qué arrastró.** `Expediente.jsx`, `Serie.jsx` (prop `parametro`), `Miniaturas.jsx` (`elegido`, `onElegir`),
`estilos.css`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: el mapa vuelve a la mitad, junto al estado de las estaciones

**Qué cambió.** Corrige el orden de la entrada "orden de la vista de alertas": resumen; mapa y "Cómo están
las estaciones ahora" lado a lado; tabla de estaciones a todo el ancho; alertas con expediente; y al final
las gráficas (huella, por hora, por estación, por parámetro, avance).
**Por qué.** Al usuario no le gustó el mapa a todo el ancho; prefiere el arreglo original con la tabla y las
alertas antes de las gráficas.
**Qué arrastró.** Nada más.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el mapa con las estaciones se publica en /mapa/

**Qué cambió.** `panel/scripts/ensamblar-sitio.mjs` publica también el mapa: `mapa/` en `/mapa/`, sus capas
en `/datos/procesados/mapa/` y `sitios.geojson` con los fixtures. Su `config.js` se escribe al armar el sitio
desde la variable `MAPBOX_ACCESS_TOKEN` de Vercel (sin ella, MapLibre con OpenFreeMap). Desplegado, el mapa
lee las alertas de `/api` del mismo dominio y se lo pasa al simulador que abre, como ya hacía el simulador.
**Por qué.** El despliegue publicaba solo el simulador de una estación; faltaba el mapa desde el que se elige.
Probado armando el sitio en local y sirviéndolo: todas las capas responden 200 y al elegir una estación se
abre su simulador.
**Qué arrastró.** `mapa/mapa.js?v=21`, `backend/README.md`, D25, `02-mapa-del-repo.md`, `CLAUDE.md`.
**Impacto en otros módulos.** M7: ninguno en código; el sitio armado ahora incluye `/mapa/`.

---

## 2026-11-24 · Integración: simulador, backend, app y panel sincronizados y en un solo despliegue

**Qué cambió.** (1) El reloj del simulador arranca en la hora real cuando hay backend, o justo después de la
última lectura guardada; sin backend sigue desde `T0_DEFECTO`. (2) En la prioridad (D30), una alerta cuenta
como «mismo punto» si su sitio está a menos de 1 km sobre el cauce del sitio del reporte (`MISMO_PUNTO_CAUCE_M`).
(3) `vercel.json` compila también la app ciudadana y publica el simulador (`panel/scripts/ensamblar-sitio.mjs`),
todos contra `/api`; el simulador desplegado usa `/api` del mismo dominio. (4) `includeFiles` pasa a `contrato/*.py`.
(5) `backend/servidor.py --limpiar` revisa el puerto antes de borrar la base.
**Por qué.** (1) El simulador fechaba siempre el 2026-11-23 y los reportes llevan la hora real: la prioridad
solo los cruza a menos de 24 h, así que nunca se cruzaban; y cada recarga mandaba lecturas al pasado que se
mezclaban en el motor. (2) Un reporte en la estación ATY-01 se asigna a DLTLA0279RNL, 167 m aguas abajo de
DLTLA2554, y no recibía el bono de su propia alerta; ahora recibe +3 (prioridad 4 → 7). (4) Desde M8 el backend
carga `analisis_foto.py` y `prioridad_huella.py` al arrancar y la función de Vercel no los llevaba.
(5) Con el puerto ocupado borraba la base y luego no arrancaba.
**Qué arrastró.** `backend/README.md`, `02-mapa-del-repo.md`, D25 (ampliada), `17-plan-app-ciudadana.md`,
`12-estado-y-traspaso.md`, `CLAUDE.md`. Probado de punta a punta con el backend real y con una copia que solo
lleva lo que `includeFiles` incluye, servida en un origen como en Vercel. `vercel.json` es de quien lleva M5/M7:
el cambio lo pidió el usuario.
**Impacto en otros módulos.** Desplegado, quien abra el simulador escribe en la base real; dos simuladores a la
vez cruzan lecturas de las mismas estaciones. A 900× el reloj se adelanta unas 17 h por minuto: pasadas 24 h
simuladas, un reporte nuevo ya no se cruza con la alerta. `VITE_API_URL` ya no se configura en Vercel.

---

## 2026-11-24 · M4: la trayectoria del envío queda dibujada en la vista de comunicación

**Qué cambió.** Al abrir la vista de comunicación (antena o torre), la línea punteada de la antena a la
torre se queda visible todo el tiempo, no solo mientras un paquete viaja; se pone roja si el sitio no
tiene cobertura. En la vista general sigue apareciendo solo durante el envío.
**Por qué.** Lo pidió el usuario: entre envíos no se veía por dónde viajan los datos.
**Qué arrastró.** `escena.js?v=33`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: estados en palabras llanas, envío visible en comunicación y líneas sin cruzar rótulos

**Qué cambió.** Los estados se dicen sin jerga del firmware: "En reposo hasta las 10:30" en lugar de
"Dormido", "Preparando las sondas", "Enviando los datos", "Datos recibidos", "Esperando la próxima
medición". La vista de comunicación ya no frena el enlace y el envío a tiempo real: a la velocidad elegida
cada envío se dibuja completo y se repite a los pocos segundos. En las vistas de cerca, un rótulo que no
cabe afuera de su pieza (antena y torre, en los bordes) va junto a ella del lado de adentro, y su línea ya
no lo atraviesa.
**Por qué.** El usuario encontró los estados poco claros, el paquete aparecía pocas veces en la vista de
comunicación y las líneas de los rótulos de los extremos los cruzaban.
**Qué arrastró.** `escena.js?v=32`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: rótulos legibles y vistas de cerca del gabinete, la energía y la comunicación

**Qué cambió.** Los rótulos de la figura 3D son tinta con contorno blanco grueso (sin fondo) y la vista
general queda con cinco cortos: Sondas, Gabinete, Energía, Comunicación y Corriente, con su dato vivo.
Como las sondas, el gabinete, la energía y la comunicación tienen vista de cerca con un rótulo por pieza
(qué es y su estado). En cada vista van a tiempo real las fases que muestra (`Escena.tiempoReal`, que
usa `ui.js`).
**Por qué.** Los textos se perdían contra la vegetación, había especificaciones repetidas en la vista
general y el usuario pidió ver cada componente de cerca. Pidió explícitamente no usar fondo blanco.
**Qué arrastró.** `escena.js?v=30`, `ui.js?v=9`, `estilos.css?v=9`, D19, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno: la lógica del firmware y los paquetes no cambian.

---

## 2026-11-24 · M7: orden de la vista de alertas

**Qué cambió.** La vista de alertas del panel va en este orden: resumen, mapa de la red a todo el ancho,
lista de alertas con expediente, tabla y estado de las estaciones (matriz y huella) y al final los
conteos (por hora, por estación, por parámetro y avance). `Panorama.jsx` recibe `parte`.
**Por qué.** Petición del usuario: el mapa filtra la lista de alertas y estaban separados por cinco
gráficas; ahora cada bloque colinda con lo que tiene que ver.
**Qué arrastró.** Nada más.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: sin sitios de CONAGUA en el mapa de la red de estaciones

**Qué cambió.** `panel/src/graficas/MapaEstaciones.jsx` ya no dibuja los 219 sitios oficiales en gris
ni su ventana al pasar el cursor; tampoco descarga `sitios.geojson` ni los acredita.
**Por qué.** Petición del usuario: eran ruido visual sin información (D9) en una vista que solo debe
mostrar la red de estaciones.
**Qué arrastró.** Nada más.
**Impacto en otros módulos.** Ninguno; `mapa/` (M6) sigue mostrando sus sitios.

---

## 2026-11-24 · M6: el flujo se anima con una imagen de patrón, no con line-dasharray

**Qué cambió.** El flujo es un `line-pattern` con un guion blanco sobre fondo transparente; la imagen
(128 × 16 px) se redibuja en cada cuadro corrida unos píxeles (`StyleImageInterface.render`). Antes se
cambiaba `line-dasharray` cada 70 ms.
**Por qué.** Con el flujo en los 8 184 tramos, cambiar `line-dasharray` obliga a Mapbox GL 3 a rehacer los
teselados de toda la red en cada paso: el usuario vio el mapa lento y ríos que desaparecían al desplazarlo.
Subir una imagen pequeña a la tarjeta gráfica no toca la geometría.
**Qué arrastró.** `mapa.js?v=20`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el flujo en todos los ríos, con casilla para apagarlo

**Qué cambió.** Los guiones blancos del flujo corren en todos los ríos del mapa (y en los tramos que
conectan una estación con la red), no solo en los vigilados. Una casilla "Flujo del agua" en la barra
lateral lo enciende y apaga; al apagarlo se detiene también la animación.
**Por qué.** Lo pidió el usuario. Consecuencia: el mapa ya no distingue a simple vista qué tramos vigila
cada estación; eso sigue en `red_vigilada.geojson` y en docs/18.
**Qué arrastró.** `mapa.js?v=19`, `index.html`, `estilos.css?v=10`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el flujo vuelve a ser de guiones blancos

**Qué cambió.** Se quitan los puntos del flujo y vuelven los guiones blancos animados, ahora del mismo
grosor que el río (los ríos vigilados ya no son más anchos) y en el sentido corregido, aguas abajo.
**Por qué.** Al usuario no le gustaron los círculos; las líneas anteriores estaban bien.
**Qué arrastró.** `mapa.js?v=18`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: un solo estilo para los ríos, flujo blanco, cursor visible y base sin calles

**Qué cambió.** Todos los ríos con el mismo azul y un grosor que crece poco con el orden (de 0.85 a 1.6
veces); los tramos vigilados ya no son más anchos: se distinguen solo por el flujo, ahora puntos blancos
con borde azul. Se quitan las subcuencas (línea discontinua) y, de la base, las líneas de calles,
carreteras y vías; las fronteras estatales quedan en gris muy claro. El cursor sobre el mapa es una flecha
en tinta con borde blanco.
**Por qué.** El usuario veía cuatro tipos de línea mezclados (ríos de distinto color y grosor, flujo,
líneas de la base) y el cursor blanco del sistema se perdía sobre la base clara.
**Qué arrastró.** `mapa.js?v=17`, `estilos.css?v=9`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el flujo del mapa con puntos y el simulador se carga después del desplazamiento

**Qué cambió.** El trazo discontinuo se cambia por puntos azul oscuro con borde blanco, uno cada 2.2 km
de tramo vigilado, que avanzan del inicio al final de cada línea a 900 m de mapa por segundo (se
recalculan unas 30 veces por segundo). El sentido se comprobó con los datos: en 195 de 245 tramos de
`red_asignacion.json` la línea termina junto a su sitio aguas abajo. Al elegir una estación, el
simulador se carga cuando el mapa termina de desplazarse (o a los 0.9 s).
**Por qué.** El usuario no veía el trazo y notaba una pausa al hacer clic: el simulador arma su escena
3D en el mismo hilo que el mapa y lo detenía a mitad del desplazamiento.
**Qué arrastró.** `mapa.js?v=16`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: flujo en el sentido correcto, trazo visible, selección fluida y sin capas opcionales

**Qué cambió.** La animación del flujo se recorre al revés: el usuario vio que iba contra la corriente.
El trazo pasa de blanco a azul oscuro (#0b2e4a), más ancho, sobre tramos vigilados más anchos. Al elegir
una estación el diseño cambia de golpe (se quitó la transición de 0.22 s, que redibujaba el mapa en cada
paso) y el mapa se desliza en 0.6 s con `easeTo` en lugar del `flyTo` de 1.1 s. Se quitan las capas
opcionales: satélite, relieve y los 219 sitios oficiales. `96_red_estaciones.py` agrega a
`red_vigilada.geojson` los tramos que desembocan en cada estación a 3 km o menos: el Alseseca en
Totimehuacán es de orden 2 y la estación quedaba lejos de cualquier río dibujado.
**Por qué.** Lo pidió el usuario para dar claridad al mapa: una sola cosa a la vista.
**Qué arrastró.** `mapa.js?v=14`, `index.html`, `estilos.css?v=8`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno. La decisión D21 (satélite de Esri) queda sin uso en el mapa.

---

## 2026-11-24 · M6: los ríos vuelven a su estilo y el flujo se anima en los tramos vigilados

**Qué cambió.** Se quita el azul tenue de la red: todos los ríos vuelven a su azul de siempre. Los tramos
vigilados van un poco más anchos y con un trazo blanco discontinuo que avanza aguas abajo hacia la
estación (patrón de guiones que cambia cada 70 ms). Las líneas del INEGI están trazadas en el sentido
del flujo: en 321 nodos terminan dos o más líneas y en ninguno empiezan dos. Con
`prefers-reduced-motion` no se anima.
**Por qué.** Al usuario no le gustó el difuminado y pidió ver el flujo de los ríos en el mapa: el
movimiento dice qué agua llega a cada estación sin leyenda.
**Qué arrastró.** `mapa.js?v=12`, `mapa/README.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M6: el mapa abre en la zona de la red y resalta lo que vigila cada estación

**Qué cambió.** El encuadre inicial (y al cerrar una estación) es la zona de la red: tramos vigilados,
estaciones y la presa de Valsequillo, en lugar de toda la cuenca. La red de ríos va en azul tenue y,
encima, en el azul del agua y más gruesos, los 305 tramos del mapa que vigila alguna estación a 20 km
aguas arriba. `96_red_estaciones.py` los calcula y escribe `datos/procesados/mapa/red_vigilada.geojson`
(84 KB): un tramo del mapa es vigilado si su vértice central cae a menos de ~120 m de un tramo de
`red_asignacion.json` que llega a una estación.
**Por qué.** Con la cuenca completa (31 480 km²) las 5 estaciones quedaban amontonadas en una esquina y
parecía que casi nada estaba vigilado; el usuario lo notó. El contraste dice qué cubre la red y qué no.
**Qué arrastró.** `mapa.js?v=11`, `mapa/README.md`, `02-mapa-del-repo.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: el mapa de la red de estaciones es el mismo que el de mapa/

**Qué cambió.** "La red de estaciones" del panel deja el SVG dibujado y usa el mapa del módulo M6:
MapLibre con la base positron de OpenFreeMap (sus ríos y rótulos de calles apagados), las mismas
capas del INEGI (máscara y contorno de la cuenca, subcuencas, red hidrográfica por orden, nombres de
ríos, confluencias), los 219 sitios de CONAGUA y el mismo marcador de estación (negro, rojo con una
alerta por atender). Nuevo `panel/src/graficas/MapaEstaciones.jsx`; `scripts/copiar-datos.mjs` copia
las capas de `datos/procesados/mapa/`. No importa código de `mapa/`: lee los mismos archivos.

**Diferencias con mapa/.** Un clic en una estación filtra la lista de alertas del panel (en mapa/
abre el simulador). Encuadra las 5 estaciones, no toda la cuenca. El zoom con la rueda pide Ctrl,
para no secuestrar el desplazamiento de la página.

**Por qué.** El equipo pidió el mismo mapa que el módulo del mapa en lugar de uno dibujado.

**Verificación.** Escritorio, 375 px sin desborde y modo demostración sin llamadas al backend; el
clic en la estación 2 filtró la lista (0 de 5 alertas) y la marcó como elegida.

**Pendiente.** El mapa de la pluma ("Hasta dónde llega") sigue en SVG (`MapaRed.jsx`).

---

## 2026-11-24 · M7: plantilla del SND y más gráficas en el panel

**Qué cambió.** El panel enlaza la hoja de estilos del Sistema Nacional de Diseño, tema guinda (D31):
títulos en Patria, Noto Sans, botón primario y mensajes informativos del SND, encabezado y pie propios
en guinda (el pie dice que es un prototipo). Tres gráficas nuevas: mapa de la red (ríos de orden ≥ 5
del INEGI, los 219 sitios de CONAGUA y las 5 estaciones con su alerta más grave abierta), huella de las
últimas horas (cada sonda de cada estación por lectura, coloreada por el z robusto del motor en 7
pasos con los cortes del motor, 2, 3.5 y 6) y mapa de la pluma en "Hasta dónde llega" (sitios aguas
abajo por hora de llegada). "Fuente probable" va a todo lo ancho para la tabla de candidatos del DENUE.
`scripts/copiar-datos.mjs` copia `sitios.geojson` y recorta la red hidrográfica a `rios.json` (1 030
tramos, 134 kB). La foto de demostración se recapturó con las estaciones nuevas (D27), los candidatos
del DENUE, las predicciones y las prioridades de reportes.

**Por qué.** El equipo pidió la plantilla del gobierno y un tablero más visual.

**Verificación.** Escritorio y 375 px sin desborde; modo demostración sin llamadas al backend, con las
dos secciones (monitoreo y reportes); los colores nuevos pasan el validador de paletas (los dos brazos
de la escala divergente y la pluma como escalas ordinales). Al integrar se combinó con la división del
panel en dos secciones: sus pestañas quedan en la barra guinda.

**Qué arrastró.** D31, `panel/README.md`, `02-mapa-del-repo.md`, `03-tecnologias.md`.

---

## 2026-11-24 · M7: el panel se divide en monitoreo y gestión de reportes ciudadanos

**Qué cambió.** El panel de autoridad tiene dos secciones. «Monitoreo del prototipo» conserva las alertas y los avisos
técnicos. «Reportes ciudadanos» pasa de una tabla de lectura a gestión: mapa con la huella de calor y un pin por foco
(MapLibre, se descarga al abrir la sección), tabla de «Qué atender» con el desglose de la prioridad, fotos y selector
de estado por foco y por reporte. Nueva ruta `PATCH /reportes/<c_reporte>` (solo `estado`) en el mock y el backend
(D30). El mock ya no deja que dos instancias compartan el puerto en Windows.
**Por qué.** El usuario pidió separar lo que mide el prototipo de lo que gestiona la autoridad con los reportes de las
personas; sin poder cambiar el estado, la autoridad no podía atender nada.
**Qué arrastró.** `contrato/README.md` (ruta), `02-mapa-del-repo.md`, `CLAUDE.md`, `12-estado-y-traspaso.md`, D30,
`backend/prueba.py` (5 comprobaciones), `panel/package.json` (maplibre-gl 4.7.1).
**Impacto en otros módulos.** El panel lee `/prioridades` y `/huella` si existen y sigue funcionando sin ellas. En
Vercel, el panel necesita internet para la base del mapa. Sin inicio de sesión: cualquiera con la URL cambia estados.

## 2026-11-24 · M8: huella de calor y prioridad de reportes; el panel muestra qué atender primero

**Qué cambió.** `contrato/prioridad_huella.py` y las rutas `GET /huella` y `GET /prioridades` en el mock y el
backend. La app ciudadana pinta la huella sobre el río; el panel de autoridad muestra «Qué atender primero»
con el desglose de cada prioridad (D30).
**Por qué.** El usuario pidió definir la huella por densidad de reportes y la prioridad con todo lo que tiene
el proyecto. Pesos y umbrales son hipótesis sin datos reales.
**Qué arrastró.** `contrato/README.md` (rutas), `02-mapa-del-repo.md`, `05-decisiones-tecnicas.md` (D30),
`50_verificar_repo.py` (los módulos del propio contrato no cuentan como dependencia externa), `panel/`.
**Impacto en otros módulos.** El panel lee `/prioridades` si existe y sigue funcionando sin ella.
**Vercel.** `prioridad_huella.py` debe entrar en `includeFiles` de `vercel.json`.

## 2026-11-24 · M8: la foto de un reporte se valida con Gemini

**Qué cambió.** `POST /reportes/analizar-foto` (`contrato/analisis_foto.py`) en el mock y el backend. La app no
deja enviar una foto que no corresponda a ninguno de los 6 tipos; si falla el servicio, avisa y deja enviar
(D29). Los términos pasan a v2: la foto reducida va a Google.
**Por qué.** Evitar datos basura. `gemini-2.5-flash` ya responde 404 a cuentas nuevas: cadena de modelos.
**Qué arrastró.** `contrato/README.md`, `02-mapa-del-repo.md`, `03-tecnologias.md`, D29.
**Impacto en otros módulos.** Variable `GEMINI_API_KEY` en el `.env` local y en Vercel; `analisis_foto.py` en
`includeFiles` de `vercel.json`. Precisión con fotos reales sin medir.

## 2026-11-24 · M8: app ciudadana, prototipo con el flujo de SIGRIV

**Qué cambió.** Nueva carpeta `ciudadano/`: PWA en React y Vite con mapa y pin central, reporte con cámara o
galería, folio, rastreo, términos, cola sin señal y modo demostración (D28).
**Por qué.** M8 estaba pendiente; el usuario pidió replicar el flujo y el aspecto de SIGRIV (kit gob.mx v3).
**Qué arrastró.** `12-estado-y-traspaso.md`, `CLAUDE.md` (tabla de módulos, cómo correrla, excepción de diseño),
`02-mapa-del-repo.md`, `03-tecnologias.md`, D28.
**Impacto en otros módulos.** Ninguno en código. Falta el `buildCommand` de `vercel.json` y probarla en teléfono
real; la geolocalización exige HTTPS (túnel con cloudflared).

---

## 2026-11-24 · M10, M0: red de 5 estaciones elegida por cobertura; fixtures con esas 5

**Qué cambió.** `scripts/96_red_estaciones.py` elige la red entre los 69 sitios con historia de campo
por el número de establecimientos DENUE que vigila cada uno a 20 km aguas arriba, y escribe
`red/red_estaciones.csv`. `40_generar_fixtures.py` toma de ahí las estaciones: EST-ATY-01 Zahuapan
(DLTLA2554), 02 Tepetitla (DLTLA2577), 03 Papalotla (DLTLA2544), 04 Puebla (DLPUE1977) y 05 Alseseca
(DLPUE2064), numeradas de aguas arriba hacia aguas abajo. Nuevo `docs/18-red-de-estaciones.md` con la
curva de cobertura, el enlace por la red celular existente y costos por cotizar; D27.
**Por qué.** El número de estaciones lo limita el presupuesto. Las 5 anteriores, elegidas por ser las
más deterioradas, vigilaban 265 establecimientos (9 %); estas, 1 124 (39 %). De la sexta en adelante
cada estación agrega menos de 70.
**Qué arrastró.** Fixtures y escenarios regenerados; el motor da 0, 1, 5, 3 y 0 alertas (antes 0, 2, 5,
5, 0) y cumple su criterio (`docs/15` regenerado); `backend/prueba.py` (`ESPERADO`) y
`backend/README.md`; el mock reproduce los cinco escenarios sin errores de contrato; `ficha-tecnica.md`,
`docs/12`, `docs/README.md`, `02-mapa-del-repo.md`, `CLAUDE.md`.
**Impacto en otros módulos.** M5: `backend/prueba.py` no se corrió aquí (falta el entorno del backend).
M7: `panel/public/demo/foto.json` sigue con las estaciones anteriores; hay que recapturarlo con el backend
real (`npm run capturar-demo`). `prediccion_ejemplo.json` sigue sobre DLTLA2582: es un ejemplo de M3 y
regenerarlo pide `muestreo_nucleo.csv`.

---

## 2026-11-24 · M6, M4: menú del mapa plegable y estación bien encuadrada; sin volcán

**Qué cambió.** La barra lateral del mapa se pliega con un botón junto al título y queda una columna
con los números de las estaciones. Al abrir una estación se pliega sola, el mapa ocupa ≈ 40 % y centra
la estación a zoom 12.6 al terminar la transición, y el simulador ocupa 58 %; en el marco, la figura 3D
limita su alto al de la ventana para verse completa. Al cerrar, el menú vuelve como estaba. En la
figura 3D se quita el volcán del fondo.
**Por qué.** Con el menú fijo de 220 px el mapa quedaba en una franja de ≈ 170 px y la figura se cortaba
por abajo; el usuario pidió un menú desplegable y ver bien la zona y la figura.
**Qué arrastró.** `mapa/index.html`, `mapa.js?v=9`, `estilos.css?v=7`, `mapa/README.md`; en el
simulador `estilos.css?v=8` (modo incrustado) y `escena.js?v=28`; D19, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: vuelven las nubes difusas; cielo más azul

**Qué cambió.** Se quitan los cúmulos de base plana y vuelven las nubes difusas de antes, en su lugar.
El cielo pasa a un azul más intenso (cenit 3A7FCB, horizonte AECBE6) que llega casi hasta el horizonte.
**Por qué.** El usuario prefirió las nubes originales y pidió el cielo aún más azul.
**Qué arrastró.** D19, `escena.js?v=27`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: cielo más azul con cúmulos y zacatón en lugar de arbustos

**Qué cambió.** El cielo es azul hasta pocos grados sobre el horizonte y lleva ocho cúmulos de base
plana, bajos para que entren en la vista general. Los 40 arbustos redondos pasan a macollos de
zacatón: hojas finas que se arquean desde el centro, en tono paja.
**Por qué.** Lo pidió el usuario; los bultos redondos, como los árboles anteriores, distraían.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js?v=26`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: el envío a la torre se ve, con su confirmación

**Qué cambió.** La punta de la antena se ilumina al buscar red y al enviar; cada envío se dibuja en
2.3 s reales: el paquete sube a la torre, la torre se enciende, la confirmación (ACK) regresa y los
cubos de la SD desaparecen. Los rótulos acompañan: "Enviando", "Recibido: confirma a la
estación", "Confirmado: borra de la SD".
**Por qué.** A 300× el envío de 4 s simulados duraba 13 ms y no se veía; el usuario eligió la punta
que se ilumina, un envío con duración mínima y la confirmación de vuelta.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js?v=24`.
**Impacto en otros módulos.** Ninguno: el firmware y los paquetes no cambian.

---

## 2026-11-24 · M4: el agua se dibuja 4 veces más rápido

**Qué cambió.** La corriente visible del agua avanza 4 veces más rápido que la velocidad simulada; el
rótulo "Corriente" sigue dando la del modelo.
**Por qué.** A 0.6 m/s y desde la distancia de la cámara casi no se percibía el movimiento.
**Qué arrastró.** D19, `escena.js?v=23`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: ahuejotes en lugar de árboles de copa redonda

**Qué cambió.** Los 26 árboles de copa redonda (cuatro bultos cada uno) pasan a 12 ahuejotes de copa
angosta y alta, en verde grisáceo, al fondo y a los lados, dibujados con mallas instanciadas. Los
arbustos bajan de 70 a 40.
**Por qué.** El usuario notó que el árbol no se veía bien y que, al ser varios, distraía de la
estación. El ahuejote es el árbol de las orillas y canales del valle Puebla-Tlaxcala.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js?v=22`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: cielo, vegetación y corriente del río en la figura 3D

**Qué cambió.** Cielo con degradado y nubes; pasto, carrizo, arbustos y 14 árboles más, con mallas
instanciadas; el agua corre aguas abajo a la velocidad de `Agua.velocidad` (nueva en `modelo.js`) y
un rótulo "Corriente" la muestra como simulada.
**Por qué.** El usuario pidió cielo, vegetación y el flujo según los datos. No hay velocidad medida
en la cuenca y el caudal puntual solo existe en 1 de los 5 sitios de estación (DLPUE2063, mediana
671 L/s, n = 21): se simula con el centro del intervalo de M3 (0.6 m/s) y crece con la lluvia (Q^0.4).
**Qué arrastró.** D19, `CLAUDE.md`, `dispositivo/README.md`, `escena.js`, `modelo.js`; versiones en
`index.html`.
**Impacto en otros módulos.** Ninguno: la velocidad simulada no viaja en los paquetes ni la usa M3.

---

## 2026-11-24 · M4: vista de cerca de las sondas

**Qué cambió.** Clic en el tubo de las sondas o en su rótulo: la cámara se acerca y cada una de las
cinco sondas muestra su cabeza propia, qué mide y cómo, y su estado vivo (estabilizando con cuenta
regresiva, lectura k de 5, valor enviado o falla). Durante el calentamiento y la medición el
simulador va a tiempo real; "Vista general" o Esc regresa.
**Por qué.** El usuario quiere ver de cerca el funcionamiento de la sonda.
**Qué arrastró.** D19, `CLAUDE.md`, `escena.js` (vistas, selección, cabezas), `ui.js` (tiempo real en
la vista de cerca), `estilos.css`; versiones en `index.html`.
**Impacto en otros módulos.** Ninguno: el firmware y los paquetes no cambian.

---

## 2026-11-24 · M4: la figura 3D va fluida y siempre de día soleado

**Qué cambió.** La figura se dibuja en cada cuadro (antes 20 veces por segundo, junto con textos y
gráfica): girarla y el viaje del paquete pasan a 60 cuadros por segundo en el navegador integrado
con gráficos AMD integrados. La luz es fija de día soleado a media mañana, con gestión de color sRGB y
mapeo de tonos ACES; sombras calculadas una vez, con filtro PCF.
**Por qué.** El usuario notó poca fluidez y, al ser una demostración, quiere ver todos los mecanismos
de día. Los datos no cambian: el rótulo del panel sigue la hora del modelo de energía.
**Qué arrastró.** D19, `CLAUDE.md`, `ui.js` (bucle), `escena.js?v=15` y `ui.js?v=6` en `index.html`.
**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M4: la figura 3D con realismo moderado

**Qué cambió.** `escena.js` usa materiales físicos (acero, policarbonato, vidrio del panel, circuito
impreso), texturas dibujadas en código para suelo, corte, follaje y agua, árboles con copas de varios
bultos y sombras del sol. Los reflejos de un cielo degradado van solo en metal, vidrio y agua.
**Por qué.** El usuario pidió una figura más realista sin descargar modelos; se eligió el nivel que
no añade peso de carga ni movimiento decorativo.
**Qué arrastró.** D19 (revisión), `dispositivo/README.md`, `CLAUDE.md`, `escena.js?v=10` en el
`index.html` del simulador.
**Impacto en otros módulos.** Ninguno: el mapa muestra el simulador por URL y la lógica no cambió.

---

## 2026-11-24 · M7: el panel muestra hasta dónde llega la contaminación

**Qué cambió.** El expediente de cada alerta pide `GET /alertas/<c_alerta>/prediccion` (M3, servida
por el backend) y muestra: una frase con el primer sitio aguas abajo y su ventana de llegada, tres
cifras (llegada al primer sitio, sitios a menos de 50 km, valor esperado), una gráfica de ventanas
de llegada por sitio coloreada por confianza, la tabla con el valor esperado como banda p10 a p90 y
los supuestos del modelo. Con el mock, que no tiene esa ruta, lo dice y muestra la topología. La foto
del modo demostración (`panel/public/demo/foto.json`) se recapturó del backend y trae las 5
predicciones. Con esto M7 cumple su criterio de terminado y pasa a construido.

**Por qué.** Era lo único que le faltaba al criterio de M7, y responde lo que una autoridad pregunta
primero ante una descarga: a quién le llega y cuándo.

**Verificación.** Contra el backend local: la alerta de conductividad de ATY-01 llega primero a 0.5 km
entre +9 y +31 min, 22 sitios dentro de 50 km. Con el mock (`?api=`): mensaje y topología. Compilación
de producción sin backend: modo demostración con la predicción y ninguna llamada de red al backend.
A 375 px sin desborde. Los colores de confianza pasan el validador de paletas como escala ordinal.

**Qué arrastró.** `panel/README.md`, `CLAUDE.md`, `01-que-construimos.md`, `12-estado-y-traspaso.md`.

**Impacto en otros módulos.** Ninguno. M6 puede usar la misma ruta para pintar la pluma.

---

## 2026-11-24 · M5: la base en producción es Supabase

**Qué cambió.** El backend en Vercel guarda en el Postgres de Supabase por su Transaction pooler
(D26): conexión sin sentencias preparadas, URL limpia de parámetros de integraciones (`supa=`), las
cuatro tablas con RLS activo y el esquema solo se toca si falta algo. Documentación de Neon cambiada
a Supabase (`backend/README.md`, `panel/README.md`, `03-tecnologias.md`, `CLAUDE.md`, `api/index.py`).

**Tres errores que aparecieron al probar.** (1) Aplicar el esquema en cada conexión, ya con
`ENABLE ROW LEVEL SECURITY`, trababa a las instancias que escribían: Postgres reportó "deadlock
detected" en la prueba de dos instancias. Ahora se consulta `pg_class` primero. (2) En SQLite,
`PRAGMA journal_mode=WAL` corría antes de `busy_timeout`. (3) Aun con `busy_timeout`, pasar a WAL
falla al instante si otra conexión escribe (1 de 3 corridas daba "database is locked"); ahora solo
se pide si falta y se reintenta.

**Verificación.** `backend/prueba.py`: SQLite 37 de 37 en 8 corridas seguidas, Postgres 17 38 de 38
en 5 corridas seguidas. Nuevas: limpieza de la URL de la integración y, en Postgres, RLS activo en las
cuatro tablas.

**No verificado.** Supabase mismo: se probó contra un Postgres 17 local. El pooler de Supabase no se
probó; la opción `prepare_threshold=None` es la que documentan psycopg y Supabase para él.

**Impacto en otros módulos.** Ninguno. Nadie usa `@supabase/supabase-js`: el panel habla con el
backend.

---

## 2026-11-24 · M5: el backend corre en Vercel junto al panel, con Postgres

**Qué cambió.** Panel y backend se despliegan en un solo proyecto de Vercel (D25): `vercel.json`,
`api/index.py` y `requirements.txt` en la raíz; se quitó `panel/vercel.json`. El backend guarda en
Postgres cuando existe `DATABASE_URL` y en SQLite en local. El motor ya no vive en memoria: en cada
lote se reconstruye por estación con sus últimas 200 lecturas, bajo un candado por estación en la
base. Revisa D24 y D23.

**Verificación.** `backend/prueba.py` (36 comprobaciones) pasa en SQLite y en un Postgres 17 de
prueba, tres veces seguidas en Postgres. Dos instancias que se turnan los lotes de
`descarga_industrial` dan las mismas cinco alertas y folios que una. Sin el candado por estación, la
prueba directa del candado falla (la segunda conexión entra a los 0.15 s en vez de esperar). Con el
panel compilado con `VITE_API_URL=/api` y servido junto a `api/index.py` sobre Postgres:
`reproducir_escenario.py descarga_industrial --url .../api` da 5 alertas, el panel las muestra
conectado a `/api`, guarda el responsable y la predicción de M3 responde con 26 destinos.

**Dos errores que aparecieron al probar.** Dos instancias que arrancan a la vez sobre una base vacía
chocaban al crear las tablas en Postgres ("duplicate key ... pg_type_typname_nsp_index"); se crean
bajo un candado. Y desde Git Bash `VITE_API_URL=/api` llega como `C:/Program Files/Git/api`: en local
se compila desde PowerShell.

**No verificado.** El despliegue en Vercel mismo (lo hace el equipo a mano) ni Neon: se probó con un
Postgres 17 local.

**Qué arrastró.** `backend/README.md`, `panel/README.md`, D25 y notas de revisión en D23 y D24,
`03-tecnologias.md`, `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`, `CLAUDE.md`.

**Impacto en otros módulos.** El mapa y el simulador pueden apuntar a `https://<proyecto>.vercel.app/api`
con `?mock=` y `?backend=`. En Vercel, Root Directory deja de ser `panel`.

---

## 2026-11-24 · M5: backend real con FastAPI y SQLite

**Qué cambió.** Nueva carpeta `backend/` (D24): FastAPI con las rutas del contrato y las mismas
respuestas que `servidor_mock.py --motor real`, persistencia en SQLite, el motor de M2 y la
predicción de M3 en `GET /alertas/<c_alerta>/prediccion`. Al arrancar reproduce las últimas 200
lecturas de cada estación para recuperar el estado del motor, y sus folios siguen desde el mayor
guardado. Un reenvío idéntico de un paquete no se evalúa dos veces. `scripts/50_verificar_repo.py`
ya no revisa `node_modules/` ni `dist/`.

**Verificación.** `backend/prueba.py`, 29 comprobaciones, todas pasan: los cinco escenarios dan
0, 2, 5, 5 y 0 alertas como el motor; nueve rechazos con el mismo código y detalle que el mock,
comparado en vivo; reiniciar a mitad de `descarga_industrial` da las mismas cinco alertas y folios
que no reiniciar; la predicción es idéntica a `prediccion_ejemplo.json` de M3 (26 destinos); 1500
peticiones con 32 a la vez sin errores. Con servidores reales: `reproducir_escenario.py normal --url`
termina sin errores de contrato y con 0 alertas, `descarga_industrial` con 5, y tras matar y volver a
arrancar el proceso siguen las 960 lecturas, las 5 alertas y el reporte. El panel funciona contra él
sin cambios.

**Un error que hubo que corregir.** La conexión de SQLite se compartía entre hilos con candado solo
para escribir. El panel pide 8 cosas a la vez y algunas lecturas fallaban con "bad parameter or other
API misuse"; el navegador lo mostraba como error de CORS porque la respuesta 500 sale sin esas
cabeceras. Ahora todo pasa por el candado. La prueba 5 reproduce el fallo sin él (2 errores en 1500)
y pasa con él.

**Qué arrastró.** `contrato/README.md` (ruta nueva, solo en el backend), `01-que-construimos.md`,
`02-arquitectura.md`, `03-tecnologias.md`, D24, `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`,
`CLAUDE.md`, `.gitignore` (`backend/datos/`).

**Impacto en otros módulos.** El panel, el mapa, el simulador y `reproducir_escenario.py` funcionan
con el backend sin cambiar nada: mismo puerto 8080 y mismas respuestas. Si M3 cambia su fórmula o sus
constantes, `backend/prueba.py` falla y hay que actualizar `backend/propagacion.py`. M6 ya puede pintar
la pluma con `GET /alertas/<c_alerta>/prediccion`, pero el mock no tiene esa ruta.

---

## 2026-11-24 · M7: el panel pasa a React con Vite para desplegarse en Vercel

**Qué cambió.** `panel/` deja el HTML plano y es una aplicación React 18 con Vite (D23), con las
mismas vistas, gráficas y reglas. `scripts/copiar-datos.mjs` copia las cuatro tablas que lee a
`public/datos/` (no versionado) antes de `dev` y `build`. Sin backend configurado, la compilación
de producción entra en modo demostración con `public/demo/foto.json` (5 alertas y 2 reportes del
mock con `--motor real` sobre `descarga_industrial`). Dos arreglos que estaban pendientes en el
HTML plano quedaron incluidos: la columna de fuente probable ya no se aplasta y el texto de
propagación ya no dice que M3 está pendiente.

**Por qué.** Desplegar en Vercel. El HTML plano leía los datos con rutas `../` que no existen
cuando la raíz del proyecto en Vercel es `panel/`.

**Verificación.** `npm run build` sin errores (181 kB de JS, 59 kB comprimido). En desarrollo,
contra el mock: pestañas, expediente y guardado de responsable con clics reales (el texto escrito
sobrevive al sondeo de 3 s). La compilación de producción sin backend abre en modo demostración
y no hace ninguna llamada al puerto 8080. Sin desborde horizontal a 375 px.

**Qué arrastró.** `03-tecnologias.md`, D23, `02-mapa-del-repo.md`, `12-estado-y-traspaso.md`,
`CLAUDE.md`, `panel/README.md`.

**Impacto en otros módulos.** Ninguno en el contrato. Quien abría `http://127.0.0.1:8000/panel/`
ahora usa `npm run dev` en `panel/`.

---

## 2026-11-24 · Terreno de la figura 3D parecido a la cuenca

**Qué cambió.** `escena.js` reemplaza las cajas del corte por un valle con el río en un cauce de
taludes que serpentea, agua turbia (verde grisácea a café según la turbiedad), árboles en las
orillas y un volcán tenue al fondo. Las sondas, el cable y la torre se recolocaron sobre el terreno.
**Por qué.** La superficie anterior no se parecía a la cuenca.
**Qué arrastró.** `dispositivo/simulador/escena.js`, `index.html` (versión), `dispositivo/README.md`,
`05-decisiones-tecnicas.md` (consecuencia de D19), `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

## 2026-11-24 · M8 especificada, y sus dos dependencias de backend resueltas

**Qué cambió.** Nuevo `docs/17-plan-app-ciudadana.md`: la especificación completa de la app
ciudadana como **PWA en React y Vite** bajo `/ciudadano/`, con las decisiones tomadas y
justificadas, las alternativas descartadas, el contrato campo por campo y un criterio de
terminado medible. Y se implementaron las dos piezas de backend que el plan listaba como
dependencias:

- **`GET /reportes/{c_reporte}`** en el backend y en el servidor de pruebas. Devuelve un
  reporte sin el campo `correo` y 404 si el folio no existe.
- **Asignación al tramo del río** en `POST /reportes`, vía `backend/asignacion.py` y la red
  podada que produce `scripts/71_red_para_asignacion.py`.

**Por qué PWA y no Flutter.** El equipo ya tiene React, Vite y Vercel funcionando con el
backend en el mismo despliegue; Flutter sería un segundo toolchain, un APK que distribuir y
un emulador en la máquina del pitch. Y para una app de participación, pedir una instalación
es una barrera de adopción real: el reporte se levanta junto al río o no se levanta. SIGRIV
se quedó en web, así que tampoco hay código Flutter que reutilizar.

**La red podada.** La red completa son 65 342 tramos y 61 MB de shapefiles: no cabe en una
función de Vercel. Se conservan los tramos cuya cadena aguas abajo alcanza un sitio en
20 km o menos, que son **11 765**, con el trazo simplificado a unos 30 m. Resultado:
**1.6 MB**, versionado porque la función lo necesita desde el repositorio.

**Dos decisiones del asignador que conviene conocer.** La tolerancia es de **1 500 m**, no
los 150 m que se usaron para los sitios de monitoreo: un sitio de muestreo está en el río,
una persona reporta desde donde puede pararse y el GPS falla en una barranca. Si el punto
queda más lejos, el sitio va en `null` pero la distancia se reporta igual. Y se asigna el
sitio **aguas abajo**, no el más cercano, porque ahí es donde la contaminación reportada se
va a medir y es lo que permite cruzar el reporte con una alerta de sensor.

**Comprobado.** Las coordenadas exactas de un sitio enganchan entre 2 y 8 m; un punto en el
centro de Puebla da 1 064 m y se asigna; uno en Ciudad de México se rechaza. De punta a
punta contra el backend real, un reporte junto al río San Francisco quedó asignado a
`DLPUE1975` a 4.5 m del cauce. Las pruebas de `backend/prueba.py` siguen pasando, incluidas
las de concurrencia y la de la función de Vercel.

**Qué arrastró.** `backend/almacen.py` (busca un reporte por folio),
`contrato/servidor_mock.py` (misma ruta, el mock es la referencia ejecutable), `vercel.json`
(incluye el JSON en el bundle), `docs/README.md`,
`docs/contexto/02-mapa-del-repo.md`, `docs/12-estado-y-traspaso.md` y `CLAUDE.md`.

**Impacto en otros módulos.** Quien construya M8 ya no tiene dependencias de backend. Queda
pendiente a propósito el `buildCommand` de `vercel.json`, que no se puede aplicar antes de
que `ciudadano/` exista o el despliegue se rompe: va junto con el andamio.

---

## 2026-11-24 · Modelos proxy: uno sirve, el otro no, y una correccion

**Qué cambió.** Nuevo `scripts/90_modelos_proxy.py`. Ajusta las dos relaciones
sensor→laboratorio como leyes de potencia en espacio logarítmico y las **valida fuera de
muestra** de dos formas: ajustando con la mitad de los sitios y probando en los otros, y
calibrando por sitio para probar en fechas posteriores. Escribe
`datos/procesados/proxy_modelos.csv`, `contrato/fixtures/modelos_proxy.json` y
`docs/16-modelos-proxy.md`.

**Resultado.** `SDT = 0.788 × COND^0.972`: **2 %** de error mediano en sitios que el modelo
no vio, 7 % en el percentil 90. Es un sustituto real de una medición de laboratorio y se
publica. `SST` desde turbiedad: **35 %** de error mediano y 135 % en el percentil 90.
Calibrar por sitio apenas lo baja al 27 %, así que la dispersión es ruido dentro de cada
sitio y no un sesgo corregible. **No se publica.**

**La corrección.** El análisis exploratorio reportó correlaciones de 0.947 y 0.971 y yo las
cité repetidamente como evidencia de que ambos proxy servían. Esa cifra sobrevalora la
relación: está calculada sobre valores crudos que recorren cuatro órdenes de magnitud, donde
Pearson queda dominada por los valores grandes. En espacio logarítmico la de turbiedad cae a
0.852. Tiene sentido físico: la turbiedad responde al tamaño y al color de las partículas,
no solo a su masa, así que un arrastre de arcilla y una descarga orgánica con la misma
turbiedad llevan masas muy distintas.

**Qué arrastró.** Se corrigieron las afirmaciones en `docs/05-decisiones-tecnicas.md` (D12),
`docs/10-revision-critica-plan.md` (objeción 6 y la tabla de cambios a la etapa 3.1),
`docs/01-que-construimos.md` y **`dispositivo/ficha-tecnica.md`**, que decía que SST se
estimaría en el backend. El script `20_analisis_exploratorio.py` ahora imprime una
advertencia junto a su tabla de correlaciones para que nadie vuelva a leerla como capacidad
predictiva. Más `docs/README.md`, `docs/contexto/02-mapa-del-repo.md`,
`docs/12-estado-y-traspaso.md` y `CLAUDE.md`.

**Impacto en otros módulos.** M4 ya no debe anunciar SST entre lo que reporta la estación.
M5 puede aplicar el modelo de SDT desde `modelos_proxy.json`, siempre con su banda. El
criterio de publicación quedó escrito en el script: un modelo no entra al contrato solo
porque exista.

## 2026-11-24 · M6: el token de Mapbox se toma del .env

**Qué cambió.** Nuevo `mapa/generar_config.py`: lee `MAPBOX_ACCESS_TOKEN` del `.env` de la raíz y
escribe `mapa/config.js`. `.env` entra a `.gitignore`.

**Por qué.** El equipo quiere el token en un solo lugar, el `.env`. La página del mapa no puede
leerlo (corre en el navegador), así que el script lo copia al `config.js` que ya existía (D21). Se
niega a escribir un token secreto `sk.` o algo que no tenga forma de token público, y no lo
imprime completo. El token público sigue siendo visible en el navegador; la protección es la
restricción por URL en la cuenta de Mapbox, no esconderlo.

**Qué arrastró.** `mapa/README.md`.

**Impacto en otros módulos.** Ninguno. Quien ya tenía `mapa/config.js` a mano puede seguir así.

---

## 2026-11-24 · M7: gráficas en el panel y arreglo de las pestañas

**Qué cambió.** El panel suma un panorama de cinco gráficas arriba de la lista: alertas por
hora del día apiladas por nivel, una matriz estación × sonda con la posición de la última
lectura en la banda del sitio (sobre, dentro, bajo; viene de `posicion_en_banda` del
veredicto), alertas por atender por estación, alertas por parámetro y el avance de la
atención (abiertas, en atención, cerradas, descartadas). En el expediente se agregan
miniaturas de las cinco sondas de la estación contra su banda. Las pestañas de avisos y
reportes tienen su gráfica. Todas llevan tooltip, leyenda y nivel escrito, nunca solo color.
Se arregló que las pestañas no cambiaban: el JS buscaba la clase `.vistas` que el rediseño
renombró a `.subnav`.

**Colores de las gráficas.** Niveles: Crítica #9B0F15, Preventiva #A57F2C (dorado600 del
SND; el amarillo500 #684700 del SND se confunde con el rojo en deuteranopia, ΔE 2.4),
Informativa #224497. Validado con el script de paletas: separación para daltonismo ΔE ≥ 17 y
contraste ≥ 3:1; el azul queda más oscuro que la banda recomendada, compensado con etiqueta.

**Qué arrastró.** `panel/README.md`, D22 en `05-decisiones-tecnicas.md`.

**Impacto en otros módulos.** Ninguno.

---

## 2026-11-24 · M7: el panel adopta el Sistema Nacional de Diseño y se rediseña

**Qué cambió.** `panel/` cambia a la paleta y tipografía del SND, tema guinda (decisión D22), y
se reorganiza: cabecera institucional, resumen arriba (críticas por atender, por atender, sin
responsable, estaciones con falla técnica, con su hora de corte), tabla de las 5 estaciones
que filtra la lista al hacer clic, y en el expediente tres cifras clave (valor medido, banda
habitual con su `n`, lecturas seguidas fuera) antes de la gráfica. La gráfica se dibuja al
ancho real para que se lea en teléfono.

**Por qué.** El panel es para autoridades federales y la guía gráfica de gob.mx manda migrar al
SND. El diseño anterior no le gustó al equipo.

**Qué arrastró.** `05-decisiones-tecnicas.md` (D22), `panel/README.md`, `CLAUDE.md`.

**Impacto en otros módulos.** Ninguno en el contrato. Si M6 y M8 quieren verse igual, D22 dice
qué valores usar.

---

## 2026-11-24 · M7: prototipo del panel de autoridad y PATCH /alertas en el mock

**Qué cambió.** Nueva carpeta `panel/` (HTML, CSS y JS sin dependencias, mismo estilo que
el mapa). Lista las alertas con filtros por estado, nivel y estación; el expediente de cada
una muestra regla, criterio, lecturas seguidas, la banda p10 a p90 del sitio con su `n` y sus
fechas, una gráfica de las lecturas recientes contra esa banda, fuente probable, medidas
sugeridas y los sitios aguas abajo y aguas arriba con distancia sobre el cauce (M1). Permite
cambiar estado y asignar responsable. Avisos técnicos y reportes ciudadanos van en pestañas
separadas (I8). En el mock: `PATCH /alertas/<c_alerta>` (solo `estado` y `responsable`,
validado contra `alerta.schema.json`) y filtro `?c_estacion=` en `GET /veredictos`.

**Por qué.** El criterio de terminado de M7 pide cambiar estado y asignar responsable, y el
mock no tenía cómo escribir una alerta. El filtro por estación hace falta porque los últimos
50 veredictos globales cubren unas 2.5 h por estación, poco para ver la evidencia.

**Qué arrastró.** Tabla de rutas de `contrato/README.md`, `02-mapa-del-repo.md`,
`12-estado-y-traspaso.md` y `CLAUDE.md`. El esquema `alerta` no cambia: `estado` y
`responsable` ya existían.

**Lo que falta para terminar M7.** Predicción de llegada (espera a M3: hoy se dice "sin
predicción" y se lista la topología), fuente probable con puntaje (el stub no la calcula),
sesión de usuario y la ruta equivalente en el backend real (M5).

**Impacto en otros módulos.** M5 debe implementar `PATCH /alertas/<c_alerta>` con la misma
regla: solo `estado` y `responsable`, 422 para lo demás. El resto de frontends, ninguno.

---

## 2026-11-24 · Mapbox opcional por token

**Qué cambió.** Con `mapa/config.js` el mapa usa Mapbox GL JS (estilo claro y relieve); sin él,
MapLibre con OpenFreeMap. La casilla "Satélite" usa Esri World Imagery en ambos casos, porque el
satélite de Mapbox respondió 429 a todas las teselas con nuestra cuenta. `mapbox.txt` y `mapa/config.js` quedan en `.gitignore`.
**Por qué.** Se pidió usar Mapbox; el token no debe subirse al repositorio del equipo (D21).
**Qué arrastró.** `mapa/index.html`, `mapa/mapa.js`, `mapa/estilos.css`, `mapa/config.ejemplo.js`,
`mapa/README.md`, `.gitignore`, `03-tecnologias.md`, `05-decisiones-tecnicas.md` (D21),
`12-estado-y-traspaso.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

## 2026-11-24 · MapLibre en el mapa y vistas sin información de más

**Qué cambió.** El mapa pasa a MapLibre GL con la base vectorial de OpenFreeMap (ríos de la base
apagados, nombres en español) y relieve opcional. Se quitaron la leyenda, las notas, las fuentes
visibles y el estado del backend del mapa; y del simulador, la línea de fase, la tabla de
parámetros, las notas de la recepción y el panel "Más pruebas". Los valores medidos van en las
pestañas de la línea de tiempo; el simulador se conecta solo al backend.
**Por qué.** El usuario pidió varias veces quitar lo que nadie va a leer, y un mapa más capaz con
el relieve opcional (D20).
**Qué arrastró.** `mapa/` (todo), `dispositivo/simulador/` (`index.html`, `ui.js`, `recepcion.js`,
`estilos.css`), `dispositivo/README.md`, `dispositivo/ficha-tecnica.md`, `mapa/README.md`,
`03-tecnologias.md`, `05-decisiones-tecnicas.md` (D20), `12-estado-y-traspaso.md`, `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno: el contrato y las URL de incrustación no cambian
(`?backend=` ahora es opcional).

## 2026-11-24 · Cuenca delimitada con confluencias y estación en 3D

**Qué cambió.** `scripts/60_red_para_mapa.py` escribe dos capas nuevas: `cuenca.geojson` (contorno
exterior de las 10 subcuencas, 31 480 km²) y `confluencias.geojson` (14 uniones principales, por
longitud de red acumulada aguas arriba, con nombre de la toponimia). El mapa aclara lo de fuera de la
cuenca, traza el contorno y marca las confluencias. El simulador cambia la figura 2D por una escena
3D (Three.js) y el cuadro de la plataforma por una línea de tiempo de lo recibido (`recepcion.js`).
**Por qué.** Se pidió que la cuenca y sus bifurcaciones se vean con claridad y que el mecanismo se
vea más detallado y en 3D, sin ruido; y que el envío no sea un cuadro de "enviado o no" (D19).
**Qué arrastró.** `mapa/` (js, css, html, README), `dispositivo/simulador/` (`escena.js`,
`recepcion.js`, `ui.js`, `index.html`, `estilos.css`), `dispositivo/README.md`, `README.md`,
`03-tecnologias.md`, `05-decisiones-tecnicas.md` (D19), `contexto/02-mapa-del-repo.md`,
`12-estado-y-traspaso.md`, `CLAUDE.md`.
**Impacto en otros módulos.** M1 puede reutilizar el recorrido de la red de `confluencias()`. El
contrato no cambia.

---

## 2026-11-24 · M2: motor de reglas, de 31 falsas alarmas a 0

**Qué cambió.** Nuevo módulo `motor/` con `reglas.py` (`evaluar(paquete) → veredicto`),
`prueba.py` (banco de pruebas que mide el criterio de terminado y sale con código 1 si no
se cumple) y su README. `contrato/servidor_mock.py` acepta `--motor real`. Se agregó MAD a
la línea base (`scripts/20` y `scripts/40`).

**Resultado.** Día de control: **0 alertas**, contra 31 del evaluador provisional. Sensor
roto: **0 alertas ambientales** y 19 avisos técnicos. Los tres eventos detectados y su
fuente correctamente clasificada: municipal 0.90, industrial 0.80, arrastre 0.70.

**Las cuatro decisiones que lo lograron.** La salud del sensor se evalúa **primero** y saca
el parámetro de la evaluación ambiental: una turbiedad congelada en 37.5 donde la mediana
histórica es 368 habría parecido un evento enorme. El disparador es el **escalón** contra
las últimas horas, no la banda histórica: estas series están tan sesgadas que la media queda
muy por encima de la mediana y usar el z histórico como disparador daba **35** alertas en el
día de control, peor que la regla ingenua. La ventana de referencia lleva una **brecha de
guarda** de 2 h, porque sin ella una descarga en rampa contamina su propia referencia y el
evento no se detecta. Y se exigen **dos parámetros** coherentes, que es lo que distingue una
descarga de una sonda rota.

**El intercambio, explícito.** El criterio original pedía detección en menos de 45 min. Se
cumple en la industrial (15 min) pero no en la orgánica (75) ni la lluvia (90). Se probaron
cuatro variantes de umbral y persistencia y el tiempo **no cambió en ninguna**: el límite es
la exigencia de coherencia. Quitarla detectaría a los 45 min al precio de confundir sensores
rotos con eventos. Se prefirió no alarmar en falso y el criterio quedó replanteado:
detectar antes de que el evento alcance su intensidad plena, que los tres cumplen.

**El mismo error, dos veces más.** Clasificar la fuente falló primero por puntuar "pH fuera
de 6 a 9" como firma industrial, cuando en estos sitios el pH ya está normalmente bajo 6; y
después por juzgar "conductividad multiplicada" con el z, que depende del ruido de base, de
modo que una subida del 35 % daba z = 8. La lección: **el z sirve para detectar que algo
cambió, no para clasificar qué fue.** Clasificar exige las unidades de la cosa física.

**Qué arrastró.** `README.md`, `CLAUDE.md`, `docs/01`, `docs/12`, `docs/README.md`,
`docs/contexto/02-mapa-del-repo.md`, y los fixtures regenerados con MAD.

**Impacto en otros módulos.** El stub sigue siendo el valor por omisión del servidor a
propósito: es la vara medida y sustituirlo en silencio la borraría. `nivel_esperado` de M3
ya se puede llenar llamando a este motor. `riesgo_por_uso` sigue vacío: necesita los
criterios por uso destinado (F19).

---

## 2026-11-24 · M3: propagacion, y el modelo que los datos rechazaron

**Qué cambió.** Nuevo `scripts/80_propagacion.py`. Dada una alerta, devuelve a qué sitios
aguas abajo llega, en qué ventana horaria y con qué concentración, cumpliendo
`prediccion_propagacion.schema.json`. Escribe `red/atenuacion_observada.csv`,
`red/tiempo_viaje.csv` (5 769 pares), `contrato/fixtures/prediccion_ejemplo.json` y
`docs/14-propagacion.md`.

**Por qué el modelo no es el del plan, ni el que yo mismo había propuesto.** Antes de
escribir una línea se midió la razón entre la concentración aguas abajo y la de aguas
arriba, en tramos adyacentes muestreados **el mismo día**. Resultado: **mediana 1.00 en
los once parámetros, sin tendencia con la distancia** entre 0 y 20 km. No hay atenuación
neta medible: entre dos sitios entran tantas descargas como la autodepuración quita.
Declarar una constante de decaimiento de literatura habría quedado contradicho por 90
mediciones de este mismo río, así que **k = 0 y el transporte es conservativo**.

Es el segundo modelo que los datos descartan, después de Streeter-Phelps. No es un
fracaso: es el río diciendo lo que es.

**Un error de método que hubo que corregir.** La primera medición dio mediana 1.06 y una
k negativa, porque usaba los 6 276 pares de ancestría y contaba el mismo tramo físico
muchas veces. Con una razón por tramo adyacente la mediana cae a 1.00. Y la banda
predictiva se estima con las observaciones individuales, no con las medianas por tramo:
estimarla con medianas la dejaba demasiado angosta y la cobertura caía al 41 % en E_COLI.

**Lo que se descartó.** `ARBSUM_1` como proxy de caudal para calcular dilución: solo
explica el 40 % de la varianza (r = 0.63) en los 33 sitios con caudal medido. Y resultó
innecesario, porque la dilución ya está contenida en la banda medida. `factor_dilucion`
va nulo con su motivo escrito.

**Validación.** Monotonía de los tiempos: 210 de 210 sitios. Cobertura de la banda **fuera
de muestra** (estimada con la mitad de los tramos, medida contra la otra mitad, en las dos
direcciones): 71 a 81 %, **mediana 78 %**, frente al 80 % esperado. Lo que no se validó es
la velocidad del flujo: no hay un solo dato de velocidad ni de tiempo de viaje en la
cuenca. Es el supuesto más fuerte del modelo y se cierra con un aforo de flotador en campo.

**Qué arrastró.** Tres campos **opcionales** nuevos en
`prediccion_propagacion.schema.json` (`valor_estimado_min`, `valor_estimado_max`,
`advertencia`). Es un cambio aditivo, así que por la invariante I7 **no sube la versión del
contrato**. Más `docs/01-que-construimos.md`, `docs/12-estado-y-traspaso.md`,
`docs/README.md`, `docs/contexto/02-mapa-del-repo.md` y `CLAUDE.md`.

**Impacto en otros módulos.** El panel (M7) y el mapa (M6) ya pueden consumir
`prediccion_ejemplo.json` sin esperar a M5. `nivel_esperado` sale en `Sin dato` a
propósito: esa clasificación es de **M2** y escribirla aquí habría duplicado la regla.
Cuando M2 exista, se llena llamándolo.

---

## 2026-11-24 · M1: topologia de la red calculada

**Qué cambió.** Nuevo `scripts/70_topologia_red.py`. Engancha los 219 sitios a la red
hidrográfica del INEGI, orienta los 65 342 tramos hacia la salida de su componente y
calcula, para cada sitio, el siguiente aguas abajo y la distancia **sobre el cauce**.
Escribe `datos/procesados/red/` (cuatro tablas) y `docs/13-topologia-red.md`. Se quitó la
columna vacía `c_sitio_aguas_abajo` de `sitio.csv`.

**Resultado.** 210 de 219 sitios con sucesor, 6 276 pares arriba-abajo, mediana de
distancia al siguiente sitio 1 749 m. Enganche: mediana 11 m, 195 buenos de 219. Validado
por tres vías: los 4 pares que declaran su posición en el nombre coinciden, 204 de 210
pares consecutivos tienen orden de Strahler no decreciente, y la cadena cruza de Tlaxcala
a Puebla en 2 570 pares, que es la relación que importa porque el Zahuapan desagua en el
Atoyac.

**Dos errores que hubo que corregir.** El primero: enraizar cada subcuenca en el nodo más
cercano a su punto de drenaje dejaba sin orientar el 99 % de la red en 4 de las 10
subcuencas, porque la raíz caía en un fragmento suelto de 8 a 30 nodos. Se calculan las 52
componentes conexas y se orienta cada una desde su propio desagüe, identificado como el
nodo de grado 1 cuyo tramo tiene mayor `ARBSUM_1`. Pasó de 42 % a 100 % de tramos
orientados. El segundo: ocho sitios enganchaban a más de 500 m del cauce, uno a 11 km; son
jagüeyes y presas que la red 1:50 000 no conecta con el Atoyac. No se encadenan y quedan
con su motivo escrito, en lugar de inventarles un recorrido.

**Qué queda marcado.** 14 sitios con `revisar = si`: los 8 de enganche lejano y 6 donde el
orden de Strahler baja hacia su sucesor, que es físicamente imposible y apunta a un
enganche en la rama equivocada de una confluencia. Se publican marcados; quien consuma la
tabla puede filtrarlos.

**Qué arrastró.** `scripts/10_construir_tablas.py` (quita la columna),
`scripts/30_verificacion_datos.py` (su sección 10 pasó de BLOQUEANTE a OK y ahora lee la
tabla nueva), `docs/01-que-construimos.md`, `docs/12-estado-y-traspaso.md`,
`docs/README.md`, `docs/contexto/02-mapa-del-repo.md`, `datos/README.md` y `CLAUDE.md`.

**Impacto en otros módulos.** **M3 queda desbloqueada**: ya tiene la secuencia de sitios y
las distancias sobre el cauce que necesitaba. M7 puede responder "qué hay aguas arriba de
este punto" con `sitio_pares.csv`. M8 puede asignar un reporte al tramo correcto con
`sitio_red.csv`. Quien leía `c_sitio_aguas_abajo` de `sitio.csv` debe leer
`red/sitio_aguas_abajo.csv`. `red/tramo.csv` pesa 8.2 MB y no se versiona; las otras tres
tablas suman 0.25 MB y sí, para que nadie necesite bajar la red del INEGI.

## 2026-11-24 · La carpeta `documentacion/` pasa a llamarse `docs/`

**Qué cambió.** Renombrada con `git mv`, conservando el historial. Se actualizaron las 90
referencias a la ruta en 17 archivos, incluidas las rutas de salida de
`scripts/20_analisis_exploratorio.py` y `scripts/30_verificacion_datos.py`, y `CLAUDE.md`.
La estructura interna no cambió: siguen las dos secciones, con `contexto/` dentro.

**Por qué.** Lo pidió el usuario. `docs` es la convención que GitHub reconoce y es más
corta de escribir en los enlaces.

**Qué arrastró.** `CLAUDE.md`, `README.md`, `datos/README.md`, `datos/bitacora.md`,
`dispositivo/README.md`, los nueve documentos de `docs/` que se referenciaban entre sí,
y los tres scripts que mencionaban la ruta. Los dos documentos generados (`08-` y `09-`)
se regeneraron en la ruta nueva.

**Nota.** La entrada del 2026-11-23 dice que `docs/` pasó a `documentacion/`. Queda como
está: el registro es de solo añadir y el cambio de ida y de vuelta forma parte del
historial.

**Impacto en otros módulos.** Cualquier enlace o ruta guardada a `documentacion/...` hay
que cambiarla por `docs/...`. Ningún cambio de código ni de datos.

---

## 2026-11-24 · Documento de estado y traspaso

**Qué cambió.** Nuevo `docs/12-estado-y-traspaso.md`: estado por módulo, lo que puede
tomarse hoy sin esperar a nadie (M2, M1, M5, M10) con sus entradas, su criterio y cómo probar, y lo
que sigue siendo supuesto.
**Por qué.** Que un compañero pueda avanzar en otro módulo sin reconstruir el contexto.
**Qué arrastró.** `docs/README.md` (índice y ficha del dispositivo ya no pendiente),
`contexto/02-mapa-del-repo.md`, `contexto/00-LEEME-PRIMERO.md` (qué está construido),
`11-metodologia-modulos.md` (M4 y M6 hechos), `CLAUDE.md`.
**Impacto en otros módulos.** Ninguno.

## 2026-11-24 · Fondo de relieve en el mapa y componentes en la figura del simulador

**Qué cambió.** El mapa usa como fondo el relieve sombreado de Esri con los nombres de lugares encima, en lugar
de OpenStreetMap. En la figura del simulador, la caja "Estación" muestra sus tres componentes en renglones
separados por filetes: controlador (ESP32, reloj y SD: estado y paquetes en la SD), comunicación (módem
LTE-M: señal en dBm o "sin red") y energía (panel 5 W y 2 × 18650: batería y potencia solar), más un panel
solar y una antena dibujados en línea fina que solo cambian con el dato.

**Por qué.** El fondo de OpenStreetMap, aun en gris, tenía calles, manchas urbanas y ríos propios que
competían con la red del INEGI. En la figura, el usuario prefería ver los componentes descritos, dentro de
la misma figura y sin ruido.

**Qué arrastró.** `mapa/mapa.js`, `mapa/estilos.css`, `mapa/index.html`, `mapa/README.md`,
`dispositivo/simulador/escena.js`, `dispositivo/simulador/index.html` (`aria-label`),
`dispositivo/README.md`, `docs/03-tecnologias.md`, `CLAUDE.md`.

**Impacto en otros módulos.** Ninguno: no cambia el contrato ni los datos.

## 2026-11-24 · Simulador reducido a lo esencial

**Qué cambió.** La pantalla del simulador muestra ahora solo tres cosas: qué mide la estación, qué
análisis devuelve la plataforma y si hay alarma. Una figura (sonda en el río → estación →
plataforma), una tabla de cinco filas (valor, rango habitual del sitio con su `n` y su fecha, y el
análisis) y la franja de pruebas. El principio de medición de cada sonda queda plegado en su fila,
y las fallas de sonda, el mantenimiento, el clima, la dirección del backend y el último paquete
están en un bloque plegado. Se quitaron la gráfica, el registro del firmware, la barra de fases y
las ilustraciones por sonda.

**Por qué.** Las vistas existen para mostrar el funcionamiento del dispositivo mientras no hay
prototipo físico. Lo que hay que ver es qué analiza el sensor y si se envía una alarma, no la
documentación del dispositivo, que ya está en `dispositivo/ficha-tecnica.md`.

**Qué arrastró.** `dispositivo/simulador/` (`index.html`, `estilos.css`, `escena.js`, `ui.js`) y
dos filas de documentación. El análisis y la alarma que se muestran son la respuesta de
`POST /lecturas` (`veredictos[].parametros[].posicion_en_banda` y `veredictos[].alertas`); la pantalla
no calcula nada por su cuenta, de modo que cuando M2 sustituya al evaluador provisional se verá
su resultado sin tocar la interfaz.

**Impacto en otros módulos.** Ninguno. Sin el backend conectado, la plataforma aparece como
"sin conexión" y la tabla no muestra análisis.

---

## 2026-11-24 · Rediseño visual del mapa y del simulador

**Qué cambió.** El mapa y el simulador del dispositivo se rehicieron con otro criterio visual: tema
claro, un azul para el agua y tinta para las estaciones, trazo fino, filetes en lugar de tarjetas y
sin brillos ni animaciones decorativas. El mapa pasó a una barra lateral plana que hace de índice
y de leyenda (la lista de las 5 estaciones), con los sitios del monitoreo oficial en gris. El
simulador pasó a una lámina técnica de la instalación con rótulos y a una tabla de medición por
sonda; la barra de fases tiene el ancho proporcional a la duración real de cada fase.

**Por qué.** Los puntos del mapa no se entendían: 176 de 198 sitios con dato están en rojo, así
que pintarlos por semáforo (decisión D9) producía una nube roja sin información, y las
estaciones no se distinguían de ellos. Las pantallas anteriores usaban recursos de diseño
genérico (paneles translúcidos, resplandores, rótulos en mayúsculas espaciadas, tarjetas
idénticas, numerales encerrados) que no aportaban nada.

**Qué arrastró.** Solo `mapa/` y `dispositivo/simulador/` (`index.html`, `estilos.css`,
`escena.js`, `ui.js`, `mapa.js`). Sin cambios en el contrato ni en los datos.

**Impacto en otros módulos.** Ninguno. M6, M7 y M8 pueden tomar los criterios como referencia.

---

## 2026-11-23 · Mapa de la cuenca y red hidrográfica para pintar

**Qué cambió.** Se descargó la red hidrográfica del INEGI (F08, 36.8 MB, con
`scripts/00_descargar_fuentes.py F08`) y se extrajo a `datos/geo/`. Nuevo
`scripts/60_red_para_mapa.py`, que genera `datos/procesados/mapa/` con 8 184 tramos de orden ≥ 4,
las 10 subcuencas (con a cuál drena cada una) y los nombres de ríos, barrancas y presas. Nueva
carpeta `mapa/`: mapa con Leaflet, los 219 sitios, las 5 estaciones y zoom animado que abre el
simulador de la estación. El simulador acepta ahora parámetros de URL (`estacion`, `incrustado`,
`vel`, `backend`) y se rediseñó su vista: corte de la estación en el río y tarjetas con el
principio de medición de cada sonda.

**Por qué.** El mecanismo debe mostrarse dentro del mapa de la cuenca. La geometría oficial del
INEGI es la fuente que el proyecto ya había elegido (F08) y la que M1 necesita igual. Los
datos traen `ORDER_1` y el acumulado aguas arriba por tramo, útiles para el orden de los sitios.

**Qué arrastró.** `01-que-construimos.md`, `03-tecnologias.md` (Leaflet y OSM en uso; teselas de
CARTO descartadas porque ahora exigen llave), `02-mapa-del-repo.md`, `README.md`.

**Impacto en otros módulos.** M1: el shapefile ya está extraído y `60_red_para_mapa.py` incluye un
lector de shapefile y dbf sin dependencias que puede reutilizar (no calcula topología). M6: hay un
prototipo de mapa; el definitivo puede partir de él. El mapa necesita internet solo para el fondo.

---

## 2026-11-23 · Simulador web del dispositivo (M4) y ficha técnica

**Qué cambió.** Se creó `dispositivo/` con el simulador de la estación centinela: modelo del
agua (con la banda histórica real de cada sitio), sondas con sesgo, deriva, ensuciamiento,
saturación y fallas, energía solar y enlace celular, y un firmware como máquina de estados
pura (dormir, medir, guardar en SD, enviar, reintentar, muestreo adaptativo, ahorro por
batería). Incluye una interfaz web que anima los cuatro bloques (sondas, controlador,
comunicación, energía), una prueba en Node y la ficha técnica.

**Por qué.** El mecanismo debe demostrarse dentro de una interfaz web propia que después se
comunique con los demás módulos, y no exigir comprar hardware antes de validar el diseño
(D18). Resultados medidos: 96 paquetes por día y estación; 0 pérdidas ni duplicados en un
corte de red de 4 h; 486 paquetes validan con cero errores contra `lectura.schema.json`;
`POST /lecturas` responde 202; consumo ≈ 1.4 Wh/día y autonomía sin sol ≈ 14 días.

**Qué arrastró.** `05-decisiones-tecnicas.md` (D18), `03-tecnologias.md` (Wokwi descartado,
JavaScript plano y Node en uso), `01-que-construimos.md` y `02-arquitectura.md` (estado de M4),
`11-metodologia-modulos.md` (menciones a Wokwi), `02-mapa-del-repo.md` y `README.md`.

**Impacto en otros módulos.** Ninguno en el contrato: el simulador no lo toca. M5, M6 y M7
tienen ahora un emisor de lecturas con ciclo, retardo y cola realistas, además de
`reproducir_escenario.py`. Los números de energía son del modelo, no medidos en banco, y la
estimación a mano de la conversación de diseño (1.1 Wh/día, 19 días) queda corregida.

---

## 2026-11-23 · Verificación mecánica del repositorio y normalización de estados

**Qué cambió.** Se creó `scripts/50_verificar_repo.py`, que automatiza nueve
comprobaciones de invariantes y sale con código 1 si alguna falla. En su primera corrida
detectó que `sitio.csv` tenía tres valores de `estado` para dos estados: F01 escribe
`PUEBLA` y F05 escribe `PUEBLA DE ZARAGOZA`. Se agregó `normaliza_estado()` a
`scripts/_comun.py` y se reconstruyeron las tablas.

**Por qué.** Una invariante que no se puede comprobar no es una invariante. Y la variante
de nombre habría roto cualquier agrupación por estado en el mapa, el panel y las
estadísticas, de una forma difícil de notar: los totales simplemente no cuadrarían.

**Qué arrastró.** `scripts/_comun.py`, `scripts/10_construir_tablas.py`, las tablas
procesadas y los fixtures (regenerados), la invariante I6, la decisión D17,
`04-verificacion-obligatoria.md` (que ahora apunta al script en lugar de a comandos de una
línea), `02-mapa-del-repo.md` y las reglas de limpieza de `datos/README.md`.

**Impacto en otros módulos.** La columna `estado` de `sitio.csv` cambió de valor para 7
sitios que venían de F01. Quien filtre por `PUEBLA DE ZARAGOZA` debe cambiar a `PUEBLA`.
Los conteos de filas no cambiaron.

---

## 2026-11-23 · Documentación reorganizada en dos secciones

**Qué cambió.** `docs/` pasó a `docs/`, con los cinco documentos existentes
renumerados del 07 al 11 y seis documentos nuevos escritos a mano (01 a 06): qué
construimos, arquitectura, tecnologías, fuentes de datos, decisiones técnicas y glosario.
Se creó `docs/contexto/` con siete documentos para agentes de IA y
desarrolladores: este registro, las invariantes, el mapa del repositorio, las fronteras
entre módulos, la verificación obligatoria y el protocolo de cambios.

**Por qué.** El integrante a cargo de la documentación necesita el contexto del prototipo
en un solo lugar, y un agente que vigile el repositorio necesita saber qué no puede romper
antes de modificar algo. Son dos audiencias con necesidades distintas y por eso son dos
secciones separadas.

**Qué arrastró.** Rutas de salida de `scripts/20_analisis_exploratorio.py` y
`scripts/30_verificacion_datos.py`; enlaces en `README.md`, `datos/README.md`,
`datos/bitacora.md` y en los documentos movidos. El plan original (ahora 07) se dejó
intacto como registro histórico, incluidas sus referencias a la vieja carpeta `docs/`.

**Impacto en otros módulos.** Ninguno en código. Quien tenga un enlace guardado a
`docs/...` debe actualizarlo.

---

## 2026-11-23 · Contrato de datos v1.0, fixtures y servidor mock

**Qué cambió.** Se creó `contrato/` con siete esquemas JSON Schema (`lectura`,
`veredicto`, `alerta`, `estacion`, `linea_base`, `prediccion_propagacion`,
`reporte_ciudadano`), un validador sin dependencias, un servidor mock con evaluador stub,
un reproductor de escenarios y fixtures generados con la banda histórica real: 5
estaciones, 25 filas de línea base, 219 sitios en GeoJSON y 5 escenarios de un día
completo.

**Por qué.** Para que ocho módulos puedan avanzar en paralelo sin que nadie espere a
nadie. El esquema `veredicto` no estaba en el plan original y es la frontera más
transitada del sistema: sin él, el motor de reglas y la plataforma no se pueden
desacoplar.

**Qué arrastró.** `scripts/40_generar_fixtures.py` nuevo. `README.md` del repositorio.
`docs/11-metodologia-modulos.md`, que se apoya en estas piezas.

**Impacto en otros módulos.** Es la base de todos. Contrato congelado en v1.0 a la espera
de la revisión del equipo. Los 2 016 paquetes de fixtures validan con cero errores.

---

## 2026-11-23 · Medición de la línea base del evaluador stub

**Qué cambió.** Se midió cuántas alertas produce la regla ingenua del plan (salir de la
banda p10–p90 tres lecturas seguidas) en cada escenario, con un servidor limpio por
escenario: 31 en `normal`, 28 en `descarga_organica`, 35 en `descarga_industrial`, 36 en
`lluvia`, 7 en `falla_sensor`.

**Por qué.** 31 alertas en un día sin ningún incidente contra 35 con una descarga
industrial demuestra que la regla ingenua **no discrimina**. Por construcción, el 20 % de
las lecturas normales cae fuera de la banda p10–p90. Esto convierte una opinión de diseño
en un número.

**Qué arrastró.** Tabla en `contrato/README.md`, decisión D10 de
`05-decisiones-tecnicas.md`, criterio de terminado de M2 en
`11-metodologia-modulos.md` y la objeción 4 de `10-revision-critica-plan.md`.

**Impacto en otros módulos.** Es la vara del módulo M2: llegar a dos alertas o menos en
`normal` sin perder el evento en los otros escenarios.

---

## 2026-11-23 · Seis objeciones al plan de etapas 2 a 8

**Qué cambió.** Se escribió `10-revision-critica-plan.md`. Decisiones que se derivan:
el semáforo deja de ser el eje analítico y pasa a ser solo la capa ciudadana (D9); la
desviación de la línea base pasa a ser la regla primaria y el umbral fijo solo gradúa la
gravedad (D10); Streeter-Phelps se reemplaza por transporte advectivo con decaimiento
(D11); no se intenta pronóstico temporal (D12); la NOM-001 se aplica solo a puntos de
descarga (D13).

**Por qué.** Cada una con su número: 176 de 198 sitios en rojo, así que el color no ordena
nada; OD mediano de 1.38 mg/L y caudal en solo el 32.5 % de los muestreos, así que no hay
con qué calibrar Streeter-Phelps; 49 días de mediana entre muestreos, así que no hay serie
de tiempo; y la NOM-001 regula descargas, no cuerpos receptores.

**Qué arrastró.** `05-decisiones-tecnicas.md` (D9 a D13), los esquemas `veredicto`,
`alerta` y `prediccion_propagacion`, que implementan estas decisiones.

**Impacto en otros módulos.** M2 y M3 cambian de enfoque respecto del plan original. M6,
M7 y M8 reciben tres capas de salida en lugar de un solo semáforo.

---

## 2026-11-23 · Verificación del conjunto de datos

**Qué cambió.** Se creó `scripts/30_verificacion_datos.py`, que emite un veredicto por
sección. Resultados: el solapamiento entre F01 y F05 coincide en 99.3 % de los casos (OK);
cero choques de unidades entre fuentes (OK); línea base suficiente en los cinco parámetros
medibles con sensor (OK); caudal en solo 32.5 % de los muestreos (ATENCIÓN); 11 sitios que
en realidad son descargas y no cauce (ATENCIÓN); el semáforo no discrimina (ATENCIÓN); el
modelo de propagación tal como se planteó no se sostiene (BLOQUEANTE); la topología del río
está sin calcular (BLOQUEANTE).

**Por qué.** Antes de declarar concluida la Etapa 1 había que saber si el conjunto de datos
aguanta lo que las etapas siguientes le van a pedir.

**Qué arrastró.** `docs/08-verificacion-datos.md`, generado. Refactor de
`scripts/10_construir_tablas.py` para extraer la lógica compartida a `scripts/_comun.py`,
verificado con salida byte a byte idéntica.

**Impacto en otros módulos.** La topología (M1) queda identificada como el verdadero camino
crítico: alimenta a M3, M7 y M8 a la vez.

---

## 2026-11-23 · Etapa 1: conjunto de datos del Alto Atoyac

**Qué cambió.** Se descargaron 17 archivos de CONAGUA e INEGI (138 MB) y se construyeron
las tablas del modelo de datos: 219 sitios, 347 parámetros, 145 703 resultados de
2012-11-06 a 2025-12-08, 146 umbrales entre la escala de CONAGUA y la NOM-001. Más el
análisis exploratorio: línea base por sitio y parámetro, ranking de sitios críticos,
comparación por temporada, tendencia anual, cobertura y correlaciones.

**Por qué.** Es la base de todo el sistema: en un río permanentemente fuera de norma, la
línea base histórica de cada punto es el único mecanismo capaz de detectar un evento nuevo.

**Qué arrastró.** Todo el repositorio: `scripts/`, `datos/`, `datos/bitacora.md`,
`datos/README.md`.

**Impacto en otros módulos.** Tres hallazgos que cambian decisiones de diseño: turbiedad
correlaciona 0.947 con SST y conductividad 0.971 con SDT, lo que permite estimar dos
parámetros de laboratorio desde sensores baratos; la DBO mediana se duplica en estiaje
frente a lluvias; y los metales suben juntos (Cu-Ni 0.885), firma distinta de la de aguas
residuales urbanas.

**Correcciones al inventario de fuentes del plan.** Los archivos de F01 estaban como
anotaciones de hipervínculo dentro del PDF de transparencia, no en su texto.
`datos.conagua.gob.mx` está detrás de Imperva y responde 403 a clientes que no son
navegador; el mismo contenido, más reciente, está en `gob.mx/conagua`. La red hidrográfica
correcta del INEGI es el upc 702825006881, detrás de un buscador con JavaScript. Las
páginas del SMN cargan sus enlaces con JavaScript y las rutas antiguas responden error 500.

---

## Inconsistencias detectadas

Contradicciones entre documentación y código que todavía no se resuelven. El código manda
cuando hay duda, pero la contradicción se anota aquí hasta que alguien la cierre.

*(ninguna por ahora)*

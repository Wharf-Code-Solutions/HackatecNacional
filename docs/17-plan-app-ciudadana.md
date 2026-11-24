# Plan de trabajo: app ciudadana (M8)

**Para quien la va a construir.** Este documento es la especificación completa. Las
decisiones ya están tomadas y justificadas: no hace falta volver a elegir stack, ubicación
ni paleta. Lo que sí hace falta es leer la sección de **dependencias de otros** antes de
empezar, porque dos cosas no están en tus manos.

Antes de escribir código, lee también `docs/contexto/00-LEEME-PRIMERO.md` y
`01-invariantes.md`: hay reglas del repositorio que esta app tiene que respetar, en
particular la I12, la I13 y la I14.

---

## 1. Qué se construye

Una **PWA** (web móvil instalable) para que una persona parada junto al río levante un
reporte con foto y ubicación, y después consulte en qué va.

Cinco pantallas, nada más:

1. **Inicio**: el estado del agua del punto más cercano y el botón de reportar.
2. **Reportar**: tipo, foto, ubicación, descripción opcional, correo opcional.
3. **Confirmación**: el folio, grande y copiable.
4. **Consultar folio**: estado del reporte.
5. **Mi punto**: ficha del sitio de monitoreo más cercano, con su número, su fecha y su `n`.

## Qué NO se construye

- **No hay cuentas ni inicio de sesión.** Un reporte anónimo con folio es suficiente y
  reduce la fricción a cero. El correo es opcional y solo para avisar del cierre.
- **No hay chatbot.** Se evaluó y se dejó fuera por ahora: ver la sección 14.
- **No hay clasificación automática de la foto por modelo.** Sí hay control de calidad
  determinista: ver la sección 9.
- **La app no evalúa nada.** No calcula el color, ni el índice, ni decide si algo es grave.
  Eso lo entrega el backend. Si no hay backend, dice "sin conexión" y no inventa.

---

## 2. Lo que ya existe y hay que reutilizar

No escribas de cero nada de esta lista.

| Qué | Dónde | Cómo se usa |
|---|---|---|
| **Esquema del reporte** | `contrato/esquemas/reporte_ciudadano.schema.json` | Es el contrato. Todo campo que mandes tiene que estar ahí: el esquema tiene `additionalProperties: false` y el backend rechaza con 422. |
| **Validador sin dependencias** | `contrato/validador.py` | Para probar tus payloads desde la terminal: `python contrato/validador.py reporte_ciudadano mi_payload.json` |
| **Endpoint de reportes** | `POST /reportes` y `GET /reportes` del backend | Ya existen y funcionan. Ver sección 6. |
| **Los 219 sitios con su estado** | `GET /sitios.geojson`, o `contrato/fixtures/sitios.geojson` | Para "el punto más cercano" y la ficha. |
| **Servidor de pruebas** | `python contrato/servidor_mock.py` | Backend completo en local, sin instalar nada. Arranca en `http://127.0.0.1:8080`. |
| **Patrón de descubrimiento del backend** | `panel/src/lib/datos.js`, función `origenBackend()` | **Cópialo tal cual.** Resuelve `?api=` en la URL, luego `VITE_API_URL`, luego el mock local en desarrollo, y si nada: modo demostración. |
| **Copia de tablas a `public/`** | `panel/scripts/copiar-datos.mjs` | Mismo patrón: la fuente de verdad se queda en el repo, se copia a `public/datos/` en el prebuild. |
| **Tokens visuales** | `panel/src/estilos.css`, bloque `:root` | Ver sección 8. |

---

## 3. Decisiones ya tomadas, con su razón

Para que no se vuelvan a discutir. Si alguna te estorba de verdad, dilo antes de cambiarla.

**D-A. PWA, no Flutter.** El equipo ya tiene React + Vite desplegado en Vercel y el backend
en el mismo despliegue. Flutter sería un segundo toolchain, un APK que distribuir y un
emulador en la máquina del pitch. Y para una app de participación ciudadana, pedir una
instalación es una barrera de adopción real: el reporte se levanta en el momento en que la
persona ve el problema, o no se levanta. Con una PWA, en el pitch se pone un QR y el jurado
la abre en su propio teléfono.

**D-B. React + Vite, igual que el panel.** Misma versión de React (18.3.1), mismo Vite
(5.4.11), mismo `@vitejs/plugin-react`. Un solo stack que mantener.

**D-C. App aparte, no rutas dentro del panel.** Son dos audiencias opuestas. Bundlear las
gráficas del panel en la descarga de un ciudadano con datos móviles es inaceptable, y el
panel no está pensado mobile-first. Carpeta propia, bundle propio.

**D-D. Un solo despliegue, bajo `/ciudadano/`.** Ver sección 5.

**D-E. Sin librería de mapas.** Para "¿dónde estoy?" basta la geolocalización del navegador
y la lista de sitios ordenada por distancia. Meter Leaflet o Mapbox suma peso, una llave y
un riesgo de red en el pitch. El mapa de la cuenca ya existe en `mapa/` para quien lo
quiera ver; desde la app se enlaza.

**D-F. El EXIF se quita en el teléfono, no en el servidor.** Dibujar la imagen en un
`<canvas>` y re-codificarla elimina los metadatos como efecto del propio re-encode. Así las
coordenadas del denunciante nunca salen del dispositivo. Es la invariante I14 y el backend
rechaza con **409** si `exif_removido` no viene en `true`.

**D-G. La foto viaja como miniatura en `data:` URI.** Ver sección 7, con su justificación y
el camino de producción.

---

## 4. Alternativas que se evaluaron y por qué se descartaron

| Alternativa | Por qué no |
|---|---|
| **Flutter** | Ver D-A. Ganaría si existiera código reutilizable de SIGRIV, pero SIGRIV se quedó en web. También ganaría para **captura offline**, que es su ventaja real: ver sección 12. |
| **Rutas dentro del panel React** | Ver D-C. Simplifica el despliegue y empeora el producto. |
| **Segundo proyecto de Vercel** | Funciona y evita tocar `vercel.json`, pero deja dos dominios y dos despliegues que mantener. Queda como respaldo si la sección 5 se complica. |
| **HTML y JS plano sin build** | Tentador por lo ligero, pero perdería el patrón de `copiar-datos`, el manejo de variables de entorno y la consistencia con el panel. |
| **Subir la foto a Supabase Storage** | Es lo correcto en producción y está en la sección 7 como trabajo futuro. Para la entrega mete un bucket, políticas y subida firmada: más superficie de la que el tiempo permite. |
| **Clasificar la foto con un modelo** | No hay ni una imagen etiquetada del Atoyac: entrenar algo es imposible y presentarlo como entrenado sería falso. Un modelo preentrenado por API añade dependencia de red el día del pitch. Ver sección 9. |

---

## 5. Ubicación y despliegue

### Ubicación en el repo

```
ciudadano/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── datos/            ← lo llena scripts/copiar-datos.mjs en el prebuild
├── scripts/
│   └── copiar-datos.mjs  ← adaptado del panel
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── estilos.css
    ├── lib/
    │   ├── backend.js    ← origenBackend() copiado del panel
    │   ├── foto.js       ← downscale, re-encode, control de calidad
    │   ├── ubicacion.js  ← geolocalización y sitio más cercano
    │   └── almacen.js    ← cola local de envíos pendientes
    └── pantallas/
        ├── Inicio.jsx
        ├── Reportar.jsx
        ├── Confirmacion.jsx
        ├── Folio.jsx
        └── MiPunto.jsx
```

`vite.config.js` debe llevar **`base: '/ciudadano/'`**, o los assets se piden desde la raíz
y el despliegue da 404.

### El cambio en `vercel.json`

Hoy el despliegue tiene una sola salida, `panel/dist`. La app se construye y se copia
dentro de esa salida. **Este archivo es de Evaristo (M5/M7): pídele que aplique el cambio,
no lo hagas por tu cuenta.** Es esto:

```json
"installCommand": "cd panel && npm ci && cd ../ciudadano && npm ci",
"buildCommand": "cd panel && npm run build && cd ../ciudadano && npm run build && cp -r dist ../panel/dist/ciudadano"
```

El resto del archivo no cambia. Queda:

- panel en `https<dominio>/`
- app ciudadana en `https<dominio>/ciudadano/`
- backend en `https<dominio>/api/...`

Mientras eso no esté, trabaja en local con `npm run dev` y el mock. **No te bloquees por
el despliegue.**

---

## 6. El contrato, campo por campo

`POST /reportes` con `Content-Type: application/json`. El backend pone por omisión
`version`, `estado`, `exif_removido`, `c_reporte` y `fecha_hora`, valida contra el esquema
y responde **201** con `{"c_reporte": "...", "estado": "Recibido"}`.

| Campo | Quién lo llena | Notas |
|---|---|---|
| `version` | backend | `"1.0"`. Puedes mandarlo igual. |
| `c_reporte` | **backend** | No lo generes tú: el folio sale de un conteo transaccional para que dos reportes simultáneos no se lleven el mismo. |
| `fecha_hora` | app | ISO 8601 **con zona horaria**. `new Date().toISOString()` da `Z`, que es válido. |
| `tipo` | app | Exactamente uno de: `descarga_visible`, `espuma`, `color_anormal`, `mal_olor`, `basura_o_residuos`, `peces_muertos`, `otro`. |
| `descripcion` | app | Opcional, máximo 1000 caracteres. |
| `latitud`, `longitud` | app | Deben caer en 17.5–20.5 N y −99.5 a −97.0 W, o el esquema rechaza. Si el GPS da algo fuera, dilo en pantalla: probablemente la persona no está en la cuenca. |
| `precision_ubicacion_m` | app | De `coords.accuracy`. Mándalo: sirve para juzgar el reporte. |
| `foto_url` | app | Miniatura como `data:` URI. Ver sección 7. |
| `exif_removido` | app | **Obligatorio en `true`** o el backend responde 409. Ponlo en `true` solo si de verdad pasaste por el canvas. |
| `c_sitio_asignado` | **backend** | Ver sección 10. No lo mandes. |
| `distancia_al_cauce_m` | **backend** | Igual. |
| `correo` | app | Opcional. Si viene, el esquema pide formato de correo. Nunca se muestra en ninguna vista. |
| `estado` | backend | `Recibido`. |
| `c_alerta_relacionada` | backend, después | La vinculación con una alerta de sensor no es de la app. |
| `clasificacion_automatica` | nadie, por ahora | Ver sección 9. |

> El esquema tiene `additionalProperties: false`. **Un campo de más hace fallar el envío
> completo con 422.** Si necesitas mandar algo que no está, se agrega al esquema con el
> protocolo de `docs/contexto/05-protocolo-de-cambios.md`, no por tu cuenta.

### La consulta de folio ya existe

**`GET /reportes/{c_reporte}`** está implementada en el backend y en el servidor de pruebas.
Devuelve un solo reporte, **sin el campo `correo`**, y responde **404** con un mensaje que
recuerda el formato si el folio no existe. Úsala directamente: no filtres la lista.

---

## 7. La foto

**Pasos, en este orden:**

1. Captura con `<input type="file" accept="image/*" capture="environment">`. Funciona en
   Android Chrome y en iOS Safari, y abre la cámara directamente.
2. Carga en un `<img>` y dibuja en un `<canvas>` reescalando al **lado mayor de 640 px**.
3. Exporta con `canvas.toBlob(..., 'image/jpeg', 0.6)`.
4. Convierte a `data:` URI y pon `exif_removido: true`.

Eso da entre 40 y 60 KB, que viaja bien por datos móviles y cabe en el registro sin
inflar la base. **Y el re-encode elimina el EXIF como efecto secundario**, que es
exactamente lo que la invariante I14 pide.

**Por qué miniatura y no la foto completa.** `GET /reportes` devuelve todos los reportes
con todos sus campos, así que una foto de 2 MB por reporte haría que el panel descargara
decenas de megas. Con 640 px se ve perfectamente que hay espuma o un tubo descargando, que
es para lo que sirve.

**Camino de producción, a documentar y no implementar ahora:** subir la foto completa a
Supabase Storage con una URL firmada y dejar en `foto_url` la URL pública; mantener la
miniatura para la lista y pedir la completa solo en el detalle.

---

## 8. Lenguaje visual

**Toma el flujo de SIGRIV y la apariencia del panel.** El flujo de SIGRIV ya está validado
con usuarios reales y no se rediseña; la piel tiene que ser la del panel o el sistema se va
a ver como dos productos distintos.

Copia el bloque `:root` de `panel/src/estilos.css`. Es la paleta del **Sistema Nacional de
Diseño** (snd.gob.mx), tema guinda, con **Noto Sans** desde Google Fonts. Lo esencial:

```
--principal: #611232   (guinda900, cabecera)
--fondo: #F3F3F3       --superficie: #FFFFFF
--texto: #434343       --titulo: #161A1D       --tenue: #767676
--linea: #DDDDDD       --error: #9B0F15
--cuerpo: "Noto Sans", system-ui, "Segoe UI", sans-serif
color-scheme: light
```

Reglas de la casa, que están en `CLAUDE.md` y aplican aquí:

- **Tema claro, trazo fino, filetes en lugar de tarjetas.** Jerarquía por tamaño y peso, no
  por cajas.
- **Color solo cuando carga información.** Rojo únicamente para una alarma real.
- **Nada de** fondo azul marino con turquesa, brillos, paneles translúcidos, etiquetas en
  mayúsculas con espaciado, píldoras, numerales encerrados, partículas, ni movimiento
  decorativo. El usuario rechazó explícitamente el aspecto "hecho por IA".
- **Toda cifra lleva su `n` y su fecha** (invariante I12).
- **"Sin dato" es un estado visible**, nunca un hueco ni un verde por omisión (I13).
- Foco visible: `outline: 3px solid var(--dorado600)`.

> Nota: `CLAUDE.md` menciona Public Sans en una línea vieja. **Manda el panel**: Noto Sans.
> Si lo corriges, hazlo en `CLAUDE.md` y anótalo en el registro.

**Mobile-first de verdad.** Objetivos: que funcione a 360 px de ancho, que el botón de
reportar se alcance con el pulgar, áreas táctiles de 44 px mínimo, y que el flujo completo
se pueda hacer con una mano y con sol en la pantalla, que es la condición real de uso junto
a un río.

---

## 9. Control de calidad de la foto, sin modelo

Antes de permitir el envío, revisa en el cliente:

- **Borrosa**: varianza del laplaciano sobre la imagen en escala de grises bajo un umbral.
  Calíbralo a ojo con tres o cuatro fotos reales.
- **Demasiado oscura o quemada**: brillo medio fuera de un rango razonable.
- **Demasiado pequeña**: si el archivo original viene por debajo de unos 200×200.

Si falla, **no bloquees: advierte y deja decidir.** "Esta foto se ve borrosa, ¿quieres tomar
otra?" con un botón para enviarla igual. Una persona junto a un canal con mala luz tiene
razones para mandar lo que pudo.

Son unas veinte líneas y **no necesita modelo ninguno**, lo que significa que funciona sin
red y sin llaves.

**Lo que no se hace y por qué.** Clasificar la foto para decir "esto es espuma" aporta poco,
porque la persona ya lo dijo al elegir el tipo, y una etiqueta equivocada erosiona la
confianza. Además no existe ninguna imagen etiquetada del Atoyac con la que entrenar algo.
El campo `clasificacion_automatica` del esquema queda vacío a propósito, con su lugar
reservado por si después se usa un modelo preentrenado; si llega a usarse, se muestra como
sugerencia con su confianza y **nunca** como la verdad del reporte.

---

## 10. La asignación al tramo del río

Esto es la mejora concreta sobre SIGRIV y hay que entender bien de quién es cada parte.

**El problema.** Asignar por distancia en línea recta está mal: dos puntos a 200 metros
pueden estar en barrancas distintas que no se comunican, así que un reporte "a 200 m del
sitio" puede pertenecer a otra cuenca. La topología de M1 existe justo para evitar eso.

**Quién hace qué:**

- **El backend asigna** `c_sitio_asignado` y `distancia_al_cauce_m`. Es la autoridad.
- **La app muestra, como orientación inmediata**, el sitio más cercano calculado en el
  cliente sobre `sitios.geojson`, con haversine. Lo etiqueta como aproximado: *"parece que
  estás junto al río X"*. Cuando el 201 regresa, se puede refrescar con lo que el backend
  diga.

**Ya está implementada.** `backend/asignacion.py` engancha el punto a la red podada que
produce `scripts/71_red_para_asignacion.py` (11 765 tramos, 1.6 MB, los que alcanzan un
sitio en 20 km o menos) y devuelve el sitio y la distancia al cauce. Comprobado: las
coordenadas exactas de un sitio enganchan entre 2 y 8 metros, un punto en el centro de
Puebla da 1 064 m, y un punto en Ciudad de México se rechaza sin asignar.

Dos cosas que conviene saber al mostrarlo:

- **La tolerancia es 1 500 m**, no los 150 m de los sitios de monitoreo. Un sitio de
  muestreo *está* en el río; una persona reporta desde donde puede pararse, y el GPS de un
  teléfono en una barranca falla fácil. Si el punto queda más lejos, `c_sitio_asignado`
  viene en `null` y `distancia_al_cauce_m` trae la distancia de todos modos, que es
  información útil.
- **Se asigna el sitio que queda aguas abajo**, no el más cercano. Es deliberado: ese es el
  punto donde la contaminación reportada se va a medir, y es lo que permite cruzar el
  reporte con una alerta de sensor.

---

## 11. Modo demostración

El panel tiene un patrón excelente que hay que copiar: si no hay backend configurado, entra
en modo demostración leyendo una foto de datos capturada en `panel/public/demo/foto.json`.

Haz lo mismo: `ciudadano/public/demo/foto.json` con dos o tres reportes de ejemplo y un par
de sitios, para que **la app se pueda mostrar sin red y sin backend**. El día del pitch eso
es la diferencia entre una demo y un error de conexión en pantalla.

En modo demostración, **dilo en la interfaz**. Una línea discreta: "datos de demostración".
No se finge que hay conexión.

---

## 12. Offline

Es la ventaja real que Flutter tendría, porque varias barrancas del Atoyac tienen mala
cobertura y ahí es donde la gente ve las descargas.

**Alcance para la entrega:** una **cola local**. Si el `POST` falla, guarda el reporte en
`localStorage` o IndexedDB, muestra *"se enviará cuando haya señal"*, y reintenta al
recuperar conectividad (`navigator.onLine` y el evento `online`). Es `src/lib/almacen.js`.

**Lo que no entra:** un service worker completo con precaché de la aplicación. Si sobra
tiempo, un `manifest.webmanifest` más un service worker mínimo que cachee el shell la vuelve
instalable de verdad y arrancable sin red. Con el manifest ya se instala en la pantalla de
inicio, que es lo que permite defenderla como app móvil ante el jurado.

---

## 13. Privacidad, que aquí no es un trámite

En un conflicto por descargas industriales, exponer a quien denuncia no es un riesgo
teórico.

- **EXIF eliminado en el dispositivo** (D-F, I14).
- **El correo nunca se muestra.** El backend ya lo filtra en `GET /reportes`; la app
  tampoco lo pinta en ninguna vista.
- **La coordenada que se publica va redondeada.** En la ficha del sitio y en cualquier
  lista pública, redondea a tres decimales (unos 100 m). La coordenada exacta se manda al
  backend, pero no se re-muestra con precisión.
- **Aviso de privacidad y términos** antes del primer envío, con aceptación explícita.
  Reutiliza el texto de SIGRIV, ajustando a quién se envía el dato.
- **No pidas nada que no se use.** Ni nombre, ni teléfono, ni CURP.

---

## 14. El chatbot: por qué no entra ahora

Se evaluó. La objeción no es que sea inútil, es que en este dominio es **riesgoso**: un
modelo contestando "¿puedo bañarme?" o "¿me hace daño el agua?" puede inventar consejo de
salud. Y el proyecto **no tiene todavía el respaldo normativo** para la capa de riesgo por
uso: los criterios de calidad por uso destinado siguen pendientes.

Si después se construye, estas son las condiciones, no sugerencias:

- Responde **solo** desde nuestras tablas, citando el sitio, la fecha y con cuántas
  mediciones se calculó.
- Nunca da consejo de salud ni médico, nunca nombra responsables, nunca contesta fuera de
  los datos, y cuando no sabe lo dice.
- El flujo de reporte guiado, si se hace, es un guion determinista, no un modelo.

Con el tiempo que queda, está por debajo del guion de la demo en prioridad.

---

## 15. Criterio de terminado

Medible, y no depende de nadie más:

1. Desde un teléfono real, con el mock corriendo en la computadora y el teléfono en la
   misma red, el flujo completo se puede hacer **con una mano**: tipo, foto, ubicación,
   envío, folio en pantalla.
2. El payload que manda **valida** contra el esquema:
   `python contrato/validador.py reporte_ciudadano payload.json` da cero errores.
3. El backend responde **201** y el reporte aparece en `GET /reportes`.
4. Mandar `exif_removido: false` devuelve **409**. Compruébalo a propósito.
5. Mandar un campo que no está en el esquema devuelve **422**. Compruébalo a propósito.
6. **Sin backend**, la app entra en modo demostración y lo dice en pantalla.
7. **Sin red** a mitad del envío, el reporte queda en cola y se manda al volver la señal.
8. A **360 px** de ancho no hay desbordamiento horizontal en ninguna pantalla.
9. Ninguna vista muestra el correo. La coordenada pública va redondeada.
10. `python -I scripts/50_verificar_repo.py` sigue diciendo que todas las comprobaciones
    pasan: incluye el escaneo de enlaces de los `.md`.

---

## 16. Dependencias de otros

Dos cosas no están en tus manos. **Pídelas al empezar y no te bloquees con ellas.**

Quedó **una sola**, y es la del despliegue.

| Qué | Estado |
|---|---|
| `GET /reportes/{c_reporte}` para el folio | **Hecho.** Backend y servidor de pruebas. |
| La asignación al tramo en el backend | **Hecha.** `backend/asignacion.py`, comprobada de punta a punta. |
| El `buildCommand` de `vercel.json` | **Pendiente a propósito.** No se puede aplicar antes de que `ciudadano/` exista con su `package.json`, o el despliegue se rompe. Aplícalo **junto con el andamio del paso 1**, con el bloque de la sección 5. Si prefieres no tocar ese archivo, dilo y se hace un segundo proyecto de Vercel. |

Mientras tanto, trabaja en local con `npm run dev` y el servidor de pruebas: no hay nada
que te bloquee.

---

## 17. Orden de trabajo sugerido

Pensado para que haya algo demostrable después de cada bloque.

1. **Andamio (1 h).** `ciudadano/` con Vite y React, `base: '/ciudadano/'`, los tokens del
   panel, `copiar-datos.mjs` adaptado, y `backend.js` con `origenBackend()` copiado.
2. **Reportar, el camino feliz (2 h).** Tipo, geolocalización, descripción, `POST`, folio en
   pantalla. Sin foto todavía. Pruébalo contra el mock.
3. **La foto (1.5 h).** Captura, canvas, downscale, `exif_removido: true`. Verifica con el
   validador y comprueba el 409 a propósito.
4. **Consultar folio y Mi punto (1.5 h).** La ficha del sitio con su `n` y su fecha.
5. **Modo demostración y cola offline (1.5 h).** Los puntos 6 y 7 del criterio.
6. **Pulido móvil, accesibilidad y aviso de privacidad (1.5 h).** 360 px, áreas táctiles,
   foco visible, contraste, el aviso antes del primer envío.
7. **Control de calidad de la foto (0.5 h).** Sección 9. Es lo primero que se recorta si el
   tiempo aprieta.
8. **Manifest para que se instale (0.5 h).** Lo que permite llamarla app móvil con cara.

Unas diez horas, con lo recortable al final a propósito.

---

## 18. Trampas conocidas

- **La geolocalización exige HTTPS.** En `localhost` funciona; desde un teléfono apuntando
  a la IP de tu computadora, **no**. Para probar en teléfono real usa un túnel con HTTPS o
  despliega. Es la trampa que más tiempo hace perder.
- **El esquema rechaza coordenadas fuera de la cuenca.** Si pruebas desde otro lugar, el
  envío va a fallar con 422 y parecerá un error tuyo. Pon coordenadas de prueba dentro de
  la ventana, por ejemplo `19.02, -98.21`.
- **`additionalProperties: false`**: un campo de más tira el envío completo.
- **`fecha_hora` necesita zona horaria.** Sin ella el esquema la rechaza.
- **No edites `README.md`** del repositorio: está congelado hasta el cierre del proyecto.
- **No edites archivos generados.** Revisa `docs/contexto/02-mapa-del-repo.md` antes de
  tocar cualquier cosa fuera de `ciudadano/`.
- **Un módulo no importa código de otro.** La app habla con el backend por HTTP y lee
  tablas publicadas; no importa nada de `motor/` ni de `panel/`.
- **Al terminar**, añade tu entrada a `docs/contexto/06-registro-de-cambios.md` y actualiza
  la fila de M8 en `docs/12-estado-y-traspaso.md` y en la tabla de módulos de `CLAUDE.md`.
- **No hagas `commit` ni `push` sin preguntar.** Es una regla del proyecto.

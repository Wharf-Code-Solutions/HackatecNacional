# 19 · Cambio de rumbo: escuelas rurales vulnerables (reto CAPCEE)

> Fecha: 24 de noviembre de 2026. Léanlo completo antes de tocar código. Cada quien tiene una sección propia
> (§5, §6 y §7) y puede trabajar sin esperar a los demás.

## 1. Qué cambió

El proyecto deja de ser "monitoreo de contaminación del río Atoyac" y pasa a ser **prevención de
contaminación y de derrumbes en comunidades rurales con escuelas cercanas y vulnerables a este tipo de
incidentes**.

- **Quién lleva el reto:** el **CAPCEE** (Comité Administrador Poblano para la Construcción de Espacios
  Educativos), el organismo de Puebla que construye y mantiene la infraestructura de las escuelas.
- **Quién más autoriza:** la **CEASPUE** (Comisión Estatal de Agua y Saneamiento de Puebla). Todo mecanismo
  que toque agua (fuentes de abastecimiento, tomas, descargas, drenaje, muestreo) debe contemplar su
  autorización. No es un adorno: es un estado que el sistema tiene que guardar y mostrar (ver §4.3).
- **La unidad central ya no es el sitio del río, es la escuela.** Todo lo que hagamos debe responder a la
  pregunta: *¿qué escuelas rurales están en riesgo, de qué, y qué tan urgente es atenderlas?*

Los dos riesgos que cubrimos:

| Riesgo | Qué lo provoca en una comunidad rural | Cómo lo vemos |
|---|---|---|
| **Contaminación** | agua de la escuela tomada de un pozo, manantial o río contaminado; descargas o fosas cerca del plantel; basura acumulada | estación de calidad del agua (la que ya tenemos), reportes ciudadanos |
| **Derrumbe / deslave** | ladera inestable, lluvia intensa, urbanización sin control (cortes de cerro, construcción en pendiente, drenaje que satura el suelo), grietas en el plantel | pendiente, atlas de riesgo, lluvia, reportes ciudadanos (grietas, deslaves) |

## 2. Qué se queda, qué cambia y qué se guarda

**Se queda (y se reenfoca a infraestructura y urbanización):**

| Pieza actual | Dónde vive | Qué cambia |
|---|---|---|
| Mecanismo de análisis del agua (estación + motor de reglas) | `dispositivo/`, `motor/` | Se reubica a zonas de interés: junto a la fuente de agua de escuelas rurales vulnerables. La lógica de "desviación respecto de la historia del propio punto" sigue valiendo |
| Módulo de alertas | `motor/`, `backend/`, `panel/` | Cada alerta debe decir **qué escuela(s) afecta**, no solo qué estación la disparó |
| Participación ciudadana | `ciudadano/`, sección de reportes del `panel/` | Nuevos tipos de reporte (infraestructura y riesgo de derrumbe) y **zonas propensas resaltadas en el mapa** |

**Se guarda sin borrar (no es prioridad, puede volver si una escuela queda junto a un río):** topología del
Atoyac (M1), propagación aguas abajo (M3), red de 5 estaciones actual, colector de residuos. No borren
código: si algo ya no aplica, simplemente no lo usen en la vista nueva.

## 3. Reparto

| Módulo | Responsable | Carpeta principal | Rama sugerida |
|---|---|---|---|
| A. Reubicación de los mecanismos | Manuel | `dispositivo/`, `scripts/`, `datos/` | `rumbo/reubicacion` |
| B. Dashboard de análisis de urbanización y riesgo | Evaristo | `panel/` | `rumbo/dashboard` |
| C. Reportes ciudadanos con zonas propensas | Carlos | `ciudadano/` (+ sección de reportes del `panel/` si hace falta) | `rumbo/reportes` |

## 4. Lo que compartimos: el contrato común

Para que los tres módulos sean **independientes**, nadie importa código de otro módulo. Lo único que
compartimos son **archivos de datos con forma fija** en `contrato/fixtures/`. Cada quien desarrolla y prueba
contra esos archivos; cuando el módulo A tenga los datos reales, solo se reemplaza el archivo y los otros dos
módulos siguen funcionando igual.

Regla: **si necesitan un campo que no está aquí, se avisa en el grupo y se agrega aquí primero**, después en
el código. Nadie cambia la forma de estos archivos por su cuenta.

### 4.1 `contrato/fixtures/escuelas.json` (lo produce A, lo leen B y C)

Lista de escuelas de interés. Clave: la **CCT** (Clave de Centro de Trabajo de la SEP).

```json
[
  {
    "cct": "21DPR0000X",
    "nombre": "Escuela Primaria Ejemplo",
    "nivel": "primaria",
    "matricula": 84,
    "municipio": "Ejemplo",
    "localidad": "Ejemplo",
    "ambito": "rural",
    "latitud": 18.90,
    "longitud": -98.10,
    "fuente_agua": "pozo",
    "riesgo": {
      "indice": 0.72,
      "nivel": "alto",
      "contaminacion": 0.55,
      "derrumbe": 0.81,
      "desglose": {
        "pendiente": 0.30,
        "susceptibilidad_laderas": 0.25,
        "cercania_cauce_o_descarga": 0.10,
        "calidad_agua": 0.05,
        "marginacion": 0.07,
        "sin_drenaje": 0.03,
        "urbanizacion_reciente": 0.12
      }
    },
    "c_estacion": "EST-XXX-01",
    "autorizaciones": [
      { "organismo": "CEASPUE", "tramite": "instalacion_en_fuente", "estado": "pendiente", "fecha": null },
      { "organismo": "CAPCEE", "tramite": "acceso_al_plantel", "estado": "otorgada", "fecha": "2026-11-20" }
    ]
  }
]
```

- `nivel` de riesgo: `bajo | medio | alto | muy_alto`.
- `fuente_agua`: `red_publica | pozo | manantial | rio | pipa | captacion_lluvia | desconocida`.
- `c_estacion`: `null` si la escuela no tiene estación cerca.
- El `desglose` es obligatorio y debe sumar el `indice`: cualquier número que mostremos se tiene que poder
  defender (misma regla que ya usamos en prioridades). **Los pesos son hipótesis** y se dice así.

### 4.2 `contrato/fixtures/zonas_riesgo.geojson` (lo produce A, lo leen B y C)

`FeatureCollection` de polígonos. Cada `Feature` trae en `properties`:

```json
{
  "c_zona": "ZR-0001",
  "tipo": "derrumbe",
  "nivel": "alto",
  "fuente": "Atlas Nacional de Riesgos (CENAPRED), susceptibilidad de laderas",
  "escuelas": ["21DPR0000X"]
}
```

`tipo`: `derrumbe | inundacion | contaminacion`. `nivel`: igual que en escuelas.

### 4.3 Autorizaciones

Cualquier mecanismo instalado o propuesto lleva su lista de autorizaciones (mismo formato que en §4.1).
Estados: `pendiente | solicitada | otorgada | negada`. Trámites iniciales, **por confirmar con CEASPUE y
CAPCEE** (no inventemos nombres oficiales en la presentación):

- CEASPUE: instalación de equipo en una fuente de abastecimiento o toma; toma de muestras; cualquier
  intervención en drenaje o descargas.
- CAPCEE: acceso e instalación dentro o junto al plantel; dictamen del estado del inmueble.

Un mecanismo sin autorización `otorgada` de CEASPUE **se dibuja como "propuesto", no como "activo"**.

### 4.4 Cambios a esquemas existentes (v2.0)

| Esquema | Cambio |
|---|---|
| `alerta.schema.json` | nuevo campo `escuelas_afectadas: [cct]` |
| `reporte_ciudadano.schema.json` | nuevos `tipo` (ver §7), nuevo campo `cct_cercana`, ampliar `latitud/longitud` a todo Puebla si hace falta |
| `estacion.schema.json` | `c_sitio` deja de ser obligatorio (una estación en un pozo escolar no cuelga de un sitio CONAGUA); nuevo campo `autorizaciones` |

Cada quien cambia **solo** el esquema que le toca (alertas → B, reportes → C, estación → A) siguiendo
`docs/contexto/05-protocolo-de-cambios.md`, y corre `python contrato/validador.py` antes de subir.

### 4.5 Fixtures provisionales

Mientras A no entregue datos reales, **el primero que los necesite** crea `escuelas.json` y
`zonas_riesgo.geojson` con 8 a 10 escuelas inventadas pero creíbles (coordenadas en zonas rurales de Puebla,
riesgos variados, al menos una con autorización CEASPUE pendiente) y los sube en un commit aparte que solo
toque esos dos archivos. Se marcan con `"_provisional": true` en un archivo `contrato/fixtures/LEEME.md`.

## 5. Módulo A · Reubicación (Manuel)

Va aquí para que B y C sepan qué les va a llegar.

- Seleccionar escuelas de interés: rurales, con alta marginación y cerca de amenaza (ladera inestable,
  cauce, descarga, basurero).
- Calcular el índice de riesgo con desglose y escribir `escuelas.json` y `zonas_riesgo.geojson` desde un
  script en `scripts/` (los fixtures son derivados: se edita el script, no el JSON).
- Reubicar las estaciones de calidad del agua a la fuente de agua de esas escuelas y decidir si el
  mecanismo suma sensores para derrumbe (pluviómetro, humedad de suelo, inclinómetro).
- Registrar las autorizaciones necesarias de cada estación.

Fuentes a revisar (confirmar disponibilidad y licencia antes de usarlas; anotar en `docs/04-fuentes-de-datos.md`):

- Catálogo de centros de trabajo de la SEP (CCT, nivel, matrícula, coordenadas).
- INEGI: localidades y ámbito rural, censo por localidad (agua entubada, drenaje), Continuo de Elevaciones
  (pendiente), uso de suelo y vegetación (urbanización).
- CONAPO: índice de marginación por localidad.
- CENAPRED: Atlas Nacional de Riesgos (inestabilidad de laderas, inundación).
- Atlas de riesgos estatal y municipales de Puebla.
- CONAGUA: calidad del agua que ya tenemos (`datos/procesados/`).

## 6. Módulo B · Dashboard de urbanización y riesgo (Evaristo)

**Objetivo:** que alguien del CAPCEE abra el panel y sepa en un minuto qué escuelas atender primero, por
qué, y qué falta autorizar.

**Qué construir** (en `panel/`, React + Vite, el que ya existe):

1. **Panorama de escuelas en riesgo**: cuántas hay por nivel de riesgo, por tipo (contaminación /
   derrumbe) y por municipio. Lista ordenada por `riesgo.indice`.
2. **Ficha de escuela**: al elegir una CCT, su desglose de riesgo (barra horizontal por factor), su fuente
   de agua, su estación (si tiene) y sus alertas.
3. **Análisis de urbanización**: los factores de urbanización del desglose (`urbanizacion_reciente`,
   `sin_drenaje`, `pendiente`) comparados entre escuelas; dónde la urbanización empeora el riesgo.
4. **Alertas reenfocadas**: el módulo de alertas actual, pero cada alerta muestra `escuelas_afectadas`.
   Reutilizar `ListaAlertas.jsx` y `Expediente.jsx`.
5. **Autorizaciones**: tablero de trámites por organismo (CEASPUE / CAPCEE) y estado; qué mecanismos siguen
   como "propuestos".
6. **Mapa de escuelas** con color por nivel de riesgo y las zonas de `zonas_riesgo.geojson`. Reutilizar
   `MapaEstaciones.jsx` / `MapaRed.jsx` como base.

**Qué dejar fuera de la vista nueva:** predicción de llegada aguas abajo, matriz de estaciones del Atoyac,
plantilla del SND. No se borran; solo no aparecen.

**Cómo trabajar independiente:**

- Lee **solo** `contrato/fixtures/escuelas.json`, `zonas_riesgo.geojson` y alertas del mock. Usa el modo
  demostración sin backend que ya tiene el panel (`panel/src/lib/datos.js`).
- Si aún no hay fixtures, crea los provisionales (§4.5).
- Si las alertas del mock no traen `escuelas_afectadas`, cruza por `c_estacion` → escuela en el panel
  mientras tanto.

**Terminado cuando:** `npm run dev` en `panel/` abre sin errores en consola con solo los fixtures; las seis
vistas funcionan; cambiar `escuelas.json` por otro con la misma forma no rompe nada; `npm run build` pasa.

## 7. Módulo C · Reportes ciudadanos con zonas propensas (Carlos)

**Objetivo:** que un padre de familia, maestro o vecino reporte desde el teléfono un problema de la escuela o
su entorno, y que el mapa le muestre **de un vistazo qué zonas son propensas a ser afectadas**.

**Qué construir** (en `ciudadano/`, la PWA que ya existe):

1. **Nuevos tipos de reporte** (reemplazan o se suman a los actuales):
   - Infraestructura: `grieta_en_muro_o_piso`, `techo_o_barda_danada`, `fuga_de_agua_o_drenaje`,
     `encharcamiento`.
   - Derrumbe: `deslave_o_derrumbe_cercano`, `piedras_o_tierra_sobre_camino`, `arbol_o_poste_inclinado`.
   - Contaminación: `agua_turbia_o_con_olor`, `descarga_cerca_de_escuela`, `basura_acumulada`.
   - `otro`.
   Ajustar `lib/etiquetas.js`, `CategoriaIcono.jsx`, la validación de foto con Gemini
   (`contrato/analisis_foto.py`) y el esquema `reporte_ciudadano.schema.json` (v2.0).
2. **Escuela cercana**: al reportar, asignar la CCT más cercana (`cct_cercana`) con `escuelas.json`, y
   mostrar su nombre en el formulario ("Cerca de: Primaria …").
3. **Zonas propensas resaltadas en el mapa**: pintar los polígonos de `zonas_riesgo.geojson` con un relleno
   suave por nivel, y las escuelas como puntos con su color de riesgo. Debe leerse sin leyenda: color y forma
   claros, nada de tablas ni paneles extra encima del mapa.
4. **Huella de calor reenfocada**: hoy `contrato/prioridad_huella.py` pinta calor sobre el río. Cambiarlo a
   calor alrededor de escuelas y zonas: varios reportes de grietas o deslaves cerca de una misma escuela suben
   su prioridad. Si la zona ya es propensa (§4.2), el reporte pesa más. Pesos como hipótesis, con desglose.
5. **Gestión en el panel** (opcional, coordinar con Evaristo): la sección de reportes del panel ya existe
   (`Reportes.jsx`, `MapaReportes.jsx`); si se toca, solo esos archivos, para no chocar con B.

**Cómo trabajar independiente:**

- Lee **solo** `escuelas.json` y `zonas_riesgo.geojson` (provisionales si aún no hay reales, §4.5) y el mock
  (`python contrato/servidor_mock.py`). El modo demostración de la app ya funciona sin backend.
- No depende del dashboard: el mapa de zonas vive dentro de `ciudadano/`.

**Terminado cuando:** `npm run dev` en `ciudadano/` abre a ancho de teléfono; se puede levantar un reporte de
cada tipo nuevo; el mapa muestra zonas y escuelas resaltadas; el reporte guarda `cct_cercana`;
`python contrato/validador.py` acepta los reportes de ejemplo; `npm run build` pasa.

## 8. Reglas para no pisarnos

1. Cada quien en su rama y su carpeta. Archivos compartidos (`contrato/`, `backend/`): cambios pequeños, un
   commit aparte, avisando en el grupo.
2. Nadie importa código de otro módulo. Lo único compartido son los fixtures de §4.
3. Las vistas muestran la figura y el dato vivo: nada de tablas, notas o leyendas que no se pidan.
4. Todo número de riesgo o prioridad lleva su desglose y se dice que los pesos son hipótesis.
5. Nada se presenta como "autorizado por CEASPUE" o "aprobado por CAPCEE" si no lo está: en pantalla es
   "propuesto" hasta que haya autorización real.
6. Antes de pedir que se integre su rama: `python -I scripts/50_verificar_repo.py` y la prueba de su módulo.

## 9. Integración (después, no ahora)

Cuando los tres módulos funcionen solos contra los fixtures, se integran en este orden:
A reemplaza los fixtures provisionales por los reales → B y C verifican que nada se rompió → el backend
agrega `GET /escuelas` y `GET /zonas` sirviendo esos mismos archivos → panel y app pasan de fixture a API
sin cambiar la forma de los datos.

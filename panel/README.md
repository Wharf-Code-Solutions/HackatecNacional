# Panel de autoridad · prototipo de M7

Vista para la autoridad que atiende las alertas. Responde, para cada alerta: qué se midió,
contra qué se comparó, qué tan respaldada está la comparación, de dónde pudo venir, hacia
dónde va y quién la está atendiendo.

## Correrlo

```powershell
python -m http.server 8000
```

```powershell
python contrato/servidor_mock.py
```

```powershell
python contrato/reproducir_escenario.py descarga_industrial
```

Abrir `http://127.0.0.1:8000/panel/`. El tercer comando genera alertas en el mock; sin él la
lista sale vacía. Otro backend: `?mock=http://host:puerto`.

## Qué muestra

- **Panorama** con cinco gráficas: alertas por hora del día, matriz estación × sonda (la
  última lectura sobre, dentro o bajo lo habitual del sitio), alertas por atender por estación,
  alertas por parámetro y avance de la atención. Pasa el cursor sobre una marca para ver el dato.
- **Alertas**, filtrables por estado, nivel y estación. Las críticas van primero.
- **Expediente** de la alerta elegida:
  - estado y responsable, que se guardan con `PATCH /alertas/<c_alerta>`;
  - evidencia: regla, criterio, lecturas seguidas y la banda p10 a p90 del sitio con su `n` y
    sus fechas (I12), más las lecturas recientes de la estación contra esa banda;
  - fuente probable con puntaje y medidas sugeridas, si el motor las envía;
  - miniaturas de las cinco sondas de la estación, cada una contra su banda;
  - sitios aguas abajo y aguas arriba con su distancia sobre el cauce (topología M1).
- **Avisos técnicos**, en su propia pestaña: son del dispositivo, no del río (I8).
- **Reportes ciudadanos**, sin el correo de quien reporta.

## Diseño

Paleta y tipografía del Sistema Nacional de Diseño del Gobierno de México (snd.gob.mx), tema
guinda, Noto Sans. Las variables están al inicio de `estilos.css` con los nombres del SND
(`--pguinda900`, `--rojo500`…). Por qué y qué se descartó: decisión D22 en
`docs/05-decisiones-tecnicas.md`.

## Fronteras

- El panel **no evalúa**: nivel, regla, fuente y predicción llegan del backend. Si un dato no
  viene, lo dice ("sin estimación de fuente", "sin predicción"), no lo inventa (I13).
- Lo único que lee por su cuenta son tablas publicadas: `contrato/fixtures/linea_base.json`,
  `contrato/fixtures/estaciones.json` y `datos/procesados/red/`.
- No importa código de `mapa/` ni de otro módulo.

## Lo que falta

- **Predicción de llegada**: espera a M3 (`prediccion_propagacion.schema.json`).
- **Fuente probable con puntaje**: el motor provisional del mock no la calcula; llega con M2.
- **Sesión de usuario**: el panel aún no pide identificarse.
- **Backend real (M5)**: debe implementar `PATCH /alertas/<c_alerta>` con la misma regla que
  el mock (solo `estado` y `responsable`; lo demás, 422).

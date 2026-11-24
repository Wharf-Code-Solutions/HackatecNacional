# Panel de autoridad · prototipo de M7

Vista para la autoridad que atiende las alertas. Responde, para cada alerta: qué se midió,
contra qué se comparó, qué tan respaldada está la comparación, de dónde pudo venir, hacia
dónde va y quién la está atendiendo.

Aplicación React 18 con Vite, en JavaScript (decisión D23).

## Correrlo en tu computadora

La primera vez, dentro de `panel/`:

```powershell
npm install
```

Desde la raíz del repositorio, el backend real (instalación en `backend/README.md`) o, sin instalar
nada, el mock con el motor real:

```powershell
backend\.venv\Scripts\python backend\servidor.py
```

```powershell
python contrato/servidor_mock.py --motor real
```

Y un día de lecturas con un incidente:

```powershell
python contrato/reproducir_escenario.py descarga_industrial
```

El panel, dentro de `panel/`:

```powershell
npm run dev
```

Abrir `http://localhost:5173/`. Sin el escenario la lista sale vacía. Otro backend:
`?api=http://host:puerto` en la URL.

## Desplegar en Vercel

El panel y el backend se despliegan juntos, en un solo proyecto de Vercel: el panel como sitio
estático y el backend como función de Python en `/api` (D25). La configuración está en el
`vercel.json` de la raíz del repositorio; los pasos completos, en `backend/README.md`.

1. Importar el repositorio con **Root Directory vacío** (la raíz, no `panel`) y Framework **Other**.
2. Sin más, el sitio abre en **modo demostración** con `public/demo/foto.json` y lo dice en
   pantalla; ahí los cambios de estado y responsable solo viven en la pestaña.
3. Con `DATABASE_URL` de Supabase, `VITE_API_URL` = `/api` y un redeploy, el panel lee el backend real
   del mismo dominio.

Para revisar en local lo mismo que servirá Vercel: `npm run build` y `npm run preview`.

## La foto del modo demostración

`public/demo/foto.json` es una copia de lo que respondió el backend (M5) después de reproducir
`descarga_industrial`, con la predicción de cada alerta. No se calcula en el panel. Si cambia el motor,
M3 o el contrato, se vuelve a capturar con el backend corriendo (el mock no calcula la predicción):

```powershell
npm run capturar-demo
```

## Qué muestra

- **Resumen** con su hora de corte: críticas por atender, por atender, sin responsable y
  estaciones con falla técnica.
- **Panorama** con cinco gráficas: alertas por hora del día, matriz estación × sonda (la
  última lectura sobre, dentro o bajo lo habitual del sitio), alertas por atender por estación,
  alertas por parámetro y avance de la atención. Pasa el cursor sobre una marca para ver el dato.
- **Estaciones**: un clic filtra la lista por esa estación.
- **Alertas**, filtrables por estado, nivel y estación. Las críticas van primero.
- **Expediente** de la alerta elegida:
  - estado y responsable, que se guardan con `PATCH /alertas/<c_alerta>`;
  - evidencia: regla, criterio, lecturas seguidas y la banda p10 a p90 del sitio con su `n` y
    sus fechas (I12), más las lecturas recientes de la estación contra esa banda;
  - las cinco sondas de la estación, cada una contra su banda;
  - fuente probable con puntaje y medidas sugeridas, si el motor las envía;
  - **hasta dónde llega** (M3): a qué sitios aguas abajo, entre qué horas y con qué valor esperado,
    con su confianza y los supuestos del modelo; si el backend no la calcula (el mock), la lista de
    sitios aguas abajo;
  - sitios aguas arriba con su distancia sobre el cauce (topología M1).
- **Avisos técnicos**, en su propia pestaña: son del dispositivo, no del río (I8).
- **Reportes ciudadanos**, sin el correo de quien reporta.

## Cómo está armado

```
src/
  App.jsx               pestañas, filtros y alerta elegida
  componentes/          Resumen, Panorama, TablaEstaciones, ListaAlertas, Expediente, Avisos, Reportes, Tooltip
  graficas/             SVG a mano: GraficaHoras, MatrizEstaciones, BarrasH, BarraAtencion, Serie, Miniaturas
  lib/datos.js          lectura de tablas, sondeo del backend cada 3 s, modo demostración, guardado
  lib/etiquetas.js      textos y colores (paleta del SND, validada para daltonismo)
  lib/formato.js        fechas, números, CSV
  estilos.css           estilos globales
scripts/copiar-datos.mjs   tablas del repo a public/datos/ (no versionado)
scripts/capturar-demo.mjs  foto del backend a public/demo/foto.json
```

## Diseño

Paleta y tipografía del Sistema Nacional de Diseño del Gobierno de México (snd.gob.mx), tema
guinda, Noto Sans. Las variables están al inicio de `src/estilos.css` con los nombres del SND
(`--pguinda900`, `--rojo500`…). Por qué y qué se descartó: decisión D22 en
`docs/05-decisiones-tecnicas.md`.

## Fronteras

- El panel **no evalúa**: nivel, regla, fuente, posición en la banda y predicción llegan del
  backend. Si un dato no viene, lo dice ("sin estimación de fuente", "sin predicción"), no lo
  inventa (I13).
- Lo único que lee por su cuenta son tablas publicadas: `contrato/fixtures/linea_base.json`,
  `contrato/fixtures/estaciones.json` y `datos/procesados/red/`.
- No importa código de `mapa/` ni de otro módulo.

## Lo que falta

- **Sesión de usuario**: el panel aún no pide identificarse.
- **Backend real (M5)**: debe implementar `PATCH /alertas/<c_alerta>` con la misma regla que
  el mock (solo `estado` y `responsable`; lo demás, 422).

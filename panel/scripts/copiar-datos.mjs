// Copia a public/datos/ las tablas publicadas que el panel lee por su cuenta.
//
// La fuente de verdad sigue en contrato/fixtures/ y datos/procesados/: esta copia no se
// versiona (public/datos/ está en .gitignore) y se rehace antes de `npm run dev` y de
// `npm run build`. Así el sitio que se despliega en Vercel lleva los datos como archivos
// estáticos sin duplicarlos en el repositorio.
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const DESTINO = resolve(AQUI, '..', 'public', 'datos');

const ARCHIVOS = [
  'contrato/fixtures/estaciones.json',
  'contrato/fixtures/linea_base.json',
  'datos/procesados/red/sitio_aguas_abajo.csv',
  'datos/procesados/red/sitio_pares.csv',
  'contrato/fixtures/sitios.geojson',
];

// Para el mapa del panel: la red hidrografica completa pesa 2 MB. Se recorta a los rios de
// orden >= 5 en una ventana alrededor de la red de estaciones, con margen para la pluma aguas
// abajo, y las coordenadas se redondean a 4 decimales (unos 10 m). Sale un archivo pequeño.
const VENTANA = { oeste: -98.75, este: -97.85, sur: 18.55, norte: 19.65 };
const ORDEN_MINIMO = 5;
function recortarRios() {
  const origen = join(RAIZ, 'datos/procesados/mapa/red_hidrografica.geojson');
  if (!existsSync(origen)) return false;
  const red = JSON.parse(readFileSync(origen, 'utf8'));
  const dentro = ([x, y]) => x >= VENTANA.oeste && x <= VENTANA.este && y >= VENTANA.sur && y <= VENTANA.norte;
  const lineas = [];
  for (const f of red.features) {
    const orden = f.properties.orden;
    if (orden < ORDEN_MINIMO) continue;
    const partes = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const parte of partes) {
      if (!parte.some(dentro)) continue;
      lineas.push({ o: orden, c: parte.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]) });
    }
  }
  writeFileSync(join(DESTINO, 'rios.json'), JSON.stringify({ ventana: VENTANA, lineas }));
  return lineas.length;
}

mkdirSync(DESTINO, { recursive: true });
let faltan = 0;
for (const rel of ARCHIVOS) {
  const origen = join(RAIZ, rel);
  if (!existsSync(origen)) {
    console.error('Falta ' + rel + ' (¿el despliegue incluye archivos fuera de panel/?)');
    faltan++;
    continue;
  }
  copyFileSync(origen, join(DESTINO, rel.split('/').pop()));
}
const tramos = recortarRios();
if (tramos === false) {
  console.error('Falta datos/procesados/mapa/red_hidrografica.geojson');
  faltan++;
}
if (faltan) process.exit(1);
console.log('Datos del panel copiados a public/datos/ (' + ARCHIVOS.length + ' archivos y ' + tramos + ' tramos de río).');

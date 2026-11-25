// Copia a public/datos/ las tablas publicadas que la app lee por su cuenta.
// La fuente de verdad sigue en contrato/fixtures/; esta copia no se versiona (public/datos/ está
// en .gitignore) y se rehace antes de `npm run dev` y de `npm run build`.
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const DESTINO = resolve(AQUI, '..', 'public', 'datos');

const ARCHIVOS = [
  'contrato/fixtures/sitios.geojson',
  'datos/procesados/mapa/cuenca.geojson',
  // Cauces de orden 3 (scripts/61_rios_menores_para_app.py): la app los pide solo al acercar el mapa.
  'datos/procesados/mapa/rios_orden3.json',
  // Área donde se puede reportar: Puebla aproximada por sus localidades (scripts/103_area_reportes.py).
  'datos/procesados/mapa/area_reportes.json',
];

// Los ríos de orden >= 4, los mismos que dibuja mapa/ (M6). El GeoJSON pesa 2 MB porque repite
// propiedades y lleva 5 decimales; para la app se queda con el orden y el trazo a 4 decimales (~10 m):
// unos 215 KB comprimido. Las líneas del INEGI van en el sentido del flujo, y así se conservan.
function compactarRios() {
  const origen = join(RAIZ, 'datos/procesados/mapa/red_hidrografica.geojson');
  if (!existsSync(origen)) return false;
  const red = JSON.parse(readFileSync(origen, 'utf8'));
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const lineas = [];
  for (const f of red.features) {
    const partes = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const p of partes) lineas.push({ o: f.properties.orden, c: p.map(([x, y]) => [r4(x), r4(y)]) });
  }
  writeFileSync(join(DESTINO, 'rios.json'), JSON.stringify({ lineas }));
  return lineas.length;
}

mkdirSync(DESTINO, { recursive: true });
let faltan = 0;
for (const rel of ARCHIVOS) {
  const origen = join(RAIZ, rel);
  if (!existsSync(origen)) {
    console.error('Falta ' + rel + ' (¿el despliegue incluye archivos fuera de ciudadano/?)');
    faltan++;
    continue;
  }
  copyFileSync(origen, join(DESTINO, rel.split('/').pop()));
}
const tramos = compactarRios();
if (tramos === false) { console.error('Falta datos/procesados/mapa/red_hidrografica.geojson'); faltan++; }
if (faltan) process.exit(1);
console.log('Datos de la app ciudadana copiados a public/datos/ (' + ARCHIVOS.length + ' archivos y ' + tramos + ' tramos de río).');

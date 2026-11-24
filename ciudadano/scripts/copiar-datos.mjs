// Copia a public/datos/ las tablas publicadas que la app lee por su cuenta.
// La fuente de verdad sigue en contrato/fixtures/; esta copia no se versiona (public/datos/ está
// en .gitignore) y se rehace antes de `npm run dev` y de `npm run build`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const DESTINO = resolve(AQUI, '..', 'public', 'datos');

const ARCHIVOS = [
  'contrato/fixtures/sitios.geojson',
  'datos/procesados/mapa/cuenca.geojson',
];

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
if (faltan) process.exit(1);
console.log('Datos de la app ciudadana copiados a public/datos/ (' + ARCHIVOS.length + ' archivos).');

// Junta en panel/dist el sitio completo que se despliega en Vercel (un solo proyecto, D25):
//
//   /                        panel de autoridad (panel/dist, ya compilado)
//   /ciudadano/              app ciudadana (ciudadano/dist, compilada con base '/ciudadano/')
//   /mapa/                   mapa de la cuenca con las estaciones; al elegir una abre su simulador
//   /dispositivo/simulador/  simulador de la estación (archivos estáticos, sin compilar)
//   /contrato/fixtures/      las tablas que leen el mapa y el simulador
//   /datos/procesados/mapa/  las capas del mapa (cuenca, ríos, confluencias, toponimia, red vigilada)
//   /api/                    backend: función de Python (api/index.py), no pasa por aquí
//
// Todos hablan con el mismo backend en /api del mismo dominio, así que alertas, reportes y
// estados se ven igual en las tres vistas. Se corre después de compilar panel y app:
//   node panel/scripts/ensamblar-sitio.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(RAIZ, 'panel', 'dist');

function exige(ruta) {
  if (!existsSync(ruta)) {
    console.error('Falta ' + ruta + '. Compila antes el panel y la app ciudadana.');
    process.exit(1);
  }
}

exige(join(DIST, 'index.html'));
exige(join(RAIZ, 'ciudadano', 'dist', 'index.html'));

cpSync(join(RAIZ, 'ciudadano', 'dist'), join(DIST, 'ciudadano'), { recursive: true });

// El simulador se sirve tal cual: solo su HTML, JS y CSS (prueba.js corre en Node, no en el sitio).
const SIM = join(RAIZ, 'dispositivo', 'simulador');
const simDestino = join(DIST, 'dispositivo', 'simulador');
mkdirSync(simDestino, { recursive: true });
for (const f of readdirSync(SIM)) {
  if (f === 'prueba.js' || !/\.(html|js|css)$/.test(f)) continue;
  cpSync(join(SIM, f), join(simDestino, f));
}

// El mapa también se sirve tal cual. Su config.js (el token público de Mapbox) no está en el
// repositorio: se escribe aquí desde la variable MAPBOX_ACCESS_TOKEN del proyecto de Vercel. Sin
// ella el mapa usa la base gratuita de OpenFreeMap con MapLibre.
const MAPA = join(RAIZ, 'mapa');
const mapaDestino = join(DIST, 'mapa');
mkdirSync(mapaDestino, { recursive: true });
for (const f of ['index.html', 'mapa.js', 'estilos.css']) {
  exige(join(MAPA, f));
  cpSync(join(MAPA, f), join(mapaDestino, f));
}
const token = (process.env.MAPBOX_ACCESS_TOKEN || '').trim();
writeFileSync(join(mapaDestino, 'config.js'), 'window.MAPBOX_TOKEN = ' + JSON.stringify(token.startsWith('pk.') ? token : '') + ';\n');

const capasDestino = join(DIST, 'datos', 'procesados', 'mapa');
mkdirSync(capasDestino, { recursive: true });
for (const f of ['cuenca.geojson', 'red_hidrografica.geojson', 'confluencias.geojson', 'toponimia_hidrografica.geojson', 'red_vigilada.geojson']) {
  exige(join(RAIZ, 'datos', 'procesados', 'mapa', f));
  cpSync(join(RAIZ, 'datos', 'procesados', 'mapa', f), join(capasDestino, f));
}

const fixDestino = join(DIST, 'contrato', 'fixtures');
mkdirSync(fixDestino, { recursive: true });
for (const f of ['estaciones.json', 'linea_base.json', 'sitios.geojson']) {
  exige(join(RAIZ, 'contrato', 'fixtures', f));
  cpSync(join(RAIZ, 'contrato', 'fixtures', f), join(fixDestino, f));
}

console.log('Sitio ensamblado en panel/dist: panel, /ciudadano/, /mapa/ y /dispositivo/simulador/' +
  (token.startsWith('pk.') ? ' (mapa con Mapbox).' : ' (mapa con OpenFreeMap: sin MAPBOX_ACCESS_TOKEN).'));

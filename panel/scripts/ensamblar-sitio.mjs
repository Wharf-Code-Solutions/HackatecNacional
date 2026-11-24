// Junta en panel/dist el sitio completo que se despliega en Vercel (un solo proyecto, D25):
//
//   /                        panel de autoridad (panel/dist, ya compilado)
//   /ciudadano/              app ciudadana (ciudadano/dist, compilada con base '/ciudadano/')
//   /dispositivo/simulador/  simulador de la estación (archivos estáticos, sin compilar)
//   /contrato/fixtures/      solo las dos tablas que lee el simulador
//   /api/                    backend: función de Python (api/index.py), no pasa por aquí
//
// Todos hablan con el mismo backend en /api del mismo dominio, así que alertas, reportes y
// estados se ven igual en las tres vistas. Se corre después de compilar panel y app:
//   node panel/scripts/ensamblar-sitio.mjs
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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

const fixDestino = join(DIST, 'contrato', 'fixtures');
mkdirSync(fixDestino, { recursive: true });
for (const f of ['estaciones.json', 'linea_base.json']) {
  exige(join(RAIZ, 'contrato', 'fixtures', f));
  cpSync(join(RAIZ, 'contrato', 'fixtures', f), join(fixDestino, f));
}

console.log('Sitio ensamblado en panel/dist: panel, /ciudadano/ y /dispositivo/simulador/.');

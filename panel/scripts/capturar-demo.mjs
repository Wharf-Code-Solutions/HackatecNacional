// Captura una foto del backend para el modo demostración del panel.
//
// Si el despliegue no tiene VITE_API_URL, el panel muestra esta foto, marcada como
// demostración. La foto NO se calcula aquí: se copia tal cual de lo que respondió el
// backend con el motor real, incluida la predicción de propagación de cada alerta.
//
// Uso, con el backend real (M5) corriendo y un escenario reproducido:
//   backend\.venv\Scripts\python backend\servidor.py --limpiar
//   python contrato/reproducir_escenario.py descarga_industrial
//   npm run capturar-demo                    # o: node scripts/capturar-demo.mjs http://host:puerto
// El mock con --motor real también sirve, pero no calcula la predicción y la foto sale sin ella.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const API = (process.argv[2] || 'http://127.0.0.1:8080').replace(/\/$/, '');
const DESTINO = resolve(AQUI, '..', 'public', 'demo', 'foto.json');
const RAIZ = resolve(AQUI, '..', '..');

async function get(ruta) {
  const r = await fetch(API + ruta);
  if (!r.ok) throw new Error(ruta + ' respondió ' + r.status);
  return r.json();
}

const estaciones = JSON.parse(readFileSync(resolve(RAIZ, 'contrato/fixtures/estaciones.json'), 'utf8')).estaciones;
const salud = await get('/salud');
if (salud.motor !== 'real') {
  console.error('El backend usa el motor "' + salud.motor + '". Arráncalo con --motor real antes de capturar.');
  process.exit(1);
}
const alertas = (await get('/alertas')).alertas;
const reportes = (await get('/reportes')).reportes;
const veredictos = {};
for (const e of estaciones) {
  veredictos[e.c_estacion] = (await get('/veredictos?c_estacion=' + encodeURIComponent(e.c_estacion))).veredictos;
}
const predicciones = {};
for (const a of alertas) {
  const r = await fetch(API + '/alertas/' + encodeURIComponent(a.c_alerta) + '/prediccion');
  if (r.ok) predicciones[a.c_alerta] = await r.json();
}
if (alertas.length && !Object.keys(predicciones).length) {
  console.warn('Este backend no calcula la predicción (¿es el mock?): la foto sale sin ella.');
}
// Gestión de reportes ciudadanos: rutas opcionales; un backend sin ellas deja la foto sin prioridades.
const opcional = (ruta) => fetch(API + ruta).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const pri = await opcional('/prioridades');
const huella = await opcional('/huella');
mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, JSON.stringify({
  capturado: new Date().toISOString(),
  origen: salud.persistencia ? 'backend M5 (' + salud.persistencia + ')' : 'servidor_mock.py --motor real',
  salud, alertas, reportes, veredictos, predicciones,
  prioridades: pri ? pri.prioridades : null, huella,
}) + '\n');
console.log('Foto guardada en public/demo/foto.json: ' + alertas.length + ' alertas, ' + reportes.length +
  ' reportes, ' + Object.keys(predicciones).length + ' predicciones, ' + (pri ? pri.prioridades.length : 0) + ' focos.');

// Captura una foto del backend para el modo demostración del panel.
//
// El panel siempre muestra esta foto como base (lib/datos.js): con backend, encima van las alertas pendientes y los
// reportes que lleguen en vivo; sin backend, solo la foto. Sus horas se corren al abrir el panel para que lo último
// de la foto sea «ahora». La foto NO se calcula aquí: se copia tal cual de lo que respondió el backend con el motor real.
//
// Uso, con un servidor limpio y los 10 mecanismos sembrados (24 h con episodios):
//   python contrato/servidor_mock.py --motor real --puerto 8091
//   python contrato/sembrar_demo.py --url http://127.0.0.1:8091
//   node scripts/capturar-demo.mjs http://127.0.0.1:8091
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

// Las estaciones que muestra el panel: los mecanismos junto a escuelas (App.jsx).
const estaciones = JSON.parse(readFileSync(resolve(RAIZ, 'contrato/fixtures/mecanismos.json'), 'utf8')).estaciones;
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

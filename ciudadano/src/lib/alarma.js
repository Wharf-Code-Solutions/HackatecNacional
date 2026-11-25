// Alarma de deslave: qué alertas suenan y a quién. La lee MapaPage (consulta) y la cambia la hoja de Emergencia.

// 'cerca': solo estaciones a menos de RADIO_M de la persona (su GPS o, sin él, el centro del mapa).
// 'todas': cualquier estación de ladera, para la demostración o para quien quiere seguir toda la cuenca.
// Se guarda en este teléfono. ?alarma=todas o ?alarma=cerca en la URL también la fija.
const CLAVE = 'atoyac.alarma';
export const RADIO_M = 5000;

// La URL se lee una sola vez, al abrir: después manda el interruptor (si se leyera en cada consulta, la pisaría).
let enMemoria = null;
try {
  const q = new URLSearchParams(window.location.search).get('alarma');
  if (q === 'todas' || q === 'cerca') { enMemoria = q; localStorage.setItem(CLAVE, q); }
} catch { /* sin URL o sin almacenamiento */ }

export function modoAlarma() {
  try { return (localStorage.getItem(CLAVE) || enMemoria) === 'todas' ? 'todas' : 'cerca'; } catch { return enMemoria === 'todas' ? 'todas' : 'cerca'; }
}

export function guardarModoAlarma(v) {
  enMemoria = v;
  try { localStorage.setItem(CLAVE, v); } catch { /* sin almacenamiento: dura hasta recargar */ }
}

// Suena el movimiento de la ladera desde que empieza (Preventiva: la estaca pasa su umbral de aviso), porque es el
// aviso que da tiempo de evacuar; y cualquier alerta Crítica de ladera (la ladera cedió, lluvia o suelo críticos).
// La lluvia o el suelo en Preventiva no suenan: en temporada pasarían casi a diario y la alarma dejaría de oírse.
export const suena = (a) => (a.regla === 'movimiento_ladera' ? (a.nivel === 'Preventiva' || a.nivel === 'Critica') : a.nivel === 'Critica');

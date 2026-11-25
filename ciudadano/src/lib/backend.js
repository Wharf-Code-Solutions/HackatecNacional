// Descubrimiento del backend, igual que el panel (panel/src/lib/datos.js, origenBackend), con una
// diferencia en desarrollo: el mock se pide por '/mock', que el servidor de Vite reenvía a
// 127.0.0.1:8080. Así un teléfono (o un túnel HTTPS) llega al mock sin tocar la IP de la
// computadora ni mezclar HTTP con HTTPS.
//
//  ?api=<url>            gana siempre
//  VITE_API_URL          en la compilación
//  en desarrollo         '/mock'
//  si nada de lo anterior: modo demostración; no hay backend y la app lo dice.
export function origenBackend() {
  const q = new URLSearchParams(window.location.search).get('api');
  if (q) return { modo: 'api', url: q.replace(/\/$/, '') };
  const env = import.meta.env.VITE_API_URL;
  if (env) return { modo: 'api', url: env.replace(/\/$/, '') };
  if (import.meta.env.DEV) return { modo: 'api', url: '/mock' };
  return { modo: 'demo', url: null };
}

const BASE = import.meta.env.BASE_URL;

export async function getJSON(url, opciones) {
  const r = await fetch(url, opciones);
  if (!r.ok) {
    const e = new Error(url + ' ' + r.status);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

export const datosFijos = () => Promise.all([
  getJSON(BASE + 'datos/sitios.geojson'),
  getJSON(BASE + 'datos/cuenca.geojson').catch(() => null),
  // Sin el área, la app usa la ventana del esquema (ubicacion.js): no se bloquea a nadie por un archivo que no cargó.
  getJSON(BASE + 'datos/area_reportes.json').catch(() => null),
  getJSON(BASE + 'datos/mecanismos.json').catch(() => null),
]).then(([g, cuenca, area, mec]) => {
  const sitios = g.features.map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
  const estaciones = {};
  ((mec && mec.estaciones) || []).forEach((e) => { estaciones[e.c_estacion] = e; });
  return { sitios, cuenca, area: area && { celda: area.celda, celdas: new Set(area.celdas) }, estaciones };
});

export const fotoDemo = () => getJSON(BASE + 'demo/foto.json');

// ¿Hay backend vivo? Devuelve true/false; nunca lanza.
export async function backendVivo(origen) {
  if (origen.modo !== 'api') return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch(origen.url + '/salud', { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

// Envía un reporte. Resultados:
//  { ok: true, c_reporte, estado }
//  { ok: false, reintentable: true }                 sin red o error del servidor: va a la cola
//  { ok: false, reintentable: false, estado, texto } el contrato lo rechazó: no se reintenta igual
export async function enviarReporte(origen, payload) {
  if (origen.modo !== 'api') return { ok: false, reintentable: true };
  let r;
  try {
    r = await fetch(origen.url + '/reportes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, reintentable: true };
  }
  if (r.status === 201) {
    const j = await r.json();
    // 'enviado' si el backend ya mandó el recibo al correo de la persona (cabecera expuesta por CORS)
    return { ok: true, c_reporte: j.c_reporte, estado: j.estado, correo: r.headers.get('X-Aviso-Correo') };
  }
  // Misma persona, mismo problema, mismo punto, hace poco: el backend no crea otro y devuelve el folio que ya tenía
  if (r.status === 200) {
    const j = await r.json().catch(() => ({}));
    if (j.c_reporte) return { ok: true, c_reporte: j.c_reporte, estado: j.estado, repetido: !!j.repetido };
  }
  // Demasiados envíos seguidos: se vale reintentar, pero dentro de un minuto (en la cola no se pierde)
  if (r.status === 429) {
    const j = await r.json().catch(() => ({}));
    return { ok: false, reintentable: true, espera: true, texto: j.detalle || 'Espera un minuto y vuelve a intentar.' };
  }
  if (r.status >= 500) return { ok: false, reintentable: true };
  let detalle = '';
  try { const j = await r.json(); detalle = [j.error, j.detalle, ...(j.detalles || [])].filter(Boolean).join(' · '); } catch { /* sin cuerpo */ }
  return { ok: false, reintentable: false, estado: r.status, texto: detalle };
}

export async function consultarFolio(origen, folio) {
  if (origen.modo === 'demo') {
    const f = await fotoDemo();
    const r = (f.reportes || []).find((x) => x.c_reporte === folio);
    if (!r) { const e = new Error('no existe'); e.status = 404; throw e; }
    return r;
  }
  return getJSON(origen.url + '/reportes/' + encodeURIComponent(folio));
}

// ¿La foto corresponde a alguno de los tipos? Pregunta al backend (que usa Gemini). Nunca lanza:
//  { estado: 'ok', valida, tipo, confianza, motivo, modelo }
//  { estado: 'no_disponible' }   sin backend, sin llave, sin red o con error: se deja enviar con aviso
export async function analizarFoto(origen, dataUrl) {
  if (origen.modo !== 'api') return { estado: 'no_disponible' };
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 20000);
    const r = await fetch(origen.url + '/reportes/analizar-foto', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foto: dataUrl }), signal: c.signal,
    });
    clearTimeout(t);
    if (!r.ok) return { estado: 'no_disponible' };
    const j = await r.json();
    return j.estado === 'ok' ? j : { estado: 'no_disponible' };
  } catch {
    return { estado: 'no_disponible' };
  }
}

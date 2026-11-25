// Distancia de un punto al cauce más cercano de la red del INEGI de orden >= 4 (la que dibuja el mapa,
// datos/procesados/mapa/red_hidrografica.geojson). La usa el panel cuando un reporte llegó sin distancia: el
// backend la medía solo contra la red de asignación (tramos con un sitio de monitoreo a menos de 20 km) y
// fuera de ella decía "sin cauce" aunque hubiera un río al lado. El backend ya la mide igual (asignacion.py).
const LAT0 = 19.1, M_LAT = 110574, M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180), CELDA = 0.01;
let promesa = null;

function cargar() {
  if (!promesa) {
    promesa = fetch(import.meta.env.BASE_URL + 'datos/red_hidrografica.geojson')
      .then((r) => (r.ok ? r.json() : { features: [] }))
      .then((red) => {
        const lineas = [], rejilla = new Map();
        (red.features || []).forEach((f) => {
          const g = f.geometry || {};
          const partes = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates || []];
          partes.forEach((pts) => {
            if (pts.length < 2) return;
            const k = lineas.push(pts) - 1;
            for (let i = 0; i < pts.length - 1; i++) {
              const [a, b] = [pts[i], pts[i + 1]];
              const x0 = Math.floor(Math.min(a[0], b[0]) / CELDA), x1 = Math.floor(Math.max(a[0], b[0]) / CELDA);
              const y0 = Math.floor(Math.min(a[1], b[1]) / CELDA), y1 = Math.floor(Math.max(a[1], b[1]) / CELDA);
              for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
                const c = x + ',' + y;
                if (!rejilla.has(c)) rejilla.set(c, []);
                rejilla.get(c).push([k, i]);
              }
            }
          });
        });
        return { lineas, rejilla };
      })
      .catch(() => ({ lineas: [], rejilla: new Map() }));
  }
  return promesa;
}

function proyecta(p, a, b) {
  const ax = (a[0] - p[0]) * M_LON, ay = (a[1] - p[1]) * M_LAT, bx = (b[0] - p[0]) * M_LON, by = (b[1] - p[1]) * M_LAT;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

// Metros al cauce más cercano en unos 2 km, o null si no hay.
export async function distanciaAlCauce(lat, lon) {
  if (lat == null || lon == null) return null;
  const { lineas, rejilla } = await cargar();
  const cx = Math.floor(lon / CELDA), cy = Math.floor(lat / CELDA);
  let mejor = null;
  for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 2; y <= cy + 2; y++) {
    (rejilla.get(x + ',' + y) || []).forEach(([k, i]) => {
      const d = proyecta([lon, lat], lineas[k][i], lineas[k][i + 1]);
      if (mejor === null || d < mejor) mejor = d;
    });
  }
  return mejor;
}

// Geolocalización del navegador y sitio más cercano en línea recta.
// El sitio que la app muestra es una orientación: la asignación sobre el cauce la hace el backend.

// Ventana que acepta el esquema del reporte (reporte_ciudadano.schema.json).
export const VENTANA = { latMin: 17.5, latMax: 20.5, lonMin: -99.5, lonMax: -97.0 };

export const dentroDeVentana = (lat, lon) =>
  lat >= VENTANA.latMin && lat <= VENTANA.latMax && lon >= VENTANA.lonMin && lon <= VENTANA.lonMax;

// ¿Se puede reportar en este punto? Dentro de Puebla, aproximada por la malla de area_reportes.json
// (scripts/103_area_reportes.py). Si el área no cargó, basta la ventana del esquema.
export const dentroDeArea = (area, lat, lon) => {
  if (!dentroDeVentana(lat, lon)) return false;
  if (!area) return true;
  return area.celdas.has(Math.floor(lat / area.celda) + ',' + Math.floor(lon / area.celda));
};

export const TEXTO_FUERA = 'Solo se puede reportar dentro del estado de Puebla. Mueve el mapa hasta el lugar del problema.';

export function posicion() {
  return new Promise((resolver, rechazar) => {
    if (!window.isSecureContext) return rechazar({ codigo: 'inseguro' });
    if (!navigator.geolocation) return rechazar({ codigo: 'no_soportada' });
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lon: p.coords.longitude, precision: Math.round(p.coords.accuracy) }),
      (e) => rechazar({ codigo: e.code === 1 ? 'denegada' : e.code === 3 ? 'tiempo' : 'sin_senal' }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  });
}

export const textoErrorUbicacion = {
  inseguro: 'El navegador solo da la ubicación en páginas seguras (HTTPS).',
  no_soportada: 'Este navegador no puede dar tu ubicación.',
  denegada: 'No diste permiso de ubicación. Actívalo en los ajustes del navegador y vuelve a intentar.',
  tiempo: 'La ubicación tardó demasiado. Sal a un lugar abierto y vuelve a intentar.',
  sin_senal: 'No se pudo obtener la ubicación. Vuelve a intentar.',
};

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function cercanos(sitios, lat, lon, k = 5) {
  return sitios.map((s) => ({ ...s, dist: haversine(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.dist - b.dist).slice(0, k);
}

// Coordenada para mostrar: cinco decimales (≈ 1 m), la misma precisión con que se dibuja el pin.
export const coordenada = (v) => v.toFixed(5);

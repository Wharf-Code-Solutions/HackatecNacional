// Foto del reporte: se reescala y se re-codifica en un <canvas>. Ese re-encode descarta el EXIF
// (coordenadas y modelo del teléfono), así que las coordenadas del denunciante no salen del
// dispositivo (invariante I14). Salida: JPEG de lado mayor 640 px, calidad 0.6.
const LADO = 640;
const CALIDAD = 0.6;
// Umbrales a calibrar con fotos reales del río; hoy son un punto de partida razonable.
const UMBRAL_BORROSA = 40;      // varianza del laplaciano
const BRILLO_MIN = 40, BRILLO_MAX = 220;
const LADO_MIN_ORIGINAL = 200;

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('no se pudo leer la imagen')); };
    img.src = url;
  });
}

// Brillo medio y varianza del laplaciano sobre la imagen en grises.
export function calidad(data, ancho, alto) {
  const g = new Float32Array(ancho * alto);
  let suma = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    g[j] = v; suma += v;
  }
  const brillo = suma / g.length;
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      const l = g[i - 1] + g[i + 1] + g[i - ancho] + g[i + ancho] - 4 * g[i];
      s += l; s2 += l * l; n++;
    }
  }
  const media = s / n;
  return { brillo, nitidez: s2 / n - media * media };
}

export async function prepararFoto(archivo) {
  const img = await cargarImagen(archivo);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const f = Math.min(1, LADO / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * f)), h = Math.max(1, Math.round(h0 * f));
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { brillo, nitidez } = calidad(ctx.getImageData(0, 0, w, h).data, w, h);

  const avisos = [];
  if (Math.min(w0, h0) < LADO_MIN_ORIGINAL) avisos.push('La foto es muy pequeña y casi no se va a distinguir.');
  if (nitidez < UMBRAL_BORROSA) avisos.push('La foto se ve borrosa.');
  if (brillo < BRILLO_MIN) avisos.push('La foto está muy oscura.');
  else if (brillo > BRILLO_MAX) avisos.push('La foto está muy clara o quemada.');

  const dataUrl = lienzo.toDataURL('image/jpeg', CALIDAD);
  return { dataUrl, kb: Math.round((dataUrl.length * 3) / 4 / 1024), avisos };
}

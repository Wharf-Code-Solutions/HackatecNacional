export function hora(iso) {
  if (!iso) return 'sin dato';
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Solo la hora si es el mismo dia que `referencia`; si no, tambien el dia.
export function horaCorta(iso, referencia) {
  if (!iso) return 'sin dato';
  const d = new Date(iso);
  const t = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (referencia && d.toDateString() === new Date(referencia).toDateString()) return t;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ', ' + t;
}

export function num(v, dec = 2) {
  if (v == null || Number.isNaN(Number(v))) return 'sin dato';
  return Number(v).toLocaleString('es-MX', { maximumFractionDigits: dec });
}

export const km = (m) => num(m / 1000, 1) + ' km';

// "RÍO ATOYAC DESPUES DE CONFLUENCIA" -> "Río Atoyac despues de confluencia".
const MENORES = /^(de|del|la|las|el|los|y|con|a|en|antes|despues|después|aguas|arriba|abajo|confluencia|puente|sitio|cercanos|puntos)$/;
export function inicial(t) {
  return (t || '').toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && MENORES.test(w.replace(/[(),]/g, ''))) return w;
    return w.replace(/^([(]?)([a-záéíóúñ])/, (m, a, b) => a + b.toUpperCase());
  }).join(' ');
}

// CSV con comillas dobles; quita el BOM (I4: los CSV del repo son utf-8-sig).
export function leeCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const filas = [];
  let fila = [], campo = '', dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentro) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentro = false;
      else campo += c;
    } else if (c === '"') dentro = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = filas.shift();
  return filas.filter((f) => f.length === cab.length)
    .map((f) => Object.fromEntries(cab.map((k, j) => [k, f[j]])));
}

export const porAtender = (a) => a.estado === 'Abierta' || a.estado === 'En atencion';

// Almacenamiento local: cola de reportes sin enviar, folios propios y aceptación del aviso.
// Todo envuelto en try/catch: en ventana privada o con el almacenamiento lleno puede fallar y la
// app tiene que seguir funcionando.
const COLA = 'ciudadano.cola';
const FOLIOS = 'ciudadano.folios';
const AVISO = 'ciudadano.aviso';

const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const cola = () => leer(COLA, []);
export function encolar(payload) {
  const item = { id: 'L-' + Date.now().toString(36), creado: new Date().toISOString(), payload };
  return escribir(COLA, [...cola(), item]) ? item : null;
}
export const quitarDeCola = (id) => escribir(COLA, cola().filter((x) => x.id !== id));

export const folios = () => leer(FOLIOS, []);
export function guardarFolio(c_reporte, tipo, fecha_hora) {
  escribir(FOLIOS, [{ c_reporte, tipo, fecha_hora }, ...folios().filter((f) => f.c_reporte !== c_reporte)].slice(0, 20));
}

export const avisoAceptado = () => leer(AVISO, false) === true;
export const aceptarAviso = () => escribir(AVISO, true);

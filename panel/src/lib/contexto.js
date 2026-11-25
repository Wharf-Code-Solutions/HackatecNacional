import { createContext, useContext } from 'react';
import { inicial } from './formato.js';
import { LADERA, UNIDAD_LADERA } from './etiquetas.js';

// Tablas fijas y ayudantes que casi todos los componentes necesitan.
export const Datos = createContext(null);
export const useDatos = () => useContext(Datos);

export function ayudantes(fijos) {
  const { estaciones, lineaBase, mecanismos = {}, escuelas = [], umbralesLadera = null } = fijos;
  // Una estación del Atoyac (estaciones.json) o un mecanismo junto a escuela (mecanismos.json).
  const estacionDe = (c) => estaciones[c] || mecanismos[c] || {};
  const nombreEstacion = (c) => {
    const e = estaciones[c];
    if (e) return inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio);
    const m = mecanismos[c];
    return m ? inicial(m.escuela || m.nombre || c) + ', ' + inicial(m.municipio || '') : c;
  };
  const banda = (a) => {
    const sitio = a.c_sitio || estacionDe(a.c_estacion).c_sitio;
    return (lineaBase[sitio] || {})[a.c_parametro] || null;
  };
  const unidad = (a) => {
    const b = banda(a);
    if (b && b.unidad) return ' ' + b.unidad;
    return UNIDAD_LADERA[a.c_parametro] ? ' ' + UNIDAD_LADERA[a.c_parametro] : '';
  };
  // Escuelas que afecta una alerta (docs/19 §6, punto 4): las que manda el motor; si no las manda, las que
  // protege su mecanismo (mecanismos.json) o las que tienen ese c_estacion (escuelas.json).
  const porCct = Object.fromEntries(escuelas.map((e) => [e.cct, e]));
  const escuelasDe = (a) => {
    let ccts = a.escuelas_afectadas;
    if (!ccts || !ccts.length) ccts = (mecanismos[a.c_estacion] || {}).escuelas_protegidas;
    if (!ccts || !ccts.length) ccts = escuelas.filter((e) => e.c_estacion === a.c_estacion).map((e) => e.cct);
    return [...new Set(ccts || [])].map((c) => porCct[c] || { cct: c, nombre: c });
  };
  // Umbrales de un sensor de ladera en una estación (los mismos que usa el motor). Para LLUVIA, en la ventana pedida
  // (24 o 72 h). Devuelve [{ valor, nivel, etiqueta }], del menor al mayor; vacío si no aplica.
  const umbralesDe = (c, cp, ventana = 24) => {
    const u = umbralesLadera;
    if (!u || !LADERA.includes(cp)) return [];
    const k = ventana === 72 ? 1 : 0;
    if (cp === 'LLUVIA') {
      return [
        [(u.p99[c] || [])[k], 'Informativa', 'p99 del sitio'],
        [u.lluvia.Preventiva[k], 'Preventiva', 'Preventiva'],
        [u.lluvia.Critica[k], 'Critica', 'Crítica'],
      ].filter(([v]) => typeof v === 'number').map(([valor, nivel, etiqueta]) => ({ valor, nivel, etiqueta }));
    }
    if (cp === 'HUM_SUELO') {
      const v = u.humedad[c] ?? u.humedadPorDefecto;
      return [{ valor: v, nivel: 'Informativa', etiqueta: 'Cerca de saturación' }];
    }
    return [{ valor: u.inclinacion.aviso, nivel: 'Preventiva', etiqueta: 'Aviso' },
      { valor: u.inclinacion.critico, nivel: 'Critica', etiqueta: 'Crítico' }];
  };
  // Mecanismos que protegen a una escuela: el de su c_estacion y los que la listan en escuelas_protegidas.
  const mecanismosDe = (cct) => Object.values(mecanismos).filter((m) => (m.escuelas_protegidas || []).includes(cct)
    || escuelas.some((e) => e.cct === cct && e.c_estacion === m.c_estacion));
  // Un mecanismo está activo cuando tiene todo autorizado; si toca agua, sin la de CEASPUE nunca (docs/19 §4.3).
  const mecanismoActivo = (m) => {
    const a = m.autorizaciones || [];
    const ce = a.filter((x) => x.organismo === 'CEASPUE');
    if (ce.length) return ce.some((x) => x.estado === 'otorgada');
    return a.length > 0 && a.every((x) => x.estado === 'otorgada');
  };
  return { ...fijos, nombreEstacion, banda, unidad, escuelasDe, estacionDe, umbralesDe, mecanismosDe, mecanismoActivo };
}

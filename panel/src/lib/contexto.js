import { createContext, useContext } from 'react';
import { inicial } from './formato.js';

// Tablas fijas y ayudantes que casi todos los componentes necesitan.
export const Datos = createContext(null);
export const useDatos = () => useContext(Datos);

export function ayudantes(fijos) {
  const { estaciones, lineaBase, mecanismos = {}, escuelas = [] } = fijos;
  const nombreEstacion = (c) => {
    const e = estaciones[c];
    if (e) return inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio);
    const m = mecanismos[c];
    return m ? inicial(m.escuela || m.nombre || c) + ', ' + inicial(m.municipio || '') : c;
  };
  const banda = (a) => {
    const sitio = a.c_sitio || (estaciones[a.c_estacion] || {}).c_sitio;
    return (lineaBase[sitio] || {})[a.c_parametro] || null;
  };
  const unidad = (a) => {
    const b = banda(a);
    return b && b.unidad ? ' ' + b.unidad : '';
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
  return { ...fijos, nombreEstacion, banda, unidad, escuelasDe };
}

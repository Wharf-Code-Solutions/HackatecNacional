import { createContext, useContext } from 'react';
import { inicial } from './formato.js';

// Tablas fijas y ayudantes que casi todos los componentes necesitan.
export const Datos = createContext(null);
export const useDatos = () => useContext(Datos);

export function ayudantes(fijos) {
  const { estaciones, lineaBase } = fijos;
  const nombreEstacion = (c) => {
    const e = estaciones[c];
    return e ? inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio) : c;
  };
  const banda = (a) => {
    const sitio = a.c_sitio || (estaciones[a.c_estacion] || {}).c_sitio;
    return (lineaBase[sitio] || {})[a.c_parametro] || null;
  };
  const unidad = (a) => {
    const b = banda(a);
    return b && b.unidad ? ' ' + b.unidad : '';
  };
  return { ...fijos, nombreEstacion, banda, unidad };
}

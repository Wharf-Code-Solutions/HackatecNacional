import { useDatos } from '../lib/contexto.js';
import { NIVELES, COLOR_NIVEL, PARAM, txt } from '../lib/etiquetas.js';
import { inicial, porAtender } from '../lib/formato.js';
import BarraAtencion from '../graficas/BarraAtencion.jsx';
import BarrasH from '../graficas/BarrasH.jsx';
import GraficaHoras from '../graficas/GraficaHoras.jsx';
import MatrizEstaciones from '../graficas/MatrizEstaciones.jsx';

function Tarjeta({ titulo, ancha, children }) {
  return (
    <figure className={'tarjeta' + (ancha ? ' ancha' : '')}>
      <h2 className="titulo-seccion">{titulo}</h2>
      {children}
    </figure>
  );
}

export default function Panorama({ alertas, veredictos, corte }) {
  const { estaciones, lineaBase } = useDatos();
  const porEstacion = Object.keys(estaciones).sort().map((c) => {
    const partes = {};
    let total = 0;
    alertas.forEach((a) => {
      if (a.c_estacion === c && porAtender(a)) { partes[a.nivel] = (partes[a.nivel] || 0) + 1; total++; }
    });
    return { nombre: c.replace('EST-', '') + ' ' + inicial(estaciones[c].cuerpo_agua), partes, total };
  });
  const cuenta = {};
  alertas.forEach((a) => { cuenta[a.c_parametro] = (cuenta[a.c_parametro] || 0) + 1; });
  const porParametro = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])
    .map((k) => ({ nombre: PARAM[k] || k, partes: { n: cuenta[k] }, total: cuenta[k] }));

  return (
    <div className="panorama">
      <Tarjeta titulo="Alertas por hora" ancha><GraficaHoras alertas={alertas} /></Tarjeta>
      <Tarjeta titulo="Cómo están las estaciones ahora">
        <MatrizEstaciones estaciones={estaciones} lineaBase={lineaBase} veredictos={veredictos} corte={corte} />
      </Tarjeta>
      <Tarjeta titulo="Alertas por atender, por estación">
        <BarrasH filas={porEstacion} claves={NIVELES} colores={COLOR_NIVEL} nombreClave={txt} plural
          nota="Solo alertas por atender (abiertas y en atención)." />
      </Tarjeta>
      <Tarjeta titulo="Qué parámetro las dispara">
        <BarrasH filas={porParametro} claves={['n']} colores={{ n: '#9B2247' }} nombreClave={() => 'alertas'}
          nota="Todas las alertas, por el parámetro que las disparó." />
      </Tarjeta>
      <Tarjeta titulo="Avance de la atención"><BarraAtencion alertas={alertas} /></Tarjeta>
    </div>
  );
}

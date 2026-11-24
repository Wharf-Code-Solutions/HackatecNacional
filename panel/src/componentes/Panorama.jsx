import { useDatos } from '../lib/contexto.js';
import { NIVELES, COLOR_NIVEL, PARAM, txt } from '../lib/etiquetas.js';
import { inicial, porAtender } from '../lib/formato.js';
import BarraAtencion from '../graficas/BarraAtencion.jsx';
import BarrasH from '../graficas/BarrasH.jsx';
import GraficaHoras from '../graficas/GraficaHoras.jsx';
import Huella from '../graficas/Huella.jsx';
import MapaEstaciones from '../graficas/MapaEstaciones.jsx';
import MatrizEstaciones from '../graficas/MatrizEstaciones.jsx';

function Tarjeta({ titulo, subtitulo, ancha, children }) {
  return (
    <figure className={'tarjeta' + (ancha ? ' ancha' : '')}>
      <h2 className="titulo-seccion">{titulo}</h2>
      {subtitulo && <p className="subtitulo-seccion">{subtitulo}</p>}
      {children}
    </figure>
  );
}

export default function Panorama({ parte, alertas, veredictos, corte, elegida, onElegir, escuelas }) {
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

  // Dos partes: arriba el mapa y el estado de las estaciones lado a lado; abajo, despues de la
  // tabla de estaciones y de las alertas, las graficas.
  if (parte === 'mapa') return (
    <div className="panorama">
      <Tarjeta titulo="La red de estaciones" subtitulo="Estaciones y escuelas rurales en riesgo. En rojo, las estaciones con una alerta por atender; un clic filtra la lista de alertas.">
        <MapaEstaciones estaciones={estaciones} alertas={alertas} elegida={elegida} onElegir={onElegir} escuelas={escuelas} />
      </Tarjeta>
      <Tarjeta titulo="Cómo están las estaciones ahora" subtitulo="Última lectura de cada sonda frente a la historia de su sitio.">
        <MatrizEstaciones estaciones={estaciones} lineaBase={lineaBase} veredictos={veredictos} corte={corte} />
      </Tarjeta>
    </div>
  );
  return (
    <div className="panorama">
      <Tarjeta titulo="Huella de las últimas horas" subtitulo="Cuándo se salió cada sonda de la estación de lo habitual." ancha>
        <Huella estaciones={estaciones} veredictos={veredictos} alertas={alertas} elegida={elegida} />
      </Tarjeta>
      <Tarjeta titulo="Alertas por hora" ancha><GraficaHoras alertas={alertas} /></Tarjeta>
      <Tarjeta titulo="Alertas por atender, por estación">
        <BarrasH filas={porEstacion} claves={NIVELES} colores={COLOR_NIVEL} nombreClave={txt} plural
          nota="Solo alertas por atender (abiertas y en atención)." />
      </Tarjeta>
      <Tarjeta titulo="Qué parámetro las dispara">
        <BarrasH filas={porParametro} claves={['n']} colores={{ n: '#9B2247' }} nombreClave={() => 'alertas'}
          nota="Todas las alertas, por el parámetro que las disparó." />
      </Tarjeta>
      <Tarjeta titulo="Avance de la atención" ancha><BarraAtencion alertas={alertas} /></Tarjeta>
    </div>
  );
}

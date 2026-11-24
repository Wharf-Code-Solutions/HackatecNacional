import { useEffect, useState } from 'react';
import { horaCorta, inicial, km, num } from '../lib/formato.js';
import Llegadas, { COLOR_CONFIANZA } from '../graficas/Llegadas.jsx';
import { Mensaje } from '../graficas/marcas.jsx';

// Mas alla de esta distancia M3 marca la prediccion como fuera del alcance util
// (scripts/80_propagacion.py, DISTANCIA_UTIL_M). Aqui solo decide que se grafica primero.
const ALCANCE_UTIL_M = 50000;
const EN_GRAFICA = 10;

function horasDesde(iso, t0) {
  const h = (new Date(iso).getTime() - t0) / 3600000;
  return h < 1 ? Math.round(h * 60) + ' min' : num(h, h < 10 ? 1 : 0) + ' h';
}

// Propagacion aguas abajo de la alerta (M3). El panel no calcula nada: lo pide al
// backend (GET /alertas/<c_alerta>/prediccion). Si no la hay, muestra la topologia.
export default function Prediccion({ alerta, unidad, obtener, sinPrediccion }) {
  const [res, setRes] = useState(null);
  const [todos, setTodos] = useState(false);
  useEffect(() => {
    let vigente = true;
    setRes(null);
    setTodos(false);
    obtener(alerta.c_alerta).then((r) => { if (vigente) setRes(r); });
    return () => { vigente = false; };
  }, [alerta.c_alerta, obtener]);

  if (!res) return <p className="vacio">Calculando hasta dónde llega.</p>;
  if (!res.prediccion) {
    return (
      <>
        <Mensaje tipo="info">{res.motivo} Mientras tanto, estos son los sitios de monitoreo río abajo, por distancia sobre el cauce.</Mensaje>
        {sinPrediccion}
      </>
    );
  }

  const p = res.prediccion;
  const t0 = new Date(alerta.fecha_hora).getTime();
  const destinos = p.destinos || [];
  if (!destinos.length) {
    return <Mensaje>Ningún sitio de monitoreo aguas abajo en la topología: no hay a dónde propagar.</Mensaje>;
  }
  const utiles = destinos.filter((d) => d.distancia_cauce_m <= ALCANCE_UTIL_M);
  const primero = destinos[0];
  const enGrafica = (todos ? destinos : utiles).slice(0, todos ? destinos.length : EN_GRAFICA);
  const ultimoUtil = utiles[utiles.length - 1];
  const s = p.supuestos || {};
  const vel = s.velocidad_flujo_m_s || [];
  const banda = (d) => (d.valor_estimado_min != null
    ? `${num(d.valor_estimado_min, 0)} a ${num(d.valor_estimado_max, 0)}${unidad}` : 'sin dato');

  return (
    <>
      <p className="lead-prediccion">
        Llegaría primero a <b>{inicial(primero.nombre || primero.c_sitio_destino)}</b>, a {km(primero.distancia_cauce_m)} por
        el cauce, entre <b>{horaCorta(primero.llegada_estimada.desde, alerta.fecha_hora)}</b> y{' '}
        <b>{horaCorta(primero.llegada_estimada.hasta, alerta.fecha_hora)}</b>
        {ultimoUtil && utiles.length > 1
          ? <>, y a {utiles.length} sitios dentro de {ALCANCE_UTIL_M / 1000} km en las siguientes {horasDesde(ultimoUtil.llegada_estimada.hasta, t0)}.</>
          : '.'}
      </p>

      <div className="cifras">
        <div><b>+{horasDesde(primero.llegada_estimada.desde, t0)} a +{horasDesde(primero.llegada_estimada.hasta, t0)}</b><span>Llegada al primer sitio aguas abajo</span></div>
        <div><b>{utiles.length}</b><span>Sitios a menos de {ALCANCE_UTIL_M / 1000} km · {destinos.length} en total</span></div>
        <div><b>{banda(primero)}</b><span>Valor esperado en el primer sitio (p10 a p90)</span></div>
      </div>

      <figure className="grafica" style={{ marginTop: 16 }}>
        <Llegadas destinos={enGrafica} inicio={alerta.fecha_hora} unidad={unidad} />
        <p className="pie-graf">
          Cada barra es la ventana en que llegaría la contaminación a ese sitio, contada desde la alerta.
          {!todos && destinos.length > enGrafica.length && <> Se muestran los {enGrafica.length} más cercanos. </>}
          {destinos.length > EN_GRAFICA && (
            <button className="enlace" onClick={() => setTodos(!todos)}>
              {todos ? 'Ver solo los cercanos' : `Ver los ${destinos.length} sitios`}
            </button>
          )}
        </p>
      </figure>

      <div className="tabla-desliza" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th className="num">#</th><th>Sitio</th><th className="num">Por el cauce</th>
              <th>Llega entre</th><th className="num">Valor esperado</th><th>Confianza</th>
            </tr>
          </thead>
          <tbody>
            {(todos ? destinos : destinos.slice(0, EN_GRAFICA)).map((d) => (
              <tr key={d.c_sitio_destino}>
                <td className="num tenue">{d.orden_aguas_abajo}</td>
                <td>
                  {inicial(d.nombre || d.c_sitio_destino)} <span className="tenue">{d.c_sitio_destino}</span>
                  {d.advertencia && <><br /><span className="nota">{d.advertencia}</span></>}
                </td>
                <td className="num">{km(d.distancia_cauce_m)}</td>
                <td className="sin-corte">{horaCorta(d.llegada_estimada.desde, alerta.fecha_hora)} a {horaCorta(d.llegada_estimada.hasta, alerta.fecha_hora)}</td>
                <td className="num">{banda(d)}</td>
                <td><span className="confianza"><i style={{ background: COLOR_CONFIANZA[d.confianza] || '#DDDDDD' }} />{d.confianza || 'sin dato'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="supuestos">
        <summary>Supuestos del modelo</summary>
        <ul className="lista">
          {vel.length === 2 && <li>Velocidad del agua entre {num(vel[0], 1)} y {num(vel[1], 1)} m/s
            {s.fuente_velocidad === 'supuesto_declarado' ? ': no hay medición en esta cuenca, es un supuesto declarado' : ''}. De ahí sale la ventana, nunca una hora exacta.</li>}
          {s.k_decaimiento_por_dia === 0 && <li>Sin decaimiento (k = 0): en este río la concentración aguas abajo no baja de forma medible entre sitios.</li>}
          <li>El valor esperado es una banda (percentiles 10 a 90 de lo observado entre sitios vecinos), no un valor puntual.</li>
          <li>El nivel de alerta esperado en cada sitio todavía no se clasifica: le toca al motor de reglas.</li>
        </ul>
        {s.notas && <p className="nota">{s.notas}</p>}
      </details>
    </>
  );
}

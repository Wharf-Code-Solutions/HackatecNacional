import { inicial, num } from '../lib/formato.js';
import { COLOR_RIESGO, NIVEL_RIESGO } from './FichaEscuela.jsx';

// Análisis de urbanización (docs/19 §6, punto 3): los factores del desglose que tienen que ver con cómo se
// ocupa el terreno, comparados entre escuelas. Cada factor llega ya ponderado en el desglose; aquí se
// divide entre su peso para leerlo de 0 a 1 (qué tanto lo tiene la escuela), sin depender del peso.
// Pesos de scripts/97_escuelas_riesgo.py (hipótesis); si cambian allá, cambian aquí.
const FACTORES = [
  ['urbanizacion_reciente', 'Urbanización reciente', 0.10],
  ['sin_drenaje', 'Sin drenaje', 0.05],
  ['pendiente', 'Pendiente', 0.25],
];
const MAX_FILAS = 15;
const CIFRA = { 'Urbanización reciente': 'con urbanización reciente cerca', 'Sin drenaje': 'en localidades con falta de drenaje', 'Pendiente': 'en ladera con pendiente' };

const puntaje = (e, k, peso) => {
  const v = ((e.riesgo || {}).desglose || {})[k];
  return v == null ? null : Math.min(1, v / peso);
};
const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export default function Urbanizacion({ escuelas, onElegir }) {
  const conDato = escuelas.filter((e) => e.riesgo && e.riesgo.desglose);
  if (!conDato.length) return null;
  const urb = (e) => FACTORES.reduce((s, [k, , p]) => s + (puntaje(e, k, p) || 0), 0);
  const filas = [...conDato].sort((a, b) => urb(b) - urb(a) || (b.riesgo.indice || 0) - (a.riesgo.indice || 0)).slice(0, MAX_FILAS);

  // ¿La urbanización reciente acompaña a un riesgo mayor? Índice medio con y sin ella.
  const con = conDato.filter((e) => (puntaje(e, 'urbanizacion_reciente', 0.10) || 0) > 0);
  const sin = conDato.filter((e) => !((puntaje(e, 'urbanizacion_reciente', 0.10) || 0) > 0));
  const mCon = media(con.map((e) => e.riesgo.indice || 0)), mSin = media(sin.map((e) => e.riesgo.indice || 0));
  const cuenta = FACTORES.map(([k, nombre, p]) => [nombre, conDato.filter((e) => (puntaje(e, k, p) || 0) > 0).length]);

  return (
    <figure className="tarjeta ancha">
      <h2 className="titulo-seccion">Urbanización y riesgo</h2>
      <p className="subtitulo-seccion">
        Qué tanto tiene cada escuela de urbanización reciente cerca, falta de drenaje en su localidad y pendiente
        fuerte (0 nada, 1 el máximo). Las {filas.length} con más, de {conDato.length}.
      </p>

      <div className="cifras urb-cifras">
        {cuenta.map(([nombre, n]) => <div key={nombre}><b>{n}</b><span>{CIFRA[nombre]}</span></div>)}
      </div>
      {mCon != null && mSin != null && con.length && sin.length ? (
        <p className="urb-comparacion">
          Las {con.length} escuelas con urbanización reciente cerca tienen un índice medio de <b>{num(mCon, 2)}</b>;
          las {sin.length} sin ella, <b>{num(mSin, 2)}</b>.
        </p>
      ) : null}

      <div className="tabla-desliza">
        <table className="estaciones urb-tabla">
          <thead>
            <tr><th>Escuela</th>{FACTORES.map(([k, n]) => <th key={k}>{n}</th>)}<th className="num">Índice</th></tr>
          </thead>
          <tbody>
            {filas.map((e) => (
              <tr key={e.cct}>
                <td>
                  {onElegir ? <button className="enlace" onClick={() => onElegir(e.cct)}>{e.nombre}</button> : <b>{e.nombre}</b>}
                  <br /><span className="tenue">{inicial(e.localidad || '')}, {inicial(e.municipio || '')}</span>
                </td>
                {FACTORES.map(([k, , p]) => {
                  const v = puntaje(e, k, p);
                  return (
                    <td key={k}>
                      {v == null ? <span className="tenue">sin dato</span> : (
                        <span className="urb-barra" title={num(v, 2)}>
                          <span style={{ width: Math.max(1, Math.round(v * 90)) + 'px' }} />
                          <i>{num(v, 2)}</i>
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="num">
                  <span className="riesgo-marca" style={{ background: COLOR_RIESGO[e.riesgo.nivel] || '#ddd' }} />
                  {num(e.riesgo.indice, 2)}<br /><span className="tenue">{NIVEL_RIESGO[e.riesgo.nivel] || ''}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">Puntajes y pesos del índice: hipótesis del módulo A (scripts/97_escuelas_riesgo.py).</p>
    </figure>
  );
}

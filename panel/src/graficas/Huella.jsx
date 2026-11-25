import { useEffect, useState } from 'react';
import { useAncho } from '../lib/datos.js';
import { PARAM } from '../lib/etiquetas.js';
import { horaCorta, inicial, num, porAtender } from '../lib/formato.js';
import { useDatos } from '../lib/contexto.js';
import { LADERA, UNIDAD_LADERA } from '../lib/etiquetas.js';

// Escala divergente en 7 pasos sobre el z robusto que manda el motor (veredicto.parametros[].z_robusto).
// Los cortes son los del motor (motor/reglas.py): 3.5 es Z_ESCALON y 6 es Z_FUERTE. Los dos brazos
// (azul abajo, guinda arriba) pasan el validador como escalas ordinales; el centro es gris neutro.
const PASOS = [
  [-Infinity, -6, '#224497', 'Mucho más bajo'],
  [-6, -3.5, '#5F7FD0', 'Más bajo'],
  [-3.5, -2, '#9DB2E6', 'Algo más bajo'],
  [-2, 2, '#F3F3F3', 'Normal'],
  [2, 3.5, '#CE92A6', 'Algo más alto'],
  [3.5, 6, '#A84565', 'Más alto'],
  [6, Infinity, '#781838', 'Mucho más alto'],
];
const paso = (z) => PASOS.find(([a, b]) => z >= a && z < b) || PASOS[3];
const colorZ = (z) => paso(z)[2];
const PARAMS_AGUA = ['OD', 'PH', 'COND', 'TEMP', 'TURB'];
// Ladera: 0, 1, 2 o 3 umbrales alcanzados se pintan como habitual, algo, más y mucho más alto.
const Z_LADERA = [0, 2.5, 4.5, 7];
// 48 lecturas = 12 h al muestreo normal de 15 min.
const MAX_LECTURAS = 48;

// Huella de las ultimas horas de UNA estacion: cada fila es una sonda y cada columna una lectura.
// La estacion es la elegida en el panel (mapa, tabla o filtro); si no hay, la primera con alerta por
// atender, y si no, la primera. Un selector propio permite cambiarla sin filtrar las alertas.
export default function Huella({ estaciones, veredictos, alertas, elegida }) {
  const [ref, W] = useAncho(300);
  const cods = Object.keys(estaciones).sort();
  const conAlerta = (alertas || []).find((a) => porAtender(a) && estaciones[a.c_estacion]);
  const inicialEst = elegida && elegida !== 'todas' ? elegida : (conAlerta ? conAlerta.c_estacion : cods[0]);
  const [c, setC] = useState(inicialEst);
  useEffect(() => { if (elegida && elegida !== 'todas') setC(elegida); }, [elegida]);
  const { nivelLadera } = useDatos();
  const est = estaciones[c] || {};
  const ladera = (est.parametros || []).includes('LLUVIA');
  const PARAMS = ladera ? LADERA : PARAMS_AGUA;
  // Solo las últimas MAX_LECTURAS: con más, los cuadros se vuelven rayas y las horas se enciman.
  const todas = [...(veredictos[c] || [])].sort((a, b) => (a.fecha_hora < b.fecha_hora ? -1 : 1));
  const vs = todas.slice(-MAX_LECTURAS);
  // En ladera la lluvia se lee acumulada en 24 h hasta cada lectura, que es lo que compara el motor.
  const acum = {};
  if (ladera) {
    vs.forEach((v, i) => {
      const t = new Date(v.fecha_hora).getTime();
      acum[v.fecha_hora] = vs.slice(0, i + 1).reduce((s, w) => {
        const it = (w.parametros || []).find((x) => x.c_parametro === 'LLUVIA');
        return s + (new Date(w.fecha_hora).getTime() > t - 86400000 && it && it.valor > -100 ? it.valor || 0 : 0);
      }, 0);
    });
  }
  const tiempos = [...new Set(vs.map((v) => v.fecha_hora))].sort();
  const selector = (
    <div className="filtros huella-filtro">
      <label>Estación
        <select value={c} onChange={(e) => setC(e.target.value)}>
          {cods.map((k) => <option key={k} value={k}>{k.replace('EST-', '')} · {inicial(estaciones[k].localidad || estaciones[k].cuerpo_agua || '')}, {inicial(estaciones[k].municipio || '')}</option>)}
        </select>
      </label>
    </div>
  );
  if (!tiempos.length) return <div ref={ref}>{selector}<p className="vacio">Sin lecturas recientes de esta estación.</p></div>;
  // Un mecanismo de agua nuevo no tiene línea base: el motor no publica su desviación por lectura y la huella
  // saldría en blanco. Se dice en lugar de inventarla (el análisis es del backend).
  const sinZ = !ladera && vs.every((v) => (v.parametros || []).every((x) => x.z_robusto == null));
  const col = Object.fromEntries(tiempos.map((t, i) => [t, i]));
  const ancho = W >= 520;
  const Iz = ancho ? 170 : 46, D = 4, A = 4, filaH = ancho ? 34 : 26, sep = 8;
  const Ab = 42;   // abajo: marcas de hora y titulo del eje
  const H = A + PARAMS.length * (filaH + sep) + Ab;
  const baseY = A + PARAMS.length * (filaH + sep) - sep;
  const cw = (W - Iz - D) / tiempos.length;
  const ref0 = tiempos[0];
  // Cuanto dura cada cuadro: la mediana del intervalo entre lecturas (el firmware muestrea cada 15 min
  // y acelera si algo cambia, asi que se calcula, no se supone).
  const ms = tiempos.map((t) => new Date(t).getTime());
  const gaps = ms.slice(1).map((t, i) => t - ms[i]).sort((x, y) => x - y);
  const minCuadro = gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] / 60000) : null;
  const durCuadro = minCuadro == null ? '' : minCuadro >= 60 && minCuadro % 60 === 0 ? (minCuadro / 60) + ' h' : minCuadro + ' min';
  // Marcas en horas en punto, cada 1, 2, 3, 4 o 6 h segun quepan.
  const horasTot = (ms[ms.length - 1] - ms[0]) / 3600000;
  const maxEtq = ancho ? 7 : 4;
  const paso_h = [1, 2, 3, 4, 6, 12].find((h) => horasTot / h <= maxEtq) || 24;
  const marcas = [];
  const h0 = new Date(ms[0]); h0.setMinutes(0, 0, 0);
  for (let t = h0.getTime(); t <= ms[ms.length - 1]; t += 3600000) {
    const d = new Date(t);
    if (t < ms[0] || d.getHours() % paso_h) continue;
    const i = ms.findIndex((m) => m >= t);
    // Las columnas son lecturas, no tiempo: si el firmware aceleró el muestreo o hubo un hueco, dos horas pueden caer
    // juntas. Se salta la marca que quede a menos de 140 px de la anterior (cabe un rótulo con fecha).
    if (i >= 0 && (!marcas.length || (i - marcas[marcas.length - 1].i) * cw >= 140)) marcas.push({ i, iso: d.toISOString() });
  }
  return (
    <div ref={ref} className="lienzo">
      {selector}
      <p className="huella-explica">
        Cada cuadro es una lectura de esa sonda{durCuadro ? ' (una cada ' + durCuadro + ')' : ''}. {ladera
          ? 'Es una ladera: su color dice cuántos umbrales del motor alcanzó la lectura (la lluvia, acumulada en 24 h).'
          : 'Su color dice qué tan lejos quedó del valor normal de este punto del río según su historia.'} Pasa el cursor sobre un cuadro para ver la hora y el valor.
      </p>
      {sinZ && (
        <p className="aviso aviso-advertencia">
          Esta estación aún no tiene línea base histórica: el motor la compara con sus lecturas recientes pero no publica
          cuánto se aleja cada lectura, así que los cuadros salen en blanco. Pasa el cursor para ver los valores.
        </p>
      )}
      <ul className="huella-leyenda">
        {PASOS.map(([, , co, t]) => <li key={t}><i style={{ background: co }} />{t}</li>)}
        <li><i style={{ background: '#fff', border: '1px solid #DDDDDD' }} />Sin dato</li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={'Qué tan lejos de lo habitual estuvo cada sonda de la estación ' + c + ' en cada lectura reciente'}>
        {PARAMS.map((p, j) => {
          const y0 = A + j * (filaH + sep);
          return (
            <g key={p}>
              <text x={Iz - 8} y={y0 + filaH / 2 + 4} textAnchor="end" className="etq">{ancho ? PARAM[p] : p}</text>
              {vs.map((v) => {
                const i = col[v.fecha_hora];
                const it = (v.parametros || []).find((x) => x.c_parametro === p);
                const valor = ladera ? (p === 'LLUVIA' ? acum[v.fecha_hora] : (it && it.valor > -100 ? it.valor : null)) : (it && it.valor);
                const nl = ladera ? nivelLadera(c, p, valor) : null;
                const z = ladera ? (nl == null ? null : Z_LADERA[Math.min(3, nl)]) : it && it.z_robusto;
                const tip = `${PARAM[p]}, ${horaCorta(v.fecha_hora, ref0)}: ` +
                  (valor != null ? num(valor, 1) + (ladera ? ' ' + UNIDAD_LADERA[p] : '') : 'sin dato') +
                  (ladera ? (nl != null ? ' · ' + (nl ? nl + (nl === 1 ? ' umbral alcanzado' : ' umbrales alcanzados') : 'bajo sus umbrales') : '')
                    : (z != null ? ` · ${paso(z)[3].toLowerCase()} de lo normal` : ''));
                return (
                  <rect key={v.fecha_hora} x={Iz + i * cw} y={y0} width={Math.max(1, cw - 1)}
                    height={filaH} fill={z == null ? '#FFFFFF' : colorZ(z)}
                    stroke={z == null ? '#DDDDDD' : 'none'} strokeWidth="0.5" data-tip={tip} />
                );
              })}
            </g>
          );
        })}
        {marcas.map(({ i, iso }) => {
          const x = Iz + i * cw;
          return (
            <g key={iso}>
              <line x1={x} x2={x} y1={A} y2={baseY + 5} stroke="#AAAAAA" strokeWidth="0.75" strokeDasharray="2 3" />
              <text x={x} y={baseY + 17} textAnchor="middle">{horaCorta(iso, ref0)}</text>
            </g>
          );
        })}
        <text x={Iz + (W - Iz - D) / 2} y={H - 4} textAnchor="middle" className="etq">
          Hora de la lectura{durCuadro ? ' · cada cuadro = ' + durCuadro : ''}
        </text>
      </svg>
      <p className="pie-graf">{tiempos.length} lecturas recientes de la estación.</p>
    </div>
  );
}

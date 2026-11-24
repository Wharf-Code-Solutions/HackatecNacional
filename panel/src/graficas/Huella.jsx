import { useEffect, useState } from 'react';
import { useAncho } from '../lib/datos.js';
import { PARAM } from '../lib/etiquetas.js';
import { horaCorta, inicial, num, porAtender } from '../lib/formato.js';

// Escala divergente en 7 pasos sobre el z robusto que manda el motor (veredicto.parametros[].z_robusto).
// Los cortes son los del motor (motor/reglas.py): 3.5 es Z_ESCALON y 6 es Z_FUERTE. Los dos brazos
// (azul abajo, guinda arriba) pasan el validador como escalas ordinales; el centro es gris neutro.
const PASOS = [
  [-Infinity, -6, '#224497', 'muy por debajo (z ≤ −6)'],
  [-6, -3.5, '#5F7FD0', 'por debajo (−6 a −3.5)'],
  [-3.5, -2, '#9DB2E6', 'algo por debajo'],
  [-2, 2, '#F3F3F3', 'habitual (|z| < 2)'],
  [2, 3.5, '#CE92A6', 'algo por encima'],
  [3.5, 6, '#A84565', 'por encima (3.5 a 6)'],
  [6, Infinity, '#781838', 'muy por encima (z ≥ 6)'],
];
const colorZ = (z) => (PASOS.find(([a, b]) => z >= a && z < b) || PASOS[3])[2];
const PARAMS = ['OD', 'PH', 'COND', 'TEMP', 'TURB'];

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
  const vs = veredictos[c] || [];
  const tiempos = [...new Set(vs.map((v) => v.fecha_hora))].sort();
  const selector = (
    <div className="filtros huella-filtro">
      <label>Estación
        <select value={c} onChange={(e) => setC(e.target.value)}>
          {cods.map((k) => <option key={k} value={k}>{k.replace('EST-', '')} · {inicial(estaciones[k].cuerpo_agua)}, {inicial(estaciones[k].municipio)}</option>)}
        </select>
      </label>
    </div>
  );
  if (!tiempos.length) return <div ref={ref}>{selector}<p className="vacio">Sin lecturas recientes de esta estación.</p></div>;
  const col = Object.fromEntries(tiempos.map((t, i) => [t, i]));
  const ancho = W >= 520;
  const Iz = ancho ? 130 : 46, D = 4, A = 4, filaH = ancho ? 34 : 26, sep = 8;
  const H = A + PARAMS.length * (filaH + sep) + 18;
  const cw = (W - Iz - D) / tiempos.length;
  const ref0 = tiempos[0];
  return (
    <div ref={ref} className="lienzo">
      {selector}
      <div className="escala-z" aria-hidden="true">
        {PASOS.map(([, , co, t]) => <span key={t} style={{ background: co }} title={t} />)}
      </div>
      <div className="escala-z-txt"><span>por debajo de lo habitual</span><span>habitual</span><span>por encima</span></div>
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
                const z = it && it.z_robusto;
                const tip = `${PARAM[p]} · ${horaCorta(v.fecha_hora, ref0)} · ` +
                  (it && it.valor != null ? 'valor ' + num(it.valor) : 'sin dato') +
                  (z != null ? ` · z ${num(z, 1)}` : '');
                return (
                  <rect key={v.fecha_hora} x={Iz + i * cw} y={y0} width={Math.max(1, cw - 1)}
                    height={filaH} fill={z == null ? '#FFFFFF' : colorZ(z)}
                    stroke={z == null ? '#DDDDDD' : 'none'} strokeWidth="0.5" data-tip={tip} />
                );
              })}
            </g>
          );
        })}
        <text x={Iz} y={H - 4}>{horaCorta(tiempos[0], ref0)}</text>
        <text x={W - D} y={H - 4} textAnchor="end">{horaCorta(tiempos[tiempos.length - 1], ref0)}</text>
      </svg>
      <p className="pie-graf">
        Cada fila es una sonda y cada columna una de las {tiempos.length} lecturas recientes. El color es la desviación
        respecto de la historia del propio sitio que calcula el motor de reglas; en blanco, sin dato.
      </p>
    </div>
  );
}

import { useAncho } from '../lib/datos.js';
import { PARAM, PARAM_CORTO } from '../lib/etiquetas.js';
import { horaCorta, inicial, num } from '../lib/formato.js';

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

// Huella de las ultimas horas: cada fila es una sonda de una estacion, cada columna una lectura.
export default function Huella({ estaciones, veredictos }) {
  const [ref, W] = useAncho(300);
  const cods = Object.keys(estaciones).sort();
  const tiempos = [...new Set(cods.flatMap((c) => (veredictos[c] || []).map((v) => v.fecha_hora)))].sort();
  if (!tiempos.length) return <div ref={ref}><p className="vacio">Sin lecturas recientes.</p></div>;
  const col = Object.fromEntries(tiempos.map((t, i) => [t, i]));
  // Dos columnas de rotulos: la estacion (arriba de su bloque) y la sonda (junto a su fila).
  const ancho = W >= 520;
  const Iz = ancho ? 84 : 44, D = 4, A = 18, filaH = ancho ? 13 : 11, sep = 20;
  const bloqueH = PARAMS.length * filaH;
  const H = A + cods.length * (bloqueH + sep) + 22;
  const cw = (W - Iz - D) / tiempos.length;
  const ref0 = tiempos[0];
  return (
    <div ref={ref} className="lienzo">
      <div className="escala-z" aria-hidden="true">
        {PASOS.map(([, , c, t]) => <span key={t} style={{ background: c }} title={t} />)}
      </div>
      <div className="escala-z-txt"><span>por debajo de lo habitual</span><span>habitual</span><span>por encima</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label="Qué tan lejos de lo habitual estuvo cada sonda en cada lectura reciente">
        {cods.map((c, k) => {
          const y0 = A + k * (bloqueH + sep);
          const vs = veredictos[c] || [];
          return (
            <g key={c}>
              <text x={Iz} y={y0 - 5} className="etq">
                {c.replace('EST-', '')} · {inicial(estaciones[c].cuerpo_agua)}{ancho ? ', ' + inicial(estaciones[c].municipio) : ''}
              </text>
              {PARAMS.map((p, j) => (
                <text key={p} x={Iz - 6} y={y0 + j * filaH + filaH - 2.5} textAnchor="end" className="etq-chica">
                  {ancho ? PARAM_CORTO[p] : p}
                </text>
              ))}
              {vs.map((v) => {
                const i = col[v.fecha_hora];
                return PARAMS.map((p, j) => {
                  const it = (v.parametros || []).find((x) => x.c_parametro === p);
                  const z = it && it.z_robusto;
                  const tip = `${c} · ${PARAM[p]} · ${horaCorta(v.fecha_hora, ref0)} · ` +
                    (it && it.valor != null ? 'valor ' + num(it.valor) : 'sin dato') +
                    (z != null ? ` · z ${num(z, 1)}` : '');
                  return (
                    <rect key={v.fecha_hora + p} x={Iz + i * cw} y={y0 + j * filaH} width={Math.max(1, cw - 0.5)}
                      height={filaH - 1} fill={z == null ? '#FFFFFF' : colorZ(z)}
                      stroke={z == null ? '#DDDDDD' : 'none'} strokeWidth="0.5" data-tip={tip} />
                  );
                });
              })}
            </g>
          );
        })}
        <text x={Iz} y={H - 6}>{horaCorta(tiempos[0], ref0)}</text>
        <text x={W - D} y={H - 6} textAnchor="end">{horaCorta(tiempos[tiempos.length - 1], ref0)}</text>
      </svg>
      <p className="pie-graf">
        Cada fila es una sonda y cada columna una lectura ({tiempos.length} por estación). El color es la desviación
        respecto de la historia del propio sitio que calcula el motor de reglas; en blanco, sin dato.
      </p>
    </div>
  );
}

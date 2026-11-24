import { useAncho } from '../lib/datos.js';
import { ESTADOS, COLOR_ESTADO, TINTA_ESTADO, txt } from '../lib/etiquetas.js';
import { porAtender } from '../lib/formato.js';
import { Leyenda, Mensaje } from './marcas.jsx';

// Barra segmentada alta: todas las alertas, partidas por estado de atención.
export default function BarraAtencion({ alertas }) {
  const [ref, W] = useAncho(260);
  const total = alertas.length;
  if (!total) return <div ref={ref}><Mensaje>Sin alertas todavía.</Mensaje></div>;
  const c = Object.fromEntries(ESTADOS.map((k) => [k, 0]));
  alertas.forEach((a) => { c[a.estado] = (c[a.estado] || 0) + 1; });
  const partes = ESTADOS.filter((k) => c[k]);
  const H = 28;
  let x = 0;
  const sin = alertas.filter((a) => porAtender(a) && !a.responsable).length;
  return (
    <div ref={ref} className="lienzo">
      <Leyenda items={ESTADOS.map((k) => [`${txt(k)} (${c[k]})`, COLOR_ESTADO[k]])} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={partes.map((k) => `${txt(k)} ${c[k]}`).join(', ')}>
        {partes.map((k) => {
          const w = (W - 2 * (partes.length - 1)) * c[k] / total;
          const pct = Math.round(100 * c[k] / total) + ' %';
          const x0 = x;
          x += w + 2;
          return (
            <g key={k}>
              <rect x={x0} y="0" width={w} height={H} rx="4" fill={COLOR_ESTADO[k]}
                data-tip={`${txt(k)} · ${c[k]} de ${total} (${pct})`} />
              {w > 44 && <text x={x0 + 8} y="18" style={{ fill: TINTA_ESTADO[k], fontWeight: 600 }} pointerEvents="none">{pct}</text>}
            </g>
          );
        })}
      </svg>
      <p className="pie-graf">{total} alertas. {sin} de las que están por atender no tienen responsable.</p>
    </div>
  );
}

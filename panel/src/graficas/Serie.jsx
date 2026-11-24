import { useAncho } from '../lib/datos.js';
import { PARAM } from '../lib/etiquetas.js';
import { hora, num } from '../lib/formato.js';
import { Leyenda, Mensaje } from './marcas.jsx';

// Serie reciente de un parámetro contra la banda histórica del sitio, con el momento de la alerta.
export default function Serie({ alerta, parametro, banda, veredictos }) {
  const cp = parametro || alerta.c_parametro;
  const [ref, W] = useAncho(280);
  const serie = (veredictos || []).map((v) => {
    const p = (v.parametros || []).find((x) => x.c_parametro === cp);
    return p && p.valor != null && p.valor > -100 ? { t: new Date(v.fecha_hora).getTime(), v: p.valor } : null;
  }).filter(Boolean).sort((p, q) => p.t - q.t);   // llegan en orden de recepción
  if (serie.length < 2) {
    return <div ref={ref}><Mensaje>Sin lecturas recientes de este parámetro en el backend para graficar.</Mensaje></div>;
  }
  const H = W < 500 ? 180 : 210, I = 44, D = 8, A = 10, B = 26;
  const t0 = serie[0].t, t1 = serie[serie.length - 1].t;
  const vals = serie.map((s) => s.v).concat(banda ? [banda.p10, banda.p90] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const x = (t) => I + (W - I - D) * (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0));
  const y = (v) => A + (H - A - B) * (1 - (v - lo) / (hi - lo));
  const ta = new Date(alerta.fecha_hora).getTime();
  const dentro = ta >= t0 && ta <= t1;
  const nombre = PARAM[cp] || cp;
  return (
    <div ref={ref} className="lienzo">
      <Leyenda items={[
        ['Lecturas de la estación', '#224497', { height: 2, verticalAlign: 3 }],
        ...(banda ? [['Banda habitual (p10 a p90)', '#EDF2FE', { border: '1px solid #c9d6f5' }]] : []),
        ...(dentro ? [['Momento de la alerta', 'transparent', { borderLeft: '2px dashed #9B0F15', width: 2, height: 12 }]] : []),
      ]} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Lecturas recientes contra la banda habitual del sitio">
        {[0, 1, 2, 3].map((k) => {
          const gv = lo + (hi - lo) * k / 3;
          return (
            <g key={k}>
              <line x1={I} x2={W - D} y1={y(gv)} y2={y(gv)} stroke="#F3F3F3" />
              <text x={I - 8} y={y(gv) + 4} textAnchor="end">{num(gv, gv > 100 ? 0 : 1)}</text>
            </g>
          );
        })}
        {banda && <rect x={I} y={y(banda.p90)} width={W - I - D} height={Math.max(1, y(banda.p10) - y(banda.p90))} fill="#EDF2FE" />}
        <line x1={I} x2={W - D} y1={H - B} y2={H - B} stroke="#AAAAAA" />
        {dentro && <line x1={x(ta)} x2={x(ta)} y1={A} y2={H - B} stroke="#9B0F15" strokeWidth="1.5" strokeDasharray="4 3" />}
        <polyline fill="none" stroke="#224497" strokeWidth="2" strokeLinejoin="round"
          points={serie.map((p) => x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ')} />
        <text x={I} y={H - 6}>{hora(new Date(t0).toISOString())}</text>
        <text x={W - D} y={H - 6} textAnchor="end">{hora(new Date(t1).toISOString())}</text>
      </svg>
      <p className="pie-graf">
        Últimas {serie.length} lecturas de {nombre.toLowerCase()}
        {banda ? ` (${banda.unidad || ''}). Banda: n = ${banda.n}, ${banda.primera_fecha} a ${banda.ultima_fecha}` : ''}
        {dentro ? '.' : '. La alerta quedó fuera de esta ventana.'}
      </p>
    </div>
  );
}

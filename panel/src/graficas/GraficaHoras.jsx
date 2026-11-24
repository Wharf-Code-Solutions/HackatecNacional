import { useAncho } from '../lib/datos.js';
import { NIVELES, COLOR_NIVEL, txt } from '../lib/etiquetas.js';
import { Barra, Leyenda, Mensaje, marcasEje } from './marcas.jsx';

const dosDig = (h) => (h < 10 ? '0' : '') + h;

// Columnas apiladas por hora del día, por nivel. La hora es la local de la estación,
// tal como viene en fecha_hora.
export default function GraficaHoras({ alertas }) {
  const [ref, W] = useAncho(300);
  if (!alertas.length) return <div ref={ref}><Mensaje>Sin alertas todavía.</Mensaje></div>;
  const dia = alertas.reduce((m, a) => (a.fecha_hora.slice(0, 10) > m ? a.fecha_hora.slice(0, 10) : m), '');
  const bins = Array.from({ length: 24 }, () => ({ Critica: 0, Preventiva: 0, Informativa: 0, total: 0 }));
  alertas.forEach((a) => {
    if (a.fecha_hora.slice(0, 10) !== dia) return;
    const b = bins[parseInt(a.fecha_hora.slice(11, 13), 10)];
    b[a.nivel]++; b.total++;
  });
  const H = 210, I = 30, D = 6, A = 12, B = 24;
  const e = marcasEje(Math.max(...bins.map((b) => b.total)));
  const bw = (W - I - D) / 24, cw = Math.min(24, bw - 2);
  const y = (v) => A + (H - A - B) * (1 - v / e.tope);
  return (
    <div ref={ref} className="lienzo">
      <Leyenda items={NIVELES.map((n) => [txt(n), COLOR_NIVEL[n]])} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={'Alertas por hora del día ' + dia}>
        {e.marcas.map((v) => (
          <g key={v}>
            <line x1={I} x2={W - D} y1={y(v)} y2={y(v)} stroke="#EDEDED" />
            <text x={I - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {bins.map((b, h) => {
          const x = I + h * bw + (bw - cw) / 2;
          const vis = NIVELES.filter((n) => b[n]);
          const tip = `${dosDig(h)}:00 a ${dosDig(h + 1)}:00 · ${b.total} alertas` + (b.total
            ? ' (' + vis.map((n) => b[n] + ' ' + txt(n).toLowerCase() + (b[n] > 1 ? 's' : '')).join(', ') + ')' : '');
          let base = 0;
          return (
            <g key={h}>
              {vis.map((n, j) => {
                const y0 = y(base), y1 = y(base + b[n]);
                const alto = y0 - y1 - (base > 0 ? 2 : 0);   // 2 px de hueco entre segmentos
                base += b[n];
                return <Barra key={n} x={x} y={y1} w={cw} h={alto} color={COLOR_NIVEL[n]} tip={tip}
                  extremo="arriba" plano={j < vis.length - 1} />;
              })}
              <rect x={I + h * bw} y={A} width={bw} height={H - A - B} fill="transparent" data-tip={tip} />
              {h % (W < 520 ? 6 : 3) === 0 && <text x={x + cw / 2} y={H - 6} textAnchor="middle">{dosDig(h)}h</text>}
            </g>
          );
        })}
        <line x1={I} x2={W - D} y1={H - B} y2={H - B} stroke="#AAAAAA" />
      </svg>
      <p className="pie-graf">Día {dia}, hora local de la estación. Todas las alertas, sin importar su estado.</p>
    </div>
  );
}

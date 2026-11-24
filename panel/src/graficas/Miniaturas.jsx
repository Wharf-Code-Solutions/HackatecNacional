import { useAncho } from '../lib/datos.js';
import { PARAM } from '../lib/etiquetas.js';
import { num } from '../lib/formato.js';
import { Mensaje } from './marcas.jsx';

// Las sondas de la estación, cada una contra su banda. La de la alerta va marcada.
export default function Miniaturas({ alerta, estacion, lineaBase, veredictos }) {
  const [ref, ancho] = useAncho(150);
  const vs = [...(veredictos || [])].sort((p, q) => (p.fecha_hora < q.fecha_hora ? -1 : 1));
  if (vs.length < 2) return <div ref={ref}><Mensaje>Sin lecturas recientes de la estación.</Mensaje></div>;
  const columnas = ancho > 640 ? 3 : ancho > 420 ? 2 : 1;
  const W = Math.max(150, Math.round((ancho - 16 * (columnas - 1)) / columnas) - 26), H = 64;
  return (
    <div ref={ref} className="minis">
      {(estacion.parametros || []).map((p) => {
        const serie = vs.map((v) => {
          const it = (v.parametros || []).find((x) => x.c_parametro === p);
          return it && it.valor != null && it.valor > -100 ? it.valor : null;   // -999: sonda rota
        });
        const ok = serie.filter((v) => v != null);
        const b = (lineaBase[estacion.c_sitio] || {})[p];
        if (!ok.length) {
          return <div key={p} className="mini"><p><b>{PARAM[p] || p}</b></p><p className="tenue">sin dato</p></div>;
        }
        const vals = ok.concat(b ? [b.p10, b.p90] : []);
        let lo = Math.min(...vals), hi = Math.max(...vals);
        const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
        const x = (i) => 2 + (W - 8) * i / (serie.length - 1);
        const y = (v) => 4 + (H - 8) * (1 - (v - lo) / (hi - lo));
        const pts = serie.map((v, i) => (v != null ? x(i).toFixed(1) + ',' + y(v).toFixed(1) : null)).filter(Boolean);
        const ultimo = ok[ok.length - 1], li = serie.lastIndexOf(ultimo);
        const u = b && b.unidad ? ' ' + b.unidad : '';
        const fuera = b ? (ultimo > b.p90 ? 'sobre lo habitual' : ultimo < b.p10 ? 'bajo lo habitual' : 'dentro de lo habitual') : 'sin línea base';
        const tip = `${PARAM[p] || p}: última ${num(ultimo)}${u}, ${fuera}` + (b ? ` (banda ${num(b.p10)} a ${num(b.p90)}, n = ${b.n})` : '');
        return (
          <div key={p} className={'mini' + (p === alerta.c_parametro ? ' actual' : '')} data-tip={tip}>
            <p><b>{PARAM[p] || p}</b> <span className="tenue">{num(ultimo)}{u}</span></p>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
              {b && <rect x="0" y={y(b.p90)} width={W} height={Math.max(1, y(b.p10) - y(b.p90))} fill="#EDF2FE" />}
              <polyline fill="none" stroke="#224497" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')} />
              <circle cx={x(li)} cy={y(ultimo)} r="4" fill="#224497" stroke="#fff" strokeWidth="2" />
            </svg>
            <p className="nota">{fuera}</p>
          </div>
        );
      })}
    </div>
  );
}

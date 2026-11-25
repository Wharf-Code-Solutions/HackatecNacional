import { useAncho } from '../lib/datos.js';
import { useDatos } from '../lib/contexto.js';
import { LADERA, PARAM, UNIDAD_LADERA } from '../lib/etiquetas.js';
import { num } from '../lib/formato.js';
import { Mensaje } from './marcas.jsx';
import { serieDe } from './Serie.jsx';

// Las sondas de la estación, cada una contra su banda. La de la alerta va marcada. Cada miniatura es la misma serie
// que la gráfica grande (serieDe: eje de tiempo real, lluvia acumulada, inclinación absoluta) con la misma banda
// (bandaDe), así al darle clic la grande muestra lo mismo, más grande.
export default function Miniaturas({ alerta, estacion, veredictos, elegido, onElegir }) {
  const marcado = elegido || alerta.c_parametro;
  const { bandaDe } = useDatos();
  const [ref, ancho] = useAncho(150);
  if ((veredictos || []).length < 2) return <div ref={ref}><Mensaje>Sin lecturas recientes de la estación.</Mensaje></div>;
  const columnas = ancho > 640 ? 3 : ancho > 420 ? 2 : 1;
  const W = Math.max(150, Math.round((ancho - 16 * (columnas - 1)) / columnas) - 26), H = 64;
  return (
    <div ref={ref} className="minis">
      {(estacion.parametros || []).map((p) => {
        const ventana = p === alerta.c_parametro && alerta.criterio_aplicado === 'UMBRAL_LLUVIA_72H' ? 72 : 24;
        const serie = serieDe(veredictos, p, ventana);
        if (!serie.length) {
          return <div key={p} className="mini"><p><b>{PARAM[p] || p}</b></p><p className="tenue">sin dato</p></div>;
        }
        const ladera = LADERA.includes(p);
        const b = ladera ? null : bandaDe(alerta.c_estacion, p, alerta.c_sitio);
        const vals = serie.map((s) => s.v).concat(b ? [b.p10, b.p90] : []);
        let lo = Math.min(...vals), hi = Math.max(...vals);
        const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
        if (ladera) lo = Math.max(0, lo);
        const t0 = serie[0].t, t1 = serie[serie.length - 1].t;
        const x = (t) => 2 + (W - 8) * (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0));
        const y = (v) => 4 + (H - 8) * (1 - (v - lo) / (hi - lo));
        const pts = serie.map((s) => x(s.t).toFixed(1) + ',' + y(s.v).toFixed(1));
        const ultimo = serie[serie.length - 1];
        const u = b && b.unidad ? ' ' + b.unidad : ladera ? ' ' + UNIDAD_LADERA[p] : '';
        const fuera = b ? (ultimo.v > b.p90 ? 'sobre lo habitual' : ultimo.v < b.p10 ? 'bajo lo habitual' : 'dentro de lo habitual') : ladera ? 'se compara contra un umbral' : 'sin línea base';
        const tip = `${PARAM[p] || p}: última ${num(ultimo.v)}${u}, ${fuera}` + (b ? ` (banda ${num(b.p10)} a ${num(b.p90)}, n = ${b.n})` : '');
        return (
          <div key={p} className={'mini' + (p === marcado ? ' actual' : '') + (onElegir ? ' elegible' : '')} data-tip={tip}
            role={onElegir ? 'button' : undefined} tabIndex={onElegir ? 0 : undefined} aria-pressed={onElegir ? p === marcado : undefined}
            onClick={onElegir ? () => onElegir(p) : undefined}
            onKeyDown={onElegir ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onElegir(p); } } : undefined}>
            <p><b>{PARAM[p] || p}</b> <span className="tenue">{num(ultimo.v)}{u}</span></p>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
              {b && <rect x="0" y={y(b.p90)} width={W} height={Math.max(1, y(b.p10) - y(b.p90))} fill="#EDF2FE" />}
              <polyline fill="none" stroke="#224497" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')} />
              <circle cx={x(ultimo.t)} cy={y(ultimo.v)} r="4" fill="#224497" stroke="#fff" strokeWidth="2" />
            </svg>
            <p className="nota">{fuera}</p>
          </div>
        );
      })}
    </div>
  );
}

import { useAncho } from '../lib/datos.js';
import { Barra, Leyenda, Mensaje } from './marcas.jsx';

// Barras horizontales, apiladas si hay más de una clave.
// filas: [{ nombre, partes: { clave: n }, total }]
export default function BarrasH({ filas, claves, colores, nombreClave, plural, nota }) {
  const [ref, W] = useAncho(260);
  if (!filas.length) return <div ref={ref}><Mensaje>Sin datos.</Mensaje></div>;
  const fila = 30, Iz = Math.min(170, Math.round(W * 0.38)), D = 34, H = filas.length * fila + 8;
  const max = Math.max(...filas.map((f) => f.total)) || 1;
  const x = (v) => (W - Iz - D) * v / max;
  return (
    <div ref={ref} className="lienzo">
      {claves.length > 1 && <Leyenda items={claves.map((k) => [nombreClave(k), colores[k]])} />}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img">
        {filas.map((f, i) => {
          const y = 4 + i * fila, h = Math.min(18, fila - 10), yb = y + (fila - h) / 2;
          const vis = claves.filter((k) => f.partes[k]);
          const tip = f.nombre + ' · ' + f.total + (claves.length > 1 && vis.length
            ? ' (' + vis.map((k) => f.partes[k] + ' ' + nombreClave(k).toLowerCase() + (plural && f.partes[k] > 1 ? 's' : '')).join(', ') + ')' : '');
          let base = 0;
          return (
            <g key={f.nombre}>
              <text x={Iz - 10} y={y + fila / 2 + 4} textAnchor="end" className="etq">{f.nombre}</text>
              {vis.map((k, j) => {
                const v = f.partes[k];
                const x0 = Iz + x(base) + (base > 0 ? 2 : 0), w = x(v) - (base > 0 ? 2 : 0);
                base += v;
                return <Barra key={k} x={x0} y={yb} w={w} h={h} color={colores[k]} tip={tip}
                  extremo="derecha" plano={j < vis.length - 1} />;
              })}
              <text x={Iz + x(f.total) + 6} y={y + fila / 2 + 4} className="valor">{f.total}</text>
              <rect x="0" y={y} width={W} height={fila} fill="transparent" data-tip={tip} />
            </g>
          );
        })}
        <line x1={Iz} x2={Iz} y1="0" y2={H} stroke="#AAAAAA" />
      </svg>
      {nota && <p className="pie-graf">{nota}</p>}
    </div>
  );
}

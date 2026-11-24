import { useAncho } from '../lib/datos.js';
import { hora, inicial, km, num } from '../lib/formato.js';
import { Leyenda } from './marcas.jsx';

// La confianza es ordinal (baja < media < alta): un solo azul, mas oscuro cuanto mas confianza.
// Validado como escala ordinal (un tono, luminosidad monotona, el claro se distingue del fondo).
export const COLOR_CONFIANZA = { alta: '#224497', media: '#5F7FD0', baja: '#9DB2E6' };
const ORDEN_CONFIANZA = ['alta', 'media', 'baja'];

function horas(h) {
  if (h < 1) return Math.round(h * 60) + ' min';
  return num(h, h < 10 ? 1 : 0) + ' h';
}

// Ventana de llegada de la contaminacion a cada sitio aguas abajo, en horas desde la alerta.
// destinos: los de prediccion_propagacion; inicio: fecha_hora de la alerta.
export default function Llegadas({ destinos, inicio, unidad }) {
  const [ref, W] = useAncho(300);
  const t0 = new Date(inicio).getTime();
  const filas = destinos.map((d) => ({
    d,
    h0: (new Date(d.llegada_estimada.desde).getTime() - t0) / 3600000,
    h1: (new Date(d.llegada_estimada.hasta).getTime() - t0) / 3600000,
  }));
  const max = Math.max(...filas.map((f) => f.h1), 1);
  // marcas del eje en horas redondas
  const paso = max <= 3 ? 0.5 : max <= 8 ? 1 : max <= 24 ? 3 : max <= 48 ? 6 : 12;
  const tope = Math.ceil(max / paso) * paso;
  const marcas = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(v);

  const fila = 30, Iz = Math.min(210, Math.round(W * 0.42)), D = 16, A = 8, B = 26;
  const H = A + filas.length * fila + B;
  const x = (h) => Iz + (W - Iz - D) * h / tope;
  return (
    <div ref={ref} className="lienzo">
      <Leyenda items={ORDEN_CONFIANZA.map((c) => ['Confianza ' + c, COLOR_CONFIANZA[c]])} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label="Ventanas de llegada de la contaminación a los sitios aguas abajo">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={A} y2={H - B} stroke="#EDEDED" />
            <text x={x(v)} y={H - 8} textAnchor="middle">{v === 0 ? 'alerta' : '+' + horas(v)}</text>
          </g>
        ))}
        {filas.map(({ d, h0, h1 }, i) => {
          const y = A + i * fila, h = 14, yb = y + (fila - h) / 2;
          const nombre = inicial(d.nombre || d.c_sitio_destino);
          // El rotulo cabe en el margen izquierdo: ~6.6 px por caracter a 13 px.
          const cabe = Math.max(8, Math.floor((Iz - 14) / 6.6));
          const corto = nombre.length > cabe ? nombre.slice(0, cabe - 1) + '…' : nombre;
          const valor = d.valor_estimado_min != null
            ? ` · valor esperado ${num(d.valor_estimado_min, 0)} a ${num(d.valor_estimado_max, 0)}${unidad}` : '';
          const tip = `${nombre} (${km(d.distancia_cauce_m)} por el cauce) · llega entre ${hora(d.llegada_estimada.desde)} ` +
            `y ${hora(d.llegada_estimada.hasta)} (+${horas(h0)} a +${horas(h1)})${valor} · confianza ${d.confianza || 'sin dato'}`;
          const ancho = Math.max(3, x(h1) - x(h0));
          return (
            <g key={d.c_sitio_destino}>
              <text x={Iz - 10} y={y + fila / 2 + 4} textAnchor="end" className="etq">{corto}</text>
              <rect x={x(h0)} y={yb} width={ancho} height={h} rx="4"
                fill={COLOR_CONFIANZA[d.confianza] || '#DDDDDD'} data-tip={tip} />
              <rect x="0" y={y} width={W} height={fila} fill="transparent" data-tip={tip} />
            </g>
          );
        })}
        <line x1={Iz} x2={Iz} y1={A} y2={H - B} stroke="#AAAAAA" />
      </svg>
    </div>
  );
}

// Piezas comunes de las gráficas: barras con el extremo del dato redondeado, eje y leyenda.
// Cada marca lleva data-tip para el tooltip; la información también está en tablas y listas.

export function Barra({ x, y, w, h, color, tip, extremo, plano }) {
  if (w <= 0 || h <= 0) return null;
  if (plano) return <rect x={x} y={y} width={w} height={h} fill={color} data-tip={tip} />;
  const r = Math.min(4, extremo === 'arriba' ? w / 2 : h / 2, extremo === 'arriba' ? h : w);
  const d = extremo === 'arriba'
    ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
    : `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  return <path d={d} fill={color} data-tip={tip} />;
}

export function marcasEje(max) {
  const paso = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
  const tope = Math.max(paso, Math.ceil(max / paso) * paso);
  const marcas = [];
  for (let v = 0; v <= tope; v += paso) marcas.push(v);
  return { tope, marcas };
}

export function Leyenda({ items }) {
  return (
    <div className="leyenda">
      {items.map(([nombre, color, estilo]) => (
        <span key={nombre}><i style={{ background: color, ...estilo }} />{nombre}</span>
      ))}
    </div>
  );
}

export const Mensaje = ({ children, tipo }) => <p className={'mensaje' + (tipo ? ' ' + tipo : '')}>{children}</p>;

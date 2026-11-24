import { useEffect, useRef, useState } from 'react';

// Un solo tooltip para todo lo que tenga data-tip (marcas de las gráficas, celdas, miniaturas).
export default function Tooltip() {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    const mover = (ev) => {
      const t = ev.target.closest && ev.target.closest('[data-tip]');
      if (!t) { setTip(null); return; }
      setTip({ texto: t.getAttribute('data-tip'), x: ev.clientX, y: ev.clientY });
    };
    const ocultar = () => setTip(null);
    document.addEventListener('mousemove', mover);
    document.addEventListener('scroll', ocultar, true);
    return () => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('scroll', ocultar, true);
    };
  }, []);
  if (!tip) return null;
  // Se coloca junto al cursor y se voltea si no cabe en la ventana.
  const r = ref.current ? ref.current.getBoundingClientRect() : { width: 200, height: 40 };
  let x = tip.x + 14, y = tip.y + 14;
  if (x + r.width > window.innerWidth - 8) x = tip.x - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = tip.y - r.height - 14;
  return <div ref={ref} className="tip" role="tooltip" style={{ left: x, top: y }}>{tip.texto}</div>;
}

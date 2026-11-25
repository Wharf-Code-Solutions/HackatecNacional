import { useEffect, useRef, useState } from 'react';

// Pestaña de la barra con un menú desplegable (Reportes ciudadanos → Reportes / Estadísticas). La barra
// se desliza a lo ancho en teléfono (overflow), así que el menú se coloca con position: fixed bajo el
// botón para que no lo recorte. Se cierra al elegir, con Esc o con un clic fuera.
export default function MenuSeccion({ etiqueta, activa, cuenta, opciones, actual, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const boton = useRef(null);
  const menu = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    const cerrar = () => setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [abierto]);

  const alternar = () => {
    const r = boton.current.getBoundingClientRect();
    const ancho = 200;
    setPos({ top: r.bottom, left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)) });
    setAbierto((a) => !a);
  };

  return (
    <>
      <button ref={boton} type="button" className={'menu-seccion' + (activa ? ' activa' : '')}
        aria-haspopup="menu" aria-expanded={abierto} aria-current={activa ? 'page' : undefined} onClick={alternar}>
        {etiqueta}{cuenta > 0 && <span className="cuenta"> ({cuenta})</span>}
        <svg className="flecha" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {abierto && (
        <div ref={menu} className="menu-desplegable" role="menu" style={{ top: pos.top, left: pos.left }}>
          {opciones.map(([id, nombre]) => (
            <button key={id} type="button" role="menuitemradio" aria-checked={activa && actual === id}
              className={activa && actual === id ? 'elegida' : ''}
              onClick={() => { onElegir(id); setAbierto(false); }}>
              {nombre}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

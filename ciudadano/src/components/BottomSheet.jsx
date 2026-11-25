import React, { useCallback, useEffect, useRef, useState } from 'react';

// Hoja inferior de SIGRIV: asa, título guinda, cuerpo con scroll. Se cierra con la X, tocando fuera, con Escape o
// arrastrándola hacia abajo.
export default function BottomSheet({ titulo, onClose, obligatoria = false, children }) {
  const [cerrando, setCerrando] = useState(false);
  const ref = useRef(null);

  const cerrar = useCallback(() => {
    if (obligatoria) return;
    setCerrando(true);
    setTimeout(onClose, 220);
  }, [onClose, obligatoria]);

  useEffect(() => {
    ref.current?.focus();
    const f = (e) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [cerrar]);

  // Arrastrar hacia abajo cierra la hoja, como sugiere el asa. Se arrastra desde la cabecera, o desde el cuerpo cuando
  // ya está hasta arriba (si no, el gesto es el scroll del formulario). La hoja sigue al dedo; al soltar se cierra si
  // bajó más de CIERRE_PX o se lanzó rápido hacia abajo, y si no regresa a su lugar.
  useEffect(() => {
    const hoja = ref.current;
    if (!hoja || obligatoria) return undefined;
    const CIERRE_PX = 100, RAPIDO = 0.6;   // px/ms
    let y0 = null, t0 = 0, dy = 0, arrastrando = false;
    const inicio = (e) => {
      const cuerpo = hoja.querySelector('.sheet__cuerpo');
      const enCabecera = !!e.target.closest('.sheet__cabecera');
      if (!enCabecera && cuerpo && cuerpo.scrollTop > 0) return;
      y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; arrastrando = false;
    };
    const mover = (e) => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (!arrastrando && dy <= 0) { y0 = null; return; }      // hacia arriba: es scroll, no arrastre
      if (dy > 0) {
        arrastrando = true;
        e.preventDefault();
        hoja.style.transition = 'none';
        hoja.style.transform = 'translateY(' + dy + 'px)';
      }
    };
    const fin = () => {
      if (y0 == null) return;
      const v = dy / Math.max(1, Date.now() - t0);
      y0 = null;
      if (!arrastrando) return;
      hoja.style.transition = 'transform .24s cubic-bezier(.22, .9, .3, 1)';
      if (dy > CIERRE_PX || v > RAPIDO) {
        hoja.style.transform = 'translateY(100%)';
        cerrar();
      } else {
        hoja.style.transform = '';
      }
    };
    hoja.addEventListener('touchstart', inicio, { passive: true });
    hoja.addEventListener('touchmove', mover, { passive: false });
    hoja.addEventListener('touchend', fin);
    hoja.addEventListener('touchcancel', fin);
    return () => {
      hoja.removeEventListener('touchstart', inicio);
      hoja.removeEventListener('touchmove', mover);
      hoja.removeEventListener('touchend', fin);
      hoja.removeEventListener('touchcancel', fin);
    };
  }, [cerrar, obligatoria]);

  return (
    <div className={'sheet-fondo' + (cerrando ? ' is-cerrando' : '')} onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className={'sheet' + (cerrando ? ' is-cerrando' : '')} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref}>
        <div className="sheet__cabecera">
          <span className="sheet__asa" />
          <div className="sheet__titulo">
            <h2>{titulo}</h2>
            {!obligatoria && <button type="button" className="sheet__cerrar" onClick={cerrar} aria-label="Cerrar">×</button>}
          </div>
        </div>
        <div className="sheet__cuerpo">{children}</div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';

// Hoja inferior de SIGRIV: asa, título guinda, cuerpo con scroll. Se cierra con la X, tocando fuera o con Escape.
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

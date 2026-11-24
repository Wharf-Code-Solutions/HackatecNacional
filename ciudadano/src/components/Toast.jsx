import React, { useEffect } from 'react';

// Aviso breve sobre el mapa. { tipo: 'info' | 'danger', texto }
export default function Toast({ aviso, onClose }) {
  useEffect(() => {
    if (!aviso || aviso.tipo === 'danger') return undefined;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [aviso, onClose]);
  if (!aviso) return null;
  return (
    <div className={'toast-aviso toast-aviso--' + aviso.tipo} role="status" aria-live="polite">
      <span>{aviso.texto}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso">×</button>
    </div>
  );
}

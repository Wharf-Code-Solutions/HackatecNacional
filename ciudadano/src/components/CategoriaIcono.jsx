import React from 'react';

// Iconos de trazo para los tipos de reporte. Usan currentColor: cambian solos al seleccionar la categoría.
const TRAZOS = {
  descarga_visible: <><path d="M3 6h10v4H3z" /><path d="M13 8h3a3 3 0 013 3v1" /><path d="M19 15c-1 1.5-2 2.4-2 3.5a2 2 0 004 0c0-1.1-1-2-2-3.5z" /></>,
  espuma: <><circle cx="8" cy="14" r="3.5" /><circle cx="16" cy="12" r="2.5" /><circle cx="13" cy="6" r="2" /><path d="M3 20c3-1.4 5-1.4 8 0s5 1.4 10 0" /></>,
  color_anormal: <><path d="M12 3c-3 4-6 7-6 10.5a6 6 0 0012 0C18 10 15 7 12 3z" /><path d="M12 3v18" /></>,
  mal_olor: <><path d="M4 9c2-2 4 2 6 0s4 2 6 0 3 0 4 0" /><path d="M4 14c2-2 4 2 6 0s4 2 6 0 3 0 4 0" /><path d="M4 19c2-2 4 2 6 0s4 2 6 0 3 0 4 0" /></>,
  basura_o_residuos: <><path d="M5 7h14" /><path d="M9 7V4h6v3" /><path d="M7 7l1 13h8l1-13" /><path d="M10 11v5M14 11v5" /></>,
  peces_muertos: <><path d="M3 12c3-4 7-5 11-3l4-3v12l-4-3c-4 2-8 1-11-3z" /><path d="M8 11l2 2M10 11l-2 2" /></>,
  otro: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>,
};

export default function CategoriaIcono({ tipo }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRAZOS[tipo] || TRAZOS.otro}
    </svg>
  );
}

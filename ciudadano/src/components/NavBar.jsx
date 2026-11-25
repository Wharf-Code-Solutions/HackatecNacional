import React from 'react';

// Misma barra que SIGRIV: logotipo del Gobierno de México, filete dorado y los enlaces del módulo ciudadano.
const LINKS = {
  mapa: [['rastreo', 'Rastreo de Reportes', 'Consulta el estado de tu reporte'], ['terminos', 'Términos', 'Términos y condiciones de uso']],
  rastreo: [['mapa', 'Reportar un problema', 'Ir al mapa para hacer un reporte']],
  terminos: [['mapa', 'Reportar un problema', 'Ir al mapa para hacer un reporte']],
};

export default function NavBar({ pantalla, ir }) {
  return (
    <header className="navbar-gob">
      <div className="navbar-izq">
        <img src="https://framework-gb.cdn.gob.mx/landing/img/logoheader.svg" alt="Gobierno de México" className="navbar-logo" />
        <div className="navbar-divisor" />
        <span className="navbar-titulo">CENTINELA</span>
      </div>
      <nav className="navbar-links" aria-label="Navegación principal">
        {(LINKS[pantalla] || LINKS.mapa).map(([p, texto, title]) => (
          <a key={p} href={'#/' + (p === 'mapa' ? '' : p)} title={title} onClick={(e) => { e.preventDefault(); ir(p); }}>{texto}</a>
        ))}
      </nav>
    </header>
  );
}

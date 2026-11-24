import React, { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import { SECCIONES } from '../lib/terminos.js';
import { aceptarAviso } from '../lib/almacen.js';

// Página de consulta (#/terminos)
export default function Terminos({ ir }) {
  return (
    <div className="rastreo terminos-pagina">
      <div className="rastreo__contenido">
        <div className="rastreo-intro">
          <h1>Términos y condiciones</h1>
          <p>Cómo usamos tus datos y las reglas de uso.</p>
        </div>
        {SECCIONES.map(([t, p]) => (<section key={t}><h2>{t}</h2><p>{p}</p></section>))}
        <button className="btn btn-primary" onClick={() => ir('mapa')}>Volver al mapa</button>
      </div>
    </div>
  );
}

// Puerta de la primera visita: se acepta una vez antes de reportar
export function TerminosGate({ onAceptar }) {
  const [acepto, setAcepto] = useState(false);
  return (
    <BottomSheet titulo="Términos y condiciones" onClose={() => {}} obligatoria>
      <p className="ficha-sub">Antes de reportar, lee cómo usamos tus datos y las reglas de uso.</p>
      <div className="terminos-gate__texto">
        {SECCIONES.map(([t, p]) => (<div key={t}><h3>{t}</h3><p>{p}</p></div>))}
      </div>
      <label className="terminos-gate__marca">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
        <span>He leído y acepto los términos y condiciones y el uso de mis datos para dar seguimiento a mi reporte.</span>
      </label>
      <button className="btn btn-primary w-100" disabled={!acepto} onClick={() => { aceptarAviso(); onAceptar(); }}>Continuar</button>
    </BottomSheet>
  );
}

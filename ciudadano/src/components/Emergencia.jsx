import React, { useState } from 'react';
import { guardarModoAlarma, modoAlarma } from '../lib/alarma.js';
import BottomSheet from './BottomSheet.jsx';

// Números de emergencia. La app NO avisa a nadie por su cuenta: nadie la atiende las 24 horas. Esta hoja solo marca.
// Protección Civil de Puebla: 222 246 27 50, «Teléfonos de atención 24 horas, 365 días del año» en el Programa Especial
// de Protección Civil para la Temporada de Lluvias y Ciclones Tropicales 2024 (Coordinación General de Protección Civil
// del Estado, p. 91). Su sitio web da el mismo número con horario de oficina: por eso el 911 va primero.
export const NUMEROS = [
  { tel: '911', titulo: 'Llamar al 911', detalle: 'Personas en peligro, heridos o casas afectadas', principal: true },
  { tel: '+522222462750', titulo: 'Protección Civil de Puebla', detalle: '222 246 27 50 · para reportar un riesgo' },
];

const Telefono = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z" />
  </svg>
);

export { Telefono };

export default function Emergencia({ punto, onClose, alarmaActiva = false }) {
  const [modo, setModo] = useState(modoAlarma);
  const elegir = (v) => { guardarModoAlarma(v); setModo(v); };
  return (
    <BottomSheet titulo="Emergencia" onClose={onClose}>
      <div className="emergencia">
        {NUMEROS.map((n) => (
          <a key={n.tel} href={'tel:' + n.tel} className={'emergencia__llamar' + (n.principal ? ' es-principal' : '')}>
            <Telefono />
            <span>
              <strong>{n.titulo}</strong>
              <small>{n.detalle}</small>
            </span>
          </a>
        ))}
        {punto && (
          <p className="emergencia__ubicacion">
            Ubicación del mapa, por si te la piden: <strong>{punto.lat.toFixed(5)}, {punto.lon.toFixed(5)}</strong>
          </p>
        )}
        <p className="emergencia__nota">Esta app no avisa a emergencias por su cuenta. Si hay personas en riesgo, llama.</p>
        {alarmaActiva && (
          <fieldset className="emergencia__avisos">
            <legend>Avisos de deslave con la app abierta</legend>
            <label><input type="radio" name="modo-alarma" checked={modo === 'cerca'} onChange={() => elegir('cerca')} /> Cerca de mí (5 km)</label>
            <label><input type="radio" name="modo-alarma" checked={modo === 'todas'} onChange={() => elegir('todas')} /> En toda la cuenca</label>
          </fieldset>
        )}
      </div>
    </BottomSheet>
  );
}

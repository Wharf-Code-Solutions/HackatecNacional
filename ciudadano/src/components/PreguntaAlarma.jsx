import React from 'react';
import BottomSheet from './BottomSheet.jsx';
import { guardarModoAlarma } from '../lib/alarma.js';

// Se pregunta una sola vez, después de los términos: la alarma vibra y suena, así que la activa la persona. El toque en
// la respuesta además deja al navegador sonar después. Si cierra sin elegir, queda «cerca de mí» y no se vuelve a preguntar.
export default function PreguntaAlarma({ onListo }) {
  const elegir = (v) => { guardarModoAlarma(v); onListo(); };
  return (
    <BottomSheet titulo="Avisos de deslave" onClose={() => elegir('cerca')}>
      <div className="pregunta-alarma">
        <p>¿Quieres que te avisemos si una ladera cercana empieza a moverse?</p>
        <p className="pregunta-alarma__nota">Solo mientras tengas la app abierta. Puedes cambiarlo cuando quieras en el botón rojo del teléfono.</p>
        <button type="button" className="btn btn-primary w-100" onClick={() => elegir('cerca')}>Sí, cerca de mí</button>
        <button type="button" className="btn btn-outline-secondary w-100" onClick={() => elegir('todas')}>En toda la cuenca</button>
        <button type="button" className="btn btn-link w-100" onClick={() => elegir('no')}>No, gracias</button>
      </div>
    </BottomSheet>
  );
}

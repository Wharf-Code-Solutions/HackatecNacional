import React from 'react';
import BottomSheet from './BottomSheet.jsx';
import { ESTADOS, fechaHora, nombreTipo } from '../lib/etiquetas.js';

// Reporte de otra persona: solo datos públicos (tipo, estado, fecha); nada de descripción, foto ni correo
export default function FichaReporte({ reporte, onClose }) {
  return (
    <BottomSheet titulo={nombreTipo(reporte.tipo)} onClose={onClose}>
      <ul className="ficha-lista">
        <li><small>Estado</small>{ESTADOS[reporte.estado] || reporte.estado}</li>
        <li><small>Reportado</small>{fechaHora(reporte.fecha_hora)}</li>
      </ul>
      <p className="ficha-nota">Si ves lo mismo, repórtalo desde el mapa: tu reporte se suma a este.</p>
    </BottomSheet>
  );
}

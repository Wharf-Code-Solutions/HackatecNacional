import { useState } from 'react';
import { useDatos } from '../lib/contexto.js';

// «Qué hacer»: el protocolo de respuesta de un incidente (contrato/fixtures/protocolos.json). Acciones por plazo,
// con quién las hace y de dónde salen. Las que dependen de la fuente de agua de la escuela se filtran si la fuente
// se conoce; si no, la primera acción es confirmarla y las ramas se muestran como condición («Si la escuela toma
// agua de…»), para no actuar sobre un pozo que no sabemos si existe. Marcar una acción como hecha es solo una
// ayuda en pantalla: no se guarda.
const ORDEN = ['inmediata', 'mismo_dia', 'seguimiento'];

export function protocoloPara(protocolos, { alerta, reporte }) {
  const lista = (protocolos && protocolos.protocolos) || [];
  if (reporte) return lista.find((p) => (p.aplica.reporte || []).includes(reporte.tipo)) || null;
  if (!alerta) return null;
  const porRegla = lista.find((p) => (p.aplica.regla || []).includes(alerta.regla) && (p.aplica.nivel || []).includes(alerta.nivel));
  if (porRegla) return porRegla;
  const tipo = alerta.fuente_probable ? alerta.fuente_probable.tipo : null;
  return lista.find((p) => (p.aplica.fuente_probable || []).includes(tipo))
    || lista.find((p) => (p.aplica.fuente_probable || []).includes(null)) || null;
}

export default function Protocolo({ protocolo, escuelas = [], clave }) {
  const { protocolos } = useDatos();
  const [hechas, setHechas] = useState({});
  if (!protocolo) return <p className="vacio">Sin protocolo para este tipo de incidente.</p>;
  const cond = (protocolos && protocolos.condiciones) || {};
  const fuentes = escuelas.map((e) => e.fuente_agua).filter((f) => f && f !== 'desconocida');
  const sinFuente = escuelas.some((e) => !e.fuente_agua || e.fuente_agua === 'desconocida');
  const usaAgua = protocolo.acciones.some((a) => a.si);
  // ¿Aplica la acción a alguna escuela? Si alguna no tiene fuente conocida, se muestra como condición.
  // Sin escuelas afectadas, las acciones sobre el agua de una escuela no aplican.
  const aplica = (a) => !a.si || (escuelas.length > 0 && (sinFuente || fuentes.some((f) => ((cond[a.si] || {}).fuentes || []).includes(f))));
  const acciones = protocolo.acciones.filter(aplica);
  if (usaAgua && sinFuente && escuelas.length && protocolos.confirmar_fuente) acciones.unshift({ ...protocolos.confirmar_fuente, confirmar: true });
  const plazo = (p) => (protocolos.plazos || {})[p] || p;
  const k = (i) => clave + ':' + i;

  return (
    <div className="protocolo">
      <p className="protocolo-titulo">{protocolo.titulo}</p>
      <ol className="protocolo-acciones">
        {ORDEN.flatMap((p) => acciones.map((a, i) => [a, i]).filter(([a]) => a.plazo === p)).map(([a, i]) => (
          <li key={i} className={hechas[k(i)] ? 'hecha' : ''}>
            <label>
              <input type="checkbox" checked={!!hechas[k(i)]} onChange={(e) => setHechas({ ...hechas, [k(i)]: e.target.checked })} />
              <span className="protocolo-texto">
                <span className="protocolo-plazo">{plazo(a.plazo)}</span>
                {a.si && sinFuente && <span className="protocolo-si">{(cond[a.si] || {}).etiqueta || a.si}:</span>}
                {a.accion}
                <small>{a.responsable}{a.fuente ? ' · ' + a.fuente : ''}</small>
              </span>
            </label>
          </li>
        ))}
      </ol>
      <p className="nota">{protocolos.aviso}</p>
    </div>
  );
}

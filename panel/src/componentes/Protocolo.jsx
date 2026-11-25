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

  // Ruta de respuesta: una etapa por plazo (inmediata, el mismo día, seguimiento) y en cada una sus pasos
  // numerados sobre una línea. Un clic en el número marca el paso como hecho (solo en pantalla).
  const etapas = ORDEN.map((p) => ({ p, pasos: acciones.map((a, i) => [a, i]).filter(([a]) => a.plazo === p) }))
    .filter((e) => e.pasos.length);
  const total = acciones.length, listos = acciones.filter((_, i) => hechas[k(i)]).length;
  let n = 0;
  return (
    <div className="protocolo">
      <div className="protocolo-cabeza">
        <p className="protocolo-titulo">{protocolo.titulo}</p>
        <span className="protocolo-avance" aria-live="polite">{listos} de {total} pasos</span>
      </div>
      <div className="protocolo-barra" aria-hidden="true"><span style={{ width: (total ? (100 * listos) / total : 0) + '%' }} /></div>
      {etapas.map(({ p, pasos }) => (
        <section key={p} className={'protocolo-etapa etapa-' + p}>
          <h4>{plazo(p)}</h4>
          <ol>
            {pasos.map(([a, i]) => {
              n += 1;
              const hecho = !!hechas[k(i)];
              return (
                <li key={i} className={hecho ? 'hecha' : ''}>
                  <button type="button" className="protocolo-num" aria-pressed={hecho}
                    title={hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}
                    onClick={() => setHechas({ ...hechas, [k(i)]: !hecho })}>
                    {hecho ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : n}
                  </button>
                  <div className="protocolo-paso">
                    {a.si && sinFuente && <p className="protocolo-si">{(cond[a.si] || {}).etiqueta || a.si}</p>}
                    <p className="protocolo-accion">{a.accion}</p>
                    <p className="protocolo-quien"><b>{a.responsable}</b>{a.fuente ? <span> · {a.fuente}</span> : null}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="nota">{protocolos.aviso}</p>
    </div>
  );
}

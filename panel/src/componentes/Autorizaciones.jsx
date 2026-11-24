import { inicial } from '../lib/formato.js';

// Tablero de autorizaciones (docs/19 §4.3 y §6, punto 5). Paso 1 del módulo B: la lista de trámites por
// escuela; el tablero por organismo y estado se agrega en el paso 6. Ningún mecanismo se presenta como
// activo sin la autorización de CEASPUE otorgada.
const ESTADO = { pendiente: 'Pendiente', solicitada: 'Solicitada', otorgada: 'Otorgada', negada: 'Negada' };
const TRAMITE = (t) => inicial((t || '').replace(/_/g, ' '));

export default function Autorizaciones({ escuelas }) {
  const filas = escuelas.flatMap((e) => (e.autorizaciones || []).map((a, i) => ({ e, a, k: e.cct + i })));
  return (
    <section className="vista">
      <figure className="tarjeta ancha">
        <h2 className="titulo-seccion">Trámites por escuela</h2>
        <p className="subtitulo-seccion">Trámites por confirmar con CEASPUE y CAPCEE; los nombres no son oficiales.</p>
        {!filas.length ? <p className="vacio">Sin trámites registrados.</p> : (
          <div className="tabla-desliza">
            <table className="estaciones">
              <thead><tr><th>Escuela</th><th>Organismo</th><th>Trámite</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {filas.map(({ e, a, k }) => (
                  <tr key={k}>
                    <td><b>{e.nombre}</b><br /><span className="tenue">{e.cct}</span></td>
                    <td>{a.organismo}</td>
                    <td>{TRAMITE(a.tramite)}</td>
                    <td>{ESTADO[a.estado] || a.estado}</td>
                    <td>{a.fecha || 'sin fecha'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </figure>
    </section>
  );
}

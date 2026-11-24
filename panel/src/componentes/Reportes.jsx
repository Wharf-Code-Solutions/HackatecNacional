import { REPORTE, txt } from '../lib/etiquetas.js';
import { hora } from '../lib/formato.js';
import BarrasH from '../graficas/BarrasH.jsx';
import { Mensaje } from '../graficas/marcas.jsx';

export default function Reportes({ reportes, conectado }) {
  const r = [...reportes].sort((x, y) => (y.fecha_hora < x.fecha_hora ? -1 : 1));
  const c = {};
  r.forEach((x) => { c[x.tipo] = (c[x.tipo] || 0) + 1; });
  const filas = Object.keys(c).sort((a, b) => c[b] - c[a]).map((k) => ({ nombre: REPORTE[k] || k, partes: { n: c[k] }, total: c[k] }));
  return (
    <section className="vista">
      <h2 className="titulo-pagina">Reportes ciudadanos</h2>
      <p className="intro">Recibidos por la app ciudadana. El correo de quien reporta no se muestra.</p>
      {!r.length ? (
        <Mensaje>{conectado === false ? 'Sin conexión con el backend.' : 'Sin reportes ciudadanos.'}</Mensaje>
      ) : (
        <>
          <figure className="tarjeta">
            <BarrasH filas={filas} claves={['n']} colores={{ n: '#9B2247' }} nombreClave={() => 'reportes'} nota="Reportes recibidos por tipo." />
          </figure>
          <div className="tabla-desliza">
            <table>
              <thead>
                <tr><th>Folio</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Sitio asignado</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {r.map((x) => (
                  <tr key={x.c_reporte}>
                    <td>{x.c_reporte}</td>
                    <td>{hora(x.fecha_hora)}</td>
                    <td>{REPORTE[x.tipo] || x.tipo}</td>
                    <td>{x.descripcion || 'sin descripción'}</td>
                    <td>
                      {x.c_sitio_asignado || 'sin asignar'}
                      {x.c_alerta_relacionada && <><br /><span className="tenue">alerta {x.c_alerta_relacionada}</span></>}
                    </td>
                    <td>{txt(x.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

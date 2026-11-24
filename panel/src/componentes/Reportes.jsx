import { REPORTE, txt } from '../lib/etiquetas.js';
import { hora } from '../lib/formato.js';
import BarrasH from '../graficas/BarrasH.jsx';
import { Mensaje } from '../graficas/marcas.jsx';

// Cómo se armó la prioridad de un foco, en una línea: (gravedad + corroboración) × calidad + sensor + fuente
function desglose(d) {
  const partes = ['(' + d.gravedad_del_tipo + ' tipo + ' + d.corroboracion_ciudadana + ' reportes) × ' + d.factor_de_calidad + ' calidad'];
  if (d.sensor) partes.push('+ ' + d.sensor + ' sensor');
  if (d.fuente_probable) partes.push('+ ' + d.fuente_probable + ' fuente');
  return partes.join(' ');
}

export default function Reportes({ reportes, prioridades, conectado }) {
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
          {prioridades && prioridades.length > 0 && (
            <>
              <h3 className="titulo-seccion">Qué atender primero</h3>
              <p className="intro">Focos de reportes (mismo tipo, a menos de 150 m y 24 h) ordenados por prioridad de 1 a 10. Los pesos son hipótesis de diseño, sin reportes reales con que calibrarlos.</p>
              <div className="tabla-desliza">
                <table>
                  <thead>
                    <tr><th>Prioridad</th><th>Tipo</th><th>Reportes</th><th>Último</th><th>Punto aguas abajo</th><th>Cómo se calculó</th></tr>
                  </thead>
                  <tbody>
                    {prioridades.map((p) => (
                      <tr key={p.c_foco}>
                        <td><b>{p.prioridad}</b> · {p.banda}</td>
                        <td>{REPORTE[p.tipo] || p.tipo}</td>
                        <td>{p.n_reportes}</td>
                        <td>{hora(p.ultimo_reporte)}</td>
                        <td>{p.c_sitio || 'sin cauce cerca'}{p.distancia_al_cauce_m != null && <><br /><span className="tenue">a {p.distancia_al_cauce_m} m del cauce</span></>}</td>
                        <td>
                          {desglose(p.desglose)}
                          {p.desglose.sensor_motivo && <><br /><span className="tenue">{p.desglose.sensor_motivo}</span></>}
                          {p.desglose.fuente_motivo && <><br /><span className="tenue">{p.desglose.fuente_motivo}</span></>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="titulo-seccion">Todos los reportes</h3>
            </>
          )}
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

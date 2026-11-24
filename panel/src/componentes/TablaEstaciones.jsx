import { useDatos } from '../lib/contexto.js';
import { AVISO } from '../lib/etiquetas.js';
import { hora, inicial, porAtender } from '../lib/formato.js';

// Las 5 estaciones. Un clic filtra la lista de alertas por esa estación; otro lo quita.
export default function TablaEstaciones({ alertas, veredictos, elegida, onElegir }) {
  const { estaciones, nombreEstacion } = useDatos();
  return (
    <section className="estaciones-bloque">
      <h2 className="titulo-seccion">Estaciones</h2>
      <div className="tabla-desliza">
        <table className="estaciones">
          <thead>
            <tr>
              <th>Estación</th><th>Estado</th><th>Última lectura</th>
              <th className="num">Alertas por atender</th><th>Falla técnica (última hora)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(estaciones).sort().map((c) => {
              const vs = veredictos[c] || [];
              const ultima = vs.reduce((m, v) => (v.fecha_hora > m ? v.fecha_hora : m), '');
              const act = alertas.filter((a) => a.c_estacion === c && porAtender(a));
              const crit = act.filter((a) => a.nivel === 'Critica').length;
              const avisos = [...new Set(vs.slice(-4).flatMap((v) => (v.avisos_tecnicos || []).map((av) => AVISO[av.tipo] || av.tipo)))];
              return (
                <tr key={c} className={elegida === c ? 'elegida' : ''} onClick={() => onElegir(elegida === c ? 'todas' : c)}
                  tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onElegir(elegida === c ? 'todas' : c); }}>
                  <td><span className="codigo">{c.replace('EST-', '')}</span> {nombreEstacion(c)}</td>
                  <td>{inicial(estaciones[c].estado)}</td>
                  <td>{ultima ? hora(ultima) : <span className="tenue">sin dato</span>}</td>
                  <td className="num">
                    {act.length ? <>{act.length}{crit > 0 && <> <span className="nivel Critica">{crit} crít.</span></>}</> : <span className="tenue">0</span>}
                  </td>
                  <td>{avisos.length ? avisos.join(', ') : <span className="tenue">ninguno</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

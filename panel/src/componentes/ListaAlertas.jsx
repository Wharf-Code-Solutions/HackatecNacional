import { useDatos } from '../lib/contexto.js';
import { PARAM, txt } from '../lib/etiquetas.js';
import { hora, num, porAtender } from '../lib/formato.js';

const ORDEN = { Critica: 0, Preventiva: 1, Informativa: 2 };

export function filtrar(alertas, { estado, nivel, estacion }) {
  return alertas.filter((a) => {
    if (estado === 'activas' && !porAtender(a)) return false;
    if (estado !== 'activas' && estado !== 'todas' && a.estado !== estado) return false;
    if (nivel !== 'todos' && a.nivel !== nivel) return false;
    if (estacion !== 'todas' && a.c_estacion !== estacion) return false;
    return true;
  }).sort((x, y) => (ORDEN[x.nivel] - ORDEN[y.nivel]) || (y.fecha_hora < x.fecha_hora ? -1 : 1));
}

export const Nivel = ({ nivel }) => <span className={'nivel ' + nivel}>{txt(nivel)}</span>;

export default function ListaAlertas({ alertas, filtros, setFiltros, sel, onElegir, conectado }) {
  const { estaciones, mecanismos = {}, nombreEstacion, unidad, escuelasDe } = useDatos();
  const lista = filtrar(alertas, filtros);
  const cambia = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value });
  return (
    <section className="lista-col" aria-label="Alertas">
      <div className="lista-cabeza">
        <h2 className="titulo-seccion">Alertas</h2>
        <div className="filtros">
          <label>Estado
            <select value={filtros.estado} onChange={cambia('estado')}>
              <option value="activas">Por atender</option>
              <option value="Abierta">Abierta</option>
              <option value="En atencion">En atención</option>
              <option value="Cerrada">Cerrada</option>
              <option value="Descartada">Descartada</option>
              <option value="todas">Todas</option>
            </select>
          </label>
          <label>Nivel
            <select value={filtros.nivel} onChange={cambia('nivel')}>
              <option value="todos">Todos</option>
              <option value="Critica">Crítica</option>
              <option value="Preventiva">Preventiva</option>
              <option value="Informativa">Informativa</option>
            </select>
          </label>
          <label>Estación
            <select value={filtros.estacion} onChange={cambia('estacion')}>
              <option value="todas">Todas</option>
              {Object.keys(mecanismos).sort().map((c) => (
                <option key={c} value={c}>{c.replace('EST-', '')} · {nombreEstacion(c)}</option>
              ))}
              {Object.keys(estaciones).sort().map((c) => (
                <option key={c} value={c}>{c.replace('EST-', '')} · {nombreEstacion(c)}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="conteo">{lista.length} de {alertas.length} alertas</p>
      </div>
      <ol className="alertas">
        {!lista.length && (
          <li className="vacio">
            {conectado === false && !alertas.length ? 'Sin conexión: no hay alertas que mostrar.'
              : alertas.length ? 'Ninguna alerta con estos filtros.'
                : 'Sin alertas. Reproduce un escenario contra el backend para generar algunas.'}
          </li>
        )}
        {lista.map((a) => (
          <li key={a.c_alerta} className={a.c_alerta === sel ? 'activa' : ''}>
            <button onClick={() => onElegir(a.c_alerta)}>
              <Nivel nivel={a.nivel} />
              <span className="cuando">{hora(a.fecha_hora)}</span>
              <span className="que">{PARAM[a.c_parametro] || a.c_parametro} {num(a.valor)}{unidad(a)}</span>
              <span className="estado">{txt(a.estado)}</span>
              <span className="donde">{a.c_estacion.replace('EST-', '')} · {nombreEstacion(a.c_estacion)}
                {escuelasDe(a).length > 0 && <> · <b className="afecta">{escuelasDe(a).length} {escuelasDe(a).length === 1 ? 'escuela' : 'escuelas'}</b></>}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

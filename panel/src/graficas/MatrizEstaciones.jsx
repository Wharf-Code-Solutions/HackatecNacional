import { PARAM, PARAM_CORTO, POSICION } from '../lib/etiquetas.js';
import { hora, inicial, num } from '../lib/formato.js';
import { Leyenda } from './marcas.jsx';

const PARAMS = ['OD', 'PH', 'COND', 'TEMP', 'TURB'];

// Estación × sonda con la posición de la última lectura en la banda del sitio.
// La posición la decide el backend (veredicto.posicion_en_banda); aquí solo se pinta.
export default function MatrizEstaciones({ estaciones, lineaBase, veredictos, corte }) {
  const cods = Object.keys(estaciones).sort();
  const unidad = (p) => ((lineaBase[(estaciones[cods[0]] || {}).c_sitio] || {})[p] || {}).unidad;
  return (
    <div className="lienzo">
      <Leyenda items={[
        ['Sobre lo habitual ▲', POSICION.sobre_p90.color],
        ['Dentro de lo habitual', '#DDDDDD'],
        ['Bajo lo habitual ▼', POSICION.bajo_p10.color],
      ]} />
      <div className="tabla-desliza">
        <table className="matriz">
          <thead>
            <tr>
              <th>Estación</th>
              {PARAMS.map((p) => (
                <th key={p} className="num" title={PARAM[p]}>
                  {PARAM_CORTO[p]}{unidad(p) && <><br /><span className="tenue">{unidad(p)}</span></>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cods.map((c) => {
              const vs = [...(veredictos[c] || [])].sort((a, b) => (a.fecha_hora < b.fecha_hora ? -1 : 1));
              const ult = vs[vs.length - 1];
              return (
                <tr key={c}>
                  <th scope="row">{c.replace('EST-', '')} <span className="tenue">{inicial(estaciones[c].cuerpo_agua)}</span></th>
                  {PARAMS.map((p) => {
                    const it = ult && (ult.parametros || []).find((x) => x.c_parametro === p);
                    if (!it || it.valor == null) {
                      return <td key={p} className="celda sin" data-tip={PARAM[p] + ' · sin dato'}>sin dato</td>;
                    }
                    const pos = POSICION[it.posicion_en_banda] || POSICION.sin_linea_base;
                    const u = ((lineaBase[estaciones[c].c_sitio] || {})[p] || {}).unidad || '';
                    const tip = `${PARAM[p]} ${num(it.valor)} ${u} · ${pos.txt}` +
                      (it.n_linea_base ? ` (banda con n = ${it.n_linea_base})` : '') + ' · ' + hora(ult.fecha_hora);
                    return (
                      <td key={p} className="celda" style={{ background: pos.color, color: pos.tinta }} data-tip={tip}>
                        {pos.marca && <span aria-hidden="true">{pos.marca} </span>}
                        {num(it.valor, it.valor > 100 ? 0 : 1)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pie-graf">
        Última lectura de cada sonda comparada con la historia de su propio sitio (p10 a p90).
        {corte && ' Corte: ' + hora(corte)}
      </p>
    </div>
  );
}

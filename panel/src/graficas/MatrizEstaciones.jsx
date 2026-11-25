import { LADERA, PARAM, PARAM_CORTO, POSICION, UNIDAD_LADERA } from '../lib/etiquetas.js';
import { useDatos } from '../lib/contexto.js';
import { hora, inicial, num } from '../lib/formato.js';
import { Leyenda } from './marcas.jsx';

const PARAMS = ['OD', 'PH', 'COND', 'TEMP', 'TURB'];
const CORTO_LADERA = { LLUVIA: 'Lluvia 24 h', HUM_SUELO: 'Humedad', INCL: 'Inclinación' };
const esLadera = (e) => (e.parametros || []).includes('LLUVIA');
const lugar = (e) => inicial(e.localidad || e.cuerpo_agua || '');
// Lluvia acumulada en las últimas 24 h de lecturas (la ventana corta del motor).
function lluvia24(vs) {
  if (!vs.length) return null;
  const fin = new Date(vs[vs.length - 1].fecha_hora).getTime();
  let s = 0, hay = false;
  vs.forEach((v) => {
    if (new Date(v.fecha_hora).getTime() <= fin - 86400000) return;
    const it = (v.parametros || []).find((x) => x.c_parametro === 'LLUVIA');
    if (it && it.valor != null && it.valor > -100) { s += it.valor; hay = true; }
  });
  return hay ? s : null;
}

// Estación × sonda con la posición de la última lectura en la banda del sitio.
// La posición la decide el backend (veredicto.posicion_en_banda); aquí solo se pinta.
export default function MatrizEstaciones({ estaciones, lineaBase, veredictos, corte }) {
  const { nivelLadera } = useDatos();
  const todos = Object.keys(estaciones).sort();
  const cods = todos.filter((c) => !esLadera(estaciones[c]));
  const laderas = todos.filter((c) => esLadera(estaciones[c]));
  const ultimo = (c) => { const vs = [...(veredictos[c] || [])].sort((a, b) => (a.fecha_hora < b.fecha_hora ? -1 : 1)); return [vs, vs[vs.length - 1]]; };
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
                  <th scope="row">{c.replace('EST-', '')} <span className="tenue">{lugar(estaciones[c])}</span></th>
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
      {laderas.length > 0 && (
        <div className="tabla-desliza matriz-ladera">
          <table className="matriz">
            <thead>
              <tr>
                <th>Ladera</th>
                {LADERA.map((p) => <th key={p} className="num" title={PARAM[p]}>{CORTO_LADERA[p]}<br /><span className="tenue">{UNIDAD_LADERA[p]}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {laderas.map((c) => {
                const [vs, ult] = ultimo(c);
                return (
                  <tr key={c}>
                    <th scope="row">{c.replace('EST-', '')} <span className="tenue">{lugar(estaciones[c])}</span></th>
                    {LADERA.map((p) => {
                      const it = ult && (ult.parametros || []).find((x) => x.c_parametro === p);
                      const v = p === 'LLUVIA' ? lluvia24(vs) : (it && it.valor != null && it.valor > -100 ? it.valor : null);
                      if (v == null) return <td key={p} className="celda sin" data-tip={PARAM[p] + ' · sin dato'}>sin dato</td>;
                      const n = nivelLadera(c, p, v);
                      const pos = n > 0 ? POSICION.sobre_p90 : POSICION.normal;
                      const tip = `${PARAM[p]} ${num(v, 1)} ${UNIDAD_LADERA[p]} · ${n > 0 ? 'sobre su umbral' : 'bajo sus umbrales'} · ${hora(ult.fecha_hora)}`;
                      return (
                        <td key={p} className="celda" style={{ background: pos.color, color: pos.tinta }} data-tip={tip}>
                          {pos.marca && <span aria-hidden="true">{pos.marca} </span>}{num(v, 1)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="pie-graf">
        Agua: última lectura de cada sonda comparada con la historia de su propio sitio (p10 a p90).
        {laderas.length > 0 && ' Ladera: comparada con los umbrales del motor (hipótesis); la lluvia, acumulada en 24 h.'}
        {corte && ' Corte: ' + hora(corte)}
      </p>
    </div>
  );
}

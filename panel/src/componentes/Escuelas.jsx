import { useState } from 'react';
import { inicial, num } from '../lib/formato.js';
import BarrasH from '../graficas/BarrasH.jsx';

// Vista de escuelas (docs/19 §6, punto 1): cuántas hay por nivel de riesgo, por tipo y por municipio,
// y la lista ordenada por índice. Todo sale de escuelas.json ya filtrado a la cuenca (lib/datos.js).
// Los colores son los mismos del mapa: guinda más oscuro cuanto mayor el riesgo.
export const NIVELES_RIESGO = ['muy_alto', 'alto', 'medio', 'bajo'];
export const NIVEL_RIESGO = { muy_alto: 'Muy alto', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };
export const COLOR_RIESGO = { muy_alto: '#5c0f24', alto: '#9D2449', medio: '#c56a87', bajo: '#e3a9ba' };
export const FUENTE_AGUA = { red_publica: 'Red pública', pozo: 'Pozo', manantial: 'Manantial', rio: 'Río', pipa: 'Pipa',
  captacion_lluvia: 'Captación de lluvia', desconocida: 'Sin dato' };
const TIPO = { derrumbe: 'Derrumbe', contaminacion: 'Contaminación' };

const r = (e) => e.riesgo || {};
// El riesgo que más pesa en la escuela: el mayor de sus dos subíndices.
export const tipoPrincipal = (e) => {
  const { contaminacion: c, derrumbe: d } = r(e);
  if (c == null && d == null) return null;
  return (d || 0) >= (c || 0) ? 'derrumbe' : 'contaminacion';
};

function porNivel(lista, clave) {
  const grupos = {};
  lista.forEach((e) => {
    const k = clave(e);
    if (k == null) return;
    const g = (grupos[k] = grupos[k] || { partes: {}, total: 0 });
    const n = r(e).nivel || 'sin_dato';
    g.partes[n] = (g.partes[n] || 0) + 1;
    g.total++;
  });
  return grupos;
}

function Tarjeta({ titulo, subtitulo, ancha, children }) {
  return (
    <figure className={'tarjeta' + (ancha ? ' ancha' : '')}>
      <h2 className="titulo-seccion">{titulo}</h2>
      {subtitulo && <p className="subtitulo-seccion">{subtitulo}</p>}
      {children}
    </figure>
  );
}

export default function Escuelas({ escuelas }) {
  const [filtro, setFiltro] = useState({ nivel: 'todos', tipo: 'todos', municipio: 'todos' });
  const total = escuelas.length;
  const altas = escuelas.filter((e) => ['alto', 'muy_alto'].includes(r(e).nivel)).length;
  const conMec = escuelas.filter((e) => e.c_estacion).length;
  const conMat = escuelas.filter((e) => e.matricula != null);
  const alumnos = conMat.reduce((s, e) => s + e.matricula, 0);
  const cifras = [
    [altas ? 'critica' : '', altas, 'Riesgo alto o muy alto', total ? Math.round(100 * altas / total) + ' % de ' + total : 'sin escuelas'],
    ['', total, 'Escuelas rurales en la cuenca', 'públicas, de Puebla'],
    ['', conMec, 'Con mecanismo propuesto', (total - conMec) + ' sin mecanismo'],
    ['', conMat.length ? num(alumnos) : 'sin dato', 'Alumnos', conMat.length ? 'en ' + conMat.length + ' de ' + total + ' escuelas con dato' : 'falta la matrícula en los datos'],
  ];

  const filasNivel = NIVELES_RIESGO.map((k) => {
    const n = escuelas.filter((e) => r(e).nivel === k).length;
    return { nombre: NIVEL_RIESGO[k], partes: { [k]: n }, total: n };
  }).filter((f) => f.total);
  const gTipo = porNivel(escuelas, tipoPrincipal);
  const filasTipo = Object.keys(TIPO).filter((k) => gTipo[k]).map((k) => ({ nombre: TIPO[k], ...gTipo[k] }));
  const gMun = porNivel(escuelas, (e) => inicial(e.municipio || 'Sin dato'));
  const filasMun = Object.entries(gMun).map(([nombre, g]) => ({ nombre, ...g }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));

  const municipios = Object.keys(gMun).sort();
  // La leyenda solo nombra los niveles que aparecen en los datos.
  const presentes = NIVELES_RIESGO.filter((k) => escuelas.some((e) => r(e).nivel === k));
  const lista = escuelas
    .filter((e) => filtro.nivel === 'todos' || r(e).nivel === filtro.nivel)
    .filter((e) => filtro.tipo === 'todos' || tipoPrincipal(e) === filtro.tipo)
    .filter((e) => filtro.municipio === 'todos' || inicial(e.municipio || 'Sin dato') === filtro.municipio)
    .sort((a, b) => (r(b).indice || 0) - (r(a).indice || 0));
  const cambia = (k) => (ev) => setFiltro({ ...filtro, [k]: ev.target.value });
  const nombreNivel = (k) => NIVEL_RIESGO[k] || 'Sin dato';

  return (
    <section className="vista">
      <div className="resumen" aria-live="polite">
        {cifras.map(([clase, n, etiqueta, nota]) => (
          <div key={etiqueta} className={'cifra ' + clase}><b>{n}</b><span>{etiqueta}</span><small>{nota}</small></div>
        ))}
      </div>

      <div className="panorama">
        <Tarjeta titulo="Por nivel de riesgo" subtitulo="Índice de riesgo de cada escuela; los pesos son hipótesis.">
          <BarrasH filas={filasNivel} claves={presentes} colores={COLOR_RIESGO} nombreClave={nombreNivel} />
        </Tarjeta>
        <Tarjeta titulo="Qué riesgo pesa más" subtitulo="El mayor de sus dos subíndices, por nivel de riesgo.">
          <BarrasH filas={filasTipo} claves={presentes} colores={COLOR_RIESGO} nombreClave={nombreNivel} />
        </Tarjeta>
        <Tarjeta titulo="Por municipio" subtitulo="Escuelas en riesgo por municipio, por nivel." ancha>
          <BarrasH filas={filasMun} claves={presentes} colores={COLOR_RIESGO} nombreClave={nombreNivel} />
        </Tarjeta>
      </div>

      <figure className="tarjeta ancha">
        <h2 className="titulo-seccion">Escuelas por atender</h2>
        <p className="subtitulo-seccion">De mayor a menor índice de riesgo.</p>
        <div className="filtros filtros-escuelas">
          <label>Riesgo
            <select value={filtro.nivel} onChange={cambia('nivel')}>
              <option value="todos">Todos</option>
              {NIVELES_RIESGO.map((k) => <option key={k} value={k}>{NIVEL_RIESGO[k]}</option>)}
            </select>
          </label>
          <label>Pesa más
            <select value={filtro.tipo} onChange={cambia('tipo')}>
              <option value="todos">Cualquiera</option>
              {Object.entries(TIPO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
          <label>Municipio
            <select value={filtro.municipio} onChange={cambia('municipio')}>
              <option value="todos">Todos</option>
              {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <p className="nota" style={{ margin: '8px 0' }}>{lista.length} de {total} escuelas</p>
        {!lista.length ? <p className="vacio">Ninguna escuela con estos filtros.</p> : (
          <div className="tabla-desliza">
            <table className="estaciones">
              <thead>
                <tr><th className="num">#</th><th>Escuela</th><th>Localidad</th><th>Riesgo</th><th>Pesa más</th>
                  <th>Agua</th><th>Mecanismo</th><th className="num">Índice</th></tr>
              </thead>
              <tbody>
                {lista.map((e, i) => (
                  <tr key={e.cct}>
                    <td className="num tenue">{i + 1}</td>
                    <td><b>{e.nombre}</b><br /><span className="tenue">{e.cct} · {inicial(e.nivel || 'sin dato')}</span></td>
                    <td>{inicial(e.localidad || 'sin dato')}<br /><span className="tenue">{inicial(e.municipio || '')}</span></td>
                    <td><span className="riesgo-marca" style={{ background: COLOR_RIESGO[r(e).nivel] || '#ddd' }} />{nombreNivel(r(e).nivel)}</td>
                    <td>{TIPO[tipoPrincipal(e)] || 'sin dato'}</td>
                    <td>{FUENTE_AGUA[e.fuente_agua] || 'Sin dato'}</td>
                    <td>{e.c_estacion || <span className="tenue">ninguno</span>}</td>
                    <td className="num">{r(e).indice != null ? num(r(e).indice, 2) : 'sin dato'}</td>
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

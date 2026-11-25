import { useState } from 'react';
import { inicial, num } from '../lib/formato.js';
import BarrasH from '../graficas/BarrasH.jsx';
import { useDatos } from '../lib/contexto.js';
import MapaEstaciones from '../graficas/MapaEstaciones.jsx';
import Urbanizacion from './Urbanizacion.jsx';
import FichaEscuela, { COLOR_RIESGO, FUENTE_AGUA, NIVEL_RIESGO } from './FichaEscuela.jsx';

// Vista de escuelas (docs/19 §6, punto 1): cuántas hay por nivel de riesgo, por tipo y por municipio,
// y la lista ordenada por índice. Todo sale de escuelas.json ya filtrado a la cuenca (lib/datos.js).
// Los colores son los mismos del mapa: guinda más oscuro cuanto mayor el riesgo.
export const NIVELES_RIESGO = ['muy_alto', 'alto', 'medio', 'bajo'];
// El mapa de escuelas no dibuja las estaciones del Atoyac: se centra en escuelas y zonas.
const SIN_ESTACIONES = {};
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

export default function Escuelas({ escuelas, alertas, zonas, sel, onElegir }) {
  const [filtro, setFiltro] = useState({ nivel: 'todos', tipo: 'todos', municipio: 'todos' });
  const total = escuelas.length;
  const altas = escuelas.filter((e) => ['alto', 'muy_alto'].includes(r(e).nivel)).length;
  const { mecanismosDe } = useDatos();
  const conMec = escuelas.filter((e) => mecanismosDe(e.cct).length).length;
  const conMat = escuelas.filter((e) => e.matricula != null);
  const alumnos = conMat.reduce((s, e) => s + e.matricula, 0);
  const cifras = [
    [altas ? 'critica' : '', altas, 'Riesgo alto o muy alto', total ? Math.round(100 * altas / total) + ' % de ' + total : 'sin escuelas'],
    ['', total, 'Escuelas rurales del Alto Atoyac', 'públicas, de Puebla'],
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
  const elegida = escuelas.find((e) => e.cct === sel) || null;
  const elegir = (cct) => {
    onElegir(cct);
    // En teléfono la ficha va debajo de la lista.
    if (window.matchMedia('(max-width: 1000px)').matches) {
      setTimeout(() => document.getElementById('ficha-escuela')?.scrollIntoView(), 0);
    }
  };

  return (
    <section className="vista">
      <div className="resumen" aria-live="polite">
        {cifras.map(([clase, n, etiqueta, nota]) => (
          <div key={etiqueta} className={'cifra ' + clase}><b>{n}</b><span>{etiqueta}</span><small>{nota}</small></div>
        ))}
      </div>

      {/* El mismo mapa de Alertas, para ver dónde está cada escuela sin cambiar de pestaña. Un clic en una
          escuela abre su ficha; la elegida se resalta y el mapa se acerca. */}
      <figure className="tarjeta ancha mapa-escuelas">
        <h2 className="titulo-seccion">Dónde están</h2>
        <p className="subtitulo-seccion">Escuelas por nivel de riesgo y las zonas que las contienen (tierra: derrumbe; verde oliva: contaminación). Un clic abre su ficha.</p>
        <MapaEstaciones estaciones={SIN_ESTACIONES} alertas={alertas} elegida={null} onElegir={() => {}}
          escuelas={escuelas} zonas={zonas} onElegirEscuela={elegir} escuelaElegida={sel} />
      </figure>

      <div className="trabajo">
        <section className="lista-col" aria-label="Escuelas">
          <div className="lista-cabeza">
            <h2 className="titulo-seccion">Escuelas por atender</h2>
            <div className="filtros">
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
            <p className="conteo">{lista.length} de {total} escuelas, de mayor a menor índice</p>
          </div>
          <ol className="alertas">
            {!lista.length && <li className="vacio">Ninguna escuela con estos filtros.</li>}
            {lista.map((e) => (
              <li key={e.cct} className={e.cct === sel ? 'activa' : ''}>
                <button onClick={() => elegir(e.cct)}>
                  <span className="nivel-esc"><span className="riesgo-marca" style={{ background: COLOR_RIESGO[r(e).nivel] || '#ddd' }} />{nombreNivel(r(e).nivel)}</span>
                  <span className="cuando">{r(e).indice != null ? 'índice ' + num(r(e).indice, 2) : 'sin índice'}</span>
                  <span className="que">{e.nombre}</span>
                  <span className="estado">{TIPO[tipoPrincipal(e)] || ''}</span>
                  <span className="donde">{inicial(e.localidad || 'sin dato')}, {inicial(e.municipio || '')}{mecanismosDe(e.cct).length ? ' · ' + mecanismosDe(e.cct).map((m) => m.c_estacion).join(', ') : ''}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <FichaEscuela escuela={elegida} alertas={alertas} zonas={zonas} />
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
      <Urbanizacion escuelas={escuelas} onElegir={(cct) => { elegir(cct); document.querySelector('.mapa-escuelas')?.scrollIntoView(); }} />
    </section>
  );
}

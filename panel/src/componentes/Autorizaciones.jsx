import { inicial } from '../lib/formato.js';
import BarrasH from '../graficas/BarrasH.jsx';

// Tablero de autorizaciones (docs/19 §4.3 y §6, punto 5): qué falta autorizar a CEASPUE y CAPCEE.
// Dos fuentes: los mecanismos (mecanismos.json, módulo A) y los trámites de cada escuela (escuelas.json).
// Un mecanismo sin la autorización de CEASPUE otorgada se presenta como propuesto, nunca como activo.
const ESTADOS = ['pendiente', 'solicitada', 'otorgada', 'negada'];
const ESTADO = { pendiente: 'Pendiente', solicitada: 'Solicitada', otorgada: 'Otorgada', negada: 'Negada' };
const COLOR_ESTADO = { pendiente: '#AAAAAA', solicitada: '#A57F2C', otorgada: '#086308', negada: '#9B0F15' };
const ORGANISMOS = ['CEASPUE', 'CAPCEE'];
const TRAMITE = (t) => inicial((t || '').replace(/_/g, ' '));

function Estado({ estado }) {
  return <span className="estado-tramite"><span className="riesgo-marca" style={{ background: COLOR_ESTADO[estado] || '#ddd' }} />{ESTADO[estado] || estado || 'sin dato'}</span>;
}

const deOrganismo = (auts, org) => (auts || []).find((a) => a.organismo === org);

export default function Autorizaciones({ escuelas, mecanismos = {}, onElegirEscuela }) {
  const mecs = Object.values(mecanismos).sort((a, b) => a.c_estacion.localeCompare(b.c_estacion));
  const activo = (m) => (m.autorizaciones || []).some((a) => a.organismo === 'CEASPUE' && a.estado === 'otorgada');
  const nActivos = mecs.filter(activo).length;

  // Todos los trámites: los de los mecanismos y los de las escuelas.
  const tramites = [
    ...mecs.flatMap((m) => (m.autorizaciones || []).map((a) => ({ ...a, de: 'mecanismo' }))),
    ...escuelas.flatMap((e) => (e.autorizaciones || []).map((a) => ({ ...a, de: 'escuela' }))),
  ];
  const cuenta = (est) => tramites.filter((a) => a.estado === est).length;
  const cifras = [
    [nActivos ? '' : 'critica', nActivos + ' de ' + mecs.length, 'Mecanismos activos', 'con autorización de CEASPUE otorgada'],
    ['', cuenta('pendiente'), 'Trámites pendientes', 'sin solicitar todavía'],
    ['', cuenta('solicitada'), 'Trámites solicitados', 'en espera de respuesta'],
    ['', cuenta('otorgada'), 'Trámites otorgados', 'de ' + tramites.length + ' en total'],
  ];
  const porOrganismo = ORGANISMOS.map((org) => {
    const partes = {};
    tramites.filter((a) => a.organismo === org).forEach((a) => { partes[a.estado] = (partes[a.estado] || 0) + 1; });
    return { nombre: org, partes, total: Object.values(partes).reduce((s, n) => s + n, 0) };
  }).filter((f) => f.total);
  const presentes = ESTADOS.filter((k) => tramites.some((a) => a.estado === k));
  const filasEscuela = escuelas.flatMap((e) => (e.autorizaciones || []).map((a, i) => ({ e, a, k: e.cct + i })));

  return (
    <section className="vista">
      <div className="resumen" aria-live="polite">
        {cifras.map(([clase, n, etiqueta, nota]) => (
          <div key={etiqueta} className={'cifra ' + clase}><b>{n}</b><span>{etiqueta}</span><small>{nota}</small></div>
        ))}
      </div>

      <div className="panorama">
        <figure className="tarjeta">
          <h2 className="titulo-seccion">Trámites por organismo</h2>
          <p className="subtitulo-seccion">De los mecanismos y de las escuelas, por estado.</p>
          <BarrasH filas={porOrganismo} claves={presentes} colores={COLOR_ESTADO} nombreClave={(k) => ESTADO[k] || k} />
        </figure>
        <figure className="tarjeta">
          <h2 className="titulo-seccion">Quién autoriza qué</h2>
          <dl className="datos competencias">
            <dt>CEASPUE</dt><dd>Instalar equipo en un cauce, fuente de abastecimiento o toma; tomar muestras; intervenir drenaje o descargas.</dd>
            <dt>CAPCEE</dt><dd>Acceso e instalación dentro o junto al plantel; dictamen del estado del inmueble.</dd>
          </dl>
          <p className="nota">Trámites por confirmar con CEASPUE y CAPCEE; los nombres no son oficiales.</p>
        </figure>
      </div>

      <figure className="tarjeta ancha">
        <h2 className="titulo-seccion">Mecanismos</h2>
        <p className="subtitulo-seccion">Un mecanismo sigue como propuesto mientras CEASPUE no otorgue su instalación.</p>
        {!mecs.length ? <p className="vacio">Sin mecanismos en los datos.</p> : (
          <div className="tabla-desliza">
            <table className="estaciones">
              <thead><tr><th>Mecanismo</th><th>Escuela</th><th>Situación</th><th>CEASPUE</th><th>CAPCEE</th></tr></thead>
              <tbody>
                {mecs.map((m) => {
                  const ce = deOrganismo(m.autorizaciones, 'CEASPUE'), ca = deOrganismo(m.autorizaciones, 'CAPCEE');
                  const n = (m.escuelas_protegidas || []).length;
                  return (
                    <tr key={m.c_estacion}>
                      <td><b>{m.c_estacion}</b><br /><span className="tenue">{inicial(m.municipio || '')}</span></td>
                      <td>
                        {onElegirEscuela && m.cct
                          ? <button className="enlace" onClick={() => onElegirEscuela(m.cct)}>{m.escuela || m.cct}</button>
                          : (m.escuela || m.cct || 'sin dato')}
                        <br /><span className="tenue">protege {n} {n === 1 ? 'escuela' : 'escuelas'}</span>
                      </td>
                      <td>{activo(m) ? 'Activo' : 'Propuesto'}</td>
                      <td>{ce ? <><Estado estado={ce.estado} /><br /><span className="tenue">{TRAMITE(ce.tramite)}</span></> : <span className="tenue">sin trámite</span>}</td>
                      <td>{ca ? <><Estado estado={ca.estado} /><br /><span className="tenue">{TRAMITE(ca.tramite)}</span></> : <span className="tenue">sin trámite</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </figure>

      <figure className="tarjeta ancha">
        <h2 className="titulo-seccion">Trámites de las escuelas</h2>
        {!filasEscuela.length ? <p className="vacio">Sin trámites registrados.</p> : (
          <div className="tabla-desliza">
            <table className="estaciones">
              <thead><tr><th>Escuela</th><th>Organismo</th><th>Trámite</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {filasEscuela.map(({ e, a, k }) => (
                  <tr key={k}>
                    <td>
                      {onElegirEscuela ? <button className="enlace" onClick={() => onElegirEscuela(e.cct)}>{e.nombre}</button> : <b>{e.nombre}</b>}
                      <br /><span className="tenue">{e.cct}</span>
                    </td>
                    <td>{a.organismo}</td>
                    <td>{TRAMITE(a.tramite)}</td>
                    <td><Estado estado={a.estado} /></td>
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

import { Fragment, lazy, Suspense, useMemo, useState } from 'react';
import { ESTADOS_REPORTE, REPORTE, REPORTE_ABIERTO, txt } from '../lib/etiquetas.js';
import { hora } from '../lib/formato.js';
import BarrasH from '../graficas/BarrasH.jsx';
import { Mensaje } from '../graficas/marcas.jsx';

// El mapa (MapLibre) pesa ~800 KB: se descarga solo al abrir esta sección
const MapaReportes = lazy(() => import('./MapaReportes.jsx'));

// Cómo se armó la prioridad de un foco, en una línea: (gravedad + corroboración) × calidad + sensor + fuente
function desglose(d) {
  const partes = ['(' + d.gravedad_del_tipo + ' tipo + ' + d.corroboracion_ciudadana + ' reportes) × ' + d.factor_de_calidad + ' calidad'];
  if (d.sensor) partes.push('+ ' + d.sensor + ' sensor');
  if (d.fuente_probable) partes.push('+ ' + d.fuente_probable + ' fuente');
  return partes.join(' ');
}

const Prioridad = ({ p }) => <span className={'prioridad ' + p.banda}><b>{p.prioridad}</b> {p.banda}</span>;

// Un selector de estado. Con valor nulo (reportes del foco en estados distintos) muestra «Mixto».
function SelectorEstado({ valor, onCambiar, ocupado, etiqueta }) {
  return (
    <select aria-label={etiqueta} value={valor || ''} disabled={ocupado} onChange={(e) => onCambiar(e.target.value)}>
      {!valor && <option value="" disabled>Mixto</option>}
      {ESTADOS_REPORTE.map((e) => <option key={e} value={e}>{txt(e)}</option>)}
    </select>
  );
}

function Detalle({ reportes }) {
  return (
    <div className="detalle-foco">
      {reportes.map((r) => (
        <div key={r.c_reporte} className="detalle-reporte">
          {r.foto_url ? <img src={r.foto_url} alt={'Foto del reporte ' + r.c_reporte} /> : <div className="sin-foto">Sin foto</div>}
          <div>
            <b>{r.c_reporte}</b> · {hora(r.fecha_hora)}
            <p>{r.descripcion || 'sin descripción'}</p>
            <p className="tenue">
              {r.precision_ubicacion_m != null ? 'GPS ±' + r.precision_ubicacion_m + ' m' : 'ubicación elegida en el mapa'}
              {r.clasificacion_automatica && ' · la foto parece «' + (REPORTE[r.clasificacion_automatica.etiqueta] || r.clasificacion_automatica.etiqueta) +
                '» (' + Math.round(r.clasificacion_automatica.confianza * 100) + ' %)'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function QueAtender({ reportes, prioridades, huella, guardarReporte, refrescar, demo, conectado }) {
  const [elegido, setElegido] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const porFolio = useMemo(() => Object.fromEntries(reportes.map((r) => [r.c_reporte, r])), [reportes]);

  if (!prioridades) {
    return <Mensaje>{demo ? 'La demostración no trae la prioridad de los reportes: conecta el backend o el mock.'
      : conectado === false ? 'Sin conexión con el backend.' : 'El backend no entregó prioridades (¿es una versión sin GET /prioridades?).'}</Mensaje>;
  }
  if (!prioridades.length) return <Mensaje>Sin reportes abiertos que atender.</Mensaje>;

  const estadoDe = (f) => {
    const e = new Set(f.c_reportes.map((c) => (porFolio[c] || {}).estado));
    return e.size === 1 ? [...e][0] : null;
  };
  const cambiar = async (f, nuevo) => {
    setOcupado(true); setMsg(null);
    try {
      await Promise.all(f.c_reportes.map((c) => guardarReporte(c, nuevo)));
      setMsg({ clase: 'bien', texto: 'Guardado: ' + f.n_reportes + (f.n_reportes === 1 ? ' reporte' : ' reportes') + ' en «' + txt(nuevo) + '».' +
        (demo ? ' Demostración: el cambio solo vive en esta pestaña.' : '') });
      if (!demo) refrescar();
    } catch (err) {
      setMsg({ clase: 'mal', texto: 'No se guardó: ' + err.message });
    }
    setOcupado(false);
  };
  const elegir = (id) => {
    setElegido(id);
    setTimeout(() => document.getElementById('foco-' + id)?.scrollIntoView({ block: 'nearest' }), 0);
  };

  return (
    <>
      <p className="intro">
        Focos de reportes (mismo tipo, a menos de 150 m y 24 h) ordenados por prioridad de 1 a 10. El mapa muestra la huella de calor sobre el río,
        que solo aparece donde hay al menos tres reportes. Los pesos son hipótesis de diseño, sin reportes reales con que calibrarlos.
      </p>
      <Suspense fallback={<p className="vacio centro">Cargando el mapa.</p>}>
        <MapaReportes focos={prioridades} huella={huella} elegido={elegido} onElegir={elegir} />
      </Suspense>
      {msg && <p className={'msg-gestion ' + msg.clase} role="status">{msg.texto}</p>}
      <div className="tabla-desliza">
        <table>
          <thead>
            <tr><th>Prioridad</th><th>Tipo</th><th>Reportes</th><th>Último</th><th>Punto aguas abajo</th><th>Cómo se calculó</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {prioridades.map((p) => (
              <Fragment key={p.c_foco}>
                <tr id={'foco-' + p.c_foco} className={elegido === p.c_foco ? 'fila-elegida' : ''}>
                  <td><Prioridad p={p} />{p.zona_de_calor && <><br /><span className="tenue">en zona de calor</span></>}</td>
                  <td>{REPORTE[p.tipo] || p.tipo}</td>
                  <td>
                    {p.n_reportes}<br />
                    <button className="enlace" onClick={() => setElegido(elegido === p.c_foco ? null : p.c_foco)}>
                      {elegido === p.c_foco ? 'Ocultar' : 'Ver fotos'}
                    </button>
                  </td>
                  <td>{hora(p.ultimo_reporte)}</td>
                  <td>{p.c_sitio || 'sin cauce cerca'}{p.distancia_al_cauce_m != null && <><br /><span className="tenue">a {p.distancia_al_cauce_m} m del cauce</span></>}</td>
                  <td>
                    {desglose(p.desglose)}
                    {p.desglose.sensor_motivo && <><br /><span className="tenue">{p.desglose.sensor_motivo}</span></>}
                    {p.desglose.fuente_motivo && <><br /><span className="tenue">{p.desglose.fuente_motivo}</span></>}
                  </td>
                  <td>
                    <SelectorEstado valor={estadoDe(p)} etiqueta={'Estado del foco ' + p.c_foco} ocupado={ocupado} onCambiar={(e) => cambiar(p, e)} />
                  </td>
                </tr>
                {elegido === p.c_foco && (
                  <tr className="fila-detalle"><td colSpan="7"><Detalle reportes={p.c_reportes.map((c) => porFolio[c]).filter(Boolean)} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Todos({ reportes, guardarReporte, refrescar, demo }) {
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const r = [...reportes].sort((x, y) => (y.fecha_hora < x.fecha_hora ? -1 : 1));
  const c = {};
  r.forEach((x) => { c[x.tipo] = (c[x.tipo] || 0) + 1; });
  const filas = Object.keys(c).sort((a, b) => c[b] - c[a]).map((k) => ({ nombre: REPORTE[k] || k, partes: { n: c[k] }, total: c[k] }));
  const cambiar = async (x, nuevo) => {
    setOcupado(true); setMsg(null);
    try {
      await guardarReporte(x.c_reporte, nuevo);
      setMsg({ clase: 'bien', texto: x.c_reporte + ': «' + txt(nuevo) + '».' + (demo ? ' Demostración: el cambio solo vive en esta pestaña.' : '') });
      if (!demo) refrescar();
    } catch (err) {
      setMsg({ clase: 'mal', texto: 'No se guardó: ' + err.message });
    }
    setOcupado(false);
  };
  return (
    <>
      <figure className="tarjeta">
        <BarrasH filas={filas} claves={['n']} colores={{ n: '#9B2247' }} nombreClave={() => 'reportes'} nota="Reportes recibidos por tipo." />
      </figure>
      {msg && <p className={'msg-gestion ' + msg.clase} role="status">{msg.texto}</p>}
      <div className="tabla-desliza">
        <table>
          <thead>
            <tr><th>Folio</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Foto</th><th>Sitio asignado</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {r.map((x) => (
              <tr key={x.c_reporte}>
                <td>{x.c_reporte}</td>
                <td>{hora(x.fecha_hora)}</td>
                <td>{REPORTE[x.tipo] || x.tipo}</td>
                <td>{x.descripcion || 'sin descripción'}</td>
                <td>{x.foto_url ? <img className="mini-foto" src={x.foto_url} alt={'Foto del reporte ' + x.c_reporte} /> : <span className="tenue">sin foto</span>}</td>
                <td>
                  {x.c_sitio_asignado || 'sin asignar'}
                  {x.c_alerta_relacionada && <><br /><span className="tenue">alerta {x.c_alerta_relacionada}</span></>}
                </td>
                <td><SelectorEstado valor={x.estado} etiqueta={'Estado de ' + x.c_reporte} ocupado={ocupado} onCambiar={(e) => cambiar(x, e)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Gestión de los reportes de las personas: qué atender primero, con su mapa, y la lista completa.
export default function Reportes(props) {
  const { reportes, prioridades, conectado } = props;
  const [sub, setSub] = useState('atender');
  const abiertos = prioridades ? prioridades.length : reportes.filter((x) => REPORTE_ABIERTO(x.estado)).length;
  return (
    <section className="vista">
      <h2 className="titulo-pagina">Reportes ciudadanos</h2>
      <p className="intro">Recibidos por la app ciudadana. El correo de quien reporta no se muestra.</p>
      {!reportes.length ? (
        <Mensaje>{conectado === false ? 'Sin conexión con el backend.' : 'Sin reportes ciudadanos.'}</Mensaje>
      ) : (
        <>
          <div className="pestanas" role="tablist">
            <button role="tab" aria-selected={sub === 'atender'} className={sub === 'atender' ? 'activa' : ''} onClick={() => setSub('atender')}>
              Qué atender {abiertos > 0 && <span>({abiertos})</span>}
            </button>
            <button role="tab" aria-selected={sub === 'todos'} className={sub === 'todos' ? 'activa' : ''} onClick={() => setSub('todos')}>
              Todos los reportes <span>({reportes.length})</span>
            </button>
          </div>
          {sub === 'atender' ? <QueAtender {...props} /> : <Todos {...props} />}
        </>
      )}
    </section>
  );
}

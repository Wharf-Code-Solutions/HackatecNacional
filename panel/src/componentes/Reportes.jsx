import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { distanciaAlCauce } from '../lib/cauce.js';
import Protocolo, { protocoloPara } from './Protocolo.jsx';
import { REPORTE, txt } from '../lib/etiquetas.js';
import { hora } from '../lib/formato.js';
import { useDatos } from '../lib/contexto.js';

// Gestión de los reportes de las personas, con la misma forma que el dashboard de SIGRIV
// (Wharf-Code-Solutions/HackatecRegional, src/components/Dashboard.jsx e IncidentDetails.jsx):
// barra lateral con pestañas, filtros y tarjetas; el mapa a la derecha con el calor; el detalle se abre
// encima del mapa con los pasos de atención y las acciones.
//
// Diferencias con SIGRIV, por los datos de este proyecto: una «incidencia» es un foco de GET /prioridades
// (mismo tipo, a menos de 150 m y 24 h); el calor es la huella sobre el río (D30), no puntos; el correo de
// quien reporta no sale de la API, así que no se listan personas sino sus reportes; y PATCH /reportes solo
// cambia el estado, así que el descarte no lleva motivo.

// El mapa (MapLibre) pesa ~800 KB: se descarga solo al abrir esta sección
const MapaReportes = lazy(() => import('./MapaReportes.jsx'));
const DashboardReportes = lazy(() => import('./DashboardReportes.jsx'));

const PESTANAS = [
  { id: 'activas', etiqueta: 'Activas' },
  { id: 'Cerrado', etiqueta: 'Cerrados' },
  { id: 'Descartado', etiqueta: 'Descartados' },
];
const PASOS = ['Recibido', 'Validado', 'En atencion', 'Cerrado'];
const ABIERTOS = ['Recibido', 'Validado', 'En atencion'];
const NIVEL = { Alta: 'alta', Media: 'media', Baja: 'baja' };
const ETIQUETA_NIVEL = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

function hace(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'Hace un momento';
  if (min < 60) return 'Hace ' + min + ' min';
  if (min < 1440) return 'Hace ' + Math.round(min / 60) + ' h';
  return 'Hace ' + Math.round(min / 1440) + ' d';
}
// Qué pasó con el aviso por correo de cada cambio de estado (cabecera X-Aviso-Correo del backend), en una frase
function textoCorreo(avisos) {
  const n = (k) => avisos.filter((a) => a === k).length;
  const partes = [];
  if (n('enviado')) partes.push(' Se avisó por correo a ' + n('enviado') + (n('enviado') === 1 ? ' persona.' : ' personas.'));
  if (n('fallido')) partes.push(' No se pudo enviar ' + n('fallido') + (n('fallido') === 1 ? ' correo.' : ' correos.'));
  if (n('no_configurado')) partes.push(' El correo de aviso no está configurado en el servidor.');
  return partes.join('');
}
const coordenadas = (lat, lon) => lat.toFixed(5) + ', ' + lon.toFixed(5);

// El estado de un foco: si sus reportes difieren, el menos avanzado (lo que falta por hacer)
function estadoDeFoco(estados) {
  const abiertos = estados.filter((e) => ABIERTOS.includes(e));
  if (abiertos.length) return ABIERTOS.find((e) => abiertos.includes(e));
  return estados[0] || 'Recibido';
}

// Activas: un elemento por foco (con prioridad). Cerrados y descartados: un elemento por reporte.
function elementos(pestana, reportes, prioridades) {
  const porFolio = Object.fromEntries(reportes.map((r) => [r.c_reporte, r]));
  if (pestana === 'activas') {
    return (prioridades || []).map((p) => {
      const rs = p.c_reportes.map((c) => porFolio[c]).filter(Boolean);
      return {
        id: p.c_foco, tipo: p.tipo, nivel: NIVEL[p.banda] || 'baja', prioridad: p.prioridad, desglose: p.desglose,
        lat: p.latitud, lon: p.longitud, c_sitio: p.c_sitio, distancia: p.distancia_al_cauce_m, fecha: p.ultimo_reporte,
        zona: p.zona_de_calor, reportes: rs, estado: estadoDeFoco(rs.map((r) => r.estado)),
      };
    });
  }
  return reportes.filter((r) => r.estado === pestana)
    .sort((a, b) => (b.fecha_hora < a.fecha_hora ? -1 : 1))
    .map((r) => ({
      id: r.c_reporte, tipo: r.tipo, nivel: 'baja', prioridad: null, lat: r.latitud, lon: r.longitud,
      c_sitio: r.c_sitio_asignado, distancia: r.distancia_al_cauce_m, fecha: r.fecha_hora, reportes: [r], estado: r.estado,
    }));
}

function Foto({ url, alt }) {
  const [fallo, setFallo] = useState(false);
  if (!url || fallo) return <div className="incidente-foto sin-foto">{url ? 'No se pudo cargar la foto' : 'Sin foto'}</div>;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={alt} className="incidente-foto" onError={() => setFallo(true)} /></a>;
}

function Tarjeta({ it, elegido, onVer, nombreSitio }) {
  const n = it.reportes.length;
  return (
    <div className={'reporte-tarjeta prioridad-' + it.nivel + (elegido ? ' seleccionada' : '')}>
      <div className="tarjeta-cabeza">
        <h3>
          <span className={'punto punto-' + it.nivel} aria-hidden="true">●</span>
          {REPORTE[it.tipo] || it.tipo}
          {it.prioridad != null && <span className="tarjeta-prioridad">{it.prioridad}</span>}
        </h3>
        <span className="tarjeta-hora">{hace(it.fecha)}</span>
      </div>
      <div className="tarjeta-lugar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <div className="tarjeta-lugar-texto">
          <span className="tarjeta-sitio" title={nombreSitio(it.c_sitio)}>{nombreSitio(it.c_sitio)}</span>
          <span className="tarjeta-coords">
            {it.distancia != null ? 'a ' + Math.round(it.distancia) + ' m del cauce · ' : ''}{coordenadas(it.lat, it.lon)}
          </span>
        </div>
      </div>
      <div className="tarjeta-pie">
        <span className={n > 1 ? 'tag-agrupado' : 'tag-normal'}>
          {n > 1 ? 'Agrupado: ' + n + ' reportes' : '1 reporte'}
          {it.estado !== 'Recibido' && ABIERTOS.includes(it.estado) ? ' · ' + txt(it.estado) : ''}
        </span>
        <div className="tarjeta-acciones">
          <span className="tarjeta-folio">{it.reportes[0] ? it.reportes[0].c_reporte : it.id}</span>
          <button type="button" className="btn-ver" onClick={onVer}>Ver</button>
        </div>
      </div>
    </div>
  );
}

function Pasos({ estado }) {
  const actual = PASOS.indexOf(estado);
  return (
    <div className="pasos">
      {PASOS.map((p, i) => {
        const clase = estado === 'Cerrado' || i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente';
        return (
          <div key={p} className={'paso ' + clase}>
            <div className="paso-icono">{clase === 'hecho' ? '✓' : i + 1}</div>
            <div className="paso-etiqueta">{txt(p)}</div>
          </div>
        );
      })}
    </div>
  );
}

// Qué se puede hacer desde cada estado. «Cerrar» y «Descartar» piden confirmación, como en SIGRIV.
const ACCIONES = {
  Recibido: [['Validado', 'Validar'], ['Descartado', 'Descartar']],
  Validado: [['En atencion', 'Marcar en atención'], ['Descartado', 'Descartar']],
  'En atencion': [['Cerrado', 'Cerrar'], ['Descartado', 'Descartar']],
  Descartado: [['Recibido', 'Restaurar como recibido']],
  Cerrado: [],
};
const CONFIRMAR = {
  Cerrado: (n) => '¿Marcar como cerrado? ' + (n > 1 ? 'Los ' + n + ' reportes salen' : 'El reporte sale') + ' de la lista de activos; quien reportó lo verá cerrado en su folio y, si dejó su correo, recibirá un aviso.',
  Descartado: (n) => '¿Descartar? ' + (n > 1 ? 'Los ' + n + ' reportes dejan' : 'El reporte deja') + ' de contar para la prioridad y el calor. Se puede restaurar después.',
};

// Escuelas a menos de 1 km del reporte: a ellas se dirigen las acciones que dependen del agua de la escuela.
const KM_ESCUELA = 1;
function escuelasCerca(escuelas, lat, lon) {
  if (lat == null || lon == null) return [];
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180), ky = 110.57;
  return (escuelas || []).filter((e) => e.latitud != null && Math.hypot((e.longitud - lon) * kx, (e.latitud - lat) * ky) <= KM_ESCUELA);
}

function Detalle({ it, nombreSitio, onCerrar, cambiar, ocupado }) {
  const { protocolos, escuelas } = useDatos();
  const protocolo = protocoloPara(protocolos, { reporte: { tipo: it.tipo } });
  const cerca = escuelasCerca(escuelas, it.lat, it.lon);
  const [confirmando, setConfirmando] = useState(null);
  useEffect(() => setConfirmando(null), [it.id, it.estado]);
  const foto = it.reportes.find((r) => r.foto_url);
  const d = it.desglose;
  const n = it.reportes.length;
  return (
    <div className="incidente-panel" role="dialog" aria-label="Detalle del reporte">
      <div className="incidente-cabeza">
        <div className="incidente-etiquetas">
          <span className="tag-folio">FOLIO {it.reportes[0] ? it.reportes[0].c_reporte : it.id}</span>
          {it.prioridad != null && <span className={'tag-prioridad tag-' + it.nivel}>{ETIQUETA_NIVEL[it.nivel]}</span>}
        </div>
        <button type="button" className="btn-cerrar" onClick={onCerrar} aria-label="Cerrar detalle">✕</button>
      </div>

      <div className="incidente-contenido">
        <div className="incidente-estado">{txt(it.estado)}</div>
        <h2 className="incidente-titulo">{REPORTE[it.tipo] || it.tipo}</h2>
        <Foto key={foto ? foto.foto_url.slice(-40) : 'sin'} url={foto && foto.foto_url} alt={'Foto del reporte: ' + (REPORTE[it.tipo] || it.tipo)} />

        <div className="caja-info">
          <div className="rejilla-info">
            <div><div className="info-etiqueta">Coordenadas</div><div className="info-valor">{coordenadas(it.lat, it.lon)}</div></div>
            <div><div className="info-etiqueta">{n > 1 ? 'Último reporte' : 'Fecha y hora'}</div><div className="info-valor">{hora(it.fecha)}</div></div>
          </div>
          <div className="info-linea"><strong>{nombreSitio(it.c_sitio)}</strong></div>
          <div className="info-linea">
            {it.c_sitio ? 'Punto de monitoreo aguas abajo: ' + it.c_sitio
              : it.distancia != null ? 'Sin punto de monitoreo aguas abajo' : 'Sin cauce a menos de 2 km'}
            {it.distancia != null && ' · a ' + Math.round(it.distancia) + ' m del cauce'}
          </div>
        </div>

        {d && (
          <div className="caja-info">
            <div className="caja-cabeza"><span>Prioridad {it.prioridad}/10</span>{it.zona && <span className="texto-suave">en zona de calor</span>}</div>
            <ul className="desglose">
              <li><span>Tipo de problema</span><strong>+{d.gravedad_del_tipo}</strong></li>
              <li><span>Otros reportes del foco</span><strong>+{d.corroboracion_ciudadana}</strong></li>
              <li><span>Calidad (foto y GPS)</span><strong>× {d.factor_de_calidad}</strong></li>
              <li><span>Alerta de una estación</span><strong>+{d.sensor}</strong></li>
              <li><span>Fuente probable aguas arriba</span><strong>+{d.fuente_probable}</strong></li>
            </ul>
            {d.sensor_motivo && <div className="info-linea">{d.sensor_motivo}</div>}
            {d.fuente_motivo && <div className="info-linea">Cerca de: {d.fuente_motivo}</div>}
          </div>
        )}

        <div className="caja-info">
          <div className="caja-cabeza"><span>Estado de atención</span></div>
          {it.estado === 'Descartado'
            ? <div className="aviso aviso-peligro"><strong>Descartado.</strong> No cuenta para la prioridad ni para el calor.</div>
            : <Pasos estado={it.estado} />}
        </div>

        {protocolo && it.estado !== 'Descartado' && (
          <div className="caja-info">
            <div className="caja-cabeza"><span>Qué hacer</span>
              <span className="texto-suave">{cerca.length ? cerca.length + (cerca.length === 1 ? ' escuela' : ' escuelas') + ' a menos de 1 km' : 'sin escuelas a menos de 1 km'}</span>
            </div>
            <Protocolo key={it.id} clave={it.id} protocolo={protocolo} escuelas={cerca} />
          </div>
        )}

        <div className="caja-info">
          <div className="caja-cabeza"><span>Impacto ciudadano</span></div>
          <div className="impacto">
            <div className="impacto-numero">{n}</div>
            <div className="impacto-etiqueta">{n === 1 ? 'Reporte' : 'Reportes agrupados'}</div>
          </div>
          <div className="lista-vinculados">
            <div className="caja-cabeza"><span>Reportes vinculados</span><span className="texto-suave">el correo no se muestra</span></div>
            {it.reportes.map((r, i) => (
              <div key={r.c_reporte} className="vinculado">
                <div>
                  <strong>{r.c_reporte}</strong> <span className="texto-suave">· {txt(r.estado)}</span>
                  {r.descripcion && <div className="vinculado-desc">{r.descripcion}</div>}
                  <div className="texto-suave">
                    {r.precision_ubicacion_m != null ? 'GPS ±' + Math.round(r.precision_ubicacion_m) + ' m' : 'punto elegido en el mapa'}
                    {r.clasificacion_automatica && ' · la foto parece «' + (REPORTE[r.clasificacion_automatica.etiqueta] || r.clasificacion_automatica.etiqueta) +
                      '» (' + Math.round(r.clasificacion_automatica.confianza * 100) + ' %)'}
                  </div>
                  {r.foto_url && <a href={r.foto_url} target="_blank" rel="noreferrer" className="texto-suave">Ver foto</a>}
                </div>
                <span className="vinculado-rol">{i === 0 ? 'Primer reporte' : 'Coincidente'} · {hora(r.fecha_hora)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(ACCIONES[it.estado] || []).length > 0 && (
        <div className="incidente-pie">
          {confirmando ? (
            <div className="aviso aviso-advertencia">
              {CONFIRMAR[confirmando](n)}
              <div className="pie-botones">
                <button type="button" className="boton primario" disabled={ocupado} onClick={() => cambiar(it, confirmando)}>
                  {ocupado ? 'Guardando…' : 'Confirmar'}
                </button>
                <button type="button" className="boton" disabled={ocupado} onClick={() => setConfirmando(null)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="pie-botones">
                {ACCIONES[it.estado].map(([destino, etiqueta]) => (
                  <button key={destino} type="button" disabled={ocupado}
                    className={destino === 'Descartado' ? 'boton peligro' : 'boton primario'}
                    onClick={() => (CONFIRMAR[destino] ? setConfirmando(destino) : cambiar(it, destino))}>
                    {ocupado ? 'Guardando…' : etiqueta}
                  </button>
                ))}
              </div>
              {it.estado === 'Recibido' && <p className="pie-nota">Para cerrarlo, primero valídalo y márcalo en atención.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Reportes({ reportes, prioridades, huella, conectado, guardarReporte, refrescar, demo, pagina, setPagina }) {
  const { nombresSitio } = useDatos();
  const nombreSitio = (c) => (c && nombresSitio[c] ? nombresSitio[c] : c ? c : 'Sin punto de monitoreo asignado');
  const [pestana, setPestana] = useState('activas');
  const [filtro, setFiltro] = useState('todos');        // todos | urgentes | tipo de reporte
  const [vista, setVista] = useState('lista');          // lista | mapa (solo en pantallas chicas)
  const [elegidoId, setElegidoId] = useState(null);
  const [calor, setCalor] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  // pagina (incidencias | dashboard, como /admin y /admin/dashboard de SIGRIV) la lleva App: se elige en el menú de la barra.

  const base = useMemo(() => elementos(pestana, reportes, prioridades), [pestana, reportes, prioridades]);
  // Reportes que llegaron sin distancia al cauce: se mide aquí contra la red del INEGI (lib/cauce.js).
  const [medidas, setMedidas] = useState({});
  useEffect(() => {
    let vivo = true;
    const faltan = base.filter((i) => i.distancia == null && i.lat != null && medidas[i.id] === undefined);
    if (!faltan.length) return undefined;
    Promise.all(faltan.map((i) => distanciaAlCauce(i.lat, i.lon).then((d) => [i.id, d]))).then((pares) => {
      if (vivo) setMedidas((m) => ({ ...m, ...Object.fromEntries(pares) }));
    });
    return () => { vivo = false; };
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => base.map((i) => (i.distancia == null && medidas[i.id] != null ? { ...i, distancia: medidas[i.id] } : i)),
    [base, medidas]);
  const tipos = useMemo(() => {
    const c = {};
    items.forEach((i) => { c[i.tipo] = (c[i.tipo] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a]);
  }, [items]);
  const urgentes = items.filter((i) => i.nivel === 'alta').length;
  const visibles = items.filter((i) => filtro === 'todos' || (filtro === 'urgentes' ? i.nivel === 'alta' : i.tipo === filtro));
  const elegido = items.find((i) => i.id === elegidoId) || null;

  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);

  const cambiarPestana = (id) => { setPestana(id); setFiltro('todos'); setElegidoId(null); };
  const ver = (it) => { setElegidoId(it.id); setVista('mapa'); };

  const cambiar = async (it, nuevo) => {
    setOcupado(true);
    try {
      const avisos = await Promise.all(it.reportes.map((r) => guardarReporte(r.c_reporte, nuevo)));
      const n = it.reportes.length;
      setAviso({ tipo: 'bien', texto: (n > 1 ? n + ' reportes' : 'Reporte ' + it.reportes[0].c_reporte) + ' en «' + txt(nuevo) + '».' +
        textoCorreo(avisos) });
      if (!ABIERTOS.includes(nuevo) || nuevo === 'Recibido') setElegidoId(null);   // sale de esta lista
      if (!demo) refrescar();
    } catch (err) {
      setAviso({ tipo: 'mal', texto: 'No se guardó: ' + err.message });
    }
    setOcupado(false);
  };

  let vacio = null;
  if (pestana === 'activas' && !prioridades) {
    vacio = demo ? 'No hay reportes por atender.'
      : conectado === false ? 'Sin conexión con el backend.' : 'Cargando reportes…';
  } else if (!visibles.length) vacio = 'No hay reportes en esta lista.';

  if (pagina === 'dashboard') {
    return (
      <div className="tablero">
        <Suspense fallback={<p className="lista-vacia">Cargando…</p>}>
          <DashboardReportes reportes={reportes} prioridades={prioridades} onVolver={() => setPagina('incidencias')} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="tablero">
      <div className="tablero-vista" role="tablist" aria-label="Vista">
        <button type="button" role="tab" aria-selected={vista === 'lista'} className={vista === 'lista' ? 'activa' : ''} onClick={() => setVista('lista')}>Lista</button>
        <button type="button" role="tab" aria-selected={vista === 'mapa'} className={vista === 'mapa' ? 'activa' : ''} onClick={() => setVista('mapa')}>Mapa</button>
      </div>

      <aside className={'tablero-lateral' + (vista === 'mapa' ? ' oculto-movil' : '')}>
        <div className="lateral-cabeza">
          <div className="lateral-titulo">
            <div>
              <h2>Reportes ciudadanos</h2>
              <p>Recibidos por la app ciudadana</p>
            </div>
            <div className="lateral-derecha">
              <div className="contador-total">{items.length} {pestana === 'activas' ? (items.length === 1 ? 'activo' : 'activos') : 'en esta lista'}</div>
            </div>
          </div>
          <div className="pestanas-sigriv" role="tablist">
            {PESTANAS.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id}
                className={pestana === p.id ? 'activa' : ''} onClick={() => cambiarPestana(p.id)}>{p.etiqueta}</button>
            ))}
          </div>
        </div>

        <div className="lateral-filtros">
          <button type="button" className={'filtro' + (filtro === 'todos' ? ' activo' : '')} onClick={() => setFiltro('todos')}>Todos ({items.length})</button>
          {pestana === 'activas' && (
            <button type="button" className={'filtro' + (filtro === 'urgentes' ? ' activo' : '')} onClick={() => setFiltro('urgentes')}>Urgentes ({urgentes})</button>
          )}
          {tipos.map((t) => (
            <button key={t} type="button" className={'filtro' + (filtro === t ? ' activo' : '')} onClick={() => setFiltro(t)}>{REPORTE[t] || t}</button>
          ))}
          <button type="button" className="filtro filtro-actualizar" onClick={refrescar}>Actualizar</button>
        </div>

        <div className="lateral-lista">
          {vacio ? <p className="lista-vacia">{vacio}</p> : visibles.map((it) => (
            <Tarjeta key={it.id} it={it} elegido={it.id === elegidoId} nombreSitio={nombreSitio} onVer={() => ver(it)} />
          ))}
        </div>
      </aside>

      <section className={'tablero-mapa' + (vista === 'lista' ? ' oculto-movil' : '')}>
        <Suspense fallback={<p className="lista-vacia">Cargando el mapa…</p>}>
          <MapaReportes focos={visibles} huella={huella} calor={calor} elegido={elegidoId} vista={vista}
            onElegir={(id) => { const it = items.find((x) => x.id === id); if (it) ver(it); }} />
        </Suspense>
        <div className="mapa-controles">
          <button type="button" className={'btn-calor' + (calor ? ' activo' : '')} aria-pressed={calor} onClick={() => setCalor((v) => !v)}>
            Mapa de calor
          </button>
        </div>
        {calor && (
          <div className="leyenda-calor" aria-label="Leyenda del mapa de calor">
            <span>Menos reportes</span><i className="leyenda-calor-barra" /><span>Más reportes</span>
          </div>
        )}
      </section>

      {aviso && <div className={'toast-tablero ' + aviso.tipo} role="status">{aviso.texto}</div>}

      {elegido && (
        <Detalle it={elegido} nombreSitio={nombreSitio} onCerrar={() => setElegidoId(null)} cambiar={cambiar} ocupado={ocupado} />
      )}
    </div>
  );
}

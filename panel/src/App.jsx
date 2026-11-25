import { useEffect, useMemo, useState } from 'react';
import { useRuta } from './lib/ruta.js';
import { Datos, ayudantes, conAutorizaciones } from './lib/contexto.js';
import { useBackend, useDatosFijos } from './lib/datos.js';
import { hora, porAtender } from './lib/formato.js';
import { REPORTE_ABIERTO } from './lib/etiquetas.js';
import Autorizaciones from './componentes/Autorizaciones.jsx';
import Avisos from './componentes/Avisos.jsx';
import MenuSeccion from './componentes/MenuSeccion.jsx';
import Escuelas from './componentes/Escuelas.jsx';
import Expediente from './componentes/Expediente.jsx';
import ListaAlertas from './componentes/ListaAlertas.jsx';
import Panorama from './componentes/Panorama.jsx';
import Reportes from './componentes/Reportes.jsx';
import Resumen from './componentes/Resumen.jsx';
import TablaEstaciones from './componentes/TablaEstaciones.jsx';
import Tooltip from './componentes/Tooltip.jsx';

// Cambio de rumbo (docs/19 §6): la unidad es la escuela. Escuelas en riesgo, alertas de los mecanismos,
// autorizaciones de CEASPUE y CAPCEE, y la gestión de lo que reportan las personas.
// [id, nombre corto, resto, nombre en teléfono]: en el teléfono la barra muestra el nombre corto sin el resto,
// o el nombre en teléfono si lo hay.
const SECCIONES = [['monitoreo', 'Alertas', ''], ['escuelas', 'Escuelas', ''], ['autorizaciones', 'Autorizaciones', '', 'Trámites'], ['reportes', 'Reportes', ' ciudadanos']];
const BAJADA = {
  escuelas: 'Escuelas rurales en riesgo de contaminación o derrumbe: cuáles atender primero y por qué.',
  monitoreo: 'Alertas de los mecanismos de calidad del agua: qué se midió, de dónde pudo venir y quién la atiende.',
  autorizaciones: 'Lo que falta autorizar a CEASPUE y CAPCEE. Un mecanismo sin autorización de CEASPUE sigue como propuesto.',
};
const VISTAS = [['alertas', 'Alertas'], ['avisos', 'Avisos técnicos']];

// Hora del dato más reciente recibido: es el corte de todo lo que se muestra (I12).
function corteDe(alertas, veredictos) {
  let max = '';
  Object.values(veredictos).forEach((vs) => vs.forEach((v) => { if (v.fecha_hora > max) max = v.fecha_hora; }));
  alertas.forEach((a) => { if (a.fecha_hora > max) max = a.fecha_hora; });
  return max;
}

function contarAvisos(veredictos) {
  const tipos = new Set();
  Object.entries(veredictos).forEach(([c, vs]) => vs.forEach((v) =>
    (v.avisos_tecnicos || []).forEach((av) => tipos.add(c + av.tipo + (av.c_parametro || '')))));
  return tipos.size;
}

export default function App() {
  const { datos: fijos, error } = useDatosFijos();
  const codigos = useMemo(() => (fijos ? Object.keys(fijos.estaciones).sort() : []), [fijos]);
  // Lecturas de todas las estaciones: las del Atoyac y los mecanismos junto a escuelas (agua y ladera).
  const codigosBackend = useMemo(() => (fijos ? [...codigos, ...Object.keys(fijos.mecanismos || {}).sort()] : []), [fijos, codigos]);
  const be = useBackend(codigosBackend);
  // Los trámites registrados desde el panel se sobreponen a los de los fixtures (activo/propuesto en todo el panel).
  const ctx = useMemo(() => (fijos ? ayudantes(conAutorizaciones(fijos, be.autorizaciones)) : null), [fijos, be.autorizaciones]);
  // Sección, vista, escuela abierta y página de reportes viven en la URL (lib/ruta.js): Atrás regresa.
  const [ruta, ir] = useRuta();
  const { seccion, vista, escuela: escuelaSel, paginaReportes } = ruta;
  const setSeccion = (s) => ir({ seccion: s });
  const setVista = (v) => ir({ vista: v });
  const setPaginaReportes = (p) => ir({ seccion: 'reportes', paginaReportes: p });
  // Elegir otra escuela dentro de la lista no deja un paso en el historial; llegar desde otra sección, sí.
  const setEscuelaSel = (cct) => ir({ escuela: cct }, { reemplazar: seccion === 'escuelas' });
  const abrirEscuela = (cct) => { ir({ seccion: 'escuelas', escuela: cct }); window.scrollTo(0, 0); };
  useEffect(() => { window.scrollTo(0, 0); }, [seccion, vista, paginaReportes]);
  const [sel, setSel] = useState(null);
  const [filtros, setFiltros] = useState({ estado: 'activas', nivel: 'todos', estacion: 'todas' });

  const demo = be.origen.modo === 'demo';
  const activas = be.alertas.filter(porAtender).length;
  const nAvisos = contarAvisos(be.veredictos);
  const conteo = { alertas: activas, avisos: nAvisos };
  const reportesAbiertos = be.reportes.filter((x) => REPORTE_ABIERTO(x.estado)).length;
  const conteoSeccion = { monitoreo: activas, reportes: reportesAbiertos };
  const conPagina = seccion !== 'reportes';
  const corte = corteDe(be.alertas, be.veredictos);
  const alerta = be.alertas.find((a) => a.c_alerta === sel) || null;

  const elegirAlerta = (id) => {
    setSel(id);
    // En teléfono el expediente va debajo de la lista.
    if (window.matchMedia('(max-width: 1000px)').matches) {
      setTimeout(() => document.getElementById('expediente')?.scrollIntoView(), 0);
    }
  };


  return (
    <>
      {/* Misma barra que la app ciudadana y SIGRIV: logotipo del Gobierno de México, filete dorado y las
          dos secciones del panel como enlaces. */}
      <header className="navbar-gob">
        <div className="contenedor navbar-fila">
          <div className="navbar-izq">
            <img src="https://framework-gb.cdn.gob.mx/landing/img/logoheader.svg" alt="Gobierno de México" className="navbar-logo" />
            <div className="navbar-divisor" />
            <span className="navbar-titulo">Escuelas en riesgo</span>
          </div>
          <nav className="secciones" aria-label="Paneles">
            {SECCIONES.map(([id, nombre, resto, tel]) => (id === 'reportes' ? (
              <MenuSeccion key={id} activa={seccion === id} cuenta={conteoSeccion[id]} actual={paginaReportes}
                etiqueta={<><span className="largo">{nombre}{resto}</span><span className="tel">{nombre}</span></>}
                opciones={[['incidencias', 'Reportes'], ['dashboard', 'Estadísticas']]}
                onElegir={(p) => setPaginaReportes(p)} />
            ) : (
              <button key={id} className={seccion === id ? 'activa' : ''} onClick={() => setSeccion(id)} aria-current={seccion === id ? 'page' : undefined}>
                {tel ? <><span className="largo">{nombre}</span><span className="tel">{tel}</span></> : nombre}<span className="resto">{resto}</span> {conteoSeccion[id] > 0 && <span className="cuenta">({conteoSeccion[id]})</span>}
              </button>
            )))}
          </nav>
        </div>
      </header>

      {conPagina && (
      <div className="encabezado-pagina">
        <div className="contenedor">
          <h1 className="titulo-panel">{SECCIONES.find(([id]) => id === seccion)[1]}</h1>
          <p className="bajada">
            {BAJADA[seccion]}{seccion === 'monitoreo' && corte && <> Datos al {hora(corte).replace(/\.$/, '')}.</>}
          </p>
          {seccion === 'monitoreo' ? (
            <nav className="subnav" aria-label="Vistas de alertas">
              {VISTAS.map(([id, nombre]) => (
                <button key={id} className={vista === id ? 'activa' : ''} onClick={() => setVista(id)} aria-current={vista === id ? 'page' : undefined}>
                  {nombre} {conteo[id] > 0 && <span className="contador">{conteo[id]}</span>}
                </button>
              ))}
            </nav>
          ) : <div className="subnav-vacio" />}
        </div>
      </div>
      )}

      {seccion === 'monitoreo' && demo && be.capturado && (
        <div className="contenedor aviso-contenedor">
          <div className="aviso aviso-advertencia" role="note">
            Datos de demostración: lo que respondió el motor de reglas el {hora(be.capturado)} en el escenario de
            descarga industrial. Los cambios de estado y responsable no se guardan.
          </div>
        </div>
      )}
      {/* Solo en monitoreo: habla del motor de alertas, no de los reportes, y en reportes empujaba el tablero */}
      {seccion === 'monitoreo' && !demo && be.motor === 'stub' && (
        <div className="contenedor aviso-contenedor">
          <div className="aviso aviso-advertencia" role="note">
            Motor de reglas provisional: genera alertas sin distinguir eventos reales. Arranca el backend con el
            motor real para ver el análisis.
          </div>
        </div>
      )}

      <main className={seccion === 'reportes' ? 'tablero-main' : 'contenedor'}>
        {error && <p className="mensaje">No se pudieron leer los datos del panel ({error}). Corre npm run datos.</p>}
        {!ctx && !error && <p className="vacio centro">Cargando.</p>}
        {ctx && (
          <Datos.Provider value={ctx}>
            {seccion === 'monitoreo' && vista === 'alertas' && (
              <section className="vista">
                <Resumen alertas={be.alertas} veredictos={be.veredictos} totalEstaciones={codigos.length} corte={corte} />
                {/* Solo los dispositivos: las escuelas tienen su propio mapa en la pestaña Escuelas. */}
                <Panorama parte="mapa" alertas={be.alertas} veredictos={be.veredictos} corte={corte} elegida={filtros.estacion}
                  onElegir={(c) => setFiltros({ ...filtros, estacion: filtros.estacion === c ? 'todas' : c })} />
                <TablaEstaciones alertas={be.alertas} veredictos={be.veredictos} elegida={filtros.estacion}
                  onElegir={(c) => setFiltros({ ...filtros, estacion: c })} />
                <div className="trabajo">
                  <ListaAlertas alertas={be.alertas} filtros={filtros} setFiltros={setFiltros} sel={sel}
                    onElegir={elegirAlerta} conectado={be.conectado} />
                  <Expediente alerta={alerta} alertas={be.alertas} veredictos={alerta ? be.veredictos[alerta.c_estacion] : []}
                    motor={be.motor} guardar={be.guardar} prediccion={be.prediccion} demo={demo}
                    onElegirEscuela={abrirEscuela} />
                </div>
                <Panorama parte="conteos" alertas={be.alertas} veredictos={be.veredictos} corte={corte} elegida={filtros.estacion} />
              </section>
            )}
            {seccion === 'monitoreo' && vista === 'avisos' && <Avisos veredictos={be.veredictos} conectado={be.conectado} />}
            {seccion === 'escuelas' && <Escuelas escuelas={ctx.escuelas} alertas={be.alertas} zonas={ctx.zonas} sel={escuelaSel} onElegir={setEscuelaSel} />}
            {seccion === 'autorizaciones' && <Autorizaciones escuelas={ctx.escuelas} mecanismos={ctx.mecanismos}
              registrar={be.registrarAutorizacion} demo={demo}
              onElegirEscuela={abrirEscuela} />}
            {seccion === 'reportes' && (
              <Reportes reportes={be.reportes} prioridades={be.prioridades} huella={be.huella} conectado={be.conectado}
                guardarReporte={be.guardarReporte} refrescar={be.refrescar} demo={demo}
                pagina={paginaReportes} setPagina={setPaginaReportes} />
            )}
          </Datos.Provider>
        )}
      </main>

      {conPagina && (
      <footer className="pie">
        <div className="contenedor pie-fila">
          <div className="pie-marca">
            <span className="pie-titulo">Escuelas en riesgo</span>
            <span className="pie-sub">Cuenca del Alto Atoyac, Puebla</span>
          </div>
          <p className="pie-legal">
            Prototipo para el HackaTec 2026, reto CAPCEE. No es un sitio oficial del Gobierno de México, de CAPCEE ni de CEASPUE.
          </p>
        </div>
      </footer>
      )}
      <Tooltip />
    </>
  );
}

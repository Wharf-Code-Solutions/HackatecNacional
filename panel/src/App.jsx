import { useMemo, useState } from 'react';
import { Datos, ayudantes } from './lib/contexto.js';
import { useBackend, useDatosFijos } from './lib/datos.js';
import { hora, porAtender } from './lib/formato.js';
import { REPORTE_ABIERTO } from './lib/etiquetas.js';
import Avisos from './componentes/Avisos.jsx';
import Expediente from './componentes/Expediente.jsx';
import ListaAlertas from './componentes/ListaAlertas.jsx';
import Panorama from './componentes/Panorama.jsx';
import Reportes from './componentes/Reportes.jsx';
import Resumen from './componentes/Resumen.jsx';
import TablaEstaciones from './componentes/TablaEstaciones.jsx';
import Tooltip from './componentes/Tooltip.jsx';

// Dos paneles en uno: lo que mide el prototipo (alertas de las estaciones) y la gestión de lo que reportan las personas.
// [id, nombre corto, resto]: en el teléfono la barra solo muestra el nombre corto.
const SECCIONES = [['monitoreo', 'Monitoreo', ' del prototipo'], ['reportes', 'Reportes', ' ciudadanos']];
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
  const be = useBackend(codigos);
  const ctx = useMemo(() => (fijos ? ayudantes(fijos) : null), [fijos]);
  const [seccion, setSeccion] = useState('monitoreo');
  const [vista, setVista] = useState('alertas');
  const [sel, setSel] = useState(null);
  const [filtros, setFiltros] = useState({ estado: 'activas', nivel: 'todos', estacion: 'todas' });

  const demo = be.origen.modo === 'demo';
  const activas = be.alertas.filter(porAtender).length;
  const nAvisos = contarAvisos(be.veredictos);
  const conteo = { alertas: activas, avisos: nAvisos };
  const reportesAbiertos = be.reportes.filter((x) => REPORTE_ABIERTO(x.estado)).length;
  const conteoSeccion = { monitoreo: activas, reportes: reportesAbiertos };
  const corte = corteDe(be.alertas, be.veredictos);
  const alerta = be.alertas.find((a) => a.c_alerta === sel) || null;

  const elegirAlerta = (id) => {
    setSel(id);
    // En teléfono el expediente va debajo de la lista.
    if (window.matchMedia('(max-width: 1000px)').matches) {
      setTimeout(() => document.getElementById('expediente')?.scrollIntoView(), 0);
    }
  };

  let conexion = 'Comprobando conexión.', claseConexion = 'conexion';
  if (demo) { conexion = 'Modo demostración'; claseConexion += ' ok'; }
  else if (be.conectado === false) { conexion = 'Sin conexión con ' + be.origen.url.replace(/^https?:\/\//, '') + '. Se muestra lo último recibido.'; claseConexion += ' mal'; }
  else if (be.conectado) { conexion = 'Conectado a ' + be.origen.url.replace(/^https?:\/\//, ''); claseConexion += ' ok'; }

  return (
    <>
      {/* Misma barra que la app ciudadana y SIGRIV: logotipo del Gobierno de México, filete dorado y las
          dos secciones del panel como enlaces. */}
      <header className="navbar-gob">
        <div className="contenedor navbar-fila">
          <div className="navbar-izq">
            <img src="https://framework-gb.cdn.gob.mx/landing/img/logoheader.svg" alt="Gobierno de México" className="navbar-logo" />
            <div className="navbar-divisor" />
            <span className="navbar-titulo">Río Atoyac · Autoridad</span>
          </div>
          <nav className="secciones" aria-label="Paneles">
            {SECCIONES.map(([id, nombre, resto]) => (
              <button key={id} className={seccion === id ? 'activa' : ''} onClick={() => setSeccion(id)} aria-current={seccion === id ? 'page' : undefined}>
                {nombre}<span className="resto">{resto}</span> {conteoSeccion[id] > 0 && <span>({conteoSeccion[id]})</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="encabezado-pagina">
        <div className="contenedor">
          <p className={claseConexion}>{conexion}</p>
          <h1 className="titulo-panel">Panel de autoridad</h1>
          <p className="bajada">
            {seccion === 'monitoreo'
              ? <>Alertas de las {codigos.length || 5} estaciones del Alto Atoyac: qué se midió, de dónde pudo venir, hasta dónde
                llega y quién la atiende.{corte && <> Datos al {hora(corte)}</>}</>
              : <>Lo que reportan las personas desde la app ciudadana: dónde se concentra, qué tan urgente es cada foco y en
                qué va su atención.</>}
          </p>
          {seccion === 'monitoreo' ? (
            <nav className="subnav" aria-label="Vistas del monitoreo">
              {VISTAS.map(([id, nombre]) => (
                <button key={id} className={vista === id ? 'activa' : ''} onClick={() => setVista(id)} aria-current={vista === id ? 'page' : undefined}>
                  {nombre} {conteo[id] > 0 && <span className="contador">{conteo[id]}</span>}
                </button>
              ))}
            </nav>
          ) : <div className="subnav-vacio" />}
        </div>
      </div>

      {demo && be.capturado && (
        <div className="contenedor aviso-contenedor">
          <div className="aviso aviso-advertencia" role="note">
            Datos de demostración: lo que respondió el motor de reglas el {hora(be.capturado)} en el escenario de
            descarga industrial. Los cambios de estado y responsable no se guardan.
          </div>
        </div>
      )}
      {!demo && be.motor === 'stub' && (
        <div className="contenedor aviso-contenedor">
          <div className="aviso aviso-advertencia" role="note">
            Motor de reglas provisional: genera alertas sin distinguir eventos reales. Arranca el backend con el
            motor real para ver el análisis.
          </div>
        </div>
      )}

      <main className="contenedor">
        {error && <p className="mensaje">No se pudieron leer los datos del panel ({error}). Corre npm run datos.</p>}
        {!ctx && !error && <p className="vacio centro">Cargando.</p>}
        {ctx && (
          <Datos.Provider value={ctx}>
            {seccion === 'monitoreo' && vista === 'alertas' && (
              <section className="vista">
                <Resumen alertas={be.alertas} veredictos={be.veredictos} totalEstaciones={codigos.length} corte={corte} />
                <Panorama parte="mapa" alertas={be.alertas} veredictos={be.veredictos} corte={corte} elegida={filtros.estacion}
                  onElegir={(c) => setFiltros({ ...filtros, estacion: filtros.estacion === c ? 'todas' : c })} />
                <TablaEstaciones alertas={be.alertas} veredictos={be.veredictos} elegida={filtros.estacion}
                  onElegir={(c) => setFiltros({ ...filtros, estacion: c })} />
                <div className="trabajo">
                  <ListaAlertas alertas={be.alertas} filtros={filtros} setFiltros={setFiltros} sel={sel}
                    onElegir={elegirAlerta} conectado={be.conectado} />
                  <Expediente alerta={alerta} veredictos={alerta ? be.veredictos[alerta.c_estacion] : []}
                    motor={be.motor} guardar={be.guardar} prediccion={be.prediccion} demo={demo} />
                </div>
                <Panorama parte="conteos" alertas={be.alertas} veredictos={be.veredictos} corte={corte} elegida={filtros.estacion} />
              </section>
            )}
            {seccion === 'monitoreo' && vista === 'avisos' && <Avisos veredictos={be.veredictos} conectado={be.conectado} />}
            {seccion === 'reportes' && (
              <Reportes reportes={be.reportes} prioridades={be.prioridades} huella={be.huella} conectado={be.conectado}
                guardarReporte={be.guardarReporte} refrescar={be.refrescar} demo={demo} />
            )}
          </Datos.Provider>
        )}
      </main>

      <footer className="pie">
        <div className="contenedor pie-rejilla">
          <div>
            <p className="pie-titulo">Monitoreo del río Atoyac</p>
            <p>Sistema de alerta por contaminación para la cuenca del Alto Atoyac. Prototipo para el HackaTec 2026,
              reto SECIHTI Puebla. No es un sitio oficial del Gobierno de México.</p>
          </div>
          <div>
            <p className="pie-titulo">Fuentes de datos</p>
            <ul>
              <li>CONAGUA, Red Nacional de Medición de Calidad del Agua, 2012 a 2025</li>
              <li>INEGI, Red hidrográfica 1:50 000 y DENUE</li>
            </ul>
          </div>
          <div>
            <p className="pie-titulo">Diseño</p>
            <p>Aspecto del kit gob.mx v3, el mismo de la app ciudadana y de SIGRIV: Montserrat y Noto Sans, guinda y dorado.</p>
          </div>
        </div>
      </footer>
      <Tooltip />
    </>
  );
}

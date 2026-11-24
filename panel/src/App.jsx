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
const SECCIONES = [['monitoreo', 'Monitoreo del prototipo'], ['reportes', 'Reportes ciudadanos']];
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
      <header className="cabecera">
        <div className="contenedor cabecera-fila">
          <div>
            <p className="sobretitulo">Monitoreo del río Atoyac</p>
            <h1>Panel de autoridad</h1>
          </div>
          <p className={claseConexion}>{conexion}</p>
        </div>
        <nav className="secciones contenedor" aria-label="Paneles">
          {SECCIONES.map(([id, nombre]) => (
            <button key={id} className={seccion === id ? 'activa' : ''} onClick={() => setSeccion(id)} aria-current={seccion === id ? 'page' : undefined}>
              {nombre} {conteoSeccion[id] > 0 && <span>({conteoSeccion[id]})</span>}
            </button>
          ))}
        </nav>
      </header>

      {seccion === 'monitoreo' && (
        <nav className="subnav" aria-label="Vistas del monitoreo">
          <div className="contenedor">
            {VISTAS.map(([id, nombre]) => (
              <button key={id} className={vista === id ? 'activa' : ''} onClick={() => setVista(id)} aria-current={vista === id ? 'page' : undefined}>
                {nombre} {conteo[id] > 0 && <span>({conteo[id]})</span>}
              </button>
            ))}
          </div>
        </nav>
      )}

      {demo && be.capturado && (
        <p className="aviso-motor">
          Demostración: datos reales del motor de reglas capturados el {hora(be.capturado)} sobre el escenario de
          descarga industrial. Los cambios de estado y responsable no se guardan.
        </p>
      )}
      {!demo && be.motor === 'stub' && (
        <p className="aviso-motor">
          Motor de reglas provisional: genera alertas sin discriminar eventos reales. Arranca el backend con
          --motor real para ver el análisis de verdad.
        </p>
      )}

      <main className="contenedor">
        {error && <p className="mensaje">No se pudieron leer los datos del panel ({error}). Corre npm run datos.</p>}
        {!ctx && !error && <p className="vacio centro">Cargando.</p>}
        {ctx && (
          <Datos.Provider value={ctx}>
            {seccion === 'monitoreo' && vista === 'alertas' && (
              <section className="vista">
                <Resumen alertas={be.alertas} veredictos={be.veredictos} totalEstaciones={codigos.length} corte={corte} />
                <Panorama alertas={be.alertas} veredictos={be.veredictos} corte={corte} />
                <TablaEstaciones alertas={be.alertas} veredictos={be.veredictos} elegida={filtros.estacion}
                  onElegir={(c) => setFiltros({ ...filtros, estacion: c })} />
                <div className="trabajo">
                  <ListaAlertas alertas={be.alertas} filtros={filtros} setFiltros={setFiltros} sel={sel}
                    onElegir={elegirAlerta} conectado={be.conectado} />
                  <Expediente alerta={alerta} veredictos={alerta ? be.veredictos[alerta.c_estacion] : []}
                    motor={be.motor} guardar={be.guardar} prediccion={be.prediccion} demo={demo} />
                </div>
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
        <div className="contenedor">
          Datos históricos: CONAGUA, Red Nacional de Medición de Calidad del Agua. Red hidrográfica: INEGI 1:50 000.
          Colores y tipografía: Sistema Nacional de Diseño, tema guinda.
        </div>
      </footer>
      <Tooltip />
    </>
  );
}

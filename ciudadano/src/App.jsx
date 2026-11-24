import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backendVivo, datosFijos, enviarReporte, origenBackend } from './lib/backend.js';
import { cola, folios, guardarFolio, quitarDeCola } from './lib/almacen.js';
import NavBar from './components/NavBar.jsx';
import MapaPage from './components/MapaPage.jsx';
import Rastreo from './components/Rastreo.jsx';
import Terminos from './components/Terminos.jsx';

const PANTALLAS = ['mapa', 'rastreo', 'terminos'];
const desdeHash = () => {
  const p = window.location.hash.replace(/^#\/?/, '');
  return PANTALLAS.includes(p) ? p : 'mapa';
};

export default function App() {
  const origen = useMemo(origenBackend, []);
  const [pantalla, setPantalla] = useState(desdeHash);
  const [datos, setDatos] = useState(null);
  const [conectado, setConectado] = useState(origen.modo === 'demo' ? false : null);
  const [pendientes, setPendientes] = useState(() => cola().length);
  const enviando = useRef(false);

  const ir = useCallback((p) => { window.location.hash = '/' + (p === 'mapa' ? '' : p); }, []);
  useEffect(() => {
    const f = () => setPantalla(desdeHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => { datosFijos().then(setDatos).catch(() => {}); }, []);

  const comprobar = useCallback(() => backendVivo(origen).then((ok) => { setConectado(ok); return ok; }), [origen]);
  useEffect(() => { comprobar(); }, [comprobar]);

  // Vacía la cola: lo guardado sin señal se manda al volver la conexión.
  const vaciarCola = useCallback(async () => {
    if (enviando.current || origen.modo !== 'api') return;
    enviando.current = true;
    for (const item of cola()) {
      const r = await enviarReporte(origen, item.payload);
      if (r.ok) { quitarDeCola(item.id); guardarFolio(r.c_reporte, item.payload.tipo, item.payload.fecha_hora); setConectado(true); }
      else if (!r.reintentable) quitarDeCola(item.id);   // el contrato lo rechaza: reintentar no sirve
      else break;
    }
    enviando.current = false;
    setPendientes(cola().length);
  }, [origen]);
  useEffect(() => { if (conectado) vaciarCola(); }, [conectado, vaciarCola, pendientes]);

  // Al volver la señal (evento online) o, mientras haya reportes esperando, cada 20 s.
  const reintentar = useCallback(() => comprobar().then((ok) => { if (ok) vaciarCola(); }), [comprobar, vaciarCola]);
  useEffect(() => {
    window.addEventListener('online', reintentar);
    return () => window.removeEventListener('online', reintentar);
  }, [reintentar]);
  useEffect(() => {
    if (!pendientes || origen.modo !== 'api') return undefined;
    const t = setInterval(reintentar, 20000);
    return () => clearInterval(t);
  }, [pendientes, origen, reintentar]);

  return (
    <div className="app-shell">
      <NavBar pantalla={pantalla} ir={ir} />
      <main className="app-main">
        {pantalla === 'mapa' && <MapaPage origen={origen} datos={datos} conectado={conectado} pendientes={pendientes} setPendientes={setPendientes} ir={ir} />}
        {pantalla === 'rastreo' && <Rastreo origen={origen} datos={datos} folioInicial={folios()[0]?.c_reporte || ''} />}
        {pantalla === 'terminos' && <Terminos ir={ir} />}
      </main>
    </div>
  );
}

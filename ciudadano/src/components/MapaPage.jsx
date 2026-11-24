import React, { useCallback, useEffect, useRef, useState } from 'react';
import Mapa from './Mapa.jsx';
import Toast from './Toast.jsx';
import FormularioReporte from './FormularioReporte.jsx';
import FichaReporte from './FichaReporte.jsx';
import { TerminosGate } from './Terminos.jsx';
import { avisoAceptado } from '../lib/almacen.js';
import { fotoDemo, getJSON } from '../lib/backend.js';
import { dentroDeVentana, haversine, posicion, textoErrorUbicacion } from '../lib/ubicacion.js';

const REFRESCO_MS = 60000;

// Pantalla principal, como SIGRIV: mapa a pantalla completa con el pin al centro, «Ubicarme» y «Generar Reporte».
export default function MapaPage({ origen, datos, conectado, pendientes, setPendientes, ir }) {
  const mapa = useRef(null);
  const centro = useRef(null);
  const gps = useRef(null);                       // última posición GPS; vale mientras el pin no se aleje
  const [reportes, setReportes] = useState([]);
  const [huella, setHuella] = useState(null);
  const [hoja, setHoja] = useState(null);         
  const [aviso, setAviso] = useState(null);
  const [terminos, setTerminos] = useState(avisoAceptado);
  const [tick, setTick] = useState(0);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Los pines de reportes son informativos: si falla la carga, el mapa sigue siendo usable
  useEffect(() => {
    let vigente = true;
    const carga = origen.modo === 'demo' ? fotoDemo().then((f) => f.reportes || []) : getJSON(origen.url + '/reportes').then((j) => j.reportes || []);
    carga.then((r) => vigente && setReportes(r)).catch(() => {});
    // La huella de calor la calcula el backend; en demostración o sin ruta simplemente no hay
    if (origen.modo === 'api') getJSON(origen.url + '/huella').then((h) => vigente && setHuella(h)).catch(() => {});
    return () => { vigente = false; };
  }, [origen, tick, conectado]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESCO_MS);
    return () => clearInterval(t);
  }, []);

  const ubicarme = () => {
    setAviso({ tipo: 'info', texto: 'Buscando tu ubicación… puedes seguir usando el mapa.' });
    posicion().then((p) => {
      if (!dentroDeVentana(p.lat, p.lon)) {
        setAviso({ tipo: 'danger', texto: 'Tu ubicación está fuera de la cuenca del Alto Atoyac (Puebla y Tlaxcala). Mueve el mapa hasta el río que quieres reportar.' });
        return;
      }
      gps.current = p;
      setAviso(null);
      mapa.current?.volarA(p.lat, p.lon, 16);
    }).catch((e) => setAviso({ tipo: 'danger', texto: textoErrorUbicacion[e.codigo] || textoErrorUbicacion.sin_senal }));
  };

  const generar = () => {
    if (!centro.current) return;
    setHoja({ tipo: 'form', ...centro.current });
  };

  const precision = (c) => (gps.current && haversine(c.lat, c.lon, gps.current.lat, gps.current.lon) < 50 ? gps.current.precision : null);

  const banda = origen.modo === 'demo' ? 'Datos de demostración: los reportes no se envían.'
    : conectado === false ? 'Sin conexión: tus reportes se guardan y se envían cuando vuelva la señal.'
      : pendientes > 0 ? pendientes + (pendientes === 1 ? ' reporte espera' : ' reportes esperan') + ' su envío.' : null;

  return (
    <div className="map-container">
      {!terminos && <TerminosGate onAceptar={() => setTerminos(true)} />}
      {banda && <div className="banda" role="status">{banda}</div>}

      <Mapa
        ref={mapa}
        cuenca={datos && datos.cuenca}
        huella={huella}
        reportes={reportes}
        onCentro={(c) => { centro.current = c; }}
        onUsuarioMovio={() => {}}
        onReporte={(reporte) => setHoja({ tipo: 'reporte', reporte })}
        onError={() => setAviso({ tipo: 'danger', texto: 'No se pudo cargar el mapa. Revisa tu conexión.' })}
      />

      <div className="map-marker-container">
        <div className="map-marker-tooltip">Ubica el problema aquí</div>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--gob-guinda)" stroke="var(--gob-dorado)" strokeWidth="1" aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
        </svg>
      </div>

      <button className="btn-ubicarme" onClick={ubicarme}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gob-guinda)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" /><path d="M19 12h2M3 12h2M12 19v2M12 3v2" />
        </svg>
        Ubicarme
      </button>
      <Toast aviso={aviso} onClose={cerrarAviso} />

      <button className="btn-generar-reporte" onClick={generar}>
        <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
          <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z" />
        </svg>
        Generar Reporte
      </button>

      {hoja && hoja.tipo === 'form' && (
        <FormularioReporte lat={hoja.lat} lon={hoja.lon} precision={precision(hoja)} origen={origen} datos={datos}
          onClose={() => setHoja(null)} onEnviado={() => setTick((n) => n + 1)} onPendiente={() => setPendientes((n) => n + 1)} ir={ir} />
      )}
      {hoja && hoja.tipo === 'reporte' && <FichaReporte reporte={hoja.reporte} onClose={() => setHoja(null)} />}
    </div>
  );
}

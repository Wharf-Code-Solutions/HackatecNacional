import React, { useCallback, useEffect, useRef, useState } from 'react';
import Mapa from './Mapa.jsx';
import Toast from './Toast.jsx';
import FormularioReporte from './FormularioReporte.jsx';
import FichaReporte from './FichaReporte.jsx';
import Emergencia, { Telefono } from './Emergencia.jsx';
import Alarma from './Alarma.jsx';
import { modoAlarma, RADIO_M, suena, yaEligio } from '../lib/alarma.js';
import PreguntaAlarma from './PreguntaAlarma.jsx';
import { TerminosGate } from './Terminos.jsx';
import { avisoAceptado } from '../lib/almacen.js';
import { fotoDemo, getJSON } from '../lib/backend.js';
import { dentroDeArea, haversine, posicion, TEXTO_FUERA, textoErrorUbicacion } from '../lib/ubicacion.js';

const REFRESCO_MS = 60000;

// Alarma de deslave: mientras la app está abierta, pide cada ALARMA_MS las alertas de ladera abiertas y suena con las
// que no había visto y que deben sonar (lib/alarma.js: el movimiento de la ladera desde su aviso, y lo Crítico), si su
// estación queda cerca de la persona o si eligió «toda la cuenca». Lo que ya estaba abierto al abrir la app no suena.
// Se compara por folio, no por hora: el simulador corre más rápido que el reloj y la hora de sus alertas no es la real.
// Cada 3 s: entre el aviso y el derrumbe hay poco tiempo. Sin la app abierta no suena: eso pediría notificaciones push.
const ALARMA_MS = 3000;

// Preferencia de ver los ríos, solo de este teléfono. Si el navegador no deja guardar, se ven.
const CLAVE_RIOS = 'atoyac.rios';
const leerRios = () => { try { return localStorage.getItem(CLAVE_RIOS) !== 'no'; } catch { return true; } };
const guardarRios = (v) => { try { localStorage.setItem(CLAVE_RIOS, v ? 'si' : 'no'); } catch { /* sin almacenamiento */ } };

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
  const [preguntar, setPreguntar] = useState(() => !yaEligio());
  const [tick, setTick] = useState(0);
  const [rios, setRios] = useState(leerRios);
  const [punto, setPunto] = useState(null);       // centro del mapa, para saber si ahí se puede reportar
  // Tras enviar, el pin nuevo queda justo bajo el marcador central (el reporte se hace en el centro): el marcador se
  // oculta hasta que la persona mueva el mapa, para que vea su reporte en su lugar.
  const [recienEnviado, setRecienEnviado] = useState(false);
  const [alarma, setAlarma] = useState(null);     // { alerta, estacion, recibida }
  const area = datos && datos.area;
  const fuera = punto ? !dentroDeArea(area, punto.lat, punto.lon) : false;
  const alternarRios = () => setRios((v) => { guardarRios(!v); return !v; });
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Los pines de reportes son informativos: si falla la carga, el mapa sigue siendo usable.
  // Se vuelven a pedir cada minuto y cuando regresa la conexión; no cuando la primera comprobación
  // confirma que hay backend (eso duplicaba las dos peticiones al abrir).
  const conectadoAntes = useRef(conectado);
  const [recargaPorConexion, setRecargaPorConexion] = useState(0);
  useEffect(() => {
    if (conectado === true && conectadoAntes.current === false) setRecargaPorConexion((n) => n + 1);
    conectadoAntes.current = conectado;
  }, [conectado]);
  useEffect(() => {
    let vigente = true;
    const carga = origen.modo === 'demo' ? fotoDemo().then((f) => f.reportes || []) : getJSON(origen.url + '/reportes').then((j) => j.reportes || []);
    carga.then((r) => vigente && setReportes(r)).catch(() => {});
    // La huella de calor la calcula el backend; en demostración o sin ruta simplemente no hay
    if (origen.modo === 'api') getJSON(origen.url + '/huella').then((h) => vigente && setHuella(h)).catch(() => {});
    return () => { vigente = false; };
  }, [origen, tick, recargaPorConexion]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESCO_MS);
    return () => clearInterval(t);
  }, []);

  // Alarma de deslave (ver ALARMA_MS arriba)
  const vistas = useRef(null);                    // folios ya vistos; null hasta la primera consulta
  useEffect(() => {
    if (origen.modo !== 'api' || !datos) return undefined;
    let vigente = true;
    const revisar = () => getJSON(origen.url + '/alertas?abiertas=1&modulo=ladera').then((j) => {
      if (!vigente) return;
      const modo = modoAlarma();                  // se lee cada vez: el interruptor de Emergencia la cambia
      const todas = modo === 'todas';
      const lista = (j.alertas || []).filter(suena);
      if (vistas.current === null) { vistas.current = new Set(lista.map((a) => a.c_alerta)); return; }
      const nuevas = lista.filter((a) => !vistas.current.has(a.c_alerta));
      nuevas.forEach((a) => vistas.current.add(a.c_alerta));
      if (modo === 'no') return;                  // apagada: se marcan como vistas y no suenan
      const yo = gps.current || centro.current;
      const cerca = nuevas.filter((a) => {
        const e = datos.estaciones && datos.estaciones[a.c_estacion];
        if (todas) return true;
        return e && yo && haversine(yo.lat, yo.lon, e.latitud, e.longitud) <= RADIO_M;
      });
      if (cerca.length) {
        // Si llegan varias juntas, la más grave: que la ladera cedió pesa más que el aviso de movimiento
        const a = cerca.find((x) => x.nivel === 'Critica') || cerca[cerca.length - 1];
        setAlarma({ alerta: a, estacion: datos.estaciones && datos.estaciones[a.c_estacion], recibida: new Date() });
      }
    }).catch(() => {});
    revisar();
    const t = setInterval(revisar, ALARMA_MS);
    return () => { vigente = false; clearInterval(t); };
  }, [origen, datos]);

  const verAlarma = () => {
    const e = alarma && alarma.estacion;
    setAlarma(null);
    // El pulso cae en el centro del mapa: se oculta el marcador central hasta que la persona mueva el mapa
    if (e) { mapa.current?.marcarAlarma(e.latitud, e.longitud); mapa.current?.volarA(e.latitud, e.longitud, 15); setRecienEnviado(true); }
  };

  const ubicarme = () => {
    setAviso({ tipo: 'info', texto: 'Buscando tu ubicación… puedes seguir usando el mapa.' });
    posicion().then((p) => {
      if (!dentroDeArea(area, p.lat, p.lon)) {
        setAviso({ tipo: 'danger', texto: 'Tu ubicación está fuera de Puebla. ' + TEXTO_FUERA.split('. ')[1] });
        return;
      }
      gps.current = p;
      setAviso(null);
      mapa.current?.volarA(p.lat, p.lon, 16);
    }).catch((e) => setAviso({ tipo: 'danger', texto: textoErrorUbicacion[e.codigo] || textoErrorUbicacion.sin_senal }));
  };

  const generar = () => {
    if (!centro.current || fuera) return;
    setRecienEnviado(false);
    setHoja({ tipo: 'form', ...centro.current });
  };

  const precision = (c) => (gps.current && haversine(c.lat, c.lon, gps.current.lat, gps.current.lon) < 50 ? gps.current.precision : null);

  const banda = origen.modo === 'demo' ? 'Datos de demostración: los reportes no se envían.'
    : conectado === false ? 'Sin conexión: tus reportes se guardan y se envían cuando vuelva la señal.'
      : pendientes > 0 ? pendientes + (pendientes === 1 ? ' reporte espera' : ' reportes esperan') + ' su envío.' : null;

  return (
    <div className="map-container">
      {!terminos && <TerminosGate onAceptar={() => setTerminos(true)} />}
      {terminos && preguntar && origen.modo === 'api' && <PreguntaAlarma onListo={() => setPreguntar(false)} />}
      {banda && <div className="banda" role="status">{banda}</div>}

      <Mapa
        ref={mapa}
        cuenca={datos && datos.cuenca}
        huella={huella}
        reportes={reportes}
        rios={rios}
        onCentro={(c) => { centro.current = c; setPunto(c); }}
        onUsuarioMovio={() => setRecienEnviado(false)}
        onReporte={(reporte) => setHoja({ tipo: 'reporte', reporte })}
        onError={() => setAviso({ tipo: 'danger', texto: 'No se pudo cargar el mapa. Revisa tu conexión.' })}
      />

      {!recienEnviado && <div className="map-marker-container">
        <div className="map-marker-tooltip">Ubica el problema aquí</div>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--gob-guinda)" stroke="var(--gob-dorado)" strokeWidth="1" aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
        </svg>
      </div>}

      <button className="btn-ubicarme" onClick={ubicarme}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gob-guinda)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" /><path d="M19 12h2M3 12h2M12 19v2M12 3v2" />
        </svg>
        Ubicarme
      </button>
      <button className={'btn-capa' + (rios ? ' activo' : '')} onClick={alternarRios} aria-pressed={rios}
        title={rios ? 'Ocultar los ríos' : 'Mostrar los ríos'} aria-label={rios ? 'Ocultar los ríos' : 'Mostrar los ríos'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0" />
        </svg>
      </button>
      <button className="btn-emergencia" onClick={() => setHoja({ tipo: 'emergencia' })} title="Emergencia" aria-label="Emergencia">
        <Telefono />
      </button>
      <Toast aviso={aviso} onClose={cerrarAviso} />

      {fuera && <div className="aviso-fuera" role="status">Fuera de Puebla: aquí no se puede reportar</div>}
      <button className="btn-generar-reporte" onClick={generar} disabled={fuera} aria-disabled={fuera}>
        <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
          <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z" />
        </svg>
        Generar Reporte
      </button>

      {hoja && hoja.tipo === 'form' && (
        <FormularioReporte lat={hoja.lat} lon={hoja.lon} precision={precision(hoja)} origen={origen} datos={datos}
          onClose={() => setHoja(null)} onEnviado={() => { setTick((n) => n + 1); setRecienEnviado(true); }} onPendiente={() => setPendientes((n) => n + 1)} ir={ir} />
      )}
      {alarma && <Alarma {...alarma} onVer={verAlarma} onClose={() => setAlarma(null)} />}
      {hoja && hoja.tipo === 'emergencia' && <Emergencia punto={punto} onClose={() => setHoja(null)} alarmaActiva={origen.modo === 'api'} />}
      {hoja && hoja.tipo === 'reporte' && <FichaReporte reporte={hoja.reporte} onClose={() => setHoja(null)} />}
    </div>
  );
}

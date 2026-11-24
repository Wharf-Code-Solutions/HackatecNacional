// Hooks de datos del panel.
//
// Frontera (M7): el panel no evalúa nada. Nivel, regla, fuente y posición en la banda llegan
// del backend por el contrato. Por su cuenta solo lee tablas publicadas (copiadas a
// public/datos/ por scripts/copiar-datos.mjs).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { leeCSV } from './formato.js';

const CADA_MS = 3000;

// Dónde está el backend:
//  ?api=http://host:puerto   en la URL (útil para probar)
//  VITE_API_URL             en la configuración del despliegue
//  en desarrollo            el mock local, http://127.0.0.1:8080
//  en producción sin nada   modo demostración con la foto de public/demo/foto.json
function origenBackend() {
  const q = new URLSearchParams(window.location.search).get('api');
  if (q) return { modo: 'api', url: q.replace(/\/$/, '') };
  const env = import.meta.env.VITE_API_URL;
  if (env) return { modo: 'api', url: env.replace(/\/$/, '') };
  if (import.meta.env.DEV) return { modo: 'api', url: 'http://127.0.0.1:8080' };
  return { modo: 'demo', url: null };
}

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

export function useDatosFijos() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const base = import.meta.env.BASE_URL + 'datos/';
    Promise.all([
      getJSON(base + 'estaciones.json'),
      getJSON(base + 'linea_base.json'),
      fetch(base + 'sitio_aguas_abajo.csv').then((r) => r.text()),
      fetch(base + 'sitio_pares.csv').then((r) => r.text()),
    ]).then(([est, lb, abajo, pares]) => {
      const estaciones = Object.fromEntries(est.estaciones.map((e) => [e.c_estacion, e]));
      const lineaBase = {};
      lb.linea_base.forEach((r) => {
        if (r.temporada !== 'anual') return;
        (lineaBase[r.c_sitio] = lineaBase[r.c_sitio] || {})[r.c_parametro] = r;
      });
      const nombresSitio = Object.fromEntries(leeCSV(abajo).map((r) => [r.c_sitio, r.nombre]));
      const listaPares = leeCSV(pares).map((r) => ({
        arriba: r.c_sitio_arriba, abajo: r.c_sitio_abajo, m: parseFloat(r.distancia_cauce_m), revisar: r.revisar,
      }));
      setDatos({ estaciones, lineaBase, nombresSitio, pares: listaPares });
    }).catch((e) => setError(e.message));
  }, []);
  return { datos, error };
}

export function useBackend(codigos) {
  const origen = useMemo(origenBackend, []);
  const [estado, setEstado] = useState({
    conectado: null, motor: null, alertas: [], reportes: [], veredictos: {}, capturado: null,
  });
  const clave = codigos.join(',');
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  useEffect(() => {
    if (!codigos.length) return undefined;
    if (origen.modo === 'demo') {
      getJSON(import.meta.env.BASE_URL + 'demo/foto.json').then((f) => {
        if (!vivo.current) return;
        setEstado({ conectado: true, motor: f.salud.motor, alertas: f.alertas, reportes: f.reportes,
          veredictos: f.veredictos, capturado: f.capturado });
      }).catch(() => setEstado((s) => ({ ...s, conectado: false })));
      return undefined;
    }
    let cancelado = false;
    const consulta = () => Promise.all([
      getJSON(origen.url + '/salud'),
      getJSON(origen.url + '/alertas'),
      getJSON(origen.url + '/reportes'),
      Promise.all(codigos.map((c) => getJSON(origen.url + '/veredictos?c_estacion=' + encodeURIComponent(c)))),
    ]).then(([salud, al, rep, ver]) => {
      if (cancelado) return;
      const veredictos = {};
      // Si el backend no filtra por estación, se reparte aquí; solo es reparto, no análisis.
      codigos.forEach((c, i) => { veredictos[c] = (ver[i].veredictos || []).filter((v) => v.c_estacion === c); });
      setEstado((s) => ({ ...s, conectado: true, motor: salud.motor, alertas: al.alertas || [],
        reportes: rep.reportes || [], veredictos }));
    }).catch(() => { if (!cancelado) setEstado((s) => ({ ...s, conectado: false })); });
    consulta();
    const id = setInterval(consulta, CADA_MS);
    return () => { cancelado = true; clearInterval(id); };
  }, [clave, origen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cambia estado y responsable. En demostración solo se cambia en esta pestaña.
  const guardar = useCallback(async (c_alerta, cambios) => {
    let nueva;
    if (origen.modo === 'demo') {
      nueva = cambios;
    } else {
      const r = await fetch(origen.url + '/alertas/' + encodeURIComponent(c_alerta), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error + (cuerpo.detalles ? ': ' + cuerpo.detalles.join('; ') : ''));
      nueva = cuerpo;
    }
    setEstado((s) => ({ ...s, alertas: s.alertas.map((a) => (a.c_alerta === c_alerta ? { ...a, ...nueva } : a)) }));
    return { ...nueva };
  }, [origen]);

  return { ...estado, origen, guardar };
}

// Ancho real de un elemento, para dibujar las gráficas a su tamaño (el texto no se encoge).
// Devuelve una ref de función: si el componente cambia de elemento (de "sin datos" a la
// gráfica), se observa el nuevo.
export function useAncho(minimo = 260) {
  const [el, setEl] = useState(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, Math.max(minimo, ancho || minimo)];
}

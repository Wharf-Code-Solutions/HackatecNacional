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

// El reto pide el Alto Atoyac: solo escuelas de Puebla (CCT 21...) dentro de sus cuatro subcuencas, las mismas
// que usa el modulo A para colocar los mecanismos (scripts/_comun.py, SUBCUENCAS_ALTO_ATOYAC), leidas de
// datos/procesados/mapa/subcuencas.geojson. La cuenca RH18A completa (cuenca.geojson) es mas grande: incluye
// Nexapa, Mixteco, Acatlan y el Atoyac aguas abajo. Punto en poligono por paridad de cruces.
const SUBCUENCAS_ALTO_ATOYAC = ['RH18Ad', 'RH18Ai', 'RH18Aj', 'RH18Ac'];   // Texmelucan, Zahuapan, Alseseca, Valsequillo
function dentroDe(anillo, x, y) {
  let r = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
function anillosDe(geo) {
  return ((geo && geo.features) || []).filter((f) => SUBCUENCAS_ALTO_ATOYAC.includes((f.properties || {}).clave))
    .flatMap((f) => {
      const g = f.geometry;
      if (!g) return [];
      return g.type === 'MultiPolygon' ? g.coordinates.map((q) => q[0]) : [g.coordinates[0]];
    });
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
      getJSON(base + 'sitios.geojson'),
      getJSON(base + 'rios.json'),
      // Escuelas y zonas (docs/19 §4): si faltan, el panel sigue con listas vacias.
      getJSON(base + 'escuelas.json').catch(() => []),
      getJSON(base + 'zonas_riesgo.geojson').catch(() => ({ type: 'FeatureCollection', features: [] })),
      getJSON(base + 'subcuencas.geojson').catch(() => null),
      getJSON(base + 'mecanismos.json').catch(() => ({ estaciones: [] })),
      getJSON(base + 'umbrales_lluvia.json').catch(() => ({})),
      getJSON(base + 'suelo_laderas.json').catch(() => ({})),
      getJSON(base + 'lluvia_sitios.json').catch(() => ({})),
    ]).then(([est, lb, abajo, pares, geo, rios, esc, zonas, cuenca, mec, uLluvia, suelo, lluviaSitios]) => {
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
      // Coordenadas de los 219 sitios oficiales, para el mapa y la pluma.
      const sitios = Object.fromEntries(geo.features.map((f) => [f.properties.c_sitio,
        { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], nombre: f.properties.nombre, municipio: f.properties.municipio }]));
      const anillos = anillosDe(cuenca);
      const escuelas = (Array.isArray(esc) ? esc : esc.escuelas || []).filter((e) => e && e.cct
        && String(e.cct).startsWith('21') && e.longitud != null && e.latitud != null
        && (!anillos.length || anillos.some((a) => dentroDe(a, e.longitud, e.latitud))));
      // Mecanismos junto a escuelas (EST-ESC-xx, del modulo A): para nombrar su estacion y saber que escuelas protege.
      const mecanismos = Object.fromEntries((mec.estaciones || []).map((m) => [m.c_estacion, m]));
      // Umbrales de ladera, leídos igual que el motor (motor/reglas.py, cargar_umbrales_ladera): no se inventan.
      const num = (x) => (typeof x === 'number' ? x : null);
      const niv = Object.fromEntries(((uLluvia.lluvia || {}).niveles || []).map((n) => [n.nivel, n]));
      const p99 = Object.fromEntries((lluviaSitios.sitios || []).filter((x) => x.c_estacion).map((x) => {
        const t = x.temporada || {};
        return [x.c_estacion, [num((t.lluvia_diaria_dia_con_lluvia_mm || {}).p99), num((t.lluvia_3_dias_mm || {}).p99)]];
      }));
      const humedad = Object.fromEntries((suelo.laderas || []).map((x) => [x.c_estacion, x.umbral_cerca_saturacion_pct + (x.correccion_sensor_pct || 0)]));
      const inc = uLluvia.inclinacion || {};
      const umbralesLadera = {
        lluvia: { Preventiva: [num((niv.Preventiva || {}).acumulada_24h_mm), num((niv.Preventiva || {}).acumulada_72h_mm)],
          Critica: [num((niv.Critica || {}).acumulada_24h_mm), num((niv.Critica || {}).acumulada_72h_mm)] },
        p99, humedad, humedadPorDefecto: num((uLluvia.humedad_suelo || {}).cerca_de_saturacion_pct) ?? 45,
        inclinacion: { aviso: num(inc.aviso_grados) ?? 0.5, critico: num(inc.critico_grados) ?? 2 },
      };
      setDatos({ estaciones, lineaBase, nombresSitio, pares: listaPares, sitios, rios: rios.lineas, escuelas, zonas, mecanismos, umbralesLadera });
    }).catch((e) => setError(e.message));
  }, []);
  return { datos, error };
}

export function useBackend(codigos) {
  const origen = useMemo(origenBackend, []);
  const [estado, setEstado] = useState({
    conectado: null, motor: null, alertas: [], reportes: [], prioridades: null, huella: null, veredictos: {}, capturado: null,
  });
  const [version, setVersion] = useState(0);   // sube al cambiar un reporte: vuelve a pedir prioridades y huella
  const clave = codigos.join(',');
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  useEffect(() => {
    if (!codigos.length) return undefined;
    if (origen.modo === 'demo') {
      getJSON(import.meta.env.BASE_URL + 'demo/foto.json').then((f) => {
        if (!vivo.current) return;
        setEstado({ conectado: true, motor: f.salud.motor, alertas: f.alertas, reportes: f.reportes,
          veredictos: f.veredictos, capturado: f.capturado, predicciones: f.predicciones || {},
          prioridades: f.prioridades || null, huella: f.huella || null });
      }).catch(() => setEstado((s) => ({ ...s, conectado: false })));
      return undefined;
    }
    let cancelado = false;
    const consulta = () => Promise.all([
      getJSON(origen.url + '/salud'),
      getJSON(origen.url + '/alertas'),
      getJSON(origen.url + '/reportes'),
      getJSON(origen.url + '/prioridades').catch(() => null),   // opcional: un backend sin la ruta no rompe el panel
      getJSON(origen.url + '/huella').catch(() => null),
      Promise.all(codigos.map((c) => getJSON(origen.url + '/veredictos?c_estacion=' + encodeURIComponent(c)))),
    ]).then(([salud, al, rep, pri, hue, ver]) => {
      if (cancelado) return;
      const veredictos = {};
      // Si el backend no filtra por estación, se reparte aquí; solo es reparto, no análisis.
      codigos.forEach((c, i) => { veredictos[c] = (ver[i].veredictos || []).filter((v) => v.c_estacion === c); });
      setEstado((s) => ({ ...s, conectado: true, motor: salud.motor, alertas: al.alertas || [],
        reportes: rep.reportes || [], prioridades: pri ? pri.prioridades : null, huella: hue, veredictos }));
    }).catch(() => { if (!cancelado) setEstado((s) => ({ ...s, conectado: false })); });
    // La siguiente consulta sale CADA_MS después de que terminó la anterior, no cada CADA_MS fijo: con
    // setInterval, si el backend tardaba más de 3 s (Vercel en frío, red lenta), las 10 peticiones de cada
    // vuelta se amontonaban y la fila crecía hasta ~36 s por respuesta. Con la pestaña oculta no se consulta.
    let espera = null, enCurso = false;
    const ciclo = () => {
      clearTimeout(espera);
      if (cancelado || enCurso) return;
      if (document.hidden) { espera = setTimeout(ciclo, CADA_MS); return; }
      enCurso = true;
      consulta().finally(() => { enCurso = false; if (!cancelado) espera = setTimeout(ciclo, CADA_MS); });
    };
    ciclo();
    const alVolver = () => { if (!document.hidden) ciclo(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { cancelado = true; clearTimeout(espera); document.removeEventListener('visibilitychange', alVolver); };
  }, [clave, origen, version]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Cambia el estado de un reporte ciudadano (Recibido, Validado, En atencion, Cerrado, Descartado).
  // En demostracion solo se cambia en esta pestaña.
  // Devuelve lo que dijo el backend del aviso por correo (cabecera X-Aviso-Correo): 'enviado', 'sin_correo',
  // 'no_configurado', 'fallido' o 'no_aplica'; null si el backend no la manda (el mock) o en demostración.
  const guardarReporte = useCallback(async (c_reporte, estadoNuevo) => {
    let aviso = null;
    if (origen.modo !== 'demo') {
      const r = await fetch(origen.url + '/reportes/' + encodeURIComponent(c_reporte), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: estadoNuevo }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((cuerpo.error || 'error ' + r.status) + (cuerpo.detalles ? ': ' + cuerpo.detalles.join('; ') : ''));
      aviso = r.headers.get('X-Aviso-Correo');
    }
    setEstado((s) => ({ ...s, reportes: s.reportes.map((x) => (x.c_reporte === c_reporte ? { ...x, estado: estadoNuevo } : x)) }));
    return aviso;
  }, [origen]);
  const refrescar = useCallback(() => setVersion((n) => n + 1), []);

  // Propagacion aguas abajo de una alerta (M3), calculada por el backend. Una alerta no
  // cambia, asi que su prediccion se pide una vez. Devuelve { prediccion } o { motivo }.
  const cache = useRef({});
  const prediccion = useCallback(async (c_alerta) => {
    if (origen.modo === 'demo') {
      const p = (estado.predicciones || {})[c_alerta];
      return p ? { prediccion: p } : { motivo: 'La foto de demostración no trae la predicción de esta alerta.' };
    }
    if (cache.current[c_alerta]) return cache.current[c_alerta];
    let r;
    try {
      r = await fetch(origen.url + '/alertas/' + encodeURIComponent(c_alerta) + '/prediccion');
    } catch {
      return { motivo: 'Sin conexión con el backend.' };
    }
    if (r.status === 404) {
      const cuerpo = await r.json().catch(() => ({}));
      // El mock no tiene esta ruta; el backend real (M5) si.
      return { motivo: cuerpo.error === 'ruta no encontrada'
        ? 'Este backend no calcula la propagación: es el servidor de prueba. El backend real (M5) sí.'
        : 'El backend no encontró la alerta.' };
    }
    if (!r.ok) return { motivo: 'El backend respondió ' + r.status + ' al pedir la predicción.' };
    const res = { prediccion: await r.json() };
    cache.current[c_alerta] = res;
    return res;
  }, [origen, estado.predicciones]);

  return { ...estado, origen, guardar, guardarReporte, refrescar, prediccion };
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

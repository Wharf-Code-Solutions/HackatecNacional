import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
// Mapbox GL o MapLibre según VITE_MAPBOX_TOKEN, resuelto al compilar (alias de vite.config.js).
import bibliotecaMapa from 'biblioteca-mapa';
import 'biblioteca-mapa.css';

// Con VITE_MAPBOX_TOKEN usa Mapbox GL (streets-v12, como SIGRIV); sin token usa MapLibre con la base
// gratuita de OpenFreeMap. Las dos bibliotecas comparten la API, así que el resto del código es el mismo.
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ESTILO_LIBRE = 'https://tiles.openfreemap.org/styles/bright';

// Vista inicial: la cuenca del Alto Atoyac, Puebla y Tlaxcala
const INICIO = { center: [-98.2, 19.1], zoom: 8.6 };
// Sin maxBounds: con una caja alrededor de la cuenca, a zoom bajo la vista la llenaba y el mapa no se
// dejaba arrastrar con el ratón (y corregía el zoom solo); más margen solo mueve el problema a pantallas
// más anchas. Que el pin quede en la cuenca lo valida el formulario, y el mapa abre sobre ella.


// ------------------------------------------------------------------ ríos
// Los ríos del INEGI encima de la base, como en mapa/ (M6): en la base se pierde por dónde va el cauce
// y la persona tiene que poner el pin sobre él. Orden >= 4 al abrir; orden 3 (barrancas) solo se
// descarga al acercar. El flujo (guiones que corren aguas abajo) redibuja el mapa en cada cuadro, así
// que solo se anima muy de cerca, donde se elige el punto; más lejos no gasta nada.
const AGUA = '#1d6fa5';
const ZOOM_ORDEN3 = 12;
const ZOOM_FLUJO = 14;
const BASE = import.meta.env.BASE_URL;
const CAPAS_RIOS = ['rios', 'rios-flujo', 'rios3', 'rios3-flujo'];
const esCauceBase = (c) => c.type === 'line' && c['source-layer'] === 'waterway';
// Rótulos de la base que se amontonan con los ríos sin ayudar a ubicar el cauce: comercios, paradas de
// transporte, números de casa y aeropuertos. Se quedan calles, colonias, localidades y nombres de agua.
// (source-layer de OpenMapTiles y de Mapbox Streets)
const ROTULOS_FUERA = new Set(['poi', 'poi_label', 'housenumber', 'transit_stop_label', 'aerodrome_label', 'airport_label']);

function mostrarRios(m, visibles) {
  const v = visibles ? 'visible' : 'none';
  CAPAS_RIOS.forEach((id) => { if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', v); });
  // sin nuestros ríos vuelven los de la base, para que el mapa no se quede sin agua
  m.getStyle().layers.filter(esCauceBase).forEach((c) => m.setLayoutProperty(c.id, 'visibility', visibles ? 'none' : 'visible'));
}
const aLineas = (lineas, orden) => ({
  type: 'FeatureCollection',
  features: lineas.map((l) => ({
    type: 'Feature', properties: { orden: orden || l.o }, geometry: { type: 'LineString', coordinates: orden ? l : l.c },
  })),
});
// Grosor por orden y zoom: crece poco con el tamaño del río, como en mapa/, y engorda al acercar.
const anchoPorOrden = (k) => ['match', ['get', 'orden'], 7, 1.6 * k, 6, 1.3 * k, 5, 1.05 * k, 4, 0.85 * k, 0.6 * k];
const GROSOR = ['interpolate', ['linear'], ['zoom'], 7, anchoPorOrden(1), 10, anchoPorOrden(1.7), 13, anchoPorOrden(2.6), 17, anchoPorOrden(5)];

// Imagen del flujo: un guion blanco que se corre unos píxeles por cuadro (misma técnica que mapa/:
// cambiar la imagen solo sube 128 × 16 píxeles a la tarjeta gráfica).
function imagenFlujo(m, quieto) {
  const W = 128, H = 16, GUION = 44, PX_POR_S = 110;
  return {
    width: W, height: H, data: new Uint8Array(W * H * 4), dibujada: false,
    onAdd() {},
    render() {
      if (m.getZoom() < ZOOM_FLUJO || (quieto && this.dibujada)) return false;   // lejos: sin animar ni repintar
      const x0 = quieto ? 0 : Math.floor(performance.now() / 1000 * PX_POR_S) % W;
      for (let x = 0; x < W; x++) {
        const u = (x - x0 + W) % W;
        const a = u < GUION ? Math.round(235 * Math.min(1, u / 6, (GUION - u) / 6)) : 0;
        for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; this.data[i] = this.data[i + 1] = this.data[i + 2] = 255; this.data[i + 3] = a; }
      }
      this.dibujada = true;
      if (!quieto) m.triggerRepaint();
      return true;
    },
  };
}

function ponerRios(m, visibles) {
  // Los cauces de la base se apagan mientras se ven los nuestros (sus nombres se quedan): dos trazos del
  // mismo río no coinciden.
  for (const capa of m.getStyle().layers) {
    if (capa.type === 'symbol' && ROTULOS_FUERA.has(capa['source-layer'])) m.setLayoutProperty(capa.id, 'visibility', 'none');
  }
  mostrarRios(m, visibles());
  // Debajo de los rótulos de la base; la huella y los pines quedan encima.
  const antes = (m.getStyle().layers.find((c) => c.type === 'symbol') || {}).id;
  const linea = { 'line-cap': 'round', 'line-join': 'round' };
  const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  m.addImage('flujo', imagenFlujo(m, quieto), { pixelRatio: 2 });
  const guiones = { 'line-pattern': 'flujo', 'line-opacity': 0.9, 'line-width': GROSOR };

  // Se piden cuando la base ya terminó de dibujarse ('idle'): en una red lenta, bajarlos a la vez que
  // sus mosaicos retrasa el primer mapa completo.
  m.once('idle', () => fetch(BASE + 'datos/rios.json').then((r) => r.json()).then((d) => {
    if (!m.getStyle() || m.getSource('rios')) return;
    m.addSource('rios', { type: 'geojson', data: aLineas(d.lineas) });
    m.addLayer({ id: 'rios', type: 'line', source: 'rios', layout: linea, paint: { 'line-color': AGUA, 'line-opacity': 0.9, 'line-width': GROSOR } }, antes);
    m.addLayer({ id: 'rios-flujo', type: 'line', source: 'rios', minzoom: ZOOM_FLUJO, layout: { ...linea, 'line-cap': 'butt' }, paint: guiones }, antes);
    mostrarRios(m, visibles());
  }).catch(() => {}));   // sin ríos la app sigue: la base trae los suyos apagados, pero el pin y el reporte funcionan

  const orden3 = () => {
    if (m.getZoom() < ZOOM_ORDEN3) return;
    m.off('moveend', orden3);
    fetch(BASE + 'datos/rios_orden3.json').then((r) => r.json()).then((d) => {
      if (!m.getStyle() || m.getSource('rios3')) return;
      m.addSource('rios3', { type: 'geojson', data: aLineas(d.lineas, d.orden) });
      const debajo = m.getLayer('rios') ? 'rios' : antes;
      m.addLayer({ id: 'rios3', type: 'line', source: 'rios3', minzoom: ZOOM_ORDEN3, layout: linea,
        paint: { 'line-color': AGUA, 'line-opacity': 0.75, 'line-width': GROSOR } }, debajo);
      m.addLayer({ id: 'rios3-flujo', type: 'line', source: 'rios3', minzoom: ZOOM_FLUJO, layout: { ...linea, 'line-cap': 'butt' },
        paint: { ...guiones, 'line-opacity': 0.8 } }, debajo);
      mostrarRios(m, visibles());
    }).catch(() => m.on('moveend', orden3));   // sin red: se reintenta en el siguiente movimiento
  };
  m.on('moveend', orden3);
  orden3();
}

// El elemento que recibe el marcador queda sin estilos propios: la biblioteca lo posiciona con su
// position y transform. Si se le ponen rotación, escala o position, el pin se desplaza al hacer zoom.
function boton(clase, etiqueta, alClick) {
  const caja = document.createElement('div');
  const b = document.createElement('button');
  b.type = 'button'; b.className = clase; b.setAttribute('aria-label', etiqueta);
  b.addEventListener('click', (e) => { e.stopPropagation(); alClick(); });
  caja.appendChild(b);
  return caja;
}

const Mapa = forwardRef(function Mapa({ cuenca, huella, reportes, rios = true, onCentro, onUsuarioMovio, onReporte, onListo, onError }, ref) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const gl = useRef(null);
  const marcas = useRef([]);
  const alarmaMarca = useRef(null);
  const [lista, setLista] = useState(false);
  const cb = useRef({});
  cb.current = { onCentro, onUsuarioMovio, onReporte };
  const riosVisibles = useRef(rios);
  riosVisibles.current = rios;

  useImperativeHandle(ref, () => ({
    volarA(lat, lon, zoom = 16) { mapa.current?.flyTo({ center: [lon, lat], zoom, essential: true }); },
    // La estación de una alarma de deslave: un círculo rojo que late, uno a la vez
    marcarAlarma(lat, lon) {
      if (!mapa.current || !gl.current) return;
      alarmaMarca.current?.remove();
      const el = document.createElement('div');
      el.className = 'pulso-alarma';
      el.setAttribute('aria-label', 'Estación con alarma de deslave');
      alarmaMarca.current = new gl.current.Marker({ element: el }).setLngLat([lon, lat]).addTo(mapa.current);
    },
  }), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (!vivo) return;
        gl.current = bibliotecaMapa;
        if (TOKEN) gl.current.accessToken = TOKEN;
        const m = new gl.current.Map({
          container: contenedor.current,
          style: TOKEN ? 'mapbox://styles/mapbox/streets-v12' : ESTILO_LIBRE,
          center: INICIO.center, zoom: INICIO.zoom, minZoom: 6.5,
          attributionControl: true,
        });
        mapa.current = m;
        if (import.meta.env.DEV) window.mapaCiudadano = m;   // solo para pruebas en desarrollo
        m.on('movestart', (e) => { if (e.originalEvent) cb.current.onUsuarioMovio?.(); });
        m.on('moveend', () => { const c = m.getCenter(); cb.current.onCentro?.({ lat: c.lat, lon: c.lng }); });
        m.on('load', () => {
          const c = m.getCenter();
          cb.current.onCentro?.({ lat: c.lat, lon: c.lng });
          try { ponerRios(m, () => riosVisibles.current); } catch { /* una base sin capas de agua no debe tumbar el mapa */ }
          setLista(true);
          onListo?.(m);
        });
        m.on('error', (e) => { if (e && e.error && /style|token|401|403/i.test(String(e.error.message))) onError?.(); });
      } catch { onError?.(); }
    })();
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Botón «Ríos»: muestra u oculta la red del INEGI
  useEffect(() => {
    const m = mapa.current;
    if (m && lista) mostrarRios(m, rios);
  }, [rios, lista]);

  // Contorno de la cuenca
  useEffect(() => {
    const m = mapa.current;
    if (!m || !lista || !cuenca) return undefined;
    const poner = () => {
      if (m.getSource('cuenca')) return;
      m.addSource('cuenca', { type: 'geojson', data: cuenca });
      m.addLayer({ id: 'cuenca-linea', type: 'line', source: 'cuenca', paint: { 'line-color': '#9D2449', 'line-width': 2, 'line-opacity': 0.75, 'line-dasharray': [3, 2] } });
    };
    poner();
    return undefined;
  }, [cuenca, lista]);

  // Huella de calor (la calcula el backend, GET /huella). Agua: el propio río coloreado por la densidad de reportes.
  // Deslaves: una mancha de calor sobre el terreno (puntos con capa 'ladera'). Solo llega donde hay evidencia
  // suficiente; sin ella no se dibuja nada.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !lista) return;
    const datos = huella && huella.features ? huella : { type: 'FeatureCollection', features: [] };
    const fuente = m.getSource('huella');
    if (fuente) { fuente.setData(datos); return; }
    m.addSource('huella', { type: 'geojson', data: datos });
    m.addLayer({
      id: 'huella-ladera', type: 'heatmap', source: 'huella', filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'heatmap-weight': ['get', 'intensidad'],
        'heatmap-intensity': 3,
        // ~1.5 km de mancha a cualquier zoom: el radio va en píxeles y se duplica con cada nivel
        'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 8, 6, 12, 70, 16, 450],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(227,201,154,0)', 0.25, 'rgba(227,201,154,0.55)', 0.6, '#C2557A', 1, '#611232'],
        'heatmap-opacity': 0.8,
      },
    });
    m.addLayer({
      id: 'huella-linea', type: 'line', source: 'huella', filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['interpolate', ['linear'], ['get', 'intensidad'], 0, '#E3C99A', 0.5, '#C2557A', 1, '#611232'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 4, 16, 7],
        'line-opacity': 0.85,
      },
    });
  }, [huella, lista]);

  // Pines: reportes de otras personas, en su punto exacto (un deslave se ubica por metros, no por cuadra)
  useEffect(() => {
    const m = mapa.current;
    if (!m || !lista || !gl.current) return undefined;
    const pon = () => {
      marcas.current.forEach((x) => x.remove());
      marcas.current = [];
      (reportes || []).forEach((r) => {
        const cerrado = r.estado === 'Cerrado' || r.estado === 'Descartado';
        const el = boton('pin-publico ' + (cerrado ? 'pin-cerrado' : 'pin-abierto'), 'Reporte ciudadano', () => cb.current.onReporte?.(r));
        marcas.current.push(new gl.current.Marker({ element: el, anchor: 'bottom' }).setLngLat([r.longitud, r.latitud]).addTo(m));
      });
    };
    pon();
    return undefined;
  }, [reportes, lista]);

  return <div className="map-lienzo" ref={contenedor} />;
});

export default Mapa;

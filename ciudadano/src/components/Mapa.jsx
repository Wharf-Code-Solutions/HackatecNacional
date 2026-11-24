import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { VENTANA } from '../lib/ubicacion.js';

// Con VITE_MAPBOX_TOKEN usa Mapbox GL (streets-v12, como SIGRIV); sin token usa MapLibre con la base
// gratuita de OpenFreeMap. Las dos bibliotecas comparten la API, así que el resto del código es el mismo.
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ESTILO_LIBRE = 'https://tiles.openfreemap.org/styles/bright';

// Vista inicial: la cuenca del Alto Atoyac, Puebla y Tlaxcala
const INICIO = { center: [-98.2, 19.1], zoom: 8.6 };
const LIMITES = [[VENTANA.lonMin - 0.5, VENTANA.latMin - 0.5], [VENTANA.lonMax + 0.5, VENTANA.latMax + 0.5]];

const redondea = (v) => Math.round(v * 1000) / 1000; // los reportes se dibujan a unos 100 m, no en su coordenada exacta

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

const Mapa = forwardRef(function Mapa({ cuenca, reportes, onCentro, onUsuarioMovio, onReporte, onListo, onError }, ref) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const gl = useRef(null);
  const marcas = useRef([]);
  const [lista, setLista] = useState(false);
  const cb = useRef({});
  cb.current = { onCentro, onUsuarioMovio, onReporte };

  useImperativeHandle(ref, () => ({
    volarA(lat, lon, zoom = 16) { mapa.current?.flyTo({ center: [lon, lat], zoom, essential: true }); },
  }), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const mod = await (TOKEN ? import('mapbox-gl') : import('maplibre-gl'));
        if (!vivo) return;
        gl.current = mod.default || mod;
        if (TOKEN) gl.current.accessToken = TOKEN;
        const m = new gl.current.Map({
          container: contenedor.current,
          style: TOKEN ? 'mapbox://styles/mapbox/streets-v12' : ESTILO_LIBRE,
          center: INICIO.center, zoom: INICIO.zoom, minZoom: 6.5, maxBounds: LIMITES,
          attributionControl: true,
        });
        mapa.current = m;
        if (import.meta.env.DEV) window.mapaCiudadano = m;   // solo para pruebas en desarrollo
        m.on('movestart', (e) => { if (e.originalEvent) cb.current.onUsuarioMovio?.(); });
        m.on('moveend', () => { const c = m.getCenter(); cb.current.onCentro?.({ lat: c.lat, lon: c.lng }); });
        m.on('load', () => {
          const c = m.getCenter();
          cb.current.onCentro?.({ lat: c.lat, lon: c.lng });
          setLista(true);
          onListo?.(m);
        });
        m.on('error', (e) => { if (e && e.error && /style|token|401|403/i.test(String(e.error.message))) onError?.(); });
      } catch { onError?.(); }
    })();
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Pines: reportes de otras personas
  useEffect(() => {
    const m = mapa.current;
    if (!m || !lista || !gl.current) return undefined;
    const pon = () => {
      marcas.current.forEach((x) => x.remove());
      marcas.current = [];
      (reportes || []).forEach((r) => {
        const cerrado = r.estado === 'Cerrado' || r.estado === 'Descartado';
        const el = boton('pin-publico ' + (cerrado ? 'pin-cerrado' : 'pin-abierto'), 'Reporte ciudadano', () => cb.current.onReporte?.(r));
        marcas.current.push(new gl.current.Marker({ element: el, anchor: 'bottom' }).setLngLat([redondea(r.longitud), redondea(r.latitud)]).addTo(m));
      });
    };
    pon();
    return undefined;
  }, [reportes, lista]);

  return <div className="map-lienzo" ref={contenedor} />;
});

export default Mapa;

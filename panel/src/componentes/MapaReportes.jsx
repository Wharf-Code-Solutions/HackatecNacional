import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

// Mapa de la autoridad: la huella de calor sobre el río (GET /huella) y un pin por foco de reportes (GET /prioridades),
// de color según su banda. Base vectorial de OpenFreeMap, sin llave. MapLibre se descarga al abrir esta vista.
const ESTILO = 'https://tiles.openfreemap.org/styles/bright';
const COLOR_BANDA = { Alta: '#9B0F15', Media: '#A57F2C', Baja: '#224497' };

export default function MapaReportes({ focos, huella, elegido, onElegir }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const gl = useRef(null);
  const marcas = useRef([]);
  const [lista, setLista] = useState(false);
  const [falla, setFalla] = useState(false);
  const alElegir = useRef(onElegir);
  alElegir.current = onElegir;

  useEffect(() => {
    let vivo = true;
    import('maplibre-gl').then((mod) => {
      if (!vivo) return;
      gl.current = mod.default || mod;
      const m = new gl.current.Map({ container: caja.current, style: ESTILO, center: [-98.2, 19.1], zoom: 8.5, attributionControl: true });
      mapa.current = m;
      m.addControl(new gl.current.NavigationControl({ showCompass: false }), 'top-right');
      m.on('load', () => {
        m.addSource('huella', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({
          id: 'huella-linea', type: 'line', source: 'huella', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['interpolate', ['linear'], ['get', 'intensidad'], 0, '#E3C99A', 0.5, '#BA6783', 1, '#611232'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6, 16, 10], 'line-opacity': 0.9,
          },
        });
        setLista(true);
      });
      m.on('error', (e) => { if (e && e.error && /style|401|403/i.test(String(e.error.message))) setFalla(true); });
    }).catch(() => setFalla(true));
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []);

  // Huella
  useEffect(() => {
    const m = mapa.current;
    if (!lista || !m) return;
    m.getSource('huella').setData(huella && huella.features ? huella : { type: 'FeatureCollection', features: [] });
  }, [huella, lista]);

  // Pines de los focos. El elemento que recibe el marcador va sin estilos: la biblioteca lo mueve con su transform.
  useEffect(() => {
    const m = mapa.current;
    if (!lista || !m || !gl.current) return;
    marcas.current.forEach((x) => x.remove());
    marcas.current = [];
    (focos || []).forEach((f) => {
      const caja2 = document.createElement('div');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pin-foco' + (f.c_foco === elegido ? ' elegido' : '');
      b.style.background = COLOR_BANDA[f.banda] || '#767676';
      b.textContent = f.prioridad;
      b.setAttribute('aria-label', 'Foco de ' + f.n_reportes + ' reporte(s), prioridad ' + f.prioridad);
      b.addEventListener('click', () => alElegir.current(f.c_foco));
      caja2.appendChild(b);
      marcas.current.push(new gl.current.Marker({ element: caja2 }).setLngLat([f.longitud, f.latitud]).addTo(m));
    });
  }, [focos, elegido, lista]);

  // Encuadra los focos una vez; al elegir uno, vuela a él
  const encuadrado = useRef(false);
  useEffect(() => {
    const m = mapa.current;
    if (!lista || !m || !focos || !focos.length || encuadrado.current) return;
    encuadrado.current = true;
    if (focos.length === 1) { m.jumpTo({ center: [focos[0].longitud, focos[0].latitud], zoom: 13 }); return; }
    const lons = focos.map((f) => f.longitud), lats = focos.map((f) => f.latitud);
    m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60, maxZoom: 14, duration: 0 });
  }, [focos, lista]);
  useEffect(() => {
    const m = mapa.current;
    const f = (focos || []).find((x) => x.c_foco === elegido);
    if (lista && m && f) m.easeTo({ center: [f.longitud, f.latitud], zoom: Math.max(m.getZoom(), 12), duration: 600 });
  }, [elegido]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mapa-reportes">
      <div ref={caja} className="mapa-reportes-lienzo" />
      {falla && <p className="mensaje">No se pudo cargar el mapa. Revisa la conexión a internet.</p>}
    </div>
  );
}

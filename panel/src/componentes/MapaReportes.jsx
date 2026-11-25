import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

// Mapa del tablero de reportes, como el de SIGRIV: un pin en gota por elemento de la lista (guinda si la
// prioridad es alta, dorado si es media, gris si es baja) y el calor encima. El calor es la huella sobre el
// río (GET /huella, D30), que se prende y apaga con el botón «Mapa de calor». Base vectorial de OpenFreeMap,
// sin llave. MapLibre se descarga al abrir esta sección.
const ESTILO = 'https://tiles.openfreemap.org/styles/bright';
const AGUA = '#1d6fa5';   // el azul del agua del resto del proyecto (mapa/, MapaEstaciones)

export default function MapaReportes({ focos, huella, calor, elegido, vista, onElegir }) {
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
      m.addControl(new gl.current.NavigationControl({ showCompass: false }), 'bottom-right');
      m.on('load', () => {
        // Agua más marcada: la base pinta ríos y cuerpos de agua muy tenues. Se oscurecen sus rellenos y líneas, y
        // encima va la red del INEGI (orden >= 4, la del mapa del proyecto) en el azul del agua, más gruesa por orden.
        m.getStyle().layers.forEach((l) => {
          if (l.type === 'fill' && /water/.test(l.id) && !/shadow/.test(l.id)) m.setPaintProperty(l.id, 'fill-color', '#9cc6e6');
          if (l.type === 'line' && /waterway/.test(l.id)) {
            m.setPaintProperty(l.id, 'line-color', AGUA);
            m.setPaintProperty(l.id, 'line-opacity', 0.7);
          }
        });
        m.addSource('rios_inegi', { type: 'geojson', data: import.meta.env.BASE_URL + 'datos/red_hidrografica.geojson' });
        const ancho = (k) => ['match', ['get', 'orden'], 7, 2.2 * k, 6, 1.6 * k, 5, 1.1 * k, 0.7 * k];
        m.addLayer({ id: 'rios_inegi', type: 'line', source: 'rios_inegi', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': AGUA, 'line-opacity': 0.9,
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, ancho(1), 12, ancho(2), 15, ancho(3)] } });
        m.addSource('huella', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({
          id: 'huella-linea', type: 'line', source: 'huella', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            // misma escala que la leyenda (estilos.css, .leyenda-calor-barra)
            'line-color': ['interpolate', ['linear'], ['get', 'intensidad'], 0, '#e2c482', 0.35, '#c9993f', 0.6, '#c4343e', 0.8, '#9d2449', 1, '#460a24'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6, 16, 10], 'line-opacity': 0.9,
          },
        });
        setLista(true);
      });
      m.on('error', (e) => { if (e && e.error && /style|401|403/i.test(String(e.error.message))) setFalla(true); });
    }).catch(() => setFalla(true));
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []);

  // En teléfono el mapa estaba oculto (vista Lista): al mostrarlo hay que recalcular su tamaño
  useEffect(() => {
    const t = setTimeout(() => mapa.current?.resize(), 50);
    return () => clearTimeout(t);
  }, [vista]);

  // Calor
  useEffect(() => {
    const m = mapa.current;
    if (!lista || !m) return;
    m.getSource('huella').setData(huella && huella.features ? huella : { type: 'FeatureCollection', features: [] });
    m.setLayoutProperty('huella-linea', 'visibility', calor ? 'visible' : 'none');
  }, [huella, calor, lista]);

  // Pines. El elemento que recibe el marcador va sin estilos: la biblioteca lo mueve con su transform.
  useEffect(() => {
    const m = mapa.current;
    if (!lista || !m || !gl.current) return;
    marcas.current.forEach((x) => x.remove());
    marcas.current = [];
    (focos || []).forEach((f) => {
      const caja2 = document.createElement('div');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'marcador marcador-' + f.nivel + (f.id === elegido ? ' seleccionado' : '');
      b.setAttribute('aria-label', 'Reporte de ' + f.reportes.length + (f.prioridad != null ? ', prioridad ' + f.prioridad : ''));
      b.addEventListener('click', () => alElegir.current(f.id));
      caja2.appendChild(b);
      marcas.current.push(new gl.current.Marker({ element: caja2, anchor: 'bottom' }).setLngLat([f.lon, f.lat]).addTo(m));
    });
  }, [focos, elegido, lista]);

  // Encuadra los pines una vez; al elegir uno, vuela a él
  const encuadrado = useRef(false);
  useEffect(() => {
    const m = mapa.current;
    if (!lista || !m || !focos || !focos.length || encuadrado.current) return;
    encuadrado.current = true;
    if (focos.length === 1) { m.jumpTo({ center: [focos[0].lon, focos[0].lat], zoom: 13 }); return; }
    const lons = focos.map((f) => f.lon), lats = focos.map((f) => f.lat);
    m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60, maxZoom: 14, duration: 0 });
  }, [focos, lista]);
  useEffect(() => {
    const m = mapa.current;
    const f = (focos || []).find((x) => x.id === elegido);
    if (lista && m && f) m.flyTo({ center: [f.lon, f.lat], zoom: Math.max(m.getZoom(), 15), duration: 800 });
  }, [elegido]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div ref={caja} className="tablero-mapa-lienzo" />
      {falla && <p className="mensaje mapa-falla">No se pudo cargar el mapa. Revisa la conexión a internet.</p>}
    </>
  );
}

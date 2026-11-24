import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { inicial, porAtender } from '../lib/formato.js';

// El mismo mapa que el modulo del mapa (mapa/mapa.js, M6): MapLibre con la base positron de
// OpenFreeMap, sus rios y rotulos de calles apagados, y encima las capas del INEGI (contorno de la
// cuenca con su mascara, subcuencas, red hidrografica por orden, nombres de rios, confluencias) y
// las 5 estaciones con el mismo marcador (negro; rojo con una alerta por
// atender). No importa codigo de mapa/: lee los mismos archivos (D31 y la frontera de modulos).
const ESTILO = 'https://tiles.openfreemap.org/styles/positron';
const AGUA = '#1d6fa5', TINTA = '#16222c';
const ROTULOS = ['RIO ATOYAC', 'RIO ZAHUAPAN', 'RIO ALSESECA', 'RIO XOPANAC', 'RIO XOCHIAC', 'RIO NEXAPA', 'RIO ATENCO', 'RIO MIXTECO', 'RIO ACATLAN'];
const ITALICA = ['Noto Sans Italic'];
const sinAcentos = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const miles = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });

export default function MapaEstaciones({ estaciones, alertas, elegida, onElegir }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const marcas = useRef({});
  const [listo, setListo] = useState(false);
  const [falla, setFalla] = useState(false);
  const alElegir = useRef(onElegir);
  alElegir.current = onElegir;

  useEffect(() => {
    let vivo = true;
    const base = import.meta.env.BASE_URL + 'datos/';
    Promise.all([
      import('maplibre-gl'),
      Promise.all(['cuenca', 'subcuencas', 'red_hidrografica', 'confluencias', 'toponimia_hidrografica']
        .map((n) => getJSON(base + n + '.geojson'))),
    ]).then(([mod, capas]) => {
      if (!vivo) return;
      const gl = mod.default || mod;
      const [cuenca, subcuencas, red, confluencias, toponimia] = capas;
      const cods = Object.keys(estaciones).sort();
      const lons = cods.map((c) => estaciones[c].longitud), lats = cods.map((c) => estaciones[c].latitud);
      const m = new gl.Map({
        container: caja.current, style: ESTILO, attributionControl: false, dragRotate: false, pitchWithRotate: false,
        bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        fitBoundsOptions: { padding: { top: 40, bottom: 60, left: 50, right: 80 } }, minZoom: 6, maxZoom: 17, cooperativeGestures: true,
      });
      mapa.current = m;
      window.mapaPanel = m;   // para depurar desde la consola, como window.mapaAtoyac en mapa/
      m.touchZoomRotate.disableRotation();
      m.addControl(new gl.NavigationControl({ showCompass: false }), 'top-left');
      m.addControl(new gl.ScaleControl({ unit: 'metric' }), 'bottom-left');
      m.addControl(new gl.AttributionControl({ compact: true, customAttribution: 'Ríos y subcuencas: INEGI' }), 'bottom-right');
      m.on('error', (e) => { if (e && e.error && /style|tiles|Failed to fetch/i.test(String(e.error.message))) setFalla(true); });

      m.on('load', () => {
        // Base: solo contexto. Se apagan sus rios (la red del INEGI es la unica agua) y los rotulos de
        // calles y comercios; los nombres de lugar, en español. Igual que apagaBase() de mapa/.
        m.getStyle().layers.forEach((l) => {
          if (/waterway/.test(l.id)) m.setLayoutProperty(l.id, 'visibility', 'none');
          else if (l.type === 'symbol' && /(poi|road|highway|transport|housenum|water_name|aeroway)/.test(l.id)) m.setLayoutProperty(l.id, 'visibility', 'none');
          else if (l.type === 'symbol' && l.layout && l.layout['text-field']) m.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']]);
        });

        // Cuenca: mascara fuera del contorno, subcuencas punteadas y contorno en tinta.
        const anillo = cuenca.features[0].geometry.coordinates[0];
        const mundo = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
        m.addSource('mascara', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mundo, anillo] } } });
        m.addLayer({ id: 'mascara', type: 'fill', source: 'mascara', paint: { 'fill-color': '#f3f5f6', 'fill-opacity': 0.8 } });
        m.addSource('subcuencas', { type: 'geojson', data: subcuencas });
        m.addLayer({ id: 'subcuencas', type: 'line', source: 'subcuencas',
          paint: { 'line-color': '#7b6a52', 'line-width': 0.8, 'line-opacity': 0.55, 'line-dasharray': [4, 3] } });
        m.addSource('cuenca', { type: 'geojson', data: cuenca });
        m.addLayer({ id: 'cuenca', type: 'line', source: 'cuenca', paint: { 'line-color': TINTA, 'line-width': 1.8 } });

        // Rios del INEGI, mas gruesos cuanto mayor el orden, y sus nombres principales.
        const ancho = (k) => ['match', ['get', 'orden'], 7, 1.7 * k, 6, 1.1 * k, 5, 0.7 * k, 0.4 * k];
        m.addSource('rios', { type: 'geojson', data: red });
        m.addLayer({ id: 'rios', type: 'line', source: 'rios', layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': AGUA, 'line-opacity': 0.95,
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, ancho(1), 10, ancho(1.8), 13, ancho(2.6)] } });
        const nombres = { type: 'FeatureCollection', features: toponimia.features
          .filter((f) => ROTULOS.includes(sinAcentos(f.properties.nombre)))
          .map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { n: inicial(f.properties.nombre) } })) };
        m.addSource('nombres_rios', { type: 'geojson', data: nombres });
        m.addLayer({ id: 'nombres_rios', type: 'symbol', source: 'nombres_rios', minzoom: 8.5,
          layout: { 'text-field': ['get', 'n'], 'text-font': ITALICA, 'text-size': 12, 'text-offset': [0, -0.8] },
          paint: { 'text-color': '#14527a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });

        // Confluencias: se rotulan solo las que el INEGI nombra como rio en ambos brazos.
        confluencias.features.forEach((f) => {
          const p = f.properties;
          const ok = p.principal && p.afluente && /^r[ií]o /i.test(p.principal) && /^r[ií]o /i.test(p.afluente);
          p.rotulo = ok ? [p.principal, p.afluente].map((n) => inicial(n).replace(/^R[ií]o /, '')).join(' y ') : '';
          p.mayor = p.rango <= 4;
          p.detalle = [p.principal, p.afluente].filter(Boolean).map(inicial).join(' y ') || 'Cauces sin nombre en el INEGI';
        });
        m.addSource('confluencias', { type: 'geojson', data: confluencias });
        m.addLayer({ id: 'confluencias', type: 'circle', source: 'confluencias',
          paint: { 'circle-radius': ['case', ['get', 'mayor'], 5, 4], 'circle-color': '#fff', 'circle-stroke-color': AGUA,
            'circle-stroke-width': ['case', ['get', 'mayor'], 2, 1.5] } });
        m.addLayer({ id: 'confluencias_rotulo', type: 'symbol', source: 'confluencias', filter: ['!=', ['get', 'rotulo'], ''],
          layout: { 'text-field': ['get', 'rotulo'], 'text-font': ITALICA, 'text-size': 11.5, 'text-anchor': 'left', 'text-offset': [0.9, 0] },
          paint: { 'text-color': '#14527a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });

        // Ventanas al pasar el cursor, como en mapa/.
        const emergente = (capa, html) => {
          const pop = new gl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
          m.on('mousemove', capa, (e) => { m.getCanvas().style.cursor = 'pointer'; pop.setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(m); });
          m.on('mouseleave', capa, () => { m.getCanvas().style.cursor = ''; pop.remove(); });
        };
        emergente('confluencias', (p) => '<b>Confluencia</b><br>' + p.detalle + '<br>Red aguas arriba: ' +
          miles(p.km_red_principal) + ' y ' + miles(p.km_red_afluente) + ' km');

        // Estaciones: el marcador de mapa/ (numero en circulo negro, nombre al acercarse). Un clic
        // filtra las alertas del panel por esa estacion.
        cods.forEach((c, i) => {
          const e = estaciones[c];
          const el = document.createElement('div');
          el.className = 'est-marca';
          el.innerHTML = '<div class="punto">' + (i + 1) + '</div><div class="nombre">' + inicial(e.cuerpo_agua) + '</div>';
          el.title = c + ' · ' + inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio);
          el.addEventListener('click', () => alElegir.current(c));
          marcas.current[c] = { el, marca: new gl.Marker({ element: el, anchor: 'left', offset: [-13, 0] }).setLngLat([e.longitud, e.latitud]).addTo(m) };
        });
        // La atribucion queda plegada en el boton "i", como en mapa/.
        caja.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        const acerca = () => caja.current && caja.current.classList.toggle('zoom-cerca', m.getZoom() >= 10.5);
        m.on('zoom', acerca);
        acerca();
        setListo(true);
      });
    }).catch(() => { if (vivo) setFalla(true); });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; marcas.current = {}; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rojo si la estacion tiene una alerta por atender; contorno azul si es la elegida en el panel.
  useEffect(() => {
    if (!listo) return;
    Object.entries(marcas.current).forEach(([c, { el }]) => {
      el.classList.toggle('alerta', alertas.some((a) => a.c_estacion === c && porAtender(a)));
      el.classList.toggle('activa', c === elegida);
    });
  }, [alertas, elegida, listo]);

  return (
    <div className="mapa-estaciones">
      <div ref={caja} className="mapa-estaciones-lienzo" />
      {falla && <p className="mensaje">No se pudo cargar el mapa base. Revisa la conexión a internet.</p>}
    </div>
  );
}

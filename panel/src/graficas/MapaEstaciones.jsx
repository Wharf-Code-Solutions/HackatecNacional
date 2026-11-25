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

// Escuelas (docs/19): punto guinda, mas oscuro y grande cuanto mayor su nivel de riesgo.
const RIESGO_TXT = { muy_alto: 'muy alto', alto: 'alto', medio: 'medio', bajo: 'bajo' };
const FUENTE_TXT = { red_publica: 'red pública', pozo: 'pozo', manantial: 'manantial', rio: 'río', pipa: 'pipa',
  captacion_lluvia: 'captación de lluvia', desconocida: 'sin dato' };

// Zonas de riesgo (zonas_riesgo.geojson): relleno suave por tipo, mas opaco si el nivel es mayor.
// Tierra para derrumbe, azul del agua para inundacion, gris oliva para contaminacion: no compiten
// con el guinda de las escuelas ni con el rojo de las alertas.
const COLOR_ZONA = { derrumbe: '#8a6a3c', inundacion: '#1d6fa5', contaminacion: '#5f6b3a' };
const TIPO_ZONA = { derrumbe: 'Derrumbe', inundacion: 'Inundación', contaminacion: 'Contaminación' };

export default function MapaEstaciones({ estaciones, alertas, elegida, onElegir, escuelas = [], onElegirEscuela, zonas = null, escuelaElegida = null, mecanismos = null }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const marcas = useRef({});
  const [listo, setListo] = useState(false);
  const [falla, setFalla] = useState(false);
  const alElegir = useRef(onElegir);
  alElegir.current = onElegir;
  const alElegirEsc = useRef(onElegirEscuela);
  alElegirEsc.current = onElegirEscuela;

  useEffect(() => {
    let vivo = true;
    const base = import.meta.env.BASE_URL + 'datos/';
    Promise.all([
      import('maplibre-gl'),
      Promise.all(['cuenca', 'subcuencas', 'red_hidrografica', 'confluencias', 'toponimia_hidrografica']
        .map((n) => getJSON(base + n + '.geojson'))),
      mecanismos ? getJSON(base + 'red_mecanismos.geojson').catch(() => null) : Promise.resolve(null),
    ]).then(([mod, capas, redMec]) => {
      if (!vivo) return;
      const gl = mod.default || mod;
      const [cuenca, subcuencas, red, confluencias, toponimia] = capas;
      const cods = Object.keys(estaciones).sort();
      // La vista inicial abarca estaciones y escuelas.
      const conCoord = escuelas.filter((e) => e.longitud != null && e.latitud != null);
      // Mecanismos junto a escuelas (agua y ladera), en el orden y con el número de mapa/ (1 a 10).
      const mecs = mecanismos ? Object.values(mecanismos).filter((x) => x.longitud != null) : [];
      const lons = cods.map((c) => estaciones[c].longitud).concat(conCoord.map((e) => e.longitud), mecs.map((x) => x.longitud));
      const lats = cods.map((c) => estaciones[c].latitud).concat(conCoord.map((e) => e.latitud), mecs.map((x) => x.latitud));
      const m = new gl.Map({
        container: caja.current, style: ESTILO, attributionControl: false, dragRotate: false, pitchWithRotate: false,
        // Sin puntos (por ejemplo, sin escuelas en los datos): la cuenca del Alto Atoyac.
        bounds: lons.length ? [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]] : [[-98.9, 18.0], [-97.6, 19.7]],
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
          else if (l.type === 'line' && /(road|street|highway|motorway|bridge|tunnel|rail|transit|ferry|path|aeroway)/.test(l.id)) m.setLayoutProperty(l.id, 'visibility', 'none');
          else if (l.type === 'line' && /(admin|boundar)/.test(l.id)) { m.setPaintProperty(l.id, 'line-color', '#d3d9dd'); m.setPaintProperty(l.id, 'line-opacity', 0.7); }
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

        // Zonas de riesgo: solo las que contienen alguna escuela que el panel muestra (las de la cuenca).
        const cctVisibles = new Set(conCoord.map((e) => e.cct));
        const zonasVis = ((zonas && zonas.features) || []).filter((f) => f.geometry && (f.properties.escuelas || []).some((c) => cctVisibles.has(c)))
          .map((f) => ({ ...f, properties: { ...f.properties, n_esc: (f.properties.escuelas || []).length } }));
        m.addSource('zonas', { type: 'geojson', data: { type: 'FeatureCollection', features: zonasVis } });
        m.addLayer({ id: 'zonas', type: 'fill', source: 'zonas',
          paint: { 'fill-color': ['match', ['get', 'tipo'], 'derrumbe', COLOR_ZONA.derrumbe, 'inundacion', COLOR_ZONA.inundacion, COLOR_ZONA.contaminacion],
            'fill-opacity': ['match', ['get', 'nivel'], 'muy_alto', 0.32, 'alto', 0.22, 0.14] }, minzoom: 12 });
        // Las zonas miden menos de 1 km: alejado, un anillo en su centro (radio minimo en pixeles) dice que
        // esa escuela esta dentro de una zona; de cerca se ve el poligono real.
        const centro = (f) => {
          const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
          return [c.reduce((a, q) => a + q[0], 0) / c.length, c.reduce((a, q) => a + q[1], 0) / c.length];
        };
        m.addSource('zonas_centro', { type: 'geojson', data: { type: 'FeatureCollection', features: zonasVis.map((f) => ({
          type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: centro(f) } })) } });
        const colorTipo = ['match', ['get', 'tipo'], 'derrumbe', COLOR_ZONA.derrumbe, 'inundacion', COLOR_ZONA.inundacion, COLOR_ZONA.contaminacion];
        m.addLayer({ id: 'zonas_anillo', type: 'circle', source: 'zonas_centro', maxzoom: 12.5,
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 11, 12, 18],
            'circle-color': colorTipo, 'circle-opacity': ['match', ['get', 'nivel'], 'muy_alto', 0.35, 'alto', 0.25, 0.15],
            'circle-stroke-color': colorTipo, 'circle-stroke-width': 1.5 } });
        m.addLayer({ id: 'zonas_borde', type: 'line', source: 'zonas',
          paint: { 'line-color': ['match', ['get', 'tipo'], 'derrumbe', COLOR_ZONA.derrumbe, 'inundacion', COLOR_ZONA.inundacion, COLOR_ZONA.contaminacion],
            'line-width': 1, 'line-opacity': 0.8 }, minzoom: 12 });

        // Escuelas de escuelas.json, encima de la red y debajo de las estaciones. Varias comparten
        // coordenada (otro turno en el mismo plantel, o la coordenada de la localidad): se dibujan
        // como un punto con el numero de escuelas y el color del mayor riesgo del grupo.
        const ORDEN_RIESGO = { muy_alto: 4, alto: 3, medio: 2, bajo: 1 };
        const grupos = {};
        conCoord.forEach((e) => {
          const k = e.longitud.toFixed(4) + ',' + e.latitud.toFixed(4);
          (grupos[k] = grupos[k] || []).push(e);
        });
        const fila = (e) => '<b>' + e.nombre + '</b><br>' + e.cct + ' · ' + inicial(e.nivel || '') + ' · riesgo ' +
          (RIESGO_TXT[(e.riesgo || {}).nivel] || 'sin dato') +
          ((e.riesgo || {}).indice != null ? ' (' + Number(e.riesgo.indice).toFixed(2) + ')' : '') +
          '<br>Agua: ' + (FUENTE_TXT[e.fuente_agua] || 'sin dato') + (e.c_estacion ? ' · mecanismo ' + e.c_estacion : '');
        const puntosEsc = Object.values(grupos).map((g) => {
          g.sort((p, q) => ((q.riesgo || {}).indice || 0) - ((p.riesgo || {}).indice || 0));
          const peor = g.reduce((m, e) => Math.max(m, ORDEN_RIESGO[(e.riesgo || {}).nivel] || 0), 0);
          const riesgo = Object.keys(ORDEN_RIESGO).find((k) => ORDEN_RIESGO[k] === peor) || '';
          const lugar = inicial(g[0].localidad || '') + ', ' + inicial(g[0].municipio || '');
          const html = (g.length > 1 ? '<b>' + g.length + ' escuelas en ' + lugar + '</b><br><br>' : '') +
            g.map(fila).join('<br><br>') + (g.length > 1 ? '' : '<br>' + lugar);
          return { type: 'Feature', geometry: { type: 'Point', coordinates: [g[0].longitud, g[0].latitud] },
            properties: { n: g.length, riesgo, html, cct: g[0].cct, ccts: ',' + g.map((e) => e.cct).join(',') + ',' } };
        });
        m.addSource('escuelas', { type: 'geojson', data: { type: 'FeatureCollection', features: puntosEsc } });
        m.addLayer({ id: 'escuelas', type: 'circle', source: 'escuelas',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'],
              7, ['case', ['>', ['get', 'n'], 1], 8, ['match', ['get', 'riesgo'], 'muy_alto', 6, 'alto', 5.5, 4.5]],
              12, ['case', ['>', ['get', 'n'], 1], 12, ['match', ['get', 'riesgo'], 'muy_alto', 10, 'alto', 9, 7]]],
            'circle-color': ['match', ['get', 'riesgo'], 'muy_alto', '#5c0f24', 'alto', '#9D2449', 'medio', '#c56a87', '#e3a9ba'],
            'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
          } });
        m.addLayer({ id: 'escuela_sel', type: 'circle', source: 'escuelas', filter: ['==', ['get', 'cct'], ''],
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 12, 12, 17], 'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': TINTA, 'circle-stroke-width': 2.5 } });
        m.addLayer({ id: 'escuelas_n', type: 'symbol', source: 'escuelas', filter: ['>', ['get', 'n'], 1],
          layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': ['Noto Sans Bold'], 'text-size': 11,
            'text-allow-overlap': true, 'text-ignore-placement': true },
          paint: { 'text-color': '#fff' } });

        // Ventanas al pasar el cursor, como en mapa/.
        const emergente = (capa, html) => {
          const pop = new gl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
          m.on('mousemove', capa, (e) => { m.getCanvas().style.cursor = 'pointer'; pop.setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(m); });
          m.on('mouseleave', capa, () => { m.getCanvas().style.cursor = ''; pop.remove(); });
        };
        emergente('escuelas', (p) => p.html + '<br><span style="color:#767676">Clic para abrir su ficha</span>');
        // Un clic abre la ficha de la escuela (la de mayor riesgo si el punto agrupa varias).
        m.on('click', 'escuelas', (e) => { const f = e.features[0]; if (f && alElegirEsc.current) alElegirEsc.current(f.properties.cct); });
        const htmlZona = (p) => '<b>Zona de riesgo por ' + (TIPO_ZONA[p.tipo] || p.tipo).toLowerCase() + '</b><br>Nivel ' +
          (RIESGO_TXT[p.nivel] || 'sin dato') + ' · ' + p.n_esc + (p.n_esc === 1 ? ' escuela' : ' escuelas') + '<br>' +
          '<span style="color:#767676">' + (p.fuente || '') + '</span>';
        emergente('zonas_anillo', htmlZona);
        emergente('zonas', (p) => '<b>Zona de riesgo por ' + (TIPO_ZONA[p.tipo] || p.tipo).toLowerCase() + '</b><br>Nivel ' +
          (RIESGO_TXT[p.nivel] || 'sin dato') + ' · ' + p.n_esc + (p.n_esc === 1 ? ' escuela' : ' escuelas') + '<br>' +
          '<span style="color:#767676">' + (p.fuente || '') + '</span>');
        emergente('confluencias', (p) => '<b>Confluencia</b><br>' + p.detalle + '<br>Red aguas arriba: ' +
          miles(p.km_red_principal) + ' y ' + miles(p.km_red_afluente) + ' km');

        // Tramos que llegan a un mecanismo desde un cauce menor (red_mecanismos.geojson), igual que en mapa/.
        if (redMec) {
          m.addSource('rios_mecanismos', { type: 'geojson', data: redMec });
          m.addLayer({ id: 'rios_mecanismos', type: 'line', source: 'rios_mecanismos', filter: ['==', ['get', 'conexion'], true],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': AGUA, 'line-opacity': 0.95, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 10, 1.1, 13, 1.8] } });
        }

        // Estaciones: el marcador de mapa/ (numero en circulo negro, nombre al acercarse, pulso de radar con una
        // alerta). Los mecanismos llevan el número de mapa/ (1 a 10); las estaciones del Atoyac, A1 a A5. Un clic
        // filtra las alertas del panel por esa estacion.
        const marca = (c, num, nombre, titulo, lon, lat, clase) => {
          const el = document.createElement('div');
          el.className = 'est-marca' + (clase ? ' ' + clase : '');
          el.innerHTML = '<div class="punto">' + num + '</div><div class="nombre">' + nombre + '</div>';
          el.title = titulo;
          el.addEventListener('click', () => alElegir.current(c));
          marcas.current[c] = { el, marca: new gl.Marker({ element: el, anchor: 'left', offset: [-13, 0] }).setLngLat([lon, lat]).addTo(m) };
        };
        cods.forEach((c, i) => {
          const e = estaciones[c];
          marca(c, (mecs.length ? 'A' : '') + (i + 1), inicial(e.cuerpo_agua), c + ' · ' + inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio),
            e.longitud, e.latitud, mecs.length ? 'atoyac' : '');
        });
        mecs.forEach((x, i) => {
          const ladera = (x.parametros || []).includes('LLUVIA');
          const lugar = inicial(x.localidad || x.escuela || x.c_estacion);
          marca(x.c_estacion, i + 1, lugar, x.c_estacion + ' · ' + (ladera ? 'ladera' : 'agua') + ' · ' + (x.escuela || '') + ', ' + inicial(x.municipio || ''),
            x.longitud, x.latitud, ladera ? 'ladera' : 'agua');
        });
        // La atribucion queda plegada en el boton "i", como en mapa/.
        caja.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        const acerca = () => caja.current && caja.current.classList.toggle('zoom-cerca', m.getZoom() >= 10.5);
        m.on('zoom', acerca);
        acerca();
        setListo(true);
      });
    }).catch(() => { if (vivo) setFalla(true); });
    return () => {
      vivo = false;
      // MapLibre lanza AbortError si se quita mientras aún carga el estilo (al cambiar de pestaña): no es falla.
      try { mapa.current?.remove(); } catch (e) { /* nada */ }
      mapa.current = null; marcas.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rojo si la estacion tiene una alerta por atender; contorno azul si es la elegida en el panel.
  useEffect(() => {
    if (!listo) return;
    Object.entries(marcas.current).forEach(([c, { el }]) => {
      el.classList.toggle('alerta', alertas.some((a) => a.c_estacion === c && porAtender(a)));
      el.classList.toggle('activa', c === elegida);
    });
  }, [alertas, elegida, listo]);

  // La escuela elegida en el panel: anillo en tinta y el mapa se acerca a ella.
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m || !m.getLayer('escuela_sel')) return;
    m.setFilter('escuela_sel', ['in', ',' + (escuelaElegida || '#') + ',', ['get', 'ccts']]);
    const e = escuelaElegida && escuelas.find((x) => x.cct === escuelaElegida);
    if (e && e.longitud != null) m.easeTo({ center: [e.longitud, e.latitud], zoom: Math.max(m.getZoom(), 11), duration: 600 });
  }, [escuelaElegida, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mapa-estaciones">
      <div ref={caja} className="mapa-estaciones-lienzo" />
      {falla && <p className="mensaje">No se pudo cargar el mapa base. Revisa la conexión a internet.</p>}
    </div>
  );
}

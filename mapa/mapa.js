/* Mapa de la cuenca del Alto Atoyac.
 *
 * Con token de Mapbox (mapa/config.js, no versionado) usa Mapbox GL JS: estilo claro,
 * satélite y relieve de Mapbox. Sin token usa MapLibre GL con la base gratuita de
 * OpenFreeMap y el relieve Terrarium. El código es el mismo: la API de ambos coincide.
 *
 * Datos: contorno, subcuencas, red hidrográfica, confluencias y toponimia
 * (scripts/60_red_para_mapa.py, de INEGI); los 219 sitios y las 5 estaciones
 * (contrato/fixtures). Al elegir una estación el mapa se acerca y se abre su
 * simulador en un marco.
 *
 * La base es solo contexto: se apagan sus ríos para que la red del INEGI sea lo
 * único que se lee como agua. El relieve es una capa opcional (elevación
 * Terrarium en AWS, sin llave).
 *
 * Frontera: el mapa NO importa código del simulador. Lo muestra por URL y se
 * entera de las alertas leyendo el backend por el contrato (GET /alertas).
 * ?mock=http://127.0.0.1:8080 es el backend por defecto; ?mock= lo desactiva.
 */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var MOCK = Q.has('mock') ? Q.get('mock') : 'http://127.0.0.1:8080';
  var $ = function (id) { return document.getElementById(id); };
  var AGUA = '#1d6fa5', TINTA = '#16222c';
  var ROTULOS = ['RIO ATOYAC', 'RIO ZAHUAPAN', 'RIO ALSESECA', 'RIO XOPANAC', 'RIO XOCHIAC', 'RIO NEXAPA', 'RIO ATENCO', 'RIO MIXTECO', 'RIO ACATLAN'];

  function sinAcentos(t) { return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  function inicial(t) {
    return (t || '').toLowerCase().replace(/(^|[\s(])([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/ (De|Del|La|Las|El|Los|Y) /g, function (m) { return m.toLowerCase(); });
  }
  function miles(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  var MB = !!(window.mapboxgl && window.MAPBOX_TOKEN);
  var gl = MB ? window.mapboxgl : window.maplibregl;
  if (MB) gl.accessToken = window.MAPBOX_TOKEN;
  var CSS = MB ? 'mapboxgl' : 'maplibregl';
  var ITALICA = MB ? ['DIN Pro Italic', 'Arial Unicode MS Regular'] : ['Noto Sans Italic'];
  var NOMBRE_ES = MB ? 'name_es' : 'name:es';
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }

  var opciones = {
    container: 'mapa',
    style: MB ? 'mapbox://styles/mapbox/light-v11' : 'https://tiles.openfreemap.org/styles/positron',
    center: [-98.2, 18.6], zoom: 7.3, minZoom: 6, maxZoom: 17,
    attributionControl: false, dragRotate: false, pitchWithRotate: false
  };
  if (MB) opciones.projection = 'mercator';
  var mapa = new gl.Map(opciones);
  mapa.touchZoomRotate.disableRotation();
  mapa.addControl(new gl.NavigationControl({ showCompass: false }), 'top-left');
  mapa.addControl(new gl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  mapa.addControl(new gl.AttributionControl({ compact: true, customAttribution: 'Ríos y subcuencas: INEGI · Sitios: CONAGUA' }), 'bottom-right');
  window.mapaAtoyac = mapa;

  var marcadores = {}, vistaCuenca = null, abierta = null;

  var datos = Promise.all([
    get('../datos/procesados/mapa/cuenca.geojson'),
    get('../datos/procesados/mapa/subcuencas.geojson'),
    get('../datos/procesados/mapa/red_hidrografica.geojson'),
    get('../datos/procesados/mapa/confluencias.geojson'),
    get('../datos/procesados/mapa/toponimia_hidrografica.geojson'),
    get('../contrato/fixtures/sitios.geojson'),
    get('../contrato/fixtures/estaciones.json')
  ]);
  var estilo = new Promise(function (ok) { mapa.on('load', ok); });

  Promise.all([datos, estilo]).then(function (r) {
    var d = r[0];
    apagaBase();
    agregaRelieve();
    agregaCuenca(d[0], d[1]);
    agregaRios(d[2], d[4]);
    agregaConfluencias(d[3]);
    agregaSitios(d[5]);
    agregaEstaciones(d[6].estaciones);
    vistaCuenca = limites(d[0].features[0].geometry.coordinates[0]);
    mapa.fitBounds(vistaCuenca, { padding: 30, duration: 0 });
    if (MOCK) { consultaBackend(); setInterval(consultaBackend, 3000); }
  }).catch(function (e) {
    console.error(e);
    $('mapa').insertAdjacentHTML('beforeend', '<p class="error">No se pudieron leer los datos. Sirve el repositorio desde su raíz: python -m http.server 8000</p>');
  });

  function limites(coords) {
    var b = new gl.LngLatBounds(coords[0], coords[0]);
    coords.forEach(function (c) { b.extend(c); });
    return b;
  }

  // ---------------------------------------------------------------- base
  // Los ríos de la base no son los del INEGI: se apagan. También rótulos de calles y comercios.
  function apagaBase() {
    mapa.getStyle().layers.forEach(function (l) {
      if (/waterway/.test(l.id)) mapa.setLayoutProperty(l.id, 'visibility', 'none');
      else if (l.type === 'symbol' && /(poi|road|highway|transport|housenum|water_name|aeroway)/.test(l.id)) mapa.setLayoutProperty(l.id, 'visibility', 'none');
      else if (l.type === 'symbol' && l.layout && l.layout['text-field']) mapa.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', NOMBRE_ES], ['get', 'name']]);
    });
    // la atribución queda plegada en el botón "i"
    var at = document.querySelector('.' + CSS + '-ctrl-attrib');
    if (at) at.classList.remove(CSS + '-compact-show');
  }
  // Satélite y relieve: capas opcionales, apagadas por defecto, debajo de los nombres de lugar
  // de la base y de todas nuestras capas. El satélite es Esri World Imagery (sin llave) con
  // cualquiera de las dos bibliotecas: el de Mapbox respondió 429 con nuestra cuenta (D21).
  function agregaRelieve() {
    var primerRotulo = (mapa.getStyle().layers.filter(function (l) { return l.type === 'symbol'; })[0] || {}).id;
    mapa.addSource('satelite', {
      type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imagen satelital: Esri, Maxar, Earthstar Geographics'
    });
    mapa.addLayer({ id: 'satelite', type: 'raster', source: 'satelite', layout: { visibility: 'none' } }, primerRotulo);
    $('chkSatelite').onchange = function () { mapa.setLayoutProperty('satelite', 'visibility', this.checked ? 'visible' : 'none'); };
    if (MB) {
      mapa.addSource('dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
    } else {
      mapa.addSource('dem', {
        type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 13,
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        attribution: 'Relieve: Mapzen Terrarium (AWS)'
      });
    }
    mapa.addLayer({ id: 'relieve', type: 'hillshade', source: 'dem', layout: { visibility: 'none' },
      paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#5b6974', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#5b6974' } }, primerRotulo);
    $('chkRelieve').onchange = function () { mapa.setLayoutProperty('relieve', 'visibility', this.checked ? 'visible' : 'none'); };
  }

  // ---------------------------------------------------------------- cuenca
  function agregaCuenca(cuenca, subcuencas) {
    var anillo = cuenca.features[0].geometry.coordinates[0];
    var mundo = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    mapa.addSource('mascara', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mundo, anillo] } } });
    mapa.addLayer({ id: 'mascara', type: 'fill', source: 'mascara', paint: { 'fill-color': '#f3f5f6', 'fill-opacity': 0.8 } });
    mapa.addSource('subcuencas', { type: 'geojson', data: subcuencas });
    mapa.addLayer({ id: 'subcuencas', type: 'line', source: 'subcuencas',
      paint: { 'line-color': '#7b6a52', 'line-width': 0.8, 'line-opacity': 0.55, 'line-dasharray': [4, 3] } });
    mapa.addSource('cuenca', { type: 'geojson', data: cuenca });
    mapa.addLayer({ id: 'cuenca', type: 'line', source: 'cuenca', paint: { 'line-color': TINTA, 'line-width': 1.8 } });
  }

  // ---------------------------------------------------------------- ríos
  function agregaRios(red, toponimia) {
    mapa.addSource('rios', { type: 'geojson', data: red });
    var ancho = function (k) { return ['match', ['get', 'orden'], 7, 1.7 * k, 6, 1.1 * k, 5, 0.7 * k, 0.4 * k]; };
    mapa.addLayer({ id: 'rios', type: 'line', source: 'rios',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': AGUA, 'line-opacity': 0.95,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, ancho(1), 10, ancho(1.8), 13, ancho(2.6)] } });
    var nombres = { type: 'FeatureCollection', features: toponimia.features.filter(function (f) {
      return ROTULOS.indexOf(sinAcentos(f.properties.nombre)) >= 0;
    }).map(function (f) { return { type: 'Feature', geometry: f.geometry, properties: { n: inicial(f.properties.nombre) } }; }) };
    mapa.addSource('nombres_rios', { type: 'geojson', data: nombres });
    mapa.addLayer({ id: 'nombres_rios', type: 'symbol', source: 'nombres_rios', minzoom: 8.5,
      layout: { 'text-field': ['get', 'n'], 'text-font': ITALICA, 'text-size': 12, 'text-offset': [0, -0.8] },
      paint: { 'text-color': '#14527a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
  }

  // Confluencias: dónde se juntan los ríos grandes. Se rotulan solo las que el INEGI
  // nombra como río en ambos brazos; las demás dan su nombre al pasar el cursor.
  function agregaConfluencias(g) {
    g.features.forEach(function (f) {
      var p = f.properties;
      var ok = p.principal && p.afluente && /^r[ií]o /i.test(p.principal) && /^r[ií]o /i.test(p.afluente);
      p.rotulo = ok ? [p.principal, p.afluente].map(function (n) { return inicial(n).replace(/^R[ií]o /, ''); }).join(' y ') : '';
      p.mayor = p.rango <= 4;
      p.detalle = [p.principal, p.afluente].filter(Boolean).map(inicial).join(' y ') || 'Cauces sin nombre en el INEGI';
    });
    mapa.addSource('confluencias', { type: 'geojson', data: g });
    mapa.addLayer({ id: 'confluencias', type: 'circle', source: 'confluencias',
      paint: { 'circle-radius': ['case', ['get', 'mayor'], 5, 4], 'circle-color': '#fff', 'circle-stroke-color': AGUA,
        'circle-stroke-width': ['case', ['get', 'mayor'], 2, 1.5] } });
    mapa.addLayer({ id: 'confluencias_rotulo', type: 'symbol', source: 'confluencias', filter: ['!=', ['get', 'rotulo'], ''],
      layout: { 'text-field': ['get', 'rotulo'], 'text-font': ITALICA, 'text-size': 11.5, 'text-anchor': 'left', 'text-offset': [0.9, 0] },
      paint: { 'text-color': '#14527a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
    emergente('confluencias', function (p) {
      return '<b>Confluencia</b><br>' + p.detalle + '<br>Red aguas arriba: ' + miles(p.km_red_principal) + ' y ' + miles(p.km_red_afluente) + ' km';
    });
  }

  // Sitios oficiales en gris: el semáforo de CONAGUA no distingue entre ellos (D9).
  function agregaSitios(g) {
    g.features = g.features.filter(function (f) { return f.geometry; });
    mapa.addSource('sitios', { type: 'geojson', data: g });
    mapa.addLayer({ id: 'sitios', type: 'circle', source: 'sitios',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 1.8, 12, 3.5],
        'circle-color': ['case', ['to-boolean', ['get', 'semaforo_conagua']], '#8a979f', '#ffffff'],
        'circle-stroke-color': '#6d7b85', 'circle-stroke-width': 0.8 } });
    $('chkSitios').onchange = function () { mapa.setLayoutProperty('sitios', 'visibility', this.checked ? 'visible' : 'none'); };
    emergente('sitios', function (p) {
      return '<b>' + (p.nombre || p.c_sitio) + '</b><br>' + inicial(p.cuerpo_agua) + '. ' + inicial(p.municipio) + ', ' + inicial(p.estado);
    });
  }

  function emergente(capa, html) {
    var pop = new gl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    mapa.on('mousemove', capa, function (e) {
      mapa.getCanvas().style.cursor = 'pointer';
      pop.setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(mapa);
    });
    mapa.on('mouseleave', capa, function () { mapa.getCanvas().style.cursor = ''; pop.remove(); });
  }

  // ---------------------------------------------------------------- estaciones
  function agregaEstaciones(lista) {
    var ol = $('listaEstaciones');
    lista.forEach(function (e, i) {
      var li = document.createElement('li'); li.id = 'li_' + e.c_estacion;
      li.innerHTML = '<button type="button"><span class="num">' + (i + 1) + '</span><span><b>' + inicial(e.cuerpo_agua) +
        '</b><span class="det">' + inicial(e.municipio) + '</span></span></button>';
      li.querySelector('button').onclick = function () { abre(e); };
      ol.appendChild(li);

      var el = document.createElement('div');
      el.className = 'est-marca'; el.id = 'm_' + e.c_estacion;
      el.innerHTML = '<div class="punto">' + (i + 1) + '</div><div class="nombre">' + inicial(e.cuerpo_agua) + '</div>';
      el.title = e.c_estacion + ' · ' + inicial(e.cuerpo_agua);
      el.onclick = function () { abre(e); };
      marcadores[e.c_estacion] = new gl.Marker({ element: el, anchor: 'left', offset: [-13, 0] }).setLngLat([e.longitud, e.latitud]).addTo(mapa);
    });
    mapa.on('zoom', function () { $('mapa').classList.toggle('zoom-cerca', mapa.getZoom() >= 11.5); });
  }

  function marcaActiva(id) {
    Object.keys(marcadores).forEach(function (k) {
      $('m_' + k).classList.toggle('activa', k === id);
      $('li_' + k).classList.toggle('activa', k === id);
    });
  }

  function abre(e) {
    abierta = e;
    $('detTitulo').textContent = e.c_estacion + ' · ' + inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio);
    $('marco').src = '../dispositivo/simulador/index.html?incrustado=1&vel=300&estacion=' + encodeURIComponent(e.c_estacion) +
      (MOCK ? '&backend=' + encodeURIComponent(MOCK) : '');
    $('app').classList.add('abierto');
    $('detalle').setAttribute('aria-hidden', 'false');
    marcaActiva(e.c_estacion);
    setTimeout(function () { mapa.resize(); mapa.flyTo({ center: [e.longitud, e.latitud], zoom: 13.5, duration: 1200 }); }, 60);
  }
  function cierra() {
    abierta = null;
    $('app').classList.remove('abierto');
    $('detalle').setAttribute('aria-hidden', 'true');
    $('marco').removeAttribute('src');
    marcaActiva(null);
    setTimeout(function () { mapa.resize(); if (vistaCuenca) mapa.fitBounds(vistaCuenca, { padding: 30, duration: 1000 }); }, 60);
  }
  $('btnVolver').onclick = cierra;
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && abierta) cierra(); });

  // ---------------------------------------------------------------- backend
  // Solo marca en rojo la estación con una alerta abierta; sin backend, no muestra nada.
  function consultaBackend() {
    get(MOCK.replace(/\/$/, '') + '/alertas').then(function (d) {
      var abiertas = {};
      d.alertas.forEach(function (a) { if (a.estado === 'Abierta') abiertas[a.c_estacion] = true; });
      Object.keys(marcadores).forEach(function (id) {
        $('m_' + id).classList.toggle('alerta', !!abiertas[id]);
        $('li_' + id).classList.toggle('alerta', !!abiertas[id]);
      });
    }).catch(function () {});
  }
})();

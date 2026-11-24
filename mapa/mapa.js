/* Mapa de la cuenca del Alto Atoyac.
 *
 * Con token de Mapbox (mapa/config.js, no versionado) usa Mapbox GL JS con su estilo claro. Sin
 * token usa MapLibre GL con la base gratuita de OpenFreeMap. El código es el mismo: la API de ambos
 * coincide.
 *
 * Muestra solo lo que se lee de un vistazo: la cuenca, sus ríos (INEGI, scripts/60_red_para_mapa.py)
 * con el flujo animado aguas abajo (casilla "Flujo del agua"), las confluencias principales y las 5
 * estaciones (contrato/fixtures). Abre en la zona de la red (scripts/96_red_estaciones.py). Al elegir
 * una estación el mapa se acerca y se abre su simulador en un marco. Sin satélite, relieve ni sitios
 * oficiales: se quitaron para que el mapa diga una sola cosa.
 *
 * La base es solo contexto: se apagan sus ríos para que la red del INEGI sea lo único que se lee
 * como agua.
 *
 * Frontera: el mapa NO importa código del simulador. Lo muestra por URL y se
 * entera de las alertas leyendo el backend por el contrato (GET /alertas).
 * ?mock=http://127.0.0.1:8080 es el backend por defecto en tu computadora; desplegado, /api del mismo
 * dominio; ?mock= lo desactiva.
 */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  // En tu computadora, el mock o el backend en el 8080. Desplegado (Vercel), el backend del mismo dominio
  // en /api, igual que el simulador: así el mapa marca las alertas que ve el panel.
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  var MOCK = Q.has('mock') ? Q.get('mock') : (LOCAL ? 'http://127.0.0.1:8080' : location.origin + '/api');
  var $ = function (id) { return document.getElementById(id); };
  var AGUA = '#1d6fa5', TINTA = '#16222c';
  var VALSEQUILLO = 'DLPUE2068';     // presa Manuel Ávila Camacho: donde termina la red de estaciones
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
  // no-cache: revalida con el servidor, para que un fixture regenerado se vea sin vaciar la caché
  function get(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }

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
  mapa.addControl(new gl.AttributionControl({ compact: true, customAttribution: 'Ríos: INEGI · Estaciones sobre sitios de CONAGUA' }), 'bottom-right');
  window.mapaAtoyac = mapa;

  var marcadores = {}, vistaRed = null, abierta = null;

  var datos = Promise.all([
    get('../datos/procesados/mapa/cuenca.geojson'),
    get('../datos/procesados/mapa/red_hidrografica.geojson'),
    get('../datos/procesados/mapa/confluencias.geojson'),
    get('../datos/procesados/mapa/toponimia_hidrografica.geojson'),
    get('../contrato/fixtures/sitios.geojson'),
    get('../contrato/fixtures/estaciones.json'),
    get('../datos/procesados/mapa/red_vigilada.geojson')
  ]);
  var estilo = new Promise(function (ok) { mapa.on('load', ok); });

  Promise.all([datos, estilo]).then(function (r) {
    var d = r[0];
    apagaBase();
    agregaCuenca(d[0]);
    agregaRios(d[1], d[3], d[6]);
    agregaConfluencias(d[2]);
    agregaEstaciones(d[5].estaciones);
    // Se abre en la zona de la red: los tramos vigilados, las estaciones y la presa de Valsequillo,
    // donde termina. La cuenca completa sigue a la vista al alejar.
    var puntos = [];
    d[6].features.forEach(function (f) {
      (f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates])
        .forEach(function (l) { puntos.push.apply(puntos, l); });
    });
    d[5].estaciones.forEach(function (e) { puntos.push([e.longitud, e.latitud]); });
    d[4].features.forEach(function (f) { if (f.properties.c_sitio === VALSEQUILLO) puntos.push(f.geometry.coordinates); });
    vistaRed = limites(puntos);
    mapa.fitBounds(vistaRed, { padding: 50, duration: 0 });
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
  // La base es solo contexto: se apagan sus ríos (no son los del INEGI), sus calles, carreteras y
  // vías, y los rótulos de comercios. Las fronteras estatales quedan en gris muy claro. Así las únicas
  // líneas fuertes del mapa son el contorno de la cuenca y los ríos.
  function apagaBase() {
    mapa.getStyle().layers.forEach(function (l) {
      if (/waterway/.test(l.id)) mapa.setLayoutProperty(l.id, 'visibility', 'none');
      else if (l.type === 'line' && /(road|street|highway|motorway|bridge|tunnel|rail|transit|ferry|path|aeroway)/.test(l.id)) mapa.setLayoutProperty(l.id, 'visibility', 'none');
      else if (l.type === 'line' && /(admin|boundar)/.test(l.id)) { mapa.setPaintProperty(l.id, 'line-color', '#d3d9dd'); mapa.setPaintProperty(l.id, 'line-opacity', 0.7); }
      else if (l.type === 'symbol' && /(poi|road|highway|transport|housenum|water_name|aeroway)/.test(l.id)) mapa.setLayoutProperty(l.id, 'visibility', 'none');
      else if (l.type === 'symbol' && l.layout && l.layout['text-field']) mapa.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', NOMBRE_ES], ['get', 'name']]);
    });
    // la atribución queda plegada en el botón "i"
    var at = document.querySelector('.' + CSS + '-ctrl-attrib');
    if (at) at.classList.remove(CSS + '-compact-show');
  }
  // ---------------------------------------------------------------- cuenca
  function agregaCuenca(cuenca) {
    var anillo = cuenca.features[0].geometry.coordinates[0];
    var mundo = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    mapa.addSource('mascara', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mundo, anillo] } } });
    mapa.addLayer({ id: 'mascara', type: 'fill', source: 'mascara', paint: { 'fill-color': '#f3f5f6', 'fill-opacity': 0.8 } });
    // las subcuencas ya no se dibujan: eran una línea discontinua más que se confundía con las de la base
    mapa.addSource('cuenca', { type: 'geojson', data: cuenca });
    mapa.addLayer({ id: 'cuenca', type: 'line', source: 'cuenca', paint: { 'line-color': TINTA, 'line-width': 1.8 } });
  }

  // ---------------------------------------------------------------- ríos
  // Un solo estilo para todos los ríos: el mismo azul, con el grosor creciendo poco con el tamaño del
  // río (orden 4 a 7). Encima, el flujo: guiones blancos del mismo grosor que el río que corren aguas
  // abajo en toda la red. Las líneas del INEGI están trazadas en el sentido del flujo.
  function agregaRios(red, toponimia, vigilada) {
    var ancho = function (k) { return ['match', ['get', 'orden'], 7, 1.6 * k, 6, 1.3 * k, 5, 1.05 * k, 0.85 * k]; };
    var grosor = ['interpolate', ['linear'], ['zoom'], 7, ancho(1), 10, ancho(1.7), 13, ancho(2.6)];
    var trazo = { 'line-color': AGUA, 'line-opacity': 0.9, 'line-width': grosor };
    mapa.addSource('rios', { type: 'geojson', data: red });
    mapa.addLayer({ id: 'rios', type: 'line', source: 'rios', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: trazo });
    // los tramos que llegan a una estación desde un cauce menor (no están en la red del mapa), igual que el resto
    mapa.addSource('rios_vigilados', { type: 'geojson', data: vigilada });
    mapa.addLayer({ id: 'rios_vigilados', type: 'line', source: 'rios_vigilados', filter: ['==', ['get', 'conexion'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: trazo });
    // el flujo: guiones blancos del mismo grosor que el río, que avanzan aguas abajo en todos los ríos
    // del mapa y en los tramos que conectan una estación con ellos. Se apaga con la casilla "Flujo del agua".
    mapa.addImage('flujo', IMAGEN_FLUJO, { pixelRatio: 2 });
    var guiones = { 'line-pattern': 'flujo', 'line-opacity': 0.9, 'line-width': grosor };
    mapa.addLayer({ id: 'flujo', type: 'line', source: 'rios', layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: guiones });
    mapa.addLayer({ id: 'flujo_conexion', type: 'line', source: 'rios_vigilados', filter: ['==', ['get', 'conexion'], true],
      layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: guiones });
    var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('chkFlujo').checked = !quieto;
    $('chkFlujo').onchange = function () { flujo(this.checked); };
    flujo(!quieto);
    var nombres = { type: 'FeatureCollection', features: toponimia.features.filter(function (f) {
      return ROTULOS.indexOf(sinAcentos(f.properties.nombre)) >= 0;
    }).map(function (f) { return { type: 'Feature', geometry: f.geometry, properties: { n: inicial(f.properties.nombre) } }; }) };
    mapa.addSource('nombres_rios', { type: 'geojson', data: nombres });
    mapa.addLayer({ id: 'nombres_rios', type: 'symbol', source: 'nombres_rios', minzoom: 8.5,
      layout: { 'text-field': ['get', 'n'], 'text-font': ITALICA, 'text-size': 12, 'text-offset': [0, -0.8] },
      paint: { 'text-color': '#14527a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
  }

  // El flujo es un patrón de línea (line-pattern) con un guion blanco sobre fondo transparente que se
  // redibuja en cada cuadro corrido unos píxeles. Antes se animaba cambiando line-dasharray: en Mapbox
  // GL 3 esa propiedad obliga a rehacer los teselados de toda la red (8 184 tramos) en cada paso, el mapa
  // se volvía lento y al desplazarlo se dejaban de ver ríos mientras cargaban. Cambiar la imagen solo
  // vuelve a subir 128 × 16 píxeles a la tarjeta gráfica.
  // La textura del patrón avanza con la distancia desde el inicio de la línea; correr el guion hacia la
  // derecha de la imagen lo lleva hacia el final de la línea, que es aguas abajo (en 195 de 245 tramos de
  // red_asignacion.json la línea termina junto a su sitio aguas abajo).
  var PAT_W = 128, PAT_H = 16, GUION = 44, PX_POR_S = 110;     // en píxeles de la imagen (pixelRatio 2)
  var flujoEncendido = true;
  var IMAGEN_FLUJO = {
    width: PAT_W, height: PAT_H, data: new Uint8Array(PAT_W * PAT_H * 4),
    onAdd: function () {},
    render: function () {
      if (!flujoEncendido) return false;
      var x0 = Math.floor(performance.now() / 1000 * PX_POR_S) % PAT_W, d = this.data;
      for (var x = 0; x < PAT_W; x++) {
        var u = (x - x0 + PAT_W) % PAT_W;                     // posición dentro del guion
        var a = u < GUION ? Math.round(235 * Math.min(1, u / 6, (GUION - u) / 6)) : 0;   // bordes suaves
        for (var y = 0; y < PAT_H; y++) {
          var i = (y * PAT_W + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a;
        }
      }
      mapa.triggerRepaint();
      return true;
    }
  };
  function flujo(encendido) {
    flujoEncendido = encendido;
    ['flujo', 'flujo_conexion'].forEach(function (id) { mapa.setLayoutProperty(id, 'visibility', encendido ? 'visible' : 'none'); });
    if (encendido) mapa.triggerRepaint();
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

  function emergente(capa, html) {
    var pop = new gl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
    mapa.on('mousemove', capa, function (e) {
      pop.setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(mapa);
    });
    mapa.on('mouseleave', capa, function () { pop.remove(); });
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

  // ---------------------------------------------------------------- menú plegable
  // El botón pliega la barra a una columna con los números de las estaciones. Al abrir una
  // estación se pliega sola para dar lugar a la zona y al simulador; al cerrar vuelve como estaba.
  var menuElegido = window.innerWidth >= 900;     // abierto por defecto, salvo en pantallas angostas
  function menu(abiertoMenu) {
    $('app').classList.toggle('menu-cerrado', !abiertoMenu);
    $('btnMenu').setAttribute('aria-expanded', String(abiertoMenu));
    $('btnMenu').title = abiertoMenu ? 'Plegar el menú' : 'Desplegar el menú';
  }
  menu(menuElegido);
  $('btnMenu').onclick = function () {
    menuElegido = $('app').classList.contains('menu-cerrado');
    menu(menuElegido);
    reencuadra();
  };
  // El diseño cambia de golpe (sin transición, que obligaba a redibujar el mapa en cada paso); en el
  // cuadro siguiente el mapa toma su nuevo tamaño y se desliza a la zona en 0.6 s.
  var encuadre = null;
  function reencuadra() {
    requestAnimationFrame(function () { mapa.resize(); if (encuadre) encuadre(); });
  }

  function abre(e) {
    abierta = e;
    $('detTitulo').textContent = e.c_estacion + ' · ' + inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio);
    // El simulador arma su escena 3D en el mismo hilo que el mapa: si se carga a la vez, el
    // desplazamiento se detiene un momento. Se carga cuando el mapa termina de moverse.
    var src = '../dispositivo/simulador/index.html?incrustado=1&vel=300&estacion=' + encodeURIComponent(e.c_estacion) +
      (MOCK ? '&backend=' + encodeURIComponent(MOCK) : '');
    $('marco').removeAttribute('src');
    var cargado = false, carga = function () { if (!cargado && abierta === e) { cargado = true; $('marco').src = src; } };
    mapa.once('moveend', carga);
    setTimeout(carga, 900);
    $('app').classList.add('abierto');
    $('detalle').setAttribute('aria-hidden', 'false');
    menu(false);
    marcaActiva(e.c_estacion);
    // la zona: la estación al centro de la columna del mapa, a una escala que deja ver el tramo de río
    encuadre = function () { mapa.easeTo({ center: [e.longitud, e.latitud], zoom: 12.6, duration: 600, essential: true }); };
    reencuadra();
  }
  function cierra() {
    abierta = null;
    $('app').classList.remove('abierto');
    $('detalle').setAttribute('aria-hidden', 'true');
    $('marco').removeAttribute('src');
    menu(menuElegido);
    marcaActiva(null);
    encuadre = function () { if (vistaRed) mapa.fitBounds(vistaRed, { padding: 50, duration: 600, essential: true }); };
    reencuadra();
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

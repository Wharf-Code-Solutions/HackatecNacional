/* Mapa de la cuenca del Alto Atoyac.
 *
 * Datos: red hidrográfica y subcuencas (scripts/60_red_para_mapa.py, de INEGI),
 * los 219 sitios y las 5 estaciones (contrato/fixtures). Al elegir una estación
 * el mapa se acerca y se muestra su simulador en un marco.
 *
 * Frontera: el mapa NO importa código del simulador. Lo muestra por URL
 * (dispositivo/simulador/index.html?incrustado=1&estacion=...) y se entera del
 * estado de las estaciones leyendo el backend por el contrato (GET /alertas).
 *
 * Se sirve desde la raíz del repo:  python -m http.server 8000   →   /mapa/
 * ?mock=http://127.0.0.1:8080 es el backend por defecto; ?mock= lo desactiva.
 */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var MOCK = Q.has('mock') ? Q.get('mock') : 'http://127.0.0.1:8080';
  var $ = function (id) { return document.getElementById(id); };

  var AGUA = '#1d6fa5';
  var PESO = { 4: 1, 5: 1.8, 6: 2.8, 7: 4 };
  // Se rotulan primero los ríos grandes; los de las estaciones aparecen al acercarse.
  var ROTULOS = ['RIO ATOYAC', 'RIO ZAHUAPAN', 'RIO ALSESECA', 'RIO XOPANAC', 'RIO XOCHIAC', 'RIO NEXAPA', 'RIO ATENCO'];
  var MAYORES = ['RIO ATOYAC', 'RIO ZAHUAPAN', 'RIO NEXAPA'];

  function sinAcentos(t) { return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  // Título de nombres propios: "RÍO ATOYAC" -> "Río Atoyac", "PAPALOTLA DE XICOHTÉNCATL" -> "Papalotla de Xicohténcatl".
  function inicial(t) {
    return (t || '').toLowerCase().replace(/(^|[\s(])([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/ (De|Del|La|Las|El|Los|Y) /g, function (m) { return m.toLowerCase(); });
  }
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }

  var mapa = L.map('mapa', { preferCanvas: true, zoomControl: true, zoomSnap: 0.25, attributionControl: false });
  mapa.setView([19.1, -98.28], 10);      // vista inicial antes de agregar capas: el canvas la necesita
  // Fondo: solo relieve en gris (sin calles ni ríos propios) y, encima, los nombres de lugares.
  // Así la red del INEGI es lo único que se lee como agua. Teselas de Esri, sin llave.
  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  L.tileLayer(ESRI + 'Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 18, maxNativeZoom: 13, className: 'base-relieve' }).addTo(mapa);
  L.tileLayer(ESRI + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 18, maxNativeZoom: 16, className: 'base-nombres' }).addTo(mapa);
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(mapa);
  window.mapaAtoyac = mapa;              // para depurar desde la consola

  var capas = { rios: L.layerGroup(), sub: L.layerGroup(), sitios: L.layerGroup() };
  var marcadores = {};                   // c_estacion -> { marca, estacion }
  var vistaCuenca = null, vistaEstaciones = null, abierta = null;

  function ajustaZoom() {
    var z = mapa.getZoom(), m = $('mapa');
    m.classList.toggle('zoom-bajo', z < 11);
    m.classList.toggle('zoom-cerca', z >= 11.5);
  }
  mapa.on('zoomend', ajustaZoom);

  Promise.all([
    get('../datos/procesados/mapa/subcuencas.geojson'),
    get('../datos/procesados/mapa/red_hidrografica.geojson'),
    get('../datos/procesados/mapa/toponimia_hidrografica.geojson'),
    get('../contrato/fixtures/sitios.geojson'),
    get('../contrato/fixtures/estaciones.json')
  ]).then(function (d) {
    pintaSubcuencas(d[0]); pintaRios(d[1]); pintaRotulos(d[2]); pintaSitios(d[3]);
    var est = d[4].estaciones;
    pintaEstaciones(est);
    Object.keys(capas).forEach(function (k) { capas[k].addTo(mapa); });
    vistaCuenca = L.geoJSON(d[0]).getBounds().pad(0.03);
    vistaEstaciones = L.latLngBounds(est.map(function (e) { return [e.latitud, e.longitud]; })).pad(0.7);
    mapa.fitBounds(vistaEstaciones);
    ajustaZoom();
    consultaBackend(); setInterval(consultaBackend, 3000);
  }).catch(function (e) {
    $('estadoMock').textContent = 'No se pudieron leer los datos (' + e.message + '). Sirve el repo desde su raíz con python -m http.server 8000 y, si falta la red, corre python -I scripts/60_red_para_mapa.py.';
    $('estadoMock').className = 'nota estado';
  });

  // ------------------------------------------------------------------- capas
  function pintaSubcuencas(g) {
    L.geoJSON(g, {
      style: { color: '#7b6a52', weight: 1, dashArray: '6 4', fill: false },
      onEachFeature: function (f, capa) {
        var p = f.properties;
        capa.bindTooltip('<b>' + p.nombre + '</b><br>' + p.area_km2.toLocaleString('es-MX') + ' km²' +
          (p.drena_a.length ? '. Drena a ' + p.drena_a.join(', ') + '.' : '. Salida de la cuenca.'), { sticky: true });
      }
    }).eachLayer(function (l) { capas.sub.addLayer(l); });
  }

  function pintaRios(g) {
    L.geoJSON(g, {
      style: function (f) { return { color: AGUA, weight: PESO[f.properties.orden] || 1, opacity: 0.9, lineCap: 'round' }; },
      interactive: false
    }).eachLayer(function (l) { capas.rios.addLayer(l); });
  }

  function pintaRotulos(g) {
    g.features.forEach(function (f) {
      var n = sinAcentos(f.properties.nombre);
      if (ROTULOS.indexOf(n) < 0) return;
      capas.rios.addLayer(L.marker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
        interactive: false,
        icon: L.divIcon({ className: '', iconSize: [0, 0],
          html: '<div class="rio-rotulo ' + (MAYORES.indexOf(n) >= 0 ? 'mayor' : 'menor') + '">' + inicial(f.properties.nombre) + '</div>' })
      }));
    });
  }

  // Los sitios van en gris. El semáforo de CONAGUA no distingue entre ellos (176 de 198 con dato están en
  // rojo), así que pintarlo ensuciaría el mapa sin informar. Su valor sigue en el tooltip.
  function pintaSitios(g) {
    var sin = 0, n = 0;
    g.features.forEach(function (f) {
      if (!f.geometry) return;
      n++;
      var p = f.properties, tiene = !!p.semaforo_conagua;
      if (!tiene) sin++;
      capas.sitios.addLayer(L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
        radius: 2.6, weight: 1, color: '#6d7b85', fillColor: tiene ? '#8a979f' : '#fff', fillOpacity: tiene ? 0.75 : 1
      }).bindTooltip('<b>' + (p.nombre || p.c_sitio) + '</b><br>' + inicial(p.cuerpo_agua) + '. ' + inicial(p.municipio) + ', ' + inicial(p.estado) +
        '.<br>Semáforo de CONAGUA: ' + (tiene ? inicial(p.semaforo_conagua) : 'sin dato') + '.', { direction: 'top' }));
    });
    $('notaSitios').textContent = n + ' sitios, ' + sin + ' sin dato de semáforo (círculo vacío). Se muestran en gris: el semáforo no distingue entre ellos.';
  }

  function pintaEstaciones(lista) {
    var ol = $('listaEstaciones');
    lista.forEach(function (e, i) {
      var li = document.createElement('li'); li.id = 'li_' + e.c_estacion;
      li.innerHTML = '<button type="button"><span class="num">' + (i + 1) + '</span><span><b>' + inicial(e.cuerpo_agua) +
        '</b><span class="det">' + inicial(e.municipio) + ', ' + inicial(e.estado) + '</span><span class="det aviso" hidden>Alerta abierta</span></span></button>';
      li.querySelector('button').onclick = function () { abre(e); };
      ol.appendChild(li);

      var icono = L.divIcon({
        className: '', iconSize: [26, 26], iconAnchor: [13, 13],
        html: '<div class="est-marca" id="m_' + e.c_estacion + '"><div class="punto">' + (i + 1) + '</div><div class="nombre">' + inicial(e.cuerpo_agua) + '</div></div>'
      });
      var m = L.marker([e.latitud, e.longitud], { icon: icono, zIndexOffset: 1000, title: e.c_estacion }).addTo(mapa);
      m.bindTooltip('<b>' + e.c_estacion + '</b><br>' + inicial(e.cuerpo_agua) + '. ' + inicial(e.municipio) + '.', { direction: 'top', offset: [0, -14] });
      m.on('click', function () { abre(e); });
      marcadores[e.c_estacion] = { marca: m, estacion: e };
    });
  }

  // capas activables
  [['chkRios', 'rios'], ['chkSub', 'sub'], ['chkSitios', 'sitios']].forEach(function (par) {
    $(par[0]).onchange = function () { if (this.checked) capas[par[1]].addTo(mapa); else mapa.removeLayer(capas[par[1]]); };
  });
  $('btnCuenca').onclick = function () { if (vistaCuenca) mapa.flyToBounds(vistaCuenca, { duration: 1 }); };

  // --------------------------------------------------------------- detalle
  function marcaActiva(id) {
    Object.keys(marcadores).forEach(function (k) {
      var n = $('m_' + k), li = $('li_' + k);
      if (n) n.classList.toggle('activa', k === id);
      if (li) li.classList.toggle('activa', k === id);
    });
  }

  function abre(e) {
    abierta = e;
    $('detTitulo').textContent = e.c_estacion + ' · ' + inicial(e.cuerpo_agua);
    $('detSub').textContent = inicial(e.municipio) + ', ' + inicial(e.estado) + ' · sitio ' + e.c_sitio;
    $('marco').src = '../dispositivo/simulador/index.html?incrustado=1&vel=60&estacion=' + encodeURIComponent(e.c_estacion) +
      (MOCK ? '&backend=' + encodeURIComponent(MOCK) : '');
    $('app').classList.add('abierto');
    $('detalle').setAttribute('aria-hidden', 'false');
    marcaActiva(e.c_estacion);
    setTimeout(function () { mapa.invalidateSize(); mapa.flyTo([e.latitud, e.longitud], 14, { duration: 1.2 }); }, 60);
  }

  function cierra() {
    abierta = null;
    $('app').classList.remove('abierto');
    $('detalle').setAttribute('aria-hidden', 'true');
    $('marco').removeAttribute('src');
    marcaActiva(null);
    setTimeout(function () { mapa.invalidateSize(); if (vistaEstaciones) mapa.flyToBounds(vistaEstaciones, { duration: 1 }); }, 60);
  }
  $('btnVolver').onclick = cierra;
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && abierta) cierra(); });

  // ----------------------------------------------------------------- backend
  function consultaBackend() {
    var s = $('estadoMock');
    if (!MOCK) { s.textContent = 'Backend desactivado.'; return; }
    get(MOCK.replace(/\/$/, '') + '/alertas').then(function (d) {
      var abiertas = {};
      d.alertas.forEach(function (a) { if (a.estado === 'Abierta') abiertas[a.c_estacion] = true; });
      Object.keys(marcadores).forEach(function (id) {
        var n = $('m_' + id), li = $('li_' + id);
        if (n) n.classList.toggle('alerta', !!abiertas[id]);
        if (li) { li.classList.toggle('alerta', !!abiertas[id]); li.querySelector('.aviso').hidden = !abiertas[id]; }
      });
      s.className = 'nota estado ok';
      s.textContent = 'Backend conectado. Alertas del evaluador provisional: ' + d.alertas.length + '.';
    }).catch(function () {
      s.className = 'nota estado mal';
      s.textContent = 'Backend sin conexión. Arranca python contrato/servidor_mock.py para ver alertas. El mapa funciona sin él.';
    });
  }
})();

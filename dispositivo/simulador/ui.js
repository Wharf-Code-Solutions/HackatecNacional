/* Interfaz del simulador. Presenta lo esencial y entrega órdenes: la lógica del
 * dispositivo vive en modelo.js y firmware.js, y el dibujo en escena.js.
 *
 * Muestra tres cosas: qué mide la estación, qué análisis devuelve la plataforma
 * (el veredicto del backend, no un cálculo de esta pantalla) y si hay alarma.
 *
 * Corre las 5 estaciones del piloto con el mismo reloj. Los datos de entrada se
 * leen de contrato/fixtures/, así que se sirve el repo desde su raíz:
 *     python -m http.server 8000   →   /dispositivo/simulador/
 *
 * Parámetros de URL, para que otro módulo lo muestre sin importar su código:
 *     ?estacion=EST-ATY-01  ?incrustado=1  ?vel=60  ?backend=http://127.0.0.1:8080
 */
(function () {
  'use strict';
  var M = window.Modelo, Mont = window.Montaje;
  var NOMBRE = { OD: 'Oxígeno disuelto', PH: 'pH', COND: 'Conductividad', TEMP: 'Temperatura', TURB: 'Turbiedad' };
  var DEC = { OD: 2, PH: 2, COND: 0, TEMP: 1, TURB: 0 };
  var COMO = {
    OD: 'Sonda óptica. Una luz azul excita un colorante en la punta y el oxígeno apaga su brillo: con más oxígeno el brillo dura menos, y se mide cuánto dura.',
    PH: 'Electrodo de vidrio. La membrana genera un voltaje que cambia unos 59 mV por unidad de pH; a pH 7 es cero.',
    COND: 'Celda de dos electrodos. Con más sales disueltas pasa más corriente por el agua entre ellos.',
    TEMP: 'PT1000. Un hilo de platino cambia su resistencia con la temperatura. También corrige a las demás sondas.',
    TURB: 'Dispersión de luz a 90°. Un LED ilumina el agua y un detector mide la luz que rebotan las partículas.'
  };
  var DESC = {
    'CALENTAMIENTO': 'alimenta las sondas y espera a que la lectura se estabilice',
    'MEDICIÓN': 'cada sonda toma 5 lecturas y se reporta la mediana',
    'EMPAQUETADO': 'arma el JSON del contrato y lo guarda en la tarjeta SD',
    'ENLACE': 'el módem busca la red celular',
    'ENVÍO': 'POST /lecturas; solo tras la confirmación se borra de la SD',
    'ESPERA': 'no hubo red, espera y reintenta',
    'APAGADA': 'batería crítica, se apaga hasta recuperar carga solar'
  };
  var EST = { 'CALENTAMIENTO': 'Calentando sondas', 'MEDICIÓN': 'Midiendo', 'EMPAQUETADO': 'Guardando el paquete', 'ENLACE': 'Conectando', 'ENVÍO': 'Enviando', 'ESPERA': 'Sin red, reintenta', 'APAGADA': 'Apagada' };
  var VELOCIDADES = [1, 15, 60, 300, 900, 3600];
  var FALLAS = [['ninguna', 'Sana'], ['congelado', 'Valor congelado'], ['sin_respuesta', 'Sin respuesta (null)'], ['menos999', 'Devuelve -999']];
  var ALARMA = '#b3261e';
  var VENTANA_ALARMA = 3600;          // una alarma sigue vigente 1 h simulada

  var estado = { est: [], por: {}, sel: null, vel: 300, pausa: false, backend: false, bk: {} };
  var $ = function (id) { return document.getElementById(id); };

  // ----------------------------------------------------------------------- carga
  Promise.all([
    fetch('../../contrato/fixtures/estaciones.json').then(function (r) { return r.json(); }),
    fetch('../../contrato/fixtures/linea_base.json').then(function (r) { return r.json(); })
  ]).then(function (d) { arranca(d[0].estaciones, d[1]); }).catch(function (e) {
    var a = $('aviso'); a.hidden = false;
    a.innerHTML = 'No se pudieron leer los fixtures del contrato (' + e.message + '). Sirve el repositorio desde su raíz con ' +
      '<code>python -m http.server 8000</code> y abre <code>http://127.0.0.1:8000/dispositivo/simulador/</code>.';
  });

  function crea() {
    estado.por = {}; estado.bk = {};
    estado.est.forEach(function (e) {
      var id = e.c_estacion;
      estado.bk[id] = { ok: 0, mal: 0, ultimo: null, veredicto: null, alertas: [], recibido: null, codigo: null, motor: null };
      estado.por[id] = Mont.crearEstacion(e, estado.linea, { alEvento: function (ev) { alEvento(id, ev); } });
    });
    estado.ultimo = performance.now();
  }

  function arranca(estaciones, linea) {
    estado.est = estaciones; estado.linea = linea; estado.sel = estaciones[0].c_estacion;
    crea();

    var se = $('selEstacion');
    estaciones.forEach(function (e) {
      var o = document.createElement('option'); o.value = e.c_estacion; o.textContent = e.c_estacion + ' · ' + nombre(e.cuerpo_agua); se.appendChild(o);
    });
    se.onchange = function () { estado.sel = se.value; refrescaControles(); };
    var sv = $('selVel');
    VELOCIDADES.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v + '×'; sv.appendChild(o); });
    sv.onchange = function () { estado.vel = +sv.value; };

    $('btnPausa').onclick = function () { estado.pausa = !estado.pausa; this.textContent = estado.pausa ? 'Reanudar' : 'Pausar'; estado.ultimo = performance.now(); };
    Array.prototype.forEach.call(document.querySelectorAll('.ev'), function (b) {
      b.onclick = function () { actual().agua.agregaEvento(b.dataset.ev, actual().fw.t); };
    });
    $('btnCorte').onclick = function () { var s = actual(); s.enlace.caido = !s.enlace.caido; refrescaControles(); };
    $('selClima').onchange = function () { actual().energia.clima = parseFloat(this.value); };
    $('btnEnvejecer').onclick = function () { var s = actual(); M.PARAMS.forEach(function (p) { s.sondas[p].tCal -= 30 * 86400; s.sondas[p].tLimpieza -= 30 * 86400; }); };
    $('btnCalibrar').onclick = function () { var s = actual(); M.PARAMS.forEach(function (p) { s.sondas[p].calibrar(s.fw.t); }); };
    $('btnLimpiar').onclick = function () { var s = actual(); s.sondas.TURB.limpiar(s.fw.t); s.sondas.OD.limpiar(s.fw.t); };
    $('chkBackend').onchange = function () { estado.backend = this.checked; actualizaBackend(); };

    var f = $('fallas');
    M.PARAMS.forEach(function (p) {
      var lab = document.createElement('label'); lab.textContent = NOMBRE[p].split(' ')[0];
      var s = document.createElement('select'); s.id = 'falla_' + p;
      FALLAS.forEach(function (x) { var o = document.createElement('option'); o.value = x[0]; o.textContent = x[1]; s.appendChild(o); });
      s.onchange = function () { actual().sondas[p].falla = s.value; };
      lab.appendChild(s); f.appendChild(lab);
    });

    construyeTabla();
    Escena.construye();
    aplicaParametros();
    $('selVel').value = String(estado.vel);
    refrescaControles();
    requestAnimationFrame(bucle);
  }

  function aplicaParametros() {
    var q = new URLSearchParams(location.search);
    if (q.get('estacion') && estado.por[q.get('estacion')]) { estado.sel = q.get('estacion'); $('selEstacion').value = estado.sel; }
    if (q.get('incrustado')) document.body.classList.add('incrustado');
    if (q.get('vel') && VELOCIDADES.indexOf(+q.get('vel')) >= 0) estado.vel = +q.get('vel');
    if (q.get('backend')) { $('urlBackend').value = q.get('backend'); $('chkBackend').checked = true; estado.backend = true; }
  }

  function actual() { return estado.por[estado.sel]; }
  function nombre(t) {
    return (t || '').toLowerCase().replace(/(^|[\s(])([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/ (De|Del|La|Las|El|Los|Y) /g, function (m) { return m.toLowerCase(); });
  }

  function refrescaControles() {
    var s = actual(), e = s.est;
    $('titulo').textContent = e.c_estacion + ' · ' + nombre(e.cuerpo_agua);
    $('subtitulo').textContent = nombre(e.municipio) + ', ' + nombre(e.estado) + ' · sitio ' + e.c_sitio;
    document.title = e.c_estacion + ' · simulador de la estación';
    $('btnCorte').textContent = s.enlace.caido ? 'Restablecer enlace' : 'Cortar enlace';
    $('btnCorte').classList.toggle('activo', s.enlace.caido);
    $('selClima').value = String(s.energia.clima);
    M.PARAMS.forEach(function (p) { $('falla_' + p).value = s.sondas[p].falla; });
    actualizaBackend();
  }

  // ------------------------------------------------------------------- backend
  function alEvento(id, ev) {
    if (ev.tipo === 'envio' && estado.backend) posta(id, ev.datos);
  }
  function posta(id, lote) {
    var url = $('urlBackend').value.replace(/\/$/, '') + '/lecturas';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lote) })
      .then(function (r) {
        var b = estado.bk[id];
        b.codigo = 'Respuesta ' + r.status; b.ultimo = 'HTTP ' + r.status;
        if (r.status === 202 || r.status === 200) b.ok++; else b.mal++;
        return r.json().then(function (d) {
          (d.veredictos || []).forEach(function (v) {
            b.veredicto = v; b.motor = v.motor; b.recibido = v.fecha_hora.substr(11, 5);
            (v.alertas || []).forEach(function (a) { b.alertas.push(a); });
          });
        }).catch(function () {});
      })
      .then(actualizaBackend)
      .catch(function () { var b = estado.bk[id]; b.mal++; b.ultimo = 'sin conexión'; b.codigo = 'Sin conexión'; actualizaBackend(); });
  }
  function actualizaBackend() {
    var b = estado.bk[estado.sel], n = $('estadoBackend');
    if (!estado.backend) { n.textContent = 'Desactivado. Arranca python contrato/servidor_mock.py y marca la casilla.'; n.style.color = ''; return; }
    n.textContent = 'Lotes aceptados: ' + b.ok + '. Rechazados o sin conexión: ' + b.mal + (b.ultimo ? '. Último: ' + b.ultimo + '.' : '.');
    n.style.color = b.mal ? ALARMA : '';
  }

  // ------------------------------------------------------------------- tabla
  function construyeTabla() {
    var tb = document.querySelector('#lecturas tbody'); tb.innerHTML = '';
    M.PARAMS.forEach(function (p) {
      var tr = document.createElement('tr'); tr.id = 'fila_' + p;
      tr.innerHTML = '<td><details><summary>' + NOMBRE[p] + '</summary><p>' + COMO[p] + '</p></details></td>' +
        '<td class="valor d" data-c="valor">—</td><td class="rango d" data-c="rango"></td><td data-c="analisis" class="sin">—</td>';
      tb.appendChild(tr);
    });
  }
  function celda(p, c) { return $('fila_' + p).querySelector('[data-c=' + c + ']'); }

  function pintaTabla(s) {
    var b = estado.bk[estado.sel], v = estado.backend ? b.veredicto : null, fw = s.fw;
    M.PARAMS.forEach(function (p) {
      var d = fw.detalleMed[p], L = s.linea[p], u = M.ESPEC[p].unidad;
      celda(p, 'valor').innerHTML = d ? (d.valor === null ? '<small>sin respuesta</small>' : fmt(d.valor, DEC[p]) + ' <small>' + u + '</small>') : '—';
      celda(p, 'rango').innerHTML = fmt(L.p10, DEC[p]) + ' a ' + fmt(L.p90, DEC[p]) + ' <small>n = ' + L.n + ', último dato ' + L.ultima_fecha + '</small>';
      var a = celda(p, 'analisis'), txt = '—', cls = 'sin';
      if (!estado.backend) txt = 'Plataforma desconectada';
      else if (v) {
        var item = v.parametros.filter(function (x) { return x.c_parametro === p; })[0];
        var aviso = v.avisos_tecnicos.filter(function (x) { return x.c_parametro === p; })[0];
        if (aviso) { txt = 'Falla del sensor: ' + aviso.detalle; cls = 'fuera'; }
        else if (item) {
          var pos = item.posicion_en_banda;
          if (pos === 'normal') { txt = 'Normal'; cls = ''; }
          else if (pos === 'sobre_p90') { txt = 'Sobre lo habitual'; cls = 'fuera'; }
          else if (pos === 'bajo_p10') { txt = 'Bajo lo habitual'; cls = 'fuera'; }
          else txt = 'Sin línea base';
        }
      } else txt = 'Esperando el primer paquete';
      a.textContent = txt; a.className = cls;
    });
    $('notaAnalisis').textContent = !estado.backend
      ? 'El análisis lo hace la plataforma: conéctala en "Más pruebas" para ver el resultado.'
      : (b.recibido ? 'Análisis del paquete de las ' + b.recibido + '. Una alarma se emite tras 3 lecturas seguidas fuera de lo habitual.' : '');
  }
  function fmt(v, d) { return v === null || v === undefined ? '—' : v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  // ------------------------------------------------------------------- paneles
  function alarmaVigente(s) {
    var b = estado.bk[estado.sel], ult = null;
    b.alertas.forEach(function (a) {
      var t = Date.parse(a.fecha_hora) / 1000;
      if (t <= s.fw.t + 1 && s.fw.t - t <= VENTANA_ALARMA) ult = { c_parametro: a.c_parametro, nivel: a.nivel, c_alerta: a.c_alerta, hora: a.fecha_hora.substr(11, 5) };
    });
    return ult;
  }

  function pintaPaneles(s) {
    var fw = s.fw, nom = fw.fase.nombre, b = estado.bk[estado.sel];
    $('relojFecha').textContent = M.iso(fw.t).substr(0, 10);
    $('relojHora').textContent = M.iso(fw.t).substr(11, 8);
    $('faseTexto').textContent = nom === 'SUEÑO'
      ? 'Dormida. Despierta a las ' + M.iso(fw.marcaObjetivo - fw.lead).substr(11, 8) + ' y mide a las ' + M.iso(fw.marcaObjetivo).substr(11, 5) + '.'
      : (EST[nom] || nom) + ': ' + (DESC[nom] || '') + ' (' + Math.ceil(fw.fase.resta) + ' s).';
    if (fw.ultimoPaquete) $('paquete').textContent = JSON.stringify(fw.ultimoPaquete, null, 1).replace(/\n\s+/g, function (m) { return m.length > 4 ? ' ' : '\n '; });
    var dCal = (fw.t - s.sondas.PH.tCal) / 86400, dLimp = (fw.t - s.sondas.TURB.tLimpieza) / 86400;
    $('notaMant').textContent = 'Última calibración hace ' + dCal.toFixed(1) + ' días. Turbiedad sin limpiar hace ' + dLimp.toFixed(1) + ' días.';
    return b;
  }

  function dibuja(s) {
    var b = paneles(s);
    Escena.pinta(s, { backend: estado.backend, alarma: estado.backend ? alarmaVigente(s) : null, recibido: b.recibido, codigo: b.codigo, motor: b.motor });
    pintaTabla(s);
  }
  function paneles(s) { return pintaPaneles(s); }

  // --------------------------------------------------------------------- bucle
  var ultimoPintado = 0;
  function bucle(ahora) {
    var dt = (ahora - estado.ultimo) / 1000; estado.ultimo = ahora;
    if (!estado.pausa) {
      dt = Math.min(dt, 0.25) * estado.vel;
      estado.est.forEach(function (e) { estado.por[e.c_estacion].fw.tick(dt); });
    }
    if (ahora - ultimoPintado > 50) { ultimoPintado = ahora; dibuja(actual()); }
    requestAnimationFrame(bucle);
  }
})();

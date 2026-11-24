/* Interfaz del simulador. Entrega órdenes y reparte el dibujo: la lógica del
 * dispositivo vive en modelo.js y firmware.js, la figura en escena.js y lo que
 * recibe la plataforma en recepcion.js.
 *
 * En pantalla solo hay tres cosas: la estación en 3D, lo que llega a la
 * plataforma y, si la plataforma abre una alerta, una línea en rojo. Nada más.
 *
 * Corre las 5 estaciones del piloto con el mismo reloj. Los datos de entrada se
 * leen de contrato/fixtures/, así que se sirve el repo desde su raíz:
 *     python -m http.server 8000   →   /dispositivo/simulador/
 *
 * Parámetros de URL, para que otro módulo lo muestre sin importar su código:
 *     ?estacion=EST-ATY-01  ?incrustado=1  ?vel=300
 *     ?backend=http://127.0.0.1:8080 (por defecto); ?backend= lo desactiva.
 * Si el backend no responde, el simulador sigue igual y no muestra alertas.
 */
(function () {
  'use strict';
  var M = window.Modelo, Mont = window.Montaje;
  var NOMBRE = { OD: 'Oxígeno disuelto', PH: 'pH', COND: 'Conductividad', TEMP: 'Temperatura', TURB: 'Turbiedad' };
  var VELOCIDADES = [1, 15, 60, 300, 900, 3600];
  var VENTANA_ALARMA = 3600;          // una alarma sigue vigente 1 h simulada

  var Q = new URLSearchParams(location.search);
  var BACKEND = Q.has('backend') ? Q.get('backend') : 'http://127.0.0.1:8080';
  var estado = { est: [], por: {}, sel: null, vel: 300, pausa: false, alertas: {} };
  var $ = function (id) { return document.getElementById(id); };

  // ----------------------------------------------------------------------- carga
  Promise.all([
    fetch('../../contrato/fixtures/estaciones.json').then(function (r) { return r.json(); }),
    fetch('../../contrato/fixtures/linea_base.json').then(function (r) { return r.json(); })
  ]).then(function (d) { arranca(d[0].estaciones, d[1]); }).catch(function (e) {
    var a = $('aviso'); a.hidden = false;
    a.innerHTML = 'No se pudieron leer los fixtures del contrato (' + e.message + '). Sirve el repositorio desde su raíz con ' +
      '<code>python -m http.server 8000</code>.';
  });

  function arranca(estaciones, linea) {
    estado.est = estaciones; estado.sel = estaciones[0].c_estacion;
    estaciones.forEach(function (e) {
      var id = e.c_estacion;
      estado.alertas[id] = [];
      estado.por[id] = Mont.crearEstacion(e, linea, { alEvento: function (ev) { alEvento(id, ev); } });
    });
    estado.ultimo = performance.now();

    var se = $('selEstacion');
    estaciones.forEach(function (e) {
      var o = document.createElement('option'); o.value = e.c_estacion; o.textContent = e.c_estacion + ' · ' + nombre(e.cuerpo_agua); se.appendChild(o);
    });
    se.onchange = function () { estado.sel = se.value; refresca(); };
    var sv = $('selVel');
    VELOCIDADES.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v + '×'; sv.appendChild(o); });
    sv.onchange = function () { estado.vel = +sv.value; };
    $('btnPausa').onclick = function () { estado.pausa = !estado.pausa; this.textContent = estado.pausa ? 'Reanudar' : 'Pausar'; estado.ultimo = performance.now(); };
    Array.prototype.forEach.call(document.querySelectorAll('.ev'), function (b) {
      b.onclick = function () { actual().agua.agregaEvento(b.dataset.ev, actual().fw.t); };
    });
    $('btnCorte').onclick = function () { var s = actual(); s.enlace.caido = !s.enlace.caido; refresca(); };

    if (Q.get('estacion') && estado.por[Q.get('estacion')]) estado.sel = Q.get('estacion');
    if (Q.get('incrustado')) document.body.classList.add('incrustado');
    if (VELOCIDADES.indexOf(+Q.get('vel')) >= 0) estado.vel = +Q.get('vel');
    se.value = estado.sel; sv.value = String(estado.vel);

    Escena.construye();
    Recepcion.construye();
    refresca();
    requestAnimationFrame(bucle);
  }

  function actual() { return estado.por[estado.sel]; }
  function nombre(t) {
    return (t || '').toLowerCase().replace(/(^|[\s(])([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/ (De|Del|La|Las|El|Los|Y) /g, function (m) { return m.toLowerCase(); });
  }
  function refresca() {
    var s = actual(), e = s.est;
    $('titulo').textContent = e.c_estacion + ' · ' + nombre(e.cuerpo_agua);
    document.title = e.c_estacion + ' · simulador de la estación';
    $('btnCorte').textContent = s.enlace.caido ? 'Restablecer enlace' : 'Cortar enlace';
    $('btnCorte').classList.toggle('activo', s.enlace.caido);
  }

  // ------------------------------------------------------------------- backend
  // Cada envío confirmado llega a la línea de tiempo. Si hay backend, además se manda
  // por el contrato (POST /lecturas) y se guardan las alertas que devuelva.
  function alEvento(id, ev) {
    if (ev.tipo !== 'envio') return;
    Recepcion.registra(id, ev.datos, ev.t);
    if (!BACKEND) return;
    fetch(BACKEND.replace(/\/$/, '') + '/lecturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev.datos) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.veredictos || []).forEach(function (v) { (v.alertas || []).forEach(function (a) { estado.alertas[id].push(a); }); });
      })
      .catch(function () {});
  }
  function alarmaVigente(s) {
    var ult = null;
    estado.alertas[estado.sel].forEach(function (a) {
      var t = Date.parse(a.fecha_hora) / 1000;
      if (t <= s.fw.t + 1 && s.fw.t - t <= VENTANA_ALARMA) ult = a;
    });
    return ult;
  }

  // --------------------------------------------------------------------- bucle
  function dibuja(s) {
    $('relojFecha').textContent = M.iso(s.fw.t).substr(0, 10);
    $('relojHora').textContent = M.iso(s.fw.t).substr(11, 8);
    var al = alarmaVigente(s);
    Escena.pinta(s, { alarma: al });
    Recepcion.pinta(s);
    var linea = $('alarmaLinea');
    linea.hidden = !al;
    if (al) linea.textContent = 'Alarma: ' + NOMBRE[al.c_parametro] + ', ' + al.fecha_hora.substr(11, 5) + '.';
  }
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

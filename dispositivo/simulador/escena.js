/* La figura del simulador: tres cosas y el sentido en que viajan los datos.
 *
 *   sondas en el río  →  estación  →  plataforma (aquí se decide si hay alarma)
 *
 * La estación muestra sus tres componentes en renglones, cada uno con su dato vivo:
 * controlador (ESP32, reloj, microSD), comunicación (módem LTE-M) y energía (panel y baterías).
 *
 * Solo dibuja. Lee la estación (s.fw, s.agua, s.sondas, s.enlace, s.energia) y el
 * resultado de la plataforma (ext), y no modifica nada.
 */
(function () {
  'use strict';
  var M = window.Modelo;
  var NS = 'http://www.w3.org/2000/svg';
  var TINTA = '#16222c', TENUE = '#5b6974', AGUA = '#1d6fa5', ALARMA = '#b3261e', LINEA = '#9aa7ae';
  var NOMBRE = { OD: 'Oxígeno', PH: 'pH', COND: 'Conductividad', TEMP: 'Temperatura', TURB: 'Turbiedad' };
  var DEC = { OD: 2, PH: 2, COND: 0, TEMP: 1, TURB: 0 };
  var ESTADO = {
    'SUEÑO': 'Dormida', 'CALENTAMIENTO': 'Calentando sondas', 'MEDICIÓN': 'Midiendo', 'EMPAQUETADO': 'Guardando el paquete',
    'ENLACE': 'Conectando', 'ENVÍO': 'Enviando', 'ESPERA': 'Sin red, reintenta', 'APAGADA': 'Apagada'
  };
  var CABLE = [[99, 150], [99, 62], [340, 62]];
  var ENLACE_Y = 105;   // a la altura del renglón de comunicación
  // Más larga a la izquierda: los rótulos salen en horizontal sin cruzar otras sondas.
  var SONDAS = [
    { p: 'COND', x: 58, tip: 298 }, { p: 'OD', x: 76, tip: 276 }, { p: 'PH', x: 94, tip: 254 },
    { p: 'TEMP', x: 112, tip: 232 }, { p: 'TURB', x: 130, tip: 210 }
  ];
  var $ = function (id) { return document.getElementById(id); };
  var G = {};

  function el(tag, attrs, padre, texto) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (texto !== undefined) e.textContent = texto;
    if (padre) padre.appendChild(e);
    return e;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function acota(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function fmt(v, d) { return v === null || v === undefined ? '—' : v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function colorAgua(turb) {
    var k = acota(Math.log10(turb + 1) / 3.7, 0, 1);
    function c(a, b) { return Math.round(lerp(a, b, k)); }
    return 'rgb(' + c(220, 226) + ',' + c(235, 214) + ',' + c(245, 178) + ')';
  }
  function sobrePolilinea(pts, u) {
    var tot = 0, i, seg = [];
    for (i = 1; i < pts.length; i++) { var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
    var r = acota(u, 0, 1) * tot;
    for (i = 0; i < seg.length; i++) {
      if (r <= seg[i]) { var f = seg[i] ? r / seg[i] : 0; return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; }
      r -= seg[i];
    }
    return pts[pts.length - 1];
  }

  function construye() {
    var svg = $('lienzo'); svg.innerHTML = '';
    G.agua = el('rect', { x: 0, y: 170, width: 330, height: 160, fill: '#dcebf5' }, svg);
    el('line', { x1: 0, y1: 170, x2: 330, y2: 170, stroke: AGUA, 'stroke-width': 1.5 }, svg);
    el('line', { x1: 330, y1: 170, x2: 560, y2: 170, stroke: TINTA, 'stroke-width': 1.5 }, svg);
    el('text', { x: 10, y: 322, fill: TENUE, 'font-size': 12 }, svg, 'río');

    // sondas dentro de su tubo
    el('line', { x1: 99, y1: 150, x2: 99, y2: 160, stroke: TINTA, 'stroke-width': 3 }, svg);
    el('rect', { x: 74, y: 150, width: 50, height: 10, fill: TINTA }, svg);
    G.cable = el('polyline', { points: CABLE.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: LINEA, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, svg);
    el('rect', { x: 44, y: 160, width: 110, height: 152, fill: 'rgba(255,255,255,.55)', stroke: TINTA, 'stroke-width': 1.5 }, svg);
    G.sondas = {};
    SONDAS.forEach(function (s) {
      el('rect', { x: s.x - 4, y: 160, width: 8, height: s.tip - 160, fill: '#fff', stroke: TINTA }, svg);
      var punta = el('rect', { x: s.x - 4, y: s.tip - 12, width: 8, height: 12, fill: AGUA }, svg);
      el('line', { x1: s.x + 4, y1: s.tip - 6, x2: 170, y2: s.tip - 6, stroke: LINEA }, svg);
      el('text', { x: 176, y: s.tip - 2, fill: TINTA, 'font-size': 12, 'font-weight': 600 }, svg, NOMBRE[s.p]);
      var v = el('text', { x: 270, y: s.tip - 2, fill: TINTA, 'font-size': 12.5 }, svg, '—');
      G.sondas[s.p] = { punta: punta, v: v };
    });

    el('text', { x: 160, y: 164, fill: TENUE, 'font-size': 11 }, svg, 'Sondas aisladas entre sí');

    // estación: una caja con sus tres componentes en renglones separados por filetes
    G.panel = el('polygon', { points: '356,24 410,10 414,20 360,34', fill: '#fff', stroke: TINTA }, svg);
    el('line', { x1: 385, y1: 27, x2: 385, y2: 40, stroke: TINTA, 'stroke-width': 1.5 }, svg);
    G.antena = el('line', { x1: 548, y1: 40, x2: 548, y2: 12, stroke: TINTA, 'stroke-width': 1.5 }, svg);
    G.antenaPunta = el('circle', { cx: 548, cy: 11, r: 2.5, fill: TINTA }, svg);
    G.estacion = el('rect', { x: 340, y: 40, width: 220, height: 130, fill: '#fff', stroke: TINTA, 'stroke-width': 1.5 }, svg);
    el('line', { x1: 340, y1: 83, x2: 560, y2: 83, stroke: LINEA }, svg);
    el('line', { x1: 340, y1: 126, x2: 560, y2: 126, stroke: LINEA }, svg);
    function renglon(y, nombre, equipo) {
      var t = el('text', { x: 350, y: y, fill: TINTA, 'font-size': 12.5, 'font-weight': 700 }, svg, nombre);
      el('tspan', { fill: TENUE, 'font-weight': 400, 'font-size': 11, dx: 6 }, t, equipo);
      return el('text', { x: 350, y: y + 18, fill: TINTA, 'font-size': 12 }, svg, '');
    }
    G.estado = renglon(58, 'Controlador', 'ESP32, reloj y SD');
    G.red = renglon(101, 'Comunicación', 'módem LTE-M, HTTPS');
    G.bateria = renglon(144, 'Energía', 'panel 5 W, 2 × 18650');

    // enlace y plataforma
    G.enlace = el('line', { x1: 560, y1: ENLACE_Y, x2: 615, y2: ENLACE_Y, stroke: LINEA, 'stroke-width': 1.5, 'stroke-dasharray': '4 5' }, svg);
    G.plat = el('rect', { x: 615, y: 40, width: 180, height: 150, fill: '#fff', stroke: TINTA, 'stroke-width': 1.5 }, svg);
    el('text', { x: 705, y: 62, 'text-anchor': 'middle', fill: TINTA, 'font-size': 14, 'font-weight': 700 }, svg, 'Plataforma');
    G.resultado = el('text', { x: 705, y: 100, 'text-anchor': 'middle', fill: TINTA, 'font-size': 19, 'font-weight': 700 }, svg, '');
    G.detalle1 = el('text', { x: 705, y: 126, 'text-anchor': 'middle', fill: TENUE, 'font-size': 12 }, svg, '');
    G.detalle2 = el('text', { x: 705, y: 144, 'text-anchor': 'middle', fill: TENUE, 'font-size': 12 }, svg, '');
    G.motor = el('text', { x: 705, y: 178, 'text-anchor': 'middle', fill: TENUE, 'font-size': 11 }, svg, '');

    G.paquete = el('rect', { width: 9, height: 9, fill: TINTA, opacity: 0 }, svg);
  }

  function pinta(s, ext) {
    var fw = s.fw, f = fw.fase, nom = f.nombre, p = f.dur > 0 ? 1 - f.resta / f.dur : 1;
    G.agua.setAttribute('fill', colorAgua(s.agua.valor('TURB', fw.t)));

    var midiendo = nom === 'CALENTAMIENTO' || nom === 'MEDICIÓN';
    M.PARAMS.forEach(function (q) {
      var d = fw.detalleMed[q], g = G.sondas[q], fa = s.sondas[q].falla;
      g.punta.setAttribute('fill', midiendo ? TINTA : AGUA);
      var t = d ? (d.valor === null ? 'sin respuesta' : fmt(d.valor, DEC[q]) + ' ' + M.ESPEC[q].unidad) : '—';
      if (fa !== 'ninguna') t += '  (falla)'; else if (d && d.saturada) t += '  (saturada)';
      g.v.textContent = t;
    });
    G.cable.setAttribute('stroke', midiendo ? TINTA : LINEA);
    G.cable.setAttribute('stroke-width', midiendo ? 3.5 : 2.5);

    var n = fw.cola.length;
    G.estado.textContent = (ESTADO[nom] || nom) + (n > 0 ? ' · ' + n + (n === 1 ? ' paquete en la SD' : ' paquetes en la SD') : '');
    G.estado.setAttribute('fill', n > 1 ? ALARMA : TINTA);
    G.estacion.setAttribute('stroke-width', nom === 'SUEÑO' ? 1.5 : 2.5);

    var caido = s.enlace.caido;
    G.red.textContent = caido ? 'Sin red' : 'Señal ' + Math.round(s.enlace.rssi) + ' dBm' + (nom === 'ENLACE' || nom === 'ENVÍO' ? ' · transmitiendo' : '');
    G.red.setAttribute('fill', caido ? ALARMA : TINTA);
    G.antena.setAttribute('stroke', caido ? ALARMA : TINTA);
    G.antenaPunta.setAttribute('fill', caido ? ALARMA : TINTA);

    var soc = Math.round(s.energia.soc() * 100), sol = s.energia.solarW;
    G.bateria.textContent = 'Batería ' + soc + ' % · ' + (sol > 0.05 ? 'sol ' + sol.toFixed(1) + ' W' : 'sin sol');
    G.bateria.setAttribute('fill', soc < 20 ? ALARMA : TINTA);
    G.panel.setAttribute('fill', sol > 0.05 ? 'rgba(29,111,165,' + (0.1 + 0.35 * acota(sol / 2.5, 0, 1)).toFixed(2) + ')' : '#fff');

    G.enlace.setAttribute('stroke', nom === 'ENVÍO' ? TINTA : (caido ? ALARMA : LINEA));
    G.enlace.setAttribute('stroke-width', nom === 'ENVÍO' ? 2.5 : 1.5);
    G.paquete.setAttribute('opacity', 0);
    if (nom === 'MEDICIÓN') {
      var a = sobrePolilinea(CABLE, 1 - ((p * 3) % 1));
      G.paquete.setAttribute('x', a[0] - 4.5); G.paquete.setAttribute('y', a[1] - 4.5); G.paquete.setAttribute('opacity', 1);
    } else if (nom === 'ENVÍO') {
      G.paquete.setAttribute('x', lerp(560, 615, p) - 4.5); G.paquete.setAttribute('y', ENLACE_Y - 4.5); G.paquete.setAttribute('opacity', 1);
    }

    // lo que decidió la plataforma
    var al = ext.alarma;
    G.plat.setAttribute('stroke', al ? ALARMA : TINTA);
    G.plat.setAttribute('stroke-width', al ? 3 : 1.5);
    G.resultado.setAttribute('fill', al ? ALARMA : TINTA);
    if (!ext.backend) {
      G.resultado.textContent = 'Sin conexión'; G.resultado.setAttribute('fill', TENUE);
      G.detalle1.textContent = 'La plataforma no responde.'; G.detalle2.textContent = ''; G.motor.textContent = '';
    } else if (al) {
      G.resultado.textContent = 'Alarma';
      G.detalle1.textContent = NOMBRE[al.c_parametro] + ' · ' + al.nivel + ' · ' + al.hora;
      G.detalle2.textContent = al.c_alerta;
      G.motor.textContent = ext.motor ? 'Evaluador ' + (ext.motor === 'stub' ? 'provisional' : ext.motor) : '';
    } else {
      G.resultado.textContent = 'Sin alarma';
      G.detalle1.textContent = ext.recibido ? 'Último paquete recibido ' + ext.recibido : 'Aún sin datos';
      G.detalle2.textContent = ext.codigo || '';
      G.motor.textContent = ext.motor ? 'Evaluador ' + (ext.motor === 'stub' ? 'provisional' : ext.motor) : '';
    }
  }

  window.Escena = { construye: construye, pinta: pinta };
})();

/* Lo que llega a la plataforma: una línea de tiempo de las últimas 12 horas simuladas.
 *
 * Cada medición es un punto en su hora de medición (la del reloj de la estación):
 *   lleno  recibida por la plataforma (la estación recibió la confirmación)
 *   vacío  guardada en la SD de la estación, todavía por enviar
 * Si se corta la red, los puntos quedan vacíos; al volver, se llenan con su hora
 * original. La franja de fondo es el rango habitual del sitio (p10 a p90).
 * Las pestañas eligen el parámetro y muestran su último valor medido.
 *
 * Solo dibuja. ui.js le avisa de cada envío confirmado con registra().
 */
(function () {
  'use strict';
  var M = window.Modelo;
  var NS = 'http://www.w3.org/2000/svg';
  var VENTANA = 12 * 3600;
  var W = 800, H = 180, IZQ = 52, DER = 16, ARR = 26, ABA = 26;
  var NOMBRE = { COND: 'Conductividad', OD: 'Oxígeno disuelto', PH: 'pH', TEMP: 'Temperatura', TURB: 'Turbiedad' };
  var DEC = { OD: 2, PH: 2, COND: 0, TEMP: 1, TURB: 0 };
  var recibidos = {};             // c_estacion -> [{ t, valores, tRec }]
  var param = 'COND';
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, attrs, padre, texto) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (texto !== undefined) e.textContent = texto;
    if (padre) padre.appendChild(e);
    return e;
  }
  function valores(paquete) {
    var v = {};
    paquete.lecturas.forEach(function (l) { v[l.c_parametro] = l.valor; });
    return v;
  }
  function fmt(v, d) { return v === null || v === undefined ? '—' : v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function valido(v) { return v !== null && v !== undefined && v > -900; }

  function construye() {
    var sel = $('recParam');
    M.PARAMS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.dataset.p = p;
      b.innerHTML = NOMBRE[p] + ' <span class="v" id="pv_' + p + '">—</span>';
      b.onclick = function () { param = p; marca(); };
      sel.appendChild(b);
    });
    marca();
  }
  function marca() {
    Array.prototype.forEach.call($('recParam').children, function (b) { b.classList.toggle('activo', b.dataset.p === param); });
  }

  function registra(id, lote, tRec) {
    var r = recibidos[id] || (recibidos[id] = []);
    lote.forEach(function (p) { r.push({ t: Date.parse(p.fecha_hora) / 1000, valores: valores(p), tRec: tRec }); });
    if (r.length > 400) r.splice(0, r.length - 400);
  }

  function pinta(s) {
    // pestañas: último valor medido por la estación
    M.PARAMS.forEach(function (p) {
      var d = s.fw.detalleMed[p], t = d ? (d.valor === null ? 'sin respuesta' : fmt(d.valor, DEC[p]) + ' ' + M.ESPEC[p].unidad) : '—';
      var e = $('pv_' + p); if (e.textContent !== t) e.textContent = t;
    });

    var svg = $('recepcion'), id = s.fw.id, ahora = s.fw.t, t0 = ahora - VENTANA;
    var rec = (recibidos[id] || []).filter(function (x) { return x.t >= t0; });
    var pend = s.fw.cola.map(function (p) { return { t: Date.parse(p.fecha_hora) / 1000, valores: valores(p) }; }).filter(function (x) { return x.t >= t0; });
    var L = s.linea[param], dec = DEC[param];

    var vals = rec.concat(pend).map(function (x) { return x.valores[param]; }).filter(valido);
    var lo = Math.min.apply(null, vals.concat([L.p10])), hi = Math.max.apply(null, vals.concat([L.p90]));
    var m = (hi - lo) * 0.15 || 1; lo -= m; hi += m;
    function X(t) { return IZQ + (t - t0) / VENTANA * (W - IZQ - DER); }
    function Y(v) { return ARR + (1 - (v - lo) / (hi - lo)) * (H - ARR - ABA); }

    svg.innerHTML = '';
    // leyenda en una línea, arriba a la derecha
    var ly = 10;
    el('circle', { cx: W - 330, cy: ly, r: 3.5, fill: '#16222c' }, svg);
    el('text', { x: W - 322, y: ly + 4, 'font-size': 11.5, fill: '#5b6974' }, svg, 'recibida por la plataforma');
    el('circle', { cx: W - 168, cy: ly, r: 3.5, fill: '#fff', stroke: '#16222c', 'stroke-width': 1.3 }, svg);
    el('text', { x: W - 160, y: ly + 4, 'font-size': 11.5, fill: '#5b6974' }, svg, 'en la estación, por enviar');
    // franja del rango habitual
    el('rect', { x: IZQ, y: Y(L.p90), width: W - IZQ - DER, height: Math.max(1, Y(L.p10) - Y(L.p90)), fill: '#1d6fa5', opacity: 0.08 }, svg);
    el('text', { x: IZQ - 6, y: Y(L.p90) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5b6974' }, svg, fmt(L.p90, dec));
    el('text', { x: IZQ - 6, y: Y(L.p10) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5b6974' }, svg, fmt(L.p10, dec));
    // eje de tiempo: una marca cada 2 h
    el('line', { x1: IZQ, y1: H - ABA, x2: W - DER, y2: H - ABA, stroke: '#16222c' }, svg);
    var paso = 7200;
    for (var t = Math.ceil(t0 / paso) * paso; t <= ahora; t += paso) {
      el('line', { x1: X(t), y1: H - ABA, x2: X(t), y2: H - ABA + 4, stroke: '#16222c' }, svg);
      el('text', { x: X(t), y: H - ABA + 17, 'text-anchor': 'middle', 'font-size': 11, fill: '#5b6974' }, svg, M.iso(t).substr(11, 5));
    }
    el('line', { x1: X(ahora), y1: ARR - 6, x2: X(ahora), y2: H - ABA, stroke: '#16222c', 'stroke-dasharray': '2 3' }, svg);

    // la serie: línea fina entre lo recibido, puntos llenos y vacíos
    var tramo = rec.slice().sort(function (a, b) { return a.t - b.t; }).filter(function (x) { return valido(x.valores[param]); })
      .map(function (x) { return X(x.t).toFixed(1) + ',' + Y(x.valores[param]).toFixed(1); });
    if (tramo.length > 1) el('polyline', { points: tramo.join(' '), fill: 'none', stroke: '#16222c', 'stroke-width': 1, 'stroke-opacity': 0.45 }, svg);
    rec.map(function (x) { return { t: x.t, v: x.valores[param], ok: true }; })
      .concat(pend.map(function (x) { return { t: x.t, v: x.valores[param], ok: false }; }))
      .forEach(function (x) {
        if (!valido(x.v)) { el('text', { x: X(x.t), y: H - ABA - 6, 'text-anchor': 'middle', 'font-size': 10, fill: '#b3261e' }, svg, '×'); return; }
        el('circle', { cx: X(x.t), cy: Y(x.v), r: 3.2, fill: x.ok ? '#16222c' : '#fff', stroke: '#16222c', 'stroke-width': 1.3 }, svg);
      });
  }

  window.Recepcion = { construye: construye, registra: registra, pinta: pinta };
})();

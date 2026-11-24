/* La estación en 3D: un corte del río con la estación en la orilla.
 *
 *   sondas en el agua → cable → gabinete (controlador, SD, módem, baterías)
 *   → antena → torre celular → plataforma (la línea de tiempo bajo la figura)
 *
 * Estilo de ilustración técnica: materiales mate, aristas en tinta, fondo claro.
 * Nada se mueve por adorno: el agua cambia de color con la turbiedad, las puntas de
 * las sondas se marcan al medir, el panel se ilumina con el sol, la cola de la SD
 * crece y baja, y el paquete viaja de la antena a la torre solo mientras se envía.
 * Se puede girar arrastrando (dentro de un rango acotado).
 *
 * Solo dibuja. Lee la estación (s.fw, s.agua, s.sondas, s.enlace, s.energia) y no
 * modifica nada. Three.js r149 se carga como script clásico desde unpkg.
 */
(function () {
  'use strict';
  var M = window.Modelo;
  var TINTA = 0x16222c, AGUA = 0x1d6fa5, ALARMA = 0xb3261e;
  var ESTADO = {
    'SUEÑO': 'Dormido', 'CALENTAMIENTO': 'Calentando sondas', 'MEDICIÓN': 'Midiendo', 'EMPAQUETADO': 'Guardando en la SD',
    'ENLACE': 'Conectando', 'ENVÍO': 'Enviando', 'ESPERA': 'Sin red, reintenta', 'APAGADA': 'Apagado'
  };
  var $ = function (id) { return document.getElementById(id); };
  var G = {}, T, ok = false;
  // La estación se dibuja a 1.6× respecto a la base del mástil para que se lea junto al río.
  var BASE = [-4.3, 0.6, 0.1], ESC = 1.6;
  function S(p) { return [BASE[0] + (p[0] - BASE[0]) * ESC, BASE[1] + (p[1] - BASE[1]) * ESC, BASE[2] + (p[2] - BASE[2]) * ESC]; }

  // ------------------------------------------------------------ utilidades
  function mate(color, extra) {
    var m = new T.MeshLambertMaterial({ color: color });
    for (var k in extra || {}) m[k] = extra[k];
    return m;
  }
  function aristas(malla, opacidad) {
    var l = new T.LineSegments(new T.EdgesGeometry(malla.geometry, 25),
      new T.LineBasicMaterial({ color: TINTA, transparent: opacidad < 1, opacity: opacidad === undefined ? 1 : opacidad }));
    malla.add(l);
    return malla;
  }
  function caja(w, h, d, mat, x, y, z, padre, opAristas) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opAristas !== 0) aristas(m, opAristas === undefined ? 1 : opAristas);
    (padre || G.escena).add(m);
    return m;
  }
  function cilindro(r, h, mat, x, y, z, padre, segs) {
    var m = new T.Mesh(new T.CylinderGeometry(r, r, h, segs || 20), mat);
    m.position.set(x, y, z);
    (padre || G.escena).add(m);
    return m;
  }
  function tubo(puntos, r, mat) {
    var curva = new T.CatmullRomCurve3(puntos.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
    var m = new T.Mesh(new T.TubeGeometry(curva, 48, r, 8, false), mat);
    G.escena.add(m);
    return m;
  }
  function colorAgua(turb) {
    var k = M.acota(Math.log10(turb + 1) / 3.7, 0, 1);
    return new T.Color().setRGB((150 + 70 * k) / 255, (195 + 10 * k) / 255, (225 - 70 * k) / 255);
  }

  // ------------------------------------------------------------ rótulos HTML
  // Un rótulo por componente: nombre y dato vivo. Se colocan proyectando un punto 3D.
  var ROTULOS = [
    { id: 'sondas', nombre: 'Sondas', equipo: 'OD, pH, conductividad, temperatura, turbiedad', ancla: [-0.95, -1.35, 0.9], lado: 'izq' },
    { id: 'ctrl', nombre: 'Controlador', equipo: 'ESP32, reloj y microSD', ancla: S([-4.62, 2.15, 0.45]), lado: 'izq' },
    { id: 'modem', nombre: 'Módem LTE-M', equipo: '', ancla: S([-3.48, 2.45, 0.45]), lado: 'der' },
    { id: 'bat', nombre: 'Baterías', equipo: '2 × 18650, 22 Wh', ancla: S([-4.62, 1.55, 0.45]), lado: 'izq' },
    { id: 'panel', nombre: 'Panel solar', equipo: '5 W', ancla: S([-5.1, 4.95, 0.2]), lado: 'izq' },
    { id: 'torre', nombre: 'Torre celular', equipo: 'red del operador', ancla: [6.5, 7.6, -10], lado: 'der' }
  ];
  function construyeRotulos() {
    var capa = $('rotulos3d'); capa.innerHTML = '';
    ROTULOS.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'rot3d ' + r.lado;
      d.innerHTML = '<b>' + r.nombre + '</b>' + (r.equipo ? ' <span class="eq">' + r.equipo + '</span>' : '') + '<span class="val" id="rv_' + r.id + '"></span>';
      capa.appendChild(d);
      r.el = d; r.v = new T.Vector3(r.ancla[0], r.ancla[1], r.ancla[2]);
    });
  }
  function colocaRotulos() {
    var w = G.lienzo.clientWidth, h = G.lienzo.clientHeight;
    ROTULOS.forEach(function (r) {
      var p = r.v.clone().project(G.camara);
      r.el.style.left = ((p.x + 1) / 2 * w).toFixed(1) + 'px';
      r.el.style.top = ((1 - p.y) / 2 * h).toFixed(1) + 'px';
      r.el.style.display = p.z < 1 ? '' : 'none';
    });
  }
  function rotulo(id, texto, alarma) {
    var e = $('rv_' + id);
    if (e.textContent !== texto) e.textContent = texto;
    e.classList.toggle('mal', !!alarma);
  }

  // ------------------------------------------------------------ la escena
  function construye() {
    T = window.THREE;
    var cont = $('escena3d');
    if (!T || !soportaWebGL()) {
      cont.classList.add('sin3d');
      cont.innerHTML = '<p class="nota">Este navegador no puede mostrar la figura en 3D (WebGL). La tabla y la línea de tiempo siguen funcionando.</p>';
      return;
    }
    ok = true;
    G.lienzo = $('lienzo3d');
    G.render = new T.WebGLRenderer({ canvas: G.lienzo, antialias: true, alpha: true });
    G.render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    G.escena = new T.Scene();
    G.camara = new T.PerspectiveCamera(30, 2, 0.1, 200);
    G.objetivo = new T.Vector3(-0.4, 3.0, -2.2);
    G.orbita = { yaw: -0.42, pitch: 0.16, dist: 24 };

    G.escena.add(new T.HemisphereLight(0xffffff, 0xd8dee2, 0.85));
    var sol = new T.DirectionalLight(0xffffff, 0.55); sol.position.set(-6, 12, 8); G.escena.add(sol);

    var tierra = mate(0xe4ddd0), lecho = mate(0xd2c8b6), pvc = mate(0xf4f6f7), metal = mate(0xb9c2c8), oscuro = mate(0x2a3640);

    // Terreno en corte: orilla izquierda, lecho y orilla derecha. La cara frontal es el corte.
    caja(7, 2.3, 8, tierra, -5, -0.55, -2);                     // orilla izquierda, cima en y = 0.6
    caja(9.5, 0.5, 8, lecho, 3.25, -1.95, -2);                  // lecho del río
    caja(6, 2.3, 8, tierra, 11, -0.55, -2);                     // orilla derecha
    caja(14, 0.6, 14, tierra, 9, 0.3, -13, null, 0.25);         // terreno al fondo, donde está la torre
    // Agua: volumen translúcido entre orillas; su color sigue a la turbiedad.
    G.matAgua = mate(0x9cc3e1, { transparent: true, opacity: 0.62, depthWrite: false });
    G.agua = caja(9.5, 1.6, 8, G.matAgua, 3.25, -0.9, -2, null, 0.35);
    var sup = new T.Mesh(new T.PlaneGeometry(9.5, 8), new T.MeshBasicMaterial({ color: AGUA, transparent: true, opacity: 0.12, depthWrite: false }));
    sup.rotation.x = -Math.PI / 2; sup.position.set(3.25, -0.1, -2); G.escena.add(sup);

    // Tubo de protección con las cinco sondas, anclado a la orilla con un brazo.
    caja(1.2, 0.08, 0.12, metal, -1.35, 0.55, 0.9);
    G.tuboSondas = cilindro(0.17, 2.0, pvc, -0.75, -0.4, 0.9, null, 24);
    G.tuboSondas.material = mate(0xf4f6f7, { transparent: true, opacity: 0.38, depthWrite: false });
    aristas(G.tuboSondas, 0.5);
    G.puntas = {};
    M.PARAMS.forEach(function (p, i) {
      var x = -0.75 + (i - 2) * 0.06, z = 0.9 + ((i % 2) ? 0.05 : -0.05);
      cilindro(0.022, 1.7, mate(0x55626c), x, -0.45, z, null, 10);
      G.puntas[p] = cilindro(0.03, 0.16, mate(AGUA), x, -1.33, z, null, 10);
    });

    // Cable de las sondas al gabinete, por la orilla.
    G.matCable = mate(0x55626c);
    var finCable = [S([-4.0, 1.3, 0.45]), S([-4.0, 1.12, 0.45])];
    tubo([[-0.75, 0.6, 0.9], [-0.9, 0.85, 0.9], [-2.2, 0.68, 0.8], [-3.3, 0.7, 0.9], finCable[1], finCable[0]], 0.035, G.matCable);

    // Mástil, gabinete abierto, panel y antena: todo lo que se crea hasta "fin de la estación"
    // se mueve a un grupo escalado 1.6× desde la base del mástil.
    var antes = G.escena.children.length;
    cilindro(0.07, 4.4, metal, -4.3, 2.8, 0.1);
    var gab = mate(0xe9edf0);
    caja(1.15, 1.45, 0.06, gab, -4.05, 2.0, 0.22);              // fondo
    caja(0.06, 1.45, 0.5, gab, -4.6, 2.0, 0.45);                // lados
    caja(0.06, 1.45, 0.5, gab, -3.5, 2.0, 0.45);
    caja(1.15, 0.06, 0.5, gab, -4.05, 2.7, 0.45);               // techo y piso
    caja(1.15, 0.06, 0.5, gab, -4.05, 1.3, 0.45);
    var puerta = caja(1.15, 1.45, 0.05, mate(0xdfe5e9, { transparent: true, opacity: 0.85 }), 0, 0, 0, new T.Group(), 0.6);
    var bisagra = new T.Group(); bisagra.position.set(-4.62, 2.0, 0.72); puerta.position.set(0.575, 0, 0);
    bisagra.add(puerta); bisagra.rotation.y = -1.9; G.escena.add(bisagra);
    // dentro: placa del controlador, SD, módem, baterías
    caja(0.55, 0.42, 0.04, mate(0x3e5a4f), -4.25, 2.1, 0.3);
    caja(0.16, 0.12, 0.05, oscuro, -4.32, 2.12, 0.34, null, 0);
    G.sd = caja(0.12, 0.03, 0.09, mate(0x6d7b85), -4.08, 1.95, 0.36);
    caja(0.3, 0.22, 0.08, mate(0x5b6974), -3.85, 2.42, 0.32);   // módem
    G.baterias = [];
    [0, 1].forEach(function (k) {
      var b = cilindro(0.08, 0.6, mate(0x3a4750), -4.2, 1.55 + k * 0.17 - 0.08, 0.36, null, 16);
      b.rotation.z = Math.PI / 2; G.baterias.push(b);
    });
    G.carga = caja(0.6, 0.03, 0.02, mate(AGUA), -4.2, 1.38, 0.45, null, 0);
    // cola de la SD: un bloque por paquete pendiente (hasta 12)
    G.cola = [];
    for (var k = 0; k < 12; k++) {
      var c = caja(0.05, 0.05, 0.05, mate(TINTA), -3.98 + (k % 6) * 0.065, 1.80 - Math.floor(k / 6) * 0.065, 0.42, null, 0);
      c.visible = false; G.cola.push(c);
    }
    // panel solar en la punta del mástil, inclinado al sur
    G.matPanel = mate(0x24364a, { emissive: new T.Color(0x000000) });
    var panel = caja(1.6, 0.05, 1.0, G.matPanel, 0, 0, 0, new T.Group(), 1);
    var soporte = new T.Group(); soporte.position.set(-4.3, 4.95, 0.2); soporte.rotation.x = 0.42; soporte.add(panel);
    G.escena.add(soporte);
    // antena del módem
    G.matAntena = mate(TINTA);
    cilindro(0.02, 1.2, G.matAntena, -3.65, 3.3, 0.35, null, 8);
    G.puntaAntena = cilindro(0.05, 0.1, G.matAntena, -3.65, 3.95, 0.35, null, 10);
    tubo([[-3.85, 2.53, 0.32], [-3.7, 2.7, 0.35], [-3.65, 2.75, 0.35]], 0.015, G.matCable);
    // fin de la estación
    var est = new T.Group(); est.position.set(BASE[0], BASE[1], BASE[2]); est.scale.setScalar(ESC);
    G.escena.children.slice(antes).forEach(function (o) { G.escena.remove(o); o.position.sub(new T.Vector3(BASE[0], BASE[1], BASE[2])); est.add(o); });
    G.escena.add(est);

    // Torre celular al fondo: celosía simple.
    var mt = mate(0xa3adb4), base = [6.5, 0.6, -10];
    [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(function (d) {
      var a = new T.Vector3(base[0] + d[0], base[1], base[2] + d[1]), b = new T.Vector3(base[0] + d[0] * 0.15, base[1] + 6.6, base[2] + d[1] * 0.15);
      var l = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, a.distanceTo(b), 6), mt);
      l.position.copy(a).add(b).multiplyScalar(0.5); l.lookAt(b); l.rotateX(Math.PI / 2); G.escena.add(l);
    });
    for (var y = 1.5; y < 7; y += 1.5) {
      var f = 1 - (y - 0.6) / 6.6 * 0.85;
      caja(1 * f, 0.03, 1 * f, mt, base[0], y, base[2], null, 0.4);
    }
    G.torreTope = new T.Vector3(base[0], 7.4, base[2]);
    caja(0.12, 0.6, 0.12, mate(0xe9edf0), base[0] + 0.2, 7.0, base[2] + 0.1);
    caja(0.12, 0.6, 0.12, mate(0xe9edf0), base[0] - 0.2, 7.0, base[2] - 0.1);

    // El paquete: un punto que viaja por el cable al medir y por el aire al enviar.
    G.paquete = new T.Mesh(new T.SphereGeometry(0.09, 16, 12), new T.MeshBasicMaterial({ color: TINTA }));
    G.paquete.visible = false; G.escena.add(G.paquete);
    G.rutaCable = new T.CatmullRomCurve3([[-0.75, 0.6, 0.9], [-0.9, 0.85, 0.9], [-2.2, 0.68, 0.8], [-3.3, 0.7, 0.9], finCable[1], finCable[0], S([-4.1, 1.95, 0.36])]
      .map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
    var pa = S([-3.65, 4.0, 0.35]), a0 = new T.Vector3(pa[0], pa[1], pa[2]), a1 = G.torreTope.clone();
    var medio = a0.clone().add(a1).multiplyScalar(0.5); medio.y += 3.2;
    G.rutaAire = new T.QuadraticBezierCurve3(a0, medio, a1);
    // la trayectoria del aire se dibuja tenue solo mientras hay envío
    G.trazoAire = new T.Line(new T.BufferGeometry().setFromPoints(G.rutaAire.getPoints(40)),
      new T.LineDashedMaterial({ color: TINTA, dashSize: 0.25, gapSize: 0.2, transparent: true, opacity: 0.5 }));
    G.trazoAire.computeLineDistances(); G.trazoAire.visible = false; G.escena.add(G.trazoAire);

    construyeRotulos();
    arrastre();
    window.addEventListener('resize', ajusta);
    ajusta();
  }

  function soportaWebGL() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
    catch (e) { return false; }
  }

  function ajusta() {
    var w = G.lienzo.clientWidth, h = G.lienzo.clientHeight;
    if (!w || !h) return;
    G.render.setSize(w, h, false);
    G.camara.aspect = w / h;
    G.camara.updateProjectionMatrix();
    G.sucio = true;
  }

  function colocaCamara() {
    var o = G.orbita, c = Math.cos(o.pitch);
    G.camara.position.set(G.objetivo.x + o.dist * c * Math.sin(o.yaw), G.objetivo.y + o.dist * Math.sin(o.pitch), G.objetivo.z + o.dist * c * Math.cos(o.yaw));
    G.camara.lookAt(G.objetivo);
  }

  // Girar arrastrando, dentro de un rango que no deja ver la escena por detrás ni por debajo.
  function arrastre() {
    var x0 = null, y0 = null;
    G.lienzo.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; G.lienzo.setPointerCapture(e.pointerId); });
    G.lienzo.addEventListener('pointerup', function () { x0 = null; });
    G.lienzo.addEventListener('pointermove', function (e) {
      if (x0 === null) return;
      G.orbita.yaw = M.acota(G.orbita.yaw - (e.clientX - x0) * 0.006, -1.1, 0.7);
      G.orbita.pitch = M.acota(G.orbita.pitch + (e.clientY - y0) * 0.004, 0.04, 0.75);
      x0 = e.clientX; y0 = e.clientY; G.sucio = true;
    });
  }

  // ------------------------------------------------------------ pintar
  function pinta(s, ext) {
    if (!ok) return;
    if (G.lienzo.clientWidth && Math.abs(G.lienzo.clientWidth / G.lienzo.clientHeight - G.camara.aspect) > 0.01) ajusta();
    var fw = s.fw, f = fw.fase, nom = f.nombre, p = f.dur > 0 ? 1 - f.resta / f.dur : 1;

    G.matAgua.color.copy(colorAgua(s.agua.valor('TURB', fw.t)));

    var midiendo = nom === 'CALENTAMIENTO' || nom === 'MEDICIÓN';
    M.PARAMS.forEach(function (q) {
      var fa = s.sondas[q].falla !== 'ninguna';
      G.puntas[q].material.color.setHex(fa ? ALARMA : (midiendo ? TINTA : AGUA));
    });
    G.matCable.color.setHex(midiendo ? TINTA : 0x55626c);
    var fallas = M.PARAMS.filter(function (q) { return s.sondas[q].falla !== 'ninguna'; }).length;
    rotulo('sondas', midiendo ? (nom === 'MEDICIÓN' ? 'Midiendo: 5 lecturas por sonda' : 'Estabilizando las sondas') :
      (fallas ? fallas + (fallas === 1 ? ' sonda con falla' : ' sondas con falla') : 'En el agua, sin medir'), fallas);

    var n = fw.cola.length;
    G.cola.forEach(function (c, i) { c.visible = i < n; });
    rotulo('ctrl', (ESTADO[nom] || nom) + (n ? ' · ' + n + (n === 1 ? ' paquete en la SD' : ' paquetes en la SD') : ''), n > 1);

    var caido = s.enlace.caido;
    G.matAntena.color.setHex(caido ? ALARMA : TINTA);
    rotulo('modem', caido ? 'Sin red' : 'Señal ' + Math.round(s.enlace.rssi) + ' dBm', caido);

    var soc = s.energia.soc(), sol = s.energia.solarW;
    G.carga.scale.x = Math.max(soc, 0.02); G.carga.position.x = (-4.2 - BASE[0]) - 0.3 * (1 - G.carga.scale.x);   // coordenada local del grupo
    G.carga.material.color.setHex(soc < 0.2 ? ALARMA : AGUA);
    rotulo('bat', 'Carga ' + Math.round(soc * 100) + ' %', soc < 0.2);
    G.matPanel.emissive.setRGB(0.05 * M.acota(sol / 2.5, 0, 1), 0.18 * M.acota(sol / 2.5, 0, 1), 0.3 * M.acota(sol / 2.5, 0, 1));
    rotulo('panel', sol > 0.05 ? 'Genera ' + sol.toFixed(1) + ' W' : 'Sin sol');
    rotulo('torre', caido ? 'Sin cobertura en el sitio' : (nom === 'ENVÍO' ? 'Recibiendo' : ''), caido);

    // el paquete
    G.paquete.visible = false; G.trazoAire.visible = false;
    if (nom === 'MEDICIÓN') {
      G.paquete.position.copy(G.rutaCable.getPoint((p * 3) % 1)); G.paquete.visible = true;
    } else if (nom === 'ENVÍO') {
      G.paquete.position.copy(G.rutaAire.getPoint(p)); G.paquete.visible = true; G.trazoAire.visible = true;
    }
    G.paquete.material.color.setHex(ext && ext.alarma ? ALARMA : TINTA);

    colocaCamara();
    G.render.render(G.escena, G.camara);
    colocaRotulos();
  }

  window.Escena = { construye: construye, pinta: pinta };
})();

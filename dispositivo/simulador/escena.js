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
  // Lo que hace la estación en cada fase del firmware, dicho para quien no conoce el firmware.
  var ESTADO = {
    'SUEÑO': 'En reposo', 'CALENTAMIENTO': 'Preparando las sondas', 'MEDICIÓN': 'Midiendo el agua',
    'EMPAQUETADO': 'Guardando la medición', 'ENLACE': 'Conectándose a la red', 'ENVÍO': 'Enviando los datos',
    'ESPERA': 'Sin red: lo intentará de nuevo', 'APAGADA': 'Apagada: batería baja'
  };
  // En reposo se dice cuándo despierta; en las demás fases, solo lo que hace.
  function estado(fw) {
    var f = fw.fase;
    if (f.nombre === 'SUEÑO') return 'En reposo hasta las ' + M.iso(fw.t + Math.max(0, f.resta || 0)).substr(11, 5);
    return ESTADO[f.nombre] || f.nombre;
  }
  var $ = function (id) { return document.getElementById(id); };
  var G = {}, T, ok = false;
  // La estación se dibuja a 1.6× respecto a la base del mástil para que se lea junto al río.
  var BASE = [-4.3, 0.6, 0.1], ESC = 1.6;
  function S(p) { return [BASE[0] + (p[0] - BASE[0]) * ESC, BASE[1] + (p[1] - BASE[1]) * ESC, BASE[2] + (p[2] - BASE[2]) * ESC]; }

  // ------------------------------------------------------------ utilidades
  // Materiales físicos (D19): rugosidad y metal en lugar de color plano. `mate` es plástico o
  // pintura; `metal`, acero galvanizado o aluminio. Las texturas se dibujan aquí, sin descargas.
  function mate(color, extra) {
    var m = new T.MeshStandardMaterial({ color: color, roughness: 0.8, metalness: 0 });
    for (var k in extra || {}) m[k] = extra[k];
    return m;
  }
  function metal(color, rugosidad, extra) {
    return mate(color, Object.assign({ metalness: 0.75, roughness: rugosidad === undefined ? 0.45 : rugosidad, envMap: G.cielo, envMapIntensity: 0.8 }, extra));
  }
  // Ruido de valor con interpolación suave, en varias octavas; determinista (misma figura siempre).
  function ruido(semilla) {
    var p = [], i, s = semilla || 1;
    for (i = 0; i < 512; i++) { s = (s * 16807) % 2147483647; p.push(s / 2147483647); }
    function v(ix, iy) { return p[((ix * 73856093) ^ (iy * 19349663)) & 511]; }
    function base(x, y, per) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      var a = v(ix % per, iy % per), b = v((ix + 1) % per, iy % per), c = v(ix % per, (iy + 1) % per), d = v((ix + 1) % per, (iy + 1) % per);
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }
    return function (x, y, octavas, per) {   // x, y en [0, per): repite sin costura
      var t = 0, amp = 0.5, f = 1, n = 0;
      for (var o = 0; o < (octavas || 4); o++) { t += amp * base(x * f, y * f, per * f); n += amp; amp *= 0.5; f *= 2; }
      return t / n;
    };
  }
  // Una textura de lienzo que se repite; `pinta(x, y)` devuelve [r, g, b] en 0-255.
  function textura(tam, pinta, repetir, esColor) {
    var c = document.createElement('canvas'); c.width = c.height = tam;
    var cx = c.getContext('2d'), img = cx.createImageData(tam, tam), d = img.data;
    for (var y = 0; y < tam; y++) for (var x = 0; x < tam; x++) {
      var q = pinta(x, y), i = (y * tam + x) * 4;
      d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c);
    if (esColor) t.encoding = T.sRGBEncoding;   // los mapas de normales se quedan lineales
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (repetir) t.repeat.set(repetir[0], repetir[1]);
    t.anisotropy = 4;
    return t;
  }
  // Mapa de normales a partir de un campo de alturas (para relieve fino sin geometría).
  function normales(tam, alto, fuerza, repetir) {
    var h = [], x, y;
    for (y = 0; y < tam; y++) for (x = 0; x < tam; x++) h.push(alto(x, y));
    return textura(tam, function (x, y) {
      var dx = h[y * tam + (x + 1) % tam] - h[y * tam + (x + tam - 1) % tam];
      var dy = h[((y + 1) % tam) * tam + x] - h[((y + tam - 1) % tam) * tam + x];
      var nx = -dx * fuerza, ny = -dy * fuerza, l = Math.hypot(nx, ny, 1);
      return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255];
    }, repetir);
  }
  function aristas(malla, opacidad) {
    var l = new T.LineSegments(new T.EdgesGeometry(malla.geometry, 25),
      new T.LineBasicMaterial({ color: TINTA, transparent: opacidad < 1, opacity: opacidad === undefined ? 1 : opacidad }));
    malla.add(l);
    return malla;
  }
  // Con materiales físicos las aristas pasan a filete tenue: el volumen ya lo dan luz y sombra.
  var OP_ARISTAS = 0.3;
  function caja(w, h, d, mat, x, y, z, padre, opAristas) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opAristas !== 0) aristas(m, (opAristas === undefined ? 1 : opAristas) * OP_ARISTAS);
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
  // Agua del Atoyac: verde grisácea con poca turbiedad, café con mucha.
  function colorAgua(turb) {
    var k = M.acota(Math.log10(turb + 1) / 3.7, 0, 1);
    return new T.Color().setRGB((88 + 40 * k) / 255, (122 - 6 * k) / 255, (128 - 38 * k) / 255, T.SRGBColorSpace);
  }

  // ------------------------------------------------------------ el valle
  // Valle casi plano con el río en un cauce de taludes de tierra que serpentea un poco, como el
  // Atoyac entre Tlaxcala y Puebla. Unidades ≈ metros; la estación está en la orilla izquierda.
  var Z_CORTE = 2.4, SUP_AGUA = -0.1;
  var EXAGERA_CORRIENTE = 4;              // solo en el dibujo del agua; ver pinta()
  function ejeRio(z) { return 3.25 + 0.9 * Math.sin(z * 0.13 + 0.3); }
  function suave(t) { t = M.acota(t, 0, 1); return t * t * (3 - 2 * t); }
  function altura(x, z) {
    var d = Math.abs(x - ejeRio(z));
    var y = -1.7 + 2.3 * suave((d - 3.0) / 2.0);                       // lecho, talud y orilla
    var ondula = 0.07 * Math.sin(x * 1.3 + z * 0.7) + 0.05 * Math.sin(x * 0.4 - z * 1.1) + 0.04 * Math.sin(x * 2.3 + z * 1.9);
    var cercaEst = Math.hypot(x + 4.3, z - 0.1) < 2.6 ? 0.15 : 1;       // la base del mástil queda plana
    y += ondula * suave((d - 4.6) / 1.2) * cercaEst + 0.03 * Math.sin(x * 3.1 + z * 2.7) * (1 - suave((d - 2.8) / 0.4));
    if (z < -8) y += Math.pow(-8 - z, 1.25) * 0.035 * suave((d - 6) / 3);   // el valle sube suave hacia el fondo
    return y;
  }
  // ------------------------------------------------------------ cielo
  // Bóveda azul que se aclara solo en la franja del horizonte, y unas nubes quietas al fondo.
  // Sin niebla ni mapeo de tonos, para que el color sea el que se eligió.
  var HORIZONTE = 0xaecbe6, CENIT = 0x3a7fcb;
  function construyeCielo() {
    var g = new T.SphereGeometry(200, 48, 24), p = g.attributes.position, col = [], c = new T.Color(), h = new T.Color(HORIZONTE), z = new T.Color(CENIT);
    for (var i = 0; i < p.count; i++) {
      var y = p.getY(i) / 200;
      c.copy(h).lerp(z, Math.pow(M.acota(y * 6, 0, 1), 0.55)); col.push(c.r, c.g, c.b);   // azul desde pocos grados sobre el horizonte
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    var boveda = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    boveda.userData.sinSombra = true; boveda.renderOrder = -1; G.escena.add(boveda);
    // nubes: varios óvalos difusos en un lienzo transparente
    var c2 = document.createElement('canvas'); c2.width = 512; c2.height = 256;
    var cx = c2.getContext('2d'), rn = M.mulberry32(5);
    for (var k = 0; k < 26; k++) {
      var x = 70 + rn() * 372, y = 150 - Math.sin((x - 70) / 372 * Math.PI) * (40 + rn() * 50) + rn() * 30, rad = 30 + rn() * 50;
      var gr = cx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, rad, 0, 6.29); cx.fill();
    }
    var tex = new T.CanvasTexture(c2); tex.encoding = T.sRGBEncoding;
    var matNube = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    [[-90, 38, -150, 70], [-10, 52, -175, 90], [70, 34, -160, 64], [130, 46, -110, 70], [-150, 44, -90, 60], [30, 70, -150, 50]].forEach(function (n, i) {
      var m = new T.Mesh(new T.PlaneGeometry(n[3], n[3] / 2), matNube);
      m.position.set(n[0], n[1], n[2]); m.lookAt(0, n[1] * 0.6, 0); m.scale.x = i % 2 ? -1 : 1;
      m.userData.sinSombra = true; m.renderOrder = -1; G.escena.add(m);
    });
  }

  // ------------------------------------------------------------ vegetación
  // Pasto en matas sobre las orillas, carrizo al borde del agua y macollos de zacatón dispersos, con mallas
  // instanciadas (una llamada de dibujo por tipo). Posiciones deterministas: misma figura siempre.
  // Se deja libre la estación, el cable, la torre y el frente del corte.
  function libre(x, z) {
    return Math.hypot(x + 4.3, z - 0.1) > 1.7 && !(x > -4.3 && x < 1.4 && z > 0.2 && z < 1.6) &&
      Math.hypot(x - 11, z + 9) > 1.1 && z < Z_CORTE - 0.15;
  }
  function matas(hojas, ancho) {             // `hojas` hojas en abanico, de altura 1, para escalar
    var p = [], i;
    for (i = 0; i < hojas; i++) {
      var a = i / hojas * Math.PI * 2 + 0.4 * Math.sin(i * 7.3), r = 0.05 + 0.04 * ((i * 5) % 3);
      var cx = Math.cos(a) * r, cz = Math.sin(a) * r, px = -Math.sin(a) * ancho, pz = Math.cos(a) * ancho;
      var tx = Math.cos(a) * (0.18 + 0.1 * (i % 2)), tz = Math.sin(a) * (0.18 + 0.1 * (i % 2));   // inclinada hacia afuera
      p.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + tx, 1, cz + tz);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }
  // Macollo de zacatón (Muhlenbergia), el pasto amacollado de los llanos altos: muchas hojas finas
  // que salen del centro, suben y se arquean hacia afuera. Hoja de dos tramos, de altura 1.
  function macollo(hojas) {
    var p = [], r = M.mulberry32(3);
    for (var i = 0; i < hojas; i++) {
      var a = i / hojas * Math.PI * 2 + r() * 0.5, ca = Math.cos(a), sa = Math.sin(a), w = 0.018;
      var abre = 0.25 + r() * 0.25, alto = 0.75 + r() * 0.25, b0 = 0.04 * r();
      var m = [ca * (b0 + abre * 0.45), alto * 0.7, sa * (b0 + abre * 0.45)], t = [ca * (b0 + abre), alto * (0.78 + 0.1 * r()), sa * (b0 + abre)];
      var px = -sa * w, pz = ca * w;
      p.push(ca * b0 - px, 0, sa * b0 - pz, ca * b0 + px, 0, sa * b0 + pz, m[0] + px * 0.6, m[1], m[2] + pz * 0.6,
        ca * b0 - px, 0, sa * b0 - pz, m[0] + px * 0.6, m[1], m[2] + pz * 0.6, m[0] - px * 0.6, m[1], m[2] - pz * 0.6,
        m[0] - px * 0.6, m[1], m[2] - pz * 0.6, m[0] + px * 0.6, m[1], m[2] + pz * 0.6, t[0], t[1], t[2]);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }
  function instancias(geo, mat, lista, sombra) {
    var m = new T.InstancedMesh(geo, mat, lista.length), o = new T.Object3D(), c = new T.Color();
    lista.forEach(function (it, i) {
      o.position.set(it.x, it.y, it.z); o.rotation.set(0, it.giro, 0); o.scale.set(it.s[0], it.s[1], it.s[2]);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.setHex(it.color));
    });
    m.castShadow = !!sombra; m.receiveShadow = true; m.userData.sinSombra = !sombra;
    G.escena.add(m);
    return m;
  }
  function construyeVegetacion() {
    var r = M.mulberry32(41), pasto = [], carrizo = [], arbustos = [], i, x, z, d;
    var VERDES = [0x8f9a6a, 0xa3ab78, 0x7f8c5e, 0x96a06c], CARRIZO = [0x8c9563, 0x9da270, 0x7d8858];
    for (i = 0; i < 9000 && pasto.length < 3200; i++) {
      x = -13 + r() * 32; z = -30 + r() * (Z_CORTE + 30); d = Math.abs(x - ejeRio(z));
      if (d < 4.7 || !libre(x, z)) continue;
      var h = 0.14 + r() * 0.22;
      pasto.push({ x: x, y: altura(x, z) - 0.01, z: z, giro: r() * 6.28, s: [h * 1.1, h, h * 1.1], color: VERDES[(r() * 4) | 0] });
    }
    for (i = 0; i < 6000 && carrizo.length < 700; i++) {
      x = -13 + r() * 32; z = -32 + r() * (Z_CORTE + 32); d = Math.abs(x - ejeRio(z));
      if (d < 2.85 || d > 3.7 || !libre(x, z) || (x > -2.2 && x < 2.4 && z > -0.8)) continue;
      var y = altura(x, z), alto = 0.55 + r() * 0.75;
      if (y > 0.35) continue;                       // solo al pie del talud, cerca de la lámina de agua
      carrizo.push({ x: x, y: Math.max(y, SUP_AGUA - 0.15), z: z, giro: r() * 6.28, s: [alto * 0.5, alto, alto * 0.5], color: CARRIZO[(r() * 3) | 0] });
    }
    for (i = 0; i < 3000 && arbustos.length < 40; i++) {
      x = -13 + r() * 32; z = -30 + r() * (Z_CORTE + 30); d = Math.abs(x - ejeRio(z));
      if (d < 5.2 || !libre(x, z) || Math.hypot(x + 4.3, z - 0.1) < 3) continue;
      var t = 0.55 + r() * 0.4;
      arbustos.push({ x: x, y: altura(x, z) - 0.02, z: z, giro: r() * 6.28, s: [t * 1.1, t, t * 1.1], color: [0xaba57c, 0x9c9b70, 0xb3ab84][(r() * 3) | 0] });
    }
    var hoja = new T.MeshStandardMaterial({ color: 0xffffff, side: T.DoubleSide, roughness: 0.9, metalness: 0 });
    instancias(matas(7, 0.022), hoja, pasto, false);
    instancias(matas(9, 0.014), hoja, carrizo, false);
    instancias(macollo(26), hoja, arbustos, true);
  }

  function construyeValle() {
    var X0 = -13, X1 = 19, Z0 = -36, NX = 192, NZ = 180;
    var g = new T.PlaneGeometry(X1 - X0, Z_CORTE - Z0, NX, NZ);
    g.rotateX(-Math.PI / 2);
    g.translate((X0 + X1) / 2, 0, (Z0 + Z_CORTE) / 2);
    var pos = g.attributes.position, col = [], c = new T.Color();
    var PASTO = new T.Color(0xa7b08c), TIERRA = new T.Color(0xae9c7e), LECHO = new T.Color(0x6f675a);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), y = altura(x, z), d = Math.abs(x - ejeRio(z));
      pos.setY(i, y);
      if (d < 3.2) c.copy(LECHO); else if (d < 4.9) c.copy(TIERRA).lerp(PASTO, suave((d - 4.3) / 0.6)); else c.copy(PASTO);
      c.offsetHSL(0, 0, 0.025 * Math.sin(x * 5.1 + z * 3.7));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    // Detalle del suelo: briznas y grumos en gris claro que oscurecen un poco el color de cada
    // vértice (pasto, talud, lecho), más un relieve fino. Una baldosa ≈ 2 m.
    var rs = ruido(7), TS = 256;
    var detalle = textura(TS, function (x, y) {
      var u = x / TS * 8, v = y / TS * 8;
      var k = 0.78 + 0.16 * rs(u, v, 5, 8) + 0.06 * rs(u * 4, v * 0.6, 2, 32);   // manchas y briznas alargadas
      k = Math.min(1, k * 1.04); return [k * 255, k * 255, k * 255];
    }, [16, 19], true);
    var relieveSuelo = normales(TS, function (x, y) { return rs(x / TS * 16, y / TS * 16, 3, 16); }, 2.2, [16, 19]);
    var suelo = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, map: detalle, normalMap: relieveSuelo,
      normalScale: new T.Vector2(0.8, 0.8), roughness: 0.95, metalness: 0 }));
    suelo.receiveShadow = true; suelo.userData.sinSombra = true; G.escena.add(suelo);

    // Corte frontal: el perfil del terreno hasta abajo, en tierra con estratos, contorno en tinta.
    var perfil = [], forma = new T.Shape(), k;
    for (k = 0; k <= 256; k++) { var xx = X0 + (X1 - X0) * k / 256; perfil.push(new T.Vector2(xx, altura(xx, Z_CORTE))); }
    forma.moveTo(X0, -3.2);
    perfil.forEach(function (q) { forma.lineTo(q.x, q.y); });
    forma.lineTo(X1, -3.2); forma.lineTo(X0, -3.2);
    var re = ruido(11);
    var estratos = textura(256, function (x, y) {
      var u = x / 256 * 8, v = y / 256 * 8, n = re(u, v, 4, 8);
      var banda = 0.5 + 0.5 * Math.sin((y / 256) * Math.PI * 2 * 3 + n * 2.4);       // capas de suelo
      var k = 0.86 + 0.08 * banda + 0.1 * (n - 0.5) + (re(u * 8, v * 8, 1, 64) > 0.82 ? -0.12 : 0);   // gravas
      return [201 * k, 185 * k, 155 * k];
    }, [0.25, 0.25], true);
    var corte = new T.Mesh(new T.ShapeGeometry(forma), new T.MeshStandardMaterial({ map: estratos, roughness: 1, metalness: 0 }));
    corte.position.z = Z_CORTE; corte.userData.sinSombra = true; G.escena.add(corte);
    var contorno = new T.Line(new T.BufferGeometry().setFromPoints(perfil.map(function (q) { return new T.Vector3(q.x, q.y, Z_CORTE + 0.01); })),
      new T.LineBasicMaterial({ color: TINTA }));
    G.escena.add(contorno);

    // Agua: superficie y cara del corte; su color sigue a la turbiedad. Las ondas y unas vetas de
    // espuma corren aguas abajo (hacia el corte) a la velocidad de la corriente del modelo, en tiempo
    // real: es lo único del agua que se mueve, y se mueve porque cambia con el dato.
    var ra = ruido(23);
    var ondas = normales(256, function (x, y) {
      var u = x / 256, v = y / 256;
      return 0.6 * ra(u * 4, v * 12, 3, 4) + 0.4 * ra(u * 12, v * 30, 2, 12);   // alargadas en el sentido del cauce
    }, 3, [6, 10]);
    var vetas = textura(256, function (x, y) {
      var u = x / 256, v = y / 256, n = ra(u * 16, v * 3, 3, 16);               // largas en el sentido del cauce
      var k = 0.9 + 0.1 * M.acota((n - 0.55) * 5, 0, 1); return [k * 255, k * 255, k * 255];
    }, [6, 10], true);
    G.ondas = [ondas, vetas];
    G.matAgua = new T.MeshStandardMaterial({ color: 0x587a80, roughness: 0.24, metalness: 0, normalMap: ondas, map: vetas,
      normalScale: new T.Vector2(0.35, 0.35), envMap: G.cielo, envMapIntensity: 0.35, transparent: true, opacity: 0.86, depthWrite: false, side: T.DoubleSide });
    G.matCaraAgua = new T.MeshStandardMaterial({ color: 0x587a80, roughness: 0.6, metalness: 0, transparent: true, opacity: 0.72, depthWrite: false, side: T.DoubleSide });
    var sup = new T.Mesh(new T.PlaneGeometry(16, Z_CORTE - Z0), G.matAgua);
    sup.rotation.x = -Math.PI / 2; sup.position.set(3.25, SUP_AGUA, (Z0 + Z_CORTE) / 2); sup.receiveShadow = true; G.escena.add(sup);
    var mojado = perfil.filter(function (q) { return q.y < SUP_AGUA; });
    var fa = new T.Shape();
    fa.moveTo(mojado[0].x, SUP_AGUA);
    mojado.forEach(function (q) { fa.lineTo(q.x, q.y); });
    fa.lineTo(mojado[mojado.length - 1].x, SUP_AGUA);
    var caraAgua = new T.Mesh(new T.ShapeGeometry(fa), G.matCaraAgua);
    caraAgua.position.z = Z_CORTE + 0.02; G.escena.add(caraAgua);
    // la lámina de agua en el corte, en azul: es lo primero que tiene que leerse como agua
    G.escena.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(mojado[0].x, SUP_AGUA, Z_CORTE + 0.03), new T.Vector3(mojado[mojado.length - 1].x, SUP_AGUA, Z_CORTE + 0.03)]),
      new T.LineBasicMaterial({ color: AGUA })));

    // Follaje: textura de hojas para las copas.
    var rf = ruido(31);
    var hojas = textura(128, function (x, y) {
      var k = 0.8 + 0.25 * rf(x / 128 * 16, y / 128 * 16, 2, 16); return [k * 255, k * 255, k * 255];
    }, [3, 3], true);
    // Ahuejotes (Salix bonplandiana), el árbol de las orillas y los canales del valle: copa angosta y
    // alta, en huso, con ramas que suben. Una silueta tranquila que no compite con la estación: pocos,
    // al fondo y a los lados, en verde grisáceo. Copa por revolución de un perfil, con estrías
    // verticales de ruido; todos comparten geometría (una llamada de dibujo para copas y otra para troncos).
    var perfilCopa = [];
    for (k = 0; k <= 22; k++) {
      var t = k / 22, rr = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75) * (1 - 0.35 * t);
      perfilCopa.push(new T.Vector2(Math.max(rr, 0.001), t));
    }
    var copaG = new T.LatheGeometry(perfilCopa, 14), cp = copaG.attributes.position, w = new T.Vector3();
    for (k = 0; k < cp.count; k++) {
      w.fromBufferAttribute(cp, k);
      var ang = Math.atan2(w.z, w.x) + Math.PI;                       // 0..2π; costura con el mismo valor
      var n = rf((Math.cos(ang) + 1) * 4 + 7, (Math.sin(ang) + 1) * 4 + w.y * 2.5, 3, 64);
      var f = 0.8 + 0.4 * n; cp.setXYZ(k, w.x * f, w.y, w.z * f);
    }
    copaG.computeVertexNormals();
    var arboles = [], troncos = [], ra2 = M.mulberry32(17);
    [[-9.5, -15], [-6.8, -11], [-11, -7.5], [-5.5, -24], [-8.6, -30], [-2.6, -28], [13, -11], [9.8, -19],
     [15, -5.5], [12, -27], [16.4, -17], [8.8, -31]].forEach(function (a) {
      var y = altura(a[0], a[1]), H = 3.2 + ra2() * 1.3, R = 0.5 + ra2() * 0.2;
      troncos.push({ x: a[0], y: y, z: a[1], giro: 0, s: [1, H * 0.32, 1], color: 0x6f6250 });
      arboles.push({ x: a[0], y: y + H * 0.18, z: a[1], giro: ra2() * 6.28, s: [R, H * 0.82, R], color: ra2() < 0.5 ? 0x8b9a7a : 0x7d8d6e });
    });
    var troncoG = new T.CylinderGeometry(0.05, 0.09, 1, 7); troncoG.translate(0, 0.5, 0);
    instancias(troncoG, mate(0xffffff, { roughness: 1 }), troncos, true);
    instancias(copaG, mate(0xffffff, { map: hojas, roughness: 0.95 }), arboles, true);

    construyeVegetacion();

  }

  // ------------------------------------------------------------ rótulos HTML
  // Vista general: un rótulo corto por componente, nombre y dato vivo, sobre fondo blanco para que no
  // se pierda contra la vegetación. Cada uno abre su vista de cerca (clic en el rótulo o en la pieza).
  var ROTULOS = [
    { id: 'sondas', nombre: 'Sondas', ancla: [0.6, -1.15, 0.9], lado: 'izq', vista: 'sondas' },
    { id: 'ctrl', nombre: 'Gabinete', ancla: S([-4.62, 2.15, 0.45]), lado: 'izq', vista: 'gabinete' },
    { id: 'panel', nombre: 'Energía', ancla: S([-5.1, 4.95, 0.2]), lado: 'izq', vista: 'energia' },
    { id: 'torre', nombre: 'Comunicación', ancla: [11.4, 7.4, -9], lado: 'der', vista: 'enlace' },
    { id: 'rio', nombre: 'Corriente', ancla: [6.2, SUP_AGUA, -5], lado: 'der' }
  ];

  // Vistas de cerca: un rótulo por pieza, en dos columnas a los lados, con una línea a la pieza.
  // Qué es sale de la ficha técnica; el estado y el dato, de la estación simulada.
  var SENSOR = {
    COND: { nombre: 'Conductividad', como: 'dos electrodos, K = 1.0', dec: 0 },
    OD:   { nombre: 'Oxígeno disuelto', como: 'membrana; la más lenta en estabilizar', dec: 2 },
    PH:   { nombre: 'pH', como: 'electrodo de vidrio', dec: 2 },
    TEMP: { nombre: 'Temperatura', como: 'compensa a las demás sondas', dec: 1 },
    TURB: { nombre: 'Turbiedad', como: 'óptica, con limpiador', dec: 1 }
  };
  var FILAS_SONDAS = { COND: [-1, -0.2], OD: [-1, 0.02], PH: [-1, 0.24], TEMP: [1, -0.1], TURB: [1, 0.14] };
  function v3(p) { return new T.Vector3(p[0], p[1], p[2]); }
  function enSD(n) { return n ? n + (n === 1 ? ' paquete por enviar' : ' paquetes por enviar') : 'Vacía: todo enviado'; }
  function hora(t) { return M.iso(t).substr(11, 5); }
  // Cada detalle: centro de las columnas (punto 3D) y sus piezas. valor(e) devuelve [texto, alarma],
  // con e = { s, nom, f, transcurrido, env, nSD }.
  function detalles() {
    var d = {};
    d.sondas = { centro: G.centroSondas, items: M.PARAMS.map(function (q) {
      return { nombre: SENSOR[q].nombre, como: SENSOR[q].como, ancla: G.puntaSensor[q], col: FILAS_SONDAS[q][0], fila: FILAS_SONDAS[q][1],
        valor: function (e) {
          var son = e.s.sondas[q], esp = son.espec, med = e.s.fw.detalleMed && e.s.fw.detalleMed[q];
          if (son.falla === 'sin_respuesta') return ['No responde: se envía vacío', true];
          if (son.falla === 'menos999') return ['Rota: se envía −999', true];
          if (son.falla === 'congelado') return ['Congelada: repite el valor', true];
          if (e.nom === 'CALENTAMIENTO') return [e.transcurrido < esp.estabS ? 'Estabilizando, faltan ' + Math.ceil(esp.estabS - e.transcurrido) + ' s' : 'Estable, en espera'];
          if (e.nom === 'MEDICIÓN') return ['Lectura ' + Math.min(5, Math.floor(e.transcurrido) + 1) + ' de 5'];
          if (!med || med.valor === null || med.valor === undefined) return ['Sin medición todavía'];
          return [('Enviado: ' + med.valor.toFixed(SENSOR[q].dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + (esp.unidad === 'pH' ? '' : esp.unidad)).trim()];
        } };
    }) };
    d.gabinete = { centro: v3(S([-4.05, 2.0, 0.45])), items: [
      { nombre: 'Controlador ESP32', como: 'despierta, mide, guarda y envía', ancla: v3(S([-4.25, 2.22, 0.33])), col: -1, fila: -0.22,
        valor: function (e) { return [e.env ? 'Enviando los datos' : estado(e.s.fw)]; } },
      { nombre: 'Reloj', como: 'pone la hora a cada medición', ancla: v3(S([-4.32, 2.12, 0.37])), col: -1, fila: -0.02,
        valor: function (e) { return [hora(e.s.fw.t)]; } },
      { nombre: 'Baterías', como: '2 × 18650, 22 Wh', ancla: v3(S([-4.2, 1.55, 0.42])), col: -1, fila: 0.2,
        valor: function (e) { var c = e.s.energia.soc(); return ['Carga ' + Math.round(c * 100) + ' %', c < 0.2]; } },
      { nombre: 'Módem LTE-M', como: 'envía por la red celular', ancla: v3(S([-3.85, 2.42, 0.37])), col: 1, fila: -0.16,
        valor: function (e) { return e.s.enlace.caido ? ['Sin red', true] : ['Señal ' + Math.round(e.s.enlace.rssi) + ' dBm']; } },
      { nombre: 'Memoria microSD', como: 'guarda cada paquete antes de enviarlo', ancla: v3(S([-4.08, 1.95, 0.4])), col: 1, fila: 0.1,
        valor: function (e) { return [enSD(e.nSD), e.nSD > 1 && !e.env]; } }
    ] };
    d.energia = { centro: v3(S([-4.15, 3.6, 0.3])), items: [
      { nombre: 'Panel solar', como: '5 W, inclinado al sur', ancla: v3(S([-4.75, 4.95, 0.2])), col: -1, fila: -0.2,
        valor: function (e) { var w = e.s.energia.solarW; return [w > 0.05 ? 'Genera ' + w.toFixed(1) + ' W' : 'Sin sol']; } },
      { nombre: 'Baterías', como: '22 Wh: ≈ 14 días sin sol', ancla: v3(S([-4.2, 1.55, 0.42])), col: -1, fila: 0.18,
        valor: function (e) { var c = e.s.energia.soc(); return ['Carga ' + Math.round(c * 100) + ' %', c < 0.2]; } },
      { nombre: 'Consumo', como: '≈ 1.4 Wh al día; casi todo dormida', ancla: v3(S([-4.25, 2.22, 0.33])), col: 1, fila: 0.05,
        valor: function (e) { return ['Gasta ' + Math.round(e.f.mW || 0) + ' mW: ' + (ESTADO[e.nom] || e.nom).toLowerCase()]; } }
    ] };
    var antena = v3(S([-3.65, 3.98, 0.35]));
    d.enlace = { centro: antena.clone().add(G.torreTope).multiplyScalar(0.5), items: [
      { nombre: 'Antena del módem', como: 'LTE-M, con SIM de datos', ancla: antena, col: -1, fila: -0.12,
        valor: function (e) { return e.s.enlace.caido ? ['Sin red: guarda y reintenta', true] : ['Señal ' + Math.round(e.s.enlace.rssi) + ' dBm']; } },
      { nombre: 'Memoria microSD', como: 'lo que no se envía se queda', ancla: v3(S([-4.08, 1.95, 0.4])), col: -1, fila: 0.16,
        valor: function (e) { return [enSD(e.nSD), e.nSD > 1 && !e.env]; } },
      { nombre: 'Paquete', como: 'lecturas por HTTPS a la plataforma', ancla: G.rutaAire.getPoint(0.5), col: 1, fila: -0.26,
        valor: function (e) { return [e.env ? (e.env.k < ENV.llega ? 'Viajando a la torre' : e.env.k < ENV.ack ? 'Llegó: vuelve la confirmación' : 'Confirmado') : 'Esperando la próxima medición']; } },
      { nombre: 'Torre celular', como: 'del operador; no es nuestra', ancla: G.torreTope, col: 1, fila: 0.04,
        valor: function (e) { return e.s.enlace.caido ? ['Sin cobertura en el sitio', true] : [e.env && e.env.k < ENV.ack ? 'Recibiendo los datos' : 'Con cobertura']; } }
    ] };
    return d;
  }

  function construyeRotulos() {
    var capa = $('rotulos3d'); capa.innerHTML = '';
    ROTULOS.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'rot3d ' + r.lado + (r.vista ? ' clic' : '');
      d.innerHTML = '<b>' + r.nombre + '</b><span class="val" id="rv_' + r.id + '"></span>';
      capa.appendChild(d);
      r.el = d; r.v = new T.Vector3(r.ancla[0], r.ancla[1], r.ancla[2]);
      if (r.vista) d.addEventListener('click', function () { irA(r.vista); });
    });
    G.lineas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    G.lineas.setAttribute('class', 'lineas3d');
    capa.appendChild(G.lineas);
    G.detalle = detalles();
    Object.keys(G.detalle).forEach(function (k) {
      G.detalle[k].items.forEach(function (it) {
        var izq = it.col < 0, d = document.createElement('div');
        d.className = 'rot3d sensor ' + (izq ? 'izq' : 'der');
        d.innerHTML = '<b>' + it.nombre + '</b><span class="eq">' + it.como + '</span><span class="val"></span>';
        d.style.display = 'none';
        capa.appendChild(d);
        it.el = d; it.val = d.querySelector('.val'); it.izq = izq;
        it.linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        G.lineas.appendChild(it.linea);
      });
    });
    // volver a la vista general: botón dentro de la figura, solo en una vista de cerca
    G.volver = document.createElement('button');
    G.volver.className = 'boton volver3d'; G.volver.textContent = 'Vista general'; G.volver.hidden = true;
    G.volver.addEventListener('click', function () { irA('general'); });
    $('escena3d').appendChild(G.volver);
  }
  function colocaRotulos() {
    var w = G.lienzo.clientWidth, h = G.lienzo.clientHeight, quieto = !G.trans;
    function pantalla(v) { var p = v.clone().project(G.camara); return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, z: p.z }; }
    ROTULOS.forEach(function (r) {
      var p = pantalla(r.v);
      r.el.style.left = p.x.toFixed(1) + 'px';
      r.el.style.top = p.y.toFixed(1) + 'px';
      r.el.style.display = p.z < 1 && G.vista === 'general' && quieto ? '' : 'none';
    });
    var activo = G.vista !== 'general' && quieto ? G.detalle[G.vista] : null;
    G.lineas.style.display = activo ? '' : 'none';
    var dx = Math.min(0.22 * w, 280);
    Object.keys(G.detalle).forEach(function (k) {
      var det = G.detalle[k], mostrar = det === activo, c = mostrar ? pantalla(det.centro) : null;
      det.items.forEach(function (it) {
        it.el.style.display = mostrar ? '' : 'none';
        it.linea.style.display = mostrar ? '' : 'none';
        if (!mostrar) return;
        // El rótulo queda del lado de su columna pero siempre por fuera de su pieza: si la pieza está más
        // allá de la columna, el rótulo se corre hacia afuera.
        var y = h / 2 + it.fila * h, punta = pantalla(it.ancla), ancho = it.el.offsetWidth || 160;
        var col = M.acota(c.x, dx + 10, w - dx - 10), izq = it.izq;
        var x = izq ? Math.min(col - dx, punta.x - 36) : Math.max(col + dx, punta.x + 36);
        // sin espacio afuera (pieza en el borde de la figura): el rótulo va junto a la pieza, del lado de adentro
        if (izq && x - 10 - ancho < 4) { izq = false; x = punta.x + 36; }
        else if (!izq && x + 10 + ancho > w - 4) { izq = true; x = punta.x - 36; }
        it.el.classList.toggle('izq', izq); it.el.classList.toggle('der', !izq);
        it.el.style.left = x.toFixed(1) + 'px'; it.el.style.top = y.toFixed(1) + 'px';
        var codo = punta.x + (izq ? -18 : 18);
        it.linea.setAttribute('points', [x + (izq ? 4 : -4), y, codo, y, punta.x, punta.y].map(function (n) { return n.toFixed(1); }).join(' '));
      });
    });
  }
  function rotulo(id, texto, alarma) {
    var e = $('rv_' + id);
    if (e.textContent !== texto) e.textContent = texto;
    e.classList.toggle('mal', !!alarma);
  }
  function pintaDetalle(e) {
    var det = G.detalle[G.vista];
    if (!det) return;
    det.items.forEach(function (it) {
      var v = it.valor(e), txt = v[0];
      if (it.val.textContent !== txt) it.val.textContent = txt;
      it.val.classList.toggle('mal', !!v[1]);
    });
  }

  // ------------------------------------------------------------ la escena
  function construye() {
    T = window.THREE;
    if (T && T.ColorManagement) T.ColorManagement.legacyMode = false;   // hex y setHex como sRGB
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
    // Luz en espacio lineal y salida sRGB con mapeo de tonos: las sombras y la luz rasante del
    // amanecer se ven como en una foto, sin quemar los blancos. Los colores en hex siguen siendo sRGB.
    G.render.outputEncoding = T.sRGBEncoding;
    G.render.toneMapping = T.ACESFilmicToneMapping;
    G.render.toneMappingExposure = 1.0;
    // Las sombras se calculan una vez: el sol está fijo (luzSoleada).
    G.render.shadowMap.enabled = true;
    G.render.shadowMap.autoUpdate = false;
    G.render.shadowMap.type = T.PCFShadowMap;
    G.escena = new T.Scene();
    G.escena.fog = new T.Fog(HORIZONTE, 32, 120);   // la niebla funde el valle con el horizonte del cielo
    G.camara = new T.PerspectiveCamera(30, 2, 0.1, 250);
    G.objetivo = new T.Vector3(-0.4, 3.0, -2.2);
    G.orbita = { yaw: -0.42, pitch: 0.16, dist: 24 }; G.vista = 'general'; G.trans = null;

    // Cielo para los reflejos (metal y agua): un degradado claro, sin foto ni descarga.
    var cielo = new T.Scene(), cg = new T.SphereGeometry(50, 32, 16), cc = [], cp = cg.attributes.position;
    for (var ci = 0; ci < cp.count; ci++) {
      var cy = cp.getY(ci) / 50, ck = cy < 0 ? new T.Color(0xc9ced0).lerp(new T.Color(HORIZONTE), M.acota(cy * 2 + 1, 0, 1))
        : new T.Color(HORIZONTE).lerp(new T.Color(CENIT), M.acota(cy * 1.6, 0, 1));   // reflejan el mismo cielo que se ve
      cc.push(ck.r, ck.g, ck.b);
    }
    cg.setAttribute('color', new T.Float32BufferAttribute(cc, 3));
    cielo.add(new T.Mesh(cg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    var pmrem = new T.PMREMGenerator(G.render);
    // Solo para metal, vidrio y agua: como luz de ambiente general lavaría los colores mate.
    G.cielo = pmrem.fromScene(cielo, 0.04).texture;
    pmrem.dispose();
    construyeCielo();

    // Cielo, sol y un relleno tenue desde la cámara (valores en luzSoleada).
    G.cieloLuz = new T.HemisphereLight(0xffffff, 0xb9b39a, 0.6); G.escena.add(G.cieloLuz);
    G.relleno = new T.DirectionalLight(0xdfe6ee, 0.18); G.escena.add(G.relleno);
    var sol = G.sol = new T.DirectionalLight(0xfffaf0, 0.7); sol.position.set(-6, 12, 8);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
    var sc = sol.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 60;
    sol.target.position.set(1, 0, -6); G.escena.add(sol.target); G.solMira = sol.target.position;
    G.escena.add(sol);

    var pvc = mate(0xf4f6f7, { roughness: 0.5 }), acero = metal(0xb9c2c8, 0.4), oscuro = mate(0x2a3640, { roughness: 0.6 });

    construyeValle();

    // Tubo de protección con las cinco sondas, en el agua y anclado a la orilla con un brazo.
    caja(2.5, 0.08, 0.12, acero, -0.3, 0.58, 0.9);
    G.tuboSondas = cilindro(0.17, 2.0, pvc, 0.9, -0.4, 0.9, null, 24);
    G.tuboSondas.material = mate(0xf4f6f7, { transparent: true, opacity: 0.38, depthWrite: false });
    aristas(G.tuboSondas, 0.5);
    // Cada sonda: cuerpo, un anillo que se marca al medir (G.puntas) y su cabeza, distinta según lo
    // que mide, que asoma por debajo del tubo. Se ven en la vista de cerca (clic en las sondas).
    var antesSondas = G.escena.children.length - 2;          // incluye brazo y tubo
    var cuerpo = mate(0x55626c, { roughness: 0.5 }), negro = mate(0x22292e, { roughness: 0.55 });
    var vidrio = mate(0xe3f1f4, { transparent: true, opacity: 0.45, roughness: 0.05, envMap: G.cielo, envMapIntensity: 1, depthWrite: false });
    var inox = metal(0xd3d9dd, 0.25);
    G.puntas = {}; G.puntaSensor = {}; G.centroSondas = new T.Vector3(0.9, -1.22, 0.9);
    M.PARAMS.forEach(function (p, i) {
      var x = 0.9 + (i - 2) * 0.065, z = 0.9 + ((i % 2) ? 0.05 : -0.05), yT = -1.285, ancla = yT - 0.1;
      cilindro(0.022, 1.65, cuerpo, x, -0.425, z, null, 12);
      G.puntas[p] = cilindro(0.026, 0.03, mate(AGUA), x, -1.265, z, null, 16);
      if (p === 'COND') {                       // celda de dos electrodos: anillos de acero
        cilindro(0.026, 0.13, negro, x, yT - 0.065, z, null, 16);
        cilindro(0.0275, 0.012, inox, x, yT - 0.05, z, null, 16);
        cilindro(0.0275, 0.012, inox, x, yT - 0.095, z, null, 16);
        ancla = yT - 0.075;
      } else if (p === 'OD') {                  // capuchón con membrana
        cilindro(0.03, 0.1, negro, x, yT - 0.05, z, null, 16);
        cilindro(0.027, 0.016, mate(0xcfc6a6, { roughness: 0.4 }), x, yT - 0.108, z, null, 16);
        ancla = yT - 0.11;
      } else if (p === 'PH') {                  // vástago y bulbo de vidrio
        cilindro(0.016, 0.08, vidrio, x, yT - 0.04, z, null, 16);
        var bulbo = new T.Mesh(new T.SphereGeometry(0.021, 20, 14), vidrio);
        bulbo.position.set(x, yT - 0.095, z); G.escena.add(bulbo);
        cilindro(0.003, 0.09, inox, x, yT - 0.05, z, null, 6);   // hilo de referencia
        ancla = yT - 0.1;
      } else if (p === 'TEMP') {                // aguja de acero
        cilindro(0.007, 0.15, inox, x, yT - 0.075, z, null, 10);
        ancla = yT - 0.14;
      } else if (p === 'TURB') {                // ventana óptica y limpiador
        cilindro(0.03, 0.11, negro, x, yT - 0.055, z, null, 16);
        cilindro(0.02, 0.004, mate(0x1d3d55, { roughness: 0.05, metalness: 0.2, envMap: G.cielo }), x, yT - 0.112, z, null, 16);
        caja(0.056, 0.005, 0.008, mate(0x2a3138), x, yT - 0.116, z, null, 0);
        ancla = yT - 0.115;
      }
      G.puntaSensor[p] = new T.Vector3(x, ancla, z);
    });
    // Zona de clic más ancha que el tubo (invisible): el tubo mide pocos píxeles en la vista general.
    var zonaTubo = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 2.6, 12), new T.MeshBasicMaterial());
    zonaTubo.position.set(0.9, -0.5, 0.9); zonaTubo.visible = false; zonaTubo.userData.sinSombra = true; G.escena.add(zonaTubo);
    G.zonas = G.escena.children.slice(antesSondas).filter(function (o) { return o.isMesh; });
    G.zonas.forEach(function (o) { o.userData.vista = 'sondas'; });

    // Cable de las sondas al gabinete, por la orilla.
    G.matCable = mate(0x55626c);
    var finCable = [S([-4.0, 1.3, 0.45]), S([-4.0, 1.12, 0.45])];
    var trazoCable = [[0.9, 0.6, 0.9], [0.7, 0.82, 0.9], [-1.5, 0.74, 0.85], [-3.3, 0.74, 0.9], finCable[1], finCable[0]];
    tubo(trazoCable, 0.035, G.matCable);

    // Mástil, gabinete abierto, panel y antena: todo lo que se crea hasta "fin de la estación"
    // se mueve a un grupo escalado 1.6× desde la base del mástil.
    var antes = G.escena.children.length;
    cilindro(0.07, 4.4, acero, -4.3, 2.8, 0.1);
    var gab = mate(0xe9edf0, { roughness: 0.55 });   // policarbonato con pintura en polvo
    caja(1.15, 1.45, 0.06, gab, -4.05, 2.0, 0.22);              // fondo
    caja(0.06, 1.45, 0.5, gab, -4.6, 2.0, 0.45);                // lados
    caja(0.06, 1.45, 0.5, gab, -3.5, 2.0, 0.45);
    caja(1.15, 0.06, 0.5, gab, -4.05, 2.7, 0.45);               // techo y piso
    caja(1.15, 0.06, 0.5, gab, -4.05, 1.3, 0.45);
    var puerta = caja(1.15, 1.45, 0.05, mate(0xdfe5e9, { transparent: true, opacity: 0.85 }), 0, 0, 0, new T.Group(), 0.6);
    var bisagra = new T.Group(); bisagra.position.set(-4.62, 2.0, 0.72); puerta.position.set(0.575, 0, 0);
    bisagra.add(puerta); bisagra.rotation.y = -1.9; G.escena.add(bisagra);
    // dentro: placa del controlador, SD, módem, baterías
    // placa con pistas de cobre: un dibujo fino sobre el verde del circuito impreso
    var pcb = document.createElement('canvas'); pcb.width = pcb.height = 128;
    var px = pcb.getContext('2d'); px.fillStyle = '#3e5a4f'; px.fillRect(0, 0, 128, 128);
    px.strokeStyle = 'rgba(190, 170, 110, 0.55)'; px.lineWidth = 1.2;
    for (var pi = 0; pi < 14; pi++) {
      var py = 8 + pi * 8.5; px.beginPath(); px.moveTo(6, py); px.lineTo(40 + (pi * 23) % 50, py);
      px.lineTo(52 + (pi * 23) % 50, py + 6); px.lineTo(122, py + 6); px.stroke();
    }
    var texPcb = new T.CanvasTexture(pcb); texPcb.encoding = T.sRGBEncoding;
    caja(0.55, 0.42, 0.04, mate(0xffffff, { map: texPcb, roughness: 0.45 }), -4.25, 2.1, 0.3);
    caja(0.16, 0.12, 0.05, oscuro, -4.32, 2.12, 0.34, null, 0);
    G.sd = caja(0.12, 0.03, 0.09, mate(0x6d7b85), -4.08, 1.95, 0.36);
    caja(0.3, 0.22, 0.08, metal(0x8a959d, 0.35), -3.85, 2.42, 0.32);   // módem, carcasa de aluminio
    G.baterias = [];
    [0, 1].forEach(function (k) {
      var b = cilindro(0.08, 0.6, mate(0x3a4750, { roughness: 0.3 }), -4.2, 1.55 + k * 0.17 - 0.08, 0.36, null, 16);
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
    // celdas de silicio con su rejilla plateada; vidrio liso encima (rugosidad baja)
    var cel = document.createElement('canvas'); cel.width = 384; cel.height = 240;
    var cx = cel.getContext('2d'); cx.fillStyle = '#c9d0d4'; cx.fillRect(0, 0, 384, 240);
    for (var ix = 0; ix < 6; ix++) for (var iy = 0; iy < 4; iy++) {
      var x0 = 6 + ix * 62.5, y0 = 6 + iy * 57.5;
      cx.fillStyle = '#24364a'; cx.fillRect(x0, y0, 59, 54);
      cx.strokeStyle = 'rgba(200, 210, 220, 0.35)'; cx.lineWidth = 0.8;
      for (var b = 1; b < 3; b++) { cx.beginPath(); cx.moveTo(x0 + b * 19.7, y0); cx.lineTo(x0 + b * 19.7, y0 + 54); cx.stroke(); }
    }
    var texCel = new T.CanvasTexture(cel); texCel.encoding = T.sRGBEncoding;
    G.matPanel = mate(0xffffff, { map: texCel, roughness: 0.18, metalness: 0.1, envMap: G.cielo, envMapIntensity: 0.6, emissive: new T.Color(0x000000) });
    var panel = caja(1.6, 0.05, 1.0, G.matPanel, 0, 0, 0, new T.Group(), 1);
    var soporte = new T.Group(); soporte.position.set(-4.3, 4.95, 0.2); soporte.rotation.x = 0.42; soporte.add(panel);
    G.escena.add(soporte);
    // antena del módem
    G.matAntena = mate(TINTA);
    cilindro(0.02, 1.2, G.matAntena, -3.65, 3.3, 0.35, null, 8);
    G.matPunta = mate(TINTA, { emissive: new T.Color(0x000000) });   // se ilumina al conectar y enviar
    G.puntaAntena = cilindro(0.05, 0.1, G.matPunta, -3.65, 3.95, 0.35, null, 10);
    tubo([[-3.85, 2.53, 0.32], [-3.7, 2.7, 0.35], [-3.65, 2.75, 0.35]], 0.015, G.matCable);
    // fin de la estación
    var est = new T.Group(); est.position.set(BASE[0], BASE[1], BASE[2]); est.scale.setScalar(ESC);
    G.escena.children.slice(antes).forEach(function (o) { G.escena.remove(o); o.position.sub(new T.Vector3(BASE[0], BASE[1], BASE[2])); est.add(o); });
    G.escena.add(est);

    // Torre celular al fondo: celosía simple.
    var mt = metal(0xa3adb4, 0.5), base = [11, altura(11, -9), -9];
    [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(function (d) {
      var a = new T.Vector3(base[0] + d[0], base[1], base[2] + d[1]), b = new T.Vector3(base[0] + d[0] * 0.15, base[1] + 6.6, base[2] + d[1] * 0.15);
      var l = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, a.distanceTo(b), 6), mt);
      l.position.copy(a).add(b).multiplyScalar(0.5); l.lookAt(b); l.rotateX(Math.PI / 2); G.escena.add(l);
    });
    for (var y = 0.9; y < 6.4; y += 1.5) {
      var f = 1 - y / 6.6 * 0.85;
      caja(1 * f, 0.03, 1 * f, mt, base[0], base[1] + y, base[2], null, 0.4);
    }
    G.torreTope = new T.Vector3(base[0], base[1] + 6.8, base[2]);
    G.matTorreAnt = mate(0xe9edf0, { emissive: new T.Color(0x000000) });   // se ilumina al recibir
    caja(0.12, 0.6, 0.12, G.matTorreAnt, base[0] + 0.2, base[1] + 6.4, base[2] + 0.1);
    caja(0.12, 0.6, 0.12, G.matTorreAnt, base[0] - 0.2, base[1] + 6.4, base[2] - 0.1);

    // El paquete: un punto que viaja por el cable al medir y por el aire al enviar.
    G.paquete = new T.Mesh(new T.SphereGeometry(0.09, 16, 12), new T.MeshBasicMaterial({ color: TINTA }));
    G.paquete.visible = false; G.escena.add(G.paquete);
    // la confirmación (ACK) que regresa de la torre a la antena, en azul
    G.ack = new T.Mesh(new T.SphereGeometry(0.07, 16, 12), new T.MeshBasicMaterial({ color: AGUA }));
    G.ack.visible = false; G.escena.add(G.ack);
    G.rutaCable = new T.CatmullRomCurve3(trazoCable.concat([S([-4.1, 1.95, 0.36])])
      .map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
    var pa = S([-3.65, 4.0, 0.35]), a0 = new T.Vector3(pa[0], pa[1], pa[2]), a1 = G.torreTope.clone();
    var medio = a0.clone().add(a1).multiplyScalar(0.5); medio.y += 3.2;
    G.rutaAire = new T.QuadraticBezierCurve3(a0, medio, a1);
    // la trayectoria del aire se dibuja tenue solo mientras hay envío
    G.trazoAire = new T.Line(new T.BufferGeometry().setFromPoints(G.rutaAire.getPoints(40)),
      new T.LineDashedMaterial({ color: TINTA, dashSize: 0.25, gapSize: 0.2, transparent: true, opacity: 0.5 }));
    G.trazoAire.computeLineDistances(); G.trazoAire.visible = false; G.escena.add(G.trazoAire);

    // zonas de clic de las demás vistas de cerca
    zona('gabinete', S([-4.05, 2.0, 0.45]), [2.3, 2.6, 1.4]);
    zona('energia', S([-4.3, 4.95, 0.2]), [3.0, 1.4, 2.2]);
    zona('energia', S([-4.3, 3.4, 0.1]), [0.5, 3.2, 0.5]);              // el mástil, que lleva el cable del panel
    zona('enlace', S([-3.65, 3.5, 0.35]), [0.6, 2.0, 0.6]);
    zona('enlace', [G.torreTope.x, G.torreTope.y - 3.4, G.torreTope.z], [2.2, 7.2, 2.2]);

    // Sombras: todo lo opaco las proyecta y las recibe, salvo el terreno, el corte y el fondo.
    G.escena.traverse(function (o) {
      if (!o.isMesh || o.userData.sinSombra || o.material.transparent || o.material.isMeshBasicMaterial) return;
      o.castShadow = true; o.receiveShadow = true;
    });

    luzSoleada();
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
    // Un clic sin arrastrar sobre una pieza abre su vista de cerca (zonas invisibles, G.zonas).
    var x0 = null, y0 = null, recorrido = 0, rayo = new T.Raycaster(), puntero = new T.Vector2();
    function bajo(e) {
      var r = G.lienzo.getBoundingClientRect();
      puntero.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      rayo.setFromCamera(puntero, G.camara);
      var hit = rayo.intersectObjects(G.zonas, false)[0];
      return hit ? hit.object.userData.vista : null;
    }
    G.lienzo.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; recorrido = 0; G.lienzo.setPointerCapture(e.pointerId); });
    G.lienzo.addEventListener('pointerup', function (e) {
      var v = x0 !== null && recorrido < 5 && G.vista === 'general' ? bajo(e) : null;
      if (v) irA(v);
      x0 = null;
    });
    G.lienzo.addEventListener('pointermove', function (e) {
      if (x0 === null) {                         // sin botón: la mano indica qué se puede abrir
        if (G.vista === 'general' && !G.trans) G.lienzo.classList.toggle('apunta', !!bajo(e));
        return;
      }
      recorrido += Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0);
      var lim = VISTAS[G.vista].lim;
      G.orbita.yaw = M.acota(G.orbita.yaw - (e.clientX - x0) * 0.006, lim[0], lim[1]);
      G.orbita.pitch = M.acota(G.orbita.pitch + (e.clientY - y0) * 0.004, lim[2], lim[3]);
      x0 = e.clientX; y0 = e.clientY; G.sucio = true;
    });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && G.vista !== 'general') irA('general'); });
  }
  // Zonas de clic invisibles, más anchas que cada pieza (en la vista general miden pocos píxeles).
  function zona(vista, centro, tam) {
    var m = new T.Mesh(new T.BoxGeometry(tam[0], tam[1], tam[2]), new T.MeshBasicMaterial());
    m.position.set(centro[0], centro[1], centro[2]); m.visible = false; m.userData = { vista: vista, sinSombra: true };
    G.escena.add(m); G.zonas.push(m);
  }

  // ------------------------------------------------------------ vistas
  // General: toda la estación. Sondas: de frente al corte, bajo la lámina de agua, con el agua del corte
  // más clara. Gabinete: de frente a la puerta abierta. Energía: del panel a las baterías. Comunicación:
  // la antena, la trayectoria del paquete y la torre. El paso entre vistas dura 0.8 s.
  var VISTAS = {
    general:  { obj: [-0.4, 3.0, -2.2], yaw: -0.42, pitch: 0.16, dist: 24, lim: [-1.1, 0.7, 0.04, 0.75], agua: 0.72, tubo: 0.38 },
    sondas:   { obj: [0.9, -1.1, 0.9], yaw: -0.18, pitch: 0.1, dist: 1.9, lim: [-0.8, 0.45, -0.05, 0.5], agua: 0.45, tubo: 0.16 },
    gabinete: { obj: S([-4.05, 2.0, 0.45]), yaw: 0.05, pitch: 0.1, dist: 5.2, lim: [-0.6, 0.6, 0, 0.5], agua: 0.72, tubo: 0.38 },
    energia:  { obj: S([-4.15, 3.6, 0.3]), yaw: -0.15, pitch: 0.22, dist: 10.5, lim: [-0.7, 0.6, 0.05, 0.6], agua: 0.72, tubo: 0.38 },
    enlace:   { obj: [3.8, 6.6, -4.3], yaw: 0.6, pitch: 0.1, dist: 23, lim: [0.1, 1.0, 0.02, 0.45], agua: 0.72, tubo: 0.38 }
  };
  // En la vista de cerca, las fases que se quieren ver van a tiempo real (ui.js lo consulta).
  var TIEMPO_REAL = {
    sondas: ['CALENTAMIENTO', 'MEDICIÓN'],
    gabinete: ['CALENTAMIENTO', 'MEDICIÓN', 'EMPAQUETADO']
    // comunicación no se frena: a la velocidad elegida cada envío se dibuja completo (2.3 s, ver ENV) y
    // vuelve a pasar a los pocos segundos; frenarlo dejaba largos ratos sin paquete en el aire
  };
  function irA(nombre) {
    if (G.vista === nombre && !G.trans) return;
    G.trans = { de: { obj: G.objetivo.toArray(), yaw: G.orbita.yaw, pitch: G.orbita.pitch, dist: G.orbita.dist,
      agua: G.matCaraAgua.opacity, tubo: G.tuboSondas.material.opacity }, a: VISTAS[nombre], t0: performance.now() };
    G.vista = nombre;
    G.volver.hidden = nombre === 'general';
    G.lienzo.classList.remove('apunta');
    G.sucio = true;
  }
  function avanzaTransicion() {
    var tr = G.trans, k = M.acota((performance.now() - tr.t0) / 800, 0, 1), e = k * k * (3 - 2 * k), de = tr.de, a = tr.a;
    function mezcla(u, v) { return u + (v - u) * e; }
    G.objetivo.set(mezcla(de.obj[0], a.obj[0]), mezcla(de.obj[1], a.obj[1]), mezcla(de.obj[2], a.obj[2]));
    G.orbita.yaw = mezcla(de.yaw, a.yaw); G.orbita.pitch = mezcla(de.pitch, a.pitch);
    G.orbita.dist = Math.exp(mezcla(Math.log(de.dist), Math.log(a.dist)));   // acercamiento parejo
    G.matCaraAgua.opacity = mezcla(de.agua, a.agua);
    G.tuboSondas.material.opacity = mezcla(de.tubo, a.tubo);
    G.sucio = true;
    if (k >= 1) G.trans = null;
  }

  // ------------------------------------------------------------ luz
  // Para la demostración la figura está siempre en un día soleado a media mañana (≈ 10:30), sea
  // cual sea la hora simulada: así se leen todos los mecanismos. Los datos no cambian: el rótulo del
  // panel sigue diciendo lo que genera según la hora del modelo de energía.
  // El sol entra por delante y a la derecha, alto y blanco; el cielo rellena las sombras.
  function luzSoleada() {
    var a = 4 / 11 * Math.PI, sol = G.sol;   // 10:30 en la ventana de 6:30 a 17:30 del modelo
    sol.position.set(G.solMira.x + 15 * Math.cos(a), G.solMira.y + 0.6 + 15 * Math.sin(a), G.solMira.z + 9);
    sol.intensity = 1.6;
    sol.color.setHex(0xfff4e4);
    G.cieloLuz.color.setHex(0xffffff);
    G.cieloLuz.groundColor.setHex(0xb9b39a);
    G.cieloLuz.intensity = 0.42;
    G.relleno.intensity = 0.16;
    G.render.shadowMap.needsUpdate = true;    // una sola vez: el sol no se mueve
  }

  // ------------------------------------------------------------ envío
  // El envío dura 4 s simulados: a 300× serían 13 ms y no se vería. Cada vez que el firmware recibe
  // un ACK (sube stats.posts) se dibuja, en tiempo real, la historia completa: el paquete sube a la
  // torre (1 s), la torre se enciende, la confirmación regresa a la antena y solo entonces los
  // paquetes desaparecen de la SD, como hace el firmware. El reloj de la simulación no se detiene.
  // Si el envío real ya se vio (velocidad baja), se omite la subida y queda la confirmación.
  var ENV = { llega: 1000, sale: 1250, ack: 1850, fin: 2300 };   // ms desde que sale el paquete
  function envio(s, nom) {
    var ahora = performance.now(), st = s.fw.stats;
    if (G.envEst !== s) { G.envEst = s; G.posts = st.posts; G.enviados = st.enviados; G.anim = null; G.vistoMs = 0; }
    G.vistoMs = nom === 'ENVÍO' ? (G.vistoMs || 0) + (ahora - (G.tEnv || ahora)) : 0;
    G.tEnv = ahora;
    if (st.posts > G.posts) {
      var lote = st.enviados - G.enviados;
      if (!G.anim) G.anim = { t0: ahora - (G.vistoPrevio > 800 ? ENV.llega : 0), nAntes: s.fw.cola.length + lote };
      G.posts = st.posts; G.enviados = st.enviados;
    }
    G.vistoPrevio = G.vistoMs || G.vistoPrevio;
    if (nom !== 'ENVÍO' && !G.anim) G.vistoPrevio = 0;
    if (!G.anim) return null;
    var k = ahora - G.anim.t0;
    if (k >= ENV.fin) { G.anim = null; return null; }
    return { k: k, nAntes: G.anim.nAntes };
  }

  // ------------------------------------------------------------ pintar
  // Se llama en cada cuadro de la animación: solo cambia propiedades, no crea objetos.
  function pinta(s, ext) {
    if (!ok) return;
    if (G.lienzo.clientWidth && Math.abs(G.lienzo.clientWidth / G.lienzo.clientHeight - G.camara.aspect) > 0.01) ajusta();
    var fw = s.fw, f = fw.fase, nom = f.nombre, p = f.dur > 0 ? 1 - f.resta / f.dur : 1;

    G.matAgua.color.copy(colorAgua(s.agua.valor('TURB', fw.t))); G.matCaraAgua.color.copy(G.matAgua.color);
    // corriente: la textura avanza aguas abajo (una baldosa mide 3.84 m a lo largo del cauce); con la
    // simulación en pausa, el agua sigue corriendo. A escala real, 0.6 m/s casi no se percibe desde la
    // distancia de la cámara: se dibuja 4 veces más rápido. El rótulo da la velocidad del modelo, sin
    // exagerar, y la proporción entre corriente normal y crecida se conserva.
    var ahora = performance.now(), dtr = Math.min(0.1, (ahora - (G.tAgua || ahora)) / 1000), vel = s.agua.velocidad(fw.t);
    G.tAgua = ahora;
    G.ondas.forEach(function (t) { t.offset.y = (t.offset.y + EXAGERA_CORRIENTE * vel * dtr / 3.84) % 1; });
    rotulo('rio', vel.toFixed(2) + ' m/s, simulada');

    var midiendo = nom === 'CALENTAMIENTO' || nom === 'MEDICIÓN';
    M.PARAMS.forEach(function (q) {
      var fa = s.sondas[q].falla !== 'ninguna';
      G.puntas[q].material.color.setHex(fa ? ALARMA : (midiendo ? TINTA : AGUA));
    });
    G.matCable.color.setHex(midiendo ? TINTA : 0x55626c);
    var fallas = M.PARAMS.filter(function (q) { return s.sondas[q].falla !== 'ninguna'; }).length;
    rotulo('sondas', midiendo ? (nom === 'MEDICIÓN' ? 'Midiendo' : 'Estabilizando') :
      (fallas ? fallas + (fallas === 1 ? ' con falla' : ' con falla') : 'Esperando la próxima medición'), fallas);

    var n = fw.cola.length, env = envio(s, nom), nSD = env && env.k < ENV.ack ? Math.max(n, env.nAntes) : n;
    G.cola.forEach(function (c, i) { c.visible = i < nSD; });
    var estadoCtrl = env ? (env.k < ENV.ack ? 'Enviando los datos' : 'Datos recibidos') : (ESTADO[nom] || nom);
    rotulo('ctrl', estadoCtrl + (nSD ? ' · ' + nSD + ' en la SD' : ''), !env && nSD > 1);

    var caido = s.enlace.caido;
    G.matAntena.color.setHex(caido ? ALARMA : TINTA);

    var soc = s.energia.soc(), sol = s.energia.solarW;
    G.carga.scale.x = Math.max(soc, 0.02); G.carga.position.x = (-4.2 - BASE[0]) - 0.3 * (1 - G.carga.scale.x);   // coordenada local del grupo
    G.carga.material.color.setHex(soc < 0.2 ? ALARMA : AGUA);
    G.matPanel.emissive.setRGB(0.05 * M.acota(sol / 2.5, 0, 1), 0.18 * M.acota(sol / 2.5, 0, 1), 0.3 * M.acota(sol / 2.5, 0, 1));
    rotulo('panel', (sol > 0.05 ? sol.toFixed(1) + ' W' : 'Sin sol') + ' · ' + Math.round(soc * 100) + ' %', soc < 0.2);
    var torre = caido ? 'Sin red' : env ? (env.k < ENV.llega ? 'Enviando los datos' : 'Datos recibidos') : (nom === 'ENVÍO' ? 'Enviando los datos' : 'Señal ' + Math.round(s.enlace.rssi) + ' dBm');
    rotulo('torre', torre, caido);

    // antena: azul tenue al buscar red, intensa al enviar; roja y apagada si no hay cobertura
    var brillo = caido ? 0 : (env && env.k < ENV.llega) || nom === 'ENVÍO' ? 1.6 : nom === 'ENLACE' ? 0.6 : 0;
    G.matPunta.color.setHex(caido ? ALARMA : brillo ? AGUA : TINTA);
    G.matPunta.emissive.setHex(AGUA); G.matPunta.emissiveIntensity = brillo;
    // antenas de la torre: se encienden al recibir y se apagan solas
    var recibe = env && env.k >= ENV.llega ? Math.max(0, 1 - (env.k - ENV.llega) / (ENV.fin - ENV.llega)) : 0;
    G.matTorreAnt.emissive.setHex(AGUA); G.matTorreAnt.emissiveIntensity = 1.8 * recibe;

    // el paquete: por el cable al medir; por el aire al enviar, con su confirmación de regreso
    G.paquete.visible = false; G.trazoAire.visible = false; G.ack.visible = false;
    if (env) {
      G.trazoAire.visible = env.k < ENV.ack;
      if (env.k < ENV.llega) { G.paquete.position.copy(G.rutaAire.getPoint(suave(env.k / ENV.llega))); G.paquete.visible = true; }
      else if (env.k >= ENV.sale && env.k < ENV.ack) {
        G.ack.position.copy(G.rutaAire.getPoint(1 - suave((env.k - ENV.sale) / (ENV.ack - ENV.sale)))); G.ack.visible = true;
      }
    } else if (nom === 'MEDICIÓN') {
      G.paquete.position.copy(G.rutaCable.getPoint((p * 3) % 1)); G.paquete.visible = true;
    } else if (nom === 'ENVÍO') {                // a velocidad baja el envío real ya dura lo suficiente
      G.paquete.position.copy(G.rutaAire.getPoint(p)); G.paquete.visible = true; G.trazoAire.visible = true;
    }
    G.paquete.material.color.setHex(ext && ext.alarma ? ALARMA : TINTA);
    if (G.vista !== 'general') pintaDetalle({ s: s, nom: nom, f: f, transcurrido: f.dur - f.resta, env: env, nSD: nSD });

    if (G.trans) avanzaTransicion();
    if (G.sucio) { colocaCamara(); G.relleno.position.copy(G.camara.position); }
    G.render.render(G.escena, G.camara);
    if (G.sucio) { colocaRotulos(); G.sucio = false; }
  }

  window.Escena = {
    construye: construye, pinta: pinta,
    vista: function () { return ok ? G.vista : 'general'; },
    tiempoReal: function (fase) { return ok && (TIEMPO_REAL[G.vista] || []).indexOf(fase) >= 0; }
  };
})();

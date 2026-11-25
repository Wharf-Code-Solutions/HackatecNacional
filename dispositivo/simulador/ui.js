/* Interfaz del simulador. Entrega órdenes y reparte el dibujo: la lógica del
 * dispositivo vive en modelo.js y firmware.js, la figura en escena.js y lo que
 * recibe la plataforma en recepcion.js.
 *
 * En pantalla solo hay tres cosas: la estación en 3D, lo que llega a la
 * plataforma y, si la plataforma abre una alerta, una línea en rojo. Nada más.
 *
 * Corre las 5 estaciones reubicadas junto a escuelas (contrato/fixtures/mecanismos.json, cada una con su
 * colector de residuos) con el mismo reloj; si ese archivo no existe, las 5 del Atoyac (estaciones.json). Los datos de entrada se
 * leen de contrato/fixtures/, así que se sirve el repo desde su raíz:
 *     python -m http.server 8000   →   /dispositivo/simulador/
 *
 * Parámetros de URL, para que otro módulo lo muestre sin importar su código:
 *     ?estacion=EST-ESC-01  ?incrustado=1  ?vel=300
 *     ?backend=http://127.0.0.1:8080 (por defecto en localhost; desplegado, '/api' del mismo dominio);
 *     ?backend= lo desactiva.
 * Si el backend no responde, el simulador sigue igual y no muestra alertas.
 */
(function () {
  'use strict';
  var M = window.Modelo, Mont = window.Montaje;
  var NOMBRE = { OD: 'Oxígeno disuelto', PH: 'pH', COND: 'Conductividad', TEMP: 'Temperatura', TURB: 'Turbiedad',
    LLUVIA: 'Lluvia', HUM_SUELO: 'Humedad del suelo', INCL: 'Inclinación' };
  var VELOCIDADES = [1, 15, 60, 300, 900, 3600];

  var Q = new URLSearchParams(location.search);
  // En tu computadora, el mock o el backend en el 8080. Desplegado (Vercel), el backend del mismo
  // dominio en /api: así el simulador alimenta al mismo panel que la app ciudadana.
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  var BACKEND = Q.has('backend') ? Q.get('backend') : (LOCAL ? 'http://127.0.0.1:8080' : location.origin + '/api');
  var estado = { est: [], por: {}, sel: null, vel: 300, pausa: false, pendientes: {} };
  var $ = function (id) { return document.getElementById(id); };

  // ----------------------------------------------------------------------- reloj
  // Con plataforma, el reloj simulado arranca en la hora real: los reportes ciudadanos llevan la hora
  // real y la plataforma solo los cruza con una alerta cercana en el tiempo. Si la plataforma ya tiene
  // lecturas más adelante (una corrida acelerada anterior), sigue después de la última: recargar la
  // página continúa la historia en lugar de mandar lecturas al pasado. Sin plataforma (?backend=),
  // la corrida determinista de siempre, desde Modelo.T0_DEFECTO.
  var CUARTO = 900;
  function relojInicial() {
    if (!BACKEND) return Promise.resolve(null);
    var ahora = Math.floor(Date.now() / 1000 / CUARTO) * CUARTO;
    return fetch(BACKEND.replace(/\/$/, '') + '/veredictos', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var ult = 0;
        (d.veredictos || []).forEach(function (v) { ult = Math.max(ult, Date.parse(v.fecha_hora) / 1000 || 0); });
        return ult ? Math.max(ahora, Math.ceil(ult / CUARTO) * CUARTO + CUARTO) : ahora;
      })
      .catch(function () { return ahora; });
  }

  // ----------------------------------------------------------------------- carga
  Promise.all([
    fetch('../../contrato/fixtures/mecanismos.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return fetch('../../contrato/fixtures/estaciones.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }); }),
    fetch('../../contrato/fixtures/linea_base.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
    // umbrales de ladera (hipótesis, docs/20): la línea de referencia de humedad e inclinación en la recepción
    fetch('../../contrato/fixtures/umbrales_lluvia.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return null; }),
    // el suelo de cada ladera (scripts/103_suelo_laderas.py): humedad de base, saturación y umbral calibrado
    fetch('../../contrato/fixtures/suelo_laderas.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return null; })
  ]).then(function (d) {
    var suelos = {};
    ((d[3] && d[3].laderas) || []).forEach(function (x) { suelos[x.c_estacion] = x; });
    // Abrir la simulación la empieza limpia: la plataforma cierra las alertas pendientes de estas estaciones y su motor
    // olvida lo anterior; después el reloj arranca donde corresponde.
    var todas = d[0].estaciones, pedida = todas.filter(function (e) { return e.c_estacion === Q.get('estacion'); })[0] || todas[0];
    var ids = todas.filter(function (e) { return tipoDe(e) === tipoDe(pedida); }).map(function (e) { return e.c_estacion; });
    return reiniciar(ids).then(relojInicial).then(function (t0) { arranca(todas, d[1], t0, d[2], suelos); });
  }).catch(function (e) {
    var a = $('aviso'); a.hidden = false;
    a.innerHTML = 'No se pudieron leer los fixtures del contrato (' + e.message + '). Sirve el repositorio desde su raíz con ' +
      '<code>python -m http.server 8000</code>.';
  });

  // La página simula a la vez las estaciones del mismo tipo que la elegida: las de agua (figura del río, con
  // su colector) o las de ladera (figura del cerro, docs/20). Elegir una del otro tipo recarga la página.
  function tipoDe(e) { return Mont.esLadera(e) ? 'ladera' : 'rio'; }
  function reiniciar(ids) {
    if (!BACKEND) return Promise.resolve();
    return Promise.all(ids.map(function (id) {
      return fetch(BACKEND.replace(/\/$/, '') + '/estaciones/' + id + '/reiniciar', { method: 'POST' }).catch(function () {});
    }));
  }
  function arranca(todas, linea, t0, umbrales, suelos) {
    var pedida = todas.filter(function (e) { return e.c_estacion === Q.get('estacion'); })[0] || todas[0];
    estado.tipo = tipoDe(pedida);
    var estaciones = todas.filter(function (e) { return tipoDe(e) === estado.tipo; });
    estado.est = estaciones; estado.sel = pedida.c_estacion;
    estaciones.forEach(function (e) {
      var id = e.c_estacion;
      estado.pendientes[id] = [];
      estado.por[id] = Mont.crearEstacion(e, linea, { t0: t0 || undefined, suelos: suelos, alEvento: function (ev) { alEvento(id, ev); },
        alEventoCol: function (ev) { if (id === estado.sel) Escena.objeto(ev); } });
      // en pantalla la basura no se acumula: el contenedor se vacía tras cada pesaje y la banda no se atasca
      if (estado.por[id].col) { estado.por[id].col.vaciaCadaCiclo = true; estado.por[id].col.sinAtascos = true; estado.por[id].col.atascoP = 0; }
    });
    estado.ultimo = performance.now();
    pideAlarma(); setInterval(pideAlarma, 2000);

    var se = $('selEstacion');
    todas.forEach(function (e) {
      var o = document.createElement('option'); o.value = e.c_estacion; o.textContent = e.c_estacion + ' · ' + lugar(e); se.appendChild(o);
    });
    se.onchange = function () {
      if (!estado.por[se.value]) { Q.set('estacion', se.value); location.search = Q.toString(); return; }
      estado.sel = se.value; refresca(); pideAlarma();
    };
    var sv = $('selVel');
    VELOCIDADES.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v + '×'; sv.appendChild(o); });
    sv.onchange = function () { estado.vel = +sv.value; };
    $('btnPausa').onclick = function () { estado.pausa = !estado.pausa; this.textContent = estado.pausa ? 'Reanudar' : 'Pausar'; estado.ultimo = performance.now(); };
    // Pruebas: las del agua mueven el río; las de ladera (tormenta, lluvia prolongada, deslave) la ladera.
    Array.prototype.forEach.call(document.querySelectorAll('.ev'), function (b) {
      var deLadera = !!M.EVENTOS_LADERA[b.dataset.ev];
      b.hidden = deLadera !== (estado.tipo === 'ladera');
      b.dataset.texto = b.textContent;
      // El mismo botón inicia la prueba y la detiene; mientras corre queda en azul.
      b.onclick = function () {
        var s = actual(), sim = deLadera ? s.ladera : s.agua, t = s.fw.t;
        if (sim.enCurso(b.dataset.ev, t)) sim.detiene(b.dataset.ev, t); else {
          sim.agregaEvento(b.dataset.ev, t);
          // el deslave cede a las 13 h: a 300× son más de 2 minutos de espera; a 3600× son ≈ 13 s
          if (b.dataset.ev === 'deslave' && estado.vel < 3600) { estado.vel = 3600; $('selVel').value = '3600'; }
        }
        marcaPruebas(s);
      };
    });
    $('btnCorte').onclick = function () { var s = actual(); s.enlace.caido = !s.enlace.caido; refresca(); };

    if (Q.get('incrustado')) document.body.classList.add('incrustado');
    if (VELOCIDADES.indexOf(+Q.get('vel')) >= 0) estado.vel = +Q.get('vel');
    se.value = estado.sel; sv.value = String(estado.vel);

    Escena.construye(estado.tipo, actual().est);
    Recepcion.construye(actual().params, umbrales, actual().ladera && actual().ladera.umbral);
    refresca();
    requestAnimationFrame(bucle);
  }

  function marcaPruebas(s) {
    Array.prototype.forEach.call(document.querySelectorAll('.ev'), function (b) {
      if (b.hidden) return;
      var sim = M.EVENTOS_LADERA[b.dataset.ev] ? s.ladera : s.agua, on = sim.enCurso(b.dataset.ev, s.fw.t);
      b.classList.toggle('activo', on);
    });
  }
  function actual() { return estado.por[estado.sel]; }
  // La reubicada se nombra por la localidad de su escuela; la del Atoyac, por su río.
  function lugar(e) { return e.localidad || nombre(e.cuerpo_agua); }
  function nombre(t) {
    return (t || '').toLowerCase().replace(/(^|[\s(])([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/ (De|Del|La|Las|El|Los|Y) /g, function (m) { return m.toLowerCase(); });
  }
  function refresca() {
    var s = actual(), e = s.est;
    $('titulo').textContent = e.c_estacion + ' · ' + lugar(e);
    document.title = e.c_estacion + ' · simulador de la estación';
    $('btnCorte').textContent = s.enlace.caido ? 'Restablecer enlace' : 'Cortar enlace';
    $('btnCorte').classList.toggle('activo', s.enlace.caido);
  }

  // ------------------------------------------------------------------- backend
  // Cada envío confirmado llega a la línea de tiempo y, si hay backend, se manda por el contrato (POST /lecturas).
  // La alarma NO sale de esa respuesta ni de un reloj: es lo que la plataforma tiene pendiente para la estación
  // (alertas Abierta o En atención). Dura mientras dure la condición: la plataforma la cierra cuando se normaliza, o la
  // autoridad desde el panel, y por eso mapa, panel y simulador coinciden a cualquier velocidad.
  function alEvento(id, ev) {
    if (ev.tipo !== 'envio') return;
    Recepcion.registra(id, ev.datos, ev.t);
    if (!BACKEND) return;
    fetch(BACKEND.replace(/\/$/, '') + '/lecturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev.datos) })
      .then(function () { pideAlarma(); })
      .catch(function () {});
  }
  function pideAlarma() {
    var id = estado.sel;
    if (!BACKEND || !id) return;
    fetch(BACKEND.replace(/\/$/, '') + '/alertas?c_estacion=' + encodeURIComponent(id) + '&estado=pendientes', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // por si el servidor ignora el filtro: solo las de esta estación y pendientes
        estado.pendientes[id] = (d.alertas || []).filter(function (a) {
          return a.c_estacion === id && (a.estado === 'Abierta' || a.estado === 'En atencion');
        });
      })
      .catch(function () {});
  }
  var NIVEL = { Informativa: 1, Preventiva: 2, Critica: 3 };
  // La alerta pendiente de mayor nivel (la más reciente si empatan).
  function alarmaPendiente() {
    var mejor = null;
    (estado.pendientes[estado.sel] || []).forEach(function (a) {
      var n = NIVEL[a.nivel] || 0;
      if (!mejor || n > (NIVEL[mejor.nivel] || 0) || (n === (NIVEL[mejor.nivel] || 0) && Date.parse(a.fecha_hora) >= Date.parse(mejor.fecha_hora))) mejor = a;
    });
    return mejor;
  }

  // --------------------------------------------------------------------- bucle
  function dibuja(s) {
    $('relojFecha').textContent = M.iso(s.fw.t).substr(0, 10);
    $('relojHora').textContent = M.iso(s.fw.t).substr(11, 8);
    var al = estado.alarma = alarmaPendiente();
    Recepcion.pinta(s); marcaPruebas(s);
    var linea = $('alarmaLinea');
    linea.hidden = !al;
    if (al) linea.textContent = 'Alarma: ' + NOMBRE[al.c_parametro] + ', ' + al.fecha_hora.substr(11, 5) + '.';
  }
  var ultimoPintado = 0;
  function bucle(ahora) {
    var dt = (ahora - estado.ultimo) / 1000; estado.ultimo = ahora;
    if (!estado.pausa) {
      // En una vista de cerca, las fases que muestra esa vista van a tiempo real (Escena.tiempoReal):
      // se ve cada sonda estabilizarse, la SD guardar y el módem enviar; el resto, a la velocidad elegida.
      var v = estado.vel, fase = actual().fw.fase.nombre;
      if (Escena.tiempoReal(fase, actual().col ? actual().col.fase.nombre : null)) v = 1;
      dt = Math.min(dt, 0.25) * v;
      estado.est.forEach(function (e) { var s = estado.por[e.c_estacion]; s.fw.tick(dt); if (s.col) s.col.tick(dt); });
    }
    // Textos y gráficas 20 veces por segundo; la figura 3D en cada cuadro, para que girar y el
    // viaje del paquete se vean fluidos.
    if (ahora - ultimoPintado > 50) { ultimoPintado = ahora; dibuja(actual()); }
    Escena.pinta(actual(), { alarma: estado.alarma });
    requestAnimationFrame(bucle);
  }
})();

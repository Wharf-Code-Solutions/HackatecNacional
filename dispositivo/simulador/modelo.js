/* Modelo físico de la estación: el agua, las sondas, la energía y el enlace.
 *
 * Todo lo que NO es firmware vive aquí. El firmware (firmware.js) solo ve las
 * sondas, la batería y el enlace a través de las interfaces de estas clases,
 * igual que el ESP32 real los vería a través de sus pines y su módem.
 *
 * Sin dependencias. Corre en el navegador y en Node (ver prueba.js).
 * Determinista: misma semilla, misma corrida (mismo espíritu que la invariante I8).
 */
(function (raiz) {
  'use strict';

  var ZONA_S = -6 * 3600;                 // Puebla y Tlaxcala: UTC-06:00 todo el año
  var T0_DEFECTO = Date.UTC(2026, 10, 23, 6, 0, 0) / 1000;   // 2026-11-23T00:00-06:00

  // ---------------------------------------------------------------- utilidades
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function horaLocal(t) {                 // horas decimales 0-24
    var s = (t + ZONA_S) % 86400;
    return (s < 0 ? s + 86400 : s) / 3600;
  }
  function iso(t) {                       // ISO 8601 con zona, como exige el contrato
    var d = new Date((Math.floor(t) + ZONA_S) * 1000);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
      'T' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + '-06:00';
  }
  function acota(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // ------------------------------------------------------------------- el agua
  // Verdad de campo. Los valores normales salen de la banda histórica REAL del
  // sitio (linea_base.json), de modo que el ruido de fondo es el del Atoyac.
  var EVENTOS = {
    descarga_industrial: { nombre: 'Descarga industrial', dur: 3 * 3600 },
    descarga_organica:   { nombre: 'Descarga orgánica',   dur: 6 * 3600 },
    lluvia:              { nombre: 'Lluvia',              dur: 5 * 3600 }
  };
  var RAMPA = 1800;                       // 30 min para entrar y para salir

  function Agua(lineaSitio, semilla) {
    // lineaSitio: { COND:{media,p10,p90,minimo,maximo}, OD:{...}, ... }
    this.linea = lineaSitio;
    this.eventos = [];
    var r = mulberry32(semilla || 1);
    this.fase = {};
    ['COND', 'OD', 'PH', 'TEMP', 'TURB'].forEach(function (p) {
      this.fase[p] = [r() * 6.28, r() * 6.28, r() * 6.28];
    }, this);
  }
  Agua.prototype.agregaEvento = function (tipo, t0) {
    this.eventos.push({ tipo: tipo, t0: t0, dur: EVENTOS[tipo].dur });
  };
  // Detiene la prueba `tipo` en t: la descarga o la lluvia sale con la misma rampa de 30 min, sin corte.
  Agua.prototype.detiene = function (tipo, t) {
    this.eventos.forEach(function (ev) {
      if (ev.tipo === tipo && t >= ev.t0 && t < ev.t0 + ev.dur) ev.dur = Math.min(ev.dur, (t - ev.t0) + RAMPA);
    });
  };
  Agua.prototype.enCurso = function (tipo, t) {
    return this.eventos.some(function (ev) { return ev.tipo === tipo && t >= ev.t0 && t < ev.t0 + ev.dur; });
  };
  Agua.prototype._env = function (ev, t) {
    var x = t - ev.t0;
    if (x <= 0 || x >= ev.dur) return 0;
    return Math.min(1, x / RAMPA, (ev.dur - x) / RAMPA);
  };
  Agua.prototype.base = function (p, t) {
    var L = this.linea[p];
    var sigma = Math.max((L.p90 - L.p10) / 2.563, 1e-6);
    var f = this.fase[p];
    // ruido lento y determinista: tres sinusoides, amplitud acotada a ~0.45 sigma
    var ruido = sigma * 0.45 * (0.6 * Math.sin(2 * Math.PI * t / 10800 + f[0]) +
      0.3 * Math.sin(2 * Math.PI * t / 4700 + f[1]) + 0.1 * Math.sin(2 * Math.PI * t / 1900 + f[2]));
    var v = L.media + ruido;
    if (p === 'TEMP') v = L.media + 2.2 * Math.sin(2 * Math.PI * (horaLocal(t) - 9) / 24) + ruido * 0.3;
    return v;
  };
  // `sin`: tipos de evento que se ignoran (el dibujo del río separa lo que viene de la descarga, que va río abajo).
  Agua.prototype.valor = function (p, t, sin) {
    var v = this.base(p, t), i, e, ev;
    for (i = 0; i < this.eventos.length; i++) {
      ev = this.eventos[i];
      if (sin && sin.indexOf(ev.tipo) >= 0) continue;
      e = this._env(ev, t);
      if (!e) continue;
      var wob = 1 + 0.04 * Math.sin(t / 97);
      if (ev.tipo === 'descarga_industrial') {
        if (p === 'COND') v = v + (14700 * wob - v) * e;
        else if (p === 'PH') v = v + (9.5 - v) * e;
        else if (p === 'OD') v = v * (1 - 0.45 * e);
        else if (p === 'TURB') v = v * (1 + 1.0 * e);
        else if (p === 'TEMP') v = v + 2 * e;
      } else if (ev.tipo === 'descarga_organica') {
        if (p === 'OD') v = v * (1 - 0.6 * e);
        else if (p === 'TURB') v = v * (1 + 2.0 * e);
        else if (p === 'COND') v = v * (1 + 0.8 * e);
        else if (p === 'PH') v = v - 0.9 * e;
      } else if (ev.tipo === 'lluvia') {
        if (p === 'TURB') v = v + (8000 * wob - v) * e;
        else if (p === 'COND') v = v * (1 - 0.45 * e);
        else if (p === 'TEMP') v = v - 1.5 * e;
      }
    }
    if (p === 'OD') v = Math.max(v, 0.2);
    if (p === 'TURB' || p === 'COND') v = Math.max(v, 1);
    return v;
  };
  // Velocidad de la corriente, SIMULADA: en la cuenca no hay velocidad medida (docs/14-propagacion.md).
  // Base 0.6 m/s, el centro del intervalo 0.3-1.0 que declara M3, con una variación lenta de ±10 %.
  // Con lluvia el caudal llega a 4 veces el base y la velocidad crece como Q^0.4 (geometría
  // hidráulica de Leopold y Maddock): ≈ 1.0 m/s en la punta de la crecida.
  var VEL_BASE = 0.6;
  Agua.prototype.velocidad = function (t) {
    var q = 1;
    for (var i = 0; i < this.eventos.length; i++) {
      if (this.eventos[i].tipo === 'lluvia') q += 3 * this._env(this.eventos[i], t);
    }
    return VEL_BASE * (1 + 0.1 * Math.sin(2 * Math.PI * t / 10800 + this.fase.TURB[1])) * Math.pow(q, 0.4);
  };
  // Intensidad de la lluvia en t: 0 sin lluvia, 1 en la meseta de un evento (suma si se traslapan).
  // La usa el colector de residuos (llega más basura y el río sube) y la velocidad de arriba.
  Agua.prototype.lluvia = function (t) {
    var k = 0;
    for (var i = 0; i < this.eventos.length; i++) {
      if (this.eventos[i].tipo === 'lluvia') k += this._env(this.eventos[i], t);
    }
    return k;
  };
  Agua.prototype.eventoActivo = function (t) {
    for (var i = 0; i < this.eventos.length; i++) {
      var ev = this.eventos[i];
      if (t >= ev.t0 && t < ev.t0 + ev.dur) return ev.tipo;
    }
    return null;
  };

  // ------------------------------------------------------------------ la ladera
  // Verdad de campo del módulo de ladera (docs/20 §4): la lluvia sobre la ladera, la humedad del suelo a
  // ~50 cm y el movimiento de la estaca del inclinómetro. TODO es supuesto de diseño, igual que en
  // scripts/102_escenarios_ladera.py, del que se copian los parámetros de la humedad para que el simulador
  // y los escenarios del contrato cuenten la misma física: base 31 %, satura en 50 %, se llena 0.009 del
  // hueco por mm y drena 0.0025 del exceso cada 15 min (cubeta simple). No predice deslaves.
  var LADERA = { humBase: 31, humSatura: 50, ganancia: 0.009, drenaje15: 0.0025,
                 reptarDesde: 47, reptarLluvia: 5, reptarGradosH: 0.02 };   // reptar: con suelo saturado y lluvia sostenida
  // Eventos de prueba, con las mismas lluvias que los escenarios del contrato. `lluvias`: [inicio h, duración h, mm];
  // cada lluvia es un hietograma triangular. `salto`: [hora, grados] del inclinómetro, tras 2.5 h de reptar.
  var EVENTOS_LADERA = {
    tormenta:          { nombre: 'Tormenta', lluvias: [[0, 4, 120]] },
    // cuatro días de 65, 85, 95 y 65 mm, cada uno en dos lluvias (65 % y 35 %), como en el escenario del contrato
    lluvia_prolongada: { nombre: 'Lluvia prolongada', lluvias: [65, 85, 95, 65].reduce(function (a, mm, d) {
      return a.concat([[d * 24, 7, 0.65 * mm], [d * 24 + 8.5, 5, 0.35 * mm]]); }, []) },
    deslave:           { nombre: 'Deslave', lluvias: [[0, 8, 70], [10, 9, 80]], salto: [13, 3.8] }
  };
  // suelo: la entrada de su ladera en suelo_laderas.json (scripts/103_suelo_laderas.py). Con ella la humedad drena
  // hasta la capacidad de campo de ese suelo y satura en su porosidad; arranca en capacidad de campo, como en temporada
  // de lluvias (la misma condición de `lluvia_prolongada` y `deslave`). Sin ella, los valores genéricos de LADERA.
  function Ladera(semilla, suelo) {
    this.humBase = suelo ? suelo.capacidad_campo_pct : LADERA.humBase;
    this.humSatura = suelo ? suelo.saturacion_pct : LADERA.humSatura;
    this.umbral = suelo ? suelo.umbral_cerca_saturacion_pct : null;
    this.eventos = [];
    this.t = null;                         // hasta dónde va integrada la humedad
    this.hum = this.humBase;   // arranca en capacidad de campo: temporada de lluvias (may-sep), cuando hay deslaves
    this.incl = 0;                         // cambio de inclinación desde la instalación, grados
    this.acum = 0;                         // lluvia caída desde el inicio, mm (el pluviómetro cuenta de aquí)
    this.r = mulberry32(semilla || 3);
  }
  Ladera.prototype.agregaEvento = function (tipo, t0) {
    var e = EVENTOS_LADERA[tipo], fin = 0;
    e.lluvias.forEach(function (l) { fin = Math.max(fin, l[0] + l[1]); });
    this.eventos.push({ tipo: tipo, t0: t0, def: e, fin: t0 + fin * 3600 });
  };
  // Detiene la prueba `tipo`: la lluvia cesa en seco; la humedad y la inclinación ya acumuladas se quedan.
  Ladera.prototype.detiene = function (tipo, t) {
    this.eventos = this.eventos.filter(function (ev) { return !(ev.tipo === tipo && t >= ev.t0 && t < ev.fin); });
  };
  Ladera.prototype.enCurso = function (tipo, t) {
    return this.eventos.some(function (ev) { return ev.tipo === tipo && t >= ev.t0 && t < ev.fin; });
  };
  // Intensidad de la lluvia en t, mm/h: hietogramas triangulares que suman sus mm.
  Ladera.prototype.intensidad = function (t) {
    var mmh = 0;
    this.eventos.forEach(function (ev) {
      ev.def.lluvias.forEach(function (l) {
        var a = ev.t0 + l[0] * 3600, d = l[1] * 3600, x = (t - a) / d;
        if (x > 0 && x < 1) mmh += 2 * l[2] / l[1] * (1 - Math.abs(2 * x - 1));   // área del triángulo = l[2] mm
      });
    });
    return mmh;
  };
  Ladera.prototype.eventoActivo = function (t) {
    for (var i = 0; i < this.eventos.length; i++) if (t >= this.eventos[i].t0 && t < this.eventos[i].fin) return this.eventos[i].tipo;
    return null;
  };
  // Integra la ladera hasta t en pasos de 60 s: la humedad depende de toda la lluvia anterior.
  Ladera.prototype.avanza = function (t) {
    if (this.t === null) this.t = t;
    while (this.t < t - 1e-9) {
      var dt = Math.min(60, t - this.t), mmh = this.intensidad(this.t + dt / 2), mm = mmh * dt / 3600;
      this.acum += mm;
      this.hum += LADERA.ganancia * mm * (this.humSatura - this.hum) - LADERA.drenaje15 * dt / 900 * Math.max(0, this.hum - this.humBase);   // solo drena lo que pasa de la capacidad de campo
      this.hum = Math.min(this.hum, this.humSatura);
      if (this.hum >= (this.umbral || LADERA.reptarDesde) && mmh >= LADERA.reptarLluvia) this.incl += LADERA.reptarGradosH * dt / 3600;
      this.t += dt;
      var self = this;
      this.eventos.forEach(function (ev) {        // el deslave: reptar 0.1° → 0.6° en 2.5 h y luego el salto
        var s = ev.def.salto; if (!s) return;
        var ts = ev.t0 + s[0] * 3600, k = (self.t - (ts - 9000)) / 9000;
        if (k > 0 && k < 1) self.incl = Math.max(self.incl, 0.1 + 0.5 * k);
        if (self.t >= ts && !ev.salto) { ev.salto = true; self.incl += s[1] - 0.6; }
      });
    }
  };
  Ladera.prototype.valor = function (p, t) {
    if (t > (this.t === null ? -Infinity : this.t)) this.avanza(t);
    if (p === 'HUM_SUELO') return this.hum;
    if (p === 'INCL') return this.incl;
    return null;
  };
  Ladera.prototype.lluviaAcumulada = function (t) { this.avanza(t); return this.acum; };

  // Pluviómetro de balancín: cuenta basculadas de 0.2 mm por interrupción, aun dormido (sin gastar), y
  // reporta lo caído desde el paquete anterior (docs/20 §2). Se lee una vez por paquete.
  function Pluviometro(ladera, t0) {
    this.ladera = ladera; this.cod = 'LLUVIA'; this.espec = ESPEC.LLUVIA;
    this.falla = 'ninguna';
    this.cuenta = Math.floor(ladera.lluviaAcumulada(t0) / 0.2);
  }
  Pluviometro.prototype.leer = function (t) {
    if (this.falla === 'sin_respuesta') return null;
    if (this.falla === 'menos999') return -999;
    var n = Math.floor(this.ladera.lluviaAcumulada(t) / 0.2 + 1e-9), mm = (n - this.cuenta) * 0.2;
    this.cuenta = n;
    return Math.round(mm * 10) / 10;
  };
  Pluviometro.prototype.saturada = function () { return false; };

  // ------------------------------------------------------------------ las sondas
  // Especificación de diseño de la variante "de campo". Son supuestos de
  // diseño razonables, NO datos de un fabricante: la ficha técnica los declara
  // como tales y pide verificarlos contra la hoja de datos al cotizar.
  var ESPEC = {
    OD:   { unidad: 'mg/L',  rango: [0, 20],       res: 0.01, ruidoAbs: 0.04, ruidoRel: 0,     sesgoAbs: 0.08, sesgoRel: 0,     derivaAbs: 0.010, derivaRel: 0,      ensuciaAbs: 0,   estabS: 15, mW: 200 },
    PH:   { unidad: 'pH',    rango: [0, 14],       res: 0.01, ruidoAbs: 0.02, ruidoRel: 0,     sesgoAbs: 0.05, sesgoRel: 0,     derivaAbs: 0.010, derivaRel: 0,      ensuciaAbs: 0,   estabS: 10, mW: 150 },
    COND: { unidad: 'µS/cm', rango: [5, 200000],   res: 1,    ruidoAbs: 0,    ruidoRel: 0.005, sesgoAbs: 0,    sesgoRel: 0.015, derivaAbs: 0,     derivaRel: 0.0005, ensuciaAbs: 0,   estabS: 6,  mW: 120 },
    TEMP: { unidad: '°C',    rango: [-5, 50],      res: 0.01, ruidoAbs: 0.05, ruidoRel: 0,     sesgoAbs: 0.15, sesgoRel: 0,     derivaAbs: 0,     derivaRel: 0,      ensuciaAbs: 0,   estabS: 3,  mW: 60 },
    TURB: { unidad: 'NTU',   rango: [0, 4000],     res: 0.1,  ruidoAbs: 1,    ruidoRel: 0.02,  sesgoAbs: 40,   sesgoRel: 0,     derivaAbs: 0,     derivaRel: 0,      ensuciaAbs: 1.5, estabS: 5,  mW: 250 },    // Rika RK500-07, rango 0-4000: ±1 % del fondo de escala = ±40 NTU; < 0.2 W a 7-28 V, más el elevador (catalogo-componentes.md)
    // Módulo de ladera (docs/20 §2). Supuestos de diseño, como las sondas: humedad capacitiva enterrada a
    // ~50 cm; inclinómetro de dos ejes con ruido de ±0.05°; pluviómetro de balancín de 0.2 mm, sin consumo
    // entre mediciones (cuenta por interrupción).
    HUM_SUELO: { unidad: '%', rango: [0, 64],      res: 0.1,  ruidoAbs: 0.15, ruidoRel: 0,     sesgoAbs: 1.0,  sesgoRel: 0,     derivaAbs: 0.005, derivaRel: 0,      ensuciaAbs: 0,   estabS: 2,  mW: 40 },
    INCL:      { unidad: '°', rango: [-15, 15],    res: 0.01, ruidoAbs: 0.03, ruidoRel: 0,     sesgoAbs: 0,    sesgoRel: 0,     derivaAbs: 0,     derivaRel: 0,      ensuciaAbs: 0,   estabS: 1,  mW: 15 },
    LLUVIA:    { unidad: 'mm', rango: [0, 200],    res: 0.2,  estabS: 0, mW: 0 }
  };
  var PARAMS = ['COND', 'OD', 'PH', 'TEMP', 'TURB'];

  // Energía por tipo de estación (catalogo-componentes.md, sección 3). Con la turbiedad Rika RK500-07 (< 0.2 W)
  // las dos llevan el diseño original: 2 celdas 18650 (22 Wh) y panel de 5 W. La Pyxis anterior (6 W a 24 V) pedía
  // 8 celdas y 10 W.
  var ENERGIA = {
    rio:    { capWh: 22.2, panelW: 5,  celdas: 2 },
    ladera: { capWh: 22.2, panelW: 5,  celdas: 2 }
  };
  var PARAMS_LADERA = ['LLUVIA', 'HUM_SUELO', 'INCL'];

  function Sonda(codigo, rng, t0) {
    this.cod = codigo;
    this.espec = ESPEC[codigo];
    this.rng = rng;
    var s = this.espec;
    // cada sonda sale de fábrica con un sesgo propio dentro de su tolerancia
    this.sesgoAbs = (rng() * 2 - 1) * s.sesgoAbs;
    this.sesgoRel = (rng() * 2 - 1) * s.sesgoRel;
    this.tCal = t0;                       // última calibración
    this.tLimpieza = t0;                  // última limpieza (turbiedad y OD)
    this.falla = 'ninguna';               // ninguna | congelado | sin_respuesta | menos999
    this.ultimo = null;
  }
  Sonda.prototype.dias = function (t, desde) { return Math.max(0, (t - desde) / 86400); };
  Sonda.prototype.leer = function (verdad, t) {
    var s = this.espec;
    if (this.falla === 'sin_respuesta') return null;
    if (this.falla === 'menos999') return -999;
    if (this.falla === 'congelado' && this.ultimo !== null) return this.ultimo;
    var d = this.dias(t, this.tCal);
    var v = verdad * (1 + this.sesgoRel + s.derivaRel * d) + this.sesgoAbs + s.derivaAbs * d;
    v += s.ensuciaAbs * this.dias(t, this.tLimpieza);
    v += gauss(this.rng) * (s.ruidoAbs + s.ruidoRel * Math.abs(verdad));
    v = acota(v, s.rango[0], s.rango[1]);
    v = Math.round(v / s.res) * s.res;
    this.ultimo = v;
    return v;
  };
  Sonda.prototype.saturada = function (v) {
    return v !== null && v >= this.espec.rango[1] - 1e-9;
  };
  Sonda.prototype.calibrar = function (t) { this.tCal = t; this.sesgoAbs = 0; this.sesgoRel = 0; };
  Sonda.prototype.limpiar = function (t) { this.tLimpieza = t; };

  // ------------------------------------------------------------------ la energía
  function Energia(opc) {
    opc = opc || {};
    this.capWh = opc.capWh || 22.2;       // 2 x 18650 de 3000 mAh a 3.7 V
    this.panelW = opc.panelW || 5;        // panel solar nominal
    this.eficiencia = 0.85;               // regulador de carga
    this.wh = this.capWh * (opc.soc0 === undefined ? 0.9 : opc.soc0);
    this.clima = 1;                       // 1 soleado, 0.25 nublado
    this.consumidoWh = 0;
    this.generadoWh = 0;
    this.solarW = 0;
  }
  Energia.prototype.irradiancia = function (t) {
    var h = horaLocal(t);
    if (h < 6.5 || h > 17.5) return 0;
    return Math.sin(Math.PI * (h - 6.5) / 11);
  };
  Energia.prototype.integra = function (dt, cargaMW, t) {
    this.solarW = this.panelW * this.irradiancia(t) * 0.5 * this.clima;  // 0.5: suciedad, ángulo, temperatura
    var gen = this.solarW * this.eficiencia * dt / 3600;
    var con = cargaMW / 1000 * dt / 3600;
    this.wh = acota(this.wh + gen - con, 0, this.capWh);
    this.generadoWh += gen;
    this.consumidoWh += con;
  };
  Energia.prototype.soc = function () { return this.wh / this.capWh; };

  // ------------------------------------------------------------------- el enlace
  function Enlace(rssi, rng) {
    this.rssi = rssi;                     // dBm medido en el sitio
    this.rng = rng;
    this.caido = false;                   // lo fuerza la interfaz: corte de red
  }
  Enlace.prototype.pOk = function () {
    if (this.caido) return 0;
    if (this.rssi > -95) return 0.97;
    if (this.rssi > -105) return 0.8;
    return 0.4;
  };
  Enlace.prototype.intenta = function () { return this.rng() < this.pOk(); };

  raiz.Modelo = {
    ZONA_S: ZONA_S, T0_DEFECTO: T0_DEFECTO, PARAMS: PARAMS, ESPEC: ESPEC, EVENTOS: EVENTOS,
    PARAMS_LADERA: PARAMS_LADERA, ENERGIA: ENERGIA, LADERA: LADERA, EVENTOS_LADERA: EVENTOS_LADERA, Ladera: Ladera, Pluviometro: Pluviometro,
    mulberry32: mulberry32, gauss: gauss, horaLocal: horaLocal, iso: iso, acota: acota,
    Agua: Agua, Sonda: Sonda, Energia: Energia, Enlace: Enlace
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Modelo;
})(typeof window !== 'undefined' ? window : globalThis);

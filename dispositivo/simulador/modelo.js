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
  Agua.prototype.valor = function (p, t) {
    var v = this.base(p, t), i, e, ev;
    for (i = 0; i < this.eventos.length; i++) {
      ev = this.eventos[i];
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
  Agua.prototype.eventoActivo = function (t) {
    for (var i = 0; i < this.eventos.length; i++) {
      var ev = this.eventos[i];
      if (t >= ev.t0 && t < ev.t0 + ev.dur) return ev.tipo;
    }
    return null;
  };

  // ------------------------------------------------------------------ las sondas
  // Especificación de diseño de la variante "de campo". Son supuestos de
  // diseño razonables, NO datos de un fabricante: la ficha técnica los declara
  // como tales y pide verificarlos contra la hoja de datos al cotizar.
  var ESPEC = {
    OD:   { unidad: 'mg/L',  rango: [0, 20],       res: 0.01, ruidoAbs: 0.04, ruidoRel: 0,     sesgoAbs: 0.08, sesgoRel: 0,     derivaAbs: 0.010, derivaRel: 0,      ensuciaAbs: 0,   estabS: 15, mW: 200 },
    PH:   { unidad: 'pH',    rango: [0, 14],       res: 0.01, ruidoAbs: 0.02, ruidoRel: 0,     sesgoAbs: 0.05, sesgoRel: 0,     derivaAbs: 0.010, derivaRel: 0,      ensuciaAbs: 0,   estabS: 10, mW: 150 },
    COND: { unidad: 'µS/cm', rango: [5, 200000],   res: 1,    ruidoAbs: 0,    ruidoRel: 0.005, sesgoAbs: 0,    sesgoRel: 0.015, derivaAbs: 0,     derivaRel: 0.0005, ensuciaAbs: 0,   estabS: 6,  mW: 120 },
    TEMP: { unidad: '°C',    rango: [-5, 50],      res: 0.01, ruidoAbs: 0.05, ruidoRel: 0,     sesgoAbs: 0.15, sesgoRel: 0,     derivaAbs: 0,     derivaRel: 0,      ensuciaAbs: 0,   estabS: 3,  mW: 60 },
    TURB: { unidad: 'NTU',   rango: [0, 4000],     res: 0.1,  ruidoAbs: 1,    ruidoRel: 0.02,  sesgoAbs: 0,    sesgoRel: 0.03,  derivaAbs: 0,     derivaRel: 0,      ensuciaAbs: 1.5, estabS: 5,  mW: 250 }
  };
  var PARAMS = ['COND', 'OD', 'PH', 'TEMP', 'TURB'];

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
    mulberry32: mulberry32, gauss: gauss, horaLocal: horaLocal, iso: iso, acota: acota,
    Agua: Agua, Sonda: Sonda, Energia: Energia, Enlace: Enlace
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Modelo;
})(typeof window !== 'undefined' ? window : globalThis);

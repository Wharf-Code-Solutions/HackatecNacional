/* Firmware de la estación, escrito como máquina de estados pura.
 *
 * Es la lógica que correría en el ESP32: dormir, despertar, calentar sondas,
 * medir, empaquetar, guardar, enviar, reintentar. No sabe de pantallas ni de
 * relojes del navegador: avanza solo cuando se le llama tick(dt) con segundos
 * simulados. Por eso el mismo archivo se prueba en Node y se anima en la web.
 *
 * Decisiones de diseño que importan (ver ficha-tecnica.md):
 *  - Escribe el paquete en la cola (la "tarjeta SD") ANTES de transmitir y lo
 *    borra solo después del ACK. Si el enlace cae o el equipo se reinicia en
 *    medio del envío, no se pierde nada.
 *  - Los paquetes viejos conservan su hora original al reenviarse.
 *  - No corrige ni recorta valores: manda el crudo (el contrato lo exige). Una
 *    sonda que no responde se reporta como null; el -999 de una sonda rota se
 *    manda tal cual. Quien decide qué es una falla es el backend.
 *  - Muestreo adaptativo: si algo cambia bruscamente, mide cada 5 min en vez de
 *    cada 15 hasta que se calme.
 */
(function (raiz) {
  'use strict';
  var M = raiz.Modelo || (typeof require !== 'undefined' ? require('./modelo.js') : null);

  var CFG = {
    intervalo: 900,          // s, ciclo normal
    intervaloAdapt: 300,     // s, ciclo cuando hay cambio brusco
    intervaloBateria: 1800,  // s, ahorro por batería baja
    calmasParaVolver: 3,     // ciclos tranquilos antes de volver a 15 min
    muestras: 5,             // lecturas por sonda; se reporta la mediana
    lote: 20,                // paquetes por POST
    reintentos: 3,
    bateriaBaja: 0.20,
    bateriaApagado: 0.08,
    bateriaReinicio: 0.15,
    rtcPpm: 2                // deriva del reloj en tiempo real (DS3231 típico)
  };
  // Consumo por fase en mW. Supuestos de diseño; se validan midiendo en banco.
  var CARGA = { sueno: 8, cpu: 240, empaque: 300, enlace: 1800, envio: 2400, espera: 1100, apagada: 2 };

  function mediana(a) {
    var b = a.slice().sort(function (x, y) { return x - y; });
    var m = b.length >> 1;
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  function redondea(x) { return Math.round(x * 1000) / 1000; }

  // Umbrales de "cambio brusco" respecto de la lectura anterior.
  function cambioBrusco(ant, act) {
    if (!ant) return false;
    function rel(p) { return ant[p] && act[p] ? Math.abs(act[p] - ant[p]) / Math.abs(ant[p]) : 0; }
    function abs(p) { return ant[p] !== null && act[p] !== null ? Math.abs(act[p] - ant[p]) : 0; }
    if (act.COND > 0 && ant.COND > 0 && rel('COND') > 0.4) return 'COND';
    if (abs('PH') > 0.7) return 'PH';
    if (rel('OD') > 0.5 && abs('OD') > 0.3) return 'OD';
    if (rel('TURB') > 1.0 && abs('TURB') > 100) return 'TURB';
    if (abs('TEMP') > 2) return 'TEMP';
    return false;
  }

  function Estacion(o) {
    this.id = o.id;                       // EST-ATY-01
    this.agua = o.agua;
    this.sondas = o.sondas;               // { OD: Sonda, ... }
    this.energia = o.energia;
    this.enlace = o.enlace;
    this.rng = o.rng;
    this.t0 = o.t0;
    this.t = o.t0;
    this.alEvento = o.alEvento || function () {};
    this.cola = [];                       // la "SD"
    this.ultimaMed = null;                // { COND: valor, ... } de la medición previa
    this.detalleMed = {};                 // por parámetro: {valor, saturada, verdad}
    this.ultimoPaquete = null;
    this.ultimoRSSI = Math.round(this.enlace.rssi);
    this.intentos = 0;
    this.calmas = 0;
    this.modoAdaptativo = false;
    this.alertaBateria = false;
    this.apagada = false;
    this.estab = Math.max.apply(null, M.PARAMS.map(function (p) { return M.ESPEC[p].estabS; }));
    this.cargaSondas = M.PARAMS.reduce(function (s, p) { return s + M.ESPEC[p].mW; }, 0);
    this.stats = { paquetes: 0, enviados: 0, posts: 0, reintentos: 0, guardadosSinEnlace: 0, huecos: 0 };
    this.lead = this.estab + CFG.muestras;   // despierta así de antes para medir "en punto"
    this.fase = null;
    this.t = this.t0 - this.lead;         // el reloj arranca justo a tiempo para medir en t0
    this._programa(this.t0);
  }

  Estacion.prototype._ev = function (tipo, msg, datos) {
    this.alEvento({ t: this.t, tipo: tipo, msg: msg, datos: datos || null });
  };
  Estacion.prototype.intervalo = function () {
    if (this.energia.soc() < CFG.bateriaBaja) return CFG.intervaloBateria;
    return this.modoAdaptativo ? CFG.intervaloAdapt : CFG.intervalo;
  };
  // Siguiente múltiplo del intervalo estrictamente posterior a t.
  Estacion.prototype._proximaMarca = function (t) {
    var I = this.intervalo();
    var rel = t - this.t0;
    return this.t0 + (Math.floor(rel / I) + 1) * I;
  };
  Estacion.prototype._setFase = function (nombre, dur, mW, alFin) {
    this.fase = { nombre: nombre, dur: dur, resta: dur, mW: mW, alFin: alFin };
  };
  // Dormir hasta (marca - lead) para que la medición termine justo en la marca.
  Estacion.prototype._programa = function (marca) {
    var despierta = marca - this.lead;
    if (despierta < this.t) despierta = this.t + 1;
    this.marcaObjetivo = marca;
    var self = this;
    this._setFase('SUEÑO', despierta - this.t, CARGA.sueno, function () { self._despierta(); });
  };

  Estacion.prototype.tick = function (dt) {
    while (dt > 1e-9) {
      var f = this.fase;
      var paso = Math.min(dt, f.resta);
      this.energia.integra(paso, f.mW, this.t);
      this.t += paso;
      f.resta -= paso;
      dt -= paso;
      if (f.resta <= 1e-9) f.alFin.call(this);
    }
  };

  Estacion.prototype._despierta = function () {
    var self = this;
    var soc = this.energia.soc();
    if (soc < CFG.bateriaApagado) { this._apaga(); return; }
    if (soc < CFG.bateriaBaja && !this.alertaBateria) {
      this.alertaBateria = true;
      this._ev('bateria_baja', 'Batería al ' + Math.round(soc * 100) + ' %: ciclo de 30 min');
    }
    if (soc >= CFG.bateriaBaja + 0.05) this.alertaBateria = false;
    this._ev('despierta', 'Despierta y alimenta las sondas');
    this._setFase('CALENTAMIENTO', this.estab, CARGA.cpu + this.cargaSondas, function () { self._mide(); });
  };
  Estacion.prototype._apaga = function () {
    var self = this;
    if (!this.apagada) {
      this.apagada = true;
      this._ev('apagada', 'Batería crítica: se apaga hasta recuperar carga solar');
    }
    this._setFase('APAGADA', 60, CARGA.apagada, function () {
      if (self.energia.soc() >= CFG.bateriaReinicio) {
        self.apagada = false;
        self._ev('reinicio', 'Carga recuperada: reinicia');
        var marca = self._proximaMarca(self.t);
        self.stats.huecos++;
        self._programa(marca);
      } else self._apaga();
    });
  };

  Estacion.prototype._mide = function () {
    var self = this;
    this._setFase('MEDICIÓN', CFG.muestras, CARGA.cpu + this.cargaSondas, function () {
      var lecturas = [], crudo = {};
      M.PARAMS.forEach(function (p) {
        var muestras = [], verdad = self.agua.valor(p, self.t);
        for (var k = 0; k < CFG.muestras; k++) {
          var v = self.sondas[p].leer(self.agua.valor(p, self.t - CFG.muestras + k + 1), self.t);
          if (v !== null) muestras.push(v);
        }
        var valor = muestras.length >= Math.ceil(CFG.muestras / 2) ? redondea(mediana(muestras)) : null;
        crudo[p] = valor;
        self.detalleMed[p] = { valor: valor, verdad: verdad, saturada: self.sondas[p].saturada(valor) };
        lecturas.push({ c_parametro: p, valor: valor });
      });
      var rtc = self.t + (self.t - self.t0) * CFG.rtcPpm * 1e-6;
      var paquete = {
        version: '1.0',
        c_estacion: self.id,
        fecha_hora: M.iso(rtc),
        lecturas: lecturas,
        bateria: Math.round(self.energia.soc() * 100),
        senal: self.ultimoRSSI
      };
      self._ev('medicion', 'Mediana de ' + CFG.muestras + ' lecturas por sonda', crudo);
      var motivo = cambioBrusco(self.ultimaMed, crudo);
      if (motivo) {
        if (!self.modoAdaptativo) self._ev('adaptativo', 'Cambio brusco en ' + motivo + ': pasa a ciclo de 5 min');
        self.modoAdaptativo = true; self.calmas = 0;
      } else if (self.modoAdaptativo && ++self.calmas >= CFG.calmasParaVolver) {
        self.modoAdaptativo = false; self.calmas = 0;
        self._ev('adaptativo', 'Señal estable: vuelve a ciclo de 15 min');
      }
      self.ultimaMed = crudo;
      self._empaca(paquete);
    });
  };

  // Escribe en la SD antes de transmitir.
  Estacion.prototype._empaca = function (paquete) {
    var self = this;
    this._setFase('EMPAQUETADO', 1, CARGA.empaque, function () {
      self.cola.push(paquete);
      self.ultimoPaquete = paquete;
      self.stats.paquetes++;
      self._ev('guarda', 'Paquete guardado en la SD (cola: ' + self.cola.length + ')', paquete);
      self.intentos = 0;
      self._enlaza();
    });
  };

  Estacion.prototype._enlaza = function () {
    var self = this;
    this._setFase('ENLACE', 8, CARGA.enlace, function () {
      if (self.enlace.intenta()) {
        self.ultimoRSSI = Math.round(self.enlace.rssi + M.gauss(self.rng) * 2);
        self._envia();
      } else self._falla();
    });
  };
  Estacion.prototype._falla = function () {
    var self = this;
    this.intentos++;
    this.stats.reintentos++;
    if (this.intentos >= CFG.reintentos) {
      this.stats.guardadosSinEnlace = this.cola.length;
      this._ev('sin_enlace', 'Sin enlace tras ' + CFG.reintentos + ' intentos: ' + this.cola.length + ' paquete(s) quedan en la SD');
      this._duerme();
      return;
    }
    var espera = 20 * Math.pow(2, this.intentos - 1);
    this._ev('reintento', 'Sin red (intento ' + this.intentos + '): espera ' + espera + ' s');
    this._setFase('ESPERA', espera, CARGA.espera, function () { self._enlaza(); });
  };
  Estacion.prototype._envia = function () {
    var self = this;
    var lote = this.cola.slice(0, CFG.lote);
    this._setFase('ENVÍO', 4, CARGA.envio, function () {
      // ACK recibido: recién ahora se borra de la SD
      self.cola.splice(0, lote.length);
      self.stats.enviados += lote.length;
      self.stats.posts++;
      self.stats.guardadosSinEnlace = self.cola.length;
      self._ev('envio', 'POST /lecturas con ' + lote.length + ' paquete(s)', lote);
      if (self.cola.length) self._envia();
      else self._duerme();
    });
  };
  Estacion.prototype._duerme = function () {
    this._programa(this._proximaMarca(this.t));
  };

  raiz.Firmware = { Estacion: Estacion, CFG: CFG, CARGA: CARGA, cambioBrusco: cambioBrusco };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Firmware;
})(typeof window !== 'undefined' ? window : globalThis);

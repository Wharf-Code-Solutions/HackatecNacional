/* Colector de residuos flotantes, escrito como máquina de estados pura (igual que firmware.js).
 *
 * Un interceptor de orilla: una barrera flotante guía lo que flota hacia la orilla, una banda lo sube
 * a un contenedor con báscula y una cámara cuenta y clasifica. Es el mecanismo de recolección que pide
 * el reto; la estación mide el agua, este retira lo que se ve.
 *
 * Mismas reglas que la estación:
 *  - Manda el dato crudo (kg, llenado, nivel, conteo) y NUNCA emite alertas: decidir si hay una
 *    acumulación anómala o si hay que programar el retiro le toca al backend (invariante I10).
 *  - Escribe el paquete en la "SD" antes de enviar y lo borra solo tras el ACK; reenvía con su hora.
 *  - Lo único que decide solo es seguridad del equipo: crecida (barrera arriba, banda parada),
 *    atasco (reversa y, si persiste, se bloquea), contenedor lleno y batería baja.
 *
 * Todo número de aquí es SUPUESTO DE DISEÑO, no medición (ver cada constante). No hay datos de
 * basura en la cuenca: la tasa de llegada es la incógnita que un piloto debe medir.
 *
 * El paquete NO está en el contrato v1.0: es una propuesta (`version: '0.1-propuesta'`). Cambiar el
 * contrato pasa por docs/contexto/05-protocolo-de-cambios.md.
 */
(function (raiz) {
  'use strict';
  var M = raiz.Modelo || (typeof require !== 'undefined' ? require('./modelo.js') : null);

  var CFG = {
    intervalo: 900,            // s, revisión alineada a la estación (:00, :15, :30, :45)
    tasaBase: 4,               // objetos/h que llegan a la barrera: supuesto, a medir en piloto
    factorLluvia: 5,           // con lluvia plena llegan 1 + 5 = 6 veces más (la lluvia arrastra basura)
    capKg: 24,                 // contenedor de 240 L con basura mojada a ≈ 100 kg/m³
    avisoRetiro: 0.8,          // llenado desde el que se pide retiro
    lleno: 0.95,               // desde aquí la banda ya no sube más
    retiroDespuesS: 8 * 3600,  // supuesto: el municipio retira ≈ 8 h después del aviso
    nivelBaseCm: 35,           // tirante en estiaje: supuesto (sin aforo en el sitio)
    nivelCrecida: 65,          // cm: barrera arriba y banda parada
    nivelSale: 58,             // cm: histéresis para volver a operar
    capturaBase: 0.9,          // fracción que atrapa la barrera con corriente ≤ 0.6 m/s
    capturaCaida: 0.75,        // cae esto por cada m/s por encima de 0.6
    capturaMin: 0.2,           // con la barrera arriba o corriente muy fuerte
    aproxM: 10,                // m aguas arriba desde donde se ve venir el objeto
    barreraM: 17.6,            // largo de la barrera, de ≈ 12 m de espejo de agua en diagonal
    deslizaFrac: 0.5,          // el objeto resbala por la barrera a la mitad de la corriente
    segObjeto: 12,             // s que tarda la banda en subir un objeto
    maxObjetos: 25,            // máximo por revisión (≈ 5 min de banda)
    atascoP: 0.02,             // probabilidad de atasco por objeto
    reversaS: 3, reversaOk: 0.7, reversasMax: 2,
    visitaS: 12 * 3600,        // supuesto: la cuadrilla despeja un atasco en ≤ 12 h
    bateriaMin: 0.25,          // bajo esto la banda no arranca
    revisaS: 20, pesaS: 4,
    ruidoKg: 0.02,             // ruido de la celda de carga
    errorCamara: 0.1,          // la cámara se equivoca de clase en 1 de cada 10
    lote: 20, reintentos: 3
  };
  // Consumo por fase en mW. Supuestos de diseño; se validan midiendo en banco.
  var CARGA = { reposo: 500, revisa: 3000, motor: 120500, pesa: 1500, enlace: 1800, envio: 2400, espera: 1100 };
  var TIPOS = {
    plastico: { kg: 0.03, p: 0.35, nombre: 'Botella de plástico' },
    bolsa:    { kg: 0.02, p: 0.25, nombre: 'Bolsa' },
    unicel:   { kg: 0.01, p: 0.10, nombre: 'Unicel' },
    vegetal:  { kg: 0.35, p: 0.20, nombre: 'Vegetación' },
    otro:     { kg: 0.15, p: 0.10, nombre: 'Otro' }
  };
  var CLASES = Object.keys(TIPOS);

  function poisson(mu, rng) {
    if (mu <= 0) return 0;
    if (mu > 30) return Math.max(0, Math.round(mu + Math.sqrt(mu) * M.gauss(rng)));
    var L = Math.exp(-mu), k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  }
  function tipoAlAzar(rng) {
    var u = rng(), a = 0;
    for (var i = 0; i < CLASES.length; i++) { a += TIPOS[CLASES[i]].p; if (u < a) return CLASES[i]; }
    return 'otro';
  }
  function vacio() { var o = {}; CLASES.forEach(function (c) { o[c] = 0; }); return o; }

  function Colector(o) {
    this.id = o.id;                        // la estación con la que comparte puente: EST-ATY-01
    this.agua = o.agua;
    this.energia = o.energia;              // batería de 12 V ≈ 256 Wh y panel de 100 W
    this.enlace = o.enlace;
    this.rng = o.rng;
    this.t0 = o.t0;
    this.t = o.t0;
    this.alEvento = o.alEvento || function () {};
    this.tasa = CFG.tasaBase;              // ajustable para pruebas
    this.atascoP = CFG.atascoP;
    this.reversaOk = CFG.reversaOk;
    this.items = [];                       // objetos en el agua, en la barrera, en el embudo o en la banda
    this.embudo = [];                      // los que la cámara ve esperando frente a la banda
    this.kg = 0;                           // peso real en el contenedor (la báscula lo lee con ruido)
    this.kgLeido = 0; this.kgAnt = 0;
    this.crecida = false; this.bloqueado = false; this.bloqueadoDesde = 0; this.retiroEn = null;
    this.modo = 'normal';
    this.objetosCiclo = vacio();
    this.ultimoObjeto = null;              // lo último que clasificó la cámara
    this.cola = [];                        // la "SD"
    this.intentos = 0;
    this.ultimoPaquete = null;
    this.ultimoRSSI = Math.round(this.enlace.rssi);
    this.nextId = 1;
    this.stats = { llegados: 0, capturados: 0, escapados: 0, elevados: 0, atascos: 0, crecidas: 0, retiros: 0,
      paquetes: 0, enviados: 0, posts: 0, reintentos: 0 };
    this.fase = null;
    this._programa(this.t0 + 1);
  }

  Colector.prototype._ev = function (tipo, msg, datos) {
    this.alEvento({ t: this.t, tipo: tipo, msg: msg, datos: datos || null });
  };
  Colector.prototype.llenado = function () { return M.acota(this.kg / CFG.capKg, 0, 1); };
  Colector.prototype.nivelRio = function (t) {
    var q = 1 + 3 * this.agua.lluvia(t === undefined ? this.t : t);   // el mismo caudal que la velocidad (docs/14)
    return CFG.nivelBaseCm * Math.pow(q, 0.4);
  };
  // Estado en palabras llanas, para la figura.
  Colector.prototype.estadoTexto = function () {
    if (this.crecida) return 'Río crecido: barrera arriba y banda parada';
    var n = this.fase.nombre;
    if (n === 'REVERSA') return 'Atasco: probando en reversa';
    if (this.bloqueado) return 'Atascada: espera a la cuadrilla';
    if (n === 'ELEVACIÓN') return 'Subiendo la basura';
    if (n === 'REVISA') return 'Revisando el embudo';
    if (n === 'PESAJE') return 'Pesando';
    if (n === 'ENLACE') return 'Conectándose a la red';
    if (n === 'ENVÍO') return 'Enviando los datos';
    if (n === 'ESPERA') return 'Sin red: lo intentará de nuevo';
    if (this.llenado() >= CFG.lleno) return 'Contenedor lleno: espera el retiro';
    if (this.modo === 'ahorro') return 'Ahorrando batería: banda parada';
    return 'Vigilando';
  };

  Colector.prototype._setFase = function (nombre, dur, mW, alFin) {
    this.fase = { nombre: nombre, dur: dur, resta: dur, mW: mW, alFin: alFin };
  };
  Colector.prototype._proximaMarca = function (t) {
    return this.t0 + (Math.floor((t - this.t0) / CFG.intervalo) + 1) * CFG.intervalo;
  };
  Colector.prototype._programa = function (marca) {
    var self = this;
    this._setFase('REPOSO', Math.max(1, marca - this.t), CARGA.reposo, function () { self._revisa(); });
  };

  Colector.prototype.tick = function (dt) {
    while (dt > 1e-9) {
      var f = this.fase, paso = Math.min(dt, f.resta, 5);
      this._flujo(paso);
      this.energia.integra(paso, f.mW, this.t);
      this.t += paso; f.resta -= paso; dt -= paso;
      this._vigila();
      if (f.resta <= 1e-9) f.alFin.call(this);
    }
  };

  // ------------------------------------------------------------ lo que trae el río
  Colector.prototype._llega = function (t) {
    var tipo = tipoAlAzar(this.rng), v = this.agua.velocidad(t);
    var eps = this.crecida ? CFG.capturaMin
      : M.acota(CFG.capturaBase - CFG.capturaCaida * Math.max(0, v - 0.6), CFG.capturaMin, CFG.capturaBase);
    var it = { id: this.nextId++, tipo: tipo, masa: TIPOS[tipo].kg, t0: t, v: v, captura: this.rng() < eps, estado: 'aproxima' };
    it.tB = t + CFG.aproxM / v;                                   // llega a la barrera
    if (it.captura) it.tF = it.tB + CFG.barreraM / (CFG.deslizaFrac * v);   // llega al embudo
    else it.tFin = it.tB + 25 / v;                                // pasa por debajo o por el lado
    this.items.push(it);
    this.stats.llegados++;
    this._ev('objeto', null, it);
  };
  Colector.prototype._flujo = function (paso) {
    var self = this, tt = this.t + paso;
    var mu = this.tasa * (1 + CFG.factorLluvia * this.agua.lluvia(this.t)) / 3600 * paso;
    for (var n = poisson(mu, this.rng); n > 0; n--) this._llega(this.t + this.rng() * paso);
    this.items = this.items.filter(function (it) {
      if (it.estado === 'aproxima' && tt >= it.tB) {
        if (it.captura) it.estado = 'barrera'; else { it.estado = 'escapa'; self.stats.escapados++; }
      }
      if (it.estado === 'barrera' && tt >= it.tF) {
        it.estado = 'embudo'; self.embudo.push(it); self.stats.capturados++;
      }
      return !(it.estado === 'escapa' && tt >= it.tFin);
    });
  };

  // Lo que el equipo decide solo: seguridad y retiro.
  Colector.prototype._vigila = function () {
    var self = this, nivel = this.nivelRio();
    if (!this.crecida && nivel >= CFG.nivelCrecida) {
      this.crecida = true; this.stats.crecidas++;
      this.items.forEach(function (it) {        // los que iban por la barrera se van por debajo
        if (it.estado === 'barrera') {
          it.estado = 'escapa'; it.captura = false; it.tFin = self.t + 10 / it.v; self.stats.escapados++;
          self._ev('escapa', null, it);
        }
      });
      this._ev('crecida', 'Nivel del río en ' + Math.round(nivel) + ' cm: barrera arriba y banda parada');
    } else if (this.crecida && nivel < CFG.nivelSale) {
      this.crecida = false;
      this._ev('crecida_fin', 'El río bajó a ' + Math.round(nivel) + ' cm: vuelve a operar');
    }
    if (this.bloqueado && this.t - this.bloqueadoDesde >= CFG.visitaS) {
      this.bloqueado = false;
      this._ev('despejada', 'La cuadrilla despejó la banda');
    }
    if (this.retiroEn !== null && this.t >= this.retiroEn) {
      this.kg = 0; this.retiroEn = null; this.stats.retiros++;
      this._ev('retiro', 'Se retiró el contenedor y quedó vacío');
    }
  };

  // ------------------------------------------------------------ el ciclo
  Colector.prototype._revisa = function () {
    var self = this;
    this._setFase('REVISA', CFG.revisaS, CARGA.revisa, function () {
      var soc = self.energia.soc();
      self.modo = self.crecida ? 'crecida' : self.bloqueado ? 'atasco' : self.llenado() >= CFG.lleno ? 'lleno'
        : soc < CFG.bateriaMin ? 'ahorro' : 'normal';
      if (self.modo === 'normal' && self.embudo.length) self._elevaSiguiente(0);
      else self._pesa();
    });
  };
  Colector.prototype._elevaSiguiente = function (n) {
    if (n >= CFG.maxObjetos || !this.embudo.length || this.crecida || this.llenado() >= CFG.lleno) { this._pesa(); return; }
    var it = this.embudo.shift();
    it.estado = 'banda';
    this._ev('sube', null, it);
    if (this.rng() < this.atascoP) this._atasco(it, n, 0); else this._sube(it, n);
  };
  Colector.prototype._sube = function (it, n) {
    var self = this;
    this._setFase('ELEVACIÓN', CFG.segObjeto, CARGA.motor, function () {
      self.kg += it.masa;
      var clase = self.rng() < CFG.errorCamara ? CLASES[(self.rng() * CLASES.length) | 0] : it.tipo;
      self.objetosCiclo[clase]++;
      self.ultimoObjeto = clase;
      self.stats.elevados++;
      self.items.splice(self.items.indexOf(it), 1);
      it.estado = 'contenedor';
      self._ev('contenedor', null, it);
      self._elevaSiguiente(n + 1);
    });
  };
  // El sensor de corriente del motor ve el atasco: invierte 3 s, hasta dos veces; si persiste, se bloquea.
  Colector.prototype._atasco = function (it, n, intentos) {
    var self = this;
    this.stats.atascos++;
    this._ev('reversa', 'Corriente alta en el motor: invierte la banda');
    this._setFase('REVERSA', CFG.reversaS, CARGA.motor, function () {
      if (self.rng() < self.reversaOk) { self._sube(it, n); return; }
      if (intentos + 1 >= CFG.reversasMax) {
        self.bloqueado = true; self.bloqueadoDesde = self.t;
        it.estado = 'embudo'; self.embudo.unshift(it);
        self._ev('atasco', 'Banda atascada tras ' + CFG.reversasMax + ' reversas: espera a la cuadrilla');
        self.modo = 'atasco';
        self._pesa();
      } else self._atasco(it, n, intentos + 1);
    });
  };
  Colector.prototype._pesa = function () {
    var self = this;
    this._setFase('PESAJE', CFG.pesaS, CARGA.pesa, function () {
      var leido = Math.max(0, Math.round((self.kg + M.gauss(self.rng) * CFG.ruidoKg) * 100) / 100);
      var kgCiclo = Math.round((leido - self.kgAnt) * 100) / 100;   // crudo: un valor negativo grande es un retiro
      self.kgAnt = leido; self.kgLeido = leido;
      if (self.llenado() >= CFG.avisoRetiro && self.retiroEn === null) {
        self.retiroEn = self.t + CFG.retiroDespuesS;
        self._ev('aviso_retiro', 'Contenedor al ' + Math.round(self.llenado() * 100) + ' %: se pide el retiro');
      }
      var paquete = {
        version: '0.1-propuesta',
        c_colector: 'COL-' + self.id.replace('EST-', ''),
        c_estacion: self.id,
        fecha_hora: M.iso(self.t),
        kg_ciclo: kgCiclo,
        kg_contenedor: leido,
        llenado: Math.round(leido / CFG.capKg * 100),
        objetos: self.objetosCiclo,
        nivel_rio_cm: Math.round(self.nivelRio()),
        estado: self.crecida ? 'crecida' : self.bloqueado ? 'atasco' : self.llenado() >= CFG.lleno ? 'lleno' : self.modo === 'ahorro' ? 'ahorro' : 'normal',
        bateria: Math.round(self.energia.soc() * 100),
        senal: self.ultimoRSSI
      };
      self.objetosCiclo = vacio();
      self._empaca(paquete);
    });
  };
  Colector.prototype._empaca = function (paquete) {
    this.cola.push(paquete);
    this.ultimoPaquete = paquete;
    this.stats.paquetes++;
    this.intentos = 0;
    this._enlaza();
  };
  Colector.prototype._enlaza = function () {
    var self = this;
    this._setFase('ENLACE', 8, CARGA.enlace, function () {
      if (self.enlace.intenta()) { self.ultimoRSSI = Math.round(self.enlace.rssi + M.gauss(self.rng) * 2); self._envia(); }
      else self._falla();
    });
  };
  Colector.prototype._falla = function () {
    var self = this;
    this.intentos++; this.stats.reintentos++;
    if (this.intentos >= CFG.reintentos) {
      this._ev('sin_enlace', 'Sin enlace: ' + this.cola.length + ' paquete(s) quedan en la SD');
      this._programa(this._proximaMarca(this.t));
      return;
    }
    this._setFase('ESPERA', 20 * Math.pow(2, this.intentos - 1), CARGA.espera, function () { self._enlaza(); });
  };
  Colector.prototype._envia = function () {
    var self = this, lote = this.cola.slice(0, CFG.lote);
    this._setFase('ENVÍO', 4, CARGA.envio, function () {
      self.cola.splice(0, lote.length);          // ACK: recién ahora se borra de la SD
      self.stats.enviados += lote.length; self.stats.posts++;
      self._ev('envio', 'Paquete(s) del colector enviados: ' + lote.length, lote);
      if (self.cola.length) self._envia(); else self._programa(self._proximaMarca(self.t));
    });
  };

  raiz.Recolector = { Colector: Colector, CFG: CFG, CARGA: CARGA, TIPOS: TIPOS, CLASES: CLASES };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Recolector;
})(typeof window !== 'undefined' ? window : globalThis);

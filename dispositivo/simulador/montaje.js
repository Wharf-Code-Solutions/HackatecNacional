/* Arma una estación completa (agua + sondas + energía + enlace + firmware) a
 * partir de los fixtures del contrato. Lo usan la interfaz web y la prueba.
 *
 * Los datos de entrada NO se duplican aquí: la estación y su línea base se leen
 * de contrato/fixtures/ (mecanismos.json o estaciones.json, y linea_base.json).
 * Una estación reubicada cuyo sitio no tiene línea base en el fixture fabrica su
 * agua con la banda de `banda_simulacion` (scripts/99_reubicacion.py).
 */
(function (raiz) {
  'use strict';
  var M = raiz.Modelo || (typeof require !== 'undefined' ? require('./modelo.js') : null);
  var F = raiz.Firmware || (typeof require !== 'undefined' ? require('./firmware.js') : null);
  var R = raiz.Recolector || (typeof require !== 'undefined' ? require('./recolector.js') : null);

  // RSSI típico por estación, tomado del rango que traen los fixtures
  // (-59 a -81 dBm). Es un supuesto hasta medir cobertura en campo.
  var RSSI = { 'EST-ATY-01': -66, 'EST-ATY-02': -78, 'EST-ATY-03': -84, 'EST-ATY-04': -72, 'EST-ATY-05': -81 };

  function lineaDeSitio(lineaBase, cSitio) {
    var o = {};
    lineaBase.linea_base.forEach(function (r) {
      if (r.c_sitio === cSitio) o[r.c_parametro] = r;
    });
    return o;
  }

  // Qué mide una estación: lo que diga su ficha (v2.0); las del Atoyac, sin esa lista, las cinco sondas.
  function parametros(est) { return est.parametros && est.parametros.length ? est.parametros : M.PARAMS; }
  function esLadera(est) { return parametros(est).indexOf('COND') < 0; }

  function crearEstacion(est, lineaBase, opc) {
    opc = opc || {};
    var semilla = opc.semilla || 20261123;
    var t0 = opc.t0 || M.T0_DEFECTO;
    var sem = semilla + est.c_estacion.charCodeAt(est.c_estacion.length - 1);
    var rng = M.mulberry32(sem);
    var params = parametros(est);
    var linea = lineaDeSitio(lineaBase, est.banda_simulacion || est.c_sitio);
    // El agua solo existe donde hay cauce; la ladera, donde la estación tiene su módulo (docs/20).
    var agua = esLadera(est) ? null : new M.Agua(linea, sem);
    var ladera = params.some(function (p) { return M.PARAMS_LADERA.indexOf(p) >= 0; }) ? new M.Ladera(sem + 41) : null;
    var sondas = {};
    params.forEach(function (p) { sondas[p] = p === 'LLUVIA' ? new M.Pluviometro(ladera, t0) : new M.Sonda(p, rng, t0); });
    var cfgE = M.ENERGIA[esLadera(est) ? 'ladera' : 'rio'];
    var energia = new M.Energia({ capWh: cfgE.capWh, panelW: cfgE.panelW, soc0: opc.soc0 });
    var enlace = new M.Enlace(RSSI[est.c_estacion] || -80, rng);
    var firmware = new F.Estacion({
      id: est.c_estacion, agua: agua, ladera: ladera, params: params, sondas: sondas, energia: energia,
      enlace: enlace, rng: rng, t0: t0, alEvento: opc.alEvento
    });
    // El colector de residuos comparte puente, agua y red celular con la estación; tiene su propia
    // batería (12 V, 256 Wh) y su panel de 100 W. Si se corta el enlace de la estación, también el suyo.
    // Solo en un cauce: las reubicadas lo traen en su ficha (`colector`), las del Atoyac lo llevan todas,
    // las de ladera no (null).
    var col = null;
    if (agua && est.colector !== null) {
      var rngCol = M.mulberry32(semilla + 777 + est.c_estacion.charCodeAt(est.c_estacion.length - 1));
      var enlaceCol = new M.Enlace(RSSI[est.c_estacion] || -80, rngCol);
      Object.defineProperty(enlaceCol, 'caido', { get: function () { return enlace.caido; }, set: function () {} });
      col = new R.Colector({
        id: est.c_estacion, agua: agua, rng: rngCol, t0: t0, enlace: enlaceCol,
        energia: new M.Energia({ capWh: 256, panelW: 100, soc0: opc.soc0 }), alEvento: opc.alEventoCol
      });
    }
    return { est: est, linea: linea, agua: agua, ladera: ladera, params: params, sondas: sondas, energia: energia,
      enlace: enlace, fw: firmware, col: col, tipo: esLadera(est) ? 'ladera' : 'rio' };
  }

  raiz.Montaje = { crearEstacion: crearEstacion, lineaDeSitio: lineaDeSitio, parametros: parametros, esLadera: esLadera, RSSI: RSSI };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Montaje;
})(typeof window !== 'undefined' ? window : globalThis);

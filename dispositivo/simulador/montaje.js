/* Arma una estación completa (agua + sondas + energía + enlace + firmware) a
 * partir de los fixtures del contrato. Lo usan la interfaz web y la prueba.
 *
 * Los datos de entrada NO se duplican aquí: la estación y su línea base se leen
 * de contrato/fixtures/estaciones.json y linea_base.json (fuente de verdad).
 */
(function (raiz) {
  'use strict';
  var M = raiz.Modelo || (typeof require !== 'undefined' ? require('./modelo.js') : null);
  var F = raiz.Firmware || (typeof require !== 'undefined' ? require('./firmware.js') : null);

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

  function crearEstacion(est, lineaBase, opc) {
    opc = opc || {};
    var semilla = opc.semilla || 20261123;
    var t0 = opc.t0 || M.T0_DEFECTO;
    var rng = M.mulberry32(semilla + est.c_estacion.charCodeAt(est.c_estacion.length - 1));
    var linea = lineaDeSitio(lineaBase, est.c_sitio);
    var agua = new M.Agua(linea, semilla + est.c_estacion.charCodeAt(est.c_estacion.length - 1));
    var sondas = {};
    M.PARAMS.forEach(function (p) { sondas[p] = new M.Sonda(p, rng, t0); });
    var energia = new M.Energia({ soc0: opc.soc0 });
    var enlace = new M.Enlace(RSSI[est.c_estacion] || -80, rng);
    var firmware = new F.Estacion({
      id: est.c_estacion, agua: agua, sondas: sondas, energia: energia,
      enlace: enlace, rng: rng, t0: t0, alEvento: opc.alEvento
    });
    return { est: est, linea: linea, agua: agua, sondas: sondas, energia: energia, enlace: enlace, fw: firmware };
  }

  raiz.Montaje = { crearEstacion: crearEstacion, lineaDeSitio: lineaDeSitio, RSSI: RSSI };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Montaje;
})(typeof window !== 'undefined' ? window : globalThis);

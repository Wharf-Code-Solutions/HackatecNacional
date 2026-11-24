/* Pruebas del firmware simulado, sin navegador:
 *
 *   node dispositivo/simulador/prueba.js
 *
 * Cada prueba verifica una propiedad de diseño declarada en la ficha técnica.
 * Los paquetes que genera se escriben a un archivo temporal para que el
 * validador del contrato (Python) los revise: eso comprueba que el simulador
 * habla el mismo idioma que el backend.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var os = require('os');
var M = require('./modelo.js');
var F = require('./firmware.js');
var Mont = require('./montaje.js');

var RAIZ = path.resolve(__dirname, '..', '..');
var estaciones = JSON.parse(fs.readFileSync(path.join(RAIZ, 'contrato/fixtures/estaciones.json'), 'utf8')).estaciones;
var lineaBase = JSON.parse(fs.readFileSync(path.join(RAIZ, 'contrato/fixtures/linea_base.json'), 'utf8'));

var fallas = 0;
function ok(cond, msg) {
  console.log((cond ? '  OK     ' : '  FALLA  ') + msg);
  if (!cond) fallas++;
}
function corre(est, horas, antes) {
  var eventos = [], enviados = [];
  var s = Mont.crearEstacion(est, lineaBase, {
    alEvento: function (e) {
      eventos.push(e);
      if (e.tipo === 'envio') enviados = enviados.concat(e.datos);
    }
  });
  if (antes) antes(s);
  var fin = M.T0_DEFECTO + horas * 3600;
  var hook = s._hook;
  while (s.fw.t < fin) {
    s.fw.tick(5);
    if (hook) hook(s);
  }
  return { s: s, eventos: eventos, enviados: enviados };
}
function limpio(n) { return n.indexOf('EST') === 0; }

var e1 = estaciones[0];

console.log('1. Día normal sin incidentes (EST-ATY-01, 24 h)');
var r = corre(e1, 24);
ok(r.enviados.length >= 96 && r.enviados.length <= 100,
  'paquetes enviados: ' + r.enviados.length + ' (esperado ~96 a 15 min)');
ok(r.enviados[0].fecha_hora === '2026-11-23T00:00:00-06:00', 'el primero lleva la hora en punto con zona: ' + r.enviados[0].fecha_hora);
ok(r.enviados.every(function (p) { return /-06:00$/.test(p.fecha_hora); }), 'todas las horas traen zona -06:00');
ok(r.s.fw.cola.length === 0, 'la SD queda vacía tras los ACK');
ok(r.s.energia.soc() > 0.6, 'batería sana tras 24 h: ' + Math.round(r.s.energia.soc() * 100) + ' %');
var pn = r.enviados[40];
ok(pn.lecturas.length === 5 && pn.lecturas.every(function (l) { return typeof l.valor === 'number'; }),
  'cada paquete trae las 5 sondas con valor numérico');
var dentro = 0, total = 0;
r.enviados.forEach(function (p) {
  p.lecturas.forEach(function (l) {
    var L = r.s.linea[l.c_parametro];
    total++;
    if (l.valor >= L.minimo * 0.9 && l.valor <= L.maximo * 1.1) dentro++;
  });
});
ok(dentro / total > 0.98, 'las lecturas normales caen en el rango histórico real del sitio: ' + dentro + '/' + total);

console.log('\n2. Descarga industrial a las 10:00 (muestreo adaptativo)');
var r2 = corre(e1, 24, function (s) { s.agua.agregaEvento('descarga_industrial', M.T0_DEFECTO + 10 * 3600); });
var cond = r2.enviados.map(function (p) { return p.lecturas[0].valor; });
ok(Math.max.apply(null, cond) > 10000, 'la sonda de conductividad ve la descarga: máx ' + Math.max.apply(null, cond) + ' µS/cm');
ok(r2.eventos.some(function (e) { return e.tipo === 'adaptativo' && /5 min/.test(e.msg); }), 'pasa a ciclo de 5 min al detectar el cambio brusco');
ok(r2.eventos.some(function (e) { return e.tipo === 'adaptativo' && /vuelve/.test(e.msg); }), 'vuelve a 15 min cuando se calma');
ok(r2.enviados.length > r.enviados.length, 'mide más seguido durante el evento: ' + r2.enviados.length + ' paquetes');

console.log('\n3. Corte de red de 4 h (store-and-forward)');
var r3 = corre(e1, 24, function (s) {
  s._hook = function (x) {
    var h = M.horaLocal(x.fw.t);
    x.enlace.caido = h >= 6 && h < 10;
  };
});
var horas = r3.enviados.map(function (p) { return p.fecha_hora; });
var unicas = {};
horas.forEach(function (h) { unicas[h] = true; });
ok(Object.keys(unicas).length === horas.length, 'sin duplicados: ' + horas.length + ' paquetes');
ok(horas.length === r.enviados.length, 'sin pérdida: mismo número que el día sin corte (' + r.enviados.length + ')');
ok(horas.indexOf('2026-11-23T07:30:00-06:00') >= 0, 'los paquetes del corte se reenviaron con su hora ORIGINAL');
var ordenado = horas.slice().sort();
ok(JSON.stringify(horas) === JSON.stringify(ordenado), 'llegan en orden cronológico');
ok(r3.s.fw.cola.length === 0, 'la SD quedó vacía al volver la red');

console.log('\n4. Fallas de sonda (el firmware reporta, no corrige)');
var r4 = corre(e1, 4, function (s) {
  s.sondas.PH.falla = 'menos999';
  s.sondas.OD.falla = 'sin_respuesta';
});
var p4 = r4.enviados[10];
var ph = p4.lecturas.filter(function (l) { return l.c_parametro === 'PH'; })[0].valor;
var od = p4.lecturas.filter(function (l) { return l.c_parametro === 'OD'; })[0].valor;
ok(ph === -999, 'pH roto se manda como -999 tal cual');
ok(od === null, 'OD sin respuesta se manda como null');
ok(!r4.eventos.some(function (e) { return e.tipo === 'alerta'; }), 'el firmware no emite alertas ambientales: eso es del backend (I10)');

console.log('\n5. Saturación de turbiedad en lluvia fuerte');
var r5 = corre(e1, 24, function (s) { s.agua.agregaEvento('lluvia', M.T0_DEFECTO + 15 * 3600); });
var turb = r5.enviados.map(function (p) { return p.lecturas[4].valor; });
ok(Math.max.apply(null, turb) === 4000, 'la sonda satura en su tope declarado (4000 NTU): ' + Math.max.apply(null, turb));

console.log('\n6. Energía');
var rn = corre(e1, 24 * 4, function (s) { s.energia.clima = 0.25; });
ok(rn.s.energia.soc() > 0.2, 'con clima nublado 4 días sigue viva: ' + Math.round(rn.s.energia.soc() * 100) + ' %');
var nosol = corre(e1, 24 * 20, function (s) { s.energia.panelW = 0; });
ok(nosol.s.fw.apagada || nosol.s.energia.soc() < 0.1, 'sin panel se agota (consumo medido ≈ ' +
  (nosol.s.energia.consumidoWh / (nosol.s.fw.t - M.T0_DEFECTO) * 86400).toFixed(2) + ' Wh/día)');
var dia = corre(e1, 24, function (s) { s.energia.panelW = 0; });
var whDia = dia.s.energia.consumidoWh;
console.log('  INFO   consumo medido: ' + whDia.toFixed(2) + ' Wh/día → autonomía sin sol ≈ ' + (22.2 * 0.9 / whDia).toFixed(0) + ' días desde 90 %');

console.log('\n7. Las cinco estaciones del piloto');
estaciones.forEach(function (e) {
  var x = corre(e, 24);
  ok(x.enviados.length >= 96 && x.s.fw.cola.length === 0, e.c_estacion + ': ' + x.enviados.length + ' paquetes, SD vacía');
});

// salida para el validador del contrato
var salida = path.join(os.tmpdir(), 'paquetes_simulador.json');
var todos = [];
estaciones.forEach(function (e) {
  var x = corre(e, 24, function (s) { if (e === e1) s.agua.agregaEvento('descarga_industrial', M.T0_DEFECTO + 10 * 3600); });
  todos = todos.concat(x.enviados);
});
fs.writeFileSync(salida, JSON.stringify(todos));
console.log('\nPaquetes para validar contra el contrato: ' + todos.length + ' → ' + salida);
console.log(fallas ? '\n' + fallas + ' FALLA(S)' : '\nTodo en orden.');
process.exit(fallas ? 1 : 0);

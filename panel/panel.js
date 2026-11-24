/* Panel de autoridad (M7).
 *
 * Lista las alertas ambientales con su evidencia, su fuente probable, su predicción y lo
 * que hay aguas arriba y aguas abajo del punto; permite cambiar el estado y asignar
 * responsable. Muestra aparte los avisos técnicos (I8) y los reportes ciudadanos.
 *
 * Frontera: el panel no evalúa nada. El nivel, la regla, la fuente y la predicción llegan
 * del backend por el contrato; si un dato no viene, se dice "sin dato" (I13). Lo único que
 * el panel lee por su cuenta son tablas ya publicadas: la línea base del contrato (para
 * dibujar la banda con su n y sus fechas, I12) y la topología de M1 (sitio_pares.csv).
 *
 * Se sirve desde la raíz del repo:  python -m http.server 8000   →   /panel/
 * ?mock=http://127.0.0.1:8080 es el backend por defecto.
 */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var API = (Q.get('mock') || 'http://127.0.0.1:8080').replace(/\/$/, '');
  var CADA_MS = 3000;
  var $ = function (id) { return document.getElementById(id); };

  var PARAM = {
    OD: 'Oxígeno disuelto', PH: 'pH', COND: 'Conductividad', TEMP: 'Temperatura',
    TURB: 'Turbiedad', SDT: 'Sólidos disueltos totales'
  };
  var REGLA = {
    umbral_fijo: 'Umbral fijo', desviacion_linea_base: 'Desviación de la línea base del sitio',
    persistencia: 'Persistencia', cambio_brusco: 'Cambio brusco'
  };
  var CRITERIO = {
    CONAGUA_SUP: 'Escala de calidad de CONAGUA', NOM001_2021_RIO: 'NOM-001-SEMARNAT-2021, río',
    NOM001_2021_EMBALSE: 'NOM-001-SEMARNAT-2021, embalse', LINEA_BASE_SITIO: 'Historia del propio sitio'
  };
  var FUENTE = {
    aguas_residuales_municipales: 'Aguas residuales municipales', descarga_industrial: 'Descarga industrial',
    escurrimiento_o_arrastre: 'Escurrimiento o arrastre', mixta: 'Mixta', indeterminada: 'Indeterminada'
  };
  var AVISO = {
    valor_imposible: 'Valor imposible', lectura_congelada: 'Lectura congelada', salto_imposible: 'Salto imposible',
    bateria_baja: 'Batería baja', enlace_marginal: 'Enlace marginal', sin_reporte: 'Sin reporte',
    posible_deriva: 'Posible deriva'
  };
  var REPORTE = {
    descarga_visible: 'Descarga visible', espuma: 'Espuma', color_anormal: 'Color anormal', mal_olor: 'Mal olor',
    basura_o_residuos: 'Basura o residuos', peces_muertos: 'Peces muertos', otro: 'Otro'
  };
  var ESTADO_TXT = { 'En atencion': 'En atención', Critica: 'Crítica' };
  function txt(v) { return ESTADO_TXT[v] || v; }

  var estado = {
    estaciones: {}, lineaBase: {}, nombresSitio: {}, pares: [],
    alertas: [], veredictos: {}, reportes: [], motor: null,
    sel: null, vista: 'alertas', conectado: null
  };

  // ------------------------------------------------------------ utilidades
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function get(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r; });
  }
  function getJSON(url) { return get(url).then(function (r) { return r.json(); }); }
  // CSV con comillas dobles; quita el BOM (I4: los CSV del repo son utf-8-sig).
  function leeCSV(texto) {
    texto = texto.replace(/^﻿/, '');
    var filas = [], fila = [], campo = '', dentro = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (dentro) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') dentro = false;
        else campo += c;
      } else if (c === '"') dentro = true;
      else if (c === ',') { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    var cab = filas.shift();
    return filas.filter(function (f) { return f.length === cab.length; }).map(function (f) {
      var o = {}; cab.forEach(function (k, j) { o[k] = f[j]; }); return o;
    });
  }
  function hora(iso) {
    if (!iso) return 'sin dato';
    var d = new Date(iso);
    return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function num(v, dec) {
    if (v == null || isNaN(v)) return 'sin dato';
    return Number(v).toLocaleString('es-MX', { maximumFractionDigits: dec == null ? 2 : dec });
  }
  function km(m) { return num(m / 1000, 1) + ' km'; }
  // "RÍO ATOYAC DESPUES DE CONFLUENCIA" -> "Río Atoyac despues de confluencia": mayúscula solo en nombres propios probables.
  var MENORES = /^(de|del|la|las|el|los|y|con|a|en|antes|despues|después|aguas|arriba|abajo|confluencia|puente|sitio|cercanos|puntos)$/;
  function inicial(t) {
    return (t || '').toLowerCase().split(' ').map(function (w, i) {
      if (i > 0 && MENORES.test(w.replace(/[(),]/g, ''))) return w;
      return w.replace(/^([(]?)([a-záéíóúñ])/, function (m, a, b) { return a + b.toUpperCase(); });
    }).join(' ');
  }
  function nombreEstacion(c) {
    var e = estado.estaciones[c];
    return e ? inicial(e.cuerpo_agua) + ', ' + inicial(e.municipio) : c;
  }
  function unidad(alerta) {
    var b = banda(alerta);
    return b && b.unidad ? ' ' + b.unidad : '';
  }
  function banda(alerta) {
    var e = estado.estaciones[alerta.c_estacion];
    var sitio = alerta.c_sitio || (e && e.c_sitio);
    return (estado.lineaBase[sitio] || {})[alerta.c_parametro] || null;
  }

  // ------------------------------------------------------------ datos fijos
  Promise.all([
    getJSON('../contrato/fixtures/estaciones.json'),
    getJSON('../contrato/fixtures/linea_base.json'),
    get('../datos/procesados/red/sitio_aguas_abajo.csv').then(function (r) { return r.text(); }),
    get('../datos/procesados/red/sitio_pares.csv').then(function (r) { return r.text(); })
  ]).then(function (d) {
    d[0].estaciones.forEach(function (e) { estado.estaciones[e.c_estacion] = e; });
    d[1].linea_base.forEach(function (r) {
      if (r.temporada !== 'anual') return;
      (estado.lineaBase[r.c_sitio] = estado.lineaBase[r.c_sitio] || {})[r.c_parametro] = r;
    });
    leeCSV(d[2]).forEach(function (r) { estado.nombresSitio[r.c_sitio] = r.nombre; });
    estado.pares = leeCSV(d[3]).map(function (r) {
      return { arriba: r.c_sitio_arriba, abajo: r.c_sitio_abajo, m: parseFloat(r.distancia_cauce_m),
        saltos: parseInt(r.saltos, 10), revisar: r.revisar };
    });
    var sel = $('fEstacion');
    Object.keys(estado.estaciones).sort().forEach(function (c) {
      var o = document.createElement('option'); o.value = c; o.textContent = c.replace('EST-', '') + ' · ' + nombreEstacion(c);
      sel.appendChild(o);
    });
    consulta(); setInterval(consulta, CADA_MS);
  }).catch(function (e) {
    $('estadoBackend').textContent = 'No se pudieron leer los datos del repositorio (' + e.message +
      '). Sirve el repo desde su raíz con python -m http.server 8000.';
  });

  // ------------------------------------------------------------ backend
  function consulta() {
    var codigos = Object.keys(estado.estaciones);
    Promise.all([
      getJSON(API + '/salud'),
      getJSON(API + '/alertas'),
      getJSON(API + '/reportes'),
      Promise.all(codigos.map(function (c) {
        return getJSON(API + '/veredictos?c_estacion=' + encodeURIComponent(c));
      }))
    ]).then(function (d) {
      estado.conectado = true;
      estado.motor = d[0].motor;
      estado.alertas = d[1].alertas || [];
      estado.reportes = d[2].reportes || [];
      codigos.forEach(function (c, i) {
        // Si el backend no filtra por estación, filtramos aquí; solo es reparto, no análisis.
        estado.veredictos[c] = (d[3][i].veredictos || []).filter(function (v) { return v.c_estacion === c; });
      });
      pinta();
    }).catch(function () {
      estado.conectado = false;
      pinta();
    });
  }

  function guarda(c_alerta, cambios) {
    return fetch(API + '/alertas/' + encodeURIComponent(c_alerta), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios)
    }).then(function (r) {
      return r.json().then(function (cuerpo) {
        if (!r.ok) throw new Error(cuerpo.error + (cuerpo.detalles ? ': ' + cuerpo.detalles.join('; ') : ''));
        return cuerpo;
      });
    });
  }

  // ------------------------------------------------------------ pintado
  function pon(el, html) { if (el.__html !== html) { el.innerHTML = html; el.__html = html; } }
  function porAtender(a) { return a.estado === 'Abierta' || a.estado === 'En atencion'; }
  function etiquetaNivel(n) { return '<span class="nivel ' + esc(n) + '">' + esc(txt(n)) + '</span>'; }

  // Hora del veredicto más reciente recibido: es el corte de todo lo que se muestra (I12).
  function corte() {
    var max = '';
    Object.keys(estado.veredictos).forEach(function (c) {
      estado.veredictos[c].forEach(function (v) { if (v.fecha_hora > max) max = v.fecha_hora; });
    });
    estado.alertas.forEach(function (a) { if (a.fecha_hora > max) max = a.fecha_hora; });
    return max;
  }

  function pinta() {
    var b = $('estadoBackend');
    if (estado.conectado === false) {
      b.className = 'conexion mal';
      b.textContent = 'Sin conexión con ' + API.replace(/^https?:\/\//, '') + '. Se muestra lo último recibido.';
    } else {
      b.className = 'conexion ok';
      b.textContent = 'Conectado a ' + API.replace(/^https?:\/\//, '');
    }
    var am = $('avisoMotor');
    am.hidden = estado.motor !== 'stub';
    am.textContent = 'Motor de reglas provisional: genera alertas sin discriminar eventos reales. Las cifras sirven para probar el panel, no para decidir.';
    var activas = estado.alertas.filter(porAtender);
    $('nAlertas').textContent = activas.length ? '(' + activas.length + ')' : '';
    pintaResumen();
    if (estado.vista === 'alertas') pintaPanorama();
    pintaEstaciones();
    pintaLista();
    pintaDetalle();
    pintaAvisos();
    pintaReportes();
  }

  function pintaResumen() {
    var activas = estado.alertas.filter(porAtender);
    var criticas = activas.filter(function (a) { return a.nivel === 'Critica'; });
    var sinResp = activas.filter(function (a) { return !a.responsable; });
    var conAviso = Object.keys(estado.veredictos).filter(function (c) {
      return (estado.veredictos[c].slice(-4)).some(function (v) { return (v.avisos_tecnicos || []).length; });
    });
    var c = corte();
    var alCorte = c ? 'al ' + hora(c) : 'sin datos';
    var total = Object.keys(estado.estaciones).length;
    pon($('resumen'), [
      ['critica', criticas.length, 'Críticas por atender', alCorte],
      ['', activas.length, 'Alertas por atender', estado.alertas.length + ' en total'],
      ['', sinResp.length, 'Sin responsable', 'de las ' + activas.length + ' por atender'],
      ['', conAviso.length, 'Estaciones con falla técnica', 'de ' + total + ', en su última hora']
    ].map(function (x) {
      return '<div class="cifra ' + (x[0] && x[1] ? x[0] : '') + '"><b>' + x[1] + '</b><span>' + esc(x[2]) + '</span><small>' + esc(x[3]) + '</small></div>';
    }).join(''));
  }

  function pintaEstaciones() {
    var fs = $('fEstacion').value;
    var filas = Object.keys(estado.estaciones).sort().map(function (c) {
      var e = estado.estaciones[c];
      var vs = estado.veredictos[c] || [];
      var ultima = vs.reduce(function (m, v) { return v.fecha_hora > m ? v.fecha_hora : m; }, '');
      var act = estado.alertas.filter(function (a) { return a.c_estacion === c && porAtender(a); });
      var crit = act.filter(function (a) { return a.nivel === 'Critica'; }).length;
      var ult = vs.slice(-4), avisos = {};
      ult.forEach(function (v) { (v.avisos_tecnicos || []).forEach(function (av) { avisos[AVISO[av.tipo] || av.tipo] = 1; }); });
      var listaAv = Object.keys(avisos);
      return '<tr data-est="' + esc(c) + '"' + (fs === c ? ' class="elegida"' : '') + '>' +
        '<td><span class="codigo">' + esc(c.replace('EST-', '')) + '</span> ' + esc(nombreEstacion(c)) + '</td>' +
        '<td>' + esc(inicial(e.estado)) + '</td>' +
        '<td>' + (ultima ? esc(hora(ultima)) : '<span class="tenue">sin dato</span>') + '</td>' +
        '<td class="num">' + (act.length ? act.length + (crit ? ' <span class="nivel Critica">' + crit + ' crít.</span>' : '') : '<span class="tenue">0</span>') + '</td>' +
        '<td>' + (listaAv.length ? esc(listaAv.join(', ')) : '<span class="tenue">ninguno</span>') + '</td></tr>';
    });
    pon($('tablaEstaciones'), '<thead><tr><th>Estación</th><th>Estado</th><th>Última lectura</th><th class="num">Alertas por atender</th><th>Falla técnica (última hora)</th></tr></thead><tbody>' + filas.join('') + '</tbody>');
  }

  function filtradas() {
    var fe = $('fEstado').value, fn = $('fNivel').value, fs = $('fEstacion').value;
    return estado.alertas.filter(function (a) {
      if (fe === 'activas' && !porAtender(a)) return false;
      if (fe !== 'activas' && fe !== 'todas' && a.estado !== fe) return false;
      if (fn !== 'todos' && a.nivel !== fn) return false;
      if (fs !== 'todas' && a.c_estacion !== fs) return false;
      return true;
    }).sort(function (x, y) {
      var orden = { Critica: 0, Preventiva: 1, Informativa: 2 };
      return (orden[x.nivel] - orden[y.nivel]) || (y.fecha_hora < x.fecha_hora ? -1 : 1);
    });
  }

  function pintaLista() {
    var lista = filtradas();
    $('conteo').textContent = lista.length + ' de ' + estado.alertas.length + ' alertas';
    var ol = $('listaAlertas');
    if (!lista.length) {
      pon(ol, '<li class="vacio">' + (estado.conectado === false && !estado.alertas.length
        ? 'Sin conexión: no hay alertas que mostrar.'
        : estado.alertas.length ? 'Ninguna alerta con estos filtros.' : 'Sin alertas. Reproduce un escenario contra el backend para generar algunas.') + '</li>');
      return;
    }
    // Solo se reescribe si cambió: así el sondeo no roba el foco ni el desplazamiento.
    pon(ol, lista.map(function (a) {
      return '<li' + (a.c_alerta === estado.sel ? ' class="activa"' : '') + '><button data-id="' + esc(a.c_alerta) + '">' +
        etiquetaNivel(a.nivel) + '<span class="cuando">' + esc(hora(a.fecha_hora)) + '</span>' +
        '<span class="que">' + esc(PARAM[a.c_parametro] || a.c_parametro) + ' ' + esc(num(a.valor)) + esc(unidad(a)) + '</span>' +
        '<span class="estado">' + esc(txt(a.estado)) + '</span>' +
        '<span class="donde">' + esc(a.c_estacion.replace('EST-', '')) + ' · ' + esc(nombreEstacion(a.c_estacion)) + '</span>' +
        '<span class="estado">' + esc(a.responsable || 'sin responsable') + '</span>' +
        '</button></li>';
    }).join(''));
  }

  function alertaSel() {
    return estado.alertas.find(function (a) { return a.c_alerta === estado.sel; }) || null;
  }

  var formDe = null;   // folio cuyo estado está cargado en el formulario
  function pintaDetalle() {
    var a = alertaSel();
    $('sinSeleccion').hidden = !!a;
    $('detalle').hidden = !a;
    if (!a) return;
    var e = estado.estaciones[a.c_estacion] || {};
    var b = banda(a);
    pon($('dNivel'), etiquetaNivel(a.nivel));
    $('dFolio').textContent = 'Folio ' + a.c_alerta;
    $('dTitulo').textContent = (PARAM[a.c_parametro] || a.c_parametro) + ' fuera de lo habitual en ' + nombreEstacion(a.c_estacion);
    $('dSub').textContent = hora(a.fecha_hora) + ' · estación ' + a.c_estacion + ', sitio ' + (a.c_sitio || e.c_sitio || 'sin dato') +
      (e.municipio ? ' · ' + inicial(e.municipio) + ', ' + inicial(e.estado) : '');

    var fuera = (b && a.valor != null) ? (a.valor > b.p90 ? num(a.valor / b.p90, 1) + ' veces el p90' : a.valor < b.p10 ? 'debajo del p10 (' + num(b.p10) + ')' : 'dentro de la banda') : 'sin línea base';
    pon($('dCifras'), [
      [num(a.valor) + unidad(a), 'Valor medido'],
      [b ? num(b.p10) + ' a ' + num(b.p90) : 'sin dato', b ? 'Banda habitual del sitio · n = ' + b.n : 'Banda habitual del sitio'],
      [a.lecturas_consecutivas == null ? 'sin dato' : String(a.lecturas_consecutivas), 'Lecturas seguidas fuera · ' + fuera]
    ].map(function (x) { return '<div><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>'; }).join(''));

    // El formulario solo se rellena al cambiar de alerta, para no pisar lo que se escribe.
    if (formDe !== a.c_alerta) {
      formDe = a.c_alerta;
      $('gEstado').value = a.estado;
      $('gResponsable').value = a.responsable || '';
      $('gMensaje').textContent = '';
      $('gMensaje').className = 'nota';
    }

    pon($('dGrafica'), grafica(a, b));
    pon($('dMini'), miniaturas(a));
    pon($('dEvidencia'), [
      ['Regla que la disparó', REGLA[a.regla] || a.regla],
      ['Comparado contra', a.criterio_aplicado ? (CRITERIO[a.criterio_aplicado] || a.criterio_aplicado) : 'sin dato'],
      ['Respaldo de la banda', b ? b.n + ' mediciones de CONAGUA, ' + b.primera_fecha + ' a ' + b.ultima_fecha : 'sin línea base para este parámetro']
    ].map(function (f) { return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join(''));

    var f = a.fuente_probable;
    pon($('dFuente'), f
      ? '<dl class="datos"><dt>Tipo</dt><dd>' + esc(FUENTE[f.tipo] || f.tipo) + '</dd>' +
        '<dt>Puntaje</dt><dd>' + esc(num(f.puntaje, 2)) + ' de 1 · estimación, no diagnóstico</dd></dl>' +
        (f.evidencia && f.evidencia.length ? '<ul class="lista">' + f.evidencia.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (f.candidatos_aguas_arriba && f.candidatos_aguas_arriba.length
          ? '<table><thead><tr><th>Candidato</th><th>Giro</th><th class="num">Distancia</th></tr></thead><tbody>' +
            f.candidatos_aguas_arriba.map(function (c) {
              return '<tr><td>' + esc(c.nombre || c.c_fuente_cont) + '</td><td>' + esc(c.giro || 'sin dato') + '</td><td class="num">' +
                (c.distancia_m == null ? 'sin dato' : esc(km(c.distancia_m))) + '</td></tr>';
            }).join('') + '</tbody></table>'
          : '<p class="nota">Sin candidatos concretos: REPDA y DENUE aún no están integrados.</p>')
      : '<p class="mensaje">Sin estimación de fuente. ' + (estado.motor === 'stub' ? 'El motor provisional no la calcula.' : 'El motor no la envió.') + '</p>');

    var ms = a.medidas_sugeridas || [];
    pon($('dMedidas'), ms.length
      ? '<table><thead><tr><th>Plazo</th><th>Acción</th><th>Autoridad</th></tr></thead><tbody>' + ms.map(function (m) {
          return '<tr><td>' + esc(m.plazo === 'inmediata' ? 'Inmediata' : 'Mediano plazo') + '</td><td>' + esc(m.accion) + '</td><td>' + esc(m.autoridad || 'sin dato') + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="mensaje">Sin medidas sugeridas por el motor.</p>');

    var sitio = a.c_sitio || e.c_sitio;
    pon($('dPrediccion'), '<p class="mensaje info">Aún no hay predicción de llegada: el modelo de propagación (M3) está pendiente. ' +
      'Mientras tanto, estos son los sitios de monitoreo que quedan río abajo, por distancia sobre el cauce.</p>');
    pon($('dAbajo'), tablaRed(sitio, 'abajo'));
    pon($('dArriba'), tablaRed(sitio, 'arriba'));
  }

  // Sitios de la red río abajo o río arriba, por distancia sobre el cauce.
  function tablaRed(sitio, sentido) {
    if (!sitio) return '<p class="vacio">Sin sitio asociado.</p>';
    var mios = estado.pares.filter(function (p) { return sentido === 'abajo' ? p.arriba === sitio : p.abajo === sitio; })
      .sort(function (x, y) { return x.m - y.m; });
    if (!mios.length) return '<p class="mensaje">Ningún sitio de monitoreo ' + (sentido === 'abajo' ? 'aguas abajo' : 'aguas arriba') + ' en la topología.</p>';
    var ver = mios.slice(0, 6);
    return '<div class="tabla-desliza" style="margin-top:12px"><table><thead><tr><th>Sitio</th><th>Clave</th><th class="num">Por el cauce</th></tr></thead><tbody>' +
      ver.map(function (p) {
        var c = sentido === 'abajo' ? p.abajo : p.arriba;
        return '<tr><td>' + esc(inicial(estado.nombresSitio[c] || c)) + (p.revisar ? ' <span class="tenue">(enganche por revisar)</span>' : '') +
          '</td><td class="tenue">' + esc(c) + '</td><td class="num">' + esc(km(p.m)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="nota">' + (mios.length > ver.length ? 'Los ' + ver.length + ' más cercanos de ' + mios.length + ' sitios. ' : mios.length + ' sitios. ') +
      'Topología del río (M1), red hidrográfica del INEGI.</p>';
  }

  // Serie reciente del parámetro contra la banda histórica del sitio.
  function grafica(a, b) {
    var serie = (estado.veredictos[a.c_estacion] || []).map(function (v) {
      var p = (v.parametros || []).find(function (x) { return x.c_parametro === a.c_parametro; });
      return p && p.valor != null ? { t: new Date(v.fecha_hora).getTime(), v: p.valor } : null;
    }).filter(Boolean).sort(function (p, q) { return p.t - q.t; });   // llegan en orden de recepción
    if (serie.length < 2) return '<p class="mensaje">Sin lecturas recientes de este parámetro en el backend para graficar.</p>';
    // Se dibuja al ancho real del contenedor para que el texto no se encoja en teléfono.
    var W = Math.max(280, Math.round($('dGrafica').clientWidth || 760)), H = W < 500 ? 180 : 210, I = 44, D = 8, A = 10, B = 26;
    var t0 = serie[0].t, t1 = serie[serie.length - 1].t;
    var vals = serie.map(function (s) { return s.v; });
    if (b) vals.push(b.p10, b.p90);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    var x = function (t) { return I + (W - I - D) * (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)); };
    var y = function (v) { return A + (H - A - B) * (1 - (v - lo) / (hi - lo)); };
    var ta = new Date(a.fecha_hora).getTime(), dentro = ta >= t0 && ta <= t1;
    var s = '<div class="leyenda"><span><i style="background:var(--azul500);height:2px;vertical-align:3px"></i>Lecturas de la estación</span>' +
      (b ? '<span><i style="background:var(--azul100);border:1px solid #c9d6f5"></i>Banda habitual (p10 a p90)</span>' : '') +
      (dentro ? '<span><i style="border-left:2px dashed var(--rojo500);width:2px;height:12px"></i>Momento de la alerta</span>' : '') + '</div>';
    s += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Lecturas recientes contra la banda habitual del sitio">';
    // rejilla horizontal en 4 valores redondos
    for (var k = 0; k <= 3; k++) {
      var gv = lo + (hi - lo) * k / 3;
      s += '<line x1="' + I + '" x2="' + (W - D) + '" y1="' + y(gv) + '" y2="' + y(gv) + '" stroke="var(--neutro300)"/>';
      s += '<text x="' + (I - 8) + '" y="' + (y(gv) + 4) + '" text-anchor="end">' + esc(num(gv, gv > 100 ? 0 : 1)) + '</text>';
    }
    if (b) s += '<rect x="' + I + '" y="' + y(b.p90) + '" width="' + (W - I - D) + '" height="' + Math.max(1, y(b.p10) - y(b.p90)) + '" fill="var(--azul100)"/>';
    s += '<line x1="' + I + '" x2="' + (W - D) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--neutro500)"/>';
    if (dentro) s += '<line x1="' + x(ta) + '" x2="' + x(ta) + '" y1="' + A + '" y2="' + (H - B) + '" stroke="var(--rojo500)" stroke-width="1.5" stroke-dasharray="4 3"/>';
    s += '<polyline fill="none" stroke="var(--azul500)" stroke-width="2" stroke-linejoin="round" points="' +
      serie.map(function (p) { return x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1); }).join(' ') + '"/>';
    s += '<text x="' + I + '" y="' + (H - 6) + '">' + esc(hora(new Date(t0).toISOString())) + '</text>';
    s += '<text x="' + (W - D) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(hora(new Date(t1).toISOString())) + '</text>';
    s += '</svg>';
    return s + '<figcaption>Últimas ' + serie.length + ' lecturas de ' + esc((PARAM[a.c_parametro] || a.c_parametro).toLowerCase()) +
      (b ? ' (' + esc(b.unidad || '') + '). Banda: n = ' + b.n + ', ' + b.primera_fecha + ' a ' + b.ultima_fecha : '') +
      (dentro ? '.' : '. La alerta quedó fuera de esta ventana.') + '</figcaption>';
  }

  // ------------------------------------------------------------ gráficas
  // SVG a mano, al ancho real de su contenedor. Cada marca lleva data-tip para el tooltip
  // y la información sigue disponible en las tablas y la lista (nunca solo en el color).
  var NIVELES = ['Critica', 'Preventiva', 'Informativa'];
  var COLOR_NIVEL = { Critica: '#9B0F15', Preventiva: '#A57F2C', Informativa: '#224497' };
  var ESTADOS = ['Abierta', 'En atencion', 'Cerrada', 'Descartada'];
  var COLOR_ESTADO = { Abierta: '#611232', 'En atencion': '#BA6783', Cerrada: '#767676', Descartada: '#DDDDDD' };
  var TINTA_ESTADO = { Abierta: '#fff', 'En atencion': '#fff', Cerrada: '#fff', Descartada: '#161A1D' };

  function ancho(id, min) { return Math.max(min || 260, Math.round($(id).clientWidth || 600)); }
  function leyenda(items) {
    return '<div class="leyenda">' + items.map(function (i) {
      return '<span><i style="background:' + i[1] + '"></i>' + esc(i[0]) + '</span>';
    }).join('') + '</div>';
  }
  // Rectángulo con esquinas redondeadas solo en el extremo del dato (arriba o a la derecha).
  function barra(x, y, w, h, color, tip, extremo) {
    if (w <= 0 || h <= 0) return '';
    var r = Math.min(4, extremo === 'arriba' ? w / 2 : h / 2, extremo === 'arriba' ? h : w);
    var d = extremo === 'arriba'
      ? 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z'
      : 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
    return '<path d="' + d + '" fill="' + color + '" data-tip="' + esc(tip) + '"/>';
  }
  function plano(x, y, w, h, color, tip) {
    if (w <= 0 || h <= 0) return '';
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + color + '" data-tip="' + esc(tip) + '"/>';
  }
  function marcasEje(max) {
    var paso = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
    var tope = Math.max(paso, Math.ceil(max / paso) * paso), m = [];
    for (var v = 0; v <= tope; v += paso) m.push(v);
    return { tope: tope, marcas: m };
  }

  // Columnas apiladas por hora del día, por nivel.
  function graficaHoras() {
    var al = estado.alertas;
    if (!al.length) return '<p class="mensaje">Sin alertas todavía.</p>';
    var dia = al.reduce(function (m, a) { return a.fecha_hora.slice(0, 10) > m ? a.fecha_hora.slice(0, 10) : m; }, '');
    var bins = []; for (var h = 0; h < 24; h++) bins.push({ Critica: 0, Preventiva: 0, Informativa: 0, total: 0 });
    al.forEach(function (a) {
      if (a.fecha_hora.slice(0, 10) !== dia) return;
      var b = bins[parseInt(a.fecha_hora.slice(11, 13), 10)];
      b[a.nivel]++; b.total++;
    });
    var W = ancho('gHoras', 300), H = 210, I = 30, D = 6, A = 12, B = 24;
    var e = marcasEje(Math.max.apply(null, bins.map(function (b) { return b.total; })));
    var bw = (W - I - D) / 24, cw = Math.min(24, bw - 2);
    var y = function (v) { return A + (H - A - B) * (1 - v / e.tope); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Alertas por hora del día ' + dia + '">';
    e.marcas.forEach(function (v) {
      s += '<line x1="' + I + '" x2="' + (W - D) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#EDEDED"/>' +
        '<text x="' + (I - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    });
    bins.forEach(function (b, h) {
      var x = I + h * bw + (bw - cw) / 2, base = 0;
      var tip = (h < 10 ? '0' : '') + h + ':00 a ' + (h < 9 ? '0' : '') + (h + 1) + ':00 · ' + b.total + ' alertas' +
        (b.total ? ' (' + NIVELES.filter(function (n) { return b[n]; }).map(function (n) { return b[n] + ' ' + txt(n).toLowerCase() + (b[n] > 1 ? 's' : ''); }).join(', ') + ')' : '');
      var vis = NIVELES.filter(function (n) { return b[n]; });
      NIVELES.forEach(function (n) {
        if (!b[n]) return;
        var y0 = y(base), y1 = y(base + b[n]);
        var arriba = n === vis[vis.length - 1];
        // 2 px de hueco entre segmentos apilados
        var alto = y0 - y1 - (base > 0 ? 2 : 0);
        s += arriba ? barra(x, y1, cw, alto, COLOR_NIVEL[n], tip, 'arriba') : plano(x, y1, cw, alto, COLOR_NIVEL[n], tip);
        base += b[n];
      });
      // zona de contacto de toda la columna, más grande que la marca
      s += '<rect x="' + (I + h * bw) + '" y="' + A + '" width="' + bw + '" height="' + (H - A - B) + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
      if (h % (W < 520 ? 6 : 3) === 0) s += '<text x="' + (x + cw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + (h < 10 ? '0' : '') + h + 'h</text>';
    });
    s += '<line x1="' + I + '" x2="' + (W - D) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="#AAAAAA"/></svg>';
    return leyenda(NIVELES.map(function (n) { return [txt(n), COLOR_NIVEL[n]]; })) + s +
      '<p class="pie-graf">Día ' + esc(dia) + ', hora local de la estación. Todas las alertas, sin importar su estado.</p>';
  }

  // Barras horizontales apiladas o simples. filas: [{nombre, partes: {clave: n}, total}]
  function barrasH(id, filas, claves, colores, nombreClave, nota) {
    if (!filas.length) return '<p class="mensaje">Sin datos.</p>';
    var W = ancho(id, 260), fila = 30, Iz = Math.min(170, Math.round(W * 0.38)), D = 34;
    var H = filas.length * fila + 8;
    var max = Math.max.apply(null, filas.map(function (f) { return f.total; })) || 1;
    var x = function (v) { return (W - Iz - D) * v / max; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img">';
    filas.forEach(function (f, i) {
      var y = 4 + i * fila, h = Math.min(18, fila - 10), yb = y + (fila - h) / 2, base = 0;
      var tip = f.nombre + ' · ' + f.total + (claves.length > 1 ? ' (' + claves.filter(function (k) { return f.partes[k]; })
        .map(function (k) { return f.partes[k] + ' ' + nombreClave(k).toLowerCase() + (claves === NIVELES && f.partes[k] > 1 ? 's' : ''); }).join(', ') + ')' : '');
      s += '<text x="' + (Iz - 10) + '" y="' + (y + fila / 2 + 4) + '" text-anchor="end" class="etq">' + esc(f.nombre) + '</text>';
      var vis = claves.filter(function (k) { return f.partes[k]; });
      claves.forEach(function (k) {
        var v = f.partes[k]; if (!v) return;
        var x0 = Iz + x(base) + (base > 0 ? 2 : 0), w = x(v) - (base > 0 ? 2 : 0);
        s += k === vis[vis.length - 1] ? barra(x0, yb, w, h, colores[k], tip, 'derecha') : plano(x0, yb, w, h, colores[k], tip);
        base += v;
      });
      s += '<text x="' + (Iz + x(f.total) + 6) + '" y="' + (y + fila / 2 + 4) + '" class="valor">' + f.total + '</text>';
      s += '<rect x="0" y="' + y + '" width="' + W + '" height="' + fila + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
    });
    s += '<line x1="' + Iz + '" x2="' + Iz + '" y1="0" y2="' + H + '" stroke="#AAAAAA"/></svg>';
    return (claves.length > 1 ? leyenda(claves.map(function (k) { return [nombreClave(k), colores[k]]; })) : '') + s +
      (nota ? '<p class="pie-graf">' + esc(nota) + '</p>' : '');
  }

  function graficaPorEstacion() {
    var filas = Object.keys(estado.estaciones).sort().map(function (c) {
      var p = {}, t = 0;
      estado.alertas.forEach(function (a) { if (a.c_estacion === c && porAtender(a)) { p[a.nivel] = (p[a.nivel] || 0) + 1; t++; } });
      return { nombre: c.replace('EST-', '') + ' ' + inicial(estado.estaciones[c].cuerpo_agua), partes: p, total: t };
    });
    return barrasH('gEstacion', filas, NIVELES, COLOR_NIVEL, txt, 'Solo alertas por atender (abiertas y en atención).');
  }

  function graficaPorParametro() {
    var cuenta = {};
    estado.alertas.forEach(function (a) { cuenta[a.c_parametro] = (cuenta[a.c_parametro] || 0) + 1; });
    var filas = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; }).map(function (k) {
      return { nombre: PARAM[k] || k, partes: { n: cuenta[k] }, total: cuenta[k] };
    });
    return barrasH('gParametro', filas, ['n'], { n: '#9B2247' }, function () { return 'alertas'; },
      'Todas las alertas, por el parámetro que las disparó.');
  }

  // Barra segmentada alta: un todo (las alertas) partido en sus estados.
  function graficaAtencion() {
    var total = estado.alertas.length;
    if (!total) return '<p class="mensaje">Sin alertas todavía.</p>';
    var c = {}; ESTADOS.forEach(function (k) { c[k] = 0; });
    estado.alertas.forEach(function (a) { c[a.estado] = (c[a.estado] || 0) + 1; });
    var W = ancho('gAtencion', 260), H = 28, x = 0, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img">';
    var partes = ESTADOS.filter(function (k) { return c[k]; });
    partes.forEach(function (k, i) {
      var w = (W - 2 * (partes.length - 1)) * c[k] / total;
      var pct = Math.round(100 * c[k] / total) + ' %';
      var tip = txt(k) + ' · ' + c[k] + ' de ' + total + ' (' + pct + ')';
      s += '<rect x="' + x + '" y="0" width="' + w + '" height="' + H + '" rx="4" fill="' + COLOR_ESTADO[k] + '" data-tip="' + esc(tip) + '"/>';
      if (w > 44) s += '<text x="' + (x + 8) + '" y="18" style="fill:' + TINTA_ESTADO[k] + ';font-weight:600" pointer-events="none">' + pct + '</text>';
      x += w + 2;
    });
    s += '</svg>';
    var sin = estado.alertas.filter(function (a) { return porAtender(a) && !a.responsable; }).length;
    return leyenda(ESTADOS.map(function (k) { return [txt(k) + ' (' + c[k] + ')', COLOR_ESTADO[k]]; })) + s +
      '<p class="pie-graf">' + total + ' alertas. ' + sin + ' de las que están por atender no tienen responsable.</p>';
  }

  // Matriz estación × parámetro con la posición de la última lectura en la banda del sitio.
  // La posición la decide el backend (veredicto.posicion_en_banda); aquí solo se pinta.
  var POSICION = {
    sobre_p90: { color: '#BA6783', tinta: '#fff', txt: 'Sobre lo habitual', marca: '▲' },
    normal: { color: '#F3F3F3', tinta: '#161A1D', txt: 'Dentro de lo habitual', marca: '' },
    bajo_p10: { color: '#224497', tinta: '#fff', txt: 'Bajo lo habitual', marca: '▼' },
    sin_linea_base: { color: '#FFFFFF', tinta: '#767676', txt: 'Sin línea base', marca: '' }
  };
  var CORTO = { OD: 'Oxígeno', PH: 'pH', COND: 'Conduct.', TEMP: 'Temp.', TURB: 'Turbiedad' };
  function graficaMatriz() {
    var params = ['OD', 'PH', 'COND', 'TEMP', 'TURB'];
    var cods = Object.keys(estado.estaciones).sort();
    var cab = '<tr><th>Estación</th>' + params.map(function (p) { var u = ((estado.lineaBase[(estado.estaciones[cods[0]] || {}).c_sitio] || {})[p] || {}).unidad; return '<th class="num" title="' + esc(PARAM[p]) + '">' + esc(CORTO[p] || p) + (u ? '<br><span class="tenue">' + esc(u) + '</span>' : '') + '</th>'; }).join('') + '</tr>';
    var filas = cods.map(function (c) {
      var vs = (estado.veredictos[c] || []).slice().sort(function (a, b) { return a.fecha_hora < b.fecha_hora ? -1 : 1; });
      var ult = vs[vs.length - 1];
      return '<tr><th scope="row">' + esc(c.replace('EST-', '')) + ' <span class="tenue">' + esc(inicial(estado.estaciones[c].cuerpo_agua)) + '</span></th>' +
        params.map(function (p) {
          var it = ult && (ult.parametros || []).find(function (x) { return x.c_parametro === p; });
          if (!it || it.valor == null) return '<td class="celda sin" data-tip="' + esc(PARAM[p] + ' · sin dato') + '">sin dato</td>';
          var pos = POSICION[it.posicion_en_banda] || POSICION.sin_linea_base;
          var u = ((estado.lineaBase[estado.estaciones[c].c_sitio] || {})[p] || {}).unidad || '';
          var tip = PARAM[p] + ' ' + num(it.valor) + ' ' + u + ' · ' + pos.txt + (it.n_linea_base ? ' (banda con n = ' + it.n_linea_base + ')' : '') + ' · ' + hora(ult.fecha_hora);
          return '<td class="celda" style="background:' + pos.color + ';color:' + pos.tinta + '" data-tip="' + esc(tip) + '">' +
            (pos.marca ? '<span aria-hidden="true">' + pos.marca + '</span> ' : '') + esc(num(it.valor, it.valor > 100 ? 0 : 1)) + '</td>';
        }).join('') + '</tr>';
    }).join('');
    var c0 = corte();
    return leyenda([['Sobre lo habitual ▲', POSICION.sobre_p90.color], ['Dentro de lo habitual', '#DDDDDD'], ['Bajo lo habitual ▼', POSICION.bajo_p10.color]]) +
      '<div class="tabla-desliza"><table class="matriz">' + cab + filas + '</table></div>' +
      '<p class="pie-graf">Última lectura de cada sonda comparada con la historia de su propio sitio (p10 a p90)' + '.' + (c0 ? ' Corte: ' + esc(hora(c0)) : '') + '</p>';
  }

  function pintaPanorama() {
    pon($('gHoras'), graficaHoras());
    pon($('gMatriz'), graficaMatriz());
    pon($('gEstacion'), graficaPorEstacion());
    pon($('gParametro'), graficaPorParametro());
    pon($('gAtencion'), graficaAtencion());
  }

  // Miniaturas de los demás parámetros de la estación, cada uno contra su banda.
  function miniaturas(a) {
    var e = estado.estaciones[a.c_estacion] || {};
    var vs = (estado.veredictos[a.c_estacion] || []).slice().sort(function (p, q) { return p.fecha_hora < q.fecha_hora ? -1 : 1; });
    if (vs.length < 2) return '<p class="mensaje">Sin lecturas recientes de la estación.</p>';
    var W = Math.max(150, Math.round(($('dMini').clientWidth - 32) / ($('dMini').clientWidth > 640 ? 3 : $('dMini').clientWidth > 420 ? 2 : 1))), H = 64;
    return (e.parametros || []).map(function (p) {
      var serie = vs.map(function (v) {
        var it = (v.parametros || []).find(function (x) { return x.c_parametro === p; });
        return it && it.valor != null && it.valor > -100 ? it.valor : null;
      });
      var ok = serie.filter(function (v) { return v != null; });
      var b = (estado.lineaBase[e.c_sitio] || {})[p];
      if (!ok.length) return '<div class="mini"><p><b>' + esc(PARAM[p] || p) + '</b></p><p class="tenue">sin dato</p></div>';
      var vals = ok.concat(b ? [b.p10, b.p90] : []);
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
      var x = function (i) { return 2 + (W - 8) * i / (serie.length - 1); };
      var y = function (v) { return 4 + (H - 8) * (1 - (v - lo) / (hi - lo)); };
      var pts = [], s = '';
      serie.forEach(function (v, i) { if (v != null) pts.push(x(i).toFixed(1) + ',' + y(v).toFixed(1)); });
      if (b) s += '<rect x="0" y="' + y(b.p90) + '" width="' + W + '" height="' + Math.max(1, y(b.p10) - y(b.p90)) + '" fill="#EDF2FE"/>';
      var ultimo = ok[ok.length - 1], li = serie.lastIndexOf(ultimo);
      s += '<polyline fill="none" stroke="#224497" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(' ') + '"/>';
      s += '<circle cx="' + x(li) + '" cy="' + y(ultimo) + '" r="4" fill="#224497" stroke="#fff" stroke-width="2"/>';
      var u = b && b.unidad ? ' ' + b.unidad : '';
      var fuera = b ? (ultimo > b.p90 ? 'sobre lo habitual' : ultimo < b.p10 ? 'bajo lo habitual' : 'dentro de lo habitual') : 'sin línea base';
      return '<div class="mini' + (p === a.c_parametro ? ' actual' : '') + '" data-tip="' + esc((PARAM[p] || p) + ': última ' + num(ultimo) + u + ', ' + fuera + (b ? ' (banda ' + num(b.p10) + ' a ' + num(b.p90) + ', n = ' + b.n + ')' : '')) + '">' +
        '<p><b>' + esc(PARAM[p] || p) + '</b> <span class="tenue">' + esc(num(ultimo)) + esc(u) + '</span></p>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + s + '</svg>' +
        '<p class="nota">' + esc(fuera) + '</p></div>';
    }).join('');
  }

  // Barras para las pestañas de avisos y reportes.
  function graficaAvisos(lista) {
    var cods = Object.keys(estado.estaciones).sort(), tipos = [];
    lista.forEach(function (g) { if (tipos.indexOf(g.tipo) < 0) tipos.push(g.tipo); });
    var PAL = ['#611232', '#A57F2C', '#224497', '#51807A', '#6708C1', '#BA6783', '#767676'];
    var col = {}; Object.keys(AVISO).forEach(function (t, i) { col[t] = PAL[i % PAL.length]; });   // color fijo por tipo, no por rango
    var filas = cods.map(function (c) {
      var p = {}, t = 0;
      lista.forEach(function (g) { if (g.c === c) { p[g.tipo] = (p[g.tipo] || 0) + g.n; t += g.n; } });
      return { nombre: c.replace('EST-', '') + ' ' + inicial(estado.estaciones[c].cuerpo_agua), partes: p, total: t };
    });
    return barrasH('gAvisos', filas, tipos, col, function (k) { return AVISO[k] || k; },
      'Veces que apareció cada aviso en los últimos 50 veredictos de la estación.');
  }
  function graficaReportes() {
    var c = {};
    estado.reportes.forEach(function (r) { c[r.tipo] = (c[r.tipo] || 0) + 1; });
    var filas = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) {
      return { nombre: REPORTE[k] || k, partes: { n: c[k] }, total: c[k] };
    });
    return barrasH('gReportes', filas, ['n'], { n: '#9B2247' }, function () { return 'reportes'; }, 'Reportes recibidos por tipo.');
  }

  // Tooltip único para todo lo que tenga data-tip.
  var tip = document.createElement('div');
  tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  document.addEventListener('mousemove', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.hidden = false;
    var x = ev.clientX + 14, y = ev.clientY + 14, r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('scroll', function () { tip.hidden = true; }, true);

  function pintaAvisos() {
    // Agrupa por estación, tipo y parámetro: cuántas veces en la ventana y cuándo fue la última.
    var grupos = {};
    Object.keys(estado.veredictos).forEach(function (c) {
      estado.veredictos[c].forEach(function (v) {
        (v.avisos_tecnicos || []).forEach(function (av) {
          var k = c + '|' + av.tipo + '|' + (av.c_parametro || '');
          var g = grupos[k] = grupos[k] || { c: c, tipo: av.tipo, p: av.c_parametro, n: 0, ultima: '', detalle: '', total: estado.veredictos[c].length };
          g.n++;
          if (v.fecha_hora > g.ultima) { g.ultima = v.fecha_hora; g.detalle = av.detalle; }
        });
      });
    });
    var lista = Object.keys(grupos).map(function (k) { return grupos[k]; })
      .sort(function (x, y) { return y.ultima < x.ultima ? -1 : 1; });
    $('nAvisos').textContent = lista.length ? '(' + lista.length + ')' : '';
    if (estado.vista === 'avisos') pon($('gAvisos'), lista.length ? graficaAvisos(lista) : '');
    $('tablaAvisos').innerHTML = !lista.length
      ? '<p class="vacio">' + (estado.conectado === false ? 'Sin conexión con el backend.' : 'Sin avisos técnicos en los veredictos recientes.') + '</p>'
      : '<table><thead><tr><th>Estación</th><th>Aviso</th><th>Parámetro</th><th class="num">Veces</th><th>Última</th><th>Detalle</th></tr></thead><tbody>' +
        lista.map(function (g) {
          return '<tr><td>' + esc(g.c.replace('EST-', '')) + ' ' + esc(nombreEstacion(g.c)) + '</td><td>' + esc(AVISO[g.tipo] || g.tipo) + '</td><td>' +
            esc(g.p ? (PARAM[g.p] || g.p) : 'dispositivo') + '</td><td class="num">' + g.n + ' de ' + g.total + '</td><td>' + esc(hora(g.ultima)) + '</td><td>' + esc(g.detalle) + '</td></tr>';
        }).join('') + '</tbody></table>';
  }

  function pintaReportes() {
    var r = estado.reportes.slice().sort(function (x, y) { return y.fecha_hora < x.fecha_hora ? -1 : 1; });
    $('nReportes').textContent = r.length ? '(' + r.length + ')' : '';
    if (estado.vista === 'reportes') pon($('gReportes'), r.length ? graficaReportes() : '');
    $('tablaReportes').innerHTML = !r.length
      ? '<p class="vacio">' + (estado.conectado === false ? 'Sin conexión con el backend.' : 'Sin reportes ciudadanos.') + '</p>'
      : '<table><thead><tr><th>Folio</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Sitio asignado</th><th>Estado</th></tr></thead><tbody>' +
        r.map(function (x) {
          return '<tr><td>' + esc(x.c_reporte) + '</td><td>' + esc(hora(x.fecha_hora)) + '</td><td>' + esc(REPORTE[x.tipo] || x.tipo) + '</td><td>' +
            esc(x.descripcion || 'sin descripción') + '</td><td>' + esc(x.c_sitio_asignado || 'sin asignar') +
            (x.c_alerta_relacionada ? '<br><span class="tenue">alerta ' + esc(x.c_alerta_relacionada) + '</span>' : '') + '</td><td>' + esc(txt(x.estado)) + '</td></tr>';
        }).join('') + '</tbody></table>';
  }

  // ------------------------------------------------------------ eventos
  $('listaAlertas').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-id]');
    if (!b) return;
    estado.sel = b.getAttribute('data-id');
    pintaLista(); pintaDetalle();
    $('expediente').scrollTop = 0;
    if (matchMedia('(max-width: 1000px)').matches) $('expediente').scrollIntoView();   // en teléfono va debajo de la lista
  });
  ['fEstado', 'fNivel'].forEach(function (id) { $(id).addEventListener('change', pintaLista); });
  $('fEstacion').addEventListener('change', function () { pintaLista(); pintaEstaciones(); });
  $('tablaEstaciones').addEventListener('click', function (ev) {
    var tr = ev.target.closest('tr[data-est]');
    if (!tr) return;
    var c = tr.getAttribute('data-est');
    $('fEstacion').value = $('fEstacion').value === c ? 'todas' : c;
    pintaLista(); pintaEstaciones();
  });

  $('formGestion').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var a = alertaSel(); if (!a) return;
    var msg = $('gMensaje'), btn = ev.target.querySelector('button');
    btn.disabled = true; msg.className = 'nota'; msg.textContent = 'Guardando.';
    guarda(a.c_alerta, { estado: $('gEstado').value, responsable: $('gResponsable').value.trim() || null })
      .then(function (nueva) {
        Object.assign(a, nueva);
        msg.className = 'nota bien';
        msg.textContent = 'Guardado: ' + txt(nueva.estado) + (nueva.responsable ? ', a cargo de ' + nueva.responsable : ', sin responsable') + '.';
        pintaLista(); pintaResumen(); pintaPanorama(); pintaEstaciones();
      })
      .catch(function (e) { msg.className = 'nota mal'; msg.textContent = 'No se guardó: ' + e.message; })
      .then(function () { btn.disabled = false; });
  });

  document.querySelectorAll('.subnav button').forEach(function (b) {
    b.addEventListener('click', function () {
      estado.vista = b.getAttribute('data-vista');
      document.querySelectorAll('.subnav button').forEach(function (x) { x.classList.toggle('activa', x === b); });
      ['alertas', 'avisos', 'reportes'].forEach(function (v) { $('vista-' + v).hidden = v !== estado.vista; });
      pinta();   // las gráficas se dibujan al ancho de la pestaña que se ve
    });
  });

  // Al cambiar el ancho se vuelve a dibujar la gráfica a su nuevo tamaño.
  var esperaAncho = null;
  window.addEventListener('resize', function () { clearTimeout(esperaAncho); esperaAncho = setTimeout(pinta, 150); });

  window.panelAtoyac = estado;   // para depurar desde la consola
})();

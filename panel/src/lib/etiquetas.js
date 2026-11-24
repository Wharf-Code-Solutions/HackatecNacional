// Textos para la pantalla. Los códigos son los del contrato v1.0.
export const PARAM = {
  OD: 'Oxígeno disuelto', PH: 'pH', COND: 'Conductividad', TEMP: 'Temperatura',
  TURB: 'Turbiedad', SDT: 'Sólidos disueltos totales',
};
export const PARAM_CORTO = { OD: 'Oxígeno', PH: 'pH', COND: 'Conduct.', TEMP: 'Temp.', TURB: 'Turbiedad' };
export const REGLA = {
  umbral_fijo: 'Umbral fijo', desviacion_linea_base: 'Desviación de la línea base del sitio',
  persistencia: 'Persistencia', cambio_brusco: 'Cambio brusco',
};
export const CRITERIO = {
  CONAGUA_SUP: 'Escala de calidad de CONAGUA', NOM001_2021_RIO: 'NOM-001-SEMARNAT-2021, río',
  NOM001_2021_EMBALSE: 'NOM-001-SEMARNAT-2021, embalse', LINEA_BASE_SITIO: 'Historia del propio sitio',
};
export const FUENTE = {
  aguas_residuales_municipales: 'Aguas residuales municipales', descarga_industrial: 'Descarga industrial',
  escurrimiento_o_arrastre: 'Escurrimiento o arrastre', mixta: 'Mixta', indeterminada: 'Indeterminada',
};
export const AVISO = {
  valor_imposible: 'Valor imposible', lectura_congelada: 'Lectura congelada', salto_imposible: 'Salto imposible',
  bateria_baja: 'Batería baja', enlace_marginal: 'Enlace marginal', sin_reporte: 'Sin reporte',
  posible_deriva: 'Posible deriva',
};
export const REPORTE = {
  descarga_visible: 'Descarga visible', espuma: 'Espuma', color_anormal: 'Color anormal', mal_olor: 'Mal olor',
  basura_o_residuos: 'Basura o residuos', peces_muertos: 'Peces muertos', otro: 'Otro',
};
// Estados de un reporte ciudadano, en el orden en que avanza la atención.
export const ESTADOS_REPORTE = ['Recibido', 'Validado', 'En atencion', 'Cerrado', 'Descartado'];
export const REPORTE_ABIERTO = (e) => !['Cerrado', 'Descartado'].includes(e);
const CON_ACENTO = { 'En atencion': 'En atención', Critica: 'Crítica' };
export const txt = (v) => CON_ACENTO[v] || v;

// Colores de las gráficas. Paleta del Sistema Nacional de Diseño (D22), validada para
// daltonismo: el nivel siempre va escrito junto al color.
export const NIVELES = ['Critica', 'Preventiva', 'Informativa'];
export const COLOR_NIVEL = { Critica: '#9B0F15', Preventiva: '#A57F2C', Informativa: '#224497' };
export const ESTADOS = ['Abierta', 'En atencion', 'Cerrada', 'Descartada'];
export const COLOR_ESTADO = { Abierta: '#611232', 'En atencion': '#BA6783', Cerrada: '#767676', Descartada: '#DDDDDD' };
export const TINTA_ESTADO = { Abierta: '#fff', 'En atencion': '#fff', Cerrada: '#fff', Descartada: '#161A1D' };
// Un color fijo por tipo de aviso: no cambia si cambia el número de tipos.
const PAL_AVISO = ['#611232', '#A57F2C', '#224497', '#51807A', '#6708C1', '#BA6783', '#767676'];
export const COLOR_AVISO = Object.fromEntries(Object.keys(AVISO).map((k, i) => [k, PAL_AVISO[i % PAL_AVISO.length]]));
export const POSICION = {
  sobre_p90: { color: '#BA6783', tinta: '#fff', txt: 'Sobre lo habitual', marca: '▲' },
  normal: { color: '#F3F3F3', tinta: '#161A1D', txt: 'Dentro de lo habitual', marca: '' },
  bajo_p10: { color: '#224497', tinta: '#fff', txt: 'Bajo lo habitual', marca: '▼' },
  sin_linea_base: { color: '#FFFFFF', tinta: '#767676', txt: 'Sin línea base', marca: '' },
};

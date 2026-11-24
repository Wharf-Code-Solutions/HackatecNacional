// Textos que la app muestra. Los códigos del contrato no se muestran tal cual.
export const TIPOS = [
  ['descarga_visible', 'Descarga visible', 'Un tubo o canal que vierte al río'],
  ['espuma', 'Espuma', 'Sobre el agua o en la orilla'],
  ['color_anormal', 'Color anormal', 'El agua se ve de un color que no es el de siempre'],
  ['mal_olor', 'Mal olor', 'Huele a químico, a drenaje o a algo fuera de lo normal'],
  ['basura_o_residuos', 'Basura o residuos', 'Desechos tirados en el cauce o la orilla'],
  ['peces_muertos', 'Peces muertos', 'Peces o animales muertos en el agua'],
];
// 'otro' ya no se ofrece (una foto sin tipo claro no se puede validar), pero el contrato lo sigue aceptando
// y puede haber reportes viejos con ese tipo.
export const nombreTipo = (c) => (c === 'otro' ? 'Otro' : (TIPOS.find((t) => t[0] === c) || [c, c])[1]);

export const ESTADOS = {
  Recibido: 'Recibido',
  Validado: 'Validado',
  'En atencion': 'En atención',
  Cerrado: 'Cerrado',
  Descartado: 'Descartado',
};

export const fechaCorta = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? 'sin fecha' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fechaHora = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? 'sin fecha' : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const km = (m) => (m < 1000 ? 'a ' + Math.round(m / 10) * 10 + ' m' : 'a ' + (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km');

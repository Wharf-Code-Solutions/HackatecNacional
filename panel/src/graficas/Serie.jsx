import { useAncho } from '../lib/datos.js';
import { COLOR_NIVEL, LADERA, PARAM, UNIDAD_LADERA } from '../lib/etiquetas.js';
import { useDatos } from '../lib/contexto.js';
import { hora, num } from '../lib/formato.js';
import { Leyenda, Mensaje } from './marcas.jsx';

// El evento al que pertenece una alerta: las alertas de la misma estacion encadenadas con menos de
// 90 min entre una y la siguiente. Asi, aunque se abra una alerta tardia (el motor sigue avisando
// mientras el valor regresa), la grafica muestra desde donde empezo el fenomeno.
const HUECO = 90 * 60000;
function evento(alerta, alertas) {
  const ts = (alertas || []).filter((x) => x.c_estacion === alerta.c_estacion)
    .map((x) => new Date(x.fecha_hora).getTime()).sort((p, q) => p - q);
  const t = new Date(alerta.fecha_hora).getTime();
  if (!ts.includes(t)) ts.push(t), ts.sort((p, q) => p - q);
  let i = ts.indexOf(t), j = i;
  while (i > 0 && ts[i] - ts[i - 1] <= HUECO) i--;
  while (j < ts.length - 1 && ts[j + 1] - ts[j] <= HUECO) j++;
  return { desde: ts[i], hasta: ts[j], n: j - i + 1 };
}

// Serie reciente de un parámetro contra la banda histórica del sitio, con el momento de la alerta.
export default function Serie({ alerta, alertas, parametro, banda, veredictos }) {
  const cp = parametro || alerta.c_parametro;
  const [ref, W] = useAncho(280);
  const { umbralesDe } = useDatos();
  const ladera = LADERA.includes(cp);
  let serie = (veredictos || []).map((v) => {
    const p = (v.parametros || []).find((x) => x.c_parametro === cp);
    return p && p.valor != null && p.valor > -100 ? { t: new Date(v.fecha_hora).getTime(), v: p.valor } : null;
  }).filter(Boolean).sort((p, q) => p.t - q.t);   // llegan en orden de recepción
  // Ladera (docs/20): sin línea base; se grafica contra los umbrales del motor. La lluvia llega por paquete:
  // se acumula en la misma ventana que usó la alerta (24 o 72 h), que es lo que compara el motor.
  const ventana = alerta.criterio_aplicado === 'UMBRAL_LLUVIA_72H' && cp === alerta.c_parametro ? 72 : 24;
  if (cp === 'LLUVIA') {
    const ms = ventana * 3600000;
    serie = serie.map((p, i) => ({ t: p.t, v: serie.slice(0, i + 1).filter((q) => q.t > p.t - ms).reduce((s, q) => s + q.v, 0) }));
  }
  if (cp === 'INCL') serie = serie.map((p) => ({ t: p.t, v: Math.abs(p.v) }));
  const umbrales = ladera ? umbralesDe(alerta.c_estacion, cp, ventana) : [];
  if (serie.length < 2) {
    return <div ref={ref}><Mensaje>Sin lecturas recientes de este parámetro en el backend para graficar.</Mensaje></div>;
  }
  const H = W < 500 ? 180 : 210, I = 44, D = 8, A = 10, B = 26;
  const t0 = serie[0].t, t1 = serie[serie.length - 1].t;
  // Los umbrales entran en la escala solo si quedan cerca de los datos (el crítico de lluvia puede estar muy arriba).
  const maxDato = Math.max(...serie.map((s) => s.v));
  const umbVis = umbrales.filter((u) => u.valor <= Math.max(maxDato * 1.6, umbrales[0] ? umbrales[0].valor : 0));
  const vals = serie.map((s) => s.v).concat(banda && !ladera ? [banda.p10, banda.p90] : []).concat(umbVis.map((u) => u.valor));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  if (ladera) lo = Math.max(0, lo);   // lluvia, humedad e inclinación absoluta no bajan de cero
  const x = (t) => I + (W - I - D) * (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0));
  const y = (v) => A + (H - A - B) * (1 - (v - lo) / (hi - lo));
  const ta = new Date(alerta.fecha_hora).getTime();
  const dentro = ta >= t0 && ta <= t1;
  const ev = evento(alerta, alertas);
  const evA = Math.max(ev.desde, t0), evB = Math.min(ev.hasta, t1);
  const verEv = ev.n > 1 && evB >= evA;
  const tarde = ev.n > 1 && ev.desde < ta;
  const nombre = PARAM[cp] || cp;
  return (
    <div ref={ref} className="lienzo">
      <Leyenda items={[
        ['Lecturas de la estación', '#224497', { height: 2, verticalAlign: 3 }],
        ...(banda && !ladera ? [['Banda habitual (p10 a p90)', '#EDF2FE', { border: '1px solid #c9d6f5' }]] : []),
        ...umbVis.map((u) => ['Umbral ' + u.etiqueta.toLowerCase() + ' (' + num(u.valor, 1) + ' ' + UNIDAD_LADERA[cp] + ')', 'transparent', { borderTop: '2px dashed ' + (COLOR_NIVEL[u.nivel] || '#767676'), width: 14, height: 0, verticalAlign: 3 }]),
        ...(verEv ? [['Evento: de la primera a la última alerta (' + ev.n + ')', 'rgba(155,15,21,0.10)', { border: '1px solid rgba(155,15,21,0.35)' }]] : []),
        ...(dentro ? [['Momento de esta alerta', 'transparent', { borderLeft: '2px dashed #9B0F15', width: 2, height: 12 }]] : []),
      ]} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Lecturas recientes contra la banda habitual del sitio">
        {[0, 1, 2, 3].map((k) => {
          const gv = lo + (hi - lo) * k / 3;
          return (
            <g key={k}>
              <line x1={I} x2={W - D} y1={y(gv)} y2={y(gv)} stroke="#F3F3F3" />
              <text x={I - 8} y={y(gv) + 4} textAnchor="end">{num(gv, gv > 100 ? 0 : 1)}</text>
            </g>
          );
        })}
        {umbVis.map((u) => <line key={u.etiqueta} x1={I} x2={W - D} y1={y(u.valor)} y2={y(u.valor)} stroke={COLOR_NIVEL[u.nivel] || '#767676'} strokeWidth="1.5" strokeDasharray="6 4" />)}
        {banda && !ladera && <rect x={I} y={y(banda.p90)} width={W - I - D} height={Math.max(1, y(banda.p10) - y(banda.p90))} fill="#EDF2FE" />}
        {verEv && <rect x={x(evA)} y={A} width={Math.max(2, x(evB) - x(evA))} height={H - A - B} fill="rgba(155,15,21,0.10)" />}
        {verEv && ev.desde >= t0 && <line x1={x(ev.desde)} x2={x(ev.desde)} y1={A} y2={H - B} stroke="#9B0F15" strokeWidth="1" opacity="0.5" />}
        <line x1={I} x2={W - D} y1={H - B} y2={H - B} stroke="#AAAAAA" />
        {dentro && <line x1={x(ta)} x2={x(ta)} y1={A} y2={H - B} stroke="#9B0F15" strokeWidth="1.5" strokeDasharray="4 3" />}
        <polyline fill="none" stroke="#224497" strokeWidth="2" strokeLinejoin="round"
          points={serie.map((p) => x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ')} />
        <text x={I} y={H - 6}>{hora(new Date(t0).toISOString())}</text>
        <text x={W - D} y={H - 6} textAnchor="end">{hora(new Date(t1).toISOString())}</text>
      </svg>
      <p className="pie-graf">
        {ladera ? <>Últimas {serie.length} lecturas: {cp === 'LLUVIA' ? 'lluvia acumulada en ' + ventana + ' h' : cp === 'INCL' ? 'cambio de inclinación (valor absoluto)' : nombre.toLowerCase()}</> : <>Últimas {serie.length} lecturas de {nombre.toLowerCase()}</>}
        {banda ? ` (${banda.unidad || ''}). Banda: n = ${banda.n}, ${banda.primera_fecha} a ${banda.ultima_fecha}` : ''}
        {dentro ? '.' : '. La alerta quedó fuera de esta ventana.'}
        {ladera ? ' Umbrales del motor; son hipótesis.' : ''}
        {tarde ? ` El evento empezó ${hora(new Date(ev.desde).toISOString())}; esta alerta es posterior.` : ''}
      </p>
    </div>
  );
}

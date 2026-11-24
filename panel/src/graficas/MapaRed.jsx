import { useAncho } from '../lib/datos.js';
import { COLOR_NIVEL, NIVELES, txt } from '../lib/etiquetas.js';
import { horaCorta, inicial, porAtender } from '../lib/formato.js';
import { Leyenda } from './marcas.jsx';

// Pluma: cuanto antes llega, mas oscuro (escala ordinal de la gama guinda del SND).
const PLUMA = [
  [1, '#611232', 'en menos de 1 h'],
  [6, '#9B2247', '1 a 6 h'],
  [24, '#BA6783', '6 a 24 h'],
  [Infinity, '#E1BDC9', 'más de 24 h'],
];
const colorPluma = (h) => PLUMA.find(([lim]) => h < lim)[1];
const GROSOR_RIO = { 5: 0.7, 6: 1.3, 7: 2.2 };

function caja(puntos, margen) {
  const lons = puntos.map((p) => p[0]), lats = puntos.map((p) => p[1]);
  let [o, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const dl = Math.max(e - o, 0.12) * margen, dt = Math.max(n - s, 0.12) * margen;
  return { o: o - dl, e: e + dl, s: s - dt, n: n + dt };
}

// Mapa esquematico de la red: rios de orden >= 5 (INEGI), sitios oficiales (CONAGUA) y las 5
// estaciones. Con `pluma` = { destinos, inicio } (prediccion de M3 y hora de la alerta) pinta a
// que sitios llega la contaminacion y cuando, con `origen` (la estacion de la alerta).
export default function MapaRed({ estaciones, sitios, rios, alertas, pluma, origen, alto }) {
  const [ref, W] = useAncho(280);
  const cods = Object.keys(estaciones).sort();
  const pts = cods.map((c) => [estaciones[c].longitud, estaciones[c].latitud]);
  const destinos = ((pluma && pluma.destinos) || []).filter((d) => sitios[d.c_sitio_destino])
    .map((d) => ({ d, lon: sitios[d.c_sitio_destino].lon, lat: sitios[d.c_sitio_destino].lat }));
  const b = caja(pluma ? [...destinos.map((x) => [x.lon, x.lat]), ...(origen ? [[origen.longitud, origen.latitud]] : [])] : pts,
    pluma ? 0.12 : 0.22);
  const kx = Math.cos(((b.s + b.n) / 2) * Math.PI / 180);
  const H = alto || Math.round(Math.min(W * 0.95, 460));
  const esc = Math.min(W / ((b.e - b.o) * kx), H / (b.n - b.s));
  const ox = (W - (b.e - b.o) * kx * esc) / 2, oy = (H - (b.n - b.s) * esc) / 2;
  const x = (lon) => ox + (lon - b.o) * kx * esc;
  const y = (lat) => oy + (b.n - lat) * esc;
  // barra de escala: 5 o 10 km
  const kmPorPx = 111.32 / esc;
  const kmBarra = kmPorPx * 120 > 12 ? 10 : 5;
  const pxBarra = kmBarra / kmPorPx;

  const peorNivel = (c) => {
    const act = alertas.filter((a) => a.c_estacion === c && porAtender(a));
    return NIVELES.find((n) => act.some((a) => a.nivel === n)) || null;
  };
  const t0 = pluma ? new Date(pluma.inicio).getTime() : 0;

  return (
    <div ref={ref} className="lienzo mapa-red">
      {pluma
        ? <Leyenda items={PLUMA.map(([, c, t]) => ['Llega ' + t, c])} />
        : <Leyenda items={NIVELES.map((n) => ['Alerta ' + txt(n).toLowerCase(), COLOR_NIVEL[n]])} />}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={pluma ? 'Mapa de los sitios aguas abajo a los que llegaría la contaminación' : 'Mapa de la red de estaciones'}>
        <defs><clipPath id={pluma ? 'cortePluma' : 'corteRed'}><rect width={W} height={H} rx="4" /></clipPath></defs>
        <rect width={W} height={H} rx="4" fill="#F9F9F9" />
        <g clipPath={`url(#${pluma ? 'cortePluma' : 'corteRed'})`}>
          {rios.map((r, i) => (
            <polyline key={i} fill="none" stroke="#7FA6D6" strokeWidth={GROSOR_RIO[r.o] || 0.7} strokeLinejoin="round"
              strokeLinecap="round" points={r.c.map(([lo, la]) => x(lo).toFixed(1) + ',' + y(la).toFixed(1)).join(' ')} />
          ))}
          {Object.entries(sitios).map(([c, s]) => {
            const px = x(s.lon), py = y(s.lat);
            if (px < -5 || px > W + 5 || py < -5 || py > H + 5) return null;
            return <circle key={c} cx={px} cy={py} r="2.2" fill="#AAAAAA" data-tip={inicial(s.nombre) + ' · sitio oficial ' + c} />;
          })}
          {destinos.map(({ d, lon, lat }) => {
            const h = (new Date(d.llegada_estimada.desde).getTime() - t0) / 3600000;
            return (
              <circle key={d.c_sitio_destino} cx={x(lon)} cy={y(lat)} r="5.5" fill={colorPluma(h)} stroke="#fff" strokeWidth="1.5"
                data-tip={`${inicial(d.nombre || d.c_sitio_destino)} · llega entre ${horaCorta(d.llegada_estimada.desde, pluma.inicio)} y ${horaCorta(d.llegada_estimada.hasta, pluma.inicio)}`} />
            );
          })}
          {(pluma ? (origen ? [origen] : []) : cods.map((c) => estaciones[c])).map((e) => {
            const c = e.c_estacion, n = peorNivel(c), px = x(e.longitud), py = y(e.latitud);
            const etiqueta = c.replace('EST-ATY-0', '');
            const tip = `${c} ${inicial(e.cuerpo_agua)}, ${inicial(e.municipio)}` +
              (n ? ` · alerta ${txt(n).toLowerCase()} abierta` : ' · sin alertas abiertas');
            return (
              <g key={c} data-tip={tip}>
                {n && <circle cx={px} cy={py} r="15" fill="none" stroke={COLOR_NIVEL[n]} strokeWidth="3" />}
                <circle cx={px} cy={py} r="10" fill="#161A1D" stroke="#fff" strokeWidth="2" />
                <text x={px} y={py + 4} textAnchor="middle" className="num-estacion">{etiqueta}</text>
                {!pluma && W > 420 && (
                  <text x={px + 19} y={py + 4} className="etq-mapa">{inicial(e.cuerpo_agua)}</text>
                )}
              </g>
            );
          })}
        </g>
        <g transform={`translate(12, ${H - 16})`}>
          <line x1="0" x2={pxBarra} y1="0" y2="0" stroke="#434343" strokeWidth="2" />
          <line x1="0" x2="0" y1="-4" y2="4" stroke="#434343" />
          <line x1={pxBarra} x2={pxBarra} y1="-4" y2="4" stroke="#434343" />
          <text x={pxBarra + 6} y="4" className="etq-mapa">{kmBarra} km</text>
        </g>
      </svg>
    </div>
  );
}

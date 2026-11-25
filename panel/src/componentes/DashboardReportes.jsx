import { useMemo, useState } from 'react';
import { REPORTE, txt } from '../lib/etiquetas.js';
import { hora, inicial } from '../lib/formato.js';
import { useDatos } from '../lib/contexto.js';

// Estadísticas de los reportes ciudadanos, con la forma del «Dashboard» de SIGRIV
// (Wharf-Code-Solutions/HackatecRegional, src/components/DashboardInfo.jsx): periodo, filtros, indicadores,
// dona por estado y barras. Se calcula aquí con lo que ya trae el backend (GET /reportes y GET /prioridades):
// solo es conteo, no análisis. Diferencias con SIGRIV: «colonias» son los puntos de monitoreo a los que el
// backend asignó cada reporte (y su municipio sale de ese sitio); el tiempo de atención no existe porque el
// backend no guarda cuándo se cerró un reporte, así que en su lugar van los focos con alerta de una estación.

const RANGOS = [
  { id: '7', etiqueta: '7 días', dias: 7 },
  { id: '30', etiqueta: '30 días', dias: 30 },
  { id: '90', etiqueta: '90 días', dias: 90 },
  { id: 'todo', etiqueta: 'Todo', dias: null },
];
const ESTADOS = [
  { id: 'Recibido', color: '#BC955C' },
  { id: 'Validado', color: '#8a6d3b' },
  { id: 'En atencion', color: '#2F6F9F' },
  { id: 'Cerrado', color: '#13322E' },
  { id: 'Descartado', color: '#9D2449' },
];
const ABIERTOS = ['Recibido', 'Validado', 'En atencion'];

function Dona({ cuenta, total }) {
  const R = 52, C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <svg viewBox="0 0 140 140" className="dashinfo-dona" role="img" aria-label="Reportes por estado">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#eee" strokeWidth="20" />
      {total > 0 && ESTADOS.map((e) => {
        const largo = (cuenta[e.id] / total) * C;
        const el = (
          <circle key={e.id} cx="70" cy="70" r={R} fill="none" stroke={e.color} strokeWidth="20"
            strokeDasharray={largo + ' ' + (C - largo)} strokeDashoffset={-acumulado} transform="rotate(-90 70 70)" />
        );
        acumulado += largo;
        return el;
      })}
      <text x="70" y="68" textAnchor="middle" className="dashinfo-dona-num">{total}</text>
      <text x="70" y="86" textAnchor="middle" className="dashinfo-dona-txt">reportes</text>
    </svg>
  );
}

function Barras({ filas, color }) {
  const max = Math.max(1, ...filas.map((f) => f.total));
  if (!filas.length) return <p className="dashinfo-vacio">Sin datos en este periodo</p>;
  return (
    <ul className="dashinfo-barras">
      {filas.map((f) => (
        <li key={f.clave}>
          <div className="dashinfo-barra-info">
            <span className="dashinfo-barra-nombre">{f.nombre}{f.sub && <small> · {f.sub}</small>}</span>
            <strong>{f.total}</strong>
          </div>
          <div className="dashinfo-pista"><span style={{ width: (f.total / max) * 100 + '%', background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardReportes({ reportes, prioridades, onVolver }) {
  const { sitios, nombresSitio } = useDatos();
  const [rango, setRango] = useState('30');
  const [municipio, setMunicipio] = useState('');
  const [tipo, setTipo] = useState('');
  const municipioDe = (r) => (sitios[r.c_sitio_asignado] || {}).municipio || null;

  const municipios = useMemo(() => [...new Set(reportes.map(municipioDe).filter(Boolean))].sort(), [reportes]); // eslint-disable-line react-hooks/exhaustive-deps
  const tipos = useMemo(() => [...new Set(reportes.map((r) => r.tipo))].sort((a, b) => (REPORTE[a] || a).localeCompare(REPORTE[b] || b)), [reportes]);

  const dias = RANGOS.find((r) => r.id === rango).dias;
  const desde = dias ? Date.now() - dias * 86400000 : null;
  const filtrados = reportes.filter((r) => (!desde || Date.parse(r.fecha_hora) >= desde)
    && (!municipio || municipioDe(r) === municipio) && (!tipo || r.tipo === tipo));
  const folios = new Set(filtrados.map((r) => r.c_reporte));
  // Un foco cuenta si alguno de sus reportes pasa los filtros
  const focos = (prioridades || []).filter((p) => p.c_reportes.some((c) => folios.has(c)));

  const cuenta = Object.fromEntries(ESTADOS.map((e) => [e.id, 0]));
  filtrados.forEach((r) => { cuenta[r.estado] = (cuenta[r.estado] || 0) + 1; });
  const total = filtrados.length;
  const validos = total - cuenta.Descartado;
  const fechas = filtrados.map((r) => r.fecha_hora).sort();

  const porTipo = {};
  filtrados.forEach((r) => {
    const f = porTipo[r.tipo] || (porTipo[r.tipo] = { clave: r.tipo, nombre: REPORTE[r.tipo] || r.tipo, total: 0, activos: 0 });
    f.total += 1;
    if (ABIERTOS.includes(r.estado)) f.activos += 1;
  });
  const filasTipo = Object.values(porTipo).sort((a, b) => b.total - a.total).map((f) => ({ ...f, sub: f.activos + (f.activos === 1 ? ' activo' : ' activos') }));

  const porSitio = {};
  filtrados.forEach((r) => {
    const c = r.c_sitio_asignado || 'sin';
    const f = porSitio[c] || (porSitio[c] = {
      clave: c, total: 0,
      nombre: c === 'sin' ? 'Sin punto de monitoreo aguas abajo' : nombresSitio[c] || c,
      sub: c === 'sin' ? null : inicial(municipioDe(r) || '') || null,
    });
    f.total += 1;
  });
  const filasSitio = Object.values(porSitio).sort((a, b) => b.total - a.total).slice(0, 8);

  const tarjetas = [
    { etiqueta: 'Reportes', valor: total },
    { etiqueta: 'Focos activos', valor: focos.length },
    { etiqueta: 'Urgentes activos', valor: focos.filter((p) => p.banda === 'Alta').length, alerta: focos.some((p) => p.banda === 'Alta') },
    { etiqueta: '% cerrados', valor: validos > 0 ? Math.round((cuenta.Cerrado / validos) * 100) + '%' : 'sin dato' },
    { etiqueta: 'Con alerta de una estación', valor: focos.filter((p) => p.desglose && p.desglose.sensor > 0).length },
  ];

  return (
    <section className="dashinfo">
      <div className="dashinfo-contenido">
        <header className="dashinfo-cabecera">
          <div>
            <button type="button" className="dashinfo-volver" onClick={onVolver}>← Incidencias</button>
            <h2>Estadísticas de reportes</h2>
            <p className="dashinfo-corte">
              {total ? total + (total === 1 ? ' reporte' : ' reportes') + ', del ' + hora(fechas[0]) + ' al ' + hora(fechas[fechas.length - 1]) : 'Sin reportes con estos filtros'}
            </p>
          </div>
          <div className="dashinfo-filtros">
            <div className="dashinfo-rangos" role="group" aria-label="Periodo">
              {RANGOS.map((r) => (
                <button key={r.id} type="button" className={rango === r.id ? 'activo' : ''} onClick={() => setRango(r.id)}>{r.etiqueta}</button>
              ))}
            </div>
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} aria-label="Municipio">
              <option value="">Todos los municipios</option>
              {municipios.map((m) => <option key={m} value={m}>{inicial(m)}</option>)}
            </select>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de problema">
              <option value="">Todos los tipos</option>
              {tipos.map((t) => <option key={t} value={t}>{REPORTE[t] || t}</option>)}
            </select>
          </div>
        </header>

        <div className="dashinfo-kpis">
          {tarjetas.map((t) => (
            <div key={t.etiqueta} className={'dashinfo-kpi' + (t.alerta ? ' alerta' : '')}>
              <strong>{t.valor}</strong>
              <span>{t.etiqueta}</span>
            </div>
          ))}
        </div>

        <div className="dashinfo-rejilla">
          <article className="dashinfo-panel">
            <h3>Por estado</h3>
            <div className="dashinfo-estado">
              <Dona cuenta={cuenta} total={total} />
              <ul className="dashinfo-leyenda">
                {ESTADOS.map((e) => (
                  <li key={e.id}><i style={{ background: e.color }} />{txt(e.id)} <strong>{cuenta[e.id]}</strong></li>
                ))}
              </ul>
            </div>
          </article>

          <article className="dashinfo-panel">
            <h3>Por tipo de problema</h3>
            <Barras filas={filasTipo} color="#9D2449" />
          </article>

          <article className="dashinfo-panel ancho">
            <h3>Puntos de monitoreo con más reportes</h3>
            <Barras filas={filasSitio} color="#BC955C" />
          </article>
        </div>
      </div>
    </section>
  );
}

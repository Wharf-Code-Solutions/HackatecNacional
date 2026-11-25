import { hora, inicial, num, porAtender } from '../lib/formato.js';
import { PARAM, txt } from '../lib/etiquetas.js';
import BarrasH from '../graficas/BarrasH.jsx';
import { Nivel } from './ListaAlertas.jsx';
import { useDatos } from '../lib/contexto.js';

// Ficha de una escuela (docs/19 §6, punto 2): por qué tiene ese riesgo (el desglose, que suma el
// índice), su fuente de agua, su mecanismo, sus alertas, las zonas de riesgo que la contienen y sus
// trámites. Todo sale de escuelas.json, zonas_riesgo.geojson y las alertas del backend.
export const NIVEL_RIESGO = { muy_alto: 'Muy alto', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };
export const COLOR_RIESGO = { muy_alto: '#5c0f24', alto: '#9D2449', medio: '#c56a87', bajo: '#e3a9ba' };
export const FUENTE_AGUA = { red_publica: 'Red pública', pozo: 'Pozo', manantial: 'Manantial', rio: 'Río', pipa: 'Pipa',
  captacion_lluvia: 'Captación de lluvia', desconocida: 'Sin dato' };
const FACTOR = {
  pendiente: 'Pendiente de la ladera',
  susceptibilidad_laderas: 'Susceptibilidad de laderas',
  cercania_cauce_o_descarga: 'Cerca de cauce o descarga',
  calidad_agua: 'Calidad del agua',
  marginacion: 'Marginación',
  sin_drenaje: 'Sin drenaje',
  urbanizacion_reciente: 'Urbanización reciente',
};
const ESTADO_TRAMITE = { pendiente: 'Pendiente', solicitada: 'Solicitada', otorgada: 'Otorgada', negada: 'Negada' };
const TIPO_ZONA = { derrumbe: 'Derrumbe', inundacion: 'Inundación', contaminacion: 'Contaminación' };
const nombreFactor = (k) => FACTOR[k] || inicial(k.replace(/_/g, ' '));
const tramite = (t) => inicial((t || '').replace(/_/g, ' '));

export default function FichaEscuela({ escuela: e, alertas, zonas }) {
  const { mecanismosDe, mecanismoActivo, porQueMecanismo, porQueSinMecanismo } = useDatos();
  if (!e) {
    return (
      <article className="expediente" aria-label="Ficha de la escuela">
        <p className="vacio centro">Elige una escuela de la lista o del mapa para ver por qué tiene ese riesgo.</p>
      </article>
    );
  }
  const r = e.riesgo || {};
  const desglose = Object.entries(r.desglose || {}).filter(([, v]) => v != null)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ nombre: nombreFactor(k), partes: { v: Math.round(v * 1000) / 1000 }, total: Math.round(v * 1000) / 1000 }));
  const auts = e.autorizaciones || [];
  const mecs = mecanismosDe(e.cct);
  const codigosMec = mecs.map((m) => m.c_estacion);
  const suyas = alertas.filter((a) => codigosMec.includes(a.c_estacion)
    || (a.escuelas_afectadas || []).includes(e.cct)).sort((a, b) => (a.fecha_hora < b.fecha_hora ? 1 : -1));
  const abiertas = suyas.filter(porAtender);
  const zonasSuyas = ((zonas && zonas.features) || []).filter((f) => (f.properties.escuelas || []).includes(e.cct));
  const cifras = [
    [r.indice != null ? num(r.indice, 2) : 'sin dato', 'Índice de riesgo · ' + (NIVEL_RIESGO[r.nivel] || 'sin nivel')],
    [r.contaminacion != null ? num(r.contaminacion, 2) : 'sin dato', 'Subíndice de contaminación'],
    [r.derrumbe != null ? num(r.derrumbe, 2) : 'sin dato', 'Subíndice de derrumbe'],
  ];

  return (
    <article className="expediente" id="ficha-escuela" aria-label="Ficha de la escuela">
      <header className="exp-cabeza">
        <p className="exp-meta">
          <span><span className="riesgo-marca" style={{ background: COLOR_RIESGO[r.nivel] || '#ddd' }} />Riesgo {(NIVEL_RIESGO[r.nivel] || 'sin dato').toLowerCase()}</span>
          <span>CCT {e.cct}</span>
        </p>
        <h2>{e.nombre}</h2>
        <p className="exp-sub">
          {inicial(e.nivel || 'nivel sin dato')} · {inicial(e.localidad || 'localidad sin dato')}, {inicial(e.municipio || '')}
          {e.ambito ? ' · ' + e.ambito : ''}
          {e.matricula != null ? ' · ' + num(e.matricula) + ' alumnos' : ' · matrícula sin dato'}
        </p>
      </header>

      <div className="cifras">
        {cifras.map(([v, t]) => <div key={t}><b>{v}</b><span>{t}</span></div>)}
      </div>

      <section className="bloque">
        <h3>Por qué tiene este riesgo</h3>
        {desglose.length ? (
          <>
            <BarrasH filas={desglose} claves={['v']} colores={{ v: COLOR_RIESGO[r.nivel] || '#9D2449' }} nombreClave={() => 'puntos'} />
            <p className="nota">Cada factor suma al índice ({r.indice != null ? num(r.indice, 2) : 'sin dato'}). Los pesos son hipótesis.</p>
          </>
        ) : <p className="vacio">Sin desglose en los datos.</p>}
      </section>

      <section className="bloque">
        <h3>Agua y mecanismo</h3>
        <dl className="datos">
          <dt>Fuente de agua</dt><dd>{FUENTE_AGUA[e.fuente_agua] || 'Sin dato'}</dd>
          <dt>Mecanismo</dt>
          <dd>{mecs.length ? mecs.map((m) => m.c_estacion + ((m.parametros || []).includes('LLUVIA') ? ' (ladera)' : ' (agua)')
            + (mecanismoActivo(m) ? ' · activo' : ' · propuesto')).join('; ') : 'Ninguno cerca'}</dd>
          {mecs.length > 0 && <><dt>Alertas por atender</dt><dd>{abiertas.length} de {suyas.length}</dd></>}
        </dl>
        {mecs.map((m) => (
          <p key={m.c_estacion} className="por-que">
            <b>Por qué {m.c_estacion}{m.cct === e.cct ? ' está aquí' : ' la protege'}:</b>{' '}
            {m.cct === e.cct ? porQueMecanismo(m) : 'su estación queda junto a ' + (m.escuela || m.cct) + ' y cubre a las escuelas vecinas. ' + porQueMecanismo(m)}
          </p>
        ))}
        {!mecs.length && <p className="por-que"><b>Por qué no tiene mecanismo:</b> {porQueSinMecanismo(e)}</p>}
      </section>

      {mecs.length > 0 && (
        <section className="bloque">
          <h3>Alertas de sus mecanismos</h3>
          {!suyas.length ? <p className="vacio">Sin alertas de {codigosMec.join(' ni ')}.</p> : (
            <ol className="ficha-alertas">
              {suyas.slice(0, 8).map((a) => (
                <li key={a.c_alerta}>
                  <Nivel nivel={a.nivel} />
                  <span>{PARAM[a.c_parametro] || a.c_parametro}</span>
                  <span className="tenue">{hora(a.fecha_hora)}</span>
                  <span className="tenue">{txt(a.estado)}</span>
                </li>
              ))}
            </ol>
          )}
          {suyas.length > 8 && <p className="nota">Las 8 más recientes de {suyas.length}.</p>}
        </section>
      )}

      <section className="bloque">
        <h3>Zonas de riesgo</h3>
        {!zonasSuyas.length ? <p className="vacio">No está dentro de ninguna zona de riesgo registrada.</p> : (
          <dl className="datos">
            {zonasSuyas.map((f) => (
              <div key={f.properties.c_zona} style={{ display: 'contents' }}>
                <dt>{TIPO_ZONA[f.properties.tipo] || f.properties.tipo} · {(NIVEL_RIESGO[f.properties.nivel] || '').toLowerCase()}</dt>
                <dd>{f.properties.fuente || f.properties.c_zona}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="bloque">
        <h3>Trámites</h3>
        {!auts.length ? <p className="vacio">Sin trámites registrados.</p> : (
          <dl className="datos">
            {auts.map((a, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <dt>{a.organismo} · {tramite(a.tramite)}</dt>
                <dd>{ESTADO_TRAMITE[a.estado] || a.estado}{a.fecha ? ', ' + a.fecha : ''}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="nota">Trámites por confirmar con CEASPUE y CAPCEE; los nombres no son oficiales.</p>
      </section>
    </article>
  );
}

import { useState } from 'react';
import { useDatos } from '../lib/contexto.js';
import { CRITERIO, FUENTE, PARAM, REGLA, txt } from '../lib/etiquetas.js';
import { hora, inicial, km, num } from '../lib/formato.js';
import Miniaturas from '../graficas/Miniaturas.jsx';
import Serie from '../graficas/Serie.jsx';
import { Mensaje } from '../graficas/marcas.jsx';
import { Nivel } from './ListaAlertas.jsx';
import Prediccion from './Prediccion.jsx';

// Estado y responsable. Se monta de nuevo al cambiar de alerta (key), así el sondeo no pisa
// lo que se está escribiendo.
function Gestion({ alerta, guardar, demo }) {
  const [estado, setEstado] = useState(alerta.estado);
  const [responsable, setResponsable] = useState(alerta.responsable || '');
  const [msg, setMsg] = useState({ texto: '', clase: '' });
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    setMsg({ texto: 'Guardando.', clase: '' });
    try {
      const n = await guardar(alerta.c_alerta, { estado, responsable: responsable.trim() || null });
      setMsg({ clase: 'bien', texto: 'Guardado: ' + txt(n.estado) + (n.responsable ? ', a cargo de ' + n.responsable : ', sin responsable') +
        (demo ? '. Demostración: el cambio solo vive en esta pestaña.' : '.') });
    } catch (err) {
      setMsg({ clase: 'mal', texto: 'No se guardó: ' + err.message });
    }
    setOcupado(false);
  };
  return (
    <form className="gestion" onSubmit={enviar}>
      <label>Estado
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="Abierta">Abierta</option>
          <option value="En atencion">En atención</option>
          <option value="Cerrada">Cerrada</option>
          <option value="Descartada">Descartada</option>
        </select>
      </label>
      <label>Responsable
        <input type="text" maxLength={120} placeholder="Nombre o área" value={responsable}
          onChange={(e) => setResponsable(e.target.value)} />
      </label>
      <button className="boton primario" type="submit" disabled={ocupado}>Guardar</button>
      <p className={'nota ' + msg.clase} role="status">{msg.texto}</p>
    </form>
  );
}

function TablaRed({ sitio, sentido }) {
  const { pares, nombresSitio } = useDatos();
  if (!sitio) return <p className="vacio">Sin sitio asociado.</p>;
  const mios = pares.filter((p) => (sentido === 'abajo' ? p.arriba === sitio : p.abajo === sitio)).sort((x, y) => x.m - y.m);
  if (!mios.length) return <Mensaje>Ningún sitio de monitoreo {sentido === 'abajo' ? 'aguas abajo' : 'aguas arriba'} en la topología.</Mensaje>;
  const ver = mios.slice(0, 6);
  return (
    <>
      <div className="tabla-desliza" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Sitio</th><th>Clave</th><th className="num">Por el cauce</th></tr></thead>
          <tbody>
            {ver.map((p) => {
              const c = sentido === 'abajo' ? p.abajo : p.arriba;
              return (
                <tr key={c}>
                  <td>{inicial(nombresSitio[c] || c)}{p.revisar && <span className="tenue"> (enganche por revisar)</span>}</td>
                  <td className="tenue">{c}</td>
                  <td className="num">{km(p.m)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="nota">
        {mios.length > ver.length ? `Los ${ver.length} más cercanos de ${mios.length} sitios. ` : `${mios.length} sitios. `}
        Topología del río (M1), red hidrográfica del INEGI.
      </p>
    </>
  );
}

function Fuente({ f, motor }) {
  if (!f) return <Mensaje>Sin estimación de fuente. {motor === 'stub' ? 'El motor provisional no la calcula.' : 'El motor no la envió.'}</Mensaje>;
  return (
    <>
      <dl className="datos">
        <dt>Tipo</dt><dd>{FUENTE[f.tipo] || f.tipo}</dd>
        <dt>Puntaje</dt><dd>{num(f.puntaje, 2)} de 1 · estimación, no diagnóstico</dd>
      </dl>
      {f.evidencia && f.evidencia.length > 0 && <ul className="lista">{f.evidencia.map((x) => <li key={x}>{x}</li>)}</ul>}
      {f.candidatos_aguas_arriba && f.candidatos_aguas_arriba.length ? (
        <table>
          <thead><tr><th>Candidato</th><th>Giro</th><th className="num">Distancia</th></tr></thead>
          <tbody>
            {f.candidatos_aguas_arriba.map((c) => (
              <tr key={c.c_fuente_cont || c.nombre}>
                <td>{c.nombre || c.c_fuente_cont}</td><td>{c.giro || 'sin dato'}</td>
                <td className="num">{c.distancia_m == null ? 'sin dato' : km(c.distancia_m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="nota">Sin candidatos concretos: REPDA y DENUE aún no están integrados.</p>}
    </>
  );
}

function Medidas({ ms }) {
  if (!ms || !ms.length) return <Mensaje>Sin medidas sugeridas por el motor.</Mensaje>;
  return (
    <table>
      <thead><tr><th>Plazo</th><th>Acción</th><th>Autoridad</th></tr></thead>
      <tbody>
        {ms.map((m) => (
          <tr key={m.accion}>
            <td>{m.plazo === 'inmediata' ? 'Inmediata' : 'Mediano plazo'}</td><td>{m.accion}</td><td>{m.autoridad || 'sin dato'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// La serie grande muestra la sonda que se elija en las miniaturas; empieza en la de la alerta.
// Se monta de nuevo al cambiar de alerta (key), así vuelve a la sonda alterada.
function Sondas({ alerta, alertas, estacion, banda, veredictos, lineaBase, evidencia }) {
  const [param, setParam] = useState(alerta.c_parametro);
  const propia = param === alerta.c_parametro;
  const bandaParam = propia ? banda : (lineaBase[alerta.c_sitio || estacion.c_sitio] || {})[param];
  return (
    <>
      <section className="bloque">
        <h3>Evidencia</h3>
        <Serie alerta={alerta} alertas={alertas} parametro={param} banda={bandaParam} veredictos={veredictos} />
        {propia && (
          <dl className="datos">
            {evidencia.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
      </section>

      <section className="bloque">
        <h3>Todas las sondas de la estación</h3>
        <p className="nota" style={{ margin: '-6px 0 12px' }}>Un clic en una sonda la muestra arriba. Recuadro guinda: la que se ve; franja azul clara: lo habitual del sitio.</p>
        <Miniaturas alerta={alerta} estacion={estacion} lineaBase={lineaBase} veredictos={veredictos}
          elegido={param} onElegir={setParam} />
      </section>
    </>
  );
}

export default function Expediente({ alerta, alertas, veredictos, motor, guardar, prediccion, demo }) {
  const { estaciones, lineaBase, nombreEstacion, banda, unidad } = useDatos();
  if (!alerta) {
    return (
      <article className="expediente" aria-label="Expediente de la alerta">
        <p className="vacio centro">Elige una alerta de la lista para ver su evidencia y asignarla.</p>
      </article>
    );
  }
  const a = alerta;
  const e = estaciones[a.c_estacion] || {};
  const b = banda(a);
  const fuera = b && a.valor != null
    ? (a.valor > b.p90 ? num(a.valor / b.p90, 1) + ' veces el p90' : a.valor < b.p10 ? 'debajo del p10 (' + num(b.p10) + ')' : 'dentro de la banda')
    : 'sin línea base';
  const cifras = [
    [num(a.valor) + unidad(a), 'Valor medido'],
    [b ? num(b.p10) + ' a ' + num(b.p90) : 'sin dato', b ? 'Banda habitual del sitio · n = ' + b.n : 'Banda habitual del sitio'],
    [a.lecturas_consecutivas == null ? 'sin dato' : String(a.lecturas_consecutivas), 'Lecturas seguidas fuera · ' + fuera],
  ];
  const evidencia = [
    ['Regla que la disparó', REGLA[a.regla] || a.regla],
    ['Comparado contra', a.criterio_aplicado ? (CRITERIO[a.criterio_aplicado] || a.criterio_aplicado) : 'sin dato'],
    ['Respaldo de la banda', b ? `${b.n} mediciones de CONAGUA, ${b.primera_fecha} a ${b.ultima_fecha}` : 'sin línea base para este parámetro'],
  ];
  return (
    <article className="expediente" id="expediente" aria-label="Expediente de la alerta">
      <header className="exp-cabeza">
        <p className="exp-meta"><Nivel nivel={a.nivel} /><span>Folio {a.c_alerta}</span></p>
        <h2>{PARAM[a.c_parametro] || a.c_parametro} fuera de lo habitual en {nombreEstacion(a.c_estacion)}</h2>
        <p className="exp-sub">
          {hora(a.fecha_hora)} · estación {a.c_estacion}, sitio {a.c_sitio || e.c_sitio || 'sin dato'}
          {e.municipio && ` · ${inicial(e.municipio)}, ${inicial(e.estado)}`}
        </p>
      </header>

      <div className="cifras">
        {cifras.map(([v, t]) => <div key={t}><b>{v}</b><span>{t}</span></div>)}
      </div>

      <section className="bloque">
        <h3>Atención</h3>
        <Gestion key={a.c_alerta} alerta={a} guardar={guardar} demo={demo} />
      </section>

      <Sondas key={a.c_alerta} alerta={a} alertas={alertas} estacion={e} banda={b} veredictos={veredictos} lineaBase={lineaBase}
        evidencia={evidencia} />

      {/* A todo lo ancho: con los candidatos del DENUE la tabla no cabe en media columna. */}
      <section className="bloque"><h3>Fuente probable</h3><Fuente f={a.fuente_probable} motor={motor} /></section>
      <section className="bloque"><h3>Medidas sugeridas</h3><Medidas ms={a.medidas_sugeridas} /></section>

      <section className="bloque">
        <h3>Hasta dónde llega</h3>
        <Prediccion alerta={a} unidad={unidad(a)} obtener={prediccion}
          sinPrediccion={<TablaRed sitio={a.c_sitio || e.c_sitio} sentido="abajo" />} />
      </section>

      <section className="bloque">
        <h3>Aguas arriba del punto</h3>
        <TablaRed sitio={a.c_sitio || e.c_sitio} sentido="arriba" />
      </section>
    </article>
  );
}

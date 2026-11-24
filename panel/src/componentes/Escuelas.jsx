import { inicial, num } from '../lib/formato.js';

// Vista de escuelas (docs/19 §6, puntos 1, 2 y 6). Paso 1 del módulo B: solo la lista ordenada por
// riesgo, para que la sección exista con datos; panorama, ficha y mapa se agregan encima.
const NIVEL_RIESGO = { muy_alto: 'Muy alto', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };

export default function Escuelas({ escuelas }) {
  const lista = [...escuelas].sort((a, b) => ((b.riesgo || {}).indice || 0) - ((a.riesgo || {}).indice || 0));
  return (
    <section className="vista">
      <figure className="tarjeta ancha">
        <h2 className="titulo-seccion">Escuelas por riesgo</h2>
        <p className="subtitulo-seccion">{lista.length} escuelas, de mayor a menor índice de riesgo. Los pesos del índice son hipótesis.</p>
        {!lista.length ? <p className="vacio">Sin escuelas en los datos.</p> : (
          <div className="tabla-desliza">
            <table className="estaciones">
              <thead>
                <tr><th>Escuela</th><th>Municipio</th><th>Nivel</th><th className="num">Alumnos</th><th>Riesgo</th><th className="num">Índice</th></tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.cct}>
                    <td><b>{e.nombre}</b><br /><span className="tenue">{e.cct}</span></td>
                    <td>{inicial(e.municipio)}{e.localidad ? ', ' + inicial(e.localidad) : ''}</td>
                    <td>{inicial(e.nivel)}</td>
                    <td className="num">{e.matricula == null ? 'sin dato' : num(e.matricula)}</td>
                    <td>{e.riesgo ? NIVEL_RIESGO[e.riesgo.nivel] || e.riesgo.nivel : 'sin dato'}</td>
                    <td className="num">{e.riesgo && e.riesgo.indice != null ? num(e.riesgo.indice, 2) : 'sin dato'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </figure>
    </section>
  );
}

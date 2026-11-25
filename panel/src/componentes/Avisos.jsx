import { useDatos } from '../lib/contexto.js';
import { AVISO, COLOR_AVISO, PARAM } from '../lib/etiquetas.js';
import { hora, inicial } from '../lib/formato.js';
import BarrasH from '../graficas/BarrasH.jsx';
import { Mensaje } from '../graficas/marcas.jsx';

// Problemas del dispositivo, no del río. Nunca se mezclan con las alertas (I8).
export default function Avisos({ veredictos, conectado }) {
  const { todas: estaciones, nombreEstacion } = useDatos();
  const grupos = {};
  Object.keys(veredictos).forEach((c) => {
    veredictos[c].forEach((v) => {
      (v.avisos_tecnicos || []).forEach((av) => {
        const k = c + '|' + av.tipo + '|' + (av.c_parametro || '');
        const g = grupos[k] = grupos[k] || { c, tipo: av.tipo, p: av.c_parametro, n: 0, ultima: '', detalle: '', total: veredictos[c].length };
        g.n++;
        if (v.fecha_hora > g.ultima) { g.ultima = v.fecha_hora; g.detalle = av.detalle; }
      });
    });
  });
  const lista = Object.values(grupos).sort((x, y) => (y.ultima < x.ultima ? -1 : 1));
  const tipos = [...new Set(lista.map((g) => g.tipo))];
  const filas = Object.keys(estaciones).sort().map((c) => {
    const partes = {};
    let total = 0;
    lista.forEach((g) => { if (g.c === c) { partes[g.tipo] = (partes[g.tipo] || 0) + g.n; total += g.n; } });
    return { nombre: c.replace('EST-', '') + ' ' + inicial(estaciones[c].localidad || estaciones[c].cuerpo_agua || ''), partes, total };
  });
  return (
    <section className="vista">
      <h2 className="titulo-pagina">Avisos técnicos</h2>
      <p className="intro">Problemas del dispositivo, no del río. Se cuentan sobre los últimos 50 veredictos de cada estación.</p>
      {!lista.length ? (
        <Mensaje>{conectado === false ? 'Sin conexión con el backend.' : 'Sin avisos técnicos en los veredictos recientes.'}</Mensaje>
      ) : (
        <>
          <figure className="tarjeta">
            <BarrasH filas={filas} claves={tipos} colores={COLOR_AVISO} nombreClave={(k) => AVISO[k] || k}
              nota="Veces que apareció cada aviso en los últimos 50 veredictos de la estación." />
          </figure>
          <div className="tabla-desliza">
            <table>
              <thead>
                <tr><th>Estación</th><th>Aviso</th><th>Parámetro</th><th className="num">Veces</th><th>Última</th><th>Detalle</th></tr>
              </thead>
              <tbody>
                {lista.map((g) => (
                  <tr key={g.c + g.tipo + g.p}>
                    <td>{g.c.replace('EST-', '')} {nombreEstacion(g.c)}</td>
                    <td>{AVISO[g.tipo] || g.tipo}</td>
                    <td>{g.p ? PARAM[g.p] || g.p : 'dispositivo'}</td>
                    <td className="num">{g.n} de {g.total}</td>
                    <td>{hora(g.ultima)}</td>
                    <td>{g.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

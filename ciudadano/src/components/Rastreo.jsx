import React, { useEffect, useState } from 'react';
import { consultarFolio } from '../lib/backend.js';
import { folios } from '../lib/almacen.js';
import { ESTADOS, fechaHora, km, nombreTipo } from '../lib/etiquetas.js';
import CategoriaIcono from './CategoriaIcono.jsx';

const FORMATO = /^RC-\d{8}-\d{4}$/;

// Seguimiento de un reporte por su folio
export default function Rastreo({ origen, datos, folioInicial }) {
  const [folio, setFolio] = useState(folioInicial || '');
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const propios = folios();

  const buscar = async (f) => {
    const id = (f ?? folio).trim().toUpperCase();
    setFolio(id); setR(null); setError(null);
    if (!FORMATO.test(id)) { setError('El folio tiene este formato: RC-20261124-0001.'); return; }
    setCargando(true);
    try { setR(await consultarFolio(origen, id)); }
    catch (e) { setError(e.status === 404 ? 'No encontramos ese folio. Revisa que esté completo.' : 'No se pudo consultar. Revisa tu conexión y vuelve a intentar.'); }
    setCargando(false);
  };

  useEffect(() => { if (folioInicial) buscar(folioInicial); /* eslint-disable-next-line */ }, []);

  const sitio = r && r.c_sitio_asignado && datos ? datos.sitios.find((s) => s.c_sitio === r.c_sitio_asignado) : null;
  const cerrado = r && (r.estado === 'Cerrado' || r.estado === 'Descartado');

  return (
    <div className="rastreo">
      <div className="rastreo__contenido">
        <div className="rastreo-intro">
          <h1>Rastreo de reportes</h1>
          <p>Escribe el folio que recibiste al reportar para ver en qué va.</p>
        </div>

        <form className="rastreo-buscador" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
          <label htmlFor="rastreo-folio">Folio de tu reporte</label>
          <div className="rastreo-buscador__fila">
            <input id="rastreo-folio" className="form-control" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="RC-20261124-0001"
              autoCapitalize="characters" autoCorrect="off" spellCheck="false" aria-invalid={!!error} />
            <button className="btn btn-primary" type="submit" disabled={cargando}>Consultar</button>
          </div>
          {error && <p className="rastreo-buscador__error" role="alert">{error}</p>}
          {origen.modo === 'demo' && <p className="rastreo-buscador__ayuda">En la demostración solo existen los folios de ejemplo.</p>}
        </form>

        {cargando && <div className="rastreo-cargando" role="status"><div className="rastreo-cargando__giro" /><span>Consultando…</span></div>}

        {r && (
          <section className="rastreo-resultado">
            <div className="rastreo-resultado__cabecera">
              <div className="rastreo-resultado__icono"><CategoriaIcono tipo={r.tipo} /></div>
              <div>
                <h2>{nombreTipo(r.tipo)}</h2>
                <div className="rastreo-folio">{r.c_reporte}</div>
              </div>
            </div>
            <span className={'estado-chip' + (cerrado ? ' estado-chip--cerrado' : '')}>{ESTADOS[r.estado] || r.estado}</span>
            <ul className="rastreo-detalle">
              <li><small>Reportado</small>{fechaHora(r.fecha_hora)}</li>
              {sitio && <li><small>Punto de monitoreo asociado</small>{sitio.nombre}{r.distancia_al_cauce_m != null ? ' · ' + km(r.distancia_al_cauce_m) + ' del cauce' : ''}</li>}
            </ul>
          </section>
        )}

        {propios.length > 0 && (
          <>
            <h2 className="seccion">Tus folios en este teléfono</h2>
            <ul className="rastreo-lista">
              {propios.map((f) => (
                <li key={f.c_reporte}>
                  <button onClick={() => buscar(f.c_reporte)}><code>{f.c_reporte}</code><small>{nombreTipo(f.tipo)} · {fechaHora(f.fecha_hora)}</small></button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useRef, useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import CategoriaIcono from './CategoriaIcono.jsx';
import { encolar, guardarFolio } from '../lib/almacen.js';
import { enviarReporte, getJSON } from '../lib/backend.js';
import { prepararFoto } from '../lib/foto.js';
import { dentroDeVentana, redondeada } from '../lib/ubicacion.js';
import { TIPOS, km, nombreTipo } from '../lib/etiquetas.js';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Formulario de reporte en hoja inferior. La ubicación es la del pin central del mapa.
export default function FormularioReporte({ lat, lon, precision, origen, datos, onClose, onEnviado, onPendiente, ir }) {
  const [tipo, setTipo] = useState(null);
  const [foto, setFoto] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [fin, setFin] = useState(null);       // { c_reporte } o { local: true }
  const [detalle, setDetalle] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const camara = useRef(null);      // abre la cámara (capture)
  const galeria = useRef(null);     // abre la galería del teléfono

  const fuera = !dentroDeVentana(lat, lon);

  const alElegirFoto = async (e) => {
    const archivo = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    setProcesando(true); setErrorFoto(null);
    try { setFoto(await prepararFoto(archivo)); } catch { setFoto(null); setErrorFoto('No se pudo leer esa foto. Prueba con otra.'); }
    setProcesando(false);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    const er = {};
    if (!tipo) er.tipo = 'Elige qué viste.';
    if (fuera) er.ubicacion = 'El punto del mapa queda fuera de la cuenca del Alto Atoyac. Mueve el mapa hasta el río.';
    if (correo.trim() && !CORREO.test(correo.trim())) er.correo = 'Revisa el correo.';
    setErrores(er);
    if (Object.keys(er).length) return;

    setEnviando(true); setErrorEnvio(null);
    const payload = {
      version: '1.0',
      fecha_hora: new Date().toISOString(),
      tipo,
      latitud: Number(lat.toFixed(6)),
      longitud: Number(lon.toFixed(6)),
      precision_ubicacion_m: precision ?? null,
      // true: la foto, si hay, pasó por el canvas (sin EXIF); sin foto no hay metadatos que quitar.
      exif_removido: true,
    };
    if (foto) payload.foto_url = foto.dataUrl;
    if (descripcion.trim()) payload.descripcion = descripcion.trim();
    if (correo.trim()) payload.correo = correo.trim();

    const r = await enviarReporte(origen, payload);
    if (r.ok) {
      guardarFolio(r.c_reporte, tipo, payload.fecha_hora);
      setFin({ c_reporte: r.c_reporte });
      onEnviado?.();
      // Con el folio emitido, pregunta al backend a qué punto quedó asociado (orientación; no bloquea)
      if (origen.modo === 'api') getJSON(origen.url + '/reportes/' + r.c_reporte).then(setDetalle).catch(() => {});
    } else if (r.reintentable) {
      if (!encolar(payload)) { setErrorEnvio('No hay conexión y tampoco espacio para guardar el reporte en este teléfono.'); setEnviando(false); return; }
      onPendiente?.();
      setFin({ local: true });
    } else {
      setErrorEnvio('El servidor no aceptó el reporte (' + r.estado + '). ' + (r.texto || ''));
    }
    setEnviando(false);
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(fin.c_reporte); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setCopiado(false); }
  };

  if (fin) {
    const sitio = detalle && detalle.c_sitio_asignado && datos ? datos.sitios.find((s) => s.c_sitio === detalle.c_sitio_asignado) : null;
    return (
      <BottomSheet titulo={fin.local ? 'Guardado en tu teléfono' : 'Reporte recibido'} onClose={onClose}>
        <div className="rf-exito">
          <svg className="rf-exito__check" viewBox="0 0 52 52" aria-hidden="true">
            <circle className="rf-exito__circulo" cx="26" cy="26" r="24" />
            <path className="rf-exito__marca" d="M14 27l8 8 16-18" />
          </svg>
          {fin.local ? (
            <>
              <h3>{origen.modo === 'demo' ? 'Demostración' : 'Sin señal'}</h3>
              <p>{origen.modo === 'demo'
                ? 'Esto es una demostración: el reporte no se envía a ningún servidor.'
                : 'Tu reporte está guardado. Se enviará solo cuando vuelva la conexión y entonces tendrás tu folio.'}</p>
            </>
          ) : (
            <>
              <h3>¡Gracias por reportar!</h3>
              <p>{nombreTipo(tipo)}. Guarda tu folio para consultar en qué va.</p>
              <div className="rf-folio">
                <div>
                  <span className="rf-folio__etiqueta">Folio</span>
                  <span className="rf-folio__codigo">{fin.c_reporte}</span>
                </div>
                <button type="button" className="rf-folio__copiar" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
              </div>
              {sitio && <p className="rf-folio__nota">Punto de monitoreo asociado: {sitio.nombre}{detalle.distancia_al_cauce_m != null ? ' · ' + km(detalle.distancia_al_cauce_m) + ' del cauce' : ''}.</p>}
              <p className="rf-folio__nota">Consúltalo cuando quieras en <a href="#/rastreo" onClick={(e) => { e.preventDefault(); ir('rastreo'); }}>Rastreo de Reportes</a>.</p>
            </>
          )}
          <button type="button" className="btn btn-primary w-100" onClick={onClose}>Listo</button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet titulo="Nuevo reporte" onClose={onClose}>
      <form onSubmit={enviar} noValidate>
        <p className="report-form__meta">Ubicación aproximada del reporte: {redondeada(lat)}, {redondeada(lon)}{precision ? ' · GPS ±' + precision + ' m' : ''}</p>
        {errores.ubicacion && <div className="alert alert-danger mb-3" role="alert">{errores.ubicacion}</div>}

        <fieldset className="categorias">
          <legend>¿Qué ves?</legend>
          <div className="categorias__grid">
            {TIPOS.map(([c, nombre]) => (
              <label key={c} className={'categoria' + (tipo === c ? ' is-selected' : '')}>
                <input type="radio" name="tipo" value={c} checked={tipo === c} onChange={() => setTipo(c)} aria-invalid={!!errores.tipo} />
                <CategoriaIcono tipo={c} />
                <span>{nombre}</span>
              </label>
            ))}
          </div>
          {errores.tipo && <div className="rf-error" role="alert">{errores.tipo}</div>}
        </fieldset>

        <div className="mb-3">
          <span className="form-label">Foto <small>(opcional)</small></span>
          <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegirFoto} hidden />
          <input ref={galeria} type="file" accept="image/*" onChange={alElegirFoto} hidden />
          {!foto && (
            <div className="report-form__acciones">
              <button type="button" className="btn btn-outline-secondary" onClick={() => camara.current.click()} disabled={procesando}>{procesando ? 'Preparando…' : 'Tomar una foto'}</button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => galeria.current.click()} disabled={procesando}>Elegir de la galería</button>
            </div>
          )}
          {errorFoto && <div className="rf-error" role="alert">{errorFoto}</div>}
          {foto && (
            <div className="report-form__foto">
              <img src={foto.dataUrl} alt="Foto del reporte, ya reducida" />
              <p className="report-form__meta" style={{ margin: 0 }}>Se reduce en tu teléfono ({foto.kb} KB) y se le borran los datos ocultos.</p>
              {foto.avisos.length > 0 && (
                <div className="alert alert-warning" role="alert">
                  {foto.avisos.join(' ')} ¿Quieres tomar otra? Si no puedes, se envía igual.
                </div>
              )}
              <div className="report-form__acciones">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => camara.current.click()}>Tomar otra</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => galeria.current.click()}>Elegir otra</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setFoto(null)}>Quitar</button>
              </div>
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-desc">Descripción <small>(opcional)</small></label>
          <textarea id="rf-desc" className="form-control" rows="3" maxLength="1000" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Qué ves, desde cuándo, qué tan grande" />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-correo">Correo <small>(opcional, solo para avisarte cuando se cierre)</small></label>
          <input id="rf-correo" className="form-control" type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} aria-invalid={!!errores.correo} />
          {errores.correo && <div className="rf-error" role="alert">{errores.correo}</div>}
        </div>

        {errorEnvio && <div className="alert alert-danger mb-3" role="alert">{errorEnvio}</div>}
        <button className="btn btn-primary w-100" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar reporte'}</button>
      </form>
    </BottomSheet>
  );
}

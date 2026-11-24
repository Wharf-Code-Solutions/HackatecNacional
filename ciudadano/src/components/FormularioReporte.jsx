import React, { useEffect, useRef, useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import CategoriaIcono from './CategoriaIcono.jsx';
import { encolar, guardarFolio } from '../lib/almacen.js';
import { analizarFoto, enviarReporte, getJSON } from '../lib/backend.js';
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
  const [analisis, setAnalisis] = useState(null);   // { estado: 'analizando' | 'ok' | 'no_disponible', ... } de la foto actual
  const turno = useRef(0);                          // descarta respuestas de una foto que ya se cambió
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
    const mio = ++turno.current;
    setProcesando(true); setErrorFoto(null); setAnalisis(null);
    try {
      const f = await prepararFoto(archivo);
      setFoto(f);
      setProcesando(false);
      // Revisa que la foto corresponda a algún tipo; mientras tanto no se puede enviar
      setAnalisis({ estado: 'analizando' });
      const a = await analizarFoto(origen, f.dataUrl);
      if (mio === turno.current) setAnalisis(a);
    } catch {
      setFoto(null); setAnalisis(null); setErrorFoto('No se pudo leer esa foto. Prueba con otra.'); setProcesando(false);
    }
  };

  const quitarFoto = () => { turno.current += 1; setFoto(null); setAnalisis(null); };

  // La foto no se puede enviar si se está revisando o si no corresponde a ninguno de los tipos
  const revisando = !!foto && analisis && analisis.estado === 'analizando';
  const fotoInvalida = !!foto && analisis && analisis.estado === 'ok' && !analisis.valida;
  // La foto va antes que los tipos: si la revisión reconoce uno y la persona aún no elige, se preselecciona
  // (lo puede cambiar). Si ya eligió otro, se le sugiere con un botón.
  useEffect(() => {
    if (analisis && analisis.estado === 'ok' && analisis.valida && analisis.tipo && !tipo) setTipo(analisis.tipo);
  }, [analisis]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugerido = analisis && analisis.estado === 'ok' && analisis.valida && analisis.tipo !== tipo ? analisis.tipo : null;

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    const er = {};
    if (!tipo) er.tipo = 'Elige qué viste.';
    if (revisando || fotoInvalida) er.foto = 'Esa foto no se puede enviar. Toma otra o quítala.';
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
    if (foto) {
      payload.foto_url = foto.dataUrl;
      if (analisis && analisis.estado === 'ok') payload.clasificacion_automatica = { etiqueta: analisis.tipo, confianza: analisis.confianza, modelo: analisis.modelo };
    }
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

        <div className="mb-3">
          <span className="form-label">Foto <small>(opcional)</small></span>
          {errores.foto && <div className="rf-error" role="alert">{errores.foto}</div>}
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
              {revisando && <p className="report-form__meta" role="status" style={{ margin: 0 }}>Revisando la foto…</p>}
              {fotoInvalida && (
                <div className="alert alert-danger" role="alert">
                  Esta foto no parece mostrar ninguno de los problemas que se pueden reportar{analisis.motivo ? ' (' + analisis.motivo.replace(/\.$/, '') + ')' : ''}. Toma otra foto o quítala para enviar sin ella.
                </div>
              )}
              {analisis && analisis.estado === 'no_disponible' && (
                <div className="alert alert-warning" role="status">No pudimos revisar la foto en este momento. Se enviará de todos modos y se verificará después.</div>
              )}
              {sugerido && (
                <div className="alert alert-warning" role="status">
                  La foto parece de «{nombreTipo(sugerido)}», no de «{tipo ? nombreTipo(tipo) : 'ningún tipo'}».{' '}
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setTipo(sugerido)}>Usar {nombreTipo(sugerido)}</button>
                </div>
              )}
              {foto.avisos.length > 0 && (
                <div className="alert alert-warning" role="alert">
                  {foto.avisos.join(' ')} ¿Quieres tomar otra? Si no puedes, se envía igual.
                </div>
              )}
              <div className="report-form__acciones">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => camara.current.click()}>Tomar otra</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => galeria.current.click()}>Elegir otra</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={quitarFoto}>Quitar</button>
              </div>
            </div>
          )}
        </div>

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
          <label className="form-label" htmlFor="rf-desc">Descripción <small>(opcional)</small></label>
          <textarea id="rf-desc" className="form-control" rows="3" maxLength="1000" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Qué ves, desde cuándo, qué tan grande" />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="rf-correo">Correo <small>(opcional, solo para avisarte cuando se cierre)</small></label>
          <input id="rf-correo" className="form-control" type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} aria-invalid={!!errores.correo} />
          {errores.correo && <div className="rf-error" role="alert">{errores.correo}</div>}
        </div>

        {errorEnvio && <div className="alert alert-danger mb-3" role="alert">{errorEnvio}</div>}
        <button className="btn btn-primary w-100" type="submit" disabled={enviando || revisando || fotoInvalida}>{enviando ? 'Enviando…' : revisando ? 'Revisando la foto…' : 'Enviar reporte'}</button>
      </form>
    </BottomSheet>
  );
}

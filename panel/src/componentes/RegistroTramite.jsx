import { useState } from 'react';

// Botón y formulario corto para registrar en qué va un trámite de CEASPUE o CAPCEE. La autorización real la da el
// organismo con su oficio; aquí solo se anota, con el nombre de quien lo registra (no hay inicio de sesión).
const SIGUIENTE = { pendiente: 'solicitada', solicitada: 'otorgada', otorgada: 'otorgada', negada: 'solicitada' };
const ACCION = { pendiente: 'Registrar solicitud', solicitada: 'Registrar respuesta', otorgada: 'Corregir', negada: 'Corregir' };
const ESTADOS = [['pendiente', 'Pendiente'], ['solicitada', 'Solicitada'], ['otorgada', 'Otorgada'], ['negada', 'Negada']];
const GUARDADO = 'panel.encargado';
const leerEncargado = () => { try { return localStorage.getItem(GUARDADO) || ''; } catch { return ''; } };
const guardarEncargado = (v) => { try { localStorage.setItem(GUARDADO, v); } catch { /* sin almacenamiento */ } };

export default function RegistroTramite({ objeto, tramite, registrar }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState(SIGUIENTE[tramite.estado] || 'solicitada');
  const [encargado, setEncargado] = useState(leerEncargado);
  const [oficio, setOficio] = useState(tramite.oficio || '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  if (!registrar) return null;
  if (!abierto) {
    return (
      <button type="button" className="boton-tramite" onClick={() => { setEstado(SIGUIENTE[tramite.estado] || 'solicitada'); setAbierto(true); }}>
        {ACCION[tramite.estado] || 'Registrar'}
      </button>
    );
  }
  const enviar = async (e) => {
    e.preventDefault();
    if (!encargado.trim()) { setError('Escribe quién lo registra.'); return; }
    setOcupado(true); setError('');
    try {
      await registrar(objeto, { organismo: tramite.organismo, tramite: tramite.tramite, estado, encargado: encargado.trim(),
        oficio: oficio.trim() || null });
      guardarEncargado(encargado.trim());
      setAbierto(false);
    } catch (err) {
      setError('No se guardó: ' + err.message);
    }
    setOcupado(false);
  };
  return (
    <form className="form-tramite" onSubmit={enviar}>
      <label>Estado
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label>Quién lo registra
        <input value={encargado} onChange={(e) => setEncargado(e.target.value)} maxLength={80} placeholder="Nombre y área" required />
      </label>
      <label>Oficio <small>(opcional)</small>
        <input value={oficio} onChange={(e) => setOficio(e.target.value)} maxLength={60} placeholder="Número de oficio" />
      </label>
      {error && <p className="form-tramite-error" role="alert">{error}</p>}
      <div className="form-tramite-botones">
        <button type="submit" className="boton-tramite primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="boton-tramite" onClick={() => setAbierto(false)} disabled={ocupado}>Cancelar</button>
      </div>
    </form>
  );
}

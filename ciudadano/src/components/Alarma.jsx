import React, { useEffect } from 'react';
import { NUMEROS, Telefono } from './Emergencia.jsx';

// Alarma de deslave: la plataforma abrió una alerta Crítica de ladera (motor/reglas.py) en una estación cerca de quien
// tiene la app abierta. Es un AVISO del sistema de monitoreo, no una alerta oficial de Protección Civil: lo dice.
// Suena (Web Audio, sin archivos) y vibra unos segundos; no se repite sola para no volverse ruido.

function sirena() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return () => {};
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = 'sine';
    vol.gain.value = 0.18;
    osc.connect(vol).connect(ctx.destination);
    const t0 = ctx.currentTime;
    // Dos tonos alternados, 4 s: lo bastante para notarse, sin aturdir.
    for (let i = 0; i < 8; i++) osc.frequency.setValueAtTime(i % 2 ? 660 : 880, t0 + i * 0.5);
    osc.start(t0);
    osc.stop(t0 + 4);
    return () => { try { osc.stop(); ctx.close(); } catch { /* ya terminó */ } };
  } catch {
    return () => {};
  }
}

const hora = (d) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function Alarma({ alerta, estacion, recibida, onVer, onClose }) {
  useEffect(() => {
    const parar = sirena();
    try { navigator.vibrate && navigator.vibrate([600, 250, 600, 250, 600, 250, 600]); } catch { /* sin vibración */ }
    return () => { parar(); try { navigator.vibrate && navigator.vibrate(0); } catch { /* nada */ } };
  }, [alerta.c_alerta]);

  const escuela = (estacion && estacion.escuela) || 'una escuela cercana';
  const lugar = estacion ? [estacion.localidad, estacion.municipio].filter(Boolean).join(', ') : '';
  const que = alerta.regla === 'movimiento_ladera' ? 'La ladera se movió'
    : alerta.regla === 'lluvia_acumulada' ? 'Lluvia peligrosa para la ladera' : 'Suelo saturado en la ladera';

  return (
    <div className="alarma" role="alertdialog" aria-modal="true" aria-labelledby="alarma-titulo" aria-describedby="alarma-texto">
      <div className="alarma__caja">
        <p className="alarma__marca">Aviso de riesgo · {hora(recibida)}</p>
        <h2 id="alarma-titulo">Riesgo de deslave</h2>
        <p id="alarma-texto" className="alarma__texto">
          {que} junto a <strong>{escuela}</strong>{lugar ? ' (' + lugar + ')' : ''}. Aléjate de la ladera y de los
          cauces, y sigue las indicaciones de Protección Civil.
        </p>
        <div className="alarma__acciones">
          {NUMEROS.map((n) => (
            <a key={n.tel} href={'tel:' + n.tel} className={'emergencia__llamar' + (n.principal ? ' es-principal' : '')}>
              <Telefono />
              <span><strong>{n.titulo}</strong><small>{n.detalle}</small></span>
            </a>
          ))}
        </div>
        <div className="alarma__pie">
          {estacion && <button type="button" className="btn btn-outline-secondary" onClick={onVer}>Ver en el mapa</button>}
          <button type="button" className="btn btn-primary" onClick={onClose}>Entendido</button>
        </div>
        <p className="alarma__nota">Aviso del sistema de monitoreo, no es una alerta oficial. Si hay personas en riesgo, llama al 911.</p>
      </div>
    </div>
  );
}

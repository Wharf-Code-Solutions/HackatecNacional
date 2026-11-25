import { useEffect, useState } from 'react';

// La sección del panel vive en la URL (#/alertas, #/escuelas/21DPR0448Z, #/reportes/estadisticas…), así que el
// botón Atrás del navegador regresa a la página anterior, y un enlace o una recarga abren la misma vista.
// Se usa el hash para no depender de que el servidor (Vercel) reescriba rutas.
//
//   #/alertas              Alertas            #/alertas/avisos        Avisos técnicos
//   #/escuelas             Escuelas           #/escuelas/<cct>        Escuelas con esa ficha abierta
//   #/autorizaciones       Autorizaciones
//   #/reportes             Reportes           #/reportes/estadisticas Estadísticas de reportes
const SECCION = { alertas: 'monitoreo', escuelas: 'escuelas', autorizaciones: 'autorizaciones', reportes: 'reportes' };
const HASH_DE = Object.fromEntries(Object.entries(SECCION).map(([h, s]) => [s, h]));

export function leerRuta(hash = window.location.hash) {
  const [h, sub] = hash.replace(/^#\/?/, '').split('/').map((x) => decodeURIComponent(x || ''));
  const seccion = SECCION[h] || 'monitoreo';
  return {
    seccion,
    vista: seccion === 'monitoreo' && sub === 'avisos' ? 'avisos' : 'alertas',
    escuela: seccion === 'escuelas' && sub ? sub : null,
    paginaReportes: seccion === 'reportes' && sub === 'estadisticas' ? 'dashboard' : 'incidencias',
  };
}

export function hashDe({ seccion, vista, escuela, paginaReportes }) {
  const base = '#/' + (HASH_DE[seccion] || 'alertas');
  if (seccion === 'monitoreo' && vista === 'avisos') return base + '/avisos';
  if (seccion === 'escuelas' && escuela) return base + '/' + encodeURIComponent(escuela);
  if (seccion === 'reportes' && paginaReportes === 'dashboard') return base + '/estadisticas';
  return base;
}

// Estado de la ruta y una función para ir a otra. reemplazar: true cambia la URL sin dejar un paso en el
// historial (para elegir otra escuela dentro de la misma lista, que no debe llenar el Atrás).
export function useRuta() {
  const [ruta, setRuta] = useState(() => leerRuta());
  useEffect(() => {
    const cambio = () => setRuta(leerRuta());
    window.addEventListener('hashchange', cambio);
    window.addEventListener('popstate', cambio);
    return () => { window.removeEventListener('hashchange', cambio); window.removeEventListener('popstate', cambio); };
  }, []);
  const ir = (cambios, { reemplazar = false } = {}) => {
    const nueva = { ...ruta, ...cambios };
    if (cambios.seccion && cambios.seccion !== ruta.seccion) {
      // al cambiar de sección se empieza en su página principal, salvo lo que se pida
      if (!('vista' in cambios)) nueva.vista = 'alertas';
      if (!('escuela' in cambios)) nueva.escuela = null;
      if (!('paginaReportes' in cambios)) nueva.paginaReportes = 'incidencias';
    }
    const h = hashDe(nueva);
    if (h === window.location.hash) return;
    if (reemplazar) window.history.replaceState(null, '', h);
    else window.history.pushState(null, '', h);
    setRuta(leerRuta(h));
  };
  return [ruta, ir];
}

import { hora, porAtender } from '../lib/formato.js';

// Lo que la autoridad necesita saber antes de abrir nada, con su hora de corte (I12).
export default function Resumen({ alertas, veredictos, totalEstaciones, corte }) {
  const activas = alertas.filter(porAtender);
  const criticas = activas.filter((a) => a.nivel === 'Critica').length;
  const sinResp = activas.filter((a) => !a.responsable).length;
  const conAviso = Object.keys(veredictos).filter((c) =>
    veredictos[c].slice(-4).some((v) => (v.avisos_tecnicos || []).length)).length;
  const cifras = [
    [criticas ? 'critica' : '', criticas, 'Críticas por atender', corte ? 'al ' + hora(corte) : 'sin datos'],
    ['', activas.length, 'Alertas por atender', alertas.length + ' en total'],
    ['', sinResp, 'Sin responsable', 'de las ' + activas.length + ' por atender'],
    ['', conAviso, 'Estaciones con falla técnica', 'de ' + totalEstaciones + ', en su última hora'],
  ];
  return (
    <div className="resumen" aria-live="polite">
      {cifras.map(([clase, n, etiqueta, nota]) => (
        <div key={etiqueta} className={'cifra ' + clase}>
          <b>{n}</b><span>{etiqueta}</span><small>{nota}</small>
        </div>
      ))}
    </div>
  );
}

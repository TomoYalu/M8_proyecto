/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Noticias
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import Tooltip from '../common/Tooltip';
import { formatFecha } from '../../utils/formatters';

/**
 * Indicador de semáforo de noticias: círculo verde/amarillo/rojo
 * con tooltip mostrando score y fecha.
 *
 * @param {object} props
 * @param {'verde'|'amarillo'|'rojo'} props.semaforo - Color del semáforo
 * @param {number} [props.score] - Score de sentimiento promedio
 * @param {string|Date} [props.fecha] - Fecha de última actualización
 *
 * Requisitos cubiertos: 6.4, 6.5
 */
export default function SemaforoIndicator({ semaforo, score, fecha }) {
  const colores = {
    verde: 'bg-bloomberg-green shadow-bloomberg-green/40',
    amarillo: 'bg-bloomberg-yellow shadow-bloomberg-yellow/40',
    rojo: 'bg-bloomberg-red shadow-bloomberg-red/40',
  };

  const etiquetas = {
    verde: 'Sentimiento positivo',
    amarillo: 'Sentimiento neutral',
    rojo: 'Sentimiento negativo',
  };

  const colorClass = colores[semaforo] || 'bg-bloomberg-text-muted/40';
  const etiqueta = etiquetas[semaforo] || 'Sin datos';

  const textoTooltip = [
    etiqueta,
    score != null ? `Score: ${score.toFixed(2)}` : null,
    fecha ? `Actualizado: ${formatFecha(fecha, true)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip texto={textoTooltip}>
      <span
        className={`inline-block w-3 h-3 rounded-full shadow-sm ${colorClass} cursor-default`}
        role="img"
        aria-label={`Semáforo ${semaforo}: ${etiqueta}`}
      />
    </Tooltip>
  );
}

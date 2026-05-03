/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Análisis Técnico
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { formatMoneda } from '../../utils/formatters';
import ChartHeader from './ChartHeader';

/**
 * Panel que muestra Stop Loss sugerido, Trailing Stop y precio actual.
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function StopLossPanel({ datos }) {
  if (!datos) return null;

  const precioActual = datos.resumen?.precio_actual;
  const stopLoss = datos.stop_loss;
  const trailingStop = datos.trailing_stop;

  if (precioActual == null && stopLoss == null && trailingStop == null) {
    return null;
  }

  const items = [
    {
      label: 'Precio Actual',
      valor: precioActual,
      color: 'text-bloomberg-text',
    },
    {
      label: 'Stop Loss Sugerido',
      valor: stopLoss,
      color: 'text-bloomberg-red',
      desc: 'Mín. 10 velas × 0.975',
    },
    {
      label: 'Trailing Stop (SAR)',
      valor: trailingStop,
      color: 'text-bloomberg-yellow',
      desc: 'SAR Parabólico',
    },
  ];

  return (
    <div className="p-4 rounded-lg bg-bloomberg-panel" role="region" aria-label="Stop Loss y Trailing Stop">
      <ChartHeader
        titulo="Stop Loss / Trailing Stop"
        tooltip="Stop Loss y Trailing Stop"
        detalle="El Stop Loss es un precio de salida protector que limita tus pérdidas si el mercado se mueve en tu contra. Se calcula 2.5% por debajo del mínimo reciente. El Trailing Stop (basado en SAR Parabólico) se ajusta automáticamente conforme el precio sube, protegiendo ganancias acumuladas. Ambos son herramientas esenciales de gestión de riesgo."
      />
      <div className="space-y-2">
        {items.map(({ label, valor, color, desc }) => (
          <div key={label} className="flex items-center justify-between">
            <div>
              <span className="text-sm text-bloomberg-text-muted">{label}</span>
              {desc && (
                <span className="text-xs text-bloomberg-text-muted ml-1">
                  ({desc})
                </span>
              )}
            </div>
            <span className={`text-sm font-mono font-medium ${color}`}>
              {valor != null ? formatMoneda(valor) : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Distancia al stop loss */}
      {precioActual != null && stopLoss != null && precioActual > 0 && (
        <div className="mt-3 pt-2 border-t border-bloomberg-accent/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-bloomberg-text-muted">
              Distancia al Stop Loss
            </span>
            <span className="text-xs font-mono text-bloomberg-red">
              {(((precioActual - stopLoss) / precioActual) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

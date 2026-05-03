/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Fiscal
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { formatNumero, formatMoneda } from '../../utils/formatters';

/**
 * Visualización del factor de ajuste inflacionario (INPC) por posición.
 *
 * Muestra barras visuales del factor INPC para cada posición,
 * indicando cuánto se ha ajustado el costo por inflación.
 *
 * Requisitos cubiertos: 9.2
 */
export default function InpcAdjustment({ posiciones = [] }) {
  if (!posiciones.length) {
    return (
      <div className="bg-bloomberg-panel rounded-lg p-6 text-center">
        <p className="text-bloomberg-text-muted">
          No hay posiciones para mostrar ajuste INPC.
        </p>
      </div>
    );
  }

  // Calcular rango para la barra visual
  const factores = posiciones.map((p) => p.factor_inpc);
  const minFactor = Math.min(...factores, 1);
  const maxFactor = Math.max(...factores, 1);
  const rango = maxFactor - minFactor || 0.1;

  return (
    <div className="bg-bloomberg-panel rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-bloomberg-bg">
        <h3 className="text-sm font-semibold text-bloomberg-text">
          Ajuste Inflacionario (INPC)
        </h3>
        <p className="text-xs text-bloomberg-text-muted mt-1">
          Factor = INPC venta / INPC compra. Un factor {'>'} 1 indica inflación acumulada.
        </p>
      </div>

      <div className="p-4 space-y-3">
        {posiciones.map((pos) => {
          const factor = pos.factor_inpc;
          const inflacion = ((factor - 1) * 100);
          const barWidth = Math.min(
            Math.max(((factor - minFactor) / rango) * 100, 5),
            100
          );

          return (
            <div key={pos.ticker} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-bloomberg-text">
                  {pos.ticker}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-bloomberg-text-muted text-xs">
                    Factor: {formatNumero(factor, 4)}
                  </span>
                  <span className={`text-xs font-medium ${
                    inflacion >= 0 ? 'text-bloomberg-yellow' : 'text-bloomberg-green'
                  }`}>
                    {inflacion >= 0 ? '+' : ''}{inflacion.toFixed(2)}% inflación
                  </span>
                </div>
              </div>

              {/* Barra visual */}
              <div className="w-full bg-bloomberg-bg rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    factor >= 1 ? 'bg-bloomberg-yellow' : 'bg-bloomberg-green'
                  }`}
                  style={{ width: `${barWidth}%` }}
                  role="progressbar"
                  aria-valuenow={factor}
                  aria-valuemin={minFactor}
                  aria-valuemax={maxFactor}
                  aria-label={`Factor INPC de ${pos.ticker}: ${formatNumero(factor, 4)}`}
                />
              </div>

              <div className="flex justify-between text-xs text-bloomberg-text-muted">
                <span>
                  Ganancia real: {formatMoneda(pos.ganancia_real_mxn, 'MXN')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

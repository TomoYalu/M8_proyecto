import { formatMoneda } from '../../utils/formatters';
import { FIBONACCI_COLORS } from '../../utils/colors';
import ChartHeader from './ChartHeader';

/**
 * Panel que muestra los niveles de retroceso de Fibonacci con precios.
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function FibonacciPanel({ datos }) {
  if (!datos?.fibonacci) return null;

  const { fibonacci } = datos;

  const niveles = [
    { key: 'nivel_0', label: '0%', pct: '0%' },
    { key: 'nivel_236', label: '23.6%', pct: '23.6%' },
    { key: 'nivel_382', label: '38.2%', pct: '38.2%' },
    { key: 'nivel_50', label: '50%', pct: '50%' },
    { key: 'nivel_618', label: '61.8%', pct: '61.8%' },
    { key: 'nivel_786', label: '78.6%', pct: '78.6%' },
    { key: 'nivel_100', label: '100%', pct: '100%' },
  ];

  return (
    <div className="p-4 rounded-lg bg-bloomberg-panel" role="region" aria-label="Niveles de Fibonacci">
      <ChartHeader
        titulo="Niveles de Fibonacci"
        tooltip="Niveles de retroceso de Fibonacci"
        detalle="Los niveles de Fibonacci son zonas de soporte y resistencia basadas en la secuencia matemática de Fibonacci. Se calculan entre el máximo y mínimo del período. Los niveles más importantes son 38.2%, 50% y 61.8%. Cuando el precio retrocede a estos niveles, puede encontrar soporte (en tendencia alcista) o resistencia (en tendencia bajista). Son útiles para identificar puntos de entrada."
      />
      <div className="space-y-1.5">
        {niveles.map(({ key, label, pct }) => {
          const valor = fibonacci[key];
          if (valor == null) return null;
          const color = FIBONACCI_COLORS[pct] || '#94a3b8';

          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="text-sm text-bloomberg-text-muted">{label}</span>
              </div>
              <span className="text-sm font-mono text-bloomberg-text">
                {formatMoneda(valor)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rango */}
      {fibonacci.maximo != null && fibonacci.minimo != null && (
        <div className="mt-3 pt-2 border-t border-bloomberg-accent/10 flex justify-between text-xs text-bloomberg-text-muted">
          <span>Máx: {formatMoneda(fibonacci.maximo)}</span>
          <span>Mín: {formatMoneda(fibonacci.minimo)}</span>
        </div>
      )}
    </div>
  );
}

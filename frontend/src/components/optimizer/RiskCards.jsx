/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
/**
 * Tarjetas de métricas de riesgo para portafolios óptimos.
 *
 * Muestra dos columnas (Max Sharpe y Min Varianza) con:
 * - Rendimiento, riesgo, Sharpe, Sortino, Beta, Max Drawdown
 * - VaR al 99% (diario, mensual, anual) en % y USD
 * - Proyección de retorno anual y escenario de estrés
 * - Interpretaciones textuales en español
 *
 * @param {object} props
 * @param {object} props.maxSharpe - Métricas del portafolio Max Sharpe
 * @param {object} props.minVarianza - Métricas del portafolio Min Varianza
 * @param {number} props.inversion - Monto de inversión
 * @param {number} props.rf - Tasa libre de riesgo utilizada (%)
 * @param {string} props.restricciones - Restricciones de peso aplicadas (ej: "5%-40%")
 *
 * Requisitos cubiertos: 6.6, 8.1, 8.2, 8.3, 8.5, 8.6, 7.7
 */
export default function RiskCards({ maxSharpe, minVarianza, inversion, rf, restricciones }) {
  if (!maxSharpe || !minVarianza) return null;

  return (
    <div aria-label="Tarjetas de métricas de riesgo" className="space-y-6">
      {/* Contexto: restricciones y tasa libre de riesgo */}
      <div className="flex flex-wrap gap-3 text-xs text-bloomberg-text-muted">
        {restricciones && (
          <span className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg">
            Restricciones: {restricciones}
          </span>
        )}
        {rf != null && (
          <span className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg">
            Tasa libre de riesgo: {rf.toFixed(2)}%
          </span>
        )}
        {inversion != null && (
          <span className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg">
            Inversión: ${inversion.toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </span>
        )}
      </div>

      {/* Dos columnas: Max Sharpe y Min Varianza */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioColumn
          titulo="Max Sharpe"
          color="text-bloomberg-green"
          accentBg="bg-bloomberg-green/10"
          accentBorder="border-bloomberg-green/20"
          metricas={maxSharpe}
          inversion={inversion}
        />
        <PortfolioColumn
          titulo="Min Varianza"
          color="text-bloomberg-accent"
          accentBg="bg-bloomberg-accent/10"
          accentBorder="border-bloomberg-accent/20"
          metricas={minVarianza}
          inversion={inversion}
        />
      </div>
    </div>
  );
}

/**
 * Columna de métricas para un portafolio óptimo.
 */
function PortfolioColumn({ titulo, color, accentBg, accentBorder, metricas, inversion }) {
  const {
    rendimiento, riesgo, sharpe, sortino, beta, max_drawdown, var: varData,
  } = metricas;

  return (
    <div className="space-y-4">
      {/* Header */}
      <h3 className={`text-sm font-bold uppercase tracking-widest ${color}`}>
        {titulo}
      </h3>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Rendimiento"
          value={`${rendimiento?.toFixed(2)}%`}
          valueColor="text-bloomberg-green"
        />
        <MetricCard
          label="Riesgo"
          value={`${riesgo?.toFixed(2)}%`}
          valueColor="text-bloomberg-yellow"
        />
        <MetricCard
          label="Sharpe"
          value={sharpe?.toFixed(3)}
          valueColor={color}
          interpretacion={interpretarSharpe(sharpe)}
        />
        <MetricCard
          label="Sortino"
          value={sortino?.toFixed(3)}
          valueColor={color}
        />
        <MetricCard
          label="Beta vs SPY"
          value={beta != null ? beta.toFixed(3) : 'N/A'}
          valueColor="text-bloomberg-text"
        />
        <MetricCard
          label="Max Drawdown"
          value={`${max_drawdown?.toFixed(2)}%`}
          valueColor="text-bloomberg-red"
          interpretacion={interpretarDrawdown(max_drawdown)}
        />
      </div>

      {/* VaR */}
      {varData && (
        <div className={`rounded-xl p-4 ${accentBg} border ${accentBorder}`}>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-bloomberg-text-muted mb-3">
            VaR 99% de Confianza
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <VarItem
              horizonte="Diario"
              pct={varData.diario}
              usd={varData.diario_usd}
            />
            <VarItem
              horizonte="Mensual"
              pct={varData.mensual}
              usd={varData.mensual_usd}
            />
            <VarItem
              horizonte="Anual"
              pct={varData.anual}
              usd={varData.anual_usd}
            />
          </div>
        </div>
      )}

      {/* Proyecciones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ProjectionCard
          titulo="Retorno Anual Proyectado"
          porcentaje={`+${rendimiento?.toFixed(2)}%`}
          monto={inversion ? `+$${((inversion * rendimiento) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} anual` : null}
          tipo="positivo"
        />
        <ProjectionCard
          titulo="Escenario de Estrés"
          porcentaje={`${max_drawdown?.toFixed(2)}%`}
          monto={inversion ? `-$${Math.abs((inversion * max_drawdown) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} en crisis` : null}
          tipo="negativo"
        />
      </div>
    </div>
  );
}

/**
 * Tarjeta individual de métrica.
 */
function MetricCard({ label, value, valueColor, interpretacion }) {
  return (
    <div className="bg-bloomberg-panel rounded-xl p-3 border border-white/5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-bloomberg-text-muted mb-1">
        {label}
      </p>
      <p className={`text-lg font-bold ${valueColor || 'text-bloomberg-text'}`}>
        {value}
      </p>
      {interpretacion && (
        <p className="text-[10px] text-bloomberg-text-muted mt-1 leading-tight">
          {interpretacion}
        </p>
      )}
    </div>
  );
}

/**
 * Item de VaR para un horizonte temporal.
 */
function VarItem({ horizonte, pct, usd }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-bloomberg-text-muted mb-1">
        {horizonte}
      </p>
      <p className="text-sm font-bold text-bloomberg-red">
        {pct != null ? `${pct.toFixed(2)}%` : 'N/A'}
      </p>
      {usd != null && (
        <p className="text-[10px] text-bloomberg-text-muted">
          ${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      )}
    </div>
  );
}

/**
 * Tarjeta de proyección (retorno o estrés).
 */
function ProjectionCard({ titulo, porcentaje, monto, tipo }) {
  const isPositivo = tipo === 'positivo';
  const bgColor = isPositivo ? 'bg-bloomberg-green/5' : 'bg-bloomberg-red/5';
  const borderColor = isPositivo ? 'border-bloomberg-green/15' : 'border-bloomberg-red/15';
  const textColor = isPositivo ? 'text-bloomberg-green' : 'text-bloomberg-red';

  return (
    <div className={`rounded-xl p-4 ${bgColor} border ${borderColor}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-bloomberg-text-muted mb-2">
        {titulo}
      </p>
      <p className={`text-2xl font-black ${textColor}`}>
        {porcentaje}
      </p>
      {monto && (
        <p className="text-xs text-bloomberg-text-muted mt-1">
          {monto}
        </p>
      )}
    </div>
  );
}

// --- Funciones de interpretación textual ---

/**
 * Interpreta el Sharpe Ratio en español.
 * Sharpe > 1 → "Excelente", 0.5-1 → "Bueno", < 0.5 → "Bajo"
 */
export function interpretarSharpe(sharpe) {
  if (sharpe == null) return null;
  if (sharpe > 1) return 'Excelente rendimiento ajustado por riesgo';
  if (sharpe >= 0.5) return 'Buen rendimiento ajustado por riesgo';
  return 'Rendimiento ajustado por riesgo bajo';
}

/**
 * Interpreta el Max Drawdown en español.
 * < -20% → advertencia de diversificación
 */
export function interpretarDrawdown(maxDrawdown) {
  if (maxDrawdown == null) return null;
  if (maxDrawdown < -20) return 'Caída máxima significativa, considere diversificar';
  return null;
}

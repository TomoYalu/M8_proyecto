/**
 * Tabla de asignación detallada / orden de ejecución.
 *
 * Muestra por activo: Ticker, Peso (%), Acciones, Monto (USD), Precio Spot,
 * Rendimiento Anual, Riesgo Anual, y contribución de riesgo como barras horizontales.
 *
 * @param {object} props
 * @param {object} props.portafolio - Métricas del portafolio (max_sharpe o min_varianza)
 *   Contiene: pesos, acciones, monto, risk_contrib (todos objetos ticker→valor)
 * @param {object} props.estadisticas - Estadísticas por ticker { AAPL: { rend_anual, std_anual, precio } }
 * @param {string} props.restricciones - Restricciones de peso aplicadas (ej: "5%-40%")
 * @param {number} props.rf - Tasa libre de riesgo utilizada (%)
 *
 * Requisitos cubiertos: 8.4, 8.5, 7.3
 */
export default function ExecutionTable({ portafolio, estadisticas, restricciones, rf }) {
  if (!portafolio || !portafolio.pesos) return null;

  const tickers = Object.keys(portafolio.pesos).sort(
    (a, b) => (portafolio.pesos[b] ?? 0) - (portafolio.pesos[a] ?? 0)
  );

  // Máximo de contribución de riesgo para escalar las barras
  const maxRiskContrib = Math.max(
    ...tickers.map((t) => portafolio.risk_contrib?.[t] ?? 0),
    1
  );

  // Totales
  const totalPeso = tickers.reduce((s, t) => s + (portafolio.pesos[t] ?? 0), 0);
  const totalMonto = tickers.reduce((s, t) => s + (portafolio.monto?.[t] ?? 0), 0);

  return (
    <div aria-label="Tabla de asignación detallada de activos" className="space-y-4">
      {/* Contexto */}
      {(restricciones || rf != null) && (
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
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-left" role="table">
          <thead>
            <tr className="text-bloomberg-text-muted text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
              <th className="pb-4 pr-3">Ticker</th>
              <th className="pb-4 pr-3 text-right">Peso (%)</th>
              <th className="pb-4 pr-3 text-right">Acciones</th>
              <th className="pb-4 pr-3 text-right">Monto (USD)</th>
              <th className="pb-4 pr-3 text-right">Precio Spot</th>
              <th className="pb-4 pr-3 text-right">Rend. Anual</th>
              <th className="pb-4 pr-3 text-right">Riesgo Anual</th>
              <th className="pb-4 text-left" style={{ minWidth: 120 }}>Contrib. Riesgo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {tickers.map((ticker) => {
              const peso = portafolio.pesos[ticker] ?? 0;
              const acciones = portafolio.acciones?.[ticker] ?? 0;
              const monto = portafolio.monto?.[ticker] ?? 0;
              const stats = estadisticas?.[ticker] ?? {};
              const riskContrib = portafolio.risk_contrib?.[ticker] ?? 0;
              const barWidth = maxRiskContrib > 0 ? (riskContrib / maxRiskContrib) * 100 : 0;

              return (
                <tr
                  key={ticker}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-4 pr-3">
                    <span className="font-bold text-bloomberg-text text-sm">
                      {ticker}
                    </span>
                  </td>
                  <td className="py-4 pr-3 text-right">
                    <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded text-xs font-bold text-bloomberg-text-muted">
                      {peso.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 pr-3 text-right font-bold text-bloomberg-text text-sm">
                    {acciones > 0 ? acciones.toLocaleString() : '—'}
                  </td>
                  <td className="py-4 pr-3 text-right font-bold text-bloomberg-accent text-sm">
                    {monto > 0
                      ? `$${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="py-4 pr-3 text-right text-sm text-bloomberg-text-muted">
                    {stats.precio != null
                      ? `$${Number(stats.precio).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="py-4 pr-3 text-right text-sm">
                    <span className={stats.rend_anual >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}>
                      {stats.rend_anual != null ? `${stats.rend_anual.toFixed(2)}%` : '—'}
                    </span>
                  </td>
                  <td className="py-4 pr-3 text-right text-sm text-bloomberg-yellow">
                    {stats.std_anual != null ? `${stats.std_anual.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-bloomberg-accent/60 transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-bloomberg-text-muted w-10 text-right">
                        {riskContrib.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Footer con totales */}
          <tfoot>
            <tr className="border-t border-white/10 text-sm font-bold">
              <td className="pt-4 pr-3 text-bloomberg-text">Total</td>
              <td className="pt-4 pr-3 text-right text-bloomberg-text">
                {totalPeso.toFixed(1)}%
              </td>
              <td className="pt-4 pr-3" />
              <td className="pt-4 pr-3 text-right text-bloomberg-accent">
                ${totalMonto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="pt-4" colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

import { formatNumero } from '../../utils/formatters';

/**
 * Tabla de resultados del filtro fundamental.
 * Muestra Ticker, Nombre, Sector, ROE, ROA, D/E, P/E con checkmarks verdes.
 *
 * @param {object} props
 * @param {Array} props.tickers - Lista de tickers aprobados con métricas
 * @param {number} props.totalEvaluados - Total de tickers evaluados
 * @param {number} props.totalAprobados - Total de tickers que pasaron
 *
 * Valida: Requisito 7.2
 */

const UMBRAL_ROE = 15;
const UMBRAL_ROA = 5;
const UMBRAL_DE = 1.5;

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-bloomberg-green inline-block"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function MetricCell({ valor, sufijo = '', pasa }) {
  if (valor == null) return <td className="px-4 py-3 text-bloomberg-text-muted">—</td>;

  return (
    <td className="px-4 py-3">
      <span className="flex items-center gap-1.5">
        {pasa && <CheckIcon />}
        <span className={pasa ? 'text-bloomberg-green' : 'text-bloomberg-text'}>
          {formatNumero(valor, 2)}{sufijo}
        </span>
      </span>
    </td>
  );
}

export default function FundamentalFilterTable({ tickers, totalEvaluados, totalAprobados }) {
  if (!tickers) return null;

  return (
    <div className="space-y-4" role="region" aria-label="Resultados del filtro fundamental">
      {/* Resumen */}
      <div className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
        <span className="text-sm text-bloomberg-text-muted">
          Resultado del filtro fundamental
        </span>
        <span className="text-sm font-medium text-bloomberg-text">
          <span className="text-bloomberg-green">{totalAprobados}</span>
          {' '}de{' '}
          <span>{totalEvaluados}</span>
          {' '}tickers aprobados
        </span>
      </div>

      {/* Tabla */}
      {tickers.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table
            className="w-full text-sm"
            role="table"
            aria-label="Tickers que pasaron el filtro fundamental"
          >
            <thead>
              <tr className="bg-white/5 text-bloomberg-text-muted text-left">
                <th className="px-4 py-3 font-medium" scope="col">Ticker</th>
                <th className="px-4 py-3 font-medium" scope="col">Nombre</th>
                <th className="px-4 py-3 font-medium" scope="col">Sector</th>
                <th className="px-4 py-3 font-medium" scope="col">ROE (%)</th>
                <th className="px-4 py-3 font-medium" scope="col">ROA (%)</th>
                <th className="px-4 py-3 font-medium" scope="col">D/E</th>
                <th className="px-4 py-3 font-medium" scope="col">P/E</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tickers.map((t) => (
                <tr
                  key={t.ticker}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-bloomberg-accent">
                    {t.ticker}
                  </td>
                  <td className="px-4 py-3 text-bloomberg-text">
                    {t.nombre || t.ticker}
                  </td>
                  <td className="px-4 py-3 text-bloomberg-text-muted">
                    {t.sector || 'N/A'}
                  </td>
                  <MetricCell
                    valor={t.roe}
                    sufijo="%"
                    pasa={t.roe != null && t.roe > UMBRAL_ROE}
                  />
                  <MetricCell
                    valor={t.roa}
                    sufijo="%"
                    pasa={t.roa != null && t.roa > UMBRAL_ROA}
                  />
                  <MetricCell
                    valor={t.de}
                    pasa={t.de != null && t.de < UMBRAL_DE}
                  />
                  <MetricCell
                    valor={t.pe}
                    pasa={t.pe != null}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-bloomberg-text-muted text-sm">
          Ningún ticker pasó el filtro fundamental con los criterios actuales.
        </div>
      )}
    </div>
  );
}

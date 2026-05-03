import SemaforoIndicator from './SemaforoIndicator';

/**
 * Panel resumen de semáforos de todos los tickers del portafolio activo.
 * Muestra un grid de ticker + SemaforoIndicator.
 *
 * @param {object} props
 * @param {object} props.semaforos - Mapa { ticker: { semaforo, score, total_noticias } }
 *
 * Requisitos cubiertos: 6.4, 6.5
 */
export default function SemaforoPanel({ semaforos = {} }) {
  const tickers = Object.keys(semaforos).sort();

  if (tickers.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-bloomberg-panel/50 p-4">
        <h2 className="text-sm font-semibold text-bloomberg-text mb-2">
          Semáforo de Noticias
        </h2>
        <p className="text-xs text-bloomberg-text-muted">
          No hay datos de semáforo disponibles. Agregue tickers a su portafolio.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-white/5 bg-bloomberg-panel/50 p-4"
      aria-label="Panel de semáforos de noticias"
    >
      <h2 className="text-sm font-semibold text-bloomberg-text mb-3">
        Semáforo de Noticias
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tickers.map((ticker) => {
          const data = semaforos[ticker];
          return (
            <div
              key={ticker}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bloomberg-bg/50
                         border border-white/5"
            >
              <SemaforoIndicator
                semaforo={data.semaforo}
                score={data.score}
                fecha={data.fecha}
              />
              <div className="min-w-0">
                <span className="text-xs font-medium text-bloomberg-text truncate block">
                  {ticker}
                </span>
                {data.total_noticias != null && (
                  <span className="text-[10px] text-bloomberg-text-muted">
                    {data.total_noticias} noticia{data.total_noticias !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../../store';
import { contadorFavoritos } from '../../store/favoritosSlice';
import { obtenerNombre } from '../../constants/tickers';
import { obtenerSector } from '../../constants/sectors';

/**
 * Panel colapsable "En espera" con tickers marcados como favoritos.
 * Cada favorito muestra: ticker, nombre corto, sector, botón eliminar (X)
 * y botón "Agregar a portafolio".
 *
 * @param {object} props
 * @param {function} props.onAgregar - Callback(ticker) cuando el usuario quiere agregar un favorito al portafolio
 *
 * Requisitos cubiertos: plan-v1.1 B3
 */
export default function FavoritosPanel({ onAgregar }) {
  const [colapsado, setColapsado] = useState(false);
  const favoritos = useStore((s) => s.favoritos);
  const eliminarFavorito = useStore((s) => s.eliminarFavorito);
  const count = useStore(contadorFavoritos);

  return (
    <section
      className="bg-bloomberg-panel rounded-xl border border-white/5 overflow-hidden"
      aria-label="Favoritos en espera"
    >
      {/* Header colapsable con badge */}
      <button
        onClick={() => setColapsado(!colapsado)}
        className="w-full px-4 py-3 flex items-center justify-between
                   hover:bg-white/[0.02] transition-colors"
        aria-expanded={!colapsado}
        aria-controls="favoritos-panel-content"
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 text-bloomberg-text-muted transition-transform ${
              colapsado ? '' : 'rotate-90'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-bloomberg-text-muted uppercase tracking-wider">
            Favoritos
          </h3>
          {/* Badge con contador */}
          {count > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                         text-[10px] font-bold rounded-full bg-yellow-400/20 text-yellow-400"
              aria-label={`${count} favorito${count !== 1 ? 's' : ''}`}
            >
              {count}
            </span>
          )}
        </div>
      </button>

      {/* Contenido colapsable */}
      {!colapsado && (
        <div
          id="favoritos-panel-content"
          className="border-t border-white/5"
        >
          {favoritos.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-bloomberg-text-muted">
                Sin favoritos aún
              </p>
              <Link
                to="/busqueda"
                className="inline-block mt-2 text-xs text-bloomberg-accent hover:underline"
              >
                🔍 Ir al buscador de activos
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-white/5" role="list" aria-label="Lista de favoritos">
              {favoritos.map((ticker) => {
                const nombre = obtenerNombre(ticker);
                const sector = obtenerSector(ticker);

                return (
                  <li
                    key={ticker}
                    className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02]
                               transition-colors group"
                  >
                    {/* Ticker info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-bloomberg-accent shrink-0">
                          {ticker}
                        </span>
                        <span className="text-xs text-bloomberg-text truncate">
                          {nombre}
                        </span>
                      </div>
                      <span className="text-[10px] text-bloomberg-text-muted truncate block mt-0.5">
                        {sector}
                      </span>
                    </div>

                    {/* Agregar a portafolio */}
                    <button
                      onClick={() => onAgregar?.(ticker)}
                      className="shrink-0 px-2 py-1 text-[10px] font-medium rounded
                                 bg-bloomberg-green/15 text-bloomberg-green
                                 hover:bg-bloomberg-green/25 transition-colors
                                 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Agregar ${ticker} a portafolio`}
                      title="Agregar a portafolio"
                      type="button"
                    >
                      + Portafolio
                    </button>

                    {/* Eliminar de favoritos */}
                    <button
                      onClick={() => eliminarFavorito(ticker)}
                      className="shrink-0 p-1 rounded text-bloomberg-text-muted
                                 hover:text-bloomberg-red hover:bg-bloomberg-red/10
                                 transition-colors"
                      aria-label={`Quitar ${ticker} de favoritos`}
                      title="Quitar de favoritos"
                      type="button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

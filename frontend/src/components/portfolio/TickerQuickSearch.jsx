import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { INDICES } from '../../constants/tickers';
import { obtenerSector } from '../../constants/sectors';
import useTickerAutocomplete, { obtenerNombre } from '../../hooks/useTickerAutocomplete';
import useStore from '../../store';

/**
 * Obtiene los índices a los que pertenece un ticker.
 * @param {string} ticker
 * @returns {string[]}
 */
function obtenerIndices(ticker) {
  const resultado = [];
  for (const [nombre, datos] of Object.entries(INDICES)) {
    if (datos.tickers.includes(ticker)) {
      resultado.push(nombre);
    }
  }
  return resultado;
}

/**
 * Botón de estrella para marcar/desmarcar un ticker como favorito.
 * @param {object} props
 * @param {string} props.ticker
 */
function FavoritoButton({ ticker }) {
  const esFav = useStore((s) => s.favoritos.includes(ticker));
  const toggleFavorito = useStore((s) => s.toggleFavorito);

  return (
    <button
      onClick={() => toggleFavorito(ticker)}
      className={`p-1.5 rounded-lg transition-colors ${
        esFav
          ? 'text-yellow-400 bg-yellow-400/15 hover:bg-yellow-400/25'
          : 'text-bloomberg-text-muted hover:text-yellow-400 hover:bg-white/5'
      }`}
      aria-label={esFav ? `Quitar ${ticker} de favoritos` : `Agregar ${ticker} a favoritos`}
      aria-pressed={esFav}
      title={esFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        fill={esFav ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
}

/**
 * Búsqueda rápida de tickers con autocompletado para la pantalla de portafolios.
 * Usa el hook useTickerAutocomplete para filtrado, debounce y navegación por teclado.
 * Al seleccionar un ticker muestra una mini-card con información resumida.
 *
 * @param {object} props
 * @param {function} props.onAgregar - Callback cuando el usuario quiere agregar un ticker al portafolio
 *
 * Requisitos cubiertos: plan-v1.1 B2, 2.1 (reutilización de lógica)
 */
export default function TickerQuickSearch({ onAgregar }) {
  const [seleccionado, setSeleccionado] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Use the shared autocomplete hook for filtering, debounce, and keyboard navigation
  const {
    query,
    setQuery,
    sugerencias,
    indiceActivo,
    setIndiceActivo,
    abierto,
    setAbierto,
    handleKeyDown,
    seleccionar,
    limpiar,
  } = useTickerAutocomplete();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setAbierto]);

  // Scroll active option into view
  useEffect(() => {
    if (indiceActivo >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      if (items[indiceActivo]) {
        items[indiceActivo].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [indiceActivo]);

  // Wrap hook's seleccionar to also set the mini-card selection
  const handleSelect = useCallback((ticker) => {
    seleccionar(ticker);  // from hook — sets query, closes dropdown
    setSeleccionado(ticker);
  }, [seleccionar]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setAbierto(true);
    setSeleccionado(null);
  };

  // Wrap hook's limpiar to also clear the mini-card selection
  const handleClear = useCallback(() => {
    limpiar();  // from hook — clears query, closes dropdown
    setSeleccionado(null);
    inputRef.current?.focus();
  }, [limpiar]);

  const handleAgregar = () => {
    if (seleccionado && onAgregar) {
      onAgregar(seleccionado);
    }
  };

  // Build mini-card data for selected ticker
  const miniCardData = useMemo(() => {
    if (!seleccionado) return null;
    return {
      ticker: seleccionado,
      nombre: obtenerNombre(seleccionado),
      sector: obtenerSector(seleccionado),
      indices: obtenerIndices(seleccionado),
    };
  }, [seleccionado]);

  const listboxId = 'ticker-quick-search-listbox';

  return (
    <div ref={containerRef} className="w-full">
      {/* Search input */}
      <div className="relative">
        <label htmlFor="ticker-quick-search" className="sr-only">
          Búsqueda rápida de ticker
        </label>
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bloomberg-text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            id="ticker-quick-search"
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.trim() && sugerencias.length > 0) setAbierto(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar ticker, empresa o sector..."
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-bloomberg-bg border border-white/10
                       text-bloomberg-text placeholder-bloomberg-text-muted/50 text-sm
                       focus:outline-none focus:ring-1 focus:ring-bloomberg-accent
                       focus:border-bloomberg-accent transition-colors"
            role="combobox"
            aria-expanded={abierto && sugerencias.length > 0}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={
              indiceActivo >= 0 ? `ticker-option-${indiceActivo}` : undefined
            }
            autoComplete="off"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded
                         text-bloomberg-text-muted hover:text-bloomberg-text transition-colors"
              aria-label="Limpiar búsqueda"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
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
          )}
        </div>

        {/* Dropdown results */}
        {abierto && sugerencias.length > 0 && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Resultados de búsqueda de tickers"
            className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg
                       bg-bloomberg-panel border border-white/10 shadow-xl"
          >
            {sugerencias.map((ticker, idx) => {
              const nombre = obtenerNombre(ticker);
              const sector = obtenerSector(ticker);
              const isActive = idx === indiceActivo;
              return (
                <li
                  key={ticker}
                  id={`ticker-option-${idx}`}
                  role="option"
                  aria-selected={isActive}
                  className={`px-3 py-2.5 cursor-pointer transition-colors border-b border-white/5
                    last:border-b-0
                    ${isActive ? 'bg-bloomberg-accent/15' : 'hover:bg-white/5'}`}
                  onClick={() => handleSelect(ticker)}
                  onMouseEnter={() => setIndiceActivo(idx)}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-bloomberg-accent shrink-0">
                      {ticker}
                    </span>
                    <span className="text-xs text-bloomberg-text-muted">—</span>
                    <span className="text-sm text-bloomberg-text truncate">
                      {nombre}
                    </span>
                  </div>
                  <div className="text-xs text-bloomberg-text-muted mt-0.5 truncate">
                    {sector}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* No results message */}
        {abierto && query.trim() && sugerencias.length === 0 && (
          <div
            className="absolute z-50 mt-1 w-full rounded-lg bg-bloomberg-panel
                       border border-white/10 shadow-xl px-3 py-3"
            role="status"
          >
            <p className="text-sm text-bloomberg-text-muted text-center">
              No se encontraron tickers para &quot;{query}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Mini-card for selected ticker */}
      {miniCardData && (
        <div
          className="mt-3 rounded-lg bg-bloomberg-bg border border-white/10 p-3"
          aria-label={`Información de ${miniCardData.ticker}`}
          role="region"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Ticker + Name */}
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-bloomberg-accent">
                  {miniCardData.ticker}
                </span>
                <span className="text-sm text-bloomberg-text truncate">
                  {miniCardData.nombre}
                </span>
              </div>

              {/* Sector */}
              <div className="mt-1">
                <span className="inline-block text-xs px-2 py-0.5 rounded-full
                                 bg-bloomberg-accent/10 text-bloomberg-accent">
                  {miniCardData.sector}
                </span>
              </div>

              {/* Indices */}
              {miniCardData.indices.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {miniCardData.indices.map((indice) => (
                    <span
                      key={indice}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/5
                                 text-bloomberg-text-muted"
                    >
                      {indice}
                    </span>
                  ))}
                </div>
              )}

              {/* Price placeholder */}
              <div className="mt-2 flex items-center gap-3">
                <div>
                  <span className="text-[10px] uppercase text-bloomberg-text-muted block">
                    Precio
                  </span>
                  <span className="text-sm text-bloomberg-text-muted">—</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-bloomberg-text-muted block">
                    Cambio día
                  </span>
                  <span className="text-sm text-bloomberg-text-muted">—</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="shrink-0 flex flex-col gap-2 items-end">
              {/* Favorite star button */}
              <FavoritoButton ticker={miniCardData.ticker} />

              {/* Add to portfolio button */}
              <button
                onClick={handleAgregar}
                className="px-3 py-1.5 text-xs font-medium rounded-lg
                           bg-bloomberg-green/20 text-bloomberg-green
                           hover:bg-bloomberg-green/30 transition-colors
                           flex items-center gap-1.5"
                aria-label={`Agregar ${miniCardData.ticker} al portafolio`}
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Agregar al portafolio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
import { TICKERS_POR_CATEGORIA, NOMBRE_POR_TICKER } from '../../constants/tickers';

/**
 * Calcula la distancia de Levenshtein entre dos cadenas.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/**
 * Campo de búsqueda con autocompletado de tickers populares.
 * Soporta búsqueda fuzzy: substring, nombre de empresa y distancia de edición.
 *
 * @param {object} props
 * @param {function} props.onSelect - Callback al seleccionar un ticker
 * @param {string} [props.valorInicial=''] - Valor inicial del campo
 */
export default function TickerSearch({ onSelect, valorInicial = '' }) {
  const [query, setQuery] = useState(valorInicial);
  const [abierto, setAbierto] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Sincronizar con valorInicial cuando cambia externamente (ej. desde URL params)
  useEffect(() => {
    if (valorInicial && valorInicial !== query) {
      setQuery(valorInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorInicial]);

  // Lista plana de todos los tickers
  const todosTickers = useMemo(() => {
    const set = new Set();
    Object.values(TICKERS_POR_CATEGORIA).forEach((lista) =>
      lista.forEach((t) => set.add(t))
    );
    return Array.from(set).sort();
  }, []);

  // Filtrar por query con fuzzy matching
  const filtrados = useMemo(() => {
    if (!query.trim()) {
      return todosTickers.slice(0, 15).map((t) => ({
        ticker: t,
        nombre: NOMBRE_POR_TICKER[t] || t,
        tipo: 'default',
      }));
    }

    const q = query.trim().toUpperCase();
    const qLower = query.trim().toLowerCase();

    const exactos = [];   // Substring match en ticker
    const porNombre = []; // Match en nombre de empresa
    const fuzzy = [];     // Levenshtein distance 1-2

    for (const t of todosTickers) {
      const nombre = NOMBRE_POR_TICKER[t] || '';

      // 1. Exact substring match en ticker
      if (t.toUpperCase().includes(q)) {
        exactos.push({ ticker: t, nombre: nombre || t, tipo: 'exact' });
        continue;
      }

      // 2. Match en nombre de empresa
      if (nombre && nombre.toLowerCase().includes(qLower)) {
        porNombre.push({ ticker: t, nombre, tipo: 'name' });
        continue;
      }

      // 3. Levenshtein distance (solo si query es corta, para rendimiento)
      if (q.length >= 2 && q.length <= 6) {
        const dist = levenshtein(q, t.toUpperCase());
        if (dist <= 2) {
          fuzzy.push({ ticker: t, nombre: nombre || t, tipo: 'fuzzy', dist });
        }
      }
    }

    // Ordenar fuzzy por distancia
    fuzzy.sort((a, b) => a.dist - b.dist);

    return [...exactos, ...porNombre, ...fuzzy].slice(0, 15);
  }, [query, todosTickers]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (ticker) => {
    setQuery(ticker);
    setAbierto(false);
    onSelect?.(ticker);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = query.trim().toUpperCase();
      if (val) {
        handleSelect(val);
      }
    }
    if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <label htmlFor="ticker-search" className="sr-only">
        Buscar ticker
      </label>
      <input
        ref={inputRef}
        id="ticker-search"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar ticker o empresa (ej. AAPL, nvidia)"
        className="w-full px-3 py-2 rounded-lg bg-bloomberg-bg border border-bloomberg-accent/30
                   text-bloomberg-text placeholder-bloomberg-text-muted text-sm
                   focus:outline-none focus:border-bloomberg-accent"
        aria-label="Buscar ticker"
        aria-expanded={abierto}
        aria-autocomplete="list"
        aria-controls="ticker-list"
        role="combobox"
        autoComplete="off"
      />

      {abierto && filtrados.length > 0 && (
        <ul
          id="ticker-list"
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg
                     bg-bloomberg-panel border border-bloomberg-accent/20 shadow-lg"
        >
          {filtrados.map((item) => (
            <li
              key={item.ticker}
              role="option"
              aria-selected={item.ticker === query.toUpperCase()}
              className="px-3 py-2 text-sm cursor-pointer
                         hover:bg-bloomberg-accent/10 transition-colors flex items-center gap-2"
              onClick={() => handleSelect(item.ticker)}
            >
              <span className="font-mono font-semibold text-bloomberg-accent">
                {item.ticker}
              </span>
              <span className="text-bloomberg-text-muted truncate">
                — {item.nombre}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

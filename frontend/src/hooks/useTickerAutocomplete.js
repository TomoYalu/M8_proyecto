import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { TICKERS_POR_CATEGORIA, INDICES, obtenerNombre } from '../constants/tickers';
import { SECTOR_POR_TICKER, obtenerSector } from '../constants/sectors';

/**
 * Hook para autocompletado de tickers contra el catálogo local.
 *
 * Extrae la lógica de filtrado, debounce y navegación por teclado
 * de TickerQuickSearch en un hook reutilizable.
 *
 * @param {object} opciones
 * @param {number} [opciones.debounceMs=200] - Milisegundos de debounce
 * @param {number} [opciones.maxResultados=10] - Máximo de sugerencias
 * @returns {{ query: string, setQuery: function, sugerencias: string[],
 *             indiceActivo: number, setIndiceActivo: function,
 *             abierto: boolean, setAbierto: function,
 *             handleKeyDown: function, seleccionar: function, limpiar: function }}
 */
export default function useTickerAutocomplete(opciones = {}) {
  const { debounceMs = 200, maxResultados = 10 } = opciones;

  const [query, setQuery] = useState('');
  const [queryDebounced, setQueryDebounced] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const debounceRef = useRef(null);

  // Flat deduplicated list of all tickers
  const todosTickers = useMemo(() => {
    const set = new Set();
    Object.values(TICKERS_POR_CATEGORIA).forEach((lista) =>
      lista.forEach((t) => set.add(t)),
    );
    Object.values(INDICES).forEach((datos) =>
      datos.tickers.forEach((t) => set.add(t)),
    );
    Object.keys(SECTOR_POR_TICKER).forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, []);

  // Debounce the query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQueryDebounced(query);
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, debounceMs]);

  // Filter tickers based on debounced query (match ticker, name, or sector)
  const sugerencias = useMemo(() => {
    if (!queryDebounced.trim()) return [];
    const q = queryDebounced.toUpperCase().trim();
    const qLower = queryDebounced.toLowerCase().trim();
    return todosTickers
      .filter((ticker) => {
        if (ticker.toUpperCase().includes(q)) return true;
        const nombre = obtenerNombre(ticker).toLowerCase();
        if (nombre.includes(qLower)) return true;
        const sector = obtenerSector(ticker).toLowerCase();
        if (sector.includes(qLower)) return true;
        return false;
      })
      .slice(0, maxResultados);
  }, [queryDebounced, todosTickers, maxResultados]);

  // Select a ticker from the suggestions
  const seleccionar = useCallback((ticker) => {
    setQuery(ticker);
    setAbierto(false);
    setIndiceActivo(-1);
  }, []);

  // Clear the query and reset state
  const limpiar = useCallback(() => {
    setQuery('');
    setAbierto(false);
    setIndiceActivo(-1);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e) => {
      if (!abierto || sugerencias.length === 0) {
        if (e.key === 'ArrowDown' && query.trim()) {
          setAbierto(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setIndiceActivo((prev) =>
            prev < sugerencias.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setIndiceActivo((prev) =>
            prev > 0 ? prev - 1 : sugerencias.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (indiceActivo >= 0 && sugerencias[indiceActivo]) {
            seleccionar(sugerencias[indiceActivo]);
          }
          break;
        case 'Escape':
          setAbierto(false);
          setIndiceActivo(-1);
          break;
        default:
          break;
      }
    },
    [abierto, sugerencias, query, indiceActivo, seleccionar],
  );

  return {
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
  };
}

// Re-export obtenerNombre for consumers that need to display company names
export { obtenerNombre } from '../constants/tickers';

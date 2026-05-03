import { useState, useMemo } from 'react';
import useStore from '../../store';

/**
 * Ícono de ordenamiento para encabezados de columna.
 */
function SortIcon({ activo, direccion }) {
  if (!activo) {
    return (
      <svg className="w-3 h-3 text-bloomberg-text-muted/40 ml-1 inline" fill="none"
           viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 text-bloomberg-accent ml-1 inline" fill="none"
         viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d={direccion === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  );
}

/**
 * Estrella de favorito inline.
 */
function FavoritoStar({ ticker }) {
  const favoritos = useStore((s) => s.favoritos);
  const toggleFavorito = useStore((s) => s.toggleFavorito);
  const esFav = favoritos.includes(ticker);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorito(ticker);
      }}
      className="p-0.5 transition-colors hover:scale-110 transform"
      title={esFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      aria-label={esFav ? `Quitar ${ticker} de favoritos` : `Agregar ${ticker} a favoritos`}
    >
      {esFav ? (
        <svg className="w-4 h-4 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-bloomberg-text-muted/40 hover:text-yellow-400" fill="none"
             viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Spinner pequeño para celdas en carga.
 */
function CellSpinner() {
  return (
    <div className="flex justify-end">
      <div className="w-3 h-3 border border-bloomberg-accent/30 border-t-bloomberg-accent
                      rounded-full animate-spin" />
    </div>
  );
}

/**
 * Columnas de la tabla.
 */
const COLUMNAS = [
  { key: 'ticker',     label: 'Ticker',    sortable: true,  align: 'left',  width: 'w-[100px]' },
  { key: 'nombre',     label: 'Nombre',    sortable: true,  align: 'left',  width: 'max-w-[180px]' },
  { key: 'sector',     label: 'Sector',    sortable: true,  align: 'left',  width: 'max-w-[150px]' },
  { key: 'indices',    label: 'Índice(s)', sortable: false, align: 'left',  width: 'max-w-[200px]' },
  { key: 'precio',     label: 'Precio',    sortable: true,  align: 'right', width: 'w-[90px]' },
  { key: 'cambio_pct', label: 'Cambio %',  sortable: true,  align: 'right', width: 'w-[90px]' },
  { key: 'rsi',        label: 'RSI',       sortable: true,  align: 'right', width: 'w-[90px]' },
  { key: 'pe',         label: 'P/E',       sortable: true,  align: 'right', width: 'w-[90px]' },
];

/**
 * Tabla de resultados de búsqueda de activos con datos en vivo y favoritos inline.
 *
 * @param {object} props
 * @param {Array} props.datos - Array de objetos ticker
 * @param {Set} props.seleccionados - Set de tickers seleccionados
 * @param {function} props.onToggleSeleccion - Callback al seleccionar/deseleccionar un ticker
 * @param {function} props.onToggleTodos - Callback al seleccionar/deseleccionar todos
 * @param {object} props.datosEnVivo - Mapa ticker → { precio, cambio_pct, rsi, pe } del endpoint de enriquecimiento
 * @param {boolean} props.cargandoDatos - Si se están cargando datos en vivo
 * @param {number} props.paginaActual - Página actual (0-indexed)
 * @param {number} props.totalPaginas - Total de páginas
 * @param {function} props.onCambiarPagina - Callback al cambiar de página
 * @param {function} [props.onTickerClick] - Callback al hacer clic en un ticker para abrir el drawer
 */
export default function SearchResultsTable({
  datos,
  seleccionados,
  onToggleSeleccion,
  onToggleTodos,
  datosEnVivo = {},
  cargandoDatos = false,
  paginaActual = 0,
  totalPaginas = 1,
  onCambiarPagina,
  onTickerClick,
}) {
  const [sortKey, setSortKey] = useState('ticker');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (!COLUMNAS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const datosOrdenados = useMemo(() => {
    const sorted = [...datos].sort((a, b) => {
      // Para columnas numéricas, usar datos en vivo si están disponibles
      const numericKeys = ['precio', 'cambio_pct', 'rsi', 'pe'];
      if (numericKeys.includes(sortKey)) {
        const valA = datosEnVivo[a.ticker]?.[sortKey] ?? null;
        const valB = datosEnVivo[b.ticker]?.[sortKey] ?? null;
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      // Para columnas de texto
      const valA = (a[sortKey] || '').toString().toLowerCase();
      const valB = (b[sortKey] || '').toString().toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [datos, sortKey, sortDir, datosEnVivo]);

  const todosSeleccionados = datos.length > 0 && datos.every((d) => seleccionados.has(d.ticker));
  const algunoSeleccionado = datos.some((d) => seleccionados.has(d.ticker));

  const formatPrecio = (val) => {
    if (val == null) return '—';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCambio = (val) => {
    if (val == null) return '—';
    const signo = val >= 0 ? '+' : '';
    return `${signo}${val.toFixed(2)}%`;
  };

  const formatNum = (val) => {
    if (val == null) return '—';
    return val.toFixed(2);
  };

  const cambioColor = (val) => {
    if (val == null) return 'text-bloomberg-text-muted';
    return val >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red';
  };

  const rsiColor = (val) => {
    if (val == null) return 'text-bloomberg-text-muted';
    if (val > 70) return 'text-bloomberg-red';
    if (val < 30) return 'text-bloomberg-green';
    return 'text-bloomberg-text';
  };

  return (
    <div className="flex-1 bg-bloomberg-panel rounded-xl border border-white/5 overflow-hidden flex flex-col">
      {/* Encabezado con conteo */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-bloomberg-text">Resultados</h2>
          <span className="text-xs text-bloomberg-text-muted tabular-nums">
            {datos.length} activo{datos.length !== 1 ? 's' : ''}
          </span>
          {cargandoDatos && (
            <span className="text-xs text-bloomberg-accent flex items-center gap-1">
              <div className="w-2.5 h-2.5 border border-bloomberg-accent/30 border-t-bloomberg-accent
                              rounded-full animate-spin" />
              Cargando datos...
            </span>
          )}
        </div>
        {seleccionados.size > 0 && (
          <span className="text-xs text-bloomberg-accent tabular-nums">
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[800px] text-xs" role="grid" aria-label="Resultados de búsqueda de activos">
          <thead className="sticky top-0 z-10">
            <tr className="bg-bloomberg-bg/80 backdrop-blur-sm border-b border-white/5">
              {/* Columna de favoritos */}
              <th className="w-8 px-2 py-2.5" aria-label="Favoritos" />
              {/* Checkbox "seleccionar todos" */}
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  ref={(el) => {
                    if (el) el.indeterminate = algunoSeleccionado && !todosSeleccionados;
                  }}
                  onChange={onToggleTodos}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-bloomberg-bg
                             text-bloomberg-accent focus:ring-bloomberg-accent focus:ring-1
                             focus:ring-offset-0 cursor-pointer accent-bloomberg-accent"
                  aria-label="Seleccionar todos los activos"
                />
              </th>
              {COLUMNAS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 font-semibold text-bloomberg-text-muted uppercase tracking-wider
                              ${col.width || ''}
                              ${col.align === 'right' ? 'text-right' : 'text-left'}
                              ${col.sortable ? 'cursor-pointer hover:text-bloomberg-text select-none' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc' ? 'ascending' : 'descending'
                      : 'none'
                  }
                >
                  {col.label}
                  {col.sortable && (
                    <SortIcon activo={sortKey === col.key} direccion={sortDir} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {datosOrdenados.length === 0 ? (
              <tr>
                <td colSpan={COLUMNAS.length + 2} className="px-4 py-12 text-center text-bloomberg-text-muted">
                  No se encontraron activos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              datosOrdenados.map((item) => {
                const isSelected = seleccionados.has(item.ticker);
                const live = datosEnVivo[item.ticker];
                return (
                  <tr
                    key={item.ticker}
                    className={`transition-colors hover:bg-white/[0.03]
                                ${isSelected ? 'bg-bloomberg-accent/5' : ''}`}
                  >
                    {/* Estrella de favoritos */}
                    <td className="w-8 px-2 py-2 text-center">
                      <FavoritoStar ticker={item.ticker} />
                    </td>
                    {/* Checkbox */}
                    <td className="w-10 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSeleccion(item.ticker)}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-bloomberg-bg
                                   text-bloomberg-accent focus:ring-bloomberg-accent focus:ring-1
                                   focus:ring-offset-0 cursor-pointer accent-bloomberg-accent"
                        aria-label={`Seleccionar ${item.ticker}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-bloomberg-accent w-[100px]">
                      <button
                        type="button"
                        onClick={() => onTickerClick?.(item.ticker)}
                        className="hover:underline hover:text-bloomberg-accent/80 cursor-pointer
                                   transition-colors text-left"
                      >
                        {item.ticker}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-bloomberg-text truncate max-w-[180px]">
                      <button
                        type="button"
                        onClick={() => onTickerClick?.(item.ticker)}
                        className="hover:text-bloomberg-accent cursor-pointer transition-colors
                                   text-left truncate block w-full"
                      >
                        {item.nombre}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-bloomberg-text-muted truncate max-w-[150px]">
                      {item.sector}
                    </td>
                    <td className="px-3 py-2 text-bloomberg-text-muted max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {item.indices.length > 0 ? (
                          item.indices.map((idx) => (
                            <span
                              key={idx}
                              className="inline-block px-1.5 py-0.5 rounded text-[10px]
                                         bg-bloomberg-accent/10 text-bloomberg-accent/80
                                         border border-bloomberg-accent/20"
                            >
                              {idx}
                            </span>
                          ))
                        ) : (
                          <span className="text-bloomberg-text-muted/40">—</span>
                        )}
                      </div>
                    </td>
                    {/* Precio */}
                    <td className="px-3 py-2 text-right text-bloomberg-text tabular-nums w-[90px]">
                      {cargandoDatos && !live ? <CellSpinner /> : formatPrecio(live?.precio)}
                    </td>
                    {/* Cambio % */}
                    <td className={`px-3 py-2 text-right tabular-nums w-[90px] ${cambioColor(live?.cambio_pct)}`}>
                      {cargandoDatos && !live ? <CellSpinner /> : formatCambio(live?.cambio_pct)}
                    </td>
                    {/* RSI */}
                    <td className={`px-3 py-2 text-right tabular-nums w-[90px] ${rsiColor(live?.rsi)}`}>
                      {cargandoDatos && !live ? <CellSpinner /> : formatNum(live?.rsi)}
                    </td>
                    {/* P/E */}
                    <td className="px-3 py-2 text-right text-bloomberg-text tabular-nums w-[90px]">
                      {cargandoDatos && !live ? <CellSpinner /> : formatNum(live?.pe)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <span className="text-xs text-bloomberg-text-muted">
            Página {paginaActual + 1} de {totalPaginas}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paginaActual === 0}
              onClick={() => onCambiarPagina?.(paginaActual - 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg
                         bg-bloomberg-bg border border-white/10 text-bloomberg-text-muted
                         hover:text-bloomberg-text hover:border-white/20
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Página anterior"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={paginaActual >= totalPaginas - 1}
              onClick={() => onCambiarPagina?.(paginaActual + 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg
                         bg-bloomberg-bg border border-white/10 text-bloomberg-text-muted
                         hover:text-bloomberg-text hover:border-white/20
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Página siguiente"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Noticias
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useMemo } from 'react';
import NewsCard from './NewsCard';

/**
 * Lista de noticias con filtro por ticker.
 *
 * @param {object} props
 * @param {Array} props.noticias - Array de objetos noticia
 * @param {function} [props.onFiltrar] - Callback al cambiar filtro (recibe ticker o '')
 * @param {Array} [props.tickers] - Lista de tickers disponibles para el dropdown
 *
 * Requisitos cubiertos: 6.5
 */
export default function NewsFeed({ noticias = [], onFiltrar, tickers = [] }) {
  const [filtroTicker, setFiltroTicker] = useState('');

  const handleFiltro = (valor) => {
    setFiltroTicker(valor);
    if (onFiltrar) onFiltrar(valor);
  };

  // Filtrar localmente si no hay callback externo
  const noticiasFiltradas = useMemo(() => {
    if (!filtroTicker) return noticias;
    return noticias.filter(
      (n) => n.ticker?.toUpperCase() === filtroTicker.toUpperCase()
    );
  }, [noticias, filtroTicker]);

  // Extraer tickers únicos de las noticias si no se proporcionan
  const tickersDisponibles = useMemo(() => {
    if (tickers.length > 0) return tickers;
    const set = new Set(noticias.map((n) => n.ticker).filter(Boolean));
    return [...set].sort();
  }, [noticias, tickers]);

  return (
    <div className="space-y-4">
      {/* Filtro por ticker */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="filtro-ticker-noticias"
          className="text-xs text-bloomberg-text-muted whitespace-nowrap"
        >
          Filtrar por ticker:
        </label>
        <select
          id="filtro-ticker-noticias"
          value={filtroTicker}
          onChange={(e) => handleFiltro(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-bloomberg-bg border border-white/10 text-sm
                     text-bloomberg-text focus:outline-none focus:ring-1
                     focus:ring-bloomberg-accent transition-colors"
          aria-label="Filtrar noticias por ticker"
        >
          <option value="">Todos los tickers</option>
          {tickersDisponibles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {filtroTicker && (
          <button
            onClick={() => handleFiltro('')}
            className="text-xs text-bloomberg-accent hover:text-bloomberg-accent/80
                       transition-colors"
            aria-label="Limpiar filtro"
          >
            Limpiar
          </button>
        )}

        <span className="ml-auto text-xs text-bloomberg-text-muted">
          {noticiasFiltradas.length} noticia{noticiasFiltradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista de noticias */}
      {noticiasFiltradas.length === 0 ? (
        <div className="text-center py-8 text-bloomberg-text-muted text-sm">
          No hay noticias disponibles
          {filtroTicker ? ` para ${filtroTicker}` : ''}.
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
          role="feed"
          aria-label="Feed de noticias"
        >
          {noticiasFiltradas.map((noticia, idx) => (
            <NewsCard key={noticia.id || idx} noticia={noticia} />
          ))}
        </div>
      )}
    </div>
  );
}

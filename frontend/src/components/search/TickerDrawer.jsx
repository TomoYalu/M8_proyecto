/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Búsqueda de Activos
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import useStore from '../../store';
import { NOMBRE_POR_TICKER, INDICES } from '../../constants/tickers';
import { SECTOR_POR_TICKER } from '../../constants/sectors';

/**
 * Drawer lateral que muestra información rápida de un ticker.
 * Se desliza desde la derecha (~400px).
 *
 * @param {object} props
 * @param {string} props.ticker - Símbolo del ticker
 * @param {boolean} props.abierto - Si el drawer está visible
 * @param {function} props.onCerrar - Callback para cerrar el drawer
 */
export default function TickerDrawer({ ticker, abierto, onCerrar }) {
  const navigate = useNavigate();
  const favoritos = useStore((s) => s.favoritos);
  const toggleFavorito = useStore((s) => s.toggleFavorito);
  const drawerRef = useRef(null);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [datosAnalisis, setDatosAnalisis] = useState(null);
  const [semaforo, setSemaforo] = useState(null);
  const [noticias, setNoticias] = useState([]);

  const esFavorito = favoritos.includes(ticker);
  const nombre = NOMBRE_POR_TICKER[ticker] || ticker;
  const sector = SECTOR_POR_TICKER[ticker] || 'Sin clasificar';

  // Determine which indices this ticker belongs to
  const indicesTicker = Object.entries(INDICES)
    .filter(([, { tickers }]) => tickers.includes(ticker))
    .map(([nombre]) => nombre);

  // ─── Score badge color helper ─────────────────────────────────
  const scoreBadgeClass = (score) => {
    if (score == null) return 'bg-bloomberg-text-muted/20 text-bloomberg-text-muted';
    if (score > 0) return 'bg-green-500/20 text-green-400';
    if (score < 0) return 'bg-red-500/20 text-red-400';
    return 'bg-bloomberg-text-muted/20 text-bloomberg-text-muted';
  };

  // ─── Fetch data when ticker changes ───────────────────────────
  useEffect(() => {
    if (!abierto || !ticker) return;

    let cancelado = false;
    setCargando(true);
    setError(null);
    setDatosAnalisis(null);
    setSemaforo(null);
    setNoticias([]);

    async function fetchData() {
      try {
        // 1. Trigger on-demand news update (fire-and-forget, don't block)
        fetch(`/api/noticias/${encodeURIComponent(ticker)}/actualizar`).catch(() => {});

        // 2. Fetch price data, semaphore, and news in parallel
        const [resAnalisis, resSemaforo, resNoticias] = await Promise.allSettled([
          fetch(`/api/analisis?ticker=${encodeURIComponent(ticker)}&periodo=3mo&intervalo=1d`),
          fetch(`/api/noticias/${encodeURIComponent(ticker)}/semaforo`),
          fetch(`/api/noticias/${encodeURIComponent(ticker)}`),
        ]);

        if (cancelado) return;

        // Process analysis data (soft failure — don't block the whole drawer)
        if (resAnalisis.status === 'fulfilled' && resAnalisis.value.ok) {
          const data = await resAnalisis.value.json();
          setDatosAnalisis(data);
        }

        // Process news semaphore
        if (resSemaforo.status === 'fulfilled' && resSemaforo.value.ok) {
          const data = await resSemaforo.value.json();
          setSemaforo(data);
        }

        // Process news list (latest 3)
        if (resNoticias.status === 'fulfilled' && resNoticias.value.ok) {
          const data = await resNoticias.value.json();
          setNoticias((data.noticias || []).slice(0, 3));
        }
      } catch {
        if (!cancelado) {
          setError('Error de conexión al cargar datos.');
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    fetchData();
    return () => { cancelado = true; };
  }, [ticker, abierto]);

  // ─── Close on Escape ──────────────────────────────────────────
  useEffect(() => {
    if (!abierto) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCerrar();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [abierto, onCerrar]);

  // ─── Close on click outside ───────────────────────────────────
  const handleBackdropClick = useCallback((e) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target)) {
      onCerrar();
    }
  }, [onCerrar]);

  if (!abierto) return null;

  // ─── Sparkline data ───────────────────────────────────────────
  const sparklineData = datosAnalisis?.fechas && datosAnalisis?.ohlcv?.close
    ? {
        x: datosAnalisis.fechas.slice(-30),
        y: datosAnalisis.ohlcv.close.slice(-30),
      }
    : null;

  // ─── Key indicators ───────────────────────────────────────────
  const ultimoRsi = datosAnalisis?.rsi
    ? datosAnalisis.rsi.filter((v) => v != null).slice(-1)[0]
    : null;

  const ultimoSma50 = datosAnalisis?.sma50
    ? datosAnalisis.sma50.filter((v) => v != null).slice(-1)[0]
    : null;

  const ultimoSma200 = datosAnalisis?.sma200
    ? datosAnalisis.sma200.filter((v) => v != null).slice(-1)[0]
    : null;

  const precioActual = datosAnalisis?.ohlcv?.close
    ? datosAnalisis.ohlcv.close.filter((v) => v != null).slice(-1)[0]
    : null;

  const rsiColor = (val) => {
    if (val == null) return 'text-bloomberg-text-muted';
    if (val > 70) return 'text-bloomberg-red';
    if (val < 30) return 'text-bloomberg-green';
    return 'text-bloomberg-text';
  };

  const semaforoColor = (color) => {
    const map = {
      verde: 'bg-green-500',
      green: 'bg-green-500',
      amarillo: 'bg-yellow-500',
      yellow: 'bg-yellow-500',
      rojo: 'bg-red-500',
      red: 'bg-red-500',
    };
    return map[(color || '').toLowerCase()] || 'bg-bloomberg-text-muted';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Información de ${ticker}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="relative w-[400px] max-w-full h-full bg-bloomberg-panel border-l border-white/10
                   shadow-2xl overflow-y-auto animate-slide-in-right flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-bloomberg-accent font-mono">{ticker}</h2>
              <button
                type="button"
                onClick={onCerrar}
                className="ml-auto p-1 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-text
                           hover:bg-white/5 transition-colors"
                aria-label="Cerrar drawer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-bloomberg-text mt-0.5 truncate">{nombre}</p>
            <p className="text-xs text-bloomberg-text-muted mt-0.5">{sector}</p>
            {indicesTicker.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {indicesTicker.map((idx) => (
                  <span
                    key={idx}
                    className="inline-block px-1.5 py-0.5 rounded text-[10px]
                               bg-bloomberg-accent/10 text-bloomberg-accent/80
                               border border-bloomberg-accent/20"
                  >
                    {idx}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 space-y-5">
          {cargando && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-bloomberg-accent/30 border-t-bloomberg-accent
                              rounded-full animate-spin" />
            </div>
          )}

          {error && !cargando && (
            <div className="px-4 py-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                            text-sm text-bloomberg-red">
              {error}
            </div>
          )}

          {!cargando && !error && (
            <>
              {/* Message when no analysis data available */}
              {!datosAnalisis && !semaforo && (
                <div className="px-4 py-3 rounded-lg bg-bloomberg-accent/5 border border-bloomberg-accent/10
                                text-sm text-bloomberg-text-muted">
                  No hay datos de análisis disponibles para este ticker. Puedes ir al análisis completo para más detalles.
                </div>
              )}

              {/* Mini sparkline chart */}
              {datosAnalisis && sparklineData && (
                <div>
                  <h3 className="text-xs font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-2">
                    Precio — Últimos 30 días
                  </h3>
                  <div className="rounded-lg overflow-hidden border border-white/5">
                    <Plot
                      data={[
                        {
                          type: 'scatter',
                          mode: 'lines',
                          x: sparklineData.x,
                          y: sparklineData.y,
                          line: { color: '#3b82f6', width: 2 },
                          fill: 'tozeroy',
                          fillcolor: 'rgba(59,130,246,0.1)',
                          hovertemplate: '$%{y:,.2f}<extra></extra>',
                        },
                      ]}
                      layout={{
                        paper_bgcolor: '#141b2d',
                        plot_bgcolor: '#141b2d',
                        margin: { l: 40, r: 10, t: 10, b: 30 },
                        xaxis: {
                          showgrid: false,
                          tickfont: { size: 9, color: '#94a3b8' },
                          nticks: 5,
                        },
                        yaxis: {
                          showgrid: true,
                          gridcolor: '#253152',
                          tickfont: { size: 9, color: '#94a3b8' },
                          tickprefix: '$',
                        },
                        showlegend: false,
                        hovermode: 'x unified',
                        hoverlabel: {
                          bgcolor: 'rgba(20,27,45,0.92)',
                          font: { size: 11, color: '#e2e8f0' },
                        },
                        height: 160,
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      useResizeHandler
                      style={{ width: '100%', height: 160 }}
                    />
                  </div>
                </div>
              )}

              {/* Key indicators */}
              {datosAnalisis && (
              <div>
                <h3 className="text-xs font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-2">
                  Indicadores clave
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/5">
                    <span className="text-[10px] text-bloomberg-text-muted uppercase">Precio</span>
                    <p className="text-sm font-semibold text-bloomberg-text tabular-nums">
                      {precioActual != null
                        ? `${precioActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/5">
                    <span className="text-[10px] text-bloomberg-text-muted uppercase">RSI (14)</span>
                    <p className={`text-sm font-semibold tabular-nums ${rsiColor(ultimoRsi)}`}>
                      {ultimoRsi != null ? ultimoRsi.toFixed(2) : '—'}
                    </p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/5">
                    <span className="text-[10px] text-bloomberg-text-muted uppercase">SMA 50</span>
                    <p className="text-sm font-semibold text-bloomberg-text tabular-nums">
                      {ultimoSma50 != null
                        ? `${ultimoSma50.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/5">
                    <span className="text-[10px] text-bloomberg-text-muted uppercase">SMA 200</span>
                    <p className="text-sm font-semibold text-bloomberg-text tabular-nums">
                      {ultimoSma200 != null
                        ? `${ultimoSma200.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
              )}

              {/* News semaphore */}
              {semaforo && (
                <div>
                  <h3 className="text-xs font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-2">
                    Semáforo de noticias
                  </h3>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bloomberg-bg border border-white/5">
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 ${semaforoColor(semaforo.color || semaforo.semaforo)}`} />
                    <div>
                      <span className="text-sm font-medium text-bloomberg-text">
                        {semaforo.score != null ? `Score: ${semaforo.score}` : semaforo.color || semaforo.semaforo || '—'}
                      </span>
                      {semaforo.resumen && (
                        <p className="text-xs text-bloomberg-text-muted mt-0.5 line-clamp-2">
                          {semaforo.resumen}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Latest news */}
              {noticias.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-2">
                    Últimas noticias
                  </h3>
                  <div className="space-y-2">
                    {noticias.map((noticia) => (
                      <a
                        key={noticia.id}
                        href={noticia.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-2.5 rounded-lg bg-bloomberg-bg border border-white/5
                                   hover:border-bloomberg-accent/20 hover:bg-bloomberg-accent/5 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <p className="text-sm text-bloomberg-text line-clamp-2 flex-1 leading-snug">
                            {noticia.titulo}
                          </p>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px]
                                           font-semibold flex-shrink-0 ${scoreBadgeClass(noticia.score_sentimiento)}`}>
                            {noticia.score_sentimiento != null
                              ? (noticia.score_sentimiento > 0 ? '+' : '') + noticia.score_sentimiento.toFixed(2)
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-bloomberg-text-muted">
                            {noticia.fuente || 'Fuente desconocida'}
                          </span>
                          {noticia.fecha_publicacion && (
                            <>
                              <span className="text-[10px] text-bloomberg-text-muted">·</span>
                              <span className="text-[10px] text-bloomberg-text-muted">
                                {new Date(noticia.fecha_publicacion).toLocaleDateString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                  {/* Link to full news page */}
                  <button
                    type="button"
                    onClick={() => {
                      onCerrar();
                      navigate('/noticias');
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs
                               font-medium text-bloomberg-accent hover:text-bloomberg-accent/80
                               rounded-lg border border-bloomberg-accent/20 hover:border-bloomberg-accent/40
                               hover:bg-bloomberg-accent/5 transition-colors"
                  >
                    Ver todas las noticias
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 border-t border-white/5 space-y-2">
          <button
            type="button"
            onClick={() => toggleFavorito(ticker)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                       rounded-lg transition-colors ${
                         esFavorito
                           ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25'
                           : 'bg-bloomberg-bg border border-white/10 text-bloomberg-text hover:border-bloomberg-accent/30 hover:bg-bloomberg-accent/5'
                       }`}
          >
            <svg className={`w-4 h-4 ${esFavorito ? 'fill-yellow-400 text-yellow-400' : ''}`}
                 fill={esFavorito ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          </button>
          <button
            type="button"
            onClick={() => {
              onCerrar();
              navigate(`/analisis?ticker=${encodeURIComponent(ticker)}`);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                       rounded-lg bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80
                       transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Ir a análisis completo
          </button>
        </div>
      </div>

      {/* CSS animation for slide-in */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}

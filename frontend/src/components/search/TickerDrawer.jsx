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
 * Modal flotante centrado con información rápida de un ticker.
 * Incluye navegación ← → entre tickers de la tabla.
 */
export default function TickerDrawer({ ticker, abierto, onCerrar, tickers = [], onNavegar }) {
  const navigate = useNavigate();
  const favoritos = useStore((s) => s.favoritos);
  const toggleFavorito = useStore((s) => s.toggleFavorito);
  const modalRef = useRef(null);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [datosAnalisis, setDatosAnalisis] = useState(null);
  const [semaforo, setSemaforo] = useState(null);
  const [noticias, setNoticias] = useState([]);

  const esFavorito = favoritos.includes(ticker);
  const nombre = NOMBRE_POR_TICKER[ticker] || ticker;
  const sector = SECTOR_POR_TICKER[ticker] || 'Sin clasificar';
  const indicesTicker = Object.entries(INDICES)
    .filter(([, { tickers: t }]) => t.includes(ticker))
    .map(([n]) => n);

  // Navegación entre tickers
  const currentIdx = tickers.indexOf(ticker);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < tickers.length - 1;
  const goPrev = () => { if (hasPrev && onNavegar) onNavegar(tickers[currentIdx - 1]); };
  const goNext = () => { if (hasNext && onNavegar) onNavegar(tickers[currentIdx + 1]); };

  const scoreBadgeClass = (score) => {
    if (score == null) return 'bg-bloomberg-text-muted/20 text-bloomberg-text-muted';
    if (score > 0) return 'bg-green-500/20 text-green-400';
    if (score < 0) return 'bg-red-500/20 text-red-400';
    return 'bg-bloomberg-text-muted/20 text-bloomberg-text-muted';
  };

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
        fetch(`/api/noticias/${encodeURIComponent(ticker)}/actualizar`).catch(() => {});
        const [resA, resS, resN] = await Promise.allSettled([
          fetch(`/api/analisis?ticker=${encodeURIComponent(ticker)}&periodo=3mo&intervalo=1d`),
          fetch(`/api/noticias/${encodeURIComponent(ticker)}/semaforo`),
          fetch(`/api/noticias/${encodeURIComponent(ticker)}`),
        ]);
        if (cancelado) return;
        if (resA.status === 'fulfilled' && resA.value.ok) setDatosAnalisis(await resA.value.json());
        if (resS.status === 'fulfilled' && resS.value.ok) setSemaforo(await resS.value.json());
        if (resN.status === 'fulfilled' && resN.value.ok) {
          const d = await resN.value.json();
          setNoticias((d.noticias || []).slice(0, 3));
        }
      } catch { if (!cancelado) setError('Error de conexión.'); }
      finally { if (!cancelado) setCargando(false); }
    }
    fetchData();
    return () => { cancelado = true; };
  }, [ticker, abierto]);

  // Keyboard: Escape, ← →
  useEffect(() => {
    if (!abierto) return;
    function handleKey(e) {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [abierto, currentIdx]);

  if (!abierto) return null;

  const sparklineData = datosAnalisis?.fechas && datosAnalisis?.ohlcv?.close
    ? { x: datosAnalisis.fechas.slice(-30), y: datosAnalisis.ohlcv.close.slice(-30) }
    : null;

  const ultimoRsi = datosAnalisis?.rsi?.filter((v) => v != null).slice(-1)[0] ?? null;
  const ultimoSma50 = datosAnalisis?.sma50?.filter((v) => v != null).slice(-1)[0] ?? null;
  const ultimoSma200 = datosAnalisis?.sma200?.filter((v) => v != null).slice(-1)[0] ?? null;
  const precioActual = datosAnalisis?.ohlcv?.close?.filter((v) => v != null).slice(-1)[0] ?? null;

  const rsiColor = (v) => v == null ? 'text-bloomberg-text-muted' : v > 70 ? 'text-bloomberg-red' : v < 30 ? 'text-bloomberg-green' : 'text-bloomberg-text';
  const semaforoColor = (c) => ({ verde: 'bg-green-500', green: 'bg-green-500', amarillo: 'bg-yellow-500', rojo: 'bg-red-500' })[(c || '').toLowerCase()] || 'bg-bloomberg-text-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      role="dialog" aria-modal="true" aria-label={`Información de ${ticker}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div ref={modalRef}
        className="relative w-full max-w-[520px] max-h-[75vh] rounded-2xl border border-white/10
                   shadow-2xl flex flex-col overflow-hidden animate-modal-in"
        style={{ background: 'rgba(10, 14, 20, 0.95)', backdropFilter: 'blur(16px)' }}
      >
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <button onClick={goPrev} disabled={!hasPrev}
            className="p-1.5 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-text
                       hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-default"
            aria-label="Ticker anterior"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center flex-1 min-w-0">
            <h2 className="text-xl font-bold text-bloomberg-accent font-mono">{ticker}</h2>
            <p className="text-sm text-bloomberg-text truncate">{nombre}</p>
          </div>

          <button onClick={goNext} disabled={!hasNext}
            className="p-1.5 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-text
                       hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-default"
            aria-label="Ticker siguiente"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button onClick={onCerrar}
            className="ml-2 p-1.5 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-text
                       hover:bg-white/5 transition-all"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Subtitle bar */}
        <div className="px-5 py-2 flex items-center gap-2 border-b border-white/5">
          <span className="text-xs text-bloomberg-text-muted">{sector}</span>
          {indicesTicker.map((idx) => (
            <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-bloomberg-accent/10
                                       text-bloomberg-accent/80 border border-bloomberg-accent/20">
              {idx}
            </span>
          ))}
          <span className="text-xs text-bloomberg-text-muted ml-auto">
            {currentIdx + 1} / {tickers.length}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {cargando && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-bloomberg-accent/30 border-t-bloomberg-accent rounded-full animate-spin" />
            </div>
          )}

          {error && !cargando && (
            <div className="px-4 py-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20 text-sm text-bloomberg-red">
              {error}
            </div>
          )}

          {!cargando && !error && (
            <>
              {/* Sparkline */}
              {sparklineData && (
                <div>
                  <h3 className="text-xs font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-2">
                    Precio — 30 días
                  </h3>
                  <div className="rounded-lg overflow-hidden border border-white/5">
                    <Plot
                      data={[{
                        type: 'scatter', mode: 'lines', x: sparklineData.x, y: sparklineData.y,
                        line: { color: '#06b6d4', width: 2 }, fill: 'tozeroy',
                        fillcolor: 'rgba(6,182,212,0.08)', hovertemplate: '$%{y:,.2f}<extra></extra>',
                      }]}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                        margin: { l: 45, r: 10, t: 8, b: 28 }, height: 150,
                        xaxis: { showgrid: false, tickfont: { size: 9, color: '#94a3b8' }, nticks: 5 },
                        yaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.05)', tickfont: { size: 9, color: '#94a3b8' }, tickprefix: '$' },
                        showlegend: false, hovermode: 'x unified',
                      }}
                      config={{ displayModeBar: false, responsive: true }}
                      useResizeHandler style={{ width: '100%', height: 150 }}
                    />
                  </div>
                </div>
              )}

              {/* Indicators */}
              {datosAnalisis && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Precio', value: precioActual != null ? `$${precioActual.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—', color: 'text-white' },
                    { label: 'RSI (14)', value: ultimoRsi != null ? ultimoRsi.toFixed(1) : '—', color: rsiColor(ultimoRsi) },
                    { label: 'SMA 50', value: ultimoSma50 != null ? `$${ultimoSma50.toFixed(0)}` : '—', color: 'text-bloomberg-text' },
                    { label: 'SMA 200', value: ultimoSma200 != null ? `$${ultimoSma200.toFixed(0)}` : '—', color: 'text-bloomberg-text' },
                  ].map((ind) => (
                    <div key={ind.label} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                      <span className="text-[10px] text-bloomberg-text-muted uppercase block">{ind.label}</span>
                      <span className={`text-sm font-semibold tabular-nums ${ind.color}`}>{ind.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Semaforo */}
              {semaforo && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${semaforoColor(semaforo.color || semaforo.semaforo)}`} />
                  <span className="text-sm text-bloomberg-text">
                    Noticias: {semaforo.semaforo || semaforo.color || '—'}
                  </span>
                  {semaforo.score_promedio != null && (
                    <span className="text-xs text-bloomberg-text-muted ml-auto">
                      Score: {semaforo.score_promedio.toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              {/* News */}
              {noticias.length > 0 && (
                <div className="space-y-1.5">
                  {noticias.map((n) => (
                    <a key={n.id} href={n.url || '#'} target="_blank" rel="noopener noreferrer"
                      className="block px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5
                                 hover:border-bloomberg-accent/20 hover:bg-white/[0.04] transition-colors">
                      <p className="text-sm text-bloomberg-text line-clamp-1">{n.titulo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-bloomberg-text-muted">{n.fuente || '—'}</span>
                        <span className={`text-[10px] font-mono ${scoreBadgeClass(n.score_sentimiento)}`}>
                          {n.score_sentimiento != null ? (n.score_sentimiento > 0 ? '+' : '') + n.score_sentimiento.toFixed(2) : ''}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-white/10 flex gap-2">
          <button onClick={() => toggleFavorito(ticker)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium
                       rounded-lg transition-colors ${esFavorito
                         ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                         : 'bg-white/5 border border-white/10 text-bloomberg-text hover:border-white/20'}`}
          >
            {esFavorito ? '★ Favorito' : '☆ Favorito'}
          </button>
          <button onClick={() => { onCerrar(); navigate(`/analisis?ticker=${encodeURIComponent(ticker)}`); }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium
                       rounded-lg bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80 transition-colors"
          >
            Análisis completo →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-modal-in { animation: modalIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

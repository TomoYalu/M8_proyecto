import { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import Spinner from '../common/Spinner';

/**
 * Dashboard analítico del portafolio con pesos actuales.
 * Muestra: métricas de riesgo, correlación, contribución al riesgo,
 * crecimiento de $1, drawdown, y resumen técnico por ticker.
 */
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316'];

export default function PortfolioDashboard({ portafolioId, posiciones }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevId = useRef(null);

  useEffect(() => {
    if (!portafolioId) return;
    const activas = (posiciones || []).filter(p => p.cantidad > 0 && p.precio_actual > 0);
    if (activas.length < 2) { setData(null); return; }
    if (prevId.current === portafolioId && data) return;
    prevId.current = portafolioId;

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/portafolios/${portafolioId}/dashboard`)
      .then(r => { if (!r.ok) throw new Error('Error al cargar dashboard'); return r.json(); })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [portafolioId, posiciones?.length]);

  const activas = (posiciones || []).filter(p => p.cantidad > 0 && p.precio_actual > 0);
  if (activas.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-bloomberg-text-muted">
          Se requieren al menos 2 posiciones activas para el dashboard.
        </p>
      </div>
    );
  }

  if (loading) return <Spinner mensaje="Calculando métricas del portafolio..." size="sm" />;
  if (error) return <p className="text-sm text-bloomberg-red py-4">{error}</p>;
  if (!data) return null;

  const { metricas, correlacion, risk_contrib, historico, resumen_tecnico, tickers } = data;

  return (
    <div className="space-y-4">
      {/* Métricas de riesgo */}
      <RiskMetrics metricas={metricas} valorTotal={data.valor_total} />

      {/* Row: Correlación + Contribución al riesgo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CorrelationPanel correlacion={correlacion} tickers={tickers} />
        <RiskContribPanel riskContrib={risk_contrib} tickers={tickers} />
      </div>

      {/* Row: Crecimiento $1 + Drawdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GrowthPanel historico={historico} />
        <DrawdownPanel historico={historico} />
      </div>

      {/* Resumen técnico */}
      <TechnicalSummary resumen={resumen_tecnico} />
    </div>
  );
}

// ─── Métricas de riesgo ─────────────────────────────────────────
function RiskMetrics({ metricas, valorTotal }) {
  const cards = [
    { label: 'Rendimiento Anual', value: `${metricas.rendimiento}%`, color: metricas.rendimiento >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red' },
    { label: 'Riesgo (Volatilidad)', value: `${metricas.riesgo}%` },
    { label: 'Sharpe', value: metricas.sharpe.toFixed(2) },
    { label: 'Sortino', value: metricas.sortino.toFixed(2) },
    { label: 'Beta vs SPY', value: metricas.beta.toFixed(2) },
    { label: 'Max Drawdown', value: `${metricas.max_drawdown}%`, color: 'text-bloomberg-red' },
    { label: 'VaR 99% Diario', value: `$${metricas.var.diario_usd.toLocaleString()}`, sub: `${metricas.var.diario}%` },
    { label: 'VaR 99% Anual', value: `$${metricas.var.anual_usd.toLocaleString()}`, sub: `${metricas.var.anual}%` },
  ];

  return (
    <Panel title="Métricas de Riesgo (Pesos Actuales)">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-bloomberg-bg/50 rounded-lg px-3 py-2 border border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted">{c.label}</p>
            <p className={`text-sm font-semibold ${c.color || 'text-bloomberg-text'}`}>{c.value}</p>
            {c.sub && <p className="text-[10px] text-bloomberg-text-muted">{c.sub}</p>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Correlación ────────────────────────────────────────────────
function CorrelationPanel({ correlacion, tickers }) {
  const z = tickers.map(t1 => tickers.map(t2 => correlacion[t1]?.[t2] ?? 0));
  const annotations = [];
  tickers.forEach((t1, i) => tickers.forEach((t2, j) => {
    annotations.push({ x: t2, y: t1, text: z[i][j].toFixed(2), showarrow: false, font: { color: '#fff', size: 10 } });
  }));

  return (
    <Panel title="Matriz de Correlación">
      <Plot
        data={[{ z, x: tickers, y: tickers, type: 'heatmap', colorscale: 'RdYlGn', zmin: -1, zmax: 1, showscale: true, colorbar: { thickness: 12, len: 0.8 } }]}
        layout={{ ...plotDefaults, height: 280, margin: { t: 10, r: 60, b: 60, l: 60 }, annotations, xaxis: { color: '#9ca3af', tickfont: { size: 10 } }, yaxis: { color: '#9ca3af', tickfont: { size: 10 } } }}
        config={plotConfig}
        useResizeHandler
        style={{ width: '100%', height: 280 }}
      />
    </Panel>
  );
}

// ─── Contribución al riesgo ─────────────────────────────────────
function RiskContribPanel({ riskContrib, tickers }) {
  const vals = tickers.map(t => riskContrib[t] || 0);
  return (
    <Panel title="Contribución al Riesgo">
      <Plot
        data={[{ x: vals, y: tickers, type: 'bar', orientation: 'h', marker: { color: COLORS.slice(0, tickers.length) }, text: vals.map(v => `${v}%`), textposition: 'outside', textfont: { color: '#d1d5db', size: 10 } }]}
        layout={{ ...plotDefaults, height: 280, margin: { t: 10, r: 40, b: 30, l: 60 }, xaxis: { title: '% del riesgo total', color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)' }, yaxis: { color: '#9ca3af', autorange: 'reversed' } }}
        config={plotConfig}
        useResizeHandler
        style={{ width: '100%', height: 280 }}
      />
    </Panel>
  );
}

// ─── Crecimiento de $1 ──────────────────────────────────────────
function GrowthPanel({ historico }) {
  const { fechas, crecimiento } = historico;
  const final = crecimiento[crecimiento.length - 1];
  const retorno = ((final - 1) * 100).toFixed(1);
  return (
    <Panel title={`Crecimiento de $1 → $${final?.toFixed(2)} (${retorno}%)`}>
      <Plot
        data={[{ x: fechas, y: crecimiento, type: 'scatter', mode: 'lines', line: { color: '#3b82f6', width: 2 }, fill: 'tozeroy', fillcolor: 'rgba(59,130,246,0.08)', hovertemplate: '%{x}<br>$%{y:.4f}<extra></extra>' }]}
        layout={{ ...plotDefaults, height: 250, margin: { t: 10, r: 10, b: 30, l: 50 }, xaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)' }, yaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)' } }}
        config={plotConfig}
        useResizeHandler
        style={{ width: '100%', height: 250 }}
      />
    </Panel>
  );
}

// ─── Drawdown ───────────────────────────────────────────────────
function DrawdownPanel({ historico }) {
  const { fechas, drawdown } = historico;
  return (
    <Panel title="Drawdown (caída desde máximo)">
      <Plot
        data={[{ x: fechas, y: drawdown, type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { color: '#ef4444', width: 1.5 }, fillcolor: 'rgba(239,68,68,0.15)', hovertemplate: '%{x}<br>%{y:.2f}%<extra></extra>' }]}
        layout={{ ...plotDefaults, height: 250, margin: { t: 10, r: 10, b: 30, l: 50 }, xaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)' }, yaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)', title: '%' } }}
        config={plotConfig}
        useResizeHandler
        style={{ width: '100%', height: 250 }}
      />
    </Panel>
  );
}

// ─── Resumen técnico ────────────────────────────────────────────
const TENDENCIA_COLORS = {
  alcista: 'text-bloomberg-green',
  bajista: 'text-bloomberg-red',
  mixta: 'text-bloomberg-yellow',
  neutral: 'text-bloomberg-text-muted',
};
const TENDENCIA_ICONS = { alcista: '▲', bajista: '▼', mixta: '◆', neutral: '—' };

function TechnicalSummary({ resumen }) {
  return (
    <Panel title="Resumen Técnico por Activo">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Resumen técnico de activos del portafolio">
          <thead>
            <tr className="border-b border-white/10 text-bloomberg-text-muted text-[10px] uppercase tracking-wider">
              <th className="text-left py-2 px-2">Ticker</th>
              <th className="text-right py-2 px-2">Precio</th>
              <th className="text-right py-2 px-2">RSI</th>
              <th className="text-right py-2 px-2">MACD Hist</th>
              <th className="text-right py-2 px-2">SMA 50</th>
              <th className="text-right py-2 px-2">SMA 200</th>
              <th className="text-left py-2 px-2">Señales</th>
              <th className="text-center py-2 px-2">Tendencia</th>
              <th className="text-center py-2 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {resumen.map(r => (
              <tr key={r.ticker} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-2 px-2 font-medium text-bloomberg-text">{r.ticker}</td>
                <td className="py-2 px-2 text-right">{r.error ? '—' : `$${r.precio}`}</td>
                <td className={`py-2 px-2 text-right ${r.rsi > 70 ? 'text-bloomberg-red' : r.rsi < 30 ? 'text-bloomberg-green' : ''}`}>
                  {r.rsi ?? '—'}
                </td>
                <td className={`py-2 px-2 text-right ${r.macd_histograma > 0 ? 'text-bloomberg-green' : r.macd_histograma < 0 ? 'text-bloomberg-red' : ''}`}>
                  {r.macd_histograma != null ? r.macd_histograma.toFixed(2) : '—'}
                </td>
                <td className="py-2 px-2 text-right">{r.sma50 ?? '—'}</td>
                <td className="py-2 px-2 text-right">{r.sma200 ?? '—'}</td>
                <td className="py-2 px-2 text-left">
                  <div className="flex flex-wrap gap-1">
                    {(r.señales || []).map((s, i) => (
                      <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-bloomberg-text-muted">{s}</span>
                    ))}
                  </div>
                </td>
                <td className={`py-2 px-2 text-center font-medium ${TENDENCIA_COLORS[r.tendencia] || ''}`}>
                  {TENDENCIA_ICONS[r.tendencia] || '—'} {r.tendencia || '—'}
                </td>
                <td className="py-2 px-2 text-center">
                  <a
                    href={`/analisis?ticker=${r.ticker}`}
                    className="text-[10px] text-bloomberg-accent hover:underline"
                    title={`Ver análisis técnico completo de ${r.ticker}`}
                  >
                    Ver más →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
function Panel({ title, children }) {
  return (
    <div className="bg-bloomberg-bg/30 rounded-lg border border-white/5 p-4">
      <h4 className="text-xs font-medium text-bloomberg-text-muted uppercase tracking-wider mb-3">{title}</h4>
      {children}
    </div>
  );
}

const plotDefaults = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#d1d5db', size: 11 }, showlegend: false };
const plotConfig = { responsive: true, displayModeBar: false };

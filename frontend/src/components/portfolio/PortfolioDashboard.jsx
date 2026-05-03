/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */
import { useState, useEffect, useMemo } from 'react';
import useStore from '../../store';
import Plot from 'react-plotly.js';
import Spinner from '../common/Spinner';

/**
 * Dashboard analítico del portafolio con pesos actuales.
 * Muestra: métricas de riesgo, correlación, contribución al riesgo,
 * crecimiento de $1, drawdown, y resumen técnico por ticker.
 */
const COLORS = ['#0ea5e9','#06b6d4','#14b8a6','#10b981','#059669','#0284c7','#22d3ee','#2dd4bf'];

export default function PortfolioDashboard({ portafolioId, posiciones }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { dashboardCache, setDashboardCache } = useStore();

  // Hash de posiciones activas para detectar cambios
  const posHash = useMemo(() => {
    const activas = (posiciones || []).filter(p => p.cantidad > 0 && p.precio_actual > 0);
    return activas.map(p => `${p.ticker}:${p.cantidad}`).sort().join('|');
  }, [posiciones]);

  const cached = dashboardCache[portafolioId];
  const data = cached?.posHash === posHash ? cached.data : null;

  useEffect(() => {
    if (!portafolioId) return;
    const activas = (posiciones || []).filter(p => p.cantidad > 0 && p.precio_actual > 0);
    if (activas.length < 2) return;
    if (data) return; // ya cacheado con mismas posiciones

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/portafolios/${portafolioId}/dashboard`)
      .then(r => { if (!r.ok) throw new Error('Error al cargar dashboard'); return r.json(); })
      .then(d => { setDashboardCache(portafolioId, d, posHash); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [portafolioId, posHash, data]);

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

  const { metricas, correlacion, risk_contrib, historico, resumen_tecnico, tickers, twr } = data;

  return (
    <div className="space-y-4">
      {/* Métricas de riesgo */}
      <RiskMetrics metricas={metricas} valorTotal={data.valor_total} twr={twr} />

      {/* TWR: Rendimiento real */}
      {twr && <TWRPanel twr={twr} />}

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

      {/* Proyección Monte Carlo */}
      <MonteCarloPanel portafolioId={portafolioId} />

      {/* Backtesting */}
      <BacktestPanel portafolioId={portafolioId} />

      {/* Resumen técnico */}
      <TechnicalSummary resumen={resumen_tecnico} />
    </div>
  );
}

// ─── Métricas de riesgo ─────────────────────────────────────────
function RiskMetrics({ metricas, valorTotal, twr }) {
  const cards = [
    { label: 'Rendimiento Anual', value: `${metricas.rendimiento}%`, color: metricas.rendimiento >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red' },
    { label: 'Riesgo (Volatilidad)', value: `${metricas.riesgo}%` },
    { label: 'Sharpe', value: metricas.sharpe.toFixed(2) },
    { label: 'Sortino', value: metricas.sortino.toFixed(2) },
    { label: 'Beta vs SPY', value: metricas.beta.toFixed(2) },
    { label: 'Max Drawdown', value: `${metricas.max_drawdown}%`, color: 'text-bloomberg-red' },
    { label: 'VaR 99% Diario', value: `$${metricas.var.diario_usd.toLocaleString()}`, sub: `${metricas.var.diario}%` },
    ...(twr ? [{ label: 'TWR (Rend. Real)', value: `${twr.twr_total}%`, sub: `${twr.dias}d · anual: ${twr.twr_anualizado}%`, color: twr.twr_total >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red' }] : []),
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

// ─── TWR (Time-Weighted Return) ─────────────────────────────────
function TWRPanel({ twr }) {
  return (
    <Panel title={`Rendimiento Real (TWR): ${twr.twr_total}% en ${twr.dias} días · Anualizado: ${twr.twr_anualizado}%`}>
      <Plot
        data={[{ x: twr.fechas, y: twr.valores, type: 'scatter', mode: 'lines', line: { color: twr.twr_total >= 0 ? '#10b981' : '#ef4444', width: 2 }, fill: 'tozeroy', fillcolor: twr.twr_total >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', hovertemplate: '%{x}<br>TWR: %{y:.2f}%<extra></extra>' }]}
        layout={{ ...plotDefaults, height: 220, margin: { t: 10, r: 10, b: 30, l: 50 }, xaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)' }, yaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)', title: '%', zeroline: true, zerolinecolor: 'rgba(255,255,255,0.2)' } }}
        config={plotConfig}
        useResizeHandler
        style={{ width: '100%', height: 220 }}
      />
      <p className="text-[10px] text-bloomberg-text-muted mt-2">
        TWR elimina el efecto de depósitos y retiros, mostrando el rendimiento puro de la inversión.
      </p>
    </Panel>
  );
}

// ─── Monte Carlo Projection ─────────────────────────────────────
function MonteCarloPanel({ portafolioId }) {
  const [data, setData] = useState(null);
  const [horizonte, setHorizonte] = useState('1y');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!portafolioId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/portafolios/${portafolioId}/proyeccion?horizonte=${horizonte}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [portafolioId, horizonte]);

  const horizontes = [
    { id: '6m', label: '6 Meses' },
    { id: '1y', label: '1 Año' },
    { id: '2y', label: '2 Años' },
    { id: '5y', label: '5 Años' },
  ];

  return (
    <Panel title="Proyección Monte Carlo">
      <div className="flex gap-2 mb-3">
        {horizontes.map(h => (
          <button key={h.id} onClick={() => setHorizonte(h.id)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${horizonte === h.id ? 'bg-bloomberg-accent/20 text-bloomberg-accent' : 'text-bloomberg-text-muted hover:text-bloomberg-text'}`}>
            {h.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="h-[250px] flex items-center justify-center">
          <div className="w-4 h-4 border-2 rounded-full border-bloomberg-accent border-t-transparent animate-spin" />
        </div>
      ) : data ? (
        <>
          <Plot
            data={[
              { x: data.fechas, y: data.p90, type: 'scatter', mode: 'lines', name: 'Optimista (p90)', line: { color: '#10b981', width: 1, dash: 'dot' } },
              { x: data.fechas, y: data.p50, type: 'scatter', mode: 'lines', name: 'Mediana (p50)', line: { color: '#3b82f6', width: 2 } },
              { x: data.fechas, y: data.p10, type: 'scatter', mode: 'lines', name: 'Pesimista (p10)', line: { color: '#ef4444', width: 1, dash: 'dot' }, fill: 'tonexty', fillcolor: 'rgba(59,130,246,0.06)' },
            ]}
            layout={{ ...plotDefaults, height: 250, showlegend: true, legend: { x: 0, y: 1, font: { size: 10, color: '#9ca3af' }, bgcolor: 'transparent' }, margin: { t: 10, r: 10, b: 30, l: 60 }, xaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)' }, yaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)', tickprefix: '$' } }}
            config={plotConfig}
            useResizeHandler
            style={{ width: '100%', height: 250 }}
          />
          <div className="flex gap-4 mt-2 text-[10px] text-bloomberg-text-muted">
            <span>Valor actual: ${data.valor_actual?.toLocaleString()}</span>
            <span>Rend. anual: {data.rendimiento_anual?.toFixed(1)}%</span>
            <span>Volatilidad: {data.volatilidad_anual?.toFixed(1)}%</span>
          </div>
        </>
      ) : <p className="text-xs text-bloomberg-text-muted">Sin datos de proyección.</p>}
    </Panel>
  );
}

// ─── Backtesting ────────────────────────────────────────────────
function BacktestPanel({ portafolioId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState('3y');
  const [rebalanceo, setRebalanceo] = useState('trimestral');

  const ejecutar = () => {
    setLoading(true);
    fetch(`/api/portafolios/${portafolioId}/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodo, rebalanceo }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const periodos = [{ id: '1y', label: '1 Año' }, { id: '3y', label: '3 Años' }, { id: '5y', label: '5 Años' }];
  const rebalanceos = [{ id: 'mensual', label: 'Mensual' }, { id: 'trimestral', label: 'Trimestral' }, { id: 'anual', label: 'Anual' }, { id: 'nunca', label: 'Sin rebalanceo' }];

  return (
    <Panel title="Backtesting — Simulación Histórica">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-bloomberg-text-muted">Período:</span>
          {periodos.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${periodo === p.id ? 'bg-bloomberg-accent/20 text-bloomberg-accent' : 'text-bloomberg-text-muted hover:text-bloomberg-text'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-bloomberg-text-muted">Rebalanceo:</span>
          {rebalanceos.map(r => (
            <button key={r.id} onClick={() => setRebalanceo(r.id)}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${rebalanceo === r.id ? 'bg-bloomberg-accent/20 text-bloomberg-accent' : 'text-bloomberg-text-muted hover:text-bloomberg-text'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={ejecutar} disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80 disabled:opacity-50 transition-colors">
          {loading ? 'Simulando...' : '▶ Ejecutar Backtest'}
        </button>
      </div>

      {data && (
        <>
          {/* Métricas comparativas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Valor Final', value: `$${data.metricas.valor_final.toLocaleString()}`, sub: `de $${data.inversion_inicial.toLocaleString()}` },
              { label: 'Rendimiento Total', value: `${data.metricas.rendimiento_total}%`, color: data.metricas.rendimiento_total >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red' },
              { label: 'Rend. Anual', value: `${data.metricas.rendimiento_anual}%`, sub: data.spy_metricas ? `SPY: ${data.spy_metricas.rendimiento_anual}%` : null },
              { label: 'Max Drawdown', value: `${data.metricas.max_drawdown}%`, sub: data.spy_metricas ? `SPY: ${data.spy_metricas.max_drawdown}%` : null, color: 'text-bloomberg-red' },
            ].map(c => (
              <div key={c.label} className="bg-bloomberg-bg/50 rounded-lg px-2 py-1.5 border border-white/5">
                <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted">{c.label}</p>
                <p className={`text-sm font-semibold ${c.color || 'text-bloomberg-text'}`}>{c.value}</p>
                {c.sub && <p className="text-[10px] text-bloomberg-text-muted">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Gráfica */}
          <Plot
            data={[
              { x: data.fechas, y: data.valores, type: 'scatter', mode: 'lines', name: `Portafolio (${data.rebalanceo})`, line: { color: '#3b82f6', width: 2 } },
              ...(data.spy ? [{ x: data.fechas, y: data.spy, type: 'scatter', mode: 'lines', name: 'SPY (benchmark)', line: { color: '#9ca3af', width: 1.5, dash: 'dot' } }] : []),
            ]}
            layout={{ ...plotDefaults, height: 280, showlegend: true, legend: { x: 0, y: 1, font: { size: 10, color: '#9ca3af' }, bgcolor: 'transparent' }, margin: { t: 10, r: 10, b: 30, l: 60 }, xaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)' }, yaxis: { color: '#9ca3af', gridcolor: 'rgba(255,255,255,0.05)', tickprefix: '$' } }}
            config={plotConfig}
            useResizeHandler
            style={{ width: '100%', height: 280 }}
          />
          <p className="text-[10px] text-bloomberg-text-muted mt-2">
            Simulación de $10,000 invertidos con pesos actuales y rebalanceo {data.rebalanceo}. No incluye costos de transacción ni impuestos.
          </p>
        </>
      )}

      {!data && !loading && (
        <p className="text-xs text-bloomberg-text-muted py-4 text-center">
          Haz clic en "Ejecutar Backtest" para simular cómo habría rendido tu portafolio con datos históricos.
        </p>
      )}
    </Panel>
  );
}


function Panel({ title, children }) {
  return (
    <div className="rounded-2xl p-5 bg-[#0a0e14] border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
      <h4 className="text-xs font-medium text-bloomberg-text-muted uppercase tracking-wider mb-3">{title}</h4>
      {children}
    </div>
  );
}

const plotDefaults = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#e2e8f0', size: 12 }, showlegend: true, legend: { font: { color: '#e2e8f0', size: 10 }, bgcolor: 'rgba(0,0,0,0)' } };
const plotConfig = { responsive: true, displayModeBar: false };

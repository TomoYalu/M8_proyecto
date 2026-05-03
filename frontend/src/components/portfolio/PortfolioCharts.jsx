import { useState, useEffect, useCallback } from 'react';
import Plot from 'react-plotly.js';
import Spinner from '../common/Spinner';

const BLOOMBERG = {
  bg: '#1a1a2e',
  panel: '#16213e',
  accent: '#4cc9f0',
  green: '#00e676',
  red: '#ff5252',
  yellow: '#ffd600',
  text: '#e0e0e0',
  muted: '#8892b0',
  grid: 'rgba(255,255,255,0.06)',
};

const HORIZONTES = [
  { key: '6m', label: '6 meses' },
  { key: '1y', label: '1 año' },
  { key: '2y', label: '2 años' },
  { key: '5y', label: '5 años' },
];

const RANGOS_HIST = [
  { key: '30d', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1A' },
];

const plotLayout = (title) => ({
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: BLOOMBERG.muted, size: 11 },
  title: { text: title, font: { size: 13, color: BLOOMBERG.text }, x: 0.01, y: 0.98 },
  margin: { t: 35, r: 15, b: 35, l: 55 },
  xaxis: { gridcolor: BLOOMBERG.grid, showgrid: true },
  yaxis: { gridcolor: BLOOMBERG.grid, showgrid: true },
  showlegend: false,
  autosize: true,
});

/**
 * Panel de gráficas del portafolio: donut de asignación, valor histórico, proyección.
 */
export default function PortfolioCharts({ portafolioId, posiciones, moneda = 'USD' }) {
  const [historico, setHistorico] = useState(null);
  const [rangoHist, setRangoHist] = useState('3m');
  const [cargandoHist, setCargandoHist] = useState(false);

  const [proyeccion, setProyeccion] = useState(null);
  const [horizonte, setHorizonte] = useState('1y');
  const [cargandoProy, setCargandoProy] = useState(false);

  // Fetch histórico
  const fetchHistorico = useCallback(async (rango) => {
    setCargandoHist(true);
    try {
      const r = await fetch(`/api/portafolios/${portafolioId}/historico?rango=${rango}`);
      if (r.ok) setHistorico(await r.json());
    } catch { /* ignore */ }
    finally { setCargandoHist(false); }
  }, [portafolioId]);

  // Fetch proyección
  const fetchProyeccion = useCallback(async (h) => {
    setCargandoProy(true);
    try {
      const r = await fetch(`/api/portafolios/${portafolioId}/proyeccion?horizonte=${h}`);
      if (r.ok) setProyeccion(await r.json());
    } catch { /* ignore */ }
    finally { setCargandoProy(false); }
  }, [portafolioId]);

  useEffect(() => { fetchHistorico(rangoHist); }, [fetchHistorico, rangoHist]);
  useEffect(() => { fetchProyeccion(horizonte); }, [fetchProyeccion, horizonte]);

  // ─── Donut de asignación ──────────────────────────────────────
  const posActivas = (posiciones || []).filter(p => p.cantidad > 0 && p.valor_mercado > 0);
  const donutData = posActivas.length > 0 ? [{
    type: 'pie',
    hole: 0.55,
    labels: posActivas.map(p => p.ticker),
    values: posActivas.map(p => p.valor_mercado),
    textinfo: 'label+percent',
    textposition: 'outside',
    marker: {
      colors: ['#4cc9f0', '#00e676', '#ffd600', '#ff5252', '#7c4dff', '#ff6d00', '#00bcd4', '#e040fb'],
    },
    hovertemplate: '%{label}: $%{value:,.2f} (%{percent})<extra></extra>',
  }] : null;

  return (
    <div className="mt-6 space-y-4">
      {/* Fila 1: Donut + Histórico */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Donut */}
        <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-bloomberg-text-muted mb-3">
            Asignación del Portafolio
          </h3>
          {donutData ? (
            <Plot
              data={donutData}
              layout={{
                ...plotLayout(''),
                title: undefined,
                margin: { t: 10, r: 10, b: 10, l: 10 },
                showlegend: true,
                legend: { font: { color: BLOOMBERG.muted, size: 10 }, orientation: 'h', y: -0.1 },
              }}
              config={{ displayModeBar: false, responsive: true }}
              useResizeHandler
              style={{ width: '100%', height: 280 }}
            />
          ) : (
            <p className="text-sm text-bloomberg-text-muted text-center py-8">
              Sin posiciones activas
            </p>
          )}
        </div>

        {/* Valor histórico */}
        <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-bloomberg-text-muted">
              Valor Histórico
            </h3>
            <div className="flex gap-1">
              {RANGOS_HIST.map(r => (
                <button
                  key={r.key}
                  onClick={() => setRangoHist(r.key)}
                  className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                    rangoHist === r.key
                      ? 'bg-bloomberg-accent/20 border-bloomberg-accent/40 text-bloomberg-accent'
                      : 'bg-white/5 border-white/10 text-bloomberg-text-muted hover:bg-white/10'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {cargandoHist ? (
            <div className="flex justify-center py-8"><Spinner mensaje="Cargando histórico..." /></div>
          ) : historico?.fechas?.length > 0 ? (
            <Plot
              data={[{
                type: 'scatter',
                mode: 'lines',
                x: historico.fechas,
                y: historico.valores,
                line: { color: BLOOMBERG.accent, width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(76,201,240,0.08)',
                hovertemplate: '%{x}<br>$%{y:,.2f}<extra></extra>',
              }]}
              layout={{
                ...plotLayout(''),
                title: undefined,
                margin: { t: 5, r: 15, b: 30, l: 55 },
                yaxis: { gridcolor: BLOOMBERG.grid, showgrid: true, tickprefix: '$', tickformat: ',.0f' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              useResizeHandler
              style={{ width: '100%', height: 280 }}
            />
          ) : (
            <p className="text-sm text-bloomberg-text-muted text-center py-8">
              Sin datos históricos disponibles
            </p>
          )}
        </div>
      </div>

      {/* Fila 2: Proyección */}
      <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-bloomberg-text-muted">
              Proyección de Rendimiento
            </h3>
            {proyeccion && (
              <p className="text-[10px] text-bloomberg-text-muted mt-0.5">
                Rend. anual: <span className="text-bloomberg-green">{proyeccion.rendimiento_anual}%</span>
                {' · '}Vol: <span className="text-bloomberg-yellow">{proyeccion.volatilidad_anual}%</span>
                {' · '}Simulación Monte Carlo ({500} trayectorias)
              </p>
            )}
          </div>
          <div className="flex gap-1">
            {HORIZONTES.map(h => (
              <button
                key={h.key}
                onClick={() => setHorizonte(h.key)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  horizonte === h.key
                    ? 'bg-bloomberg-accent/20 border-bloomberg-accent/40 text-bloomberg-accent'
                    : 'bg-white/5 border-white/10 text-bloomberg-text-muted hover:bg-white/10'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        {cargandoProy ? (
          <div className="flex justify-center py-8"><Spinner mensaje="Calculando proyección..." /></div>
        ) : proyeccion?.fechas?.length > 0 ? (
          <Plot
            data={[
              // Banda p10-p90
              {
                type: 'scatter',
                x: [...proyeccion.fechas, ...[...proyeccion.fechas].reverse()],
                y: [...proyeccion.p90, ...[...proyeccion.p10].reverse()],
                fill: 'toself',
                fillcolor: 'rgba(76,201,240,0.1)',
                line: { color: 'transparent' },
                name: 'Rango p10-p90',
                showlegend: true,
                hoverinfo: 'skip',
              },
              // p50 (mediana)
              {
                type: 'scatter',
                mode: 'lines',
                x: proyeccion.fechas,
                y: proyeccion.p50,
                line: { color: BLOOMBERG.accent, width: 2 },
                name: 'Mediana (p50)',
                hovertemplate: '%{x}<br>$%{y:,.2f}<extra>Mediana</extra>',
              },
              // p90 (optimista)
              {
                type: 'scatter',
                mode: 'lines',
                x: proyeccion.fechas,
                y: proyeccion.p90,
                line: { color: BLOOMBERG.green, width: 1, dash: 'dot' },
                name: 'Optimista (p90)',
                hovertemplate: '%{x}<br>$%{y:,.2f}<extra>Optimista</extra>',
              },
              // p10 (pesimista)
              {
                type: 'scatter',
                mode: 'lines',
                x: proyeccion.fechas,
                y: proyeccion.p10,
                line: { color: BLOOMBERG.red, width: 1, dash: 'dot' },
                name: 'Pesimista (p10)',
                hovertemplate: '%{x}<br>$%{y:,.2f}<extra>Pesimista</extra>',
              },
            ]}
            layout={{
              ...plotLayout(''),
              title: undefined,
              margin: { t: 5, r: 15, b: 30, l: 60 },
              yaxis: { gridcolor: BLOOMBERG.grid, showgrid: true, tickprefix: '$', tickformat: ',.0f' },
              showlegend: true,
              legend: { font: { color: BLOOMBERG.muted, size: 10 }, orientation: 'h', y: -0.15 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 320 }}
          />
        ) : (
          <p className="text-sm text-bloomberg-text-muted text-center py-8">
            Sin datos para proyección
          </p>
        )}
      </div>
    </div>
  );
}

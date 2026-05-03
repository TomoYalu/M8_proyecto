/**
 * Paleta de colores Bloomberg para uso en componentes y gráficos Plotly.
 * Sincronizada con tailwind.config.js.
 */

// ─── Colores base del tema ──────────────────────────────────────
export const BLOOMBERG_BG = '#0b0f19';
export const BLOOMBERG_PANEL = '#141b2d';
export const BLOOMBERG_ACCENT = '#3b82f6';
export const BLOOMBERG_TEXT = '#e2e8f0';
export const BLOOMBERG_TEXT_MUTED = '#94a3b8';

// ─── Colores semánticos ─────────────────────────────────────────
export const BLOOMBERG_GREEN = '#22c55e';
export const BLOOMBERG_RED = '#ef4444';
export const BLOOMBERG_YELLOW = '#eab308';

// ─── Colores para gráficos ──────────────────────────────────────
export const CHART_GRID = '#253152';
export const CHART_CANDLE_UP = '#22c55e';
export const CHART_CANDLE_DOWN = '#f43f5e';
export const CHART_SMA50 = '#f59e0b';
export const CHART_SMA200 = '#3b82f6';
export const CHART_RSI = '#a855f7';
export const CHART_MACD_LINE = '#3b82f6';
export const CHART_MACD_SIGNAL = '#f59e0b';
export const CHART_BOLLINGER = '#94a3b8';
export const CHART_VOLUME_UP = 'rgba(34,197,94,0.6)';
export const CHART_VOLUME_DOWN = 'rgba(244,63,94,0.6)';

// ─── Colores de semáforo ────────────────────────────────────────
export const SEMAFORO_VERDE = '#22c55e';
export const SEMAFORO_AMARILLO = '#eab308';
export const SEMAFORO_ROJO = '#ef4444';

// ─── Colores de Fibonacci ───────────────────────────────────────
export const FIBONACCI_COLORS = {
  '0%':    '#22c55e',
  '23.6%': '#3b82f6',
  '38.2%': '#f59e0b',
  '50%':   '#94a3b8',
  '61.8%': '#f59e0b',
  '78.6%': '#3b82f6',
  '100%':  '#f43f5e',
};

// ─── Layout base para Plotly ────────────────────────────────────
export const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: BLOOMBERG_PANEL,
  plot_bgcolor: BLOOMBERG_PANEL,
  font: {
    color: BLOOMBERG_TEXT,
    size: 12,
    family: 'Inter, system-ui, sans-serif',
  },
  margin: { l: 60, r: 50, t: 40, b: 50 },
  xaxis: {
    gridcolor: CHART_GRID,
    linecolor: CHART_GRID,
    rangeslider: { visible: false },
    title: { standoff: 15 },
  },
  yaxis: {
    gridcolor: CHART_GRID,
    linecolor: CHART_GRID,
    title: { standoff: 15 },
  },
  legend: {
    bgcolor: `rgba(20,27,45,0.7)`,
    font: { size: 11 },
    orientation: 'h',
    yanchor: 'bottom',
    y: 1.02,
    xanchor: 'right',
    x: 1,
  },
  hovermode: 'x unified',
};

export const PLOTLY_CONFIG = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  displaylogo: false,
};

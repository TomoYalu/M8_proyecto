/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import Plot from 'react-plotly.js';

/**
 * Gráfico de líneas de crecimiento histórico de $1 invertido.
 *
 * Compara la evolución de $1 bajo las distribuciones de
 * Min Varianza y Max Sharpe durante el período analizado.
 *
 * @param {object} props
 * @param {object} props.historico - { fechas: string[], min_varianza: number[], max_sharpe: number[] }
 *
 * Requisitos cubiertos: 6.3, 7.8
 */
export default function GrowthChart({ historico }) {
  if (!historico || !historico.fechas) return null;

  const { fechas, min_varianza, max_sharpe } = historico;

  const minVarTrace = {
    x: fechas,
    y: min_varianza,
    type: 'scatter',
    mode: 'lines',
    name: 'Min Varianza',
    line: { color: '#3b82f6', width: 2 },
    hovertemplate: '<b>Min Varianza</b><br>Fecha: %{x}<br>Valor: $%{y:.4f}<extra></extra>',
  };

  const maxSharpeTrace = {
    x: fechas,
    y: max_sharpe,
    type: 'scatter',
    mode: 'lines',
    name: 'Max Sharpe',
    line: { color: '#22c55e', width: 2 },
    hovertemplate: '<b>Max Sharpe</b><br>Fecha: %{x}<br>Valor: $%{y:.4f}<extra></extra>',
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#e2e8f0', family: 'Inter, sans-serif', size: 12 },
    xaxis: {
      title: { text: 'Fecha', font: { size: 12 } },
      gridcolor: 'rgba(255,255,255,0.06)',
      tickfont: { size: 10, color: '#94a3b8' },
    },
    yaxis: {
      title: { text: 'Valor ($1 invertido)', font: { size: 12 } },
      gridcolor: 'rgba(255,255,255,0.06)',
      zerolinecolor: 'rgba(255,255,255,0.1)',
      tickfont: { size: 10, color: '#94a3b8' },
      tickprefix: '$',
    },
    legend: {
      orientation: 'h',
      y: -0.18,
      x: 0.5,
      xanchor: 'center',
      font: { size: 10, color: '#94a3b8' },
      bgcolor: 'transparent',
    },
    margin: { t: 20, r: 20, b: 70, l: 60 },
    hovermode: 'x unified',
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div aria-label="Gráfico de crecimiento histórico de $1 invertido">
      <Plot
        data={[minVarTrace, maxSharpeTrace]}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 350 }}
      />
    </div>
  );
}

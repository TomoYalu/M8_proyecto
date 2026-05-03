import Plot from 'react-plotly.js';

/**
 * Gráfico de drawdown histórico (caída % desde pico).
 *
 * Calcula el drawdown a partir de los valores de crecimiento:
 * dd[t] = value[t] / max(value[0:t]) - 1
 * y lo muestra como área rellena hacia cero para ambos portafolios.
 *
 * @param {object} props
 * @param {object} props.historico - { fechas: string[], min_varianza: number[], max_sharpe: number[] }
 *
 * Requisitos cubiertos: 6.7, 7.8
 */
export default function DrawdownChart({ historico }) {
  if (!historico || !historico.fechas) return null;

  const { fechas, min_varianza, max_sharpe } = historico;

  /**
   * Calcula la serie de drawdown a partir de valores de crecimiento.
   * dd[t] = value[t] / max(value[0..t]) - 1
   */
  function calcularDrawdown(valores) {
    if (!valores || valores.length === 0) return [];
    const dd = [];
    let pico = valores[0];
    for (let i = 0; i < valores.length; i++) {
      if (valores[i] > pico) pico = valores[i];
      dd.push(pico > 0 ? ((valores[i] / pico) - 1) * 100 : 0);
    }
    return dd;
  }

  const ddMinVar = calcularDrawdown(min_varianza);
  const ddMaxSharpe = calcularDrawdown(max_sharpe);

  const minVarTrace = {
    x: fechas,
    y: ddMinVar,
    type: 'scatter',
    mode: 'lines',
    name: 'Min Varianza',
    fill: 'tozeroy',
    fillcolor: 'rgba(59,130,246,0.15)',
    line: { color: '#3b82f6', width: 1.5 },
    hovertemplate: '<b>Min Varianza</b><br>Fecha: %{x}<br>Drawdown: %{y:.2f}%<extra></extra>',
  };

  const maxSharpeTrace = {
    x: fechas,
    y: ddMaxSharpe,
    type: 'scatter',
    mode: 'lines',
    name: 'Max Sharpe',
    fill: 'tozeroy',
    fillcolor: 'rgba(34,197,94,0.15)',
    line: { color: '#22c55e', width: 1.5 },
    hovertemplate: '<b>Max Sharpe</b><br>Fecha: %{x}<br>Drawdown: %{y:.2f}%<extra></extra>',
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
      title: { text: 'Drawdown (%)', font: { size: 12 } },
      gridcolor: 'rgba(255,255,255,0.06)',
      zerolinecolor: 'rgba(255,255,255,0.15)',
      zerolinewidth: 1,
      tickfont: { size: 10, color: '#94a3b8' },
      ticksuffix: '%',
    },
    legend: {
      orientation: 'h',
      y: -0.18,
      x: 0.5,
      xanchor: 'center',
      font: { size: 10, color: '#94a3b8' },
      bgcolor: 'transparent',
    },
    margin: { t: 20, r: 20, b: 70, l: 55 },
    hovermode: 'x unified',
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div aria-label="Gráfico de drawdown histórico">
      <Plot
        data={[minVarTrace, maxSharpeTrace]}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 300 }}
      />
    </div>
  );
}

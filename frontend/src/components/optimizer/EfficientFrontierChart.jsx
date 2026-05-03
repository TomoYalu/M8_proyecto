import Plot from 'react-plotly.js';

/**
 * Scatter plot de la Frontera Eficiente de Markowitz.
 *
 * Muestra la nube de portafolios simulados coloreados por Sharpe,
 * marca Max Sharpe (estrella dorada) y Min Varianza (estrella azul),
 * y traza la Capital Market Line (CML) desde la tasa libre de riesgo.
 *
 * @param {object} props
 * @param {object} props.frontera - { rendimiento: number[], riesgo: number[], sharpe: number[] }
 * @param {object} props.maxSharpe - { rendimiento: number, riesgo: number, sharpe: number }
 * @param {object} props.minVarianza - { rendimiento: number, riesgo: number, sharpe: number }
 * @param {number} props.rf - Tasa libre de riesgo (%)
 *
 * Requisitos cubiertos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.8
 */
export default function EfficientFrontierChart({ frontera, maxSharpe, minVarianza, rf }) {
  if (!frontera || !maxSharpe || !minVarianza) return null;

  const { rendimiento, riesgo, sharpe } = frontera;

  // Nube de puntos simulados coloreada por Sharpe
  const nubeTrace = {
    x: riesgo,
    y: rendimiento,
    mode: 'markers',
    type: 'scatter',
    name: 'Portafolios simulados',
    marker: {
      size: 5,
      color: sharpe,
      colorscale: 'RdYlGn',
      opacity: 0.85,
      colorbar: {
        title: { text: 'Sharpe', font: { color: '#e2e8f0', size: 11 } },
        tickfont: { color: '#94a3b8', size: 10 },
        bordercolor: 'rgba(255,255,255,0.1)',
      },
      line: { width: 0.3, color: 'rgba(255,255,255,0.15)' },
    },
    text: sharpe.map((s, i) =>
      `Rend: ${rendimiento[i]?.toFixed(2)}%<br>Riesgo: ${riesgo[i]?.toFixed(2)}%<br>Sharpe: ${s?.toFixed(3)}`
    ),
    hoverinfo: 'text',
  };

  // Estrella Max Sharpe (dorada)
  const maxSharpeTrace = {
    x: [maxSharpe.riesgo],
    y: [maxSharpe.rendimiento],
    mode: 'markers+text',
    type: 'scatter',
    name: `Max Sharpe (${maxSharpe.sharpe?.toFixed(3)})`,
    marker: { size: 16, color: '#fbbf24', symbol: 'star', line: { width: 1.5, color: '#fff' } },
    text: ['Max Sharpe'],
    textposition: 'top center',
    textfont: { color: '#fbbf24', size: 11, family: 'Inter, sans-serif' },
    hovertext: `<b>Max Sharpe</b><br>Rend: ${maxSharpe.rendimiento?.toFixed(2)}%<br>Riesgo: ${maxSharpe.riesgo?.toFixed(2)}%<br>Sharpe: ${maxSharpe.sharpe?.toFixed(3)}`,
    hoverinfo: 'text',
  };

  // Estrella Min Varianza (azul)
  const minVarTrace = {
    x: [minVarianza.riesgo],
    y: [minVarianza.rendimiento],
    mode: 'markers+text',
    type: 'scatter',
    name: `Min Varianza (σ=${minVarianza.riesgo?.toFixed(2)}%)`,
    marker: { size: 16, color: '#3b82f6', symbol: 'star', line: { width: 1.5, color: '#fff' } },
    text: ['Min Varianza'],
    textposition: 'bottom center',
    textfont: { color: '#3b82f6', size: 11, family: 'Inter, sans-serif' },
    hovertext: `<b>Min Varianza</b><br>Rend: ${minVarianza.rendimiento?.toFixed(2)}%<br>Riesgo: ${minVarianza.riesgo?.toFixed(2)}%<br>Sharpe: ${minVarianza.sharpe?.toFixed(3)}`,
    hoverinfo: 'text',
  };

  // CML: línea discontinua blanca desde (0, rf) pasando por Max Sharpe, extrapolada
  const rfVal = rf ?? 0;
  const pendienteCML =
    maxSharpe.riesgo > 0
      ? (maxSharpe.rendimiento - rfVal) / maxSharpe.riesgo
      : 0;
  const maxRiesgo = Math.max(...riesgo, maxSharpe.riesgo) * 1.3;
  const cmlX = [0, maxSharpe.riesgo, maxRiesgo];
  const cmlY = cmlX.map((x) => rfVal + pendienteCML * x);

  const cmlTrace = {
    x: cmlX,
    y: cmlY,
    mode: 'lines',
    type: 'scatter',
    name: 'CML',
    line: { dash: 'dot', color: 'rgba(255,255,255,0.6)', width: 1.5 },
    hoverinfo: 'skip',
  };

  // Punto Rf
  const rfTrace = {
    x: [0],
    y: [rfVal],
    mode: 'markers+text',
    type: 'scatter',
    name: `Rf (${rfVal.toFixed(2)}%)`,
    marker: { size: 8, color: '#94a3b8', symbol: 'diamond', line: { width: 1, color: '#fff' } },
    text: ['Rf'],
    textposition: 'middle right',
    textfont: { color: '#94a3b8', size: 10 },
    hovertext: `Tasa libre de riesgo: ${rfVal.toFixed(2)}%`,
    hoverinfo: 'text',
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#e2e8f0', family: 'Inter, sans-serif', size: 12 },
    xaxis: {
      title: { text: 'Riesgo (Volatilidad %)', font: { size: 12 } },
      type: 'linear',
      gridcolor: 'rgba(255,255,255,0.06)',
      zerolinecolor: 'rgba(255,255,255,0.1)',
      tickfont: { size: 10 },
    },
    yaxis: {
      title: { text: 'Rendimiento Esperado (%)', font: { size: 12 } },
      gridcolor: 'rgba(255,255,255,0.06)',
      zerolinecolor: 'rgba(255,255,255,0.1)',
      tickfont: { size: 10 },
    },
    legend: {
      orientation: 'h',
      y: -0.18,
      x: 0.5,
      xanchor: 'center',
      font: { size: 10 },
      bgcolor: 'transparent',
    },
    margin: { t: 30, r: 20, b: 80, l: 60 },
    hovermode: 'closest',
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div aria-label="Gráfico de Frontera Eficiente de Markowitz">
      <Plot
        data={[nubeTrace, maxSharpeTrace, minVarTrace, cmlTrace, rfTrace]}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 400 }}
      />
    </div>
  );
}

import Plot from 'react-plotly.js';

/**
 * Gráfico de barras agrupadas comparando pesos de portafolios.
 *
 * Compara los pesos de Min Varianza vs Max Sharpe por ticker.
 * Opcionalmente incluye los pesos actuales del portafolio existente.
 *
 * @param {object} props
 * @param {object} props.maxSharpe - Objeto ticker → peso (%), ej: { AAPL: 35.2, MSFT: 40.1 }
 * @param {object} props.minVarianza - Objeto ticker → peso (%)
 * @param {object} [props.pesosActuales] - Objeto ticker → peso (%) del portafolio existente
 *
 * Requisitos cubiertos: 6.4, 6.5, 7.8
 */
export default function WeightBars({ maxSharpe, minVarianza, pesosActuales }) {
  if (!maxSharpe || !minVarianza) return null;

  // Unificar tickers de todas las fuentes
  const tickerSet = new Set([
    ...Object.keys(maxSharpe),
    ...Object.keys(minVarianza),
    ...(pesosActuales ? Object.keys(pesosActuales) : []),
  ]);
  const tickers = [...tickerSet].sort();

  const traces = [];

  // Pesos actuales (si existen)
  if (pesosActuales) {
    traces.push({
      x: tickers,
      y: tickers.map((t) => pesosActuales[t] ?? 0),
      type: 'bar',
      name: 'Pesos Actuales',
      marker: { color: '#94a3b8', opacity: 0.7 },
      hovertemplate: '<b>%{x}</b><br>Peso actual: %{y:.1f}%<extra></extra>',
    });
  }

  // Min Varianza
  traces.push({
    x: tickers,
    y: tickers.map((t) => minVarianza[t] ?? 0),
    type: 'bar',
    name: 'Min Varianza',
    marker: { color: '#3b82f6' },
    hovertemplate: '<b>%{x}</b><br>Min Varianza: %{y:.1f}%<extra></extra>',
  });

  // Max Sharpe
  traces.push({
    x: tickers,
    y: tickers.map((t) => maxSharpe[t] ?? 0),
    type: 'bar',
    name: 'Max Sharpe',
    marker: { color: '#22c55e' },
    hovertemplate: '<b>%{x}</b><br>Max Sharpe: %{y:.1f}%<extra></extra>',
  });

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#e2e8f0', family: 'Inter, sans-serif', size: 12 },
    barmode: 'group',
    xaxis: {
      title: { text: 'Activo', font: { size: 12 } },
      tickfont: { size: 10, color: '#94a3b8' },
    },
    yaxis: {
      title: { text: 'Peso (%)', font: { size: 12 } },
      gridcolor: 'rgba(255,255,255,0.06)',
      tickfont: { size: 10, color: '#94a3b8' },
      ticksuffix: '%',
    },
    legend: {
      orientation: 'h',
      y: -0.2,
      x: 0.5,
      xanchor: 'center',
      font: { size: 10, color: '#94a3b8' },
      bgcolor: 'transparent',
    },
    margin: { t: 20, r: 20, b: 80, l: 55 },
    bargap: 0.2,
    bargroupgap: 0.1,
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div aria-label="Gráfico de barras comparando pesos de portafolios">
      <Plot
        data={traces}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 350 }}
      />
    </div>
  );
}

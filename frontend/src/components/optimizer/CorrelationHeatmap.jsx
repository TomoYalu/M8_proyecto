import Plot from 'react-plotly.js';

/**
 * Heatmap de la matriz de correlación entre activos.
 *
 * Muestra los coeficientes de correlación con escala RdYlGn,
 * nombres de tickers en ambos ejes y valores visibles en cada celda.
 *
 * @param {object} props
 * @param {object} props.correlacion - Objeto de objetos { AAPL: { AAPL: 1.0, MSFT: 0.78, ... }, ... }
 * @param {string[]} props.tickers - Lista de tickers para los ejes
 *
 * Requisitos cubiertos: 6.2, 7.8
 */
export default function CorrelationHeatmap({ correlacion, tickers }) {
  if (!correlacion || !tickers || tickers.length === 0) return null;

  // Construir la matriz z a partir del objeto de correlación
  const z = tickers.map((row) =>
    tickers.map((col) => {
      const val = correlacion[row]?.[col];
      return val != null ? Number(val.toFixed(2)) : 0;
    })
  );

  // Texto de anotaciones para cada celda
  const annotations = [];
  tickers.forEach((row, i) => {
    tickers.forEach((col, j) => {
      annotations.push({
        x: col,
        y: row,
        text: z[i][j].toFixed(2),
        font: {
          color: Math.abs(z[i][j]) > 0.6 ? '#fff' : '#e2e8f0',
          size: tickers.length > 8 ? 9 : 11,
        },
        showarrow: false,
      });
    });
  });

  const trace = {
    z,
    x: tickers,
    y: tickers,
    type: 'heatmap',
    colorscale: 'RdYlGn',
    zmin: -1,
    zmax: 1,
    showscale: true,
    colorbar: {
      title: { text: 'Correlación', font: { color: '#e2e8f0', size: 11 } },
      tickfont: { color: '#94a3b8', size: 10 },
      bordercolor: 'rgba(255,255,255,0.1)',
    },
    hovertemplate: '%{y} vs %{x}: %{z:.2f}<extra></extra>',
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#e2e8f0', family: 'Inter, sans-serif', size: 12 },
    xaxis: {
      tickfont: { size: 10, color: '#94a3b8' },
      side: 'bottom',
    },
    yaxis: {
      tickfont: { size: 10, color: '#94a3b8' },
      autorange: 'reversed',
    },
    annotations,
    margin: { t: 20, r: 20, b: 60, l: 70 },
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div aria-label="Heatmap de matriz de correlación entre activos">
      <Plot
        data={[trace]}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 350 }}
      />
    </div>
  );
}

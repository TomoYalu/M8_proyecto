import Plot from 'react-plotly.js';

/**
 * Gráfico de dona (donut chart) de asignación de activos.
 *
 * Muestra los pesos porcentuales de cada ticker con colores distinguibles
 * y un hueco central (hole=0.7) para estilo Bloomberg.
 *
 * @param {object} props
 * @param {object} props.pesos - Objeto ticker → porcentaje, ej: { AAPL: 35.2, MSFT: 40.1 }
 * @param {string} props.titulo - Título del gráfico (ej: "Max Sharpe", "Min Varianza")
 *
 * Requisitos cubiertos: 6.1, 7.8
 */
export default function AllocationDonut({ pesos, titulo }) {
  if (!pesos || Object.keys(pesos).length === 0) return null;

  const tickers = Object.keys(pesos);
  const valores = Object.values(pesos);

  // Paleta de colores distinguibles para el tema oscuro
  const colores = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
    '#e11d48', '#84cc16', '#0ea5e9', '#d946ef', '#facc15',
  ];

  const trace = {
    labels: tickers,
    values: valores,
    type: 'pie',
    hole: 0.7,
    marker: {
      colors: colores.slice(0, tickers.length),
      line: { color: 'rgba(20,27,45,0.8)', width: 2 },
    },
    textinfo: 'label+percent',
    textposition: 'outside',
    textfont: { color: '#e2e8f0', size: 11, family: 'Inter, sans-serif' },
    hovertemplate: '<b>%{label}</b><br>Peso: %{value:.1f}%<br>(%{percent})<extra></extra>',
    sort: false,
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#e2e8f0', family: 'Inter, sans-serif', size: 12 },
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.1,
      x: 0.5,
      xanchor: 'center',
      font: { size: 10, color: '#94a3b8' },
      bgcolor: 'transparent',
    },
    annotations: [
      {
        text: titulo || '',
        showarrow: false,
        font: { size: 14, color: '#e2e8f0', family: 'Inter, sans-serif' },
        x: 0.5,
        y: 0.5,
        xanchor: 'center',
        yanchor: 'middle',
      },
    ],
    margin: { t: 20, r: 20, b: 50, l: 20 },
  };

  const config = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div aria-label={`Gráfico de asignación de activos: ${titulo || 'Portafolio'}`}>
      <Plot
        data={[trace]}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 300 }}
      />
    </div>
  );
}

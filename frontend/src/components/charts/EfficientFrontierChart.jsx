/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Análisis Técnico
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import Plot from 'react-plotly.js';
import {
  mergeLayout,
  chartTitle,
  axisTitle,
  hoverTemplatePercent,
  plotlyConfig,
  LINE_WIDTH_PRIMARY,
  LINE_WIDTH_SECONDARY,
} from '../../utils/plotlyDefaults';
import {
  BLOOMBERG_GREEN,
  BLOOMBERG_YELLOW,
  BLOOMBERG_RED,
  BLOOMBERG_TEXT,
} from '../../utils/colors';

/**
 * Gráfico de Frontera Eficiente de Markowitz con:
 * - Scatter de puntos de la frontera coloreados por Sharpe ratio
 * - Portafolio de mínima varianza y máximo Sharpe destacados
 * - Capital Market Line (CML)
 *
 * Usa plotlyDefaults.js para layout consistente con tema Bloomberg oscuro,
 * fuentes legibles (tick ≥ 13, title ≥ 15), leyendas semi-transparentes
 * y tooltips con formato porcentual claro.
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta del endpoint POST /api/analisis/portafolio
 */
export default function EfficientFrontierChart({ datos }) {
  if (!datos?.frontera) return null;

  const { frontera, min_varianza, max_sharpe } = datos;

  const traces = [];

  // Frontera eficiente — scatter con colorscale por Sharpe (contraste mejorado)
  if (frontera.riesgo?.length) {
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: frontera.riesgo,
      y: frontera.rendimiento,
      marker: {
        color: frontera.sharpe,
        colorscale: [
          [0, BLOOMBERG_RED],
          [0.5, BLOOMBERG_YELLOW],
          [1, BLOOMBERG_GREEN],
        ],
        size: 10,
        opacity: 0.9,
        line: { color: 'rgba(255,255,255,0.3)', width: 0.5 },
        colorbar: {
          title: { text: 'Sharpe', font: { size: 13 } },
          thickness: 14,
          len: 0.6,
          tickfont: { size: 12 },
        },
      },
      hovertemplate:
        'Riesgo: %{x:.2f}%<br>Retorno: %{y:.2f}%<br>Sharpe: %{text}<extra></extra>',
      text: frontera.sharpe.map((s) => s.toFixed(3)),
      name: 'Frontera Eficiente',
    });
  }

  // Portafolio de mínima varianza — marcador más visible
  if (min_varianza) {
    traces.push({
      type: 'scatter',
      mode: 'markers+text',
      x: [min_varianza.riesgo],
      y: [min_varianza.rendimiento],
      marker: {
        color: BLOOMBERG_YELLOW,
        size: 16,
        symbol: 'star',
        line: { color: '#fff', width: LINE_WIDTH_SECONDARY },
      },
      text: ['Mín. Varianza'],
      textposition: 'top center',
      textfont: { color: BLOOMBERG_YELLOW, size: 12 },
      name: 'Mín. Varianza',
      hovertemplate:
        '<b>Mín. Varianza</b><br>' +
        `Rend: ${min_varianza.rendimiento?.toFixed(2)}%<br>` +
        `Riesgo: ${min_varianza.riesgo?.toFixed(2)}%<br>` +
        `Sharpe: ${min_varianza.sharpe?.toFixed(3)}` +
        '<extra></extra>',
    });
  }

  // Portafolio de máximo Sharpe — marcador más visible
  if (max_sharpe) {
    traces.push({
      type: 'scatter',
      mode: 'markers+text',
      x: [max_sharpe.riesgo],
      y: [max_sharpe.rendimiento],
      marker: {
        color: BLOOMBERG_GREEN,
        size: 16,
        symbol: 'star',
        line: { color: '#fff', width: LINE_WIDTH_SECONDARY },
      },
      text: ['Máx. Sharpe'],
      textposition: 'top center',
      textfont: { color: BLOOMBERG_GREEN, size: 12 },
      name: 'Máx. Sharpe',
      hovertemplate:
        '<b>Máx. Sharpe</b><br>' +
        `Rend: ${max_sharpe.rendimiento?.toFixed(2)}%<br>` +
        `Riesgo: ${max_sharpe.riesgo?.toFixed(2)}%<br>` +
        `Sharpe: ${max_sharpe.sharpe?.toFixed(3)}` +
        '<extra></extra>',
    });
  }

  // Capital Market Line (CML) — línea más visible con contraste mejorado
  if (max_sharpe && frontera.riesgo?.length) {
    const maxRisk = Math.max(...frontera.riesgo) * 1.2;
    const rf = 4; // tasa libre de riesgo por defecto (4%)
    const cmlSlope =
      max_sharpe.riesgo > 0
        ? (max_sharpe.rendimiento - rf) / max_sharpe.riesgo
        : 0;
    const cmlEnd = rf + cmlSlope * maxRisk;

    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [0, maxRisk],
      y: [rf, cmlEnd],
      name: 'CML',
      line: { color: BLOOMBERG_TEXT, width: LINE_WIDTH_PRIMARY, dash: 'dash' },
      hoverinfo: 'skip',
    });
  }

  const layout = mergeLayout({
    title: chartTitle('Frontera Eficiente de Markowitz'),
    xaxis: {
      title: axisTitle('Riesgo (Volatilidad %)'),
    },
    yaxis: {
      title: axisTitle('Retorno Esperado (%)'),
    },
    hovermode: 'closest',
  });

  return (
    <div role="img" aria-label="Gráfico de frontera eficiente de Markowitz">
      <Plot
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 400 }}
      />
    </div>
  );
}

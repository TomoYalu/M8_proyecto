import Plot from 'react-plotly.js';
import {
  mergeLayout,
  axisTitle,
  hoverTemplateNumber,
  plotlyConfig,
  LINE_WIDTH_PRIMARY,
} from '../../utils/plotlyDefaults';
import ChartHeader from './ChartHeader';
import {
  CHART_RSI,
  BLOOMBERG_RED,
  BLOOMBERG_GREEN,
  BLOOMBERG_TEXT_MUTED,
} from '../../utils/colors';

/**
 * Gráfico RSI (14) con áreas sombreadas de sobrecompra/sobreventa
 * y líneas horizontales en 70, 50 y 30.
 *
 * Usa plotlyDefaults.js para layout consistente con tema Bloomberg oscuro,
 * fuentes legibles (tick ≥ 13, title ≥ 15), leyendas semi-transparentes
 * y tooltips con formato numérico claro.
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function RSIChart({ datos }) {
  if (!datos?.rsi || !datos?.fechas) return null;

  const { fechas, rsi } = datos;

  const traces = [
    // Área sobrecompra (>70) — contraste mejorado
    {
      type: 'scatter',
      mode: 'none',
      x: fechas,
      y: Array(fechas.length).fill(100),
      showlegend: false,
      hoverinfo: 'skip',
    },
    {
      type: 'scatter',
      mode: 'none',
      x: fechas,
      y: Array(fechas.length).fill(70),
      fill: 'tonexty',
      fillcolor: 'rgba(239,68,68,0.15)',
      name: 'Sobrecompra (>70)',
      showlegend: true,
      hoverinfo: 'skip',
    },
    // Área sobreventa (<30) — contraste mejorado
    {
      type: 'scatter',
      mode: 'none',
      x: fechas,
      y: Array(fechas.length).fill(30),
      showlegend: false,
      hoverinfo: 'skip',
    },
    {
      type: 'scatter',
      mode: 'none',
      x: fechas,
      y: Array(fechas.length).fill(0),
      fill: 'tonexty',
      fillcolor: 'rgba(34,197,94,0.15)',
      name: 'Sobreventa (<30)',
      showlegend: true,
      hoverinfo: 'skip',
    },
    // Línea RSI — más gruesa para mejor visibilidad
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: rsi,
      name: 'RSI (14)',
      line: { color: CHART_RSI, width: LINE_WIDTH_PRIMARY },
      hovertemplate: hoverTemplateNumber('RSI', 2),
    },
  ];

  const shapes = [
    // Línea 70 — sobrecompra
    {
      type: 'line',
      x0: fechas[0],
      x1: fechas[fechas.length - 1],
      y0: 70,
      y1: 70,
      line: { color: BLOOMBERG_RED, width: 1.5, dash: 'dash' },
    },
    // Línea 50 — neutral
    {
      type: 'line',
      x0: fechas[0],
      x1: fechas[fechas.length - 1],
      y0: 50,
      y1: 50,
      line: { color: BLOOMBERG_TEXT_MUTED, width: 1, dash: 'dot' },
    },
    // Línea 30 — sobreventa
    {
      type: 'line',
      x0: fechas[0],
      x1: fechas[fechas.length - 1],
      y0: 30,
      y1: 30,
      line: { color: BLOOMBERG_GREEN, width: 1.5, dash: 'dash' },
    },
  ];

  const layout = mergeLayout({
    xaxis: {
      type: 'category',
      nticks: 8,
      title: axisTitle('Fecha'),
    },
    yaxis: {
      title: axisTitle('RSI'),
      range: [0, 100],
    },
    shapes,
  });

  return (
    <div role="img" aria-label="Gráfico RSI con zonas de sobrecompra y sobreventa" className="h-full flex flex-col">
      <ChartHeader
        titulo="RSI (14)"
        tooltip="RSI — Fuerza relativa"
        detalle="El RSI (Relative Strength Index) mide la velocidad y magnitud de los cambios de precio en una escala de 0 a 100. Valores por encima de 70 indican que el activo puede estar sobrecomprado (posible caída). Valores por debajo de 30 indican sobreventa (posible rebote). La zona entre 40 y 60 es neutral. Es útil para identificar puntos de entrada y salida."
        formula="RSI = 100 − (100 / (1 + RS)) | RS = Promedio ganancias / Promedio pérdidas (14 períodos)"
      />
      <div className="flex-1 min-h-0">
        <Plot
          data={traces}
          layout={layout}
          config={plotlyConfig}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}

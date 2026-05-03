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
  hoverTemplateCurrency,
  plotlyConfig,
  LINE_WIDTH_PRIMARY,
  LINE_WIDTH_SECONDARY,
} from '../../utils/plotlyDefaults';
import {
  CHART_BOLLINGER,
  BLOOMBERG_ACCENT,
} from '../../utils/colors';

/**
 * Gráfico de Bandas de Bollinger (20, ±2σ) con precio de cierre,
 * banda superior, banda inferior, SMA 20 y área sombreada entre bandas.
 *
 * Usa plotlyDefaults.js para layout consistente con tema Bloomberg oscuro,
 * fuentes legibles (tick ≥ 13, title ≥ 15), leyendas semi-transparentes
 * y tooltips con formato de moneda ($1,234.56).
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function BollingerChart({ datos }) {
  if (!datos?.bollinger || !datos?.ohlcv || !datos?.fechas) return null;

  const { fechas, ohlcv, bollinger } = datos;

  const traces = [
    // Banda superior — línea punteada con mayor contraste
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: bollinger.upper,
      name: 'Banda Superior',
      line: { color: CHART_BOLLINGER, width: LINE_WIDTH_SECONDARY, dash: 'dot' },
      hovertemplate: hoverTemplateCurrency('Banda Sup'),
    },
    // Banda inferior con relleno entre bandas — mayor opacidad para contraste
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: bollinger.lower,
      name: 'Banda Inferior',
      line: { color: CHART_BOLLINGER, width: LINE_WIDTH_SECONDARY, dash: 'dot' },
      fill: 'tonexty',
      fillcolor: 'rgba(148,163,184,0.15)',
      hovertemplate: hoverTemplateCurrency('Banda Inf'),
    },
    // Media (SMA 20) — línea sólida secundaria
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: bollinger.mid,
      name: 'SMA 20',
      line: { color: CHART_BOLLINGER, width: LINE_WIDTH_SECONDARY },
      hovertemplate: hoverTemplateCurrency('SMA 20'),
    },
    // Precio de cierre — línea principal más gruesa y distinguible
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: ohlcv.close,
      name: 'Precio',
      line: { color: BLOOMBERG_ACCENT, width: LINE_WIDTH_PRIMARY },
      hovertemplate: hoverTemplateCurrency('Precio'),
    },
  ];

  const layout = mergeLayout({
    title: chartTitle('Bandas de Bollinger (20, ±2σ)'),
    xaxis: {
      type: 'category',
      nticks: 8,
      title: axisTitle('Fecha'),
    },
    yaxis: {
      title: axisTitle('Precio (USD)'),
    },
  });

  return (
    <div role="img" aria-label="Gráfico de Bandas de Bollinger con precio de cierre">
      <Plot
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: 250 }}
      />
    </div>
  );
}

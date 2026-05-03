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
  axisTitle,
  hoverTemplateNumber,
  plotlyConfig,
  LINE_WIDTH_PRIMARY,
  LINE_WIDTH_SECONDARY,
} from '../../utils/plotlyDefaults';
import ChartHeader from './ChartHeader';
import {
  CHART_MACD_LINE,
  CHART_MACD_SIGNAL,
  BLOOMBERG_RED,
  BLOOMBERG_GREEN,
  BLOOMBERG_TEXT_MUTED,
} from '../../utils/colors';

/**
 * Gráfico del Oscilador Estocástico de Lane con líneas %K y %D
 * y zonas de sobrecompra (80) / sobreventa (20).
 *
 * Usa plotlyDefaults.js para layout consistente con tema Bloomberg oscuro,
 * fuentes legibles (tick ≥ 13, title ≥ 15), leyendas semi-transparentes
 * y tooltips con formato numérico claro.
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function StochasticChart({ datos }) {
  if (!datos?.estocastico || !datos?.fechas) return null;

  const { fechas, estocastico } = datos;

  const traces = [
    // Área sobrecompra (>80) — contraste mejorado
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
      y: Array(fechas.length).fill(80),
      fill: 'tonexty',
      fillcolor: 'rgba(239,68,68,0.15)',
      name: 'Sobrecompra (>80)',
      showlegend: true,
      hoverinfo: 'skip',
    },
    // Área sobreventa (<20) — contraste mejorado
    {
      type: 'scatter',
      mode: 'none',
      x: fechas,
      y: Array(fechas.length).fill(20),
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
      name: 'Sobreventa (<20)',
      showlegend: true,
      hoverinfo: 'skip',
    },
    // %K — línea principal, más gruesa para mejor visibilidad
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: estocastico.k,
      name: '%K',
      line: { color: CHART_MACD_LINE, width: LINE_WIDTH_PRIMARY },
      hovertemplate: hoverTemplateNumber('%K', 2),
    },
    // %D — línea secundaria, ligeramente más delgada para distinguir
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: estocastico.d,
      name: '%D',
      line: { color: CHART_MACD_SIGNAL, width: LINE_WIDTH_SECONDARY, dash: 'dash' },
      hovertemplate: hoverTemplateNumber('%D', 2),
    },
  ];

  const shapes = [
    // Línea 80 — sobrecompra
    {
      type: 'line',
      x0: fechas[0],
      x1: fechas[fechas.length - 1],
      y0: 80,
      y1: 80,
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
    // Línea 20 — sobreventa
    {
      type: 'line',
      x0: fechas[0],
      x1: fechas[fechas.length - 1],
      y0: 20,
      y1: 20,
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
      title: axisTitle('%K / %D'),
      range: [0, 100],
    },
    shapes,
  });

  return (
    <div role="img" aria-label="Gráfico estocástico con zonas de sobrecompra y sobreventa" className="h-full flex flex-col">
      <ChartHeader
        titulo="Estocástico de Lane (%K 14, %D 3)"
        tooltip="Estocástico — Posición del precio"
        detalle="El Oscilador Estocástico compara el precio de cierre con el rango de precios del período. %K es la línea rápida y %D es su media móvil (señal). Valores por encima de 80 sugieren sobrecompra, por debajo de 20 sugieren sobreventa. Los cruces entre %K y %D generan señales de compra/venta."
        formula="%K = (Cierre − Mín14) / (Máx14 − Mín14) × 100 | %D = SMA(3) de %K"
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

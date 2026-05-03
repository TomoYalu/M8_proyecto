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
  CHART_CANDLE_UP,
  CHART_CANDLE_DOWN,
  BLOOMBERG_YELLOW,
} from '../../utils/colors';

/**
 * Gráfico MACD (12, 26, 9) con línea, señal, histograma y marcador de divergencia.
 *
 * Usa plotlyDefaults.js para layout consistente con tema Bloomberg oscuro,
 * fuentes legibles (tick ≥ 13, title ≥ 15), leyendas semi-transparentes
 * y tooltips con formato numérico claro.
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function MACDChart({ datos }) {
  if (!datos?.macd || !datos?.fechas) return null;

  const { fechas, macd, divergencia_macd } = datos;
  const { macd: macdLine, signal, histograma } = macd;

  // Colores del histograma: verde si positivo, rojo si negativo
  const histColores = histograma.map((v) =>
    v == null ? 'transparent' : v >= 0 ? CHART_CANDLE_UP : CHART_CANDLE_DOWN
  );

  const traces = [
    // Histograma
    {
      type: 'bar',
      x: fechas,
      y: histograma,
      name: 'Histograma',
      marker: { color: histColores },
      hovertemplate: hoverTemplateNumber('Histograma', 4),
    },
    // Línea MACD — más gruesa y distinguible
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: macdLine,
      name: 'MACD',
      line: { color: CHART_MACD_LINE, width: LINE_WIDTH_PRIMARY },
      hovertemplate: hoverTemplateNumber('MACD', 4),
    },
    // Línea de señal — ligeramente más delgada para distinguir
    {
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: signal,
      name: 'Señal',
      line: { color: CHART_MACD_SIGNAL, width: LINE_WIDTH_SECONDARY },
      hovertemplate: hoverTemplateNumber('Señal', 4),
    },
  ];

  // Marcador de divergencia
  const annotations = [];
  if (divergencia_macd?.detectada && divergencia_macd.fecha) {
    annotations.push({
      x: divergencia_macd.fecha,
      y: 0,
      text: `Divergencia ${divergencia_macd.tipo || ''}`,
      showarrow: true,
      arrowhead: 2,
      arrowcolor: BLOOMBERG_YELLOW,
      font: { color: BLOOMBERG_YELLOW, size: 11 },
      bgcolor: 'rgba(20,27,45,0.85)',
      bordercolor: BLOOMBERG_YELLOW,
    });
  }

  const layout = mergeLayout({
    xaxis: {
      type: 'category',
      nticks: 8,
      title: axisTitle('Fecha'),
    },
    yaxis: {
      title: axisTitle('MACD'),
    },
    annotations,
    barmode: 'relative',
  });

  return (
    <div role="img" aria-label="Gráfico MACD con histograma y señal" className="h-full flex flex-col">
      <ChartHeader
        titulo="MACD (12, 26, 9)"
        tooltip="MACD — Impulso del precio"
        detalle="El MACD (Moving Average Convergence Divergence) mide el impulso comparando dos medias móviles exponenciales. Cuando la línea MACD cruza por encima de la señal, es una señal de compra. Cuando cruza por debajo, señal de venta. El histograma muestra la diferencia entre ambas líneas: barras verdes crecientes = impulso alcista acelerando."
        formula="MACD = EMA(12) − EMA(26) | Señal = EMA(9) del MACD"
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

import Plot from 'react-plotly.js';
import {
  mergeLayout,
  axisTitle,
  hoverTemplateCurrency,
  plotlyConfig,
  LINE_WIDTH_PRIMARY,
  LINE_WIDTH_SECONDARY,
} from '../../utils/plotlyDefaults';
import ChartHeader from './ChartHeader';
import {
  CHART_CANDLE_UP,
  CHART_CANDLE_DOWN,
  CHART_SMA50,
  CHART_SMA200,
  CHART_BOLLINGER,
  CHART_GRID,
  FIBONACCI_COLORS,
  BLOOMBERG_YELLOW,
} from '../../utils/colors';

/**
 * Gráfico de velas japonesas con SMA 50/200, Bollinger Bands,
 * niveles de Fibonacci y patrones detectados.
 *
 * Usa plotlyDefaults.js para layout consistente con tema Bloomberg oscuro,
 * fuentes legibles (tick ≥ 13, title ≥ 15), leyendas semi-transparentes
 * y tooltips con formato de moneda.
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function CandlestickChart({ datos }) {
  if (!datos?.ohlcv || !datos?.fechas) return null;

  const { fechas, ohlcv, sma50, sma200, bollinger, fibonacci, patrones } = datos;
  const ticker = datos.ticker || '';

  const traces = [];

  // Velas japonesas
  traces.push({
    type: 'candlestick',
    x: fechas,
    open: ohlcv.open,
    high: ohlcv.high,
    low: ohlcv.low,
    close: ohlcv.close,
    increasing: { line: { color: CHART_CANDLE_UP } },
    decreasing: { line: { color: CHART_CANDLE_DOWN } },
    name: 'OHLC',
    hoverinfo: 'x+text',
    text: ohlcv.close.map(
      (c, i) =>
        `O: $${Number(ohlcv.open[i]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  ` +
        `H: $${Number(ohlcv.high[i]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  ` +
        `L: $${Number(ohlcv.low[i]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  ` +
        `C: $${Number(c).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ),
  });

  // SMA 50
  if (sma50?.length) {
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: sma50,
      name: 'SMA 50',
      line: { color: CHART_SMA50, width: LINE_WIDTH_PRIMARY },
      hovertemplate: hoverTemplateCurrency('SMA 50'),
    });
  }

  // SMA 200
  if (sma200?.length) {
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: sma200,
      name: 'SMA 200',
      line: { color: CHART_SMA200, width: LINE_WIDTH_PRIMARY },
      hovertemplate: hoverTemplateCurrency('SMA 200'),
    });
  }

  // Bollinger Bands (área sombreada)
  if (bollinger?.upper?.length) {
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: bollinger.upper,
      name: 'Bollinger Superior',
      line: { color: CHART_BOLLINGER, width: LINE_WIDTH_SECONDARY, dash: 'dot' },
      hovertemplate: hoverTemplateCurrency('Bollinger Sup'),
      showlegend: false,
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: bollinger.lower,
      name: 'Bollinger',
      line: { color: CHART_BOLLINGER, width: LINE_WIDTH_SECONDARY, dash: 'dot' },
      fill: 'tonexty',
      fillcolor: 'rgba(148,163,184,0.10)',
      hovertemplate: hoverTemplateCurrency('Bollinger Inf'),
    });
  }

  // Fibonacci levels como líneas horizontales
  const annotations = [];
  const shapes = [];

  if (fibonacci) {
    const fibLevels = [
      { key: 'nivel_0', label: '0%' },
      { key: 'nivel_236', label: '23.6%' },
      { key: 'nivel_382', label: '38.2%' },
      { key: 'nivel_50', label: '50%' },
      { key: 'nivel_618', label: '61.8%' },
      { key: 'nivel_786', label: '78.6%' },
      { key: 'nivel_100', label: '100%' },
    ];

    fibLevels.forEach(({ key, label }) => {
      const val = fibonacci[key];
      if (val == null) return;
      shapes.push({
        type: 'line',
        x0: fechas[0],
        x1: fechas[fechas.length - 1],
        y0: val,
        y1: val,
        line: {
          color: FIBONACCI_COLORS[label] || CHART_GRID,
          width: LINE_WIDTH_SECONDARY,
          dash: 'dash',
        },
      });
      annotations.push({
        x: fechas[fechas.length - 1],
        y: val,
        xanchor: 'left',
        text: ` Fib ${label}`,
        showarrow: false,
        font: { size: 11, color: FIBONACCI_COLORS[label] || CHART_GRID },
      });
    });
  }

  // Patrones como marcadores
  if (patrones?.length) {
    const pFechas = [];
    const pPrecios = [];
    const pTextos = [];
    const pColores = [];

    patrones.forEach((p) => {
      pFechas.push(p.fecha);
      pPrecios.push(p.precio);
      pTextos.push(`${p.patron} (${p.tipo})`);
      pColores.push(
        p.tipo === 'alcista' ? CHART_CANDLE_UP
          : p.tipo === 'bajista' ? CHART_CANDLE_DOWN
          : BLOOMBERG_YELLOW
      );
    });

    traces.push({
      type: 'scatter',
      mode: 'markers+text',
      x: pFechas,
      y: pPrecios,
      text: pTextos,
      textposition: 'top center',
      textfont: { size: 10 },
      marker: { color: pColores, size: 11, symbol: 'diamond' },
      name: 'Patrones',
      hoverinfo: 'text',
    });
  }

  const layout = mergeLayout({
    xaxis: {
      type: 'category',
      nticks: 12,
      title: axisTitle('Fecha'),
    },
    yaxis: {
      title: axisTitle('Precio (USD)'),
    },
    shapes,
    annotations,
  });

  return (
    <div role="img" aria-label={`Gráfico de velas japonesas para ${ticker}`} className="h-full flex flex-col">
      <ChartHeader
        titulo={`Velas Japonesas — ${ticker}`}
        tooltip="Velas japonesas"
        detalle="Las velas japonesas muestran 4 precios por período: apertura, cierre, máximo y mínimo. El cuerpo de la vela representa la diferencia entre apertura y cierre. Las sombras (mechas) muestran los extremos del período. Verde = el precio cerró más alto que la apertura (alcista). Rojo = el precio cerró más bajo (bajista). Patrones de velas como Doji, Hammer o Engulfing pueden señalar cambios de tendencia."
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

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
  LINE_WIDTH_SECONDARY,
} from '../../utils/plotlyDefaults';
import ChartHeader from './ChartHeader';
import {
  BLOOMBERG_YELLOW,
} from '../../utils/colors';

/* Higher-contrast volume bar colours (opaque enough to read clearly) */
const VOLUME_UP = 'rgba(34,197,94,0.75)';
const VOLUME_DOWN = 'rgba(244,63,94,0.75)';

/**
 * Gráfico de volumen con barras coloreadas por dirección del día
 * (verde = cierre ≥ apertura, rojo = cierre < apertura)
 * y línea de promedio de 20 días.
 *
 * Usa plotlyDefaults.js para layout consistente con tema Bloomberg oscuro,
 * fuentes legibles (tick ≥ 13, title ≥ 15), leyendas semi-transparentes
 * y tooltips con formato numérico (comas para números grandes).
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function VolumeChart({ datos }) {
  if (!datos?.ohlcv || !datos?.fechas) return null;

  const { fechas, ohlcv, vol_avg } = datos;

  // Colores por dirección del día — contraste mejorado
  const colores = ohlcv.close.map((c, i) => {
    const o = ohlcv.open[i];
    if (c == null || o == null) return 'transparent';
    return c >= o ? VOLUME_UP : VOLUME_DOWN;
  });

  const traces = [
    // Barras de volumen
    {
      type: 'bar',
      x: fechas,
      y: ohlcv.volume,
      name: 'Volumen',
      marker: { color: colores },
      hovertemplate: hoverTemplateNumber('Volumen', 0),
    },
  ];

  // Promedio 20 días
  if (vol_avg?.length) {
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: fechas,
      y: vol_avg,
      name: 'Promedio 20d',
      line: { color: BLOOMBERG_YELLOW, width: LINE_WIDTH_SECONDARY },
      hovertemplate: hoverTemplateNumber('Prom 20d', 0),
    });
  }

  const layout = mergeLayout({
    xaxis: {
      type: 'category',
      nticks: 8,
      title: axisTitle('Fecha'),
    },
    yaxis: {
      title: axisTitle('Volumen'),
    },
    barmode: 'relative',
  });

  return (
    <div role="img" aria-label="Gráfico de volumen con promedio de 20 días" className="h-full flex flex-col">
      <ChartHeader
        titulo="Volumen de Operación"
        tooltip="Volumen de operación"
        detalle="El volumen muestra cuántas acciones se negociaron en cada período. Un volumen alto confirma la fuerza de un movimiento de precio. Volumen creciente con precio al alza = tendencia alcista fuerte. Volumen decreciente con precio al alza = la tendencia puede estar debilitándose. La línea amarilla es el promedio de 20 días."
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

/**
 * Configuración compartida de Plotly para Lakshmi Q2.
 *
 * Centraliza estilos Bloomberg oscuros, fuentes legibles, formato de tooltips
 * y leyendas semi-transparentes para que todos los charts mantengan
 * consistencia visual sin duplicar configuración.
 *
 * Uso:
 *   import { darkLayout, plotlyConfig, hoverTemplateCurrency, mergeLayout } from '../../utils/plotlyDefaults';
 *   <Plot layout={mergeLayout({ title: { text: 'Mi Gráfica' } })} config={plotlyConfig} ... />
 */

import {
  BLOOMBERG_PANEL,
  BLOOMBERG_TEXT,
  CHART_GRID,
} from './colors';

// ─── Constantes de fuente ───────────────────────────────────────
const FONT_FAMILY = 'Inter, system-ui, sans-serif';
const TICK_FONT_SIZE = 13;
const TITLE_FONT_SIZE = 15;
const LEGEND_FONT_SIZE = 12;
const CHART_TITLE_FONT_SIZE = 16;

// ─── Layout oscuro base ─────────────────────────────────────────
/**
 * Layout base con tema Bloomberg oscuro.
 * Incluye fuentes grandes (tick ≥ 13, title ≥ 15), grid sutil y márgenes
 * adecuados para ejes con títulos.
 */
export const darkLayout = {
  paper_bgcolor: BLOOMBERG_PANEL,
  plot_bgcolor: BLOOMBERG_PANEL,
  font: {
    family: FONT_FAMILY,
    color: BLOOMBERG_TEXT,
    size: TICK_FONT_SIZE,
  },
  margin: { l: 70, r: 30, t: 30, b: 50 },
  xaxis: {
    gridcolor: CHART_GRID,
    linecolor: CHART_GRID,
    tickfont: { size: TICK_FONT_SIZE, color: BLOOMBERG_TEXT },
    title: {
      font: { size: TITLE_FONT_SIZE, color: BLOOMBERG_TEXT },
      standoff: 15,
    },
    rangeslider: { visible: false },
  },
  yaxis: {
    gridcolor: CHART_GRID,
    linecolor: CHART_GRID,
    tickfont: { size: TICK_FONT_SIZE, color: BLOOMBERG_TEXT },
    title: {
      font: { size: TITLE_FONT_SIZE, color: BLOOMBERG_TEXT },
      standoff: 15,
    },
  },
  legend: {
    bgcolor: 'rgba(20,27,45,0.75)',
    bordercolor: 'rgba(37,49,82,0.6)',
    borderwidth: 1,
    font: { size: LEGEND_FONT_SIZE, color: BLOOMBERG_TEXT },
    orientation: 'h',
    yanchor: 'bottom',
    y: 1.02,
    xanchor: 'left',
    x: 0,
  },
  hovermode: 'x unified',
  hoverlabel: {
    bgcolor: 'rgba(20,27,45,0.92)',
    bordercolor: CHART_GRID,
    font: { family: FONT_FAMILY, size: 13, color: BLOOMBERG_TEXT },
  },
};

// ─── Configuración de toolbar Plotly ────────────────────────────
/** Configuración de la barra de herramientas Plotly (responsive, sin logo). */
export const plotlyConfig = {
  responsive: true,
  displayModeBar: 'hover',
  modeBarButtonsToRemove: [
    'lasso2d', 'select2d', 'autoScale2d',
    'hoverClosestCartesian', 'hoverCompareCartesian',
    'toggleSpikelines',
  ],
  displaylogo: false,
  scrollZoom: true,
};

// ─── Hover templates ────────────────────────────────────────────
/**
 * Template de tooltip para valores monetarios (USD).
 * Muestra el valor con 2 decimales y prefijo $.
 * @example hovertemplate: hoverTemplateCurrency('Precio')
 *          → "Precio: $1,234.56<extra></extra>"
 */
export function hoverTemplateCurrency(label = 'Precio') {
  return `${label}: $%{y:,.2f}<extra></extra>`;
}

/**
 * Template de tooltip para valores porcentuales.
 * Muestra el valor con 2 decimales y sufijo %.
 * @example hovertemplate: hoverTemplatePercent('Rendimiento')
 *          → "Rendimiento: 12.34%<extra></extra>"
 */
export function hoverTemplatePercent(label = 'Valor') {
  return `${label}: %{y:.2f}%<extra></extra>`;
}

/**
 * Template de tooltip para valores numéricos genéricos.
 * Muestra el valor con la precisión indicada.
 * @param {string} label - Etiqueta del valor
 * @param {number} [decimals=2] - Decimales a mostrar
 */
export function hoverTemplateNumber(label = 'Valor', decimals = 2) {
  return `${label}: %{y:.${decimals}f}<extra></extra>`;
}

// ─── Helpers para títulos de chart ──────────────────────────────
/**
 * Genera un objeto de título Plotly con la fuente estándar.
 * @param {string} text - Texto del título
 * @param {number} [size] - Tamaño de fuente (por defecto CHART_TITLE_FONT_SIZE)
 */
export function chartTitle(text, size = CHART_TITLE_FONT_SIZE) {
  return {
    text,
    font: { size, family: FONT_FAMILY, color: BLOOMBERG_TEXT },
  };
}

/**
 * Genera un objeto de título de eje con la fuente estándar.
 * @param {string} text - Texto del título del eje
 */
export function axisTitle(text) {
  return {
    text,
    font: { size: TITLE_FONT_SIZE, family: FONT_FAMILY, color: BLOOMBERG_TEXT },
    standoff: 15,
  };
}

// ─── Estilos de línea estándar ──────────────────────────────────
/** Ancho de línea estándar para indicadores principales. */
export const LINE_WIDTH_PRIMARY = 2;
/** Ancho de línea estándar para indicadores secundarios. */
export const LINE_WIDTH_SECONDARY = 1.5;

// ─── Merge helper ───────────────────────────────────────────────
/**
 * Combina el layout oscuro base con overrides específicos del chart.
 * Hace deep-merge de xaxis, yaxis, legend, hoverlabel y margin para
 * que los charts solo necesiten declarar lo que cambia.
 *
 * @param {object} overrides - Propiedades a sobrescribir/agregar
 * @returns {object} Layout combinado listo para Plotly
 *
 * @example
 * const layout = mergeLayout({
 *   title: chartTitle('MACD (12, 26, 9)'),
 *   xaxis: { type: 'category', nticks: 8 },
 *   yaxis: { title: axisTitle('MACD') },
 * });
 */
export function mergeLayout(overrides = {}) {
  const base = { ...darkLayout };
  const merged = { ...base, ...overrides };

  // Deep-merge objetos anidados clave
  const nestedKeys = ['xaxis', 'yaxis', 'legend', 'hoverlabel', 'margin'];
  for (const key of nestedKeys) {
    if (overrides[key]) {
      merged[key] = { ...base[key], ...overrides[key] };
      // Merge title dentro de xaxis/yaxis si existe
      if (
        (key === 'xaxis' || key === 'yaxis') &&
        base[key]?.title &&
        overrides[key]?.title
      ) {
        merged[key].title = { ...base[key].title, ...overrides[key].title };
        if (base[key].title.font && overrides[key].title.font) {
          merged[key].title.font = {
            ...base[key].title.font,
            ...overrides[key].title.font,
          };
        }
      }
    }
  }

  return merged;
}

// ─── Constantes exportadas para referencia ──────────────────────
export { TICK_FONT_SIZE, TITLE_FONT_SIZE, LEGEND_FONT_SIZE, CHART_TITLE_FONT_SIZE, FONT_FAMILY };

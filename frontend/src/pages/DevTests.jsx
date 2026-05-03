/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Dev Tests
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */
import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js/dist/plotly';

const DUMMY = {
  labels: ['AAPL', 'MSFT', 'GLD', 'PG', 'AMZN'],
  values: [32, 25, 18, 15, 10],
  colors: ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7'],
};

function Chart({ title, config, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    Plotly.newPlot(ref.current, config.data, config.layout, { displayModeBar: false, staticPlot: false, responsive: true });
    return () => { if (ref.current) Plotly.purge(ref.current); };
  }, [config]);
  return (
    <div className={`bg-bloomberg-panel rounded-xl border border-white/5 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-bloomberg-text mb-3">{title}</h3>
      <div ref={ref} className="w-full" style={{ height: 300 }} />
    </div>
  );
}

const baseLayout = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#94a3b8', size: 12 },
  margin: { t: 10, r: 10, b: 10, l: 10 },
  showlegend: true,
  legend: { font: { color: '#e2e8f0', size: 11 }, orientation: 'h', y: -0.15 },
};

const proposals = [
  {
    title: '1. Donut clásico',
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie',
      hole: 0.55,
      marker: { colors: DUMMY.colors },
      textinfo: 'label+percent', textposition: 'outside',
      textfont: { color: '#e2e8f0', size: 11 },
      outsidetextfont: { color: '#94a3b8' },
      hoverinfo: 'label+value+percent',
    }],
    layout: { ...baseLayout },
  },
  {
    title: '2. Donut con pull (destacar mayor)',
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie',
      hole: 0.5,
      pull: [0.08, 0, 0, 0, 0],
      marker: { colors: DUMMY.colors, line: { color: '#0b0f19', width: 2 } },
      textinfo: 'percent', textposition: 'inside',
      textfont: { color: '#fff', size: 13, family: 'monospace' },
      hoverinfo: 'label+value+percent',
    }],
    layout: { ...baseLayout },
  },
  {
    title: '3. Pie sólido con bordes',
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie',
      marker: { colors: DUMMY.colors, line: { color: '#141b2d', width: 3 } },
      textinfo: 'label+percent', textposition: 'auto',
      textfont: { color: '#fff', size: 12 },
      hoverinfo: 'label+value+percent',
      rotation: 45,
    }],
    layout: { ...baseLayout },
  },
  {
    title: '4. Donut minimalista (solo hover)',
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie',
      hole: 0.7,
      marker: { colors: DUMMY.colors.map(c => c + '99') },
      textinfo: 'none',
      hoverinfo: 'label+value+percent',
      hoverlabel: { bgcolor: '#141b2d', bordercolor: '#3b82f6', font: { color: '#e2e8f0' } },
    }],
    layout: {
      ...baseLayout,
      annotations: [{
        text: '<b>100%</b><br>Portafolio', showarrow: false,
        font: { size: 16, color: '#e2e8f0' }, x: 0.5, y: 0.5,
      }],
    },
  },
  {
    title: '5. Sunburst (sector → ticker)',
    data: [{
      type: 'sunburst',
      labels: ['Portafolio', 'Tech', 'Commodities', 'Consumer', 'AAPL', 'MSFT', 'AMZN', 'GLD', 'PG'],
      parents: ['', 'Portafolio', 'Portafolio', 'Portafolio', 'Tech', 'Tech', 'Tech', 'Commodities', 'Consumer'],
      values: [100, 67, 18, 15, 32, 25, 10, 18, 15],
      marker: { colors: ['', '#3b82f6', '#eab308', '#ef4444', '#60a5fa', '#34d399', '#c084fc', '#fbbf24', '#f87171'] },
      branchvalues: 'total',
      textinfo: 'label+percent entry',
      textfont: { color: '#e2e8f0', size: 11 },
      hoverinfo: 'label+value+percent entry',
      insidetextorientation: 'radial',
    }],
    layout: { ...baseLayout, margin: { t: 10, r: 10, b: 10, l: 10 } },
  },
  {
    title: '6. Donut con gradiente de opacidad',
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie',
      hole: 0.6,
      marker: { colors: ['#3b82f6', '#3b82f6cc', '#3b82f699', '#3b82f666', '#3b82f644'], line: { color: '#0b0f19', width: 2 } },
      textinfo: 'label+percent', textposition: 'outside',
      textfont: { color: '#e2e8f0', size: 11 },
      sort: false,
      direction: 'clockwise',
      hoverinfo: 'label+value+percent',
    }],
    layout: { ...baseLayout },
  },
];

export default function DevTests() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-bloomberg-text">Dev Tests — Propuestas de Gráficas</h1>
        <p className="text-sm text-bloomberg-text-muted mt-1">
          Gráficas circulares con datos dummy. Elige la que más te guste para el dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {proposals.map((p, i) => (
          <Chart key={i} title={p.title} config={{ data: p.data, layout: p.layout }} />
        ))}
      </div>
    </div>
  );
}

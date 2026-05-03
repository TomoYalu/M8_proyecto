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
};

const PALETTES = {
  neon:    ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7'],
  ocean:   ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#059669'],
  sunset:  ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1'],
  mono:    ['#3b82f6', '#3b82f6cc', '#3b82f699', '#3b82f666', '#3b82f644'],
  emerald: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
};

function Chart({ title, subtitle, config, className = '', style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    Plotly.newPlot(ref.current, config.data, config.layout, {
      displayModeBar: false, responsive: true,
    });
    return () => { if (ref.current) Plotly.purge(ref.current); };
  }, [config]);
  return (
    <div className={className} style={style}>
      <h3 className="text-sm font-semibold text-bloomberg-text mb-1">{title}</h3>
      {subtitle && <p className="text-xs text-bloomberg-text-muted mb-2">{subtitle}</p>}
      <div ref={ref} className="w-full" style={{ height: 280 }} />
    </div>
  );
}

const base = {
  paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#94a3b8', size: 11 },
  margin: { t: 5, r: 5, b: 5, l: 5 },
};

// ─── PROPOSALS ──────────────────────────────────────────────────

const proposals = [
  // 1. Glassmorphism + donut + leyenda horizontal abajo
  {
    title: '1. Glassmorphism + Donut',
    subtitle: 'Fondo blur, borde glow azul, leyenda horizontal',
    className: 'rounded-2xl p-5 border border-bloomberg-accent/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]',
    style: { background: 'rgba(20,27,45,0.6)', backdropFilter: 'blur(12px)' },
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie', hole: 0.55,
      marker: { colors: PALETTES.neon },
      textinfo: 'label+percent', textposition: 'outside',
      textfont: { color: '#e2e8f0', size: 11 },
      hoverinfo: 'label+value+percent',
    }],
    layout: { ...base, showlegend: true, legend: { font: { color: '#e2e8f0', size: 10 }, orientation: 'h', y: -0.12, x: 0.5, xanchor: 'center' } },
  },
  // 2. Card oscura + leyenda vertical derecha
  {
    title: '2. Dark card + Leyenda lateral',
    subtitle: 'Fondo sólido oscuro, leyenda a la derecha',
    className: 'rounded-2xl p-5 bg-[#0a0e14] border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie', hole: 0.5,
      marker: { colors: PALETTES.ocean, line: { color: '#0a0e14', width: 3 } },
      textinfo: 'percent', textposition: 'inside',
      textfont: { color: '#fff', size: 13, family: 'monospace' },
      hoverinfo: 'label+value+percent',
      domain: { x: [0, 0.6] },
    }],
    layout: { ...base, showlegend: true, legend: { font: { color: '#e2e8f0', size: 11 }, x: 0.7, y: 0.5, bgcolor: 'rgba(0,0,0,0)' } },
  },
  // 3. Gradiente sutil + sombra colored
  {
    title: '3. Gradiente + Sombra verde',
    subtitle: 'Fondo gradiente sutil, sombra emerald, pull en mayor',
    className: 'rounded-2xl p-5 border border-emerald-500/20 shadow-[0_4px_30px_rgba(16,185,129,0.2)]',
    style: { background: 'linear-gradient(135deg, #0a0e0c 0%, #0f1a14 100%)' },
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie', hole: 0.5,
      pull: [0.06, 0, 0, 0, 0],
      marker: { colors: PALETTES.emerald, line: { color: '#0a0e0c', width: 2 } },
      textinfo: 'label+percent', textposition: 'outside',
      textfont: { color: '#a7f3d0', size: 11 },
      hoverinfo: 'label+value+percent',
      hoverlabel: { bgcolor: '#0a0e0c', bordercolor: '#10b981', font: { color: '#e2e8f0' } },
    }],
    layout: { ...base, showlegend: false },
  },
  // 4. Minimalista sin bordes + anotación central
  {
    title: '4. Minimalista + Anotación central',
    subtitle: 'Sin bordes, sin leyenda, texto central, solo hover',
    className: 'rounded-xl p-5',
    style: { background: 'rgba(20,27,45,0.4)' },
    data: [{
      labels: DUMMY.labels, values: DUMMY.values, type: 'pie', hole: 0.72,
      marker: { colors: PALETTES.mono },
      textinfo: 'none',
      hoverinfo: 'label+value+percent',
      hoverlabel: { bgcolor: '#141b2d', bordercolor: '#3b82f6', font: { color: '#e2e8f0', size: 13 } },
    }],
    layout: {
      ...base, showlegend: false,
      annotations: [{ text: '<b>$48,250</b><br><span style="font-size:11px;color:#94a3b8">Valor Total</span>', showarrow: false, font: { size: 18, color: '#e2e8f0' }, x: 0.5, y: 0.5 }],
    },
  },
  // 5. Sunburst jerárquico + glassmorphism sunset
  {
    title: '5. Sunburst + Glassmorphism sunset',
    subtitle: 'Jerárquico sector→ticker, borde naranja glow',
    className: 'rounded-2xl p-5 border border-orange-500/30 shadow-[0_0_25px_rgba(249,115,22,0.15)]',
    style: { background: 'rgba(20,27,45,0.6)', backdropFilter: 'blur(12px)' },
    data: [{
      type: 'sunburst',
      labels: ['Portafolio', 'Tech', 'Commodities', 'Consumer', 'AAPL', 'MSFT', 'AMZN', 'GLD', 'PG'],
      parents: ['', 'Portafolio', 'Portafolio', 'Portafolio', 'Tech', 'Tech', 'Tech', 'Commodities', 'Consumer'],
      values: [100, 67, 18, 15, 32, 25, 10, 18, 15],
      marker: { colors: ['', ...PALETTES.sunset.slice(0, 3), '#fb923c', '#f87171', '#e879f9', '#fbbf24', '#f87171'] },
      branchvalues: 'total',
      textinfo: 'label+percent entry',
      textfont: { color: '#fff', size: 11 },
      insidetextorientation: 'radial',
    }],
    layout: { ...base, showlegend: false },
  },
  // 6. Doble donut (inner + outer ring)
  {
    title: '6. Doble anillo (peso vs riesgo)',
    subtitle: 'Anillo exterior: peso, interior: contribución al riesgo',
    className: 'rounded-xl p-5 bg-bloomberg-panel border border-white/5',
    data: [
      {
        labels: DUMMY.labels, values: DUMMY.values, type: 'pie', hole: 0.55,
        marker: { colors: PALETTES.neon, line: { color: '#141b2d', width: 2 } },
        textinfo: 'label', textposition: 'outside', textfont: { color: '#94a3b8', size: 10 },
        domain: { x: [0.1, 0.9], y: [0.1, 0.9] },
        name: 'Peso',
        hoverinfo: 'label+value+percent',
      },
      {
        labels: DUMMY.labels, values: [40, 22, 12, 18, 8], type: 'pie', hole: 0.78,
        marker: { colors: PALETTES.neon.map(c => c + '88'), line: { color: '#141b2d', width: 1 } },
        textinfo: 'percent', textposition: 'inside', textfont: { color: '#fff', size: 9 },
        domain: { x: [0.1, 0.9], y: [0.1, 0.9] },
        name: 'Riesgo',
        hoverinfo: 'label+value+percent',
      },
    ],
    layout: {
      ...base, showlegend: false,
      annotations: [{ text: '<b>Peso</b><br><span style="font-size:9px">vs Riesgo</span>', showarrow: false, font: { size: 12, color: '#94a3b8' }, x: 0.5, y: 0.5 }],
    },
  },
  // 7. Barras horizontales como alternativa a pie
  {
    title: '7. Barras horizontales (alternativa)',
    subtitle: 'A veces más legible que un pie chart',
    className: 'rounded-2xl p-5 border border-white/5',
    style: { background: 'linear-gradient(180deg, rgba(20,27,45,0.8) 0%, rgba(10,14,25,0.9) 100%)' },
    data: [{
      y: DUMMY.labels, x: DUMMY.values, type: 'bar', orientation: 'h',
      marker: { color: PALETTES.neon, cornerradius: 4 },
      text: DUMMY.values.map(v => v + '%'), textposition: 'outside',
      textfont: { color: '#e2e8f0', size: 12 },
      hoverinfo: 'y+x',
    }],
    layout: {
      ...base,
      margin: { t: 5, r: 40, b: 25, l: 50 },
      xaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.05)', ticksuffix: '%', color: '#94a3b8' },
      yaxis: { color: '#e2e8f0', autorange: 'reversed' },
      showlegend: false,
    },
  },
  // 8. Treemap
  {
    title: '8. Treemap (mapa de calor por peso)',
    subtitle: 'Alternativa visual a pie, muestra proporción por área',
    className: 'rounded-xl p-5 bg-[#0b0f19] border border-white/10',
    data: [{
      type: 'treemap',
      labels: ['Portafolio', ...DUMMY.labels],
      parents: ['', ...DUMMY.labels.map(() => 'Portafolio')],
      values: [0, ...DUMMY.values],
      marker: { colors: ['', ...PALETTES.neon], line: { color: '#0b0f19', width: 2 } },
      textinfo: 'label+percent entry',
      textfont: { color: '#fff', size: 14 },
      hoverinfo: 'label+value+percent entry',
      pathbar: { visible: false },
    }],
    layout: { ...base, margin: { t: 5, r: 5, b: 5, l: 5 } },
  },
];

export default function DevTests() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-bloomberg-text">Dev Tests — Propuestas de Gráficas</h1>
        <p className="text-sm text-bloomberg-text-muted mt-1">
          Variaciones de gráficas y estilos de contenedor. Hover para interactuar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {proposals.map((p, i) => (
          <Chart
            key={i}
            title={p.title}
            subtitle={p.subtitle}
            config={{ data: p.data, layout: p.layout }}
            className={p.className}
            style={p.style}
          />
        ))}
      </div>
    </div>
  );
}

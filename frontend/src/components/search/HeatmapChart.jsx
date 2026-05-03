/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Búsqueda de Activos
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { plotlyConfig } from '../../utils/plotlyDefaults';
import { BLOOMBERG_PANEL, BLOOMBERG_TEXT, BLOOMBERG_TEXT_MUTED } from '../../utils/colors';

const INDICES_TREEMAP = ['S&P 500', 'NASDAQ 100', 'Dow Jones'];
const PERIODOS_TREEMAP = ['1D', '1W', '1M'];

/**
 * Heatmap / Treemap de rendimiento estilo Finviz.
 * Tres vistas: Sectores (heatmap), Índices (heatmap), Treemap (estilo Finviz).
 */
export default function HeatmapChart() {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState('treemap'); // 'sector' | 'indice' | 'treemap'
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Treemap-specific state
  const [treemapIndice, setTreemapIndice] = useState('S&P 500');
  const [treemapPeriodo, setTreemapPeriodo] = useState('1D');
  const [treemapDatos, setTreemapDatos] = useState(null);

  // Fetch heatmap data
  useEffect(() => {
    if (!abierto || vista === 'treemap') return;

    let cancelado = false;
    setCargando(true);
    setError(null);

    async function fetchHeatmap() {
      try {
        const res = await fetch(`/api/busqueda/heatmap?tipo=${vista}`);
        if (!res.ok) throw new Error('Error al obtener datos');
        const data = await res.json();
        if (!cancelado) setDatos(data);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    fetchHeatmap();
    return () => { cancelado = true; };
  }, [abierto, vista]);

  // Fetch treemap data
  useEffect(() => {
    if (!abierto || vista !== 'treemap') return;

    let cancelado = false;
    setCargando(true);
    setError(null);

    async function fetchTreemap() {
      try {
        const res = await fetch(
          `/api/busqueda/treemap?indice=${encodeURIComponent(treemapIndice)}&periodo=${treemapPeriodo}`
        );
        if (!res.ok) throw new Error('Error al obtener datos del treemap');
        const data = await res.json();
        if (!cancelado) setTreemapDatos(data);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    fetchTreemap();
    return () => { cancelado = true; };
  }, [abierto, vista, treemapIndice, treemapPeriodo]);

  // Heatmap annotations
  const annotations = [];
  if (datos?.datos && vista !== 'treemap') {
    for (let i = 0; i < datos.filas.length; i++) {
      for (let j = 0; j < datos.columnas.length; j++) {
        const val = datos.datos[i][j];
        annotations.push({
          x: datos.columnas[j],
          y: datos.filas[i],
          text: `${val > 0 ? '+' : ''}${val.toFixed(1)}%`,
          showarrow: false,
          font: { size: 11, color: BLOOMBERG_TEXT, family: 'Inter, system-ui, sans-serif' },
        });
      }
    }
  }

  return (
    <div className="mx-6 mb-3">
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="flex items-center gap-2 text-xs font-medium text-bloomberg-text-muted
                   hover:text-bloomberg-text transition-colors"
        aria-expanded={abierto}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Mapa de Rendimiento
      </button>

      {abierto && (
        <div className="mt-2 rounded-xl bg-bloomberg-panel border border-white/5 overflow-hidden">
          {/* Vista toggle */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 flex-wrap">
            {[
              { key: 'treemap', label: 'Treemap (Finviz)' },
              { key: 'sector', label: 'Sectores' },
              { key: 'indice', label: 'Índices' },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setVista(v.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  vista === v.key
                    ? 'bg-bloomberg-accent text-white'
                    : 'bg-bloomberg-bg border border-white/10 text-bloomberg-text-muted hover:text-bloomberg-text'
                }`}
              >
                {v.label}
              </button>
            ))}

            {/* Treemap controls */}
            {vista === 'treemap' && (
              <>
                <span className="text-bloomberg-text-muted text-xs ml-2">|</span>
                <select
                  value={treemapIndice}
                  onChange={(e) => setTreemapIndice(e.target.value)}
                  className="px-2 py-1 text-xs rounded bg-bloomberg-bg border border-white/10
                             text-bloomberg-text focus:outline-none focus:border-bloomberg-accent"
                >
                  {INDICES_TREEMAP.map((idx) => (
                    <option key={idx} value={idx}>{idx}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {PERIODOS_TREEMAP.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTreemapPeriodo(p)}
                      className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                        treemapPeriodo === p
                          ? 'bg-bloomberg-accent/20 text-bloomberg-accent border border-bloomberg-accent/40'
                          : 'bg-bloomberg-bg border border-white/10 text-bloomberg-text-muted hover:text-bloomberg-text'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Finviz link */}
            <a
              href="https://finviz.com/map.ashx"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-bloomberg-text-muted hover:text-bloomberg-accent
                         transition-colors flex items-center gap-1"
            >
              Ver en Finviz
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Content */}
          <div className="p-4">
            {cargando && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-bloomberg-accent/30 border-t-bloomberg-accent
                                rounded-full animate-spin" />
              </div>
            )}

            {error && !cargando && (
              <div className="px-4 py-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                              text-sm text-bloomberg-red">
                {error}
              </div>
            )}

            {/* Heatmap view */}
            {!cargando && !error && vista !== 'treemap' && datos && (
              <Plot
                data={[{
                  type: 'heatmap',
                  z: datos.datos,
                  x: datos.columnas,
                  y: datos.filas,
                  colorscale: [[0, '#ef4444'], [0.5, '#1e293b'], [1, '#22c55e']],
                  zmid: 0,
                  showscale: true,
                  colorbar: {
                    title: { text: '%', font: { color: BLOOMBERG_TEXT_MUTED, size: 11 } },
                    tickfont: { color: BLOOMBERG_TEXT_MUTED, size: 10 },
                    thickness: 12,
                    len: 0.8,
                  },
                  hovertemplate: '%{y}<br>%{x}: %{z:.2f}%<extra></extra>',
                }]}
                layout={{
                  paper_bgcolor: BLOOMBERG_PANEL,
                  plot_bgcolor: BLOOMBERG_PANEL,
                  font: { family: 'Inter, system-ui, sans-serif', color: BLOOMBERG_TEXT, size: 12 },
                  margin: { l: 120, r: 60, t: 20, b: 40 },
                  xaxis: { side: 'bottom', tickfont: { size: 12, color: BLOOMBERG_TEXT } },
                  yaxis: { autorange: 'reversed', tickfont: { size: 11, color: BLOOMBERG_TEXT } },
                  annotations,
                  height: Math.max(280, datos.filas.length * 36 + 60),
                }}
                config={plotlyConfig}
                useResizeHandler
                style={{ width: '100%' }}
              />
            )}

            {/* Treemap view */}
            {!cargando && !error && vista === 'treemap' && treemapDatos && treemapDatos.labels?.length > 0 && (
              <Plot
                data={[{
                  type: 'treemap',
                  labels: treemapDatos.labels,
                  parents: treemapDatos.parents,
                  values: treemapDatos.values,
                  text: treemapDatos.text,
                  textinfo: 'label+text',
                  textfont: { size: 13, color: '#ffffff', family: 'Inter, system-ui, sans-serif' },
                  marker: {
                    colors: treemapDatos.colors,
                    colorscale: [
                      [0, '#dc2626'],
                      [0.35, '#ef4444'],
                      [0.45, '#78716c'],
                      [0.55, '#78716c'],
                      [0.65, '#22c55e'],
                      [1, '#16a34a'],
                    ],
                    cmid: 0,
                    cmin: -5,
                    cmax: 5,
                    showscale: true,
                    colorbar: {
                      title: { text: '%', font: { color: BLOOMBERG_TEXT_MUTED, size: 10 } },
                      tickfont: { color: BLOOMBERG_TEXT_MUTED, size: 10 },
                      ticksuffix: '%',
                      thickness: 12,
                      len: 0.6,
                    },
                    line: { width: 2, color: BLOOMBERG_PANEL },
                  },
                  hovertemplate: '<b>%{label}</b><br>Rendimiento: %{color:+.2f}%<extra></extra>',
                  branchvalues: 'remainder',
                  pathbar: { visible: true, textfont: { size: 12, color: BLOOMBERG_TEXT } },
                  tiling: { pad: 3 },
                }]}
                layout={{
                  paper_bgcolor: BLOOMBERG_PANEL,
                  plot_bgcolor: BLOOMBERG_PANEL,
                  font: { family: 'Inter, system-ui, sans-serif', color: BLOOMBERG_TEXT },
                  margin: { l: 5, r: 5, t: 30, b: 5 },
                  height: 480,
                }}
                config={plotlyConfig}
                useResizeHandler
                style={{ width: '100%' }}
              />
            )}

            {!cargando && !error && vista === 'treemap' && (!treemapDatos || treemapDatos.labels?.length === 0) && (
              <p className="text-sm text-bloomberg-text-muted text-center py-8">
                No hay datos disponibles para este índice y período.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

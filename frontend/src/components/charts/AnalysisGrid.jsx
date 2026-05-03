/**
 * AnalysisGrid — GridStack layout for analysis charts.
 * Allows drag & drop reordering and resize of chart panels.
 * Persists layout to localStorage.
 * Uses ResizeObserver to trigger Plotly.Plots.resize() on every size change.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

const STORAGE_KEY = 'lakshmi-analysis-grid-layout';

const DEFAULT_ITEMS = [
  { id: 'candlestick', x: 0, y: 0, w: 12, h: 7, minW: 6, minH: 4 },
  { id: 'macd',        x: 0, y: 7, w: 3,  h: 5, minW: 3, minH: 3 },
  { id: 'rsi',         x: 3, y: 7, w: 3,  h: 5, minW: 3, minH: 3 },
  { id: 'stochastic',  x: 6, y: 7, w: 3,  h: 5, minW: 3, minH: 3 },
  { id: 'volume',      x: 9, y: 7, w: 3,  h: 5, minW: 3, minH: 3 },
  { id: 'stoploss',    x: 0, y: 12, w: 6, h: 5, minW: 3, minH: 3 },
  { id: 'patterns',    x: 6, y: 12, w: 6, h: 5, minW: 3, minH: 3 },
];

function loadLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveLayout(items) {
  try {
    const data = items.map((el) => ({
      id: el.id, x: el.x, y: el.y, w: el.w, h: el.h,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

/** Resize all Plotly charts inside an element */
function resizePlotly(container) {
  if (!container || !window.Plotly) return;
  const plots = container.querySelectorAll('.js-plotly-plot');
  plots.forEach((div) => {
    try { window.Plotly.Plots.resize(div); } catch { /* */ }
  });
}

export default function AnalysisGrid({ panels, isLoading }) {
  const gridRef = useRef(null);
  const gridInstanceRef = useRef(null);
  const observerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);

  const getItems = useCallback(() => {
    const saved = loadLayout();
    if (!saved) return DEFAULT_ITEMS;
    const savedMap = {};
    for (const s of saved) savedMap[s.id] = s;
    return DEFAULT_ITEMS.map((def) => {
      const s = savedMap[def.id];
      if (s) return { ...def, x: s.x, y: s.y, w: s.w, h: s.h };
      return def;
    });
  }, []);

  const handleChange = useCallback((_event, changedItems) => {
    if (!gridInstanceRef.current || !changedItems) return;
    const allItems = gridInstanceRef.current.getGridItems().map((el) => ({
      id: el.getAttribute('gs-id'),
      x: parseInt(el.getAttribute('gs-x') || '0'),
      y: parseInt(el.getAttribute('gs-y') || '0'),
      w: parseInt(el.getAttribute('gs-w') || '3'),
      h: parseInt(el.getAttribute('gs-h') || '3'),
    }));
    saveLayout(allItems);
    // Resize after layout change
    setTimeout(() => resizePlotly(gridRef.current), 100);
  }, []);

  // Initialize GridStack
  useEffect(() => {
    if (!gridRef.current || initialized) return;

    const grid = GridStack.init(
      {
        column: 12,
        cellHeight: 50,
        margin: 6,
        animate: true,
        float: false,
        draggable: { handle: '.gs-chart-handle' },
        resizable: { handles: 'se,sw,e,w' },
      },
      gridRef.current
    );

    gridInstanceRef.current = grid;
    grid.on('change', handleChange);
    grid.on('resizestop', () => {
      setTimeout(() => resizePlotly(gridRef.current), 50);
    });
    grid.on('dragstop', () => {
      setTimeout(() => resizePlotly(gridRef.current), 50);
    });
    setInitialized(true);

    return () => {
      grid.off('change');
      grid.off('resizestop');
      grid.off('dragstop');
      grid.destroy(false);
      gridInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ResizeObserver on each grid-stack-item to catch ALL size changes
  useEffect(() => {
    if (!gridRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        resizePlotly(entry.target);
      }
    });

    observerRef.current = observer;

    // Observe all grid items
    const items = gridRef.current.querySelectorAll('.grid-stack-item');
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [initialized, panels]);

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const items = getItems();

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-bloomberg-text-muted hover:text-bloomberg-accent
                     transition-colors px-2 py-1 rounded border border-white/10
                     hover:border-bloomberg-accent/30"
        >
          ↻ Restaurar layout
        </button>
      </div>

      <div ref={gridRef} className="grid-stack">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid-stack-item"
            gs-id={item.id}
            gs-x={item.x}
            gs-y={item.y}
            gs-w={item.w}
            gs-h={item.h}
            gs-min-w={item.minW}
            gs-min-h={item.minH}
          >
            <div className="grid-stack-item-content rounded-lg bg-bloomberg-panel
                            border border-white/5 overflow-hidden">
              {/* Drag handle */}
              <div className="gs-chart-handle h-3 cursor-move bg-white/[0.03]
                              hover:bg-bloomberg-accent/10 transition-colors
                              flex items-center justify-center flex-shrink-0"
                   style={{ touchAction: 'none' }}>
                <div className="w-10 h-0.5 rounded-full bg-white/15" />
              </div>
              {/* Chart content — absolute fill so Plotly gets real pixel dimensions */}
              <div style={{ position: 'absolute', top: 12, left: 4, right: 4, bottom: 4, overflow: 'hidden' }}>
                {panels[item.id] || null}
                {isLoading && (
                  <div className="absolute inset-0 bg-bloomberg-panel/60 backdrop-blur-[1px]
                                  flex items-center justify-center rounded z-10">
                    <div className="w-5 h-5 border-2 border-bloomberg-accent/30
                                    border-t-bloomberg-accent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

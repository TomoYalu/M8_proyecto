/**
 * WidgetGrid — Contenedor GridStack con 12 columnas para widgets configurables.
 *
 * Usa refs y useEffect para inicializar GridStack. Al redimensionar un widget,
 * llama a Plotly.Plots.resize() en los gráficos internos. Al cambiar el layout,
 * persiste la configuración en el backend via store.
 *
 * Requisitos cubiertos: 5.2, 5.3, 5.6
 */

import { useEffect, useRef, useCallback } from 'react';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import useStore from '../../store/index';
import WidgetContainer from './WidgetContainer';

/**
 * @param {object} props
 * @param {Object.<string, React.ReactNode>} props.widgetContent - Mapa de widget_id → componente React a renderizar
 */
export default function WidgetGrid({ widgetContent = {} }) {
  const gridRef = useRef(null);
  const gridInstanceRef = useRef(null);
  const isUpdatingRef = useRef(false);

  const widgetConfig = useStore((s) => s.widgetConfig);
  const updateWidgetPosition = useStore((s) => s.updateWidgetPosition);
  const saveWidgetConfig = useStore((s) => s.saveWidgetConfig);

  // Widgets visibles ordenados por posición
  const widgetsVisibles = Object.entries(widgetConfig)
    .filter(([, cfg]) => cfg.visible)
    .sort((a, b) => {
      const ay = a[1].y, by = b[1].y;
      if (ay !== by) return ay - by;
      return a[1].x - b[1].x;
    });

  /**
   * Persiste el layout actual en el backend.
   */
  const persistirLayout = useCallback(() => {
    const config = useStore.getState().widgetConfig;
    const widgets = Object.entries(config).map(([id, cfg]) => ({
      widget_id: id,
      x: cfg.x,
      y: cfg.y,
      w: cfg.w,
      h: cfg.h,
      visible: cfg.visible,
    }));
    saveWidgetConfig(widgets).catch(() => {
      // Silenciar errores de persistencia para no interrumpir UX
    });
  }, [saveWidgetConfig]);

  /**
   * Callback cuando GridStack reporta un cambio de layout.
   */
  const handleChange = useCallback(
    (_event, items) => {
      if (isUpdatingRef.current || !items) return;

      isUpdatingRef.current = true;
      for (const item of items) {
        if (item.id) {
          updateWidgetPosition(item.id, item.x, item.y, item.w, item.h);
        }
      }
      // Persistir después de actualizar el estado local
      persistirLayout();
      isUpdatingRef.current = false;
    },
    [updateWidgetPosition, persistirLayout]
  );

  /**
   * Callback al terminar de redimensionar: resize de gráficos Plotly.
   */
  const handleResizeStop = useCallback((_event, el) => {
    if (!el) return;
    // Buscar gráficos Plotly dentro del widget redimensionado
    const plotlyDivs = el.querySelectorAll('.js-plotly-plot');
    if (plotlyDivs.length > 0 && window.Plotly) {
      plotlyDivs.forEach((div) => {
        try {
          window.Plotly.Plots.resize(div);
        } catch {
          // Ignorar si el gráfico aún no está listo
        }
      });
    }
  }, []);

  // ── Inicializar GridStack ─────────────────────────────────────
  useEffect(() => {
    if (!gridRef.current) return;

    const grid = GridStack.init(
      {
        column: 12,
        cellHeight: 60,
        margin: 8,
        animate: true,
        float: false,
        draggable: { handle: '.gs-drag-handle' },
        resizable: { handles: 'se' },
      },
      gridRef.current
    );

    gridInstanceRef.current = grid;

    grid.on('change', handleChange);
    grid.on('resizestop', handleResizeStop);

    return () => {
      grid.off('change', handleChange);
      grid.off('resizestop', handleResizeStop);
      grid.destroy(false);
      gridInstanceRef.current = null;
    };
    // Solo inicializar una vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sincronizar widgets visibles con GridStack ────────────────
  useEffect(() => {
    const grid = gridInstanceRef.current;
    if (!grid) return;

    isUpdatingRef.current = true;

    // Obtener IDs actuales en el grid
    const existingIds = new Set();
    grid.getGridItems().forEach((el) => {
      const id = el.getAttribute('gs-id');
      if (id) existingIds.add(id);
    });

    const visibleIds = new Set(widgetsVisibles.map(([id]) => id));

    // Remover widgets que ya no son visibles
    grid.getGridItems().forEach((el) => {
      const id = el.getAttribute('gs-id');
      if (id && !visibleIds.has(id)) {
        grid.removeWidget(el, false);
      }
    });

    // Actualizar posiciones de widgets existentes
    grid.getGridItems().forEach((el) => {
      const id = el.getAttribute('gs-id');
      if (id && visibleIds.has(id)) {
        const cfg = widgetConfig[id];
        if (cfg) {
          grid.update(el, { x: cfg.x, y: cfg.y, w: cfg.w, h: cfg.h });
        }
      }
    });

    isUpdatingRef.current = false;
  }, [widgetsVisibles, widgetConfig]);

  return (
    <div
      ref={gridRef}
      className="grid-stack"
      role="region"
      aria-label="Panel de widgets configurable"
    >
      {widgetsVisibles.map(([widgetId, cfg]) => (
        <div
          key={widgetId}
          className="grid-stack-item"
          gs-id={widgetId}
          gs-x={cfg.x}
          gs-y={cfg.y}
          gs-w={cfg.w}
          gs-h={cfg.h}
          gs-min-w={2}
          gs-min-h={2}
        >
          <div className="grid-stack-item-content">
            <WidgetContainer
              widgetId={widgetId}
              titulo={cfg.nombre || widgetId}
            >
              {/* Drag handle invisible en la barra de título */}
              <div className="gs-drag-handle absolute inset-x-0 top-0 h-8 cursor-move" />
              {widgetContent[widgetId] || (
                <div className="flex items-center justify-center h-full text-bloomberg-text-muted text-sm">
                  <span>{cfg.nombre || widgetId}</span>
                </div>
              )}
            </WidgetContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

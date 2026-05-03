/**
 * Widget Slice para Zustand — estado de configuración de widgets y preset activo.
 *
 * Requisitos cubiertos: 5.1–5.6
 */

export const createWidgetSlice = (set, get) => ({
  // ─── Estado ───────────────────────────────────────────────────
  widgetConfig: {},       // { widget_id: { x, y, w, h, visible, nombre } }
  presetActivo: null,

  // ─── Acciones ─────────────────────────────────────────────────

  /**
   * Obtiene la configuración de widgets desde el backend.
   * Si no existe configuración, el backend aplica preset "completo" por defecto.
   */
  fetchWidgetConfig: async () => {
    const res = await fetch('/api/widgets/config');
    if (!res.ok) throw new Error('Error al obtener configuración de widgets');
    const data = await res.json();
    const config = {};
    for (const w of data.widgets) {
      config[w.widget_id] = {
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        visible: w.visible,
        nombre: w.nombre,
      };
    }
    set({ widgetConfig: config, presetActivo: data.preset_activo });
    return data;
  },

  /**
   * Guarda la configuración de widgets en el backend.
   * @param {Array} widgets - Lista de objetos { widget_id, x, y, w, h, visible }
   */
  saveWidgetConfig: async (widgets) => {
    const res = await fetch('/api/widgets/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgets }),
    });
    if (!res.ok) throw new Error('Error al guardar configuración de widgets');
    const data = await res.json();
    const config = {};
    for (const w of data.widgets) {
      config[w.widget_id] = {
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        visible: w.visible,
        nombre: w.nombre,
      };
    }
    set({ widgetConfig: config, presetActivo: null });
    return data;
  },

  /**
   * Aplica un preset de layout.
   * @param {string} nombre - Nombre del preset ('rapido', 'completo', 'portafolio')
   */
  aplicarPreset: async (nombre) => {
    const res = await fetch(`/api/widgets/preset/${nombre}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Error al aplicar preset');
    const data = await res.json();
    const config = {};
    for (const w of data.widgets) {
      config[w.widget_id] = {
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        visible: w.visible,
        nombre: w.nombre,
      };
    }
    set({ widgetConfig: config, presetActivo: data.preset_activo });
    return data;
  },

  /**
   * Alterna la visibilidad de un widget (local + persistencia).
   * @param {string} widgetId - ID del widget a alternar
   */
  toggleWidget: (widgetId) => {
    const { widgetConfig, saveWidgetConfig } = get();
    const widget = widgetConfig[widgetId];
    if (!widget) return;

    const nuevoConfig = {
      ...widgetConfig,
      [widgetId]: { ...widget, visible: !widget.visible },
    };
    set({ widgetConfig: nuevoConfig, presetActivo: null });

    // Persistir en backend
    const widgets = Object.entries(nuevoConfig).map(([id, cfg]) => ({
      widget_id: id,
      ...cfg,
    }));
    saveWidgetConfig(widgets).catch(() => {
      // Revertir en caso de error
      set({ widgetConfig });
    });
  },

  /**
   * Actualiza la posición y tamaño de un widget (local + persistencia).
   * @param {string} widgetId - ID del widget
   * @param {number} x - Posición X en la cuadrícula
   * @param {number} y - Posición Y en la cuadrícula
   * @param {number} w - Ancho en columnas
   * @param {number} h - Alto en filas
   */
  updateWidgetPosition: (widgetId, x, y, w, h) => {
    const { widgetConfig } = get();
    const widget = widgetConfig[widgetId];
    if (!widget) return;

    const nuevoConfig = {
      ...widgetConfig,
      [widgetId]: { ...widget, x, y, w, h },
    };
    set({ widgetConfig: nuevoConfig, presetActivo: null });
  },
});

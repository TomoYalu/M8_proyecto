/**
 * UI Slice para Zustand — estado del sidebar, modales, errores y loading.
 */

export const createUiSlice = (set) => ({
  // ─── Tipo de cambio (Exchange Rate Banner) ────────────────────
  tipoCambio: {
    precio: null,
    cambio_dia: null,
    cambio_pct: null,
    ultima_actualizacion: null,
    fuente: null,
  },
  setTipoCambio: (data) =>
    set({
      tipoCambio: {
        precio: data.precio ?? data.usd_mxn ?? null,
        cambio_dia: data.cambio_dia ?? null,
        cambio_pct: data.cambio_pct ?? null,
        ultima_actualizacion: data.ultima_actualizacion ?? data.updated_at ?? null,
        fuente: data.fuente ?? null,
      },
    }),

  // ─── Sidebar ──────────────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (abierto) =>
    set({ sidebarOpen: abierto }),

  // ─── Modales ──────────────────────────────────────────────────
  modalesAbiertos: {},
  abrirModal: (id) =>
    set((state) => ({
      modalesAbiertos: { ...state.modalesAbiertos, [id]: true },
    })),
  cerrarModal: (id) =>
    set((state) => ({
      modalesAbiertos: { ...state.modalesAbiertos, [id]: false },
    })),
  estaModalAbierto: (id) => {
    // Nota: esta es una función de lectura, se usa con get() en el store
    return false;
  },

  // ─── Errores ──────────────────────────────────────────────────
  errores: {},
  setError: (clave, mensaje) =>
    set((state) => ({
      errores: { ...state.errores, [clave]: mensaje },
    })),
  limpiarError: (clave) =>
    set((state) => {
      const nuevos = { ...state.errores };
      delete nuevos[clave];
      return { errores: nuevos };
    }),
  limpiarTodosErrores: () =>
    set({ errores: {} }),

  // ─── Loading states ───────────────────────────────────────────
  loadingStates: {},
  setLoading: (clave, activo) =>
    set((state) => ({
      loadingStates: { ...state.loadingStates, [clave]: activo },
    })),
  esCargando: (clave) => {
    return false;
  },
});

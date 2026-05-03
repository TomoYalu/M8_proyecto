/**
 * Optimizer Slice para Zustand — estado de optimización Markowitz.
 *
 * Maneja la ejecución de la optimización, resultados, parámetros
 * y estados de carga/error.
 *
 * Requisitos cubiertos: 2.11, 7.4, 7.5
 */

export const createOptimizerSlice = (set, get) => ({
  // ─── Estado ───────────────────────────────────────────────────
  resultadoOptimizacion: null,
  cargandoOptimizacion: false,
  errorOptimizacion: null,
  parametrosOptimizacion: {
    tickers: [],
    inversion: 1000000,
    rf: null,
    periodo: '5y',
    min_peso: null,
    max_peso: null,
  },

  // ─── Acciones ─────────────────────────────────────────────────

  ejecutarOptimizacion: async (params) => {
    set({ cargandoOptimizacion: true, errorOptimizacion: null });
    try {
      const res = await fetch('/api/optimizador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar optimización');
      set({ resultadoOptimizacion: data, cargandoOptimizacion: false });
      return data;
    } catch (err) {
      set({ errorOptimizacion: err.message, cargandoOptimizacion: false });
      throw err;
    }
  },

  limpiarResultados: () =>
    set({ resultadoOptimizacion: null, errorOptimizacion: null }),

  setParametros: (params) =>
    set((state) => ({
      parametrosOptimizacion: { ...state.parametrosOptimizacion, ...params },
    })),
});

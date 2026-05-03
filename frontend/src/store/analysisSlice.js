/**
 * Analysis Slice para Zustand — estado de análisis técnico.
 *
 * Estado: tickerActivo, analisisData, periodo, intervalo, isLoadingAnalisis, errorAnalisis
 * Acciones: fetchAnalisis, setTickerActivo, setPeriodo, setIntervalo
 *
 * Requisitos cubiertos: 4.1–4.9, 12.6
 */

export const createAnalysisSlice = (set, get) => ({
  // ─── Estado ───────────────────────────────────────────────────
  tickerActivo: 'AAPL',
  analisisData: null,
  periodo: '1y',
  intervalo: '1d',
  isLoadingAnalisis: false,
  errorAnalisis: null,

  // ─── Acciones ─────────────────────────────────────────────────

  /**
   * Obtiene análisis técnico completo para un ticker.
   * @param {string} ticker - Símbolo bursátil
   * @param {string} [periodo] - Período de datos (ej. '1y', '6mo')
   * @param {string} [intervalo] - Intervalo entre velas (ej. '1d', '1wk')
   */
  fetchAnalisis: async (ticker, periodo, intervalo) => {
    const t = ticker || get().tickerActivo;
    const p = periodo || get().periodo;
    const i = intervalo || get().intervalo;

    set({ isLoadingAnalisis: true, errorAnalisis: null });

    try {
      const params = new URLSearchParams({ ticker: t, periodo: p, intervalo: i });
      const res = await fetch(`/api/analisis?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener análisis técnico');
      }

      set({
        analisisData: data,
        tickerActivo: t,
        periodo: p,
        intervalo: i,
        isLoadingAnalisis: false,
      });

      return data;
    } catch (err) {
      set({
        isLoadingAnalisis: false,
        errorAnalisis: err.message || 'Error al obtener análisis técnico',
      });
      throw err;
    }
  },

  setTickerActivo: (ticker) => set({ tickerActivo: ticker }),
  setPeriodo: (p) => set({ periodo: p }),
  setIntervalo: (i) => set({ intervalo: i }),
  limpiarAnalisis: () => set({ analisisData: null, errorAnalisis: null }),
});

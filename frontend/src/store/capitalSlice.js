/**
 * Slice de Zustand para configuración de capital global.
 */
export const createCapitalSlice = (set) => ({
  capitalConfig: null, // { capital_global, moneda_base, updated_at }

  fetchCapitalConfig: async () => {
    try {
      const res = await fetch('/api/configuracion/capital');
      if (res.ok) {
        const data = await res.json();
        set({ capitalConfig: data });
        return data;
      }
    } catch (err) {
      console.error('[capitalSlice] Error fetching config:', err);
    }
  },

  actualizarCapitalGlobal: async (capital_global, moneda_base) => {
    const body = {};
    if (capital_global !== undefined) body.capital_global = capital_global;
    if (moneda_base !== undefined) body.moneda_base = moneda_base;

    const res = await fetch('/api/configuracion/capital', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar capital');
    set({ capitalConfig: data });
    return data;
  },
});

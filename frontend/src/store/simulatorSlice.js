/**
 * Simulator Slice para Zustand — estado de simulaciones de portafolios.
 *
 * Maneja CRUD de simulaciones, ejecución, importación desde portafolio
 * existente y cálculo de acciones.
 *
 * Requisitos cubiertos: 1.1–1.8, 7.1
 */

export const createSimulatorSlice = (set, get) => ({
  // ─── Estado ───────────────────────────────────────────────────
  simulaciones: [],
  simulacionActiva: null,
  cargandoSimulacion: false,
  errorSimulacion: null,

  // ─── Acciones CRUD ────────────────────────────────────────────

  fetchSimulaciones: async () => {
    set({ cargandoSimulacion: true, errorSimulacion: null });
    try {
      const res = await fetch('/api/simulaciones');
      if (!res.ok) throw new Error('Error al obtener simulaciones');
      const data = await res.json();
      set({ simulaciones: data, cargandoSimulacion: false });
      return data;
    } catch (err) {
      set({ errorSimulacion: err.message, cargandoSimulacion: false });
      throw err;
    }
  },

  crearSimulacion: async (datos) => {
    set({ cargandoSimulacion: true, errorSimulacion: null });
    try {
      const res = await fetch('/api/simulaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear simulación');
      set((state) => ({
        simulaciones: [...state.simulaciones, data],
        cargandoSimulacion: false,
      }));
      return data;
    } catch (err) {
      set({ errorSimulacion: err.message, cargandoSimulacion: false });
      throw err;
    }
  },

  actualizarSimulacion: async (id, datos) => {
    set({ cargandoSimulacion: true, errorSimulacion: null });
    try {
      const res = await fetch(`/api/simulaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar simulación');
      set((state) => ({
        simulaciones: state.simulaciones.map((s) => (s.id === id ? data : s)),
        simulacionActiva: state.simulacionActiva?.id === id ? data : state.simulacionActiva,
        cargandoSimulacion: false,
      }));
      return data;
    } catch (err) {
      set({ errorSimulacion: err.message, cargandoSimulacion: false });
      throw err;
    }
  },

  ejecutarSimulacion: async (id) => {
    set({ cargandoSimulacion: true, errorSimulacion: null });
    try {
      const res = await fetch(`/api/simulaciones/${id}/ejecutar`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar simulación');
      set((state) => ({
        simulaciones: state.simulaciones.map((s) => (s.id === id ? data : s)),
        simulacionActiva: state.simulacionActiva?.id === id ? data : state.simulacionActiva,
        cargandoSimulacion: false,
      }));
      return data;
    } catch (err) {
      set({ errorSimulacion: err.message, cargandoSimulacion: false });
      throw err;
    }
  },

  eliminarSimulacion: async (id) => {
    set({ cargandoSimulacion: true, errorSimulacion: null });
    try {
      const res = await fetch(`/api/simulaciones/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar simulación');
      set((state) => ({
        simulaciones: state.simulaciones.filter((s) => s.id !== id),
        simulacionActiva:
          state.simulacionActiva?.id === id ? null : state.simulacionActiva,
        cargandoSimulacion: false,
      }));
      return data;
    } catch (err) {
      set({ errorSimulacion: err.message, cargandoSimulacion: false });
      throw err;
    }
  },

  importarPortafolio: async (portafolioId, nombre) => {
    set({ cargandoSimulacion: true, errorSimulacion: null });
    try {
      const res = await fetch('/api/simulaciones/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portafolio_id: portafolioId, nombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar portafolio');
      set((state) => ({
        simulaciones: [...state.simulaciones, data],
        cargandoSimulacion: false,
      }));
      return data;
    } catch (err) {
      set({ errorSimulacion: err.message, cargandoSimulacion: false });
      throw err;
    }
  },

  setSimulacionActiva: (id) => {
    const { simulaciones } = get();
    const sim = simulaciones.find((s) => s.id === id) || null;
    set({ simulacionActiva: sim });
  },

  calcularAcciones: async (id) => {
    set({ cargandoSimulacion: true, errorSimulacion: null });
    try {
      const res = await fetch(`/api/simulaciones/${id}/calcular`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular acciones');
      set((state) => ({
        simulaciones: state.simulaciones.map((s) => (s.id === id ? data : s)),
        simulacionActiva: state.simulacionActiva?.id === id ? data : state.simulacionActiva,
        cargandoSimulacion: false,
      }));
      return data;
    } catch (err) {
      set({ errorSimulacion: err.message, cargandoSimulacion: false });
      throw err;
    }
  },
});

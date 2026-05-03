/**
 * Alert Slice para Zustand — estado de alertas, contador no leídas,
 * historial paginado.
 *
 * Requisitos cubiertos: 8.1–8.7, 12.6
 */

export const createAlertSlice = (set, get) => ({
  // ─── Estado ───────────────────────────────────────────────────
  alertas: [],
  alertasNoLeidas: 0,
  alertasHistorial: {
    items: [],
    total: 0,
    pagina: 1,
    paginas: 1,
  },

  // ─── Alertas CRUD ─────────────────────────────────────────────

  fetchAlertas: async () => {
    const res = await fetch('/api/alertas');
    if (!res.ok) throw new Error('Error al obtener alertas');
    const data = await res.json();
    set({ alertas: data.alertas ?? data });
    return data;
  },

  crearAlerta: async (datos) => {
    const res = await fetch('/api/alertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear alerta');
    set((state) => ({ alertas: [...state.alertas, data] }));
    return data;
  },

  actualizarAlerta: async (id, datos) => {
    const res = await fetch(`/api/alertas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar alerta');
    set((state) => ({
      alertas: state.alertas.map((a) => (a.id === id ? data : a)),
    }));
    return data;
  },

  eliminarAlerta: async (id) => {
    const res = await fetch(`/api/alertas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar alerta');
    set((state) => ({
      alertas: state.alertas.filter((a) => a.id !== id),
    }));
    return data;
  },

  toggleAlerta: async (id) => {
    const res = await fetch(`/api/alertas/${id}/toggle`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cambiar estado de alerta');
    set((state) => ({
      alertas: state.alertas.map((a) => (a.id === id ? data : a)),
    }));
    return data;
  },

  // ─── Historial ────────────────────────────────────────────────

  fetchHistorial: async (page = 1) => {
    const res = await fetch(`/api/alertas/historial?page=${page}`);
    if (!res.ok) throw new Error('Error al obtener historial de alertas');
    const data = await res.json();
    set({
      alertasHistorial: {
        items: data.historial ?? data.items ?? [],
        total: data.total ?? 0,
        pagina: data.pagina ?? page,
        paginas: data.paginas ?? 1,
      },
    });
    return data;
  },

  // ─── Contador no leídas ───────────────────────────────────────

  incrementarNoLeidas: () =>
    set((state) => ({ alertasNoLeidas: state.alertasNoLeidas + 1 })),

  resetNoLeidas: () => set({ alertasNoLeidas: 0 }),
});

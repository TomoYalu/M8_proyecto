/**
 * Portfolio Slice para Zustand — estado de portafolios, posiciones,
 * transacciones y vista consolidada.
 *
 * Requisitos cubiertos: 1.1–1.5, 2.1–2.6, 3.1–3.7, 12.6
 */

export const createPortfolioSlice = (set, get) => ({
  // ─── Estado ───────────────────────────────────────────────────
  portafolios: [],
  portafolioActivo: null,
  posiciones: {},        // { portafolio_id: [posicion, ...] }
  transacciones: {},     // { portafolio_id: { items, total, pagina, paginas } }
  consolidado: null,
  dashboardCache: {},   // { portafolio_id: data }
  semaforosCache: {},  // { ticker: data }
  rsiCache: {},        // { ticker: rsi_value }
  chartsCache: {},     // { 'portId:tipo:param': data }
  dashboardDirty: {},   // { portafolio_id: true } — indica que hay cambios pendientes

  // ─── Portafolios CRUD ─────────────────────────────────────────

  fetchPortafolios: async () => {
    const res = await fetch('/api/portafolios');
    if (!res.ok) throw new Error('Error al obtener portafolios');
    const data = await res.json();
    set({ portafolios: data });
    return data;
  },

  crearPortafolio: async (nombre, descripcion, capitalInicial = 0, moneda = 'MXN') => {
    const res = await fetch('/api/portafolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, capital_inicial: capitalInicial, moneda }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear portafolio');
    set((state) => ({ portafolios: [...state.portafolios, data] }));
    return data;
  },

  eliminarPortafolio: async (id) => {
    const res = await fetch(`/api/portafolios/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar portafolio');
    set((state) => {
      const nuevos = state.portafolios.filter((p) => p.id !== id);
      const nuevoActivo = state.portafolioActivo === id ? null : state.portafolioActivo;
      const nuevasPosiciones = { ...state.posiciones };
      delete nuevasPosiciones[id];
      const nuevasTx = { ...state.transacciones };
      delete nuevasTx[id];
      const nuevoCache = { ...state.dashboardCache };
      delete nuevoCache[id];
      const nuevoDirty = { ...state.dashboardDirty };
      delete nuevoDirty[id];
      return {
        portafolios: nuevos,
        portafolioActivo: nuevoActivo,
        posiciones: nuevasPosiciones,
        transacciones: nuevasTx,
        dashboardCache: nuevoCache,
        dashboardDirty: nuevoDirty,
      };
    });
    return data;
  },

  actualizarPortafolio: async (id, datos) => {
    const res = await fetch(`/api/portafolios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar portafolio');
    set((state) => ({
      portafolios: state.portafolios.map((p) => (p.id === id ? data : p)),
    }));
    return data;
  },

  // ─── Posiciones ───────────────────────────────────────────────

  fetchPosiciones: async (id) => {
    const res = await fetch(`/api/portafolios/${id}/posiciones`);
    if (!res.ok) throw new Error('Error al obtener posiciones');
    const data = await res.json();
    set((state) => ({
      posiciones: { ...state.posiciones, [id]: data },
    }));
    return data;
  },

  // ─── Transacciones ────────────────────────────────────────────

  fetchTransacciones: async (id, page = 1) => {
    const res = await fetch(`/api/portafolios/${id}/transacciones?page=${page}`);
    if (!res.ok) throw new Error('Error al obtener transacciones');
    const data = await res.json();
    set((state) => ({
      transacciones: {
        ...state.transacciones,
        [id]: {
          items: data.transacciones,
          total: data.total,
          pagina: data.pagina,
          paginas: data.paginas,
        },
      },
    }));
    return data;
  },

  registrarTransaccion: async (id, datos) => {
    const res = await fetch(`/api/portafolios/${id}/transacciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar transacción');
    // Refrescar posiciones y transacciones tras registrar
    const { fetchPosiciones, fetchTransacciones, markDashboardDirty } = get();
    markDashboardDirty(id);
    await Promise.all([fetchPosiciones(id), fetchTransacciones(id)]);
    return data;
  },

  // ─── Consolidado ──────────────────────────────────────────────

  fetchConsolidado: async () => {
    const res = await fetch('/api/portafolios/consolidado');
    if (!res.ok) throw new Error('Error al obtener vista consolidada');
    const data = await res.json();
    set({ consolidado: data });
    return data;
  },

  // ─── Refresco de precios bajo demanda ────────────────────────

  refrescarPrecios: async (portafolioId) => {
    const res = await fetch(`/api/portafolios/${portafolioId}/refrescar-precios`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Error al refrescar precios');
    const data = await res.json();
    set((state) => ({
      posiciones: { ...state.posiciones, [portafolioId]: data },
    }));
    return data;
  },

  // ─── Selección ────────────────────────────────────────────────

  setDashboardCache: (id, data) => set((state) => ({
    dashboardCache: { ...state.dashboardCache, [id]: data },
    dashboardDirty: { ...state.dashboardDirty, [id]: false },
  })),

  markDashboardDirty: (id) => set((state) => ({
    dashboardDirty: { ...state.dashboardDirty, [id]: true },
  })),

  setChartsCache: (key, data) => set((s) => ({
    chartsCache: { ...s.chartsCache, [key]: data },
  })),

  fetchSemaforosBatch: async (tickers) => {
    const cached = get().semaforosCache;
    const needed = tickers.filter(t => !(t in cached));
    if (needed.length === 0) return cached;
    try {
      const res = await fetch('/api/noticias/semaforos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: needed }),
      });
      if (res.ok) {
        const data = await res.json();
        set((s) => ({ semaforosCache: { ...s.semaforosCache, ...data } }));
      }
    } catch {}
    return get().semaforosCache;
  },

  fetchRsiBatch: async (tickers) => {
    const cached = get().rsiCache;
    const needed = tickers.filter(t => !(t in cached));
    if (needed.length === 0) return cached;
    try {
      const res = await fetch('/api/analisis/batch-rsi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: needed }),
      });
      if (res.ok) {
        const data = await res.json();
        set((s) => ({ rsiCache: { ...s.rsiCache, ...data } }));
      }
    } catch {}
    return get().rsiCache;
  },

  setPortafolioActivo: (id) => set({ portafolioActivo: id }),
});

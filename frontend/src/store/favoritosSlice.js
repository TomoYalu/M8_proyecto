/**
 * Favoritos Slice para Zustand — lista de tickers favoritos en sesión.
 * Los favoritos se pierden al cerrar el navegador (solo en memoria, no en DB).
 *
 * Requisitos cubiertos: plan-v1.1 B3
 */

export const createFavoritosSlice = (set, get) => ({
  // ─── Estado ───────────────────────────────────────────────────
  favoritos: [], // Array de ticker strings

  // ─── Acciones ─────────────────────────────────────────────────

  /**
   * Agrega un ticker a favoritos si no existe ya.
   * @param {string} ticker
   */
  agregarFavorito: (ticker) =>
    set((state) => {
      if (state.favoritos.includes(ticker)) return state;
      return { favoritos: [...state.favoritos, ticker] };
    }),

  /**
   * Elimina un ticker de favoritos.
   * @param {string} ticker
   */
  eliminarFavorito: (ticker) =>
    set((state) => ({
      favoritos: state.favoritos.filter((t) => t !== ticker),
    })),

  /**
   * Alterna un ticker en favoritos (agrega si no está, elimina si está).
   * @param {string} ticker
   */
  toggleFavorito: (ticker) =>
    set((state) => {
      if (state.favoritos.includes(ticker)) {
        return { favoritos: state.favoritos.filter((t) => t !== ticker) };
      }
      return { favoritos: [...state.favoritos, ticker] };
    }),

  /**
   * Getter: retorna true si el ticker está en favoritos.
   * Uso: useStore.getState().esFavorito('AAPL') o dentro de un selector.
   * @param {string} ticker
   * @returns {boolean}
   */
  esFavorito: (ticker) => {
    return get().favoritos.includes(ticker);
  },
});

/**
 * Selector derivado: contador de favoritos.
 * Uso: const count = useStore(contadorFavoritos);
 * @param {object} state
 * @returns {number}
 */
export const contadorFavoritos = (state) => state.favoritos.length;

import { create } from 'zustand';
import { createUiSlice } from './uiSlice';
import { createPortfolioSlice } from './portfolioSlice';
import { createWidgetSlice } from './widgetSlice';
import { createAnalysisSlice } from './analysisSlice';
import { createAlertSlice } from './alertSlice';
import { createFavoritosSlice } from './favoritosSlice';
import { createOptimizerSlice } from './optimizerSlice';
import { createSimulatorSlice } from './simulatorSlice';

/**
 * Store principal de Zustand que combina todos los slices.
 */
const useStore = create((...args) => ({
  ...createUiSlice(...args),
  ...createPortfolioSlice(...args),
  ...createWidgetSlice(...args),
  ...createAnalysisSlice(...args),
  ...createAlertSlice(...args),
  ...createFavoritosSlice(...args),
  ...createOptimizerSlice(...args),
  ...createSimulatorSlice(...args),

  // ─── WebSocket (estado base) ──────────────────────────────────
  wsConnected: false,
  setWsConnected: (conectado) => args[0]({ wsConnected: conectado }),

  preciosEnVivo: {},
  actualizarPrecio: (ticker, datos) =>
    args[0]((state) => ({
      preciosEnVivo: { ...state.preciosEnVivo, [ticker]: datos },
    })),
}));

export default useStore;

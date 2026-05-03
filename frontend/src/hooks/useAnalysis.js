import { useCallback } from 'react';
import useStore from '../store';

/**
 * Hook que envuelve el analysis store con acceso directo
 * a estado y acciones de análisis técnico.
 *
 * Requisitos cubiertos: 4.1–4.9, 12.4, 12.5, 12.6
 */
export default function useAnalysis() {
  const tickerActivo = useStore((s) => s.tickerActivo);
  const analisisData = useStore((s) => s.analisisData);
  const periodo = useStore((s) => s.periodo);
  const intervalo = useStore((s) => s.intervalo);
  const isLoading = useStore((s) => s.isLoadingAnalisis);
  const error = useStore((s) => s.errorAnalisis);

  const fetchAnalisis = useStore((s) => s.fetchAnalisis);
  const setTickerActivo = useStore((s) => s.setTickerActivo);
  const setPeriodo = useStore((s) => s.setPeriodo);
  const setIntervalo = useStore((s) => s.setIntervalo);
  const limpiarAnalisis = useStore((s) => s.limpiarAnalisis);

  /**
   * Busca análisis para un ticker con período e intervalo actuales.
   */
  const buscarAnalisis = useCallback(
    (ticker, p, i) => fetchAnalisis(ticker, p, i),
    [fetchAnalisis]
  );

  return {
    // Estado
    tickerActivo,
    analisisData,
    periodo,
    intervalo,
    isLoading,
    error,

    // Acciones
    buscarAnalisis,
    setTickerActivo,
    setPeriodo,
    setIntervalo,
    limpiarAnalisis,
  };
}

import { useCallback, useState } from 'react';
import useStore from '../store';

/**
 * Hook que envuelve las acciones del optimizer store y provee
 * estados de loading/error por operación.
 *
 * Requisitos cubiertos: 7.4, 7.5
 */
export default function useOptimizer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resultadoOptimizacion = useStore((s) => s.resultadoOptimizacion);
  const cargandoOptimizacion = useStore((s) => s.cargandoOptimizacion);
  const errorOptimizacion = useStore((s) => s.errorOptimizacion);

  const ejecutarOptimizacionStore = useStore((s) => s.ejecutarOptimizacion);
  const limpiarResultados = useStore((s) => s.limpiarResultados);
  const setParametros = useStore((s) => s.setParametros);

  /**
   * Ejecuta una acción async con manejo de loading/error.
   */
  const ejecutar = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Estado
    resultadoOptimizacion,
    cargandoOptimizacion,
    errorOptimizacion,
    loading,
    error,
    limpiarError: () => setError(null),

    // Acciones envueltas con loading/error
    ejecutarOptimizacion: (params) =>
      ejecutar(() => ejecutarOptimizacionStore(params)),
    limpiarResultados,
    setParametros,
  };
}

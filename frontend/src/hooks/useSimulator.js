import { useCallback, useState } from 'react';
import useStore from '../store';

/**
 * Hook que envuelve las acciones del simulator store y provee
 * estados de loading/error por operación.
 *
 * Requisitos cubiertos: 1.7, 7.1
 */
export default function useSimulator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const simulaciones = useStore((s) => s.simulaciones);
  const simulacionActiva = useStore((s) => s.simulacionActiva);
  const cargandoSimulacion = useStore((s) => s.cargandoSimulacion);
  const errorSimulacion = useStore((s) => s.errorSimulacion);

  const fetchSimulacionesStore = useStore((s) => s.fetchSimulaciones);
  const crearSimulacionStore = useStore((s) => s.crearSimulacion);
  const actualizarSimulacionStore = useStore((s) => s.actualizarSimulacion);
  const ejecutarSimulacionStore = useStore((s) => s.ejecutarSimulacion);
  const eliminarSimulacionStore = useStore((s) => s.eliminarSimulacion);
  const importarPortafolioStore = useStore((s) => s.importarPortafolio);
  const setSimulacionActiva = useStore((s) => s.setSimulacionActiva);
  const calcularAccionesStore = useStore((s) => s.calcularAcciones);

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
    simulaciones,
    simulacionActiva,
    cargandoSimulacion,
    errorSimulacion,
    loading,
    error,
    limpiarError: () => setError(null),

    // Acciones envueltas con loading/error
    fetchSimulaciones: () => ejecutar(fetchSimulacionesStore),
    crearSimulacion: (datos) => ejecutar(() => crearSimulacionStore(datos)),
    actualizarSimulacion: (id, datos) =>
      ejecutar(() => actualizarSimulacionStore(id, datos)),
    ejecutarSimulacion: (id) =>
      ejecutar(() => ejecutarSimulacionStore(id)),
    eliminarSimulacion: (id) =>
      ejecutar(() => eliminarSimulacionStore(id)),
    importarPortafolio: (portafolioId, nombre) =>
      ejecutar(() => importarPortafolioStore(portafolioId, nombre)),
    setSimulacionActiva,
    calcularAcciones: (id) =>
      ejecutar(() => calcularAccionesStore(id)),
  };
}

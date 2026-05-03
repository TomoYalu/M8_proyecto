import { useCallback, useState } from 'react';
import useStore from '../store';

/**
 * Hook que envuelve las acciones del portfolio store y provee
 * estados de loading/error por operación.
 *
 * Requisitos cubiertos: 1.1–1.5, 2.1–2.6, 12.4, 12.5, 12.6
 */
export default function usePortfolio() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const portafolios = useStore((s) => s.portafolios);
  const portafolioActivo = useStore((s) => s.portafolioActivo);
  const posiciones = useStore((s) => s.posiciones);
  const transacciones = useStore((s) => s.transacciones);
  const consolidado = useStore((s) => s.consolidado);

  const fetchPortafolios = useStore((s) => s.fetchPortafolios);
  const crearPortafolio = useStore((s) => s.crearPortafolio);
  const eliminarPortafolio = useStore((s) => s.eliminarPortafolio);
  const actualizarPortafolio = useStore((s) => s.actualizarPortafolio);
  const fetchPosiciones = useStore((s) => s.fetchPosiciones);
  const fetchTransacciones = useStore((s) => s.fetchTransacciones);
  const registrarTransaccion = useStore((s) => s.registrarTransaccion);
  const fetchConsolidado = useStore((s) => s.fetchConsolidado);
  const setPortafolioActivo = useStore((s) => s.setPortafolioActivo);
  const refrescarPrecios = useStore((s) => s.refrescarPrecios);

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
    portafolios,
    portafolioActivo,
    posiciones,
    transacciones,
    consolidado,
    loading,
    error,
    limpiarError: () => setError(null),

    // Acciones envueltas con loading/error
    fetchPortafolios: () => ejecutar(fetchPortafolios),
    crearPortafolio: (nombre, desc, capitalInicial, moneda) => ejecutar(() => crearPortafolio(nombre, desc, capitalInicial, moneda)),
    eliminarPortafolio: (id) => ejecutar(() => eliminarPortafolio(id)),
    actualizarPortafolio: (id, data) => ejecutar(() => actualizarPortafolio(id, data)),
    fetchPosiciones: (id) => ejecutar(() => fetchPosiciones(id)),
    fetchTransacciones: (id, page) => ejecutar(() => fetchTransacciones(id, page)),
    registrarTransaccion: (id, data) => ejecutar(() => registrarTransaccion(id, data)),
    fetchConsolidado: () => ejecutar(fetchConsolidado),
    refrescarPrecios: (id) => ejecutar(() => refrescarPrecios(id)),
    setPortafolioActivo,
  };
}

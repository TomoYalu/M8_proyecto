import { useState, useEffect, useRef } from 'react';

/**
 * Hook que consulta el precio histórico de cierre cuando ticker y fecha están definidos.
 *
 * Implementa debounce, cancelación de solicitudes pendientes (AbortController)
 * y un flag de edición manual para no sobrescribir precios ingresados por el usuario.
 *
 * @param {string} ticker - Símbolo del ticker (ej. 'AAPL', 'AMXL.MX')
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {object} opciones
 * @param {number} [opciones.debounceMs=500] - Milisegundos de debounce antes de consultar
 * @returns {{ precio: number|null, cargando: boolean, error: string|null,
 *             fechaReal: string|null, moneda: string|null,
 *             precioEditadoManualmente: boolean,
 *             setPrecioEditadoManualmente: function }}
 */
export default function usePrecioHistorico(ticker, fecha, opciones = {}) {
  const { debounceMs = 500 } = opciones;

  const [precio, setPrecio] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fechaReal, setFechaReal] = useState(null);
  const [moneda, setMoneda] = useState(null);
  const [precioEditadoManualmente, setPrecioEditadoManualmente] = useState(false);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const tickerAnteriorRef = useRef(ticker);

  // Resetear precioEditadoManualmente cuando cambia el ticker
  useEffect(() => {
    if (ticker !== tickerAnteriorRef.current) {
      tickerAnteriorRef.current = ticker;
      setPrecioEditadoManualmente(false);
    }
  }, [ticker]);

  // Fetch con debounce cuando ticker + fecha cambian
  useEffect(() => {
    // Limpiar debounce previo
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // No hacer fetch si faltan datos o el usuario editó manualmente
    if (!ticker || !ticker.trim() || !fecha || !fecha.trim() || precioEditadoManualmente) {
      return;
    }

    setCargando(true);

    debounceRef.current = setTimeout(() => {
      // Cancelar solicitud pendiente
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams({ ticker: ticker.trim(), fecha: fecha.trim() });

      fetch(`/api/busqueda/precio-historico?${params}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((body) => {
              throw new Error(body.error || `Error ${res.status}`);
            });
          }
          return res.json();
        })
        .then((data) => {
          setPrecio(data.precio_cierre);
          setFechaReal(data.fecha_real);
          setMoneda(data.moneda);
          setError(null);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return; // Solicitud cancelada, ignorar
          console.warn('[usePrecioHistorico] Error al obtener precio:', err.message);
          setPrecio(null);
          setFechaReal(null);
          setMoneda(null);
          setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setCargando(false);
          }
        });
    }, debounceMs);

    // Cleanup: cancelar debounce y solicitud al desmontar o cambiar inputs
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setCargando(false);
    };
  }, [ticker, fecha, debounceMs, precioEditadoManualmente]);

  return {
    precio,
    cargando,
    error,
    fechaReal,
    moneda,
    precioEditadoManualmente,
    setPrecioEditadoManualmente,
  };
}

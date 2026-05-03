import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD usando hora local.
 * Si la fecha solicitada es hoy o futura, retorna ayer para evitar
 * errores de "fecha futura" por diferencias de zona horaria.
 */
function ajustarFecha(fechaStr) {
  if (!fechaStr) return null;
  const hoy = new Date();
  const fechaSolicitada = new Date(fechaStr + 'T12:00:00'); // Mediodía para evitar problemas de TZ

  // Si la fecha es hoy o futura, usar ayer
  if (fechaSolicitada >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().split('T')[0];
  }
  return fechaStr;
}

/**
 * Hook que consulta el precio histórico de cierre cuando ticker y fecha están definidos.
 *
 * Usa un approach simplificado: un solo fetch con debounce, sin AbortController
 * en el cleanup para evitar race conditions. En su lugar, usa un flag `stale`
 * para ignorar respuestas de solicitudes obsoletas.
 *
 * @param {string} ticker - Símbolo del ticker (ej. 'AAPL', 'AMXL.MX')
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {object} opciones
 * @param {number} [opciones.debounceMs=600] - Milisegundos de debounce antes de consultar
 * @returns {{ precio: number|null, cargando: boolean, error: string|null,
 *             fechaReal: string|null, moneda: string|null,
 *             precioEditadoManualmente: boolean,
 *             setPrecioEditadoManualmente: function }}
 */
export default function usePrecioHistorico(ticker, fecha, opciones = {}) {
  const { debounceMs = 600 } = opciones;

  const [precio, setPrecio] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fechaReal, setFechaReal] = useState(null);
  const [moneda, setMoneda] = useState(null);
  const [precioEditadoManualmente, setPrecioEditadoManualmente] = useState(false);

  const debounceRef = useRef(null);
  const fetchIdRef = useRef(0); // Incrementing ID to track stale responses
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

    // Ticker debe tener al menos 2 caracteres para evitar fetches innecesarios
    if (ticker.trim().length < 2) {
      return;
    }

    setCargando(true);
    const currentFetchId = ++fetchIdRef.current;

    debounceRef.current = setTimeout(async () => {
      // Ajustar fecha para evitar "fecha futura" por zona horaria
      const fechaAjustada = ajustarFecha(fecha.trim()) || fecha.trim();
      const params = new URLSearchParams({
        ticker: ticker.trim(),
        fecha: fechaAjustada,
      });

      try {
        const res = await fetch(`/api/busqueda/precio-historico?${params}`);

        // Ignorar si ya hay un fetch más reciente
        if (currentFetchId !== fetchIdRef.current) return;

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || `Error ${res.status}`);
        }

        const data = await res.json();

        // Ignorar si ya hay un fetch más reciente
        if (currentFetchId !== fetchIdRef.current) return;

        setPrecio(data.precio_cierre);
        setFechaReal(data.fecha_real);
        setMoneda(data.moneda);
        setError(null);
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return;
        console.warn('[usePrecioHistorico] Error:', err.message);
        setPrecio(null);
        setFechaReal(null);
        setMoneda(null);
        setError(err.message);
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setCargando(false);
        }
      }
    }, debounceMs);

    // Cleanup: solo cancelar el debounce timer, NO abortar el fetch
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
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

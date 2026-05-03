import { useEffect, useState, useCallback } from 'react';
import useStore from '../store';
import SemaforoPanel from '../components/news/SemaforoPanel';
import NewsFeed from '../components/news/NewsFeed';
import Spinner from '../components/common/Spinner';
import ErrorMessage from '../components/common/ErrorMessage';

/**
 * Página completa de noticias y semáforo de sentimiento.
 *
 * - SemaforoPanel arriba con todos los tickers del portafolio
 * - NewsFeed debajo con lista completa de noticias
 * - Filtro por ticker
 * - Botón para forzar actualización de noticias
 *
 * Requisitos cubiertos: 6.4, 6.5, 6.6
 */
export default function Noticias() {
  const [noticias, setNoticias] = useState([]);
  const [semaforos, setSemaforos] = useState({});
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState(null);

  const portafolios = useStore((s) => s.portafolios);
  const posiciones = useStore((s) => s.posiciones);
  const fetchPortafolios = useStore((s) => s.fetchPortafolios);
  const fetchPosiciones = useStore((s) => s.fetchPosiciones);

  /**
   * Extrae tickers únicos de todas las posiciones de todos los portafolios.
   */
  const obtenerTickersActivos = useCallback(() => {
    const set = new Set();
    for (const posArr of Object.values(posiciones)) {
      if (Array.isArray(posArr)) {
        for (const pos of posArr) {
          if (pos.ticker) set.add(pos.ticker);
        }
      }
    }
    return [...set].sort();
  }, [posiciones]);

  /**
   * Carga semáforo y noticias para un ticker.
   */
  const fetchTickerData = useCallback(async (ticker) => {
    const [resSemaforo, resNoticias] = await Promise.allSettled([
      fetch(`/api/noticias/${encodeURIComponent(ticker)}/semaforo`),
      fetch(`/api/noticias/${encodeURIComponent(ticker)}`),
    ]);

    let semaforo = null;
    let noticiasTicker = [];

    if (resSemaforo.status === 'fulfilled' && resSemaforo.value.ok) {
      semaforo = await resSemaforo.value.json();
    }

    if (resNoticias.status === 'fulfilled' && resNoticias.value.ok) {
      const data = await resNoticias.value.json();
      noticiasTicker = Array.isArray(data) ? data : data.noticias || [];
    }

    return { ticker, semaforo, noticias: noticiasTicker };
  }, []);

  /**
   * Carga todos los datos de noticias para los tickers activos.
   */
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Asegurar que tenemos portafolios cargados
      if (portafolios.length === 0) {
        await fetchPortafolios();
      }

      // Cargar posiciones de todos los portafolios
      const portIds = portafolios.map((p) => p.id);
      await Promise.allSettled(portIds.map((id) => fetchPosiciones(id)));
    } catch {
      // Continuar aunque falle la carga de portafolios
    }
  }, [portafolios, fetchPortafolios, fetchPosiciones]);

  /**
   * Efecto: cargar portafolios al montar.
   */
  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Efecto: cuando cambian las posiciones, extraer tickers y cargar noticias.
   */
  useEffect(() => {
    const tickersActivos = obtenerTickersActivos();
    setTickers(tickersActivos);

    if (tickersActivos.length === 0) {
      setNoticias([]);
      setSemaforos({});
      setLoading(false);
      return;
    }

    let cancelado = false;

    const cargarNoticias = async () => {
      try {
        const resultados = await Promise.allSettled(
          tickersActivos.map((t) => fetchTickerData(t))
        );

        if (cancelado) return;

        const nuevosSemaforos = {};
        const nuevasNoticias = [];

        for (const res of resultados) {
          if (res.status === 'fulfilled') {
            const { ticker, semaforo, noticias: noticiasTicker } = res.value;
            if (semaforo) {
              nuevosSemaforos[ticker] = semaforo;
            }
            for (const n of noticiasTicker) {
              nuevasNoticias.push({ ...n, ticker });
            }
          }
        }

        // Ordenar noticias por fecha descendente
        nuevasNoticias.sort(
          (a, b) =>
            new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0)
        );

        setSemaforos(nuevosSemaforos);
        setNoticias(nuevasNoticias);
      } catch (err) {
        if (!cancelado) {
          setError(err.message || 'Error al cargar noticias.');
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargarNoticias();

    return () => {
      cancelado = true;
    };
  }, [posiciones, obtenerTickersActivos, fetchTickerData]);

  /**
   * Forzar actualización de noticias.
   */
  const handleActualizar = async () => {
    setActualizando(true);
    setError(null);
    try {
      const res = await fetch('/api/noticias/actualizar', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar noticias');
      }

      // Recargar datos tras actualización
      const tickersActivos = obtenerTickersActivos();
      const resultados = await Promise.allSettled(
        tickersActivos.map((t) => fetchTickerData(t))
      );

      const nuevosSemaforos = {};
      const nuevasNoticias = [];

      for (const res of resultados) {
        if (res.status === 'fulfilled') {
          const { ticker, semaforo, noticias: noticiasTicker } = res.value;
          if (semaforo) nuevosSemaforos[ticker] = semaforo;
          for (const n of noticiasTicker) {
            nuevasNoticias.push({ ...n, ticker });
          }
        }
      }

      nuevasNoticias.sort(
        (a, b) =>
          new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0)
      );

      setSemaforos(nuevosSemaforos);
      setNoticias(nuevasNoticias);
    } catch (err) {
      setError(err.message || 'Error al actualizar noticias.');
    } finally {
      setActualizando(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-bloomberg-text">
          Noticias y Sentimiento
        </h1>
        <button
          onClick={handleActualizar}
          disabled={actualizando || loading}
          className="px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                     hover:bg-bloomberg-accent/80 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          aria-label="Forzar actualización de noticias"
        >
          {actualizando ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Actualizando...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Actualizar Noticias
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <ErrorMessage
          mensaje={error}
          onReintentar={() => {
            setError(null);
            setLoading(true);
            cargarDatos();
          }}
        />
      )}

      {/* Loading */}
      {loading ? (
        <Spinner mensaje="Cargando noticias y semáforos..." />
      ) : (
        <>
          {/* Panel de semáforos */}
          <SemaforoPanel semaforos={semaforos} />

          {/* Feed de noticias */}
          <div>
            <h2 className="text-lg font-semibold text-bloomberg-text mb-3">
              Últimas Noticias
            </h2>
            <NewsFeed noticias={noticias} tickers={tickers} />
          </div>
        </>
      )}
    </div>
  );
}

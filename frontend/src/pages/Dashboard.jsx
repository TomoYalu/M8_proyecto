import { useEffect, useState, useMemo, useCallback } from 'react';
import useStore from '../store/index';
import Spinner from '../components/common/Spinner';
import ErrorMessage from '../components/common/ErrorMessage';
import WidgetGrid from '../components/widgets/WidgetGrid';
import PresetSelector from '../components/widgets/PresetSelector';

// Chart widgets
import CandlestickChart from '../components/charts/CandlestickChart';
import MACDChart from '../components/charts/MACDChart';
import RSIChart from '../components/charts/RSIChart';
import StochasticChart from '../components/charts/StochasticChart';
import BollingerChart from '../components/charts/BollingerChart';
import VolumeChart from '../components/charts/VolumeChart';
import EfficientFrontierChart from '../components/charts/EfficientFrontierChart';

// Portfolio widgets
import PositionTable from '../components/portfolio/PositionTable';
import ConsolidatedView from '../components/portfolio/ConsolidatedView';

// News widgets
import SemaforoPanel from '../components/news/SemaforoPanel';

/**
 * Dashboard — Vista principal con widgets configurables.
 *
 * Al montar:
 *   1. Obtiene configuración de widgets desde /api/widgets/config
 *   2. Obtiene datos de análisis para el ticker activo (default AAPL)
 *   3. Obtiene datos de portafolio (consolidado + posiciones)
 *   4. Obtiene semáforos de noticias para tickers del portafolio
 *
 * Si no existe configuración previa, el backend aplica preset "completo".
 *
 * Requisitos cubiertos: 5.1–5.6, 12.1–12.7
 */
export default function Dashboard() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [semaforos, setSemaforos] = useState({});
  const [frontierData, setFrontierData] = useState(null);

  // Widget store
  const fetchWidgetConfig = useStore((s) => s.fetchWidgetConfig);
  const widgetConfig = useStore((s) => s.widgetConfig);

  // Analysis store
  const tickerActivo = useStore((s) => s.tickerActivo);
  const analisisData = useStore((s) => s.analisisData);
  const fetchAnalisis = useStore((s) => s.fetchAnalisis);

  // Portfolio store
  const portafolios = useStore((s) => s.portafolios);
  const consolidado = useStore((s) => s.consolidado);
  const posiciones = useStore((s) => s.posiciones);
  const preciosEnVivo = useStore((s) => s.preciosEnVivo);
  const fetchPortafolios = useStore((s) => s.fetchPortafolios);
  const fetchConsolidado = useStore((s) => s.fetchConsolidado);
  const fetchPosiciones = useStore((s) => s.fetchPosiciones);

  /**
   * Fetch semáforo data for all tickers across all portfolios.
   */
  const fetchSemaforos = useCallback(async (tickers) => {
    if (!tickers.length) return;
    const resultados = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const res = await fetch(`/api/noticias/${encodeURIComponent(ticker)}/semaforo`);
        if (!res.ok) return { ticker, data: null };
        const data = await res.json();
        return { ticker, data };
      })
    );
    const nuevos = {};
    for (const res of resultados) {
      if (res.status === 'fulfilled' && res.value.data) {
        nuevos[res.value.ticker] = res.value.data;
      }
    }
    setSemaforos(nuevos);
  }, []);

  // ── Initial data load ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function cargarDatos() {
      setInitialLoading(true);
      setError(null);

      try {
        // 1. Widget config (must come first — determines what to show)
        await fetchWidgetConfig().catch(() => {
          // Non-fatal: widgets will use defaults
        });

        // 2. Parallel fetch: analysis + portfolio data
        const resultados = await Promise.allSettled([
          fetchAnalisis(tickerActivo).catch(() => null),
          fetchPortafolios().catch(() => []),
          fetchConsolidado().catch(() => null),
        ]);

        if (cancelled) return;

        // 3. Fetch posiciones for all portfolios
        const portafoliosData = resultados[1].status === 'fulfilled'
          ? resultados[1].value
          : [];

        if (portafoliosData?.length) {
          await Promise.allSettled(
            portafoliosData.map((p) => fetchPosiciones(p.id).catch(() => []))
          );
        }

        // 4. Collect all tickers from positions and fetch semáforos
        const allTickers = new Set();
        const posState = useStore.getState().posiciones;
        for (const pId of Object.keys(posState)) {
          for (const pos of posState[pId] || []) {
            if (pos.ticker) allTickers.add(pos.ticker);
          }
        }
        if (allTickers.size > 0) {
          await fetchSemaforos([...allTickers]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al cargar el dashboard');
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    }

    cargarDatos();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Collect all positions for the PositionTable widget ────────
  const allPositions = useMemo(() => {
    const result = [];
    for (const pId of Object.keys(posiciones)) {
      for (const pos of posiciones[pId] || []) {
        result.push(pos);
      }
    }
    return result;
  }, [posiciones]);

  // ── Build widget content map ──────────────────────────────────
  const widgetContent = useMemo(() => {
    const content = {};

    // Chart widgets — use analysis data for the active ticker
    content.candlestick = analisisData ? (
      <CandlestickChart datos={analisisData} />
    ) : (
      <EmptyState mensaje="Cargando datos de velas..." />
    );

    content.macd = analisisData ? (
      <MACDChart datos={analisisData} />
    ) : (
      <EmptyState mensaje="Cargando MACD..." />
    );

    content.rsi = analisisData ? (
      <RSIChart datos={analisisData} />
    ) : (
      <EmptyState mensaje="Cargando RSI..." />
    );

    content.stochastic = analisisData ? (
      <StochasticChart datos={analisisData} />
    ) : (
      <EmptyState mensaje="Cargando estocástico..." />
    );

    content.bollinger = analisisData ? (
      <BollingerChart datos={analisisData} />
    ) : (
      <EmptyState mensaje="Cargando Bollinger..." />
    );

    content.volume = analisisData ? (
      <VolumeChart datos={analisisData} />
    ) : (
      <EmptyState mensaje="Cargando volumen..." />
    );

    // Portfolio widgets
    content.posiciones = (
      <PositionTable posiciones={allPositions} preciosEnVivo={preciosEnVivo} />
    );

    content.pnl = (
      <ConsolidatedView consolidado={consolidado} />
    );

    // News widget
    content.semaforo = (
      <SemaforoPanel semaforos={semaforos} />
    );

    // Efficient frontier — needs separate data (optimization endpoint)
    content.frontier = frontierData ? (
      <EfficientFrontierChart datos={frontierData} />
    ) : (
      <EmptyState mensaje="Ejecute una optimización Markowitz desde Análisis para ver la frontera eficiente." />
    );

    return content;
  }, [analisisData, allPositions, preciosEnVivo, consolidado, semaforos, frontierData]);

  // ── Render ────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner mensaje="Cargando dashboard..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage mensaje={error} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header con ticker activo y preset selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-bloomberg-text">Dashboard</h1>
          <p className="text-sm text-bloomberg-text-muted">
            Ticker activo: <span className="font-medium text-bloomberg-accent">{tickerActivo}</span>
            {analisisData?.mercado === 'BMV' && (
              <span className="ml-2 text-xs text-bloomberg-yellow">(Delay 15 min)</span>
            )}
          </p>
        </div>
        <PresetSelector />
      </div>

      {/* Widget grid */}
      {Object.keys(widgetConfig).length > 0 ? (
        <WidgetGrid widgetContent={widgetContent} />
      ) : (
        <div className="text-center py-12 text-bloomberg-text-muted">
          <p>No hay widgets configurados. Seleccione un preset para comenzar.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Placeholder for widgets without data yet.
 */
function EmptyState({ mensaje }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px] text-bloomberg-text-muted text-sm text-center px-4">
      <p>{mensaje}</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useAnalysis from '../hooks/useAnalysis';
import Spinner from '../components/common/Spinner';
import ErrorMessage from '../components/common/ErrorMessage';
import TickerSearch from '../components/charts/TickerSearch';
import CandlestickChart from '../components/charts/CandlestickChart';
import MACDChart from '../components/charts/MACDChart';
import RSIChart from '../components/charts/RSIChart';
import StochasticChart from '../components/charts/StochasticChart';
import VolumeChart from '../components/charts/VolumeChart';
import InterpretationPanel from '../components/charts/InterpretationPanel';
import StopLossPanel from '../components/charts/StopLossPanel';
import FibonacciPanel from '../components/charts/FibonacciPanel';
import PatternTable from '../components/charts/PatternTable';
import ResizableChart from '../components/charts/ResizableChart';

const PERIODOS = [
  { value: '1mo', label: '1 Mes' },
  { value: '3mo', label: '3 Meses' },
  { value: '6mo', label: '6 Meses' },
  { value: '1y', label: '1 Año' },
  { value: '2y', label: '2 Años' },
  { value: '5y', label: '5 Años' },
];

const INTERVALOS = [
  { value: '1d', label: 'Diario' },
  { value: '1wk', label: 'Semanal' },
  { value: '1mo', label: 'Mensual' },
];

/**
 * Loading overlay for chart panels.
 */
function LoadingOverlay({ isLoading, children }) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-bloomberg-panel/60 backdrop-blur-[1px]
                        flex items-center justify-center rounded-lg z-10">
          <div className="w-5 h-5 border-2 border-bloomberg-accent/30
                          border-t-bloomberg-accent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export default function Analisis() {
  const [searchParams] = useSearchParams();
  const tickerFromUrl = searchParams.get('ticker');

  const {
    tickerActivo,
    analisisData,
    periodo,
    intervalo,
    isLoading,
    error,
    buscarAnalisis,
    setPeriodo,
    setIntervalo,
  } = useAnalysis();

  const [previousData, setPreviousData] = useState(null);

  useEffect(() => {
    if (analisisData && !isLoading) {
      setPreviousData(analisisData);
    }
  }, [analisisData, isLoading]);

  const displayData = analisisData || previousData;

  useEffect(() => {
    if (tickerFromUrl) {
      const ticker = tickerFromUrl.trim().toUpperCase();
      if (ticker && ticker !== tickerActivo) {
        buscarAnalisis(ticker).catch(() => {});
      }
    } else if (!analisisData && tickerActivo) {
      buscarAnalisis(tickerActivo).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerFromUrl]);

  const handleTickerSelect = (ticker) => buscarAnalisis(ticker).catch(() => {});
  const handlePeriodoChange = (e) => { const p = e.target.value; setPeriodo(p); buscarAnalisis(tickerActivo, p, intervalo).catch(() => {}); };
  const handleIntervaloChange = (e) => { const i = e.target.value; setIntervalo(i); buscarAnalisis(tickerActivo, periodo, i).catch(() => {}); };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <TickerSearch onSelect={handleTickerSelect} valorInicial={tickerFromUrl || tickerActivo} />

        <div className="flex items-center gap-2">
          <label htmlFor="periodo-select" className="text-sm text-bloomberg-text-muted">Período:</label>
          <select id="periodo-select" value={periodo} onChange={handlePeriodoChange}
            className="px-2 py-1.5 rounded-lg bg-bloomberg-bg border border-bloomberg-accent/30 text-bloomberg-text text-sm focus:outline-none focus:border-bloomberg-accent">
            {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="intervalo-select" className="text-sm text-bloomberg-text-muted">Intervalo:</label>
          <select id="intervalo-select" value={intervalo} onChange={handleIntervaloChange}
            className="px-2 py-1.5 rounded-lg bg-bloomberg-bg border border-bloomberg-accent/30 text-bloomberg-text text-sm focus:outline-none focus:border-bloomberg-accent">
            {INTERVALOS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        {displayData && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="font-semibold text-bloomberg-accent">{displayData.ticker}</span>
            {displayData.mercado === 'BMV' && (
              <span className="text-xs text-bloomberg-yellow bg-bloomberg-yellow/10 px-2 py-0.5 rounded">BMV — Delay 15 min</span>
            )}
            {displayData.resumen && (
              <span className="text-bloomberg-text font-mono">${displayData.resumen.precio_actual?.toFixed(2)}</span>
            )}
            {displayData.resumen?.cambio_pct != null && (
              <span className={`font-mono ${displayData.resumen.cambio_pct >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}`}>
                {displayData.resumen.cambio_pct >= 0 ? '+' : ''}{displayData.resumen.cambio_pct.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading && !displayData && <Spinner mensaje="Calculando indicadores técnicos..." />}

      {error && !isLoading && (
        <ErrorMessage mensaje={error} onReintentar={() => buscarAnalisis(tickerActivo).catch(() => {})} />
      )}

      {displayData && (
        <div className="space-y-4">
          {/* Interpretations panel — full width */}
          <LoadingOverlay isLoading={isLoading}>
            <InterpretationPanel datos={displayData} />
          </LoadingOverlay>

          {/* Main candlestick chart — resizable */}
          <LoadingOverlay isLoading={isLoading}>
            <ResizableChart defaultHeight={450}>
              <CandlestickChart datos={displayData} />
            </ResizableChart>
          </LoadingOverlay>

          {/* Secondary charts row — each resizable independently */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <LoadingOverlay isLoading={isLoading}>
              <ResizableChart defaultHeight={280}>
                <MACDChart datos={displayData} />
              </ResizableChart>
            </LoadingOverlay>
            <LoadingOverlay isLoading={isLoading}>
              <ResizableChart defaultHeight={280}>
                <RSIChart datos={displayData} />
              </ResizableChart>
            </LoadingOverlay>
            <LoadingOverlay isLoading={isLoading}>
              <ResizableChart defaultHeight={280}>
                <StochasticChart datos={displayData} />
              </ResizableChart>
            </LoadingOverlay>
            <LoadingOverlay isLoading={isLoading}>
              <ResizableChart defaultHeight={280}>
                <VolumeChart datos={displayData} />
              </ResizableChart>
            </LoadingOverlay>
          </div>

          {/* Info panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LoadingOverlay isLoading={isLoading}>
              <div className="space-y-4">
                <StopLossPanel datos={displayData} />
                <FibonacciPanel datos={displayData} />
              </div>
            </LoadingOverlay>
            <LoadingOverlay isLoading={isLoading}>
              <PatternTable datos={displayData} />
            </LoadingOverlay>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import Plot from 'react-plotly.js';
import PositionTable from './PositionTable';
import TransactionHistory from './TransactionHistory';
import TickerQuickSearch from './TickerQuickSearch';
import Spinner from '../common/Spinner';
import OptimizerResults from '../optimizer/OptimizerResults';
import useOptimizer from '../../hooks/useOptimizer';
import { formatMoneda, formatPorcentaje } from '../../utils/formatters';
import { BLOOMBERG_ACCENT } from '../../utils/colors';

/**
 * Panel derecho con el detalle del portafolio seleccionado.
 * Incluye header con nombre y acciones, tarjetas de resumen,
 * sparkline de valor histórico, y tabs "Posiciones" | "Transacciones" | "Análisis".
 *
 * @param {object} props
 * @param {object} props.portafolio - Portafolio seleccionado
 * @param {Array} props.posiciones - Posiciones del portafolio
 * @param {object} props.transacciones - Datos paginados de transacciones
 * @param {object} [props.preciosEnVivo] - Precios en tiempo real
 * @param {boolean} [props.loading] - Estado de carga
 * @param {function} props.onEditar - Callback para editar portafolio
 * @param {function} props.onEliminar - Callback para eliminar portafolio
 * @param {function} props.onRegistrarTransaccion - Callback para abrir modal de transacción
 * @param {function} props.onCambiarPagina - Callback para paginación de transacciones
 * @param {function} [props.onAgregarTicker] - Callback cuando el usuario quiere agregar un ticker desde búsqueda rápida
 * @param {function} [props.onOptimizar] - Callback para optimizar el portafolio con Markowitz
 * @param {function} [props.onEditarPosicion] - Callback para editar una posición (abre TransactionForm pre-llenado)
 * @param {function} [props.onTransaccionActualizada] - Callback cuando una transacción pendiente se confirma/cancela
 *
 * Requisitos cubiertos: 1.1–1.5, 2.6, 3.1–3.7, 9.1–9.5, 10.1–10.4, 12.1, 12.2, 12.4, 12.5, 12.7, plan-v1.1 B2
 */
const PERFILES = {
  conservador: { label: '🟢 Conservador', max_peso: 0.25, desc: 'Máximo 25% por activo' },
  moderado: { label: '🟡 Moderado', max_peso: null, desc: 'Sin restricción de peso' },
  agresivo: { label: '🔴 Agresivo', max_peso: 0.50, desc: 'Hasta 50% en un solo activo' },
};

export default function PortfolioDetail({
  portafolio,
  posiciones,
  transacciones,
  preciosEnVivo = {},
  loading = false,
  onEditar,
  onEliminar,
  onRegistrarTransaccion,
  onCambiarPagina,
  onAgregarTicker,
  onEditarPosicion,
  onTransaccionActualizada,
}) {
  const [tabActiva, setTabActiva] = useState('posiciones');

  // ─── Análisis tab: optimizer cache (Req 9.5) ─────────────────
  const [analisisCache, setAnalisisCache] = useState(null);
  const [analisisExecuted, setAnalisisExecuted] = useState(false);
  const [perfilAnalisis, setPerfilAnalisis] = useState('moderado');
  const [aplicando, setAplicando] = useState(false);
  const [aplicadoMsg, setAplicadoMsg] = useState(null);
  const {
    ejecutarOptimizacion,
    cargandoOptimizacion,
    errorOptimizacion,
    resultadoOptimizacion,
    limpiarResultados,
  } = useOptimizer();

  // Tickers del portafolio para optimización (incluye pool con cantidad 0)
  const tickersActivos = (posiciones || [])
    .filter((p) => p.ticker)
    .map((p) => p.ticker);

  // Auto-execute optimization when Análisis tab is selected (Req 9.2)
  useEffect(() => {
    if (tabActiva !== 'analisis') return;
    if (analisisCache) return;
    if (tickersActivos.length < 2) return;
    if (cargandoOptimizacion) return;

    const perfil = PERFILES[perfilAnalisis] || PERFILES.moderado;
    ejecutarOptimizacion({
      tickers: tickersActivos,
      portafolio_id: portafolio.id,
      max_peso: perfil.max_peso,
    })
      .then((data) => {
        setAnalisisCache(data);
        setAnalisisExecuted(true);
      })
      .catch(() => {
        setAnalisisExecuted(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, perfilAnalisis]);

  // Reset cache when portfolio changes
  useEffect(() => {
    setAnalisisCache(null);
    setAnalisisExecuted(false);
    setAplicadoMsg(null);
    limpiarResultados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portafolio.id]);

  // Resolve the data to show: cached first, then store result
  const analisisData = analisisCache || resultadoOptimizacion;

  // Aplicar optimización al portafolio
  const handleAplicar = useCallback(async () => {
    if (!portafolio?.id || !analisisData?.max_sharpe?.acciones) return;
    setAplicando(true);
    setAplicadoMsg(null);
    try {
      const acciones = {};
      const tickers = analisisData.tickers || [];
      const maxSharpe = analisisData.max_sharpe;
      const pesosActuales = analisisData.pesos_actuales;

      tickers.forEach((ticker) => {
        const objetivo = maxSharpe.acciones?.[ticker] || 0;
        let actual = 0;
        if (pesosActuales?.pesos_actuales) {
          const precio = analisisData.estadisticas?.[ticker]?.precio || 0;
          if (precio > 0) {
            const pesoActual = (pesosActuales.pesos_actuales[ticker] || 0) / 100;
            const valorTotal = Object.values(maxSharpe.monto || {}).reduce((s, v) => s + v, 0);
            actual = Math.floor(pesoActual * valorTotal / precio);
          }
        }
        if (objetivo !== actual) {
          acciones[ticker] = {
            cantidad_objetivo: objetivo,
            cantidad_actual: actual,
            precio: analisisData.estadisticas?.[ticker]?.precio || 0,
            moneda: 'USD',
          };
        }
      });

      if (Object.keys(acciones).length === 0) {
        setAplicadoMsg('El portafolio ya está alineado con la optimización.');
        return;
      }

      const res = await fetch(`/api/portafolios/${portafolio.id}/aplicar-optimizacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acciones }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar');
      setAplicadoMsg(`\u2713 ${data.mensaje}`);
      onTransaccionActualizada?.();
    } catch (err) {
      setAplicadoMsg(`Error: ${err.message}`);
    } finally {
      setAplicando(false);
    }
  }, [portafolio?.id, analisisData]);

  const tabs = [
    { id: 'posiciones', label: 'Posiciones' },
    { id: 'transacciones', label: 'Transacciones' },
    { id: 'analisis', label: 'Análisis' },
  ];

  return (
    <section
      className="flex-1 min-w-0 flex flex-col bg-bloomberg-panel rounded-xl
                 border border-white/5 overflow-hidden"
      aria-label={`Detalle de ${portafolio.nombre}`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <h2 className="text-lg font-semibold text-bloomberg-text truncate">
            {portafolio.nombre}
          </h2>

          <div className="flex items-center gap-2 shrink-0">

          {/* Agregar Activo */}
          <button
            onClick={onRegistrarTransaccion}
            className="px-3 py-1.5 text-xs rounded-lg bg-bloomberg-green/20 text-bloomberg-green
                       hover:bg-bloomberg-green/30 transition-colors flex items-center gap-1.5"
            aria-label="Agregar nuevo activo"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Activo
          </button>

          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Editar */}
          <button
            onClick={() => onEditar(portafolio)}
            className="p-1.5 rounded-lg text-bloomberg-text-muted
                       hover:text-bloomberg-accent hover:bg-white/5 transition-colors"
            aria-label={`Editar portafolio ${portafolio.nombre}`}
            title="Editar"
          >
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          {/* Eliminar */}
          <button
            onClick={() => onEliminar(portafolio.id)}
            className="p-1.5 rounded-lg text-bloomberg-text-muted
                       hover:text-bloomberg-red hover:bg-white/5 transition-colors"
            aria-label={`Eliminar portafolio ${portafolio.nombre}`}
            title="Eliminar"
          >
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Búsqueda rápida de tickers (B2) */}
      <div className="px-5 py-3 border-b border-white/5 shrink-0">
        <TickerQuickSearch onAgregar={onAgregarTicker} />
      </div>

      {/* Tarjetas de resumen (Req 10.1–10.4) */}
      <SummaryCards
        posiciones={posiciones}
        analisisData={analisisData}
        moneda={portafolio.moneda}
        preciosEnVivo={preciosEnVivo}
      />

      {/* Sparkline de valor histórico (Req 12.1, 12.2, 12.4, 12.5) */}
      <Sparkline portafolioId={portafolio.id} />

      {/* Tabs */}
      <div className="px-5 border-b border-white/5 shrink-0" role="tablist" aria-label="Secciones del portafolio">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={tabActiva === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setTabActiva(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative
                ${tabActiva === tab.id
                  ? 'text-bloomberg-accent'
                  : 'text-bloomberg-text-muted hover:text-bloomberg-text'
                }`}
            >
              {tab.label}
              {tabActiva === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-bloomberg-accent rounded-full"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido del tab */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <Spinner mensaje={tabActiva === 'posiciones' ? 'Cargando posiciones...' : 'Cargando transacciones...'} size="sm" />
        ) : (
          <>
            {/* Panel Posiciones */}
            <div
              id="panel-posiciones"
              role="tabpanel"
              aria-labelledby="tab-posiciones"
              hidden={tabActiva !== 'posiciones'}
            >
              {tabActiva === 'posiciones' && (
                <PositionTable posiciones={posiciones} preciosEnVivo={preciosEnVivo} onEditarPosicion={onEditarPosicion} />
              )}
            </div>

            {/* Panel Transacciones */}
            <div
              id="panel-transacciones"
              role="tabpanel"
              aria-labelledby="tab-transacciones"
              hidden={tabActiva !== 'transacciones'}
            >
              {tabActiva === 'transacciones' && (
                <TransactionHistory
                  datos={transacciones}
                  onCambiarPagina={onCambiarPagina}
                  loading={loading}
                  portafolioId={portafolio.id}
                  onTransaccionActualizada={onTransaccionActualizada}
                />
              )}
            </div>

            {/* Panel Análisis (Req 9.1–9.5) */}
            <div
              id="panel-analisis"
              role="tabpanel"
              aria-labelledby="tab-analisis"
              hidden={tabActiva !== 'analisis'}
            >
              {tabActiva === 'analisis' && (
                <>
                {/* Selector de perfil */}
                <div className="flex items-center gap-2 mb-4">
                  {Object.entries(PERFILES).map(([key, p]) => (
                    <button
                      key={key}
                      onClick={() => { setPerfilAnalisis(key); setAnalisisCache(null); limpiarResultados(); }}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        perfilAnalisis === key
                          ? 'bg-bloomberg-accent/20 border-bloomberg-accent/40 text-bloomberg-accent'
                          : 'bg-white/5 border-white/10 text-bloomberg-text-muted hover:bg-white/10'
                      }`}
                      title={p.desc}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Aplicar al portafolio */}
                {analisisData?.max_sharpe && (
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-bloomberg-panel border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-bloomberg-text-muted">
                        Genera transacciones pendientes para alinear los pesos.
                      </p>
                      {aplicadoMsg && (
                        <p className={`text-xs mt-1 ${aplicadoMsg.startsWith('Error') ? 'text-bloomberg-red' : 'text-bloomberg-green'}`}>
                          {aplicadoMsg}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleAplicar}
                      disabled={aplicando}
                      className="px-3 py-1.5 text-xs rounded-lg bg-bloomberg-accent text-white
                                 hover:bg-bloomberg-accent/80 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {aplicando ? 'Aplicando...' : '📊 Aplicar al portafolio'}
                    </button>
                  </div>
                )}
                <AnalisisPanel
                  tickersActivos={tickersActivos}
                  analisisData={analisisData}
                  cargando={cargandoOptimizacion}
                  error={errorOptimizacion}
                  portafolioId={portafolio.id}
                />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}


// ─── Helper: Calculate daily P&L (Req 10.4) ────────────────────
// Formula: Σ (precio_actual × cambio_pct / (100 + cambio_pct)) × cantidad
function calcularPnlDiario(posiciones, preciosEnVivo) {
  if (!posiciones || posiciones.length === 0) return null;

  let total = 0;
  let hayDatos = false;

  for (const pos of posiciones) {
    if (pos.cantidad <= 0) continue;
    const precioActual = pos.precio_actual;
    if (!precioActual || precioActual <= 0) continue;

    // Get cambio_pct from live prices or position data
    const live = preciosEnVivo?.[pos.ticker];
    const cambioPct = live?.cambio_pct ?? pos.cambio_pct;
    if (cambioPct == null || isNaN(cambioPct)) continue;

    hayDatos = true;
    // (precio_actual × cambio_pct / (100 + cambio_pct)) × cantidad
    const denominador = 100 + cambioPct;
    if (denominador === 0) continue;
    total += (precioActual * cambioPct / denominador) * pos.cantidad;
  }

  return hayDatos ? total : null;
}

// ─── Helper: Sharpe risk traffic light (Req 10.2) ──────────────
export function getSemaforoRiesgo(sharpe) {
  if (sharpe == null || isNaN(sharpe)) return null;
  if (sharpe > 1) return 'verde';
  if (sharpe >= 0.5) return 'amarillo';
  return 'rojo';
}

const SEMAFORO_COLORS = {
  verde: 'bg-bloomberg-green',
  amarillo: 'bg-bloomberg-yellow',
  rojo: 'bg-bloomberg-red',
};

const SEMAFORO_LABELS = {
  verde: 'Riesgo bajo',
  amarillo: 'Riesgo moderado',
  rojo: 'Riesgo alto',
};

// ─── Summary Cards (Req 10.1–10.4) ─────────────────────────────
function SummaryCards({ posiciones, analisisData, moneda = 'USD', preciosEnVivo }) {
  // Valor total from positions
  const valorTotal = (posiciones || []).reduce((sum, p) => {
    if (p.cantidad > 0 && p.precio_actual && p.precio_actual > 0) {
      return sum + (p.valor_mercado || p.precio_actual * p.cantidad);
    }
    return sum;
  }, 0);

  // P&L diario (Req 10.4)
  const pnlDiario = calcularPnlDiario(posiciones, preciosEnVivo);
  const pnlDiarioPct = valorTotal > 0 && pnlDiario != null
    ? (pnlDiario / (valorTotal - pnlDiario)) * 100
    : null;

  // Optimization-dependent metrics (Req 10.3: show "—" when not available)
  const maxSharpe = analisisData?.max_sharpe;
  const retornoProyectado = maxSharpe?.rendimiento != null ? maxSharpe.rendimiento * 100 : null;
  const varDiario = maxSharpe?.riesgo != null
    ? (maxSharpe.riesgo / Math.sqrt(252)) * 2.326 * 100 // VaR 99% daily
    : null;
  const sharpe = maxSharpe?.sharpe ?? null;
  const semaforo = getSemaforoRiesgo(sharpe);

  const cards = [
    {
      label: 'Valor Total',
      value: valorTotal > 0 ? formatMoneda(valorTotal, moneda) : '—',
    },
    {
      label: 'P&L Diario',
      value: pnlDiario != null ? formatMoneda(pnlDiario, moneda) : '—',
      sub: pnlDiarioPct != null ? formatPorcentaje(pnlDiarioPct) : null,
      color: pnlDiario != null ? (pnlDiario >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red') : '',
    },
    {
      label: 'Retorno Proyectado',
      value: retornoProyectado != null ? formatPorcentaje(retornoProyectado) : '—',
      sub: 'anual',
    },
    {
      label: 'VaR Diario (99%)',
      value: varDiario != null ? formatPorcentaje(-varDiario) : '—',
    },
  ];

  return (
    <div className="px-5 py-3 border-b border-white/5 shrink-0">
      <div className="flex items-center gap-3 flex-wrap">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex-1 min-w-[120px] bg-bloomberg-bg/50 rounded-lg px-3 py-2 border border-white/5"
          >
            <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted mb-0.5">
              {card.label}
            </p>
            <p className={`text-sm font-semibold ${card.color || 'text-bloomberg-text'}`}>
              {card.value}
            </p>
            {card.sub && (
              <p className="text-[10px] text-bloomberg-text-muted">{card.sub}</p>
            )}
          </div>
        ))}

        {/* Semáforo de riesgo (Req 10.2) — hidden when no data (Req 10.3) */}
        {semaforo && (
          <div
            className="flex items-center gap-1.5 bg-bloomberg-bg/50 rounded-lg px-3 py-2 border border-white/5"
            title={`Sharpe Ratio: ${sharpe?.toFixed(2)}`}
            aria-label={SEMAFORO_LABELS[semaforo]}
          >
            <span
              className={`w-3 h-3 rounded-full ${SEMAFORO_COLORS[semaforo]}`}
              aria-hidden="true"
            />
            <span className="text-[10px] text-bloomberg-text-muted">
              {SEMAFORO_LABELS[semaforo]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Sparkline Component (Req 12.1, 12.2, 12.4, 12.5) ─────────
function Sparkline({ portafolioId }) {
  const [rango, setRango] = useState('30d');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const prevPortafolioId = useRef(portafolioId);

  // Reset when portfolio changes
  useEffect(() => {
    if (prevPortafolioId.current !== portafolioId) {
      setDatos(null);
      setError(null);
      prevPortafolioId.current = portafolioId;
    }
  }, [portafolioId]);

  // Fetch historical data
  useEffect(() => {
    if (!portafolioId) return;
    let cancelled = false;

    const fetchHistorico = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await fetch(`/api/portafolios/${portafolioId}/historico?rango=${rango}`);
        if (!res.ok) throw new Error('Error al obtener historial');
        const data = await res.json();
        if (!cancelled) setDatos(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setCargando(false);
      }
    };

    fetchHistorico();
    return () => { cancelled = true; };
  }, [portafolioId, rango]);

  const rangos = [
    { id: '30d', label: '30d' },
    { id: '3m', label: '3m' },
    { id: '1y', label: '1y' },
  ];

  // Don't render if error (Req: Error en endpoint historico → ocultar sparkline)
  if (error) return null;

  const tieneDatos = datos?.fechas?.length >= 2;

  return (
    <div className="px-5 py-2 border-b border-white/5 shrink-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted">
          Valor Histórico
        </p>
        <div className="flex gap-1">
          {rangos.map((r) => (
            <button
              key={r.id}
              onClick={() => setRango(r.id)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors
                ${rango === r.id
                  ? 'bg-bloomberg-accent/20 text-bloomberg-accent'
                  : 'text-bloomberg-text-muted hover:text-bloomberg-text'
                }`}
              aria-label={`Rango ${r.label}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="h-[60px] flex items-center justify-center">
          <div className="w-4 h-4 border-2 rounded-full border-bloomberg-accent border-t-transparent animate-spin" />
        </div>
      ) : !tieneDatos ? (
        <p className="text-[11px] text-bloomberg-text-muted py-2">
          Se requiere más historial para generar el gráfico.
        </p>
      ) : (
        <div aria-label="Sparkline de valor histórico del portafolio">
          <Plot
            data={[
              {
                x: datos.fechas,
                y: datos.valores,
                type: 'scatter',
                mode: 'lines',
                line: { color: BLOOMBERG_ACCENT, width: 1.5 },
                fill: 'tozeroy',
                fillcolor: 'rgba(59,130,246,0.08)',
                hovertemplate: '%{x}<br>$%{y:,.2f}<extra></extra>',
              },
            ]}
            layout={{
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { t: 4, r: 8, b: 4, l: 8 },
              xaxis: {
                visible: false,
                showgrid: false,
              },
              yaxis: {
                visible: false,
                showgrid: false,
              },
              hovermode: 'x',
              height: 60,
            }}
            config={{
              responsive: true,
              displayModeBar: false,
              staticPlot: false,
            }}
            useResizeHandler
            style={{ width: '100%', height: 60 }}
          />
        </div>
      )}
    </div>
  );
}


// ─── Análisis Panel (Req 9.1–9.5) ──────────────────────────────
function AnalisisPanel({ tickersActivos, analisisData, cargando, error, portafolioId }) {
  // Less than 2 active positions (Req 9.3)
  if (tickersActivos.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-bloomberg-text-muted mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm text-bloomberg-text-muted">
          Se requieren al menos 2 activos con posiciones activas para ejecutar el análisis de optimización.
        </p>
        <p className="text-xs text-bloomberg-text-muted mt-1">
          Actualmente hay {tickersActivos.length} posición{tickersActivos.length !== 1 ? 'es' : ''} activa{tickersActivos.length !== 1 ? 's' : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OptimizerResults
        resultado={analisisData}
        cargando={cargando}
        error={error}
        portafolioId={portafolioId}
      />
    </div>
  );

}

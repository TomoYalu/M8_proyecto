/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Wizard Ciclo Económico
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useEffect, useCallback } from 'react';
import RiskProfileForm from '../components/wizard/RiskProfileForm';
import CycleStageCard from '../components/wizard/CycleStageCard';
import SectorRotationMap from '../components/wizard/SectorRotationMap';
import FundamentalFilterTable from '../components/wizard/FundamentalFilterTable';
import AllocationChart from '../components/wizard/AllocationChart';
import ErrorMessage from '../components/common/ErrorMessage';
import Modal from '../components/common/Modal';
import Badge from '../components/common/Badge';
import Tooltip from '../components/common/Tooltip';
import useStore from '../store';
import { INDICES } from '../constants/tickers';
import { formatMoneda } from '../utils/formatters';

/**
 * Página "Portafolio Automático" — Pipeline automático de inversión.
 *
 * Fase 1 (Input): Cuestionario de riesgo + capital inicial + botón "Generar Portafolio"
 * Fase 2 (Resultados): Vista vertical con fases expandibles, asset allocation,
 *                       y pool de tickers recomendados.
 *
 * Valida: plan-v1.1 C1–C5, Requisitos 7.1–7.5
 */

// ── Pipeline phase definitions ──────────────────────────────────
const PIPELINE_PHASES = [
  { key: 'perfil', label: 'Calculando perfil de riesgo...' },
  { key: 'ciclo', label: 'Analizando ciclo económico...' },
  { key: 'sectores', label: 'Identificando sectores favorecidos...' },
  { key: 'fundamentales', label: 'Aplicando filtro fundamental...' },
  { key: 'tecnicos', label: 'Aplicando filtro técnico...' },
  { key: 'allocation', label: 'Generando asset allocation...' },
];

// ── Tooltip descriptions for each phase ─────────────────────────
const PHASE_TOOLTIPS = {
  perfil:
    'El perfil de riesgo determina qué tan agresiva o conservadora será la estrategia. Se basa en su horizonte, tolerancia a pérdidas y experiencia.',
  ciclo:
    'El ciclo económico (expansión, pico, recesión, recuperación) indica qué sectores tienden a tener mejor desempeño en cada fase.',
  sectores:
    'La rotación sectorial identifica los sectores que históricamente se benefician más en la fase actual del ciclo económico.',
  fundamentales:
    'El filtro fundamental selecciona empresas financieramente sólidas: ROE > 15%, ROA > 5%, D/E < 1.5 y P/E razonable.',
  tecnicos:
    'El filtro técnico confirma que el precio está en tendencia alcista (sobre SMA 200) y no está sobrecomprado ni sobrevendido (RSI 40-60).',
};

// ── Metric tooltips for ticker cards ────────────────────────────
const METRIC_TOOLTIPS = {
  precio: 'Último precio de cierre del activo en el mercado.',
  sma200: 'Promedio móvil de 200 días. Si el precio está por encima, la tendencia es alcista.',
  rsi: 'Índice de Fuerza Relativa (0-100). Menor a 30 = sobreventa, mayor a 70 = sobrecompra. Zona ideal: 40-60.',
  pe: 'Relación Precio/Utilidad. Indica cuántos años de ganancias actuales se pagan por la acción. Menor = más barato.',
};

// ── Helper: find indices for a ticker ───────────────────────────
function getTickerIndices(symbol) {
  const found = [];
  for (const [indexName, indexData] of Object.entries(INDICES)) {
    if (indexData.tickers.includes(symbol)) {
      found.push(indexName);
    }
  }
  return found;
}

// ── QuestionIcon component ──────────────────────────────────────
function QuestionIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// ── StarIcon component ──────────────────────────────────────────
function StarIcon({ filled }) {
  return filled ? (
    <svg className="w-5 h-5 text-bloomberg-yellow" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ) : (
    <svg className="w-5 h-5 text-bloomberg-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

// ── ChevronIcon component ───────────────────────────────────────
function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── CollapsiblePhase component ──────────────────────────────────
function CollapsiblePhase({ title, phaseNumber, tooltipText, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-bloomberg-panel rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
        aria-expanded={open}
        aria-controls={`phase-content-${phaseNumber}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-bloomberg-accent/15 text-bloomberg-accent text-xs font-bold">
            {phaseNumber}
          </span>
          <h3 className="text-bloomberg-text font-semibold text-sm">{title}</h3>
          {tooltipText && (
            <Tooltip texto={tooltipText}>
              <span
                className="text-bloomberg-text-muted hover:text-bloomberg-accent transition-colors"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Información sobre ${title}`}
              >
                <QuestionIcon />
              </span>
            </Tooltip>
          )}
        </div>
        <span className="text-bloomberg-text-muted">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div id={`phase-content-${phaseNumber}`} className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Enhanced TickerCard with tooltips, index badge, checkbox, favorite ──
function EnhancedTickerCard({ ticker, fundamentalData, selected, onToggleSelect, onAgregar, onToggleFavorito, esFavorito }) {
  if (!ticker) return null;

  const { ticker: symbol, precio, sma200, rsi, nombre, sector, pe } = {
    ...ticker,
    nombre: fundamentalData?.nombre || ticker.nombre,
    sector: fundamentalData?.sector || ticker.sector,
    pe: fundamentalData?.pe || ticker.pe,
  };

  const indices = getTickerIndices(symbol);

  function getRsiVariante(rsi) {
    if (rsi == null) return 'azul';
    if (rsi > 60) return 'amarillo';
    if (rsi < 40) return 'amarillo';
    return 'verde';
  }

  return (
    <div
      className={`bg-bloomberg-panel rounded-xl border p-5 space-y-4 transition-colors ${
        selected ? 'border-bloomberg-accent/50 bg-bloomberg-accent/5' : 'border-white/10 hover:border-bloomberg-accent/30'
      }`}
      role="article"
      aria-label={`Ticker ${symbol}`}
    >
      {/* Header with checkbox, ticker, favorite */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(symbol)}
            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-bloomberg-accent
                       focus:ring-bloomberg-accent focus:ring-offset-0 cursor-pointer"
            aria-label={`Seleccionar ${symbol}`}
          />
          <div>
            <h4 className="text-bloomberg-accent font-mono font-bold text-lg">{symbol}</h4>
            {nombre && <p className="text-sm text-bloomberg-text-muted mt-0.5">{nombre}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sector && <Badge texto={sector} variante="azul" />}
          <button
            onClick={() => onToggleFavorito(symbol)}
            className="p-1 hover:bg-white/5 rounded transition-colors"
            aria-label={esFavorito ? `Quitar ${symbol} de favoritos` : `Agregar ${symbol} a favoritos`}
          >
            <StarIcon filled={esFavorito} />
          </button>
        </div>
      </div>

      {/* Index badges */}
      {indices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {indices.map((idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs
                         bg-white/5 text-bloomberg-text-muted border border-white/10"
            >
              {idx}
            </span>
          ))}
        </div>
      )}

      {/* Metrics with tooltips */}
      <div className="grid grid-cols-2 gap-3">
        <MetricBox label="Precio Actual" tooltip={METRIC_TOOLTIPS.precio} value={precio != null ? formatMoneda(precio) : '—'} />
        <MetricBox label="SMA 200" tooltip={METRIC_TOOLTIPS.sma200} value={sma200 != null ? formatMoneda(sma200) : '—'} />
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-xs text-bloomberg-text-muted">RSI (14)</p>
            <Tooltip texto={METRIC_TOOLTIPS.rsi}>
              <span className="text-bloomberg-text-muted hover:text-bloomberg-accent transition-colors cursor-help">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </Tooltip>
          </div>
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold text-bloomberg-text">
              {rsi != null ? rsi.toFixed(1) : '—'}
            </span>
            {rsi != null && (
              <Badge
                texto={rsi > 60 ? 'Alto' : rsi < 40 ? 'Bajo' : 'Neutral'}
                variante={getRsiVariante(rsi)}
              />
            )}
          </span>
        </div>
        {pe != null && (
          <MetricBox label="P/E" tooltip={METRIC_TOOLTIPS.pe} value={pe.toFixed(1)} />
        )}
      </div>

      {/* Add to portfolio button */}
      <button
        onClick={() => onAgregar({ ...ticker, nombre, sector, pe })}
        className="w-full py-2.5 rounded-lg bg-bloomberg-accent text-white text-sm
                   font-medium hover:bg-bloomberg-accent/80 transition-colors"
        aria-label={`Agregar ${symbol} a portafolio`}
      >
        Agregar a Portafolio
      </button>
    </div>
  );
}

function MetricBox({ label, tooltip, value }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-bloomberg-text-muted">{label}</p>
        <Tooltip texto={tooltip}>
          <span className="text-bloomberg-text-muted hover:text-bloomberg-accent transition-colors cursor-help">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </Tooltip>
      </div>
      <p className="text-base font-semibold text-bloomberg-text">{value}</p>
    </div>
  );
}

// ── ProgressBar component ───────────────────────────────────────
function PipelineProgressBar({ currentPhase, totalPhases, phaseLabel }) {
  const progress = ((currentPhase + 1) / totalPhases) * 100;

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="text-bloomberg-text font-medium">{phaseLabel}</span>
        <span className="text-bloomberg-text-muted">
          Fase {currentPhase + 1} de {totalPhases}
        </span>
      </div>
      <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-bloomberg-accent to-bloomberg-green rounded-full
                     transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del pipeline: ${Math.round(progress)}%`}
        />
      </div>
      {/* Phase dots */}
      <div className="flex justify-between px-1">
        {PIPELINE_PHASES.map((phase, idx) => (
          <div key={phase.key} className="flex flex-col items-center gap-1">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                idx < currentPhase
                  ? 'bg-bloomberg-green'
                  : idx === currentPhase
                    ? 'bg-bloomberg-accent animate-pulse'
                    : 'bg-white/10'
              }`}
              aria-hidden="true"
            />
            <span className="text-[10px] text-bloomberg-text-muted hidden sm:block">
              {phase.key.charAt(0).toUpperCase() + phase.key.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ── Main Wizard (Portafolio Automático) Component ───────────────
// ═══════════════════════════════════════════════════════════════════

export default function Wizard() {
  // ── Phase state ─────────────────────────────────────────────────
  const [phase, setPhase] = useState('input'); // 'input' | 'loading' | 'results'
  const [pipelinePhase, setPipelinePhase] = useState(0);

  // ── Input state ─────────────────────────────────────────────────
  const [capital, setCapital] = useState('');
  const [moneda, setMoneda] = useState('USD');

  // ── Pipeline results ────────────────────────────────────────────
  const [perfil, setPerfil] = useState(null);
  const [ciclo, setCiclo] = useState(null);
  const [sectores, setSectores] = useState(null);
  const [fundamentales, setFundamentales] = useState(null);
  const [tecnicos, setTecnicos] = useState(null);
  const [allocation, setAllocation] = useState(null);

  const [error, setError] = useState(null);

  // ── Ticker selection state ──────────────────────────────────────
  const [selectedTickers, setSelectedTickers] = useState(new Set());

  // ── Modal for adding to portfolio ───────────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tickerSeleccionado, setTickerSeleccionado] = useState(null);
  const [portafolioDestino, setPortafolioDestino] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState(null);

  // ── New portfolio modal ─────────────────────────────────────────
  const [modalNuevoPortafolio, setModalNuevoPortafolio] = useState(false);
  const [nombreNuevoPortafolio, setNombreNuevoPortafolio] = useState('');
  const [creandoPortafolio, setCreandoPortafolio] = useState(false);

  // ── Store ───────────────────────────────────────────────────────
  const portafolios = useStore((s) => s.portafolios);
  const fetchPortafolios = useStore((s) => s.fetchPortafolios);
  const favoritos = useStore((s) => s.favoritos);
  const toggleFavorito = useStore((s) => s.toggleFavorito);

  useEffect(() => {
    fetchPortafolios();
  }, [fetchPortafolios]);

  // ── RiskProfileForm callback (stores result, doesn't advance) ──
  const perfilRef = useState(null);
  const handlePerfilComplete = useCallback((resultado) => {
    perfilRef[1](resultado);
    setPerfil(resultado);
  }, [perfilRef]);

  // ── Pipeline execution ──────────────────────────────────────────
  const runPipeline = useCallback(async (perfilData) => {
    setPhase('loading');
    setError(null);
    setPipelinePhase(0);

    try {
      // Phase 0: Profile is already calculated by RiskProfileForm
      // We just set it
      setPipelinePhase(0);
      // Small delay to show the phase
      await new Promise((r) => setTimeout(r, 300));

      // Phase 1: Economic cycle
      setPipelinePhase(1);
      const cicloRes = await fetch('/api/wizard/ciclo');
      const cicloData = await cicloRes.json();
      if (!cicloRes.ok) throw new Error(cicloData.error || 'Error al obtener ciclo económico');
      setCiclo(cicloData);

      // Phase 2: Sector rotation
      setPipelinePhase(2);
      const sectoresRes = await fetch(`/api/wizard/sectores/${cicloData.fase}`);
      const sectoresData = await sectoresRes.json();
      if (!sectoresRes.ok) throw new Error(sectoresData.error || 'Error al obtener sectores');
      setSectores(sectoresData);

      // Phase 3: Fundamental filter
      setPipelinePhase(3);
      const fundRes = await fetch('/api/wizard/fundamentales');
      const fundData = await fundRes.json();
      if (!fundRes.ok) throw new Error(fundData.error || 'Error al obtener fundamentales');
      setFundamentales(fundData);

      // Phase 4: Technical filter
      setPipelinePhase(4);
      const tickersFund = fundData.tickers?.map((t) => t.ticker) || [];
      const params = tickersFund.length > 0 ? `?tickers=${tickersFund.join(',')}` : '';
      const tecRes = await fetch(`/api/wizard/tecnicos${params}`);
      const tecData = await tecRes.json();
      if (!tecRes.ok) throw new Error(tecData.error || 'Error al obtener filtro técnico');
      setTecnicos(tecData);

      // Phase 5: Asset allocation
      setPipelinePhase(5);
      const allocRes = await fetch(`/api/wizard/allocation/${encodeURIComponent(perfilData.perfil)}`);
      const allocData = await allocRes.json();
      if (allocRes.ok) setAllocation(allocData);

      // Done
      setPhase('results');
    } catch (err) {
      setError(err.message);
      setPhase('input');
    }
  }, []);

  const handleGenerar = () => {
    if (!perfil) return;
    runPipeline(perfil);
  };

  const handleReset = () => {
    setPhase('input');
    setPerfil(null);
    setCiclo(null);
    setSectores(null);
    setFundamentales(null);
    setTecnicos(null);
    setAllocation(null);
    setSelectedTickers(new Set());
    setCapital('');
    setError(null);
  };

  // ── Ticker selection ────────────────────────────────────────────
  const toggleTickerSelect = (symbol) => {
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const selectAll = () => {
    if (!tecnicos?.tickers) return;
    setSelectedTickers(new Set(tecnicos.tickers.map((t) => t.ticker)));
  };

  const deselectAll = () => {
    setSelectedTickers(new Set());
  };

  // ── Add to portfolio ────────────────────────────────────────────
  const handleAgregar = (ticker) => {
    setTickerSeleccionado(ticker);
    setPortafolioDestino(portafolios.length > 0 ? String(portafolios[0].id) : '');
    setCantidad('');
    setErrorModal(null);
    setModalAbierto(true);
  };

  const handleConfirmarAgregar = async () => {
    if (!portafolioDestino || !cantidad || Number(cantidad) <= 0) {
      setErrorModal('Seleccione un portafolio e ingrese una cantidad válida.');
      return;
    }

    setGuardando(true);
    setErrorModal(null);

    try {
      const res = await fetch(`/api/portafolios/${portafolioDestino}/transacciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: tickerSeleccionado.ticker,
          tipo: 'compra',
          fecha: new Date().toISOString().split('T')[0],
          precio_unitario: tickerSeleccionado.precio,
          cantidad: Number(cantidad),
          comision: 0,
          moneda: 'USD',
          notas: `Agregado desde Portafolio Automático — Perfil: ${perfil?.perfil || 'N/A'}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar transacción');

      setModalAbierto(false);
      setTickerSeleccionado(null);
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Add selected to existing portfolio ──────────────────────────
  const handleAgregarSeleccionados = () => {
    if (selectedTickers.size === 0) return;
    // Open modal with first selected ticker, user can repeat
    const firstSymbol = [...selectedTickers][0];
    const tickerData = tecnicos?.tickers?.find((t) => t.ticker === firstSymbol);
    if (tickerData) {
      const fundData = fundamentales?.tickers?.find((f) => f.ticker === firstSymbol);
      handleAgregar({
        ...tickerData,
        nombre: fundData?.nombre || tickerData.nombre,
        sector: fundData?.sector || tickerData.sector,
        pe: fundData?.pe || tickerData.pe,
      });
    }
  };

  // ── Create new portfolio with selected tickers ──────────────────
  const handleCrearNuevoPortafolio = async () => {
    if (!nombreNuevoPortafolio.trim()) return;
    setCreandoPortafolio(true);

    try {
      const res = await fetch('/api/portafolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreNuevoPortafolio.trim(),
          descripcion: `Creado desde Portafolio Automático — Perfil: ${perfil?.perfil || 'N/A'}`,
          moneda: moneda,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear portafolio');

      await fetchPortafolios();
      setModalNuevoPortafolio(false);
      setNombreNuevoPortafolio('');
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setCreandoPortafolio(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ── RENDER ────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bloomberg-text">
            Portafolio Automático
          </h1>
          <p className="text-sm text-bloomberg-text-muted mt-1">
            Del análisis macro al pool de tickers recomendados en un solo clic
          </p>
        </div>
        {phase === 'results' && (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-white/5 text-bloomberg-text text-sm
                       font-medium hover:bg-white/10 border border-white/10 transition-colors"
            aria-label="Generar nuevo portafolio"
          >
            ← Nuevo Análisis
          </button>
        )}
      </div>

      {/* ── PHASE 1: INPUT SCREEN ──────────────────────────────── */}
      {phase === 'input' && (
        <div className="space-y-6">
          {error && <ErrorMessage mensaje={error} onReintentar={() => setError(null)} />}

          {/* Risk profile questionnaire */}
          <RiskProfileForm onComplete={handlePerfilComplete} />

          {/* Capital input + currency toggle */}
          {perfil && (
            <div className="bg-bloomberg-panel rounded-xl border border-white/10 p-6 space-y-5 animate-fadeIn">
              <h3 className="text-bloomberg-text font-semibold">Capital Inicial</h3>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="capital-input" className="block text-sm text-bloomberg-text-muted mb-1.5">
                    Monto a invertir
                  </label>
                  <input
                    id="capital-input"
                    type="number"
                    min="0"
                    step="100"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    placeholder="Ej: 100000"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10
                               text-bloomberg-text text-lg font-mono focus:outline-none
                               focus:border-bloomberg-accent placeholder:text-bloomberg-text-muted/50"
                    aria-label="Capital inicial para inversión"
                  />
                </div>
                <div>
                  <label className="block text-sm text-bloomberg-text-muted mb-1.5">Moneda</label>
                  <div className="flex rounded-lg border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setMoneda('USD')}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${
                        moneda === 'USD'
                          ? 'bg-bloomberg-accent text-white'
                          : 'bg-white/5 text-bloomberg-text-muted hover:bg-white/10'
                      }`}
                      aria-pressed={moneda === 'USD'}
                    >
                      USD
                    </button>
                    <button
                      onClick={() => setMoneda('MXN')}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${
                        moneda === 'MXN'
                          ? 'bg-bloomberg-accent text-white'
                          : 'bg-white/5 text-bloomberg-text-muted hover:bg-white/10'
                      }`}
                      aria-pressed={moneda === 'MXN'}
                    >
                      MXN
                    </button>
                  </div>
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerar}
                disabled={!perfil}
                className="w-full py-3.5 rounded-lg bg-bloomberg-accent text-white text-base
                           font-semibold hover:bg-bloomberg-accent/80 transition-all
                           disabled:bg-white/5 disabled:text-bloomberg-text-muted disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                aria-label="Generar portafolio automático"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generar Portafolio
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LOADING SCREEN ─────────────────────────────────────── */}
      {phase === 'loading' && (
        <div className="bg-bloomberg-panel rounded-xl border border-white/10 p-8 space-y-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bloomberg-accent/10 mb-4">
              <svg className="w-8 h-8 text-bloomberg-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-bloomberg-text">Generando Portafolio</h2>
            <p className="text-sm text-bloomberg-text-muted mt-1">
              Analizando mercados y aplicando filtros...
            </p>
          </div>
          <PipelineProgressBar
            currentPhase={pipelinePhase}
            totalPhases={PIPELINE_PHASES.length}
            phaseLabel={PIPELINE_PHASES[pipelinePhase]?.label || 'Procesando...'}
          />
        </div>
      )}

      {/* ── PHASE 2: RESULTS SCREEN ────────────────────────────── */}
      {phase === 'results' && (
        <div className="space-y-4">
          {/* Phase 1: Risk Profile */}
          <CollapsiblePhase
            title="Perfil de Riesgo"
            phaseNumber={1}
            tooltipText={PHASE_TOOLTIPS.perfil}
            defaultOpen={true}
          >
            {perfil && (
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-bloomberg-text-muted text-sm mb-1">Su perfil de riesgo es</p>
                <h3 className="text-xl font-bold text-bloomberg-text mb-2">{perfil.perfil}</h3>
                <Badge
                  texto={`Puntaje: ${perfil.puntaje} / 20`}
                  variante="azul"
                />
                <p className="text-bloomberg-text-muted mt-3 text-sm leading-relaxed">
                  {perfil.descripcion}
                </p>
              </div>
            )}
          </CollapsiblePhase>

          {/* Phase 2: Economic Cycle */}
          <CollapsiblePhase
            title="Ciclo Económico"
            phaseNumber={2}
            tooltipText={PHASE_TOOLTIPS.ciclo}
          >
            {ciclo && <CycleStageCard data={ciclo} />}
          </CollapsiblePhase>

          {/* Phase 3: Sector Rotation */}
          <CollapsiblePhase
            title="Rotación Sectorial"
            phaseNumber={3}
            tooltipText={PHASE_TOOLTIPS.sectores}
          >
            {sectores && (
              <SectorRotationMap sectores={sectores.sectores} fase={sectores.fase} />
            )}
          </CollapsiblePhase>

          {/* Phase 4: Fundamental Filter */}
          <CollapsiblePhase
            title={`Filtro Fundamental — ${fundamentales?.total_aprobados || 0} de ${fundamentales?.total_evaluados || 0} aprobados`}
            phaseNumber={4}
            tooltipText={PHASE_TOOLTIPS.fundamentales}
          >
            {fundamentales && (
              <FundamentalFilterTable
                tickers={fundamentales.tickers}
                totalEvaluados={fundamentales.total_evaluados}
                totalAprobados={fundamentales.total_aprobados}
              />
            )}
          </CollapsiblePhase>

          {/* Phase 5: Technical Filter */}
          <CollapsiblePhase
            title={`Filtro Técnico — ${tecnicos?.total_aprobados || 0} de ${tecnicos?.total_evaluados || 0} aprobados`}
            phaseNumber={5}
            tooltipText={PHASE_TOOLTIPS.tecnicos}
          >
            {tecnicos && tecnicos.tickers.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm" role="table" aria-label="Tickers que pasaron el filtro técnico">
                  <thead>
                    <tr className="bg-white/5 text-bloomberg-text-muted text-left">
                      <th className="px-4 py-3 font-medium" scope="col">Ticker</th>
                      <th className="px-4 py-3 font-medium" scope="col">Precio</th>
                      <th className="px-4 py-3 font-medium" scope="col">SMA 200</th>
                      <th className="px-4 py-3 font-medium" scope="col">RSI (14)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tecnicos.tickers.map((t) => (
                      <tr key={t.ticker} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-bloomberg-accent">{t.ticker}</td>
                        <td className="px-4 py-3 text-bloomberg-text">${t.precio}</td>
                        <td className="px-4 py-3 text-bloomberg-text">${t.sma200}</td>
                        <td className="px-4 py-3">
                          <Badge
                            texto={String(t.rsi)}
                            variante={t.rsi >= 40 && t.rsi <= 60 ? 'verde' : 'amarillo'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-bloomberg-text-muted text-sm">
                Ningún ticker pasó el filtro técnico.
              </div>
            )}
          </CollapsiblePhase>

          {/* Asset Allocation Chart */}
          {allocation && (
            <AllocationChart
              allocation={allocation.allocation}
              perfil={perfil?.perfil || ''}
              capital={Number(capital) || 0}
              moneda={moneda}
            />
          )}

          {/* ── Ticker Pool ──────────────────────────────────────── */}
          {tecnicos && tecnicos.tickers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-bloomberg-text">
                    Pool de Tickers Recomendados
                  </h2>
                  <Badge texto={`${tecnicos.tickers.length} tickers`} variante="verde" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-bloomberg-text-muted text-xs
                               hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-bloomberg-text-muted text-xs
                               hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>

              {/* Action buttons for selected tickers */}
              {selectedTickers.size > 0 && (
                <div className="flex items-center gap-3 bg-bloomberg-accent/5 border border-bloomberg-accent/20 rounded-lg px-4 py-3">
                  <span className="text-sm text-bloomberg-accent font-medium">
                    {selectedTickers.size} seleccionado{selectedTickers.size > 1 ? 's' : ''}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={handleAgregarSeleccionados}
                    className="px-4 py-2 rounded-lg bg-bloomberg-accent text-white text-sm
                               font-medium hover:bg-bloomberg-accent/80 transition-colors"
                  >
                    Agregar a portafolio existente
                  </button>
                  <button
                    onClick={() => setModalNuevoPortafolio(true)}
                    className="px-4 py-2 rounded-lg bg-white/5 text-bloomberg-text text-sm
                               font-medium hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    Crear nuevo portafolio con seleccionados
                  </button>
                </div>
              )}

              {/* Ticker cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tecnicos.tickers.map((t) => {
                  const fundData = fundamentales?.tickers?.find((f) => f.ticker === t.ticker);
                  return (
                    <EnhancedTickerCard
                      key={t.ticker}
                      ticker={t}
                      fundamentalData={fundData}
                      selected={selectedTickers.has(t.ticker)}
                      onToggleSelect={toggleTickerSelect}
                      onAgregar={handleAgregar}
                      onToggleFavorito={toggleFavorito}
                      esFavorito={favoritos.includes(t.ticker)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {tecnicos && tecnicos.tickers.length === 0 && (
            <div className="text-center py-12 text-bloomberg-text-muted bg-bloomberg-panel rounded-xl border border-white/10">
              <p className="text-lg mb-2">No hay tickers en el pool final</p>
              <p className="text-sm">
                Ningún ticker pasó todos los filtros. Intente generar un nuevo análisis más tarde.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Add to existing portfolio ───────────────────── */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo="Agregar a Portafolio"
      >
        {tickerSeleccionado && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-sm text-bloomberg-text-muted">Ticker</p>
              <p className="text-lg font-mono font-bold text-bloomberg-accent">
                {tickerSeleccionado.ticker}
              </p>
              <p className="text-sm text-bloomberg-text-muted mt-1">
                Precio: ${tickerSeleccionado.precio}
              </p>
            </div>

            <div>
              <label htmlFor="portafolio-destino" className="block text-sm text-bloomberg-text-muted mb-1.5">
                Portafolio destino
              </label>
              <select
                id="portafolio-destino"
                value={portafolioDestino}
                onChange={(e) => setPortafolioDestino(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10
                           text-bloomberg-text text-sm focus:outline-none focus:border-bloomberg-accent"
                aria-label="Seleccionar portafolio destino"
              >
                <option value="" disabled>Seleccione un portafolio</option>
                {portafolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {portafolios.length === 0 && (
                <p className="text-xs text-bloomberg-yellow mt-1">
                  No tiene portafolios creados. Cree uno primero en el módulo de Portafolios.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="cantidad-compra" className="block text-sm text-bloomberg-text-muted mb-1.5">
                Cantidad de acciones
              </label>
              <input
                id="cantidad-compra"
                type="number"
                min="0.01"
                step="0.01"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej: 10"
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10
                           text-bloomberg-text text-sm focus:outline-none focus:border-bloomberg-accent
                           placeholder:text-bloomberg-text-muted/50"
                aria-label="Cantidad de acciones a comprar"
              />
            </div>

            {errorModal && (
              <p className="text-sm text-bloomberg-red" role="alert">{errorModal}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalAbierto(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/5 text-bloomberg-text text-sm
                           font-medium hover:bg-white/10 border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarAgregar}
                disabled={guardando || !portafolioDestino || !cantidad}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  guardando || !portafolioDestino || !cantidad
                    ? 'bg-white/5 text-bloomberg-text-muted cursor-not-allowed'
                    : 'bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80'
                }`}
                aria-label="Confirmar compra"
              >
                {guardando ? 'Registrando...' : 'Confirmar Compra'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Create new portfolio ────────────────────────── */}
      <Modal
        abierto={modalNuevoPortafolio}
        onCerrar={() => setModalNuevoPortafolio(false)}
        titulo="Crear Nuevo Portafolio"
      >
        <div className="space-y-4">
          <p className="text-sm text-bloomberg-text-muted">
            Se creará un nuevo portafolio. Luego podrá agregar los {selectedTickers.size} ticker{selectedTickers.size > 1 ? 's' : ''} seleccionado{selectedTickers.size > 1 ? 's' : ''} desde la pantalla de Portafolios.
          </p>

          <div>
            <label htmlFor="nombre-nuevo-portafolio" className="block text-sm text-bloomberg-text-muted mb-1.5">
              Nombre del portafolio
            </label>
            <input
              id="nombre-nuevo-portafolio"
              type="text"
              value={nombreNuevoPortafolio}
              onChange={(e) => setNombreNuevoPortafolio(e.target.value)}
              placeholder="Ej: Portafolio Agresivo 2024"
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10
                         text-bloomberg-text text-sm focus:outline-none focus:border-bloomberg-accent
                         placeholder:text-bloomberg-text-muted/50"
              aria-label="Nombre del nuevo portafolio"
            />
          </div>

          {errorModal && (
            <p className="text-sm text-bloomberg-red" role="alert">{errorModal}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setModalNuevoPortafolio(false)}
              className="flex-1 py-2.5 rounded-lg bg-white/5 text-bloomberg-text text-sm
                         font-medium hover:bg-white/10 border border-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrearNuevoPortafolio}
              disabled={creandoPortafolio || !nombreNuevoPortafolio.trim()}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                creandoPortafolio || !nombreNuevoPortafolio.trim()
                  ? 'bg-white/5 text-bloomberg-text-muted cursor-not-allowed'
                  : 'bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80'
              }`}
              aria-label="Crear portafolio"
            >
              {creandoPortafolio ? 'Creando...' : 'Crear Portafolio'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

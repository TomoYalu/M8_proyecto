import { useState, useMemo, useCallback } from 'react';
import { INDICES } from '../../constants/tickers';
import { SECTOR_POR_TICKER } from '../../constants/sectors';
import Tooltip from '../common/Tooltip';

// ─── Label mapping for instrument types ─────────────────────────
const TIPO_LABELS = {
  accion: 'Acciones',
  etf: 'ETFs',
  commodity: 'Commodities',
  bono: 'Bonos',
  crypto: 'Crypto',
};

/**
 * Sección colapsable de filtros.
 */
function FilterSection({ titulo, abierto, onToggle, children }) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3
                   text-sm font-semibold text-bloomberg-text hover:bg-white/5
                   transition-colors"
        onClick={onToggle}
        aria-expanded={abierto}
      >
        <span>{titulo}</span>
        <svg
          className={`w-4 h-4 text-bloomberg-text-muted transition-transform duration-200
                      ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {abierto && (
        <div className="px-4 pb-3 space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Checkbox individual de filtro.
 */
function FilterCheckbox({ label, checked, onChange, count }) {
  return (
    <label className="flex items-center gap-2 text-xs text-bloomberg-text-muted
                      hover:text-bloomberg-text cursor-pointer py-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-white/20 bg-bloomberg-bg
                   text-bloomberg-accent focus:ring-bloomberg-accent focus:ring-1
                   focus:ring-offset-0 cursor-pointer accent-bloomberg-accent"
      />
      <span className="flex-1 truncate">{label}</span>
      {count != null && (
        <span className="text-[10px] text-bloomberg-text-muted/60 tabular-nums">
          ({count})
        </span>
      )}
    </label>
  );
}

/**
 * Checkbox "Seleccionar todos" / "Deseleccionar todos" con estado indeterminado.
 */
function SelectAllCheckbox({ items, selectedItems, onToggleAll }) {
  const allChecked = items.length > 0 && items.every((item) => selectedItems.includes(item));
  const someChecked = items.some((item) => selectedItems.includes(item));

  return (
    <label className="flex items-center gap-2 text-xs text-bloomberg-accent
                      hover:text-bloomberg-accent/80 cursor-pointer py-0.5 mb-1
                      border-b border-white/5 pb-2">
      <input
        type="checkbox"
        checked={allChecked}
        ref={(el) => {
          if (el) el.indeterminate = someChecked && !allChecked;
        }}
        onChange={() => onToggleAll(items, allChecked)}
        className="w-3.5 h-3.5 rounded border-white/20 bg-bloomberg-bg
                   text-bloomberg-accent focus:ring-bloomberg-accent focus:ring-1
                   focus:ring-offset-0 cursor-pointer accent-bloomberg-accent"
      />
      <span className="flex-1 font-medium">
        {allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
      </span>
    </label>
  );
}

/**
 * Input de rango numérico (min-max).
 */
function RangeInput({ label, min, max, onMinChange, onMaxChange, placeholderMin, placeholderMax }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-bloomberg-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder={placeholderMin || 'Min'}
          className="w-full px-2 py-1 text-xs rounded bg-bloomberg-bg border border-white/10
                     text-bloomberg-text placeholder:text-bloomberg-text-muted/40
                     focus:border-bloomberg-accent focus:outline-none focus:ring-1
                     focus:ring-bloomberg-accent/30"
          aria-label={`${label} mínimo`}
        />
        <span className="text-bloomberg-text-muted text-xs">—</span>
        <input
          type="number"
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder={placeholderMax || 'Max'}
          className="w-full px-2 py-1 text-xs rounded bg-bloomberg-bg border border-white/10
                     text-bloomberg-text placeholder:text-bloomberg-text-muted/40
                     focus:border-bloomberg-accent focus:outline-none focus:ring-1
                     focus:ring-bloomberg-accent/30"
          aria-label={`${label} máximo`}
        />
      </div>
    </div>
  );
}

// ─── Nombres de índices disponibles ─────────────────────────────
const NOMBRES_INDICES = Object.keys(INDICES);

// ─── Regiones ───────────────────────────────────────────────────
const REGIONES = ['EE.UU.', 'México', 'Europa', 'Asia'];

/**
 * Obtiene los sectores únicos (nivel principal) de SECTOR_POR_TICKER.
 */
function obtenerSectoresUnicos() {
  const set = new Set();
  Object.values(SECTOR_POR_TICKER).forEach((sector) => {
    const principal = sector.split(' / ')[0];
    set.add(principal);
  });
  return [...set].sort();
}

const SECTORES_UNICOS = obtenerSectoresUnicos();

/**
 * Panel de filtros para la búsqueda de activos.
 *
 * @param {object} props
 * @param {object} props.filtros - Estado actual de filtros
 * @param {function} props.onFiltrosChange - Callback al cambiar filtros
 * @param {function} props.onLimpiar - Callback para limpiar todos los filtros
 * @param {object} props.conteos - Conteos de tickers por categoría (para mostrar junto a cada opción)
 */
export default function FilterPanel({ filtros, onFiltrosChange, onLimpiar, conteos = {}, filtrosDisponibles = {} }) {
  // Use API-provided filter options with fallbacks to hardcoded constants
  const nombresIndices = filtrosDisponibles.indices?.length > 0 ? filtrosDisponibles.indices : NOMBRES_INDICES;
  const sectoresUnicos = filtrosDisponibles.sectores?.length > 0 ? filtrosDisponibles.sectores : SECTORES_UNICOS;
  const regiones = filtrosDisponibles.regiones?.length > 0 ? filtrosDisponibles.regiones : REGIONES;
  const tiposDisponibles = filtrosDisponibles.tipos || [];

  const [secciones, setSecciones] = useState({
    tipo: true,
    indice: true,
    sector: true,
    region: true,
    metricas: false,
  });

  // ─── Estado para recomendación del ciclo ────────────────────
  const [cargandoCiclo, setCargandoCiclo] = useState(false);
  const [datosCiclo, setDatosCiclo] = useState(null); // {fase, descripcion, sectores: [{nombre, justificacion, etfs}]}

  const toggleSeccion = (key) => {
    setSecciones((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFiltroArray = (campo, valor) => {
    const actual = filtros[campo] || [];
    const nuevo = actual.includes(valor)
      ? actual.filter((v) => v !== valor)
      : [...actual, valor];
    onFiltrosChange({ ...filtros, [campo]: nuevo });
  };

  /**
   * Toggle all items in a filter section.
   */
  const toggleAllInSection = useCallback((campo, items, allChecked) => {
    if (allChecked) {
      // Deselect all
      onFiltrosChange({ ...filtros, [campo]: [] });
    } else {
      // Select all
      onFiltrosChange({ ...filtros, [campo]: [...items] });
    }
  }, [filtros, onFiltrosChange]);

  /**
   * Fetch cycle recommendation and auto-check favored sectors.
   */
  const handleRecomendacionCiclo = useCallback(async () => {
    setCargandoCiclo(true);
    try {
      // 1. Get current cycle phase
      const resCiclo = await fetch('/api/wizard/ciclo');
      if (!resCiclo.ok) throw new Error('Error fetching cycle');
      const dataCiclo = await resCiclo.json();
      const fase = dataCiclo.fase || dataCiclo.phase || '';
      const descripcion = dataCiclo.descripcion || '';

      // 2. Get favored sectors for this phase
      const resSectores = await fetch(`/api/wizard/sectores/${encodeURIComponent(fase)}`);
      if (!resSectores.ok) throw new Error('Error fetching sectors');
      const dataSectores = await resSectores.json();
      const sectoresInfo = dataSectores.sectores || [];

      // 3. Save full cycle data for display
      setDatosCiclo({
        fase,
        descripcion,
        sectores: sectoresInfo,
      });

      // 4. Auto-check the favored sectors that exist in our filter options
      const nombresSecores = sectoresInfo.map((s) => s.nombre || s);
      const sectoresValidos = nombresSecores.filter((s) =>
        sectoresUnicos.includes(s)
      );

      if (sectoresValidos.length > 0) {
        onFiltrosChange({ ...filtros, sectores: sectoresValidos });
        setSecciones((prev) => ({ ...prev, sector: true }));
      }
    } catch {
      setDatosCiclo(null);
    } finally {
      setCargandoCiclo(false);
    }
  }, [filtros, onFiltrosChange, sectoresUnicos]);

  const hayFiltrosActivos = useMemo(() => {
    return (
      (filtros.tipos?.length > 0) ||
      (filtros.indices?.length > 0) ||
      (filtros.sectores?.length > 0) ||
      (filtros.regiones?.length > 0) ||
      filtros.rsiMin !== '' ||
      filtros.rsiMax !== '' ||
      filtros.peMin !== '' ||
      filtros.peMax !== ''
    );
  }, [filtros]);

  return (
    <aside
      className="w-[280px] min-w-[280px] bg-bloomberg-panel rounded-xl border border-white/5
                 overflow-y-auto flex flex-col"
      role="search"
      aria-label="Filtros de búsqueda de activos"
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-bloomberg-text">Filtros</h2>
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={() => {
              onLimpiar();
            }}
            className="text-[11px] text-bloomberg-accent hover:text-bloomberg-accent/80
                       transition-colors"
            aria-label="Limpiar todos los filtros"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ─── Recomendación del ciclo ─────────────────────────── */}
      <div className="px-4 py-3 border-b border-white/5">
        <button
          type="button"
          disabled={cargandoCiclo}
          onClick={handleRecomendacionCiclo}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium
                     rounded-lg bg-bloomberg-accent/15 text-bloomberg-accent
                     border border-bloomberg-accent/30 hover:bg-bloomberg-accent/25
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {cargandoCiclo ? (
            <>
              <div className="w-3 h-3 border border-bloomberg-accent/30 border-t-bloomberg-accent
                              rounded-full animate-spin" />
              Analizando ciclo...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {datosCiclo ? 'Actualizar recomendación' : 'Recomendación del ciclo'}
            </>
          )}
        </button>

        {/* Panel informativo del ciclo */}
        {datosCiclo && (
          <div className="mt-3 space-y-3">
            {/* Fase actual */}
            <div className="px-3 py-2.5 rounded-lg bg-bloomberg-accent/5 border border-bloomberg-accent/15">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                 bg-bloomberg-accent/20 text-bloomberg-accent border border-bloomberg-accent/30">
                  {datosCiclo.fase}
                </span>
                <span className="text-[10px] text-bloomberg-text-muted">Fase del ciclo económico</span>
                <Tooltip
                  texto="El ciclo económico tiene 4 fases: Early (recuperación), Mid (expansión), Late (desaceleración) y Recession (contracción). Cada fase favorece distintos sectores. Invertir alineado al ciclo puede mejorar tus rendimientos."
                  posicion="bottom"
                >
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full
                               border border-bloomberg-text-muted/40 text-bloomberg-text-muted
                               hover:border-bloomberg-accent hover:text-bloomberg-accent
                               transition-colors text-[9px] font-semibold leading-none cursor-help"
                    aria-label="¿Qué es el ciclo económico?"
                  >
                    ?
                  </button>
                </Tooltip>
              </div>
              {datosCiclo.descripcion && (
                <p className="text-[11px] text-bloomberg-text-muted leading-relaxed mt-1">
                  {datosCiclo.descripcion}
                </p>
              )}
            </div>

            {/* Sectores favorecidos */}
            <div>
              <h4 className="text-[10px] font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-1.5">
                Sectores favorecidos
              </h4>
              <div className="space-y-1.5">
                {datosCiclo.sectores.map((sector) => {
                  const nombre = sector.nombre || sector;
                  const justificacion = sector.justificacion || '';
                  const etfs = sector.etfs || [];
                  const estaSeleccionado = (filtros.sectores || []).includes(nombre);

                  return (
                    <div
                      key={nombre}
                      className={`px-2.5 py-2 rounded-lg border transition-colors text-left
                                  ${estaSeleccionado
                                    ? 'bg-bloomberg-accent/10 border-bloomberg-accent/25'
                                    : 'bg-bloomberg-bg/50 border-white/5 hover:border-white/10'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                                         ${estaSeleccionado ? 'bg-bloomberg-accent' : 'bg-bloomberg-text-muted/40'}`} />
                        <span className="text-xs font-medium text-bloomberg-text">{nombre}</span>
                      </div>
                      {justificacion && (
                        <p className="text-[10px] text-bloomberg-text-muted leading-snug mt-1 ml-3">
                          {justificacion}
                        </p>
                      )}
                      {etfs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 ml-3">
                          {etfs.map((etf) => (
                            <span
                              key={etf}
                              className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono
                                         bg-white/5 text-bloomberg-text-muted border border-white/5"
                            >
                              {etf}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-bloomberg-text-muted/60 italic">
              Los sectores marcados se seleccionaron automáticamente en el filtro de abajo.
            </p>
          </div>
        )}
      </div>

      {/* ─── Tipo de Instrumento ────────────────────────────── */}
      {tiposDisponibles.length > 0 && (
        <FilterSection
          titulo="Tipo de Instrumento"
          abierto={secciones.tipo}
          onToggle={() => toggleSeccion('tipo')}
        >
          <SelectAllCheckbox
            items={tiposDisponibles}
            selectedItems={filtros.tipos || []}
            onToggleAll={(items, allChecked) => toggleAllInSection('tipos', items, allChecked)}
          />
          {tiposDisponibles.map((tipo) => (
            <FilterCheckbox
              key={tipo}
              label={TIPO_LABELS[tipo] || tipo}
              checked={(filtros.tipos || []).includes(tipo)}
              onChange={() => toggleFiltroArray('tipos', tipo)}
              count={conteos.tipos?.[tipo]}
            />
          ))}
        </FilterSection>
      )}

      {/* ─── Índice ──────────────────────────────────────────── */}
      <FilterSection
        titulo="Índice"
        abierto={secciones.indice}
        onToggle={() => toggleSeccion('indice')}
      >
        <SelectAllCheckbox
          items={nombresIndices}
          selectedItems={filtros.indices || []}
          onToggleAll={(items, allChecked) => toggleAllInSection('indices', items, allChecked)}
        />
        {nombresIndices.map((nombre) => (
          <FilterCheckbox
            key={nombre}
            label={nombre}
            checked={(filtros.indices || []).includes(nombre)}
            onChange={() => toggleFiltroArray('indices', nombre)}
            count={conteos.indices?.[nombre]}
          />
        ))}
      </FilterSection>

      {/* ─── Sector ──────────────────────────────────────────── */}
      <FilterSection
        titulo="Sector"
        abierto={secciones.sector}
        onToggle={() => toggleSeccion('sector')}
      >
        <SelectAllCheckbox
          items={sectoresUnicos}
          selectedItems={filtros.sectores || []}
          onToggleAll={(items, allChecked) => toggleAllInSection('sectores', items, allChecked)}
        />
        {sectoresUnicos.map((sector) => (
          <FilterCheckbox
            key={sector}
            label={sector}
            checked={(filtros.sectores || []).includes(sector)}
            onChange={() => toggleFiltroArray('sectores', sector)}
            count={conteos.sectores?.[sector]}
          />
        ))}
      </FilterSection>

      {/* ─── Región ──────────────────────────────────────────── */}
      <FilterSection
        titulo="Región"
        abierto={secciones.region}
        onToggle={() => toggleSeccion('region')}
      >
        <SelectAllCheckbox
          items={regiones}
          selectedItems={filtros.regiones || []}
          onToggleAll={(items, allChecked) => toggleAllInSection('regiones', items, allChecked)}
        />
        {regiones.map((region) => (
          <FilterCheckbox
            key={region}
            label={region}
            checked={(filtros.regiones || []).includes(region)}
            onChange={() => toggleFiltroArray('regiones', region)}
            count={conteos.regiones?.[region]}
          />
        ))}
      </FilterSection>

      {/* ─── Métricas ────────────────────────────────────────── */}
      <FilterSection
        titulo="Métricas"
        abierto={secciones.metricas}
        onToggle={() => toggleSeccion('metricas')}
      >
        <RangeInput
          label="RSI (0–100)"
          min={filtros.rsiMin}
          max={filtros.rsiMax}
          onMinChange={(v) => onFiltrosChange({ ...filtros, rsiMin: v })}
          onMaxChange={(v) => onFiltrosChange({ ...filtros, rsiMax: v })}
          placeholderMin="0"
          placeholderMax="100"
        />
        <RangeInput
          label="P/E Ratio"
          min={filtros.peMin}
          max={filtros.peMax}
          onMinChange={(v) => onFiltrosChange({ ...filtros, peMin: v })}
          onMaxChange={(v) => onFiltrosChange({ ...filtros, peMax: v })}
          placeholderMin="0"
          placeholderMax="100"
        />
      </FilterSection>
    </aside>
  );
}

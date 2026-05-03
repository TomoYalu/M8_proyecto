import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useSimulator from '../../hooks/useSimulator';
import useOptimizer from '../../hooks/useOptimizer';
import useTickerAutocomplete, { obtenerNombre } from '../../hooks/useTickerAutocomplete';
import useStore from '../../store';
import Spinner from '../common/Spinner';
import ErrorMessage from '../common/ErrorMessage';
import OptimizerResults from '../optimizer/OptimizerResults';

/**
 * Panel del simulador de portafolios.
 *
 * Permite crear simulaciones con tickers, pesos y capital,
 * calcular acciones, optimizar y ejecutar como portafolio real.
 *
 * @param {object} props
 * @param {number} [props.portafolioActivoId] - ID del portafolio activo para importar
 * @param {string} [props.portafolioActivoNombre] - Nombre del portafolio activo
 *
 * Requisitos cubiertos: 7.1, 7.2, 7.3, 7.4, 7.7, 7.8
 */
export default function SimulatorPanel({ portafolioActivoId, portafolioActivoNombre }) {
  const {
    simulaciones,
    simulacionActiva,
    cargandoSimulacion,
    errorSimulacion,
    loading: simLoading,
    error: simError,
    limpiarError: limpiarSimError,
    fetchSimulaciones,
    crearSimulacion,
    actualizarSimulacion,
    ejecutarSimulacion,
    eliminarSimulacion,
    importarPortafolio,
    setSimulacionActiva,
    calcularAcciones,
  } = useSimulator();

  const {
    resultadoOptimizacion,
    cargandoOptimizacion,
    errorOptimizacion,
    ejecutarOptimizacion,
    limpiarResultados,
  } = useOptimizer();

  // ─── Acciones del store de portafolios (para refrescar tras ejecutar) ──
  const fetchPortafolios = useStore((s) => s.fetchPortafolios);
  const fetchConsolidado = useStore((s) => s.fetchConsolidado);

  // ─── Estado local del formulario ──────────────────────────────
  const [nombre, setNombre] = useState('');
  const [capital, setCapital] = useState('100000');
  const [moneda, setMoneda] = useState('MXN');
  const [activos, setActivos] = useState([]);
  const [mostrarOptimizador, setMostrarOptimizador] = useState(false);
  const [confirmandoEjecutar, setConfirmandoEjecutar] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  // ─── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    fetchSimulaciones().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Sincronizar formulario con simulación activa ─────────────
  useEffect(() => {
    if (simulacionActiva) {
      setNombre(simulacionActiva.nombre || '');
      setCapital(String(simulacionActiva.capital_total || '100000'));
      setMoneda(simulacionActiva.moneda || 'USD');
      setActivos(
        (simulacionActiva.activos || []).map((a) => ({
          ticker: a.ticker,
          peso: String(a.peso_objetivo ?? ''),
          precio_spot: a.precio_spot,
          acciones_calculadas: a.acciones_calculadas,
          monto_calculado: a.monto_calculado,
        }))
      );
    }
  }, [simulacionActiva]);

  // ─── Suma de pesos ────────────────────────────────────────────
  const sumaPesos = useMemo(
    () => activos.reduce((s, a) => s + (parseFloat(a.peso) || 0), 0),
    [activos]
  );
  const pesosValidos = Math.abs(sumaPesos - 100) <= 0.01;

  // ─── Handlers de activos ──────────────────────────────────────
  const handleAgregarActivo = useCallback(() => {
    setActivos((prev) => {
      // Asignar peso 100% al primer activo de una simulación vacía (Req 6.2)
      const pesoInicial = prev.length === 0 ? '100' : '';
      return [...prev, { ticker: '', peso: pesoInicial, precio_spot: null, acciones_calculadas: null, monto_calculado: null }];
    });
  }, []);

  const handleRemoverActivo = useCallback((index) => {
    setActivos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleActivoChange = useCallback((index, field, value) => {
    setActivos((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }, []);

  // ─── Guardar simulación ───────────────────────────────────────
  const handleGuardar = async () => {
    if (!nombre.trim()) return;
    const datos = {
      nombre: nombre.trim(),
      capital_total: parseFloat(capital) || 0,
      moneda,
      activos: activos
        .filter((a) => a.ticker.trim())
        .map((a) => ({
          ticker: a.ticker.trim().toUpperCase(),
          peso_objetivo: parseFloat(a.peso) || 0,
        })),
    };

    try {
      if (simulacionActiva) {
        await actualizarSimulacion(simulacionActiva.id, datos);
      } else {
        const nueva = await crearSimulacion(datos);
        if (nueva) setSimulacionActiva(nueva.id);
      }
      await fetchSimulaciones();
    } catch {
      // Error manejado por el hook
    }
  };

  // ─── Calcular acciones ────────────────────────────────────────
  const handleCalcular = async () => {
    if (!simulacionActiva) {
      // Guardar primero si no hay simulación activa
      await handleGuardar();
      return;
    }
    try {
      // Guardar cambios primero
      await handleGuardar();
      const resultado = await calcularAcciones(simulacionActiva.id);
      // Actualizar activos locales con datos calculados (Task 6.1)
      if (resultado?.activos) {
        setActivos(resultado.activos.map((a) => ({
          ticker: a.ticker,
          peso: String(a.peso_objetivo ?? ''),
          precio_spot: a.precio_spot,
          acciones_calculadas: a.acciones_calculadas,
          monto_calculado: a.monto_calculado,
        })));
      }
      await fetchSimulaciones();
    } catch {
      // Error manejado por el hook
    }
  };

  // ─── Optimizar ────────────────────────────────────────────────
  const handleOptimizar = async () => {
    const tickersValidos = activos
      .filter((a) => a.ticker.trim())
      .map((a) => a.ticker.trim().toUpperCase());

    if (tickersValidos.length < 2) return;

    setMostrarOptimizador(true);
    try {
      await ejecutarOptimizacion({
        tickers: tickersValidos,
        inversion: parseFloat(capital) || 1000000,
        periodo: '5y',
      });
    } catch {
      // Error manejado por el hook
    }
  };

  // ─── Ejecutar simulación ──────────────────────────────────────
  const handleEjecutar = async () => {
    if (!simulacionActiva) return;
    try {
      await ejecutarSimulacion(simulacionActiva.id);
      await fetchSimulaciones();
      // Refrescar portafolios y consolidado tras ejecutar (Task 6.2)
      await Promise.all([fetchPortafolios(), fetchConsolidado()]);
      setConfirmandoEjecutar(false);
    } catch {
      // Error manejado por el hook
    }
  };

  // ─── Eliminar simulación ──────────────────────────────────────
  const handleEliminar = async (id) => {
    try {
      await eliminarSimulacion(id);
      if (simulacionActiva?.id === id) {
        setNombre('');
        setCapital('100000');
        setMoneda('USD');
        setActivos([]);
      }
      setConfirmandoEliminar(null);
    } catch {
      // Error manejado por el hook
    }
  };

  // ─── Importar desde portafolio ────────────────────────────────
  const handleImportar = async () => {
    if (!portafolioActivoId) return;
    try {
      const nueva = await importarPortafolio(
        portafolioActivoId,
        `Simulación de ${portafolioActivoNombre || 'Portafolio'}`
      );
      if (nueva) {
        await fetchSimulaciones();
        setSimulacionActiva(nueva.id);
      }
    } catch {
      // Error manejado por el hook
    }
  };

  // ─── Cargar simulación ────────────────────────────────────────
  const handleCargar = (sim) => {
    setSimulacionActiva(sim.id);
    setMostrarOptimizador(false);
    limpiarResultados();
  };

  // ─── Nueva simulación ─────────────────────────────────────────
  const handleNueva = () => {
    setSimulacionActiva(null);
    setNombre('');
    setCapital('100000');
    setMoneda('USD');
    setActivos([]);
    setMostrarOptimizador(false);
    limpiarResultados();
    limpiarSimError();
  };

  const inputClasses =
    'w-full px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/10 text-sm ' +
    'text-bloomberg-text placeholder-bloomberg-text-muted/50 focus:outline-none ' +
    'focus:ring-1 focus:ring-bloomberg-accent transition-colors';

  const esEjecutada = simulacionActiva?.estado === 'ejecutada';
  const tickersValidos = activos.filter((a) => a.ticker.trim()).length;

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto" aria-label="Panel del simulador">
      {/* Error global */}
      {(simError || errorSimulacion) && (
        <ErrorMessage
          mensaje={simError || errorSimulacion}
          onReintentar={limpiarSimError}
        />
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Columna izquierda: formulario */}
        <div className="w-[380px] min-w-[380px] flex flex-col gap-4 overflow-y-auto">
          {/* Header */}
          <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-bloomberg-text-muted">
                {simulacionActiva ? 'Editar Simulación' : 'Nueva Simulación'}
              </h2>
              <button
                onClick={handleNueva}
                className="text-xs text-bloomberg-accent hover:text-bloomberg-accent/80 transition-colors"
                aria-label="Crear nueva simulación"
              >
                + Nueva
              </button>
            </div>

            {/* Nombre */}
            <div className="mb-3">
              <label htmlFor="sim-nombre" className="block text-xs text-bloomberg-text-muted mb-1">
                Nombre de la simulación *
              </label>
              <input
                id="sim-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Portafolio Agresivo"
                className={inputClasses}
                disabled={esEjecutada}
                required
                aria-required="true"
              />
            </div>

            {/* Capital y moneda */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="col-span-2">
                <label htmlFor="sim-capital" className="block text-xs text-bloomberg-text-muted mb-1">
                  Capital de inversión *
                </label>
                <input
                  id="sim-capital"
                  type="number"
                  min="0"
                  step="1000"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  placeholder="100000"
                  className={inputClasses}
                  disabled={esEjecutada}
                  required
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="sim-moneda" className="block text-xs text-bloomberg-text-muted mb-1">
                  Moneda
                </label>
                <select
                  id="sim-moneda"
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className={inputClasses}
                  disabled={esEjecutada}
                >
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
            </div>

            {/* Importar desde portafolio */}
            {portafolioActivoId && !esEjecutada && (
              <button
                onClick={handleImportar}
                disabled={simLoading}
                className="w-full px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10
                           text-bloomberg-text-muted hover:bg-white/10 hover:text-bloomberg-text
                           transition-colors disabled:opacity-50"
                aria-label="Importar tickers desde portafolio activo"
              >
                📥 Importar desde {portafolioActivoNombre || 'portafolio'}
              </button>
            )}
          </div>

          {/* Activos */}
          <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-bloomberg-text-muted">
                Activos
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    pesosValidos
                      ? 'bg-bloomberg-green/15 text-bloomberg-green'
                      : 'bg-bloomberg-red/15 text-bloomberg-red'
                  }`}
                  aria-label={`Suma de pesos: ${sumaPesos.toFixed(2)}%`}
                >
                  Σ {sumaPesos.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Barra de progreso visual de suma de pesos (Req 6.3) */}
            {activos.length > 0 && (
              <div className="mb-3">
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden" aria-label="Barra de progreso de pesos">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      pesosValidos ? 'bg-bloomberg-green' : 'bg-bloomberg-red'
                    }`}
                    style={{ width: `${Math.min(sumaPesos, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Lista de activos */}
            <div className="space-y-2 mb-3" role="list" aria-label="Lista de activos de la simulación">
              {activos.map((activo, index) => (
                <ActivoRow
                  key={index}
                  index={index}
                  activo={activo}
                  onChange={handleActivoChange}
                  onRemove={handleRemoverActivo}
                  disabled={esEjecutada}
                />
              ))}
            </div>

            {/* Agregar activo */}
            {!esEjecutada && (
              <button
                onClick={handleAgregarActivo}
                className="w-full px-3 py-2 text-xs rounded-lg border border-dashed border-white/10
                           text-bloomberg-text-muted hover:border-bloomberg-accent hover:text-bloomberg-accent
                           transition-colors"
                aria-label="Agregar nuevo activo"
              >
                + Agregar activo
              </button>
            )}
          </div>

          {/* Botones de acción */}
          {!esEjecutada && (
            <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-4 space-y-2">
              <button
                onClick={handleGuardar}
                disabled={simLoading || !nombre.trim()}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                           hover:bg-bloomberg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Guardar simulación"
              >
                {simLoading ? 'Guardando...' : 'Guardar simulación'}
              </button>

              <button
                onClick={handleCalcular}
                disabled={simLoading || !pesosValidos || tickersValidos < 1}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bloomberg-green/20 text-bloomberg-green
                           hover:bg-bloomberg-green/30 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Calcular acciones y montos"
              >
                {simLoading ? 'Calculando...' : 'Calcular acciones'}
              </button>

              <button
                onClick={handleOptimizar}
                disabled={cargandoOptimizacion || tickersValidos < 2}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bloomberg-yellow/20 text-bloomberg-yellow
                           hover:bg-bloomberg-yellow/30 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Optimizar portafolio con Markowitz"
              >
                {cargandoOptimizacion ? 'Optimizando...' : '📊 Optimizar'}
              </button>

              <button
                onClick={() => setConfirmandoEjecutar(true)}
                disabled={simLoading || !simulacionActiva || !pesosValidos}
                className="w-full px-3 py-2 text-sm rounded-lg bg-bloomberg-red/20 text-bloomberg-red
                           hover:bg-bloomberg-red/30 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                aria-label="Exportar simulación a portafolio real"
              >
                📦 Exportar a portafolio
              </button>
            </div>
          )}

          {esEjecutada && (
            <div className="bg-bloomberg-green/5 border border-bloomberg-green/15 rounded-xl p-4 text-center">
              <p className="text-sm text-bloomberg-green font-bold">✓ Simulación ejecutada</p>
              <p className="text-xs text-bloomberg-text-muted mt-1">
                Ejecutada el {simulacionActiva.fecha_ejecucion
                  ? new Date(simulacionActiva.fecha_ejecucion).toLocaleDateString('es-MX')
                  : '—'}
              </p>
            </div>
          )}

          {/* Lista de simulaciones guardadas */}
          <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-bloomberg-text-muted mb-3">
              Simulaciones guardadas
            </h3>
            {cargandoSimulacion && !simulaciones.length ? (
              <Spinner mensaje="Cargando simulaciones..." size="sm" />
            ) : simulaciones.length === 0 ? (
              <p className="text-xs text-bloomberg-text-muted text-center py-4">
                No hay simulaciones guardadas
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto" role="list" aria-label="Simulaciones guardadas">
                {simulaciones.map((sim) => (
                  <div
                    key={sim.id}
                    role="listitem"
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm
                      transition-colors cursor-pointer
                      ${simulacionActiva?.id === sim.id
                        ? 'bg-bloomberg-accent/10 border border-bloomberg-accent/20'
                        : 'hover:bg-white/5 border border-transparent'
                      }`}
                    onClick={() => handleCargar(sim)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCargar(sim)}
                    tabIndex={0}
                    aria-label={`Simulación: ${sim.nombre}`}
                  >
                    <div className="min-w-0">
                      <p className="text-bloomberg-text truncate text-sm">{sim.nombre}</p>
                      <p className="text-[10px] text-bloomberg-text-muted">
                        {sim.moneda} {Number(sim.capital_total).toLocaleString()} ·{' '}
                        {sim.estado === 'ejecutada' ? '✓ Ejecutada' : 'Simulada'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmandoEliminar(sim.id);
                      }}
                      className="p-1 rounded text-bloomberg-text-muted hover:text-bloomberg-red
                                 hover:bg-white/5 transition-colors shrink-0"
                      aria-label={`Eliminar simulación ${sim.nombre}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                           viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: resultados de cálculo / optimización */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {mostrarOptimizador ? (
            <OptimizerResults
              resultado={resultadoOptimizacion}
              cargando={cargandoOptimizacion}
              error={errorOptimizacion}
              onReintentar={handleOptimizar}
            />
          ) : (
            <SimulationResultsTable activos={activos} capital={capital} moneda={moneda} />
          )}
        </div>
      </div>

      {/* Diálogo de confirmación: ejecutar */}
      {confirmandoEjecutar && (
        <ConfirmDialog
          titulo="Exportar a Portafolio"
          mensaje="¿Exportar simulación a portafolio real? Se crearán transacciones de compra para cada activo. Esta acción no se puede deshacer."
          onConfirmar={handleEjecutar}
          onCancelar={() => setConfirmandoEjecutar(false)}
          loading={simLoading}
          labelConfirmar="Exportar"
          colorConfirmar="bg-bloomberg-red/20 text-bloomberg-red hover:bg-bloomberg-red/30"
        />
      )}

      {/* Diálogo de confirmación: eliminar */}
      {confirmandoEliminar && (
        <ConfirmDialog
          titulo="Eliminar Simulación"
          mensaje="¿Estás seguro de que deseas eliminar esta simulación?"
          onConfirmar={() => handleEliminar(confirmandoEliminar)}
          onCancelar={() => setConfirmandoEliminar(null)}
          loading={simLoading}
          labelConfirmar="Eliminar"
          colorConfirmar="bg-bloomberg-red/20 text-bloomberg-red hover:bg-bloomberg-red/30"
        />
      )}
    </div>
  );
}


/**
 * Fila de activo con ticker autocomplete y peso.
 */
function ActivoRow({ index, activo, onChange, onRemove, disabled }) {
  const {
    query: tickerQuery,
    setQuery: setTickerQuery,
    sugerencias,
    indiceActivo,
    setIndiceActivo,
    abierto: dropdownAbierto,
    setAbierto: setDropdownAbierto,
    handleKeyDown,
    seleccionar,
  } = useTickerAutocomplete({ maxResultados: 6 });

  const containerRef = useRef(null);

  // Sync activo.ticker → query on mount / external change
  useEffect(() => {
    if (activo.ticker && activo.ticker !== tickerQuery) {
      setTickerQuery(activo.ticker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo.ticker]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setDropdownAbierto]);

  const handleTickerInput = (e) => {
    const value = e.target.value;
    setTickerQuery(value);
    setDropdownAbierto(true);
    onChange(index, 'ticker', value);
  };

  const handleTickerSelect = (ticker) => {
    seleccionar(ticker);
    onChange(index, 'ticker', ticker);
  };

  const handleTickerKeyDownWrapper = (e) => {
    handleKeyDown(e);
    if (e.key === 'Enter' && indiceActivo >= 0 && sugerencias[indiceActivo]) {
      onChange(index, 'ticker', sugerencias[indiceActivo]);
      e.preventDefault();
    }
  };

  const listboxId = `sim-ticker-listbox-${index}`;

  return (
    <div
      role="listitem"
      className="flex items-start gap-2 group"
      aria-label={`Activo ${index + 1}`}
    >
      {/* Ticker con autocomplete */}
      <div ref={containerRef} className="relative flex-1 min-w-0">
        <input
          type="text"
          value={tickerQuery}
          onChange={handleTickerInput}
          onFocus={() => {
            if (tickerQuery.trim() && sugerencias.length > 0) setDropdownAbierto(true);
          }}
          onKeyDown={handleTickerKeyDownWrapper}
          placeholder="Ticker"
          disabled={disabled}
          className="w-full px-2 py-1.5 rounded-lg bg-bloomberg-bg border border-white/10 text-sm
                     text-bloomberg-text placeholder-bloomberg-text-muted/50 focus:outline-none
                     focus:ring-1 focus:ring-bloomberg-accent transition-colors"
          role="combobox"
          aria-expanded={dropdownAbierto && sugerencias.length > 0}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            indiceActivo >= 0 ? `${listboxId}-option-${indiceActivo}` : undefined
          }
          aria-label={`Ticker del activo ${index + 1}`}
          autoComplete="off"
        />

        {dropdownAbierto && sugerencias.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Sugerencias de tickers"
            className="absolute z-50 mt-1 w-full max-h-36 overflow-y-auto rounded-lg
                       bg-bloomberg-panel border border-white/10 shadow-xl"
          >
            {sugerencias.map((ticker, idx) => {
              const nombre = obtenerNombre(ticker);
              const isActive = idx === indiceActivo;
              return (
                <li
                  key={ticker}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={isActive}
                  className={`px-2 py-1.5 cursor-pointer transition-colors text-xs border-b border-white/5
                    last:border-b-0
                    ${isActive ? 'bg-bloomberg-accent/15' : 'hover:bg-white/5'}`}
                  onClick={() => handleTickerSelect(ticker)}
                  onMouseEnter={() => setIndiceActivo(idx)}
                >
                  <span className="font-semibold text-bloomberg-accent">{ticker}</span>
                  <span className="text-bloomberg-text-muted ml-1">— {nombre}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Peso con slider (Req 6.1) */}
      <div className="w-36 shrink-0 flex items-center gap-1.5">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={parseFloat(activo.peso) || 0}
          onChange={(e) => onChange(index, 'peso', e.target.value)}
          disabled={disabled}
          className="flex-1 h-1.5 accent-bloomberg-accent cursor-pointer disabled:opacity-50"
          aria-label={`Slider de peso del activo ${index + 1}`}
        />
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={activo.peso}
          onChange={(e) => onChange(index, 'peso', e.target.value)}
          placeholder="%"
          disabled={disabled}
          className="w-16 px-2 py-1.5 rounded-lg bg-bloomberg-bg border border-white/10 text-sm
                     text-bloomberg-text text-right placeholder-bloomberg-text-muted/50
                     focus:outline-none focus:ring-1 focus:ring-bloomberg-accent transition-colors"
          aria-label={`Peso del activo ${index + 1} en porcentaje`}
        />
      </div>

      {/* Botón eliminar */}
      {!disabled && (
        <button
          onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-red
                     hover:bg-white/5 transition-colors shrink-0 mt-0.5
                     opacity-0 group-hover:opacity-100"
          aria-label={`Eliminar activo ${activo.ticker || index + 1}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Tabla de resultados de la simulación (acciones calculadas).
 */
function SimulationResultsTable({ activos, capital, moneda }) {
  const activosConDatos = activos.filter(
    (a) => a.ticker.trim() && (a.acciones_calculadas != null || a.monto_calculado != null)
  );

  if (activosConDatos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bloomberg-panel rounded-xl
                      border border-white/5 min-h-[300px]">
        <div className="text-center px-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-bloomberg-text-muted/30 mb-4"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-bloomberg-text-muted text-sm">
            Agrega activos y haz clic en "Calcular acciones" para ver la tabla de ejecución
          </p>
        </div>
      </div>
    );
  }

  const totalMonto = activosConDatos.reduce(
    (s, a) => s + (parseFloat(a.monto_calculado) || 0),
    0
  );

  return (
    <div className="bg-bloomberg-panel border border-white/5 rounded-xl p-5" aria-label="Tabla de ejecución de simulación">
      <h3 className="text-xs font-bold uppercase tracking-widest text-bloomberg-text-muted mb-4">
        Orden de Ejecución
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left" role="table">
          <thead>
            <tr className="text-bloomberg-text-muted text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
              <th className="pb-3 pr-3">Ticker</th>
              <th className="pb-3 pr-3 text-right">Peso (%)</th>
              <th className="pb-3 pr-3 text-right">Precio Spot</th>
              <th className="pb-3 pr-3 text-right">Acciones</th>
              <th className="pb-3 text-right">Monto ({moneda})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {activosConDatos.map((activo, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 pr-3 font-bold text-bloomberg-text text-sm">
                  {activo.ticker}
                </td>
                <td className="py-3 pr-3 text-right text-sm text-bloomberg-text-muted">
                  {parseFloat(activo.peso)?.toFixed(1) || '—'}%
                </td>
                <td className="py-3 pr-3 text-right text-sm text-bloomberg-text-muted">
                  {activo.precio_spot != null
                    ? Number(activo.precio_spot).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
                </td>
                <td className="py-3 pr-3 text-right font-bold text-bloomberg-text text-sm">
                  {activo.acciones_calculadas != null ? activo.acciones_calculadas.toLocaleString() : '—'}
                </td>
                <td className="py-3 text-right font-bold text-bloomberg-accent text-sm">
                  {activo.monto_calculado != null
                    ? Number(activo.monto_calculado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 text-sm font-bold">
              <td className="pt-3" colSpan={4}>Total</td>
              <td className="pt-3 text-right text-bloomberg-accent">
                ${totalMonto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * Diálogo de confirmación inline.
 */
function ConfirmDialog({ titulo, mensaje, onConfirmar, onCancelar, loading, labelConfirmar, colorConfirmar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancelar} aria-hidden="true" />
      <div className="relative max-w-md w-full mx-4 bg-bloomberg-panel rounded-xl border border-white/10 shadow-2xl p-6">
        <h3 className="text-lg font-semibold text-bloomberg-text mb-3">{titulo}</h3>
        <p className="text-sm text-bloomberg-text-muted mb-5">{mensaje}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                       hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed ${colorConfirmar}`}
          >
            {loading ? 'Procesando...' : labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

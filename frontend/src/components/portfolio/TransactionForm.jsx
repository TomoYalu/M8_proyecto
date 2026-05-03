import { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../common/Modal';
import useTickerAutocomplete, { obtenerNombre } from '../../hooks/useTickerAutocomplete';
import usePrecioHistorico from '../../hooks/usePrecioHistorico';
import { formatMoneda, formatNumero } from '../../utils/formatters';

/**
 * Modal para agregar un activo (compra) o registrar un dividendo.
 *
 * Campos compra: ticker, fecha, precio_unitario, cantidad, comision,
 * moneda (MXN/USD), notas.
 * Campos dividendo: ticker, fecha, monto por acción, cantidad de acciones.
 *
 * Incluye sección de "Asignación" con sliders para monto a invertir
 * y porcentaje, que auto-calculan la cantidad de títulos.
 *
 * Auto-pending: si capitalTotal > 0 y el costo excede el capital disponible,
 * la transacción se registra como pendiente automáticamente.
 *
 * @param {object} props
 * @param {boolean} props.abierto - Controla visibilidad del modal
 * @param {function} props.onCerrar - Callback al cerrar
 * @param {function} props.onSubmit - Callback con datos del formulario
 * @param {boolean} [props.loading] - Estado de carga
 * @param {string} [props.error] - Mensaje de error
 * @param {string} [props.tickerPrellenado] - Ticker pre-llenado desde búsqueda rápida
 * @param {number} [props.capitalTotal] - Capital total del usuario (0 = no mostrar banner)
 * @param {number} [props.valorInvertido] - Valor actualmente invertido
 * @param {string} [props.moneda] - Moneda del portafolio (para el banner)
 *
 * Requisitos cubiertos: 2.1–2.7, 3.1–3.6, 4.1, 4.2, 12.1, 12.5, 12.7
 */
export default function TransactionForm({
  abierto,
  onCerrar,
  onSubmit,
  loading = false,
  error = null,
  tickerPrellenado = null,
  capitalTotal = 0,
  valorInvertido = 0,
  moneda: monedaPortafolio = 'MXN',
}) {
  const [form, setForm] = useState({
    ticker: '',
    fecha: new Date().toISOString().split('T')[0],
    precio_unitario: '',
    cantidad: '',
    comision: '0',
    moneda: 'MXN',
    notas: '',
  });

  // ─── Dividendo toggle ─────────────────────────────────────────
  const [esDividendo, setEsDividendo] = useState(false);

  // ─── Allocation state ─────────────────────────────────────────
  const [montoInvertir, setMontoInvertir] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  const [cantidadManual, setCantidadManual] = useState(false);
  const [montoSliderMax, setMontoSliderMax] = useState(100000);

  const [erroresValidacion, setErroresValidacion] = useState({});

  // ─── Ticker autocomplete (Task 6.1) ──────────────────────────
  const {
    query: tickerQuery,
    setQuery: setTickerQuery,
    sugerencias,
    indiceActivo,
    setIndiceActivo,
    abierto: dropdownAbierto,
    setAbierto: setDropdownAbierto,
    handleKeyDown: handleTickerKeyDown,
    seleccionar: seleccionarTicker,
  } = useTickerAutocomplete();

  const tickerContainerRef = useRef(null);
  const tickerInputRef = useRef(null);

  // ─── Precio histórico (Task 6.2) ─────────────────────────────
  const {
    precio,
    cargando: precioCargando,
    precioEditadoManualmente,
    setPrecioEditadoManualmente,
  } = usePrecioHistorico(form.ticker, form.fecha);

  // ─── Derived values ───────────────────────────────────────────
  const capitalDisponible = capitalTotal > 0 ? capitalTotal - valorInvertido : 0;
  const precioNum = parseFloat(form.precio_unitario) || 0;
  const cantidadNum = parseInt(form.cantidad, 10) || 0;
  const costoTotal = cantidadNum * precioNum;
  const tickerDisplay = form.ticker?.toUpperCase() || '—';

  // Auto-pending detection
  const autoPendiente =
    !esDividendo && capitalTotal > 0 && costoTotal > 0 && costoTotal > capitalDisponible;

  // Banner currency: use portfolio moneda
  const bannerMoneda = monedaPortafolio || form.moneda;

  // ─── Initialize ticker from tickerPrellenado when modal opens ─
  useEffect(() => {
    if (abierto && tickerPrellenado) {
      setForm((prev) => ({ ...prev, ticker: tickerPrellenado }));
      setTickerQuery(tickerPrellenado);
    }
  }, [abierto, tickerPrellenado, setTickerQuery]);

  // ─── Reset allocation state when modal opens ──────────────────
  useEffect(() => {
    if (abierto) {
      setMontoInvertir('');
      setPorcentaje('');
      setCantidadManual(false);
      setEsDividendo(false);
    }
  }, [abierto]);

  // ─── Sync autocomplete selection → form state ─────────────────
  const prevTickerQueryRef = useRef(tickerQuery);
  useEffect(() => {
    if (tickerQuery !== prevTickerQueryRef.current) {
      prevTickerQueryRef.current = tickerQuery;
      if (!dropdownAbierto && tickerQuery) {
        setForm((prev) => ({ ...prev, ticker: tickerQuery }));
      }
    }
  }, [tickerQuery, dropdownAbierto]);

  // ─── Auto-fill price when hook returns a new price (Task 6.2) ─
  useEffect(() => {
    if (precio !== null && !precioEditadoManualmente) {
      setForm((prev) => ({ ...prev, precio_unitario: String(precio) }));
    }
  }, [precio, precioEditadoManualmente]);

  // ─── Recalculate cantidad when precio changes and monto is set ─
  useEffect(() => {
    if (!cantidadManual && montoInvertir && precioNum > 0) {
      const monto = parseFloat(montoInvertir) || 0;
      const nuevaCantidad = Math.floor(monto / precioNum);
      setForm((prev) => ({ ...prev, cantidad: String(nuevaCantidad) }));
    }
  }, [precioNum, montoInvertir, cantidadManual]);

  // ─── Close dropdown on click outside ──────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (tickerContainerRef.current && !tickerContainerRef.current.contains(e.target)) {
        setDropdownAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setDropdownAbierto]);

  // ─── Allocation sync helpers ──────────────────────────────────

  const handleMontoChange = useCallback((valor) => {
    const monto = parseFloat(valor) || 0;
    setMontoInvertir(valor);

    // Update slider max dynamically
    if (monto > montoSliderMax * 0.8) {
      setMontoSliderMax(Math.ceil(monto * 1.5 / 10000) * 10000);
    }

    // Calculate porcentaje if capitalTotal > 0
    if (capitalTotal > 0) {
      const pct = capitalTotal > 0 ? (monto / capitalTotal) * 100 : 0;
      setPorcentaje(String(Math.min(pct, 100).toFixed(1)));
    }

    // Calculate cantidad
    if (precioNum > 0) {
      const nuevaCantidad = Math.floor(monto / precioNum);
      setForm((prev) => ({ ...prev, cantidad: String(nuevaCantidad) }));
      setCantidadManual(false);
    }
  }, [capitalTotal, precioNum, montoSliderMax]);

  const handlePorcentajeChange = useCallback((valor) => {
    const pct = parseFloat(valor) || 0;
    setPorcentaje(valor);

    if (capitalTotal > 0) {
      const monto = capitalTotal * (pct / 100);
      setMontoInvertir(String(monto.toFixed(2)));

      if (precioNum > 0) {
        const nuevaCantidad = Math.floor(monto / precioNum);
        setForm((prev) => ({ ...prev, cantidad: String(nuevaCantidad) }));
        setCantidadManual(false);
      }
    }
  }, [capitalTotal, precioNum]);

  const handleCantidadDirecta = useCallback((valor) => {
    const cant = parseFloat(valor) || 0;
    setForm((prev) => ({ ...prev, cantidad: valor }));
    setCantidadManual(true);

    // Reverse-calculate monto and porcentaje
    const monto = cant * precioNum;
    setMontoInvertir(monto > 0 ? String(monto.toFixed(2)) : '');

    if (capitalTotal > 0 && monto > 0) {
      const pct = (monto / capitalTotal) * 100;
      setPorcentaje(String(Math.min(pct, 100).toFixed(1)));
    } else {
      setPorcentaje('');
    }
  }, [precioNum, capitalTotal]);

  // ─── Handlers ─────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (erroresValidacion[name]) {
      setErroresValidacion((prev) => {
        const nuevos = { ...prev };
        delete nuevos[name];
        return nuevos;
      });
    }
  };

  const handleTickerInputChange = (e) => {
    const value = e.target.value;
    setTickerQuery(value);
    setDropdownAbierto(true);
    setForm((prev) => ({ ...prev, ticker: value }));
    if (erroresValidacion.ticker) {
      setErroresValidacion((prev) => {
        const nuevos = { ...prev };
        delete nuevos.ticker;
        return nuevos;
      });
    }
  };

  const handleTickerSelect = (ticker) => {
    seleccionarTicker(ticker);
    setForm((prev) => ({ ...prev, ticker }));
    tickerInputRef.current?.focus();
  };

  const handlePrecioChange = (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, precio_unitario: value }));
    setPrecioEditadoManualmente(true);
    if (erroresValidacion.precio_unitario) {
      setErroresValidacion((prev) => {
        const nuevos = { ...prev };
        delete nuevos.precio_unitario;
        return nuevos;
      });
    }
  };

  const handleTickerKeyDownWrapper = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (indiceActivo >= 0 && sugerencias[indiceActivo]) {
        handleTickerSelect(sugerencias[indiceActivo]);
      } else if (sugerencias.length > 0 && dropdownAbierto) {
        handleTickerSelect(sugerencias[0]);
      }
      return;
    }
    handleTickerKeyDown(e);
  };

  const validar = () => {
    const errores = {};

    if (!form.ticker.trim()) {
      errores.ticker = 'El ticker es requerido.';
    }
    if (!form.fecha) {
      errores.fecha = 'La fecha es requerida.';
    }
    if (form.precio_unitario !== '' && Number(form.precio_unitario) < 0) {
      errores.precio_unitario = 'El precio no puede ser negativo.';
    }
    if (form.cantidad !== '' && Number(form.cantidad) < 0) {
      errores.cantidad = 'La cantidad no puede ser negativa.';
    }
    if (form.comision !== '' && Number(form.comision) < 0) {
      errores.comision = 'La comisión no puede ser negativa.';
    }

    setErroresValidacion(errores);
    return Object.keys(errores).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) return;

    const tipo = esDividendo ? 'dividendo' : 'compra';
    const estado = autoPendiente ? 'pendiente' : 'confirmada';

    onSubmit({
      ticker: form.ticker.trim().toUpperCase(),
      tipo,
      fecha: form.fecha,
      precio_unitario: Number(form.precio_unitario) || 0,
      cantidad: Number(form.cantidad) || 0,
      comision: esDividendo ? 0 : Number(form.comision) || 0,
      moneda: form.moneda,
      notas: form.notas.trim() || null,
      estado,
    });
  };

  const handleCerrar = () => {
    setForm({
      ticker: '',
      fecha: new Date().toISOString().split('T')[0],
      precio_unitario: '',
      cantidad: '',
      comision: '0',
      moneda: 'MXN',
      notas: '',
    });
    setEsDividendo(false);
    setErroresValidacion({});
    setTickerQuery('');
    setDropdownAbierto(false);
    setPrecioEditadoManualmente(false);
    setMontoInvertir('');
    setPorcentaje('');
    setCantidadManual(false);
    onCerrar();
  };

  const inputClasses = (campo) =>
    `w-full px-3 py-2 rounded-lg bg-bloomberg-bg border text-sm text-bloomberg-text
     placeholder-bloomberg-text-muted/50 focus:outline-none focus:ring-1
     focus:ring-bloomberg-accent transition-colors
     ${erroresValidacion[campo] ? 'border-bloomberg-red/50' : 'border-white/10'}`;

  const listboxId = 'tx-ticker-listbox';

  return (
    <Modal abierto={abierto} onCerrar={handleCerrar} titulo="Agregar Activo" ancho="max-w-xl">
      <form onSubmit={handleSubmit} noValidate aria-label="Formulario de transacción">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                          text-sm text-bloomberg-red" role="alert">
            {error}
          </div>
        )}

        {/* Capital banner — always show when capitalTotal > 0 */}
        {capitalTotal > 0 && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-bloomberg-panel border border-white/5
                          flex items-center gap-3 text-xs">
            <span className="text-bloomberg-text-muted">
              Capital: <span className="text-bloomberg-text font-medium">{formatMoneda(capitalTotal, bannerMoneda)}</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-bloomberg-text-muted">
              Invertido: <span className="text-bloomberg-text font-medium">{formatMoneda(valorInvertido, bannerMoneda)}</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-bloomberg-text-muted">
              Disponible:{' '}
              <span className={`font-medium ${capitalDisponible > 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}`}>
                {formatMoneda(capitalDisponible, bannerMoneda)}
              </span>
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Ticker with autocomplete (Task 6.1) */}
          <div ref={tickerContainerRef} className="relative">
            <label htmlFor="tx-ticker" className="block text-xs text-bloomberg-text-muted mb-1">
              Ticker *
            </label>
            <input
              ref={tickerInputRef}
              id="tx-ticker"
              name="ticker"
              type="text"
              value={tickerQuery}
              onChange={handleTickerInputChange}
              onFocus={() => {
                if (tickerQuery.trim() && sugerencias.length > 0) setDropdownAbierto(true);
              }}
              onKeyDown={handleTickerKeyDownWrapper}
              placeholder="Ej. AAPL, AMXL.MX"
              className={inputClasses('ticker')}
              required
              aria-required="true"
              aria-invalid={!!erroresValidacion.ticker}
              role="combobox"
              aria-expanded={dropdownAbierto && sugerencias.length > 0}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                indiceActivo >= 0 ? `tx-ticker-option-${indiceActivo}` : undefined
              }
              autoComplete="off"
            />

            {/* Autocomplete dropdown */}
            {dropdownAbierto && sugerencias.length > 0 && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Sugerencias de tickers"
                className="absolute z-[60] mt-1 w-full max-h-48 overflow-y-auto rounded-lg
                           bg-bloomberg-panel border border-white/10 shadow-xl"
              >
                {sugerencias.map((ticker, idx) => {
                  const nombre = obtenerNombre(ticker);
                  const isActive = idx === indiceActivo;
                  return (
                    <li
                      key={ticker}
                      id={`tx-ticker-option-${idx}`}
                      role="option"
                      aria-selected={isActive}
                      className={`px-3 py-2 cursor-pointer transition-colors border-b border-white/5
                        last:border-b-0
                        ${isActive ? 'bg-bloomberg-accent/15' : 'hover:bg-white/5'}`}
                      onClick={() => handleTickerSelect(ticker)}
                      onMouseEnter={() => setIndiceActivo(idx)}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-bloomberg-accent shrink-0">
                          {ticker}
                        </span>
                        <span className="text-xs text-bloomberg-text-muted">—</span>
                        <span className="text-sm text-bloomberg-text truncate">
                          {nombre}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {erroresValidacion.ticker && (
              <p className="text-xs text-bloomberg-red mt-1" role="alert">{erroresValidacion.ticker}</p>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label htmlFor="tx-fecha" className="block text-xs text-bloomberg-text-muted mb-1">
              Fecha *
            </label>
            <input
              id="tx-fecha"
              name="fecha"
              type="date"
              value={form.fecha}
              onChange={handleChange}
              className={inputClasses('fecha')}
              required
              aria-required="true"
              aria-invalid={!!erroresValidacion.fecha}
            />
            {erroresValidacion.fecha && (
              <p className="text-xs text-bloomberg-red mt-1" role="alert">{erroresValidacion.fecha}</p>
            )}
          </div>

          {/* Precio unitario with auto-fill and loading indicator (Task 6.2) */}
          <div>
            <label htmlFor="tx-precio" className="block text-xs text-bloomberg-text-muted mb-1">
              {esDividendo ? 'Monto por acción' : 'Precio unitario'}
            </label>
            <div className="relative">
              <input
                id="tx-precio"
                name="precio_unitario"
                type="number"
                step="0.01"
                min="0"
                value={form.precio_unitario}
                onChange={handlePrecioChange}
                placeholder="0.00"
                className={inputClasses('precio_unitario')}
                aria-invalid={!!erroresValidacion.precio_unitario}
              />
              {precioCargando && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Cargando precio">
                  <svg
                    className="w-4 h-4 animate-spin text-bloomberg-accent"
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
                </div>
              )}
            </div>
            {erroresValidacion.precio_unitario && (
              <p className="text-xs text-bloomberg-red mt-1" role="alert">{erroresValidacion.precio_unitario}</p>
            )}
          </div>

          {/* Cantidad */}
          <div>
            <label htmlFor="tx-cantidad" className="block text-xs text-bloomberg-text-muted mb-1">
              {esDividendo ? 'Acciones con derecho' : 'Cantidad'}
            </label>
            <input
              id="tx-cantidad"
              name="cantidad"
              type="number"
              step="1"
              min="0"
              value={form.cantidad}
              onChange={(e) => handleCantidadDirecta(e.target.value)}
              placeholder="0"
              className={`${inputClasses('cantidad')} ${!cantidadManual && cantidadNum > 0 && !esDividendo ? 'border-bloomberg-accent/30' : ''}`}
              aria-invalid={!!erroresValidacion.cantidad}
              aria-describedby="tx-cantidad-note"
            />
            {!cantidadManual && cantidadNum > 0 && !esDividendo && (
              <p id="tx-cantidad-note" className="text-[10px] text-bloomberg-accent/70 mt-0.5">
                Calculado automáticamente
              </p>
            )}
            {erroresValidacion.cantidad && (
              <p className="text-xs text-bloomberg-red mt-1" role="alert">{erroresValidacion.cantidad}</p>
            )}
          </div>

          {/* ─── Asignación section (full-width, only for compra mode) ── */}
          {!esDividendo && (
            <div className="col-span-2 my-1">
              {/* Section divider */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted font-medium">
                  Asignación
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Monto a invertir — slider + input */}
                <div>
                  <label htmlFor="tx-monto" className="block text-xs text-bloomberg-text-muted mb-1">
                    Monto a invertir
                  </label>
                  <input
                    id="tx-monto"
                    type="number"
                    step="100"
                    min="0"
                    value={montoInvertir}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    placeholder="0.00"
                    className={`${inputClasses('_monto')} mb-1.5`}
                    aria-describedby="tx-monto-desc"
                  />
                  <input
                    type="range"
                    min="0"
                    max={capitalTotal > 0 ? capitalDisponible : montoSliderMax}
                    step="100"
                    value={parseFloat(montoInvertir) || 0}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                               bg-white/10 accent-bloomberg-accent"
                    aria-label="Slider monto a invertir"
                  />
                  <div className="flex justify-between text-[10px] text-bloomberg-text-muted mt-0.5">
                    <span>$0</span>
                    <span>{formatMoneda(capitalTotal > 0 ? capitalDisponible : montoSliderMax, form.moneda)}</span>
                  </div>
                </div>

                {/* Porcentaje de cartera — slider + input (only meaningful with capitalTotal) */}
                <div>
                  <label htmlFor="tx-pct" className="block text-xs text-bloomberg-text-muted mb-1">
                    {capitalTotal > 0 ? '% de cartera' : '% del monto'}
                  </label>
                  {capitalTotal > 0 ? (
                    <>
                      <input
                        id="tx-pct"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={porcentaje}
                        onChange={(e) => handlePorcentajeChange(e.target.value)}
                        placeholder="0.0"
                        className={`${inputClasses('_pct')} mb-1.5`}
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.5"
                        value={parseFloat(porcentaje) || 0}
                        onChange={(e) => handlePorcentajeChange(e.target.value)}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                                   bg-white/10 accent-bloomberg-accent"
                        aria-label="Slider porcentaje de cartera"
                      />
                      <div className="flex justify-between text-[10px] text-bloomberg-text-muted mt-0.5">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center h-[38px] px-3 rounded-lg bg-bloomberg-bg border border-white/10">
                      <span className="text-xs text-bloomberg-text-muted">
                        {montoInvertir && precioNum > 0
                          ? `${((cantidadNum * precioNum) / (parseFloat(montoInvertir) || 1) * 100).toFixed(1)}% utilizado`
                          : 'Ingresa monto y precio'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Calculated quantity display */}
              {precioNum > 0 && cantidadNum > 0 && (
                <div className="mt-3 px-3 py-2.5 rounded-lg bg-bloomberg-accent/5 border border-bloomberg-accent/20">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-lg font-bold text-bloomberg-accent">
                        {formatNumero(cantidadNum, 0)}
                      </span>
                      <span className="text-sm text-bloomberg-text-muted ml-1.5">
                        títulos de <span className="text-bloomberg-text font-medium">{tickerDisplay}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-bloomberg-text-muted">Costo total: </span>
                      <span className="text-sm font-medium text-bloomberg-text">
                        {formatMoneda(costoTotal, form.moneda)}
                      </span>
                    </div>
                  </div>
                  {precioNum > 0 && (
                    <p className="text-[10px] text-bloomberg-text-muted mt-1" id="tx-monto-desc">
                      a {formatMoneda(precioNum, form.moneda)} por título
                      {montoInvertir && costoTotal < parseFloat(montoInvertir)
                        ? ` · Sobrante: ${formatMoneda(parseFloat(montoInvertir) - costoTotal, form.moneda)}`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Divider bottom */}
              <div className="h-px bg-white/10 mt-3" />
            </div>
          )}

          {/* Comisión — only for compra mode */}
          {!esDividendo && (
            <div>
              <label htmlFor="tx-comision" className="block text-xs text-bloomberg-text-muted mb-1">
                Comisión
              </label>
              <input
                id="tx-comision"
                name="comision"
                type="number"
                step="0.01"
                min="0"
                value={form.comision}
                onChange={handleChange}
                placeholder="0.00"
                className={inputClasses('comision')}
                aria-invalid={!!erroresValidacion.comision}
              />
              {erroresValidacion.comision && (
                <p className="text-xs text-bloomberg-red mt-1" role="alert">{erroresValidacion.comision}</p>
              )}
            </div>
          )}

          {/* Moneda */}
          <div>
            <label htmlFor="tx-moneda" className="block text-xs text-bloomberg-text-muted mb-1">
              Moneda
            </label>
            <select
              id="tx-moneda"
              name="moneda"
              value={form.moneda}
              onChange={handleChange}
              className={inputClasses('moneda')}
            >
              <option value="USD">USD</option>
              <option value="MXN">MXN</option>
            </select>
          </div>

          {/* Notas — ocupa 2 columnas */}
          <div className="col-span-2">
            <label htmlFor="tx-notas" className="block text-xs text-bloomberg-text-muted mb-1">
              Notas
            </label>
            <textarea
              id="tx-notas"
              name="notas"
              value={form.notas}
              onChange={handleChange}
              rows={2}
              placeholder="Notas opcionales sobre la operación..."
              className={`${inputClasses('notas')} resize-none`}
            />
          </div>
        </div>

        {/* ─── Dividendo toggle ───────────────────────────────────── */}
        <div className="mt-4 mb-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={esDividendo}
              onChange={(e) => setEsDividendo(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-bloomberg-bg text-bloomberg-accent
                         focus:ring-bloomberg-accent focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-bloomberg-text-muted">
              ☐ Registrar dividendo
            </span>
          </label>
          {esDividendo && (
            <p className="text-[10px] text-bloomberg-text-muted mt-1 ml-6">
              Se registrará como dividendo: monto por acción × acciones con derecho
            </p>
          )}
        </div>

        {/* Auto-pending warning */}
        {autoPendiente && (
          <div
            className="mb-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30
                        text-sm text-yellow-400 flex items-start gap-2"
            role="alert"
          >
            <span className="shrink-0">⚠</span>
            <span>Capital insuficiente — se registrará como pendiente</span>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={handleCerrar}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                       hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                       hover:bg-bloomberg-accent/80 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors"
            aria-label="Agregar activo"
          >
            {loading ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

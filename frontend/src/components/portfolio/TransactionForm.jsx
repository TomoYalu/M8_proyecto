import { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import useTickerAutocomplete, { obtenerNombre } from '../../hooks/useTickerAutocomplete';
import usePrecioHistorico from '../../hooks/usePrecioHistorico';

/**
 * Modal para registrar una transacción de compra/venta/dividendo.
 *
 * Campos: ticker, tipo, fecha, precio_unitario, cantidad, comision,
 * moneda (MXN/USD), notas.
 *
 * @param {object} props
 * @param {boolean} props.abierto - Controla visibilidad del modal
 * @param {function} props.onCerrar - Callback al cerrar
 * @param {function} props.onSubmit - Callback con datos del formulario
 * @param {boolean} [props.loading] - Estado de carga
 * @param {string} [props.error] - Mensaje de error
 * @param {string} [props.tickerPrellenado] - Ticker pre-llenado desde búsqueda rápida
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
}) {
  const [form, setForm] = useState({
    ticker: '',
    tipo: 'compra',
    fecha: new Date().toISOString().split('T')[0],
    precio_unitario: '',
    cantidad: '',
    comision: '0',
    moneda: 'MXN',
    notas: '',
  });

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

  // ─── Initialize ticker from tickerPrellenado when modal opens ─
  useEffect(() => {
    if (abierto && tickerPrellenado) {
      setForm((prev) => ({ ...prev, ticker: tickerPrellenado }));
      setTickerQuery(tickerPrellenado);
    }
  }, [abierto, tickerPrellenado, setTickerQuery]);

  // ─── Sync autocomplete selection → form state ─────────────────
  // When the user selects a ticker from the dropdown, the hook updates
  // tickerQuery. We need to sync that back to form.ticker.
  const prevTickerQueryRef = useRef(tickerQuery);
  useEffect(() => {
    // Only sync when tickerQuery changes and dropdown is closed (i.e. selection happened)
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

  // ─── Handlers ─────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear validation error for the field
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
    // Clear validation error
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
    // Clear validation error
    if (erroresValidacion.precio_unitario) {
      setErroresValidacion((prev) => {
        const nuevos = { ...prev };
        delete nuevos.precio_unitario;
        return nuevos;
      });
    }
  };

  const handleTickerKeyDownWrapper = (e) => {
    // Always prevent Enter from submitting the form when in the ticker field
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // If a suggestion is selected, use it
      if (indiceActivo >= 0 && sugerencias[indiceActivo]) {
        handleTickerSelect(sugerencias[indiceActivo]);
      } else if (sugerencias.length > 0 && dropdownAbierto) {
        // If dropdown is open with suggestions but none selected, pick the first one
        handleTickerSelect(sugerencias[0]);
      }
      return;
    }
    // Let the autocomplete hook handle navigation keys
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

    onSubmit({
      ticker: form.ticker.trim().toUpperCase(),
      tipo: form.tipo,
      fecha: form.fecha,
      precio_unitario: Number(form.precio_unitario) || 0,
      cantidad: Number(form.cantidad) || 0,
      comision: Number(form.comision) || 0,
      moneda: form.moneda,
      notas: form.notas.trim() || null,
    });
  };

  const handleCerrar = () => {
    setForm({
      ticker: '',
      tipo: 'compra',
      fecha: new Date().toISOString().split('T')[0],
      precio_unitario: '',
      cantidad: '',
      comision: '0',
      moneda: 'MXN',
      notas: '',
    });
    setErroresValidacion({});
    setTickerQuery('');
    setDropdownAbierto(false);
    setPrecioEditadoManualmente(false);
    onCerrar();
  };

  const inputClasses = (campo) =>
    `w-full px-3 py-2 rounded-lg bg-bloomberg-bg border text-sm text-bloomberg-text
     placeholder-bloomberg-text-muted/50 focus:outline-none focus:ring-1
     focus:ring-bloomberg-accent transition-colors
     ${erroresValidacion[campo] ? 'border-bloomberg-red/50' : 'border-white/10'}`;

  const listboxId = 'tx-ticker-listbox';

  return (
    <Modal abierto={abierto} onCerrar={handleCerrar} titulo="Registrar Transacción" ancho="max-w-xl">
      <form onSubmit={handleSubmit} noValidate aria-label="Formulario de transacción">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                          text-sm text-bloomberg-red" role="alert">
            {error}
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

          {/* Tipo */}
          <div>
            <label htmlFor="tx-tipo" className="block text-xs text-bloomberg-text-muted mb-1">
              Tipo de operación *
            </label>
            <select
              id="tx-tipo"
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              className={inputClasses('tipo')}
              required
              aria-required="true"
            >
              <option value="compra">Compra</option>
              <option value="venta">Venta</option>
              <option value="dividendo">Dividendo</option>
            </select>
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
              Precio unitario
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
              {/* Loading spinner while fetching price */}
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
              Cantidad
            </label>
            <input
              id="tx-cantidad"
              name="cantidad"
              type="number"
              step="0.000001"
              min="0"
              value={form.cantidad}
              onChange={handleChange}
              placeholder="0"
              className={inputClasses('cantidad')}
              aria-invalid={!!erroresValidacion.cantidad}
            />
            {erroresValidacion.cantidad && (
              <p className="text-xs text-bloomberg-red mt-1" role="alert">{erroresValidacion.cantidad}</p>
            )}
          </div>

          {/* Comisión */}
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

        {/* Botones */}
        <div className="flex justify-end gap-3 mt-6">
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
            aria-label="Registrar transacción"
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

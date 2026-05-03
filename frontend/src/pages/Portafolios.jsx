import { useEffect, useState, useCallback } from 'react';
import usePortfolio from '../hooks/usePortfolio';
import useWebSocket from '../hooks/useWebSocket';
import useStore from '../store';

import ConsolidatedView from '../components/portfolio/ConsolidatedView';
import PortfolioSidebar from '../components/portfolio/PortfolioSidebar';
import PortfolioDetail from '../components/portfolio/PortfolioDetail';
import TransactionForm from '../components/portfolio/TransactionForm';
import PositionEditor from '../components/portfolio/PositionEditor';
import FavoritosPanel from '../components/portfolio/FavoritosPanel';
import SimulatorPanel from '../components/portfolio/SimulatorPanel';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import ErrorMessage from '../components/common/ErrorMessage';

/**
 * Página principal de gestión de portafolios — layout master-detail.
 *
 * Layout: Toggle "Portafolios" | "Simulador" arriba.
 *   - Portafolios: ConsolidatedView colapsable, 2 columnas (sidebar + detail)
 *   - Simulador: SimulatorPanel con formulario y resultados
 *
 * Incluye botón "Optimizar" en PortfolioDetail que abre OptimizerResults
 * como modal/overlay con los tickers del portafolio pre-cargados.
 *
 * Requisitos cubiertos: 1.1–1.5, 2.1–2.6, 3.1–3.7, 7.1, 7.4, 7.6, 12.1–12.7
 */
export default function Portafolios() {
  const {
    portafolios,
    portafolioActivo,
    posiciones,
    transacciones,
    consolidado,
    loading,
    error,
    limpiarError,
    fetchPortafolios,
    crearPortafolio,
    eliminarPortafolio,
    actualizarPortafolio,
    fetchPosiciones,
    fetchTransacciones,
    fetchConsolidado,
    setPortafolioActivo,
    registrarTransaccion,
    refrescarPrecios,
  } = usePortfolio();

  const preciosEnVivo = useStore((s) => s.preciosEnVivo);
  const { subscribe_portfolio, unsubscribe_portfolio } = useWebSocket();

  const {

  // ─── Estado local de modales ──────────────────────────────────
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalTransaccion, setModalTransaccion] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCapitalInicial, setFormCapitalInicial] = useState('');
  const [formMoneda, setFormMoneda] = useState('MXN');
  const [errorLocal, setErrorLocal] = useState(null);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [tickerPrellenado, setTickerPrellenado] = useState(null);
  const [cargaInicial, setCargaInicial] = useState(true);
  const [consolidadoColapsado, setConsolidadoColapsado] = useState(false);
  const [posicionEditando, setPosicionEditando] = useState(null);
  const [modalPosicionEditor, setModalPosicionEditor] = useState(false);
  const [errorPosicionEditor, setErrorPosicionEditor] = useState(null);
  const [loadingPosicionEditor, setLoadingPosicionEditor] = useState(false);

  const [vistaActiva, setVistaActiva] = useState('portafolios'); // 'portafolios' | 'simulador'

  // ─── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        await Promise.all([fetchPortafolios(), fetchConsolidado()]);
      } catch {
        // Error ya manejado por el hook
      } finally {
        setCargaInicial(false);
      }
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Refrescar portafolios al cambiar a pestaña "Portafolios" (Req 5.2) ──
  useEffect(() => {
    if (vistaActiva === 'portafolios' && !cargaInicial) {
      fetchPortafolios().catch(() => {});
      fetchConsolidado().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaActiva]);

  // ─── Suscripción WebSocket al seleccionar portafolio ──────────
  useEffect(() => {
    if (portafolioActivo) {
      subscribe_portfolio(portafolioActivo);
      fetchPosiciones(portafolioActivo)
        .then((posData) => {
          // Verificar si alguna posición tiene precio faltante (0 o null)
          const hayPreciosFaltantes = posData && posData.some(
            (pos) => pos.precio_actual === 0 || pos.precio_actual == null
          );
          if (hayPreciosFaltantes) {
            refrescarPrecios(portafolioActivo).catch(() => {});
          }
        })
        .catch(() => {});
      fetchTransacciones(portafolioActivo).catch(() => {});
    }
    return () => {
      if (portafolioActivo) {
        unsubscribe_portfolio(portafolioActivo);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portafolioActivo]);

  // ─── Handlers ─────────────────────────────────────────────────

  const handleSeleccionar = useCallback(
    (id) => {
      setPortafolioActivo(id === portafolioActivo ? null : id);
    },
    [portafolioActivo, setPortafolioActivo],
  );

  const handleCrear = async () => {
    if (!formNombre.trim()) {
      setErrorLocal('El nombre del portafolio es requerido.');
      return;
    }
    const capSolicitado = parseFloat(formCapitalInicial) || 0;
    if (capSolicitado > 0 && consolidado?.capital_global > 0) {
      const noAsignado = consolidado.capital_no_asignado ?? 0;
      if (capSolicitado > noAsignado) {
        setErrorLocal(`Capital excede el disponible global ($${noAsignado.toLocaleString()}).`);
        return;
      }
    }
    setLoadingLocal(true);
    setErrorLocal(null);
    try {
      await crearPortafolio(
        formNombre.trim(),
        formDescripcion.trim() || null,
        parseFloat(formCapitalInicial) || 0,
        formMoneda,
      );
      await fetchConsolidado();
      setModalCrear(false);
      setFormNombre('');
      setFormDescripcion('');
      setFormCapitalInicial('');
      setFormMoneda('MXN');
    } catch (err) {
      setErrorLocal(err.message);
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleEditar = (portafolio) => {
    setModalEditar(portafolio);
    setFormNombre(portafolio.nombre);
    setFormDescripcion(portafolio.descripcion || '');
    setFormCapitalInicial(String(portafolio.capital_inicial || ''));
    setFormMoneda(portafolio.moneda || 'MXN');
    setErrorLocal(null);
  };

  const handleGuardarEdicion = async () => {
    if (!formNombre.trim()) {
      setErrorLocal('El nombre del portafolio es requerido.');
      return;
    }
    const nuevoCapital = parseFloat(formCapitalInicial) || 0;
    if (nuevoCapital > 0 && consolidado?.capital_global > 0) {
      const portActual = consolidado.portafolios?.find(p => p.id === modalEditar.id);
      const capActual = portActual?.capital_inicial || 0;
      const maxPermitido = capActual + (consolidado.capital_no_asignado ?? 0);
      if (nuevoCapital > maxPermitido) {
        setErrorLocal(`Capital excede el máximo permitido ($${maxPermitido.toLocaleString()}).`);
        return;
      }
      if (portActual && nuevoCapital < portActual.costo_total) {
        setErrorLocal(`Capital no puede ser menor al invertido ($${portActual.costo_total.toLocaleString()}).`);
        return;
      }
    }
    setLoadingLocal(true);
    setErrorLocal(null);
    try {
      await actualizarPortafolio(modalEditar.id, {
        nombre: formNombre.trim(),
        descripcion: formDescripcion.trim() || null,
        capital_inicial: parseFloat(formCapitalInicial) || 0,
      });
      await fetchConsolidado();
      setModalEditar(null);
      setFormNombre('');
      setFormDescripcion('');
      setFormCapitalInicial('');
    } catch (err) {
      setErrorLocal(err.message);
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleEliminar = async (id) => {
    setConfirmandoEliminar(id);
  };

  const handleConfirmarEliminar = async () => {
    if (!confirmandoEliminar) return;
    try {
      await eliminarPortafolio(confirmandoEliminar);
      await fetchConsolidado();
      if (portafolioActivo === confirmandoEliminar) {
        setPortafolioActivo(null);
      }
    } catch {
      // Error ya manejado por el hook
    } finally {
      setConfirmandoEliminar(null);
    }
  };

  const handleRegistrarTransaccion = async (datos) => {
    if (!portafolioActivo) return;
    setLoadingLocal(true);
    setErrorLocal(null);
    try {
      await registrarTransaccion(portafolioActivo, datos);
      await fetchConsolidado();
      setModalTransaccion(false);
    } catch (err) {
      setErrorLocal(err.message);
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleCambiarPagina = (pagina) => {
    if (portafolioActivo) {
      fetchTransacciones(portafolioActivo, pagina).catch(() => {});
    }
  };

  const handleAbrirCrear = () => {
    setModalCrear(true);
    setErrorLocal(null);
    setFormNombre('');
    setFormDescripcion('');
    setFormCapitalInicial('');
    setFormMoneda('MXN');
  };

  // ─── Datos derivados ──────────────────────────────────────────
  const posicionesActivas = portafolioActivo ? (posiciones[portafolioActivo] ?? []) : [];



  // ─── Handler: Editar posición desde tabla (abre PositionEditor) ──
  const handleEditarPosicion = useCallback((posicion) => {
    if (!posicion?.id) return;
    setPosicionEditando(posicion);
    setModalPosicionEditor(true);
    setErrorPosicionEditor(null);
  }, []);

  const handleGuardarPosicion = async (posicionId, cantidadDeseada) => {
    if (!portafolioActivo) return;
    setLoadingPosicionEditor(true);
    setErrorPosicionEditor(null);
    try {
      const res = await fetch(
        `/api/portafolios/${portafolioActivo}/posiciones/${posicionId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cantidad_deseada: cantidadDeseada }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar posición');
      }
      await fetchPosiciones(portafolioActivo);
      await fetchTransacciones(portafolioActivo);
      await fetchConsolidado();
      setModalPosicionEditor(false);
      setPosicionEditando(null);
    } catch (err) {
      setErrorPosicionEditor(err.message);
    } finally {
      setLoadingPosicionEditor(false);
    }
  };

  // ─── Handler: Transacción pendiente confirmada/cancelada ──────
  const handleTransaccionActualizada = useCallback(async () => {
    if (!portafolioActivo) return;
    try {
      await fetchPosiciones(portafolioActivo);
      await fetchTransacciones(portafolioActivo);
      await fetchConsolidado();
    } catch {
      // Error ya manejado por el hook
    }
  }, [portafolioActivo, fetchPosiciones, fetchTransacciones, fetchConsolidado]);

  const transaccionesActivas = portafolioActivo ? transacciones[portafolioActivo] : null;
  const portafolioSeleccionado = portafolios.find((p) => p.id === portafolioActivo);

  const resumenPorPortafolio = {};
  if (consolidado?.portafolios) {
    for (const p of consolidado.portafolios) {
      resumenPorPortafolio[p.id] = p;
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  if (cargaInicial) {
    return <Spinner mensaje="Cargando portafolios..." />;
  }

  const inputClasses =
    'w-full px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/10 text-sm ' +
    'text-bloomberg-text placeholder-bloomberg-text-muted/50 focus:outline-none ' +
    'focus:ring-1 focus:ring-bloomberg-accent transition-colors';

  return (
    <div className="p-6 flex flex-col h-full min-h-0">
      {/* Error global */}
      {error && (
        <ErrorMessage
          mensaje={error}
          onReintentar={() => {
            limpiarError();
            fetchPortafolios();
          }}
        />
      )}

      {/* Toggle: Portafolios | Simulador */}
      <div className="shrink-0 mb-4 flex items-center gap-4">
        <div
          className="inline-flex rounded-lg bg-bloomberg-panel border border-white/5 p-0.5"
          role="tablist"
          aria-label="Vista principal"
        >
          <button
            role="tab"
            aria-selected={vistaActiva === 'portafolios'}
            onClick={() => setVistaActiva('portafolios')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors
              ${vistaActiva === 'portafolios'
                ? 'bg-bloomberg-accent text-white'
                : 'text-bloomberg-text-muted hover:text-bloomberg-text'
              }`}
          >
            Portafolios
          </button>
          <button
            role="tab"
            aria-selected={vistaActiva === 'simulador'}
            onClick={() => setVistaActiva('simulador')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors
              ${vistaActiva === 'simulador'
                ? 'bg-bloomberg-accent text-white'
                : 'text-bloomberg-text-muted hover:text-bloomberg-text'
              }`}
          >
            Simulador
          </button>
        </div>
      </div>

      {/* ─── Vista: Simulador ──────────────────────────────────── */}
      {vistaActiva === 'simulador' ? (
        <SimulatorPanel
          portafolioActivoId={portafolioActivo}
          portafolioActivoNombre={portafolioSeleccionado?.nombre}
        />
      ) : (
        <>
          {/* Vista consolidada colapsable */}
          <div className="shrink-0 mb-4">
            <button
              onClick={() => setConsolidadoColapsado(!consolidadoColapsado)}
              className="flex items-center gap-2 text-sm text-bloomberg-text-muted
                         hover:text-bloomberg-text transition-colors mb-2"
              aria-expanded={!consolidadoColapsado}
              aria-controls="consolidado-panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-4 h-4 transition-transform ${consolidadoColapsado ? '' : 'rotate-90'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Resumen Consolidado
            </button>
            {!consolidadoColapsado && (
              <div id="consolidado-panel">
                <ConsolidatedView consolidado={consolidado} onCapitalUpdated={fetchConsolidado} />
              </div>
            )}
          </div>

          {/* Layout master-detail de 2 columnas */}
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Columna izquierda — lista de portafolios + favoritos */}
            <div className="flex flex-col gap-3 w-[280px] min-w-[280px] min-h-0">
              <PortfolioSidebar
                portafolios={portafolios}
                resumenPorPortafolio={resumenPorPortafolio}
                portafolioActivo={portafolioActivo}
                onSeleccionar={handleSeleccionar}
                onCrear={handleAbrirCrear}
              />
                onDemoLoaded={async () => { await fetchPortafolios(); await fetchConsolidado(); }}

              {/* Panel de favoritos de sesión (B3) */}
              <FavoritosPanel
                onAgregar={(ticker) => {
                  setTickerPrellenado(ticker);
                  setModalTransaccion(true);
                  setErrorLocal(null);
                }}
              />
            </div>

            {/* Panel derecho — detalle o placeholder */}
            {portafolioActivo && portafolioSeleccionado ? (
              <PortfolioDetail
                portafolio={portafolioSeleccionado}
                posiciones={posicionesActivas}
                transacciones={transaccionesActivas}
                preciosEnVivo={preciosEnVivo}
                loading={loading}
                onEditar={handleEditar}
                onEliminar={handleEliminar}
                onRegistrarTransaccion={() => {
                  setTickerPrellenado(null);
                  setModalTransaccion(true);
                  setErrorLocal(null);
                }}
                onCambiarPagina={handleCambiarPagina}
                onAgregarTicker={(ticker) => {
                  setTickerPrellenado(ticker);
                  setModalTransaccion(true);
                  setErrorLocal(null);
                }}
                onEditarPosicion={handleEditarPosicion}
                onTransaccionActualizada={handleTransaccionActualizada}
              />
            ) : (
              <div
                className="flex-1 min-w-0 flex items-center justify-center bg-bloomberg-panel
                            rounded-xl border border-white/5"
                aria-label="Sin portafolio seleccionado"
              >
                <div className="text-center px-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-12 h-12 mx-auto text-bloomberg-text-muted/30 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <p className="text-bloomberg-text-muted text-sm">
                    Selecciona un portafolio de la lista para ver su detalle
                  </p>
                  {portafolios.length === 0 && (
                    <button
                      onClick={handleAbrirCrear}
                      className="mt-4 px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                                 hover:bg-bloomberg-accent/80 transition-colors"
                    >
                      Crear tu primer portafolio
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
        </div>
      </Modal>

      {/* Modal: Crear portafolio */}
      <Modal abierto={modalCrear} onCerrar={() => setModalCrear(false)} titulo="Crear Portafolio">
        <div className="space-y-4">
          {errorLocal && (
            <div
              className="p-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                          text-sm text-bloomberg-red"
              role="alert"
            >
              {errorLocal}
            </div>
          )}
          <div>
            <label htmlFor="crear-nombre" className="block text-xs text-bloomberg-text-muted mb-1">
              Nombre *
            </label>
            <input
              id="crear-nombre"
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="Ej. Portafolio Principal"
              className={inputClasses}
              required
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="crear-desc" className="block text-xs text-bloomberg-text-muted mb-1">
              Descripción
            </label>
            <textarea
              id="crear-desc"
              value={formDescripcion}
              onChange={(e) => setFormDescripcion(e.target.value)}
              placeholder="Descripción opcional..."
              rows={2}
              className={`${inputClasses} resize-none`}
            />
          </div>
          <div>
            <label htmlFor="crear-capital" className="block text-xs text-bloomberg-text-muted mb-1">
              Límite de capital <span class="text-bloomberg-text-muted/50">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="crear-capital"
                type="number"
                step="1000"
                min="0"
                value={formCapitalInicial}
                onChange={(e) => setFormCapitalInicial(e.target.value)}
                placeholder="Ej. 100000"
                className={`${inputClasses} flex-1`}
              />
              <select
                id="crear-moneda"
                value={formMoneda}
                onChange={(e) => setFormMoneda(e.target.value)}
                className={`${inputClasses} w-24`}
                aria-label="Moneda del portafolio"
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <p className="text-[10px] text-bloomberg-text-muted mt-0.5">
              Opcional. Limita cuánto se puede invertir en este portafolio. Sin límite usa capital global.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModalCrear(false)}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                         hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrear}
              disabled={loadingLocal}
              className="px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                         hover:bg-bloomberg-accent/80 disabled:opacity-50
                         disabled:cursor-not-allowed transition-colors"
            >
              {loadingLocal ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar portafolio */}
      <Modal
        abierto={!!modalEditar}
        onCerrar={() => setModalEditar(null)}
        titulo="Editar Portafolio"
      >
        <div className="space-y-4">
          {errorLocal && (
            <div
              className="p-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                          text-sm text-bloomberg-red"
              role="alert"
            >
              {errorLocal}
            </div>
          )}
          <div>
            <label htmlFor="editar-nombre" className="block text-xs text-bloomberg-text-muted mb-1">
              Nombre *
            </label>
            <input
              id="editar-nombre"
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              className={inputClasses}
              required
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="editar-desc" className="block text-xs text-bloomberg-text-muted mb-1">
              Descripción
            </label>
            <textarea
              id="editar-desc"
              value={formDescripcion}
              onChange={(e) => setFormDescripcion(e.target.value)}
              rows={2}
              className={`${inputClasses} resize-none`}
            />
          </div>
          <div>
            <label htmlFor="editar-capital" className="block text-xs text-bloomberg-text-muted mb-1">
              Límite de capital <span class="text-bloomberg-text-muted/50">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="editar-capital"
                type="number"
                step="1000"
                min="0"
                value={formCapitalInicial}
                onChange={(e) => setFormCapitalInicial(e.target.value)}
                placeholder="Ej. 100000"
                className={`${inputClasses} flex-1`}
              />
              <select
                id="editar-moneda"
                value={formMoneda}
                onChange={(e) => setFormMoneda(e.target.value)}
                className={`${inputClasses} w-24`}
                aria-label="Moneda del portafolio"
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModalEditar(null)}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                         hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarEdicion}
              disabled={loadingLocal}
              className="px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                         hover:bg-bloomberg-accent/80 disabled:opacity-50
                         disabled:cursor-not-allowed transition-colors"
            >
              {loadingLocal ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar eliminación */}
      <Modal
        abierto={!!confirmandoEliminar}
        onCerrar={() => setConfirmandoEliminar(null)}
        titulo="Eliminar Portafolio"
      >
        <div className="space-y-4">
          <p className="text-sm text-bloomberg-text">
            ¿Estás seguro de que deseas eliminar este portafolio? Se eliminarán todas las posiciones
            y transacciones asociadas. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmandoEliminar(null)}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                         hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmarEliminar}
              className="px-4 py-2 text-sm rounded-lg bg-bloomberg-red/20 text-bloomberg-red
                         hover:bg-bloomberg-red/30 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar activo */}
      <TransactionForm
        abierto={modalTransaccion}
        tickerPrellenado={tickerPrellenado}
        onCerrar={() => {
          setModalTransaccion(false);
          setTickerPrellenado(null);
          setErrorLocal(null);
        }}
        onSubmit={handleRegistrarTransaccion}
        loading={loadingLocal}
        error={errorLocal}
        capitalTotal={
          (portafolioSeleccionado?.capital_inicial || 0) > 0
            ? portafolioSeleccionado.capital_inicial
            : (consolidado?.capital_global || 0)
        }
        valorInvertido={
          (portafolioSeleccionado?.capital_inicial || 0) > 0
            ? posicionesActivas.reduce((sum, p) => sum + (p.costo_total || 0), 0)
            : (consolidado?.capital_global || 0) - (consolidado?.capital_no_asignado || 0)
        }
        moneda={portafolioSeleccionado?.moneda || 'MXN'}
      />

      {/* Modal: Editar posición */}
      <PositionEditor
        abierto={modalPosicionEditor}
        posicion={posicionEditando}
        onCerrar={() => {
          setModalPosicionEditor(false);
          setPosicionEditando(null);
          setErrorPosicionEditor(null);
        }}
        onGuardar={handleGuardarPosicion}
        loading={loadingPosicionEditor}
        error={errorPosicionEditor}
      />
    </div>
  );
}

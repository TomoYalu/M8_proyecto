/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Alertas
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useEffect, useState, useCallback } from 'react';
import useStore from '../store';

import AlertForm from '../components/alerts/AlertForm';
import AlertList from '../components/alerts/AlertList';
import AlertHistory from '../components/alerts/AlertHistory';
import Spinner from '../components/common/Spinner';
import ErrorMessage from '../components/common/ErrorMessage';

/**
 * Página completa de gestión de alertas.
 *
 * Layout: Botón crear + AlertList arriba, AlertHistory abajo.
 * Usa modal para crear/editar alertas.
 *
 * Requisitos cubiertos: 8.1–8.7, 12.1–12.7
 */
export default function Alertas() {
  const alertas = useStore((s) => s.alertas);
  const alertasHistorial = useStore((s) => s.alertasHistorial);
  const fetchAlertas = useStore((s) => s.fetchAlertas);
  const crearAlerta = useStore((s) => s.crearAlerta);
  const eliminarAlerta = useStore((s) => s.eliminarAlerta);
  const toggleAlerta = useStore((s) => s.toggleAlerta);
  const fetchHistorial = useStore((s) => s.fetchHistorial);
  const resetNoLeidas = useStore((s) => s.resetNoLeidas);
  const portafolios = useStore((s) => s.portafolios);
  const fetchPortafolios = useStore((s) => s.fetchPortafolios);

  const [modalCrear, setModalCrear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAccion, setLoadingAccion] = useState(false);
  const [error, setError] = useState(null);
  const [errorForm, setErrorForm] = useState(null);

  // ─── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        await Promise.all([
          fetchAlertas(),
          fetchHistorial(1),
          fetchPortafolios(),
        ]);
        resetNoLeidas();
      } catch (err) {
        setError(err.message || 'Error al cargar alertas');
      } finally {
        setLoading(false);
      }
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────

  const handleCrear = useCallback(async (datos) => {
    setLoadingAccion(true);
    setErrorForm(null);
    try {
      await crearAlerta(datos);
      setModalCrear(false);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setLoadingAccion(false);
    }
  }, [crearAlerta]);

  const handleToggle = useCallback(async (id) => {
    try {
      await toggleAlerta(id);
    } catch (err) {
      setError(err.message);
    }
  }, [toggleAlerta]);

  const handleEliminar = useCallback(async (id) => {
    try {
      await eliminarAlerta(id);
    } catch (err) {
      setError(err.message);
    }
  }, [eliminarAlerta]);

  const handleCambiarPagina = useCallback(async (pagina) => {
    try {
      await fetchHistorial(pagina);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchHistorial]);

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return <Spinner mensaje="Cargando alertas..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* TODO: IMPLEMENTACIÓN PENDIENTE */}
      <div className="p-4 rounded-lg bg-bloomberg-yellow/10 border border-bloomberg-yellow/30 text-center">
        <p className="text-sm font-medium text-bloomberg-yellow">🚧 IMPLEMENTACIÓN PENDIENTE</p>
        <p className="text-xs text-bloomberg-text-muted mt-1">Este módulo está en desarrollo. La funcionalidad completa estará disponible próximamente.</p>
      </div>
      {/* Error global */}
      {error && (
        <ErrorMessage
          mensaje={error}
          onReintentar={() => {
            setError(null);
            fetchAlertas().catch(() => {});
          }}
        />
      )}

      {/* Encabezado + botón crear */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-bloomberg-text">Alertas</h1>
          <p className="text-sm text-bloomberg-text-muted mt-1">
            Configura alertas automáticas para tus tickers favoritos.
          </p>
        </div>
        <button
          onClick={() => {
            setModalCrear(true);
            setErrorForm(null);
          }}
          className="px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                     hover:bg-bloomberg-accent/80 transition-colors flex items-center gap-2"
          aria-label="Crear nueva alerta"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Alerta
        </button>
      </div>

      {/* Lista de alertas */}
      <section aria-label="Alertas configuradas">
        <h2 className="text-lg font-semibold text-bloomberg-text mb-3">
          Alertas Activas ({alertas.length})
        </h2>
        <AlertList
          alertas={alertas}
          onToggle={handleToggle}
          onEliminar={handleEliminar}
        />
      </section>

      {/* Historial */}
      <section aria-label="Historial de alertas disparadas">
        <h2 className="text-lg font-semibold text-bloomberg-text mb-3">
          Historial de Alertas Disparadas
        </h2>
        <AlertHistory
          historial={alertasHistorial}
          onCambiarPagina={handleCambiarPagina}
          loading={loadingAccion}
        />
      </section>

      {/* Modal: Crear alerta */}
      <AlertForm
        abierto={modalCrear}
        onCerrar={() => setModalCrear(false)}
        onSubmit={handleCrear}
        portafolios={portafolios}
        loading={loadingAccion}
        error={errorForm}
      />
    </div>
  );
}

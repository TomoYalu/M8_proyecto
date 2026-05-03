import { useState, useEffect, useCallback } from 'react';

/**
 * Mapa de tipos de alerta a nombres en español.
 */
const TIPO_NOMBRES = {
  precio_objetivo: 'Precio Objetivo',
  cambio_pct_dia: 'Cambio % Diario',
  rsi_sobrecompra: 'RSI Sobrecompra',
  rsi_sobreventa: 'RSI Sobreventa',
  golden_cross: 'Golden Cross',
  death_cross: 'Death Cross',
  divergencia_macd: 'Divergencia MACD',
  semaforo_rojo: 'Semáforo Rojo',
  concentracion: 'Concentración',
};

/**
 * Componente de notificación toast que aparece cuando se dispara
 * un evento `alert_triggered` via WebSocket.
 *
 * - Muestra ticker, tipo y descripción
 * - Auto-dismiss después de 5 segundos
 * - Soporta múltiples notificaciones apiladas
 *
 * Requisitos cubiertos: 8.3, 12.1, 12.7
 */
export default function NotificationBadge() {
  const [notificaciones, setNotificaciones] = useState([]);

  /**
   * Agrega una notificación al stack.
   * Se expone globalmente para que useWebSocket pueda llamarla.
   */
  const agregarNotificacion = useCallback((data) => {
    const id = Date.now() + Math.random();
    const nueva = { id, ...data };
    setNotificaciones((prev) => [...prev, nueva]);

    // Auto-dismiss después de 5 segundos
    setTimeout(() => {
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  // Exponer la función globalmente para que useWebSocket pueda usarla
  useEffect(() => {
    window.__lakshmiNotificar = agregarNotificacion;
    return () => {
      delete window.__lakshmiNotificar;
    };
  }, [agregarNotificacion]);

  const cerrar = (id) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id));
  };

  if (notificaciones.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
      aria-live="polite"
      aria-label="Notificaciones de alertas"
    >
      {notificaciones.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 p-4 rounded-lg bg-bloomberg-panel
                     border border-bloomberg-accent/30 shadow-lg shadow-black/30
                     animate-[slideIn_0.3s_ease-out]"
          role="alert"
        >
          {/* Icono */}
          <div className="shrink-0 mt-0.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-bloomberg-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11
                   a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341
                   C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436
                   L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-bloomberg-accent">
                {n.ticker}
              </span>
              <span className="text-xs text-bloomberg-text-muted">
                {TIPO_NOMBRES[n.tipo] || n.tipo}
              </span>
            </div>
            <p className="text-xs text-bloomberg-text-muted mt-1">
              Valor actual: {n.valor_actual != null ? n.valor_actual : '—'}
              {n.umbral != null && ` | Umbral: ${n.umbral}`}
            </p>
          </div>

          {/* Botón cerrar */}
          <button
            onClick={() => cerrar(n.id)}
            className="shrink-0 p-1 rounded text-bloomberg-text-muted
                       hover:text-bloomberg-text hover:bg-white/5 transition-colors"
            aria-label="Cerrar notificación"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Layout
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import useStore from '../../store';
import { formatFecha } from '../../utils/formatters';
import {
  BLOOMBERG_GREEN,
  BLOOMBERG_RED,
  BLOOMBERG_TEXT_MUTED,
} from '../../utils/colors';

/**
 * Banner de tipo de cambio USD/MXN estilo Bloomberg.
 *
 * - Barra compacta fija debajo del Navbar
 * - Muestra: par USD/MXN, precio (4 decimales), cambio del día
 *   (absoluto con signo y porcentual), hora de última actualización
 * - Verde si cambio positivo, rojo si negativo, muted si cero/null
 * - Fetch inicial desde GET /api/fiscal/tipo-cambio
 * - Actualizaciones en tiempo real vía WebSocket (exchange_rate_updated)
 * - Polling de respaldo cada 5 minutos
 *
 * Requisitos: plan-v1.1 Bloque A2
 */

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

export default function ExchangeRateBanner() {
  const tipoCambio = useStore((s) => s.tipoCambio);
  const setTipoCambio = useStore((s) => s.setTipoCambio);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef(null);
  const [reloj, setReloj] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Fetch tipo de cambio desde API ─────────────────────────
  const fetchTipoCambio = async () => {
    try {
      const res = await fetch('/api/fiscal/tipo-cambio');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTipoCambio(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch inicial
    fetchTipoCambio();

    // Polling de respaldo cada 5 minutos
    intervalRef.current = setInterval(fetchTipoCambio, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derivar color y signo del cambio ───────────────────────
  const cambio = tipoCambio.cambio_dia;
  const cambioPct = tipoCambio.cambio_pct;
  const hasCambio = cambio != null && cambioPct != null;

  let changeColor = BLOOMBERG_TEXT_MUTED;
  let arrow = '';
  if (hasCambio) {
    if (cambio > 0) {
      changeColor = BLOOMBERG_GREEN;
      arrow = '▲';
    } else if (cambio < 0) {
      changeColor = BLOOMBERG_RED;
      arrow = '▼';
    }
  }

  // Formatear precio a 4 decimales
  const precioStr =
    tipoCambio.precio != null ? tipoCambio.precio.toFixed(4) : '—';

  // Formatear cambio absoluto con signo
  const cambioAbsStr = hasCambio
    ? `${cambio > 0 ? '+' : ''}${cambio.toFixed(4)}`
    : '—';

  // Formatear cambio porcentual
  const cambioPctStr = hasCambio
    ? `${cambioPct > 0 ? '+' : ''}${cambioPct.toFixed(2)}%`
    : '—';

  // Hora de última actualización
  const ultimaAct = tipoCambio.ultima_actualizacion
    ? formatFecha(tipoCambio.ultima_actualizacion, true)
    : '—';

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="h-8 border-b border-white/5 flex items-center justify-center shrink-0"
        style={{ background: 'rgba(10, 14, 12, 0.4)' }}
        role="status"
        aria-label="Cargando tipo de cambio"
      >
        <span className="text-xs text-bloomberg-text-muted animate-pulse">
          Cargando tipo de cambio…
        </span>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────
  if (error && tipoCambio.precio == null) {
    return (
      <div
        className="h-8 border-b border-white/5 flex items-center justify-center shrink-0"
        style={{ background: 'rgba(10, 14, 12, 0.4)' }}
        role="status"
        aria-label="Error al cargar tipo de cambio"
      >
        <span className="text-xs text-bloomberg-text-muted">
          USD/MXN no disponible
        </span>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div
      className="h-8 border-b border-white/5
                 flex items-center px-6 gap-4 shrink-0 overflow-hidden"
      style={{ background: 'rgba(10, 14, 12, 0.4)' }}
      role="status"
      aria-live="polite"
      aria-label={`Tipo de cambio USD/MXN: ${precioStr}, cambio del día: ${cambioAbsStr} (${cambioPctStr})`}
    >
      {/* Par de divisas */}
      <span className="text-sm font-semibold tracking-wide text-cyan-400">
        USD/MXN
      </span>

      {/* Precio */}
      <span className="text-sm font-mono font-semibold text-white">
        {precioStr}
      </span>

      {/* Cambio del día */}
      <span
        className="text-sm font-mono flex items-center gap-1"
        style={{ color: changeColor }}
      >
        {arrow && (
          <span className="text-xs leading-none" aria-hidden="true">
            {arrow}
          </span>
        )}
        <span>{cambioAbsStr}</span>
        <span className="opacity-75">({cambioPctStr})</span>
      </span>

      {/* Separador */}
      <span className="text-white/10 select-none" aria-hidden="true">
        │
      </span>

      {/* Reloj en vivo con fecha */}
      <span className="text-sm font-mono text-bloomberg-text ml-auto tabular-nums">
        {reloj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
        {' · '}
        {reloj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Mexico_City' })}
        <span className="text-bloomberg-text-muted ml-1 text-xs">CDMX</span>
      </span>
    </div>
  );
}

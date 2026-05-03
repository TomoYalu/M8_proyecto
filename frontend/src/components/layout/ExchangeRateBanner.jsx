import { useEffect, useState, useRef } from 'react';
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
        className="h-7 bg-bloomberg-bg border-b border-white/5
                   flex items-center justify-center shrink-0"
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
        className="h-7 bg-bloomberg-bg border-b border-white/5
                   flex items-center justify-center shrink-0"
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
      className="h-7 bg-bloomberg-bg border-b border-white/5
                 flex items-center px-6 gap-4 shrink-0 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={`Tipo de cambio USD/MXN: ${precioStr}, cambio del día: ${cambioAbsStr} (${cambioPctStr})`}
    >
      {/* Par de divisas */}
      <span className="text-xs font-semibold tracking-wide text-bloomberg-accent">
        USD/MXN
      </span>

      {/* Precio */}
      <span className="text-xs font-mono font-medium text-bloomberg-text">
        {precioStr}
      </span>

      {/* Cambio del día */}
      <span
        className="text-xs font-mono flex items-center gap-1"
        style={{ color: changeColor }}
      >
        {arrow && (
          <span className="text-[10px] leading-none" aria-hidden="true">
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

      {/* Última actualización */}
      <span className="text-[10px] text-bloomberg-text-muted">
        {ultimaAct}
      </span>

      {/* Fuente (sutil) */}
      {tipoCambio.fuente && (
        <span className="text-[10px] text-white/20 ml-auto hidden sm:inline">
          {tipoCambio.fuente === 'banxico_api'
            ? 'Banxico'
            : tipoCambio.fuente === 'cache'
              ? 'Caché'
              : 'Estático'}
        </span>
      )}
    </div>
  );
}

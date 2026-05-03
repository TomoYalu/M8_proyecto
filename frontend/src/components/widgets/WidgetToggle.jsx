/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Dashboard Widgets
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
/**
 * WidgetToggle — Botón toggle (ícono de ojo) para mostrar/ocultar un widget.
 *
 * Se usa en paneles de configuración para controlar la visibilidad
 * de widgets individuales.
 *
 * Requisitos cubiertos: 5.1
 */

import useStore from '../../store/index';

/**
 * @param {object} props
 * @param {string} props.widgetId - ID del widget
 * @param {string} [props.nombre] - Nombre visible del widget (para aria-label)
 */
export default function WidgetToggle({ widgetId, nombre }) {
  const visible = useStore((s) => s.widgetConfig[widgetId]?.visible ?? false);
  const toggleWidget = useStore((s) => s.toggleWidget);

  const label = visible
    ? `Ocultar ${nombre || widgetId}`
    : `Mostrar ${nombre || widgetId}`;

  return (
    <button
      onClick={() => toggleWidget(widgetId)}
      className={`p-1.5 rounded-lg transition-colors ${
        visible
          ? 'text-bloomberg-accent hover:text-bloomberg-accent/70 bg-bloomberg-accent/10'
          : 'text-bloomberg-text-muted hover:text-bloomberg-text hover:bg-white/5'
      }`}
      aria-label={label}
      aria-pressed={visible}
      title={label}
    >
      {visible ? (
        /* Ícono de ojo abierto (visible) */
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
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      ) : (
        /* Ícono de ojo tachado (oculto) */
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
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
          />
        </svg>
      )}
    </button>
  );
}

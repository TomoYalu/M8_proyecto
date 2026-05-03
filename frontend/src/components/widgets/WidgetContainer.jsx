/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Dashboard Widgets
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
/**
 * WidgetContainer — Wrapper para cada widget del dashboard.
 *
 * Muestra una barra de título con el nombre del widget y un botón
 * toggle on/off en la esquina superior derecha. El contenido del
 * widget se renderiza como children.
 *
 * Requisitos cubiertos: 5.1
 */

import useStore from '../../store/index';

/**
 * @param {object} props
 * @param {string} props.widgetId - ID del widget
 * @param {string} props.titulo - Nombre visible del widget
 * @param {React.ReactNode} props.children - Contenido del widget (gráfico, tabla, etc.)
 */
export default function WidgetContainer({ widgetId, titulo, children }) {
  const toggleWidget = useStore((s) => s.toggleWidget);

  return (
    <div
      className="panel flex flex-col h-full overflow-hidden"
      role="region"
      aria-label={`Widget: ${titulo}`}
    >
      {/* Barra de título */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
        <h3 className="text-sm font-medium text-bloomberg-text truncate">
          {titulo}
        </h3>
        <button
          onClick={() => toggleWidget(widgetId)}
          className="p-1 rounded text-bloomberg-text-muted hover:text-bloomberg-red
                     hover:bg-white/5 transition-colors"
          aria-label={`Ocultar widget ${titulo}`}
          title="Ocultar widget"
        >
          {/* Ícono de ojo tachado (ocultar) */}
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
        </button>
      </div>

      {/* Contenido del widget */}
      <div className="flex-1 overflow-auto p-2">
        {children}
      </div>
    </div>
  );
}

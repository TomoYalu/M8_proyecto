import { useEffect, useCallback } from 'react';

/**
 * Modal reutilizable con overlay y cierre con Escape.
 * @param {object} props
 * @param {boolean} props.abierto - Controla visibilidad
 * @param {function} props.onCerrar - Callback al cerrar
 * @param {string} [props.titulo] - Título del modal
 * @param {React.ReactNode} props.children - Contenido
 * @param {string} [props.ancho='max-w-lg'] - Clase de ancho máximo
 */
export default function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-lg',
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onCerrar();
      }
    },
    [onCerrar]
  );

  useEffect(() => {
    if (abierto) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [abierto, handleKeyDown]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo || 'Diálogo modal'}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCerrar}
        aria-hidden="true"
      />

      {/* Contenido */}
      <div
        className={`relative ${ancho} w-full mx-4 bg-bloomberg-panel rounded-xl
                    border border-white/10 shadow-2xl`}
      >
        {/* Encabezado */}
        {titulo && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-bloomberg-text">
              {titulo}
            </h2>
            <button
              onClick={onCerrar}
              className="p-1 rounded-lg text-bloomberg-text-muted
                         hover:text-bloomberg-text hover:bg-white/5 transition-colors"
              aria-label="Cerrar diálogo"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
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
        )}

        {/* Cuerpo */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

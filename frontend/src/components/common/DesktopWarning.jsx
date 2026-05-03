import { useState, useEffect } from 'react';

const BREAKPOINT = 1280;

/**
 * Aviso visible en pantallas menores a 1280px.
 * Se puede cerrar manualmente.
 */
export default function DesktopWarning() {
  const [visible, setVisible] = useState(false);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    const verificar = () => {
      if (!cerrado) {
        setVisible(window.innerWidth < BREAKPOINT);
      }
    };
    verificar();
    window.addEventListener('resize', verificar);
    return () => window.removeEventListener('resize', verificar);
  }, [cerrado]);

  if (!visible || cerrado) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50
                 flex items-center gap-3 px-4 py-3 rounded-lg
                 bg-bloomberg-yellow/15 border border-bloomberg-yellow/30
                 text-bloomberg-yellow text-sm shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0
             002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      <span>Esta aplicación está optimizada para escritorio (1280px o más).</span>
      <button
        onClick={() => setCerrado(true)}
        className="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Cerrar aviso"
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
  );
}

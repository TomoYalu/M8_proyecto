import { useState } from 'react';

/**
 * Tooltip con información adicional.
 * @param {object} props
 * @param {string} props.texto - Texto del tooltip
 * @param {React.ReactNode} props.children - Elemento que activa el tooltip
 * @param {string} [props.posicion='top'] - Posición: 'top' | 'bottom' | 'left' | 'right'
 */
export default function Tooltip({ texto, children, posicion = 'top' }) {
  const [visible, setVisible] = useState(false);

  const posiciones = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}

      {visible && (
        <div
          className={`absolute z-40 px-3 py-2 rounded-lg text-xs whitespace-pre-line
                      bg-bloomberg-panel border border-white/10 shadow-lg
                      text-bloomberg-text pointer-events-none min-w-[200px] max-w-sm
                      ${posiciones[posicion] || posiciones.top}`}
          role="tooltip"
          aria-live="polite"
        >
          {texto}
        </div>
      )}
    </div>
  );
}

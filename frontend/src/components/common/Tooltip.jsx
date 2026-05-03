import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip con información adicional.
 * Usa createPortal + position:fixed para evitar recortes por overflow.
 *
 * @param {object} props
 * @param {string} props.texto - Texto del tooltip
 * @param {React.ReactNode} props.children - Elemento que activa el tooltip
 * @param {string} [props.posicion='top'] - Posición: 'top' | 'bottom'
 */
export default function Tooltip({ texto, children, posicion = 'top' }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const top = posicion === 'bottom'
      ? rect.bottom + 6
      : rect.top - 6;
    const left = rect.left + rect.width / 2;
    setCoords({ top, left });
  }, [visible, posicion]);

  return (
    <span
      ref={ref}
      className="inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}

      {visible && createPortal(
        <div
          className="fixed z-[9999] px-3 py-2 rounded-lg text-xs whitespace-pre-line
                     bg-bloomberg-panel border border-white/10 shadow-xl
                     text-bloomberg-text pointer-events-none min-w-[200px] max-w-sm"
          role="tooltip"
          style={{
            top: posicion === 'bottom' ? coords.top : undefined,
            bottom: posicion !== 'bottom' ? `calc(100vh - ${coords.top}px)` : undefined,
            left: coords.left,
            transform: 'translateX(-50%)',
          }}
        >
          {texto}
        </div>,
        document.body
      )}
    </span>
  );
}

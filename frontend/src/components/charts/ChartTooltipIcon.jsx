import { useRef, useEffect, useState } from 'react';
import Tooltip from '../common/Tooltip';

/**
 * Ícono (?) que muestra un tooltip breve al hover.
 * El click se maneja externamente por ChartHeader.
 *
 * @param {object} props
 * @param {string} props.texto - Texto breve del tooltip (hover)
 */
export default function ChartTooltipIcon({ texto }) {
  return (
    <Tooltip texto={texto} posicion="bottom">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full
                   border border-bloomberg-text-muted/40 text-bloomberg-text-muted
                   hover:border-bloomberg-accent hover:text-bloomberg-accent
                   transition-colors text-[10px] font-semibold leading-none
                   cursor-pointer ml-1.5 flex-shrink-0"
        aria-label="Información sobre este gráfico"
      >
        ?
      </span>
    </Tooltip>
  );
}

/**
 * Expandable detail panel — render this BELOW the title row.
 */
export function ChartInfoPanel({ expanded, detalle, formula, onClose }) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, detalle, formula]);

  if (!detalle) return null;

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: expanded ? `${contentHeight}px` : '0px' }}
    >
      <div ref={contentRef} className="pb-2 pt-1">
        <div className="rounded-lg bg-bloomberg-accent/5 border border-bloomberg-accent/10 px-3 py-2.5">
          <p className="text-xs text-bloomberg-text-muted leading-relaxed">
            {detalle}
          </p>
          {formula && (
            <p className="mt-1.5 text-xs font-mono text-bloomberg-accent/80 bg-bloomberg-bg/50 rounded px-2 py-1">
              {formula}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="mt-1.5 text-[10px] text-bloomberg-text-muted hover:text-bloomberg-accent transition-colors"
          >
            Cerrar ✕
          </button>
        </div>
      </div>
    </div>
  );
}

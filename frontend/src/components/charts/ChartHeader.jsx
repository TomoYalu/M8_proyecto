import { useState } from 'react';
import ChartTooltipIcon, { ChartInfoPanel } from './ChartTooltipIcon';

/**
 * Header for chart components with title, (?) icon, and expandable info panel.
 * Renders the title and icon on one line, and the expandable panel below.
 */
export default function ChartHeader({ titulo, tooltip, detalle, formula }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-2 pt-2 pb-1">
      <div className="flex items-center gap-1">
        <h3 className="text-sm font-semibold text-bloomberg-text whitespace-nowrap">{titulo}</h3>
        {detalle ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center"
            aria-expanded={expanded}
            aria-label="Mostrar detalles del indicador"
          >
            <ChartTooltipIcon texto={tooltip} />
          </button>
        ) : (
          <ChartTooltipIcon texto={tooltip} />
        )}
      </div>
      <ChartInfoPanel
        expanded={expanded}
        detalle={detalle}
        formula={formula}
        onClose={() => setExpanded(false)}
      />
    </div>
  );
}

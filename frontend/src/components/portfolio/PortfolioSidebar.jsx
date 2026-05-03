/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { formatMoneda } from '../../utils/formatters';

export default function PortfolioSidebar({
  portafolios,
  resumenPorPortafolio,
  portafolioActivo,
  onSeleccionar,
  onCrear,
  onReordenar,
}) {
  const mover = (idx, dir) => {
    const arr = portafolios.map((p) => p.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onReordenar?.(arr);
  };

  return (
    <aside
      className="w-full flex flex-col bg-bloomberg-panel rounded-xl
                 border border-white/5 overflow-hidden flex-1 min-h-0"
      aria-label="Lista de portafolios"
    >
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-bloomberg-text-muted uppercase tracking-wider">
          Portafolios
        </h2>
        <button
          onClick={onCrear}
          className="p-1.5 rounded-lg bg-bloomberg-accent/20 text-bloomberg-accent
                     hover:bg-bloomberg-accent/30 transition-colors"
          aria-label="Crear nuevo portafolio"
          title="Crear portafolio"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1" role="listbox"
           aria-label="Seleccionar portafolio">
        {portafolios.length === 0 ? (
          <div className="text-center py-8 px-3">
            <p className="text-sm text-bloomberg-text-muted">No tienes portafolios aún</p>
            <p className="text-xs text-bloomberg-text-muted/60 mt-1">
              Crea tu primer portafolio para comenzar.
            </p>
          </div>
        ) : (
          portafolios.map((p, idx) => {
            const resumen = resumenPorPortafolio[p.id];
            const valorTotal = resumen?.valor_total ?? 0;
            const pnlBruto = resumen?.pnl_bruto ?? 0;
            const isActivo = portafolioActivo === p.id;

            return (
              <div
                key={p.id}
                role="option"
                aria-selected={isActivo}
                tabIndex={0}
                onClick={() => onSeleccionar(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionar(p.id); }
                }}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-all group
                  ${isActivo
                    ? 'bg-bloomberg-accent/15 border border-bloomberg-accent/40'
                    : 'border border-transparent hover:bg-white/[0.04] hover:border-white/10'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium truncate flex-1 ${
                    isActivo ? 'text-bloomberg-accent' : 'text-bloomberg-text'
                  }`} title={p.nombre}>
                    {p.nombre}
                  </p>
                  {/* Reorder buttons */}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                       onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => mover(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 rounded text-bloomberg-text-muted hover:text-bloomberg-text disabled:opacity-20"
                      title="Subir" aria-label="Subir portafolio"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => mover(idx, 1)}
                      disabled={idx === portafolios.length - 1}
                      className="p-0.5 rounded text-bloomberg-text-muted hover:text-bloomberg-text disabled:opacity-20"
                      title="Bajar" aria-label="Bajar portafolio"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-bloomberg-text-muted tabular-nums">
                    {formatMoneda(valorTotal, p.moneda)}
                  </span>
                  <span className={`text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
                    pnlBruto >= 0
                      ? 'text-bloomberg-green bg-bloomberg-green/10'
                      : 'text-bloomberg-red bg-bloomberg-red/10'
                  }`}>
                    {pnlBruto >= 0 ? '+' : ''}{formatMoneda(pnlBruto, p.moneda)}
                  </span>
                </div>
                {p.capital_inicial > 0 && (
                  <p className="text-[10px] text-bloomberg-text-muted mt-0.5">
                    Capital: {formatMoneda(p.capital_inicial, p.moneda)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

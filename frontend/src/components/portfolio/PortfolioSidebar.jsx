import { useState, useEffect } from 'react';
import { formatMoneda } from '../../utils/formatters';

/**
 * Sidebar izquierdo con lista vertical de portafolios como cards compactas.
 * Cada item muestra nombre, valor total y P&L con color (verde/rojo).
 * Click selecciona el portafolio y muestra su detalle a la derecha.
 *
 * @param {object} props
 * @param {Array} props.portafolios - Lista de portafolios
 * @param {object} props.resumenPorPortafolio - Mapa id → resumen con valor_total, pnl_bruto
 * @param {number|null} props.portafolioActivo - ID del portafolio seleccionado
 * @param {function} props.onSeleccionar - Callback(id) al seleccionar
 * @param {function} props.onCrear - Callback al pulsar "Crear Portafolio"
 *
 * Requisitos cubiertos: 1.1–1.5, 3.1, 12.2, 12.7
 */
export default function PortfolioSidebar({
  portafolios,
  resumenPorPortafolio,
  portafolioActivo,
  onSeleccionar,
  onCrear,
  onDemoLoaded,
}) {
  const [demoDisponible, setDemoDisponible] = useState(false);
  const [cargandoDemo, setCargandoDemo] = useState(false);

  useEffect(() => {
    fetch('/api/portafolios/seed-demo')
      .then(r => { if (r.ok) setDemoDisponible(true); })
      .catch(() => {});
  }, []);

  const handleCargarDemo = async () => {
    setCargandoDemo(true);
    try {
      const res = await fetch('/api/portafolios/seed-demo', { method: 'POST' });
      if (res.ok) onDemoLoaded?.();
    } catch (e) { console.error(e); }
    finally { setCargandoDemo(false); }
  };

  return (
    <aside
      className="w-full flex flex-col bg-bloomberg-panel rounded-xl
                 border border-white/5 overflow-hidden flex-1 min-h-0"
      aria-label="Lista de portafolios"
    >
      {/* Header con botón crear */}
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Lista scrollable de portafolios */}
      <div
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1"
        role="listbox"
        aria-label="Seleccionar portafolio"
      >
        {portafolios.length === 0 ? (
          <div className="text-center py-8 px-3">
            <p className="text-sm text-bloomberg-text-muted">No tienes portafolios aún</p>
            <p className="text-xs text-bloomberg-text-muted/60 mt-1">
              Crea tu primer portafolio para comenzar.
            </p>
          </div>
        ) : (
          portafolios.map((p) => {
            const resumen = resumenPorPortafolio[p.id];
            const valorTotal = resumen?.valor_total ?? 0;
            const pnlBruto = resumen?.pnl_bruto ?? 0;
            const isActivo = portafolioActivo === p.id;
            const pnlColor = pnlBruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red';

            return (
              <div
                key={p.id}
                role="option"
                aria-selected={isActivo}
                tabIndex={0}
                onClick={() => onSeleccionar(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSeleccionar(p.id);
                  }
                }}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-all
                  ${isActivo
                    ? 'bg-bloomberg-accent/15 border border-bloomberg-accent/40'
                    : 'border border-transparent hover:bg-white/[0.04] hover:border-white/10'
                  }`}
              >
                {/* Nombre */}
                <p
                  className={`text-sm font-medium truncate ${
                    isActivo ? 'text-bloomberg-accent' : 'text-bloomberg-text'
                  }`}
                  title={p.nombre}
                >
                  {p.nombre}
                </p>

                {/* Valor + P&L en una línea */}
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-bloomberg-text-muted tabular-nums">
                    {formatMoneda(valorTotal, p.moneda)}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full transition-colors duration-300 ${
                      pnlBruto >= 0
                        ? 'text-bloomberg-green bg-bloomberg-green/10'
                        : 'text-bloomberg-red bg-bloomberg-red/10'
                    }`}
                  >
                    {pnlBruto >= 0 ? '+' : ''}
                    {formatMoneda(pnlBruto, p.moneda)}
                  </span>
                </div>
                {/* Capital inicial si existe */}
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
      {/* Demo button */}
      {demoDisponible && (
        <div className="px-3 py-2 border-t border-white/5 shrink-0">
          <button onClick={handleCargarDemo} disabled={cargandoDemo}
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-bloomberg-yellow/10 text-bloomberg-yellow
                       border border-bloomberg-yellow/20 hover:bg-bloomberg-yellow/20
                       disabled:opacity-50 transition-colors">
            {cargandoDemo ? 'Cargando...' : '🧪 Cargar Demo'}
          </button>
        </div>
      )}
    </aside>
  );
}

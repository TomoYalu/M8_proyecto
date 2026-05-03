import { useState, useEffect, useCallback } from 'react';
import useStore from '../../store';
import { formatMoneda } from '../../utils/formatters';

/**
 * Vista consolidada con capital global editable, resumen de valor total,
 * P&L y desglose por portafolio con capital asignado/disponible.
 */
export default function ConsolidatedView({ consolidado }) {
  const { capitalConfig, fetchCapitalConfig, actualizarCapitalGlobal } = useStore();
  const [editando, setEditando] = useState(false);
  const [inputCapital, setInputCapital] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { fetchCapitalConfig(); }, [fetchCapitalConfig]);

  const handleEditar = useCallback(() => {
    setInputCapital(String(capitalConfig?.capital_global || 0));
    setEditando(true);
    setError(null);
  }, [capitalConfig]);

  const handleGuardar = useCallback(async () => {
    const valor = parseFloat(inputCapital);
    if (isNaN(valor) || valor < 0) { setError('Valor inválido'); return; }
    setGuardando(true);
    setError(null);
    try {
      await actualizarCapitalGlobal(valor);
      setEditando(false);
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  }, [inputCapital, actualizarCapitalGlobal]);

  if (!consolidado) return null;

  const { valor_total, pnl_bruto, pnl_neto, isr_estimado, portafolios,
          capital_global = 0, capital_no_asignado = 0, moneda_base = 'MXN' } = consolidado;

  const pnlMetricas = [
    { label: 'P&L Bruto', valor: pnl_bruto, color: pnl_bruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red' },
    { label: 'P&L Neto', valor: pnl_neto, color: pnl_neto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red' },
    { label: 'ISR Estimado', valor: isr_estimado, color: 'text-bloomberg-yellow' },
  ];

  return (
    <section className="bg-bloomberg-panel rounded-xl border border-white/5 p-5" aria-label="Vista consolidada">
      <h2 className="text-sm font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-4">
        Resumen Consolidado
      </h2>

      {/* Capital Global */}
      <div className="mb-5 px-4 py-3 rounded-lg bg-bloomberg-bg/50 border border-white/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted">Capital Global</p>
            {editando ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-bloomberg-text-muted text-sm">$</span>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={inputCapital}
                  onChange={(e) => setInputCapital(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuardar()}
                  className="w-40 px-2 py-1 text-sm rounded bg-bloomberg-bg border border-white/10
                             text-bloomberg-text focus:outline-none focus:ring-1 focus:ring-bloomberg-accent"
                  autoFocus
                />
                <span className="text-xs text-bloomberg-text-muted">{moneda_base}</span>
                <button onClick={handleGuardar} disabled={guardando}
                  className="px-2 py-1 text-xs rounded bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80 disabled:opacity-50">
                  {guardando ? '...' : '✓'}
                </button>
                <button onClick={() => setEditando(false)}
                  className="px-2 py-1 text-xs rounded bg-white/5 text-bloomberg-text-muted hover:bg-white/10">
                  ✕
                </button>
              </div>
            ) : (
              <p className="text-xl font-bold text-bloomberg-text tabular-nums">
                {formatMoneda(capital_global, moneda_base)}
              </p>
            )}
            {error && <p className="text-xs text-bloomberg-red mt-1">{error}</p>}
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div>
            <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted">No Asignado</p>
            <p className={`text-lg font-semibold tabular-nums ${capital_no_asignado > 0 ? 'text-bloomberg-green' : capital_no_asignado < 0 ? 'text-bloomberg-red' : 'text-bloomberg-text-muted'}`}>
              {formatMoneda(capital_no_asignado, moneda_base)}
            </p>
          </div>
        </div>

        {!editando && (
          <button onClick={handleEditar}
            className="p-1.5 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-accent hover:bg-white/5 transition-colors"
            aria-label="Editar capital global" title="Editar capital">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 items-end">
        <div>
          <p className="text-xs text-bloomberg-text-muted">Valor Total</p>
          <p className="text-2xl md:text-3xl font-bold text-bloomberg-text tabular-nums tracking-tight">
            {formatMoneda(valor_total)}
          </p>
        </div>
        {pnlMetricas.map((m) => (
          <div key={m.label}>
            <p className="text-xs text-bloomberg-text-muted">{m.label}</p>
            <p className={`text-lg font-semibold tabular-nums transition-colors duration-300 ${m.color}`}>
              {formatMoneda(m.valor)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabla desglose */}
      {portafolios && portafolios.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-sm" role="table" aria-label="Desglose por portafolio">
            <thead>
              <tr className="bg-bloomberg-bg/50 text-bloomberg-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium" scope="col">Portafolio</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">Capital</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">Disponible</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">Valor</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">P&L Bruto</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">P&L Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {portafolios.map((p) => {
                const sinPrecio = p.valor_total === 0;
                const capDisp = p.capital_disponible ?? (p.capital_inicial - p.costo_total);
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-bloomberg-text font-medium">{p.nombre}</td>
                    <td className="text-right px-3 py-2 text-bloomberg-text tabular-nums">
                      {p.capital_inicial > 0 ? formatMoneda(p.capital_inicial, p.moneda) : <span className="text-bloomberg-text-muted">—</span>}
                    </td>
                    <td className={`text-right px-3 py-2 tabular-nums ${capDisp > 0 ? 'text-bloomberg-green' : capDisp < 0 ? 'text-bloomberg-red' : 'text-bloomberg-text-muted'}`}>
                      {p.capital_inicial > 0 ? formatMoneda(capDisp, p.moneda) : '—'}
                    </td>
                    <td className="text-right px-3 py-2 text-bloomberg-text tabular-nums">
                      {sinPrecio && p.costo_total > 0 ? (
                        <span className="flex flex-col items-end">
                          <span>{formatMoneda(p.costo_total, p.moneda)}</span>
                          <span className="text-[10px] text-bloomberg-text-muted">precios pendientes</span>
                        </span>
                      ) : formatMoneda(p.valor_total, p.moneda)}
                    </td>
                    <td className={`text-right px-3 py-2 font-medium tabular-nums ${sinPrecio ? 'text-bloomberg-text-muted' : p.pnl_bruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}`}>
                      {sinPrecio ? '—' : formatMoneda(p.pnl_bruto, p.moneda)}
                    </td>
                    <td className={`text-right px-3 py-2 font-medium tabular-nums ${sinPrecio ? 'text-bloomberg-text-muted' : p.pnl_neto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}`}>
                      {sinPrecio ? '—' : formatMoneda(p.pnl_neto, p.moneda)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

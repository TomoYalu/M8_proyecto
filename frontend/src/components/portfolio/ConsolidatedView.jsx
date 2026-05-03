import { formatMoneda } from '../../utils/formatters';

/**
 * Vista consolidada: resumen de valor total, P&L bruto, P&L neto e ISR
 * estimado de todos los portafolios, con mini tabla de desglose.
 *
 * @param {object} props
 * @param {object} props.consolidado - Datos de /api/portafolios/consolidado
 *
 * Requisitos cubiertos: 1.4, 3.1, 3.4, 12.2, 12.7
 */
export default function ConsolidatedView({ consolidado }) {
  if (!consolidado) return null;

  const { valor_total, pnl_bruto, pnl_neto, isr_estimado, portafolios } = consolidado;

  const pnlMetricas = [
    {
      label: 'P&L Bruto',
      valor: pnl_bruto,
      color: pnl_bruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red',
    },
    {
      label: 'P&L Neto',
      valor: pnl_neto,
      color: pnl_neto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red',
    },
    { label: 'ISR Estimado', valor: isr_estimado, color: 'text-bloomberg-yellow' },
  ];

  return (
    <section
      className="bg-bloomberg-panel rounded-xl border border-white/5 p-5"
      aria-label="Vista consolidada de portafolios"
    >
      <h2 className="text-sm font-semibold text-bloomberg-text-muted uppercase tracking-wider mb-4">
        Resumen Consolidado
      </h2>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 items-end">
        {/* Valor Total — hero number */}
        <div>
          <p className="text-xs text-bloomberg-text-muted">Valor Total</p>
          <p className="text-2xl md:text-3xl font-bold text-bloomberg-text tabular-nums tracking-tight">
            {formatMoneda(valor_total)}
          </p>
        </div>

        {/* P&L metrics — prominent with smooth color transitions */}
        {pnlMetricas.map((m) => (
          <div key={m.label}>
            <p className="text-xs text-bloomberg-text-muted">{m.label}</p>
            <p className={`text-lg font-semibold tabular-nums transition-colors duration-300 ${m.color}`}>
              {formatMoneda(m.valor)}
            </p>
          </div>
        ))}
      </div>

      {/* Mini tabla de desglose por portafolio */}
      {portafolios && portafolios.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-sm" role="table" aria-label="Desglose por portafolio">
            <thead>
              <tr className="bg-bloomberg-bg/50 text-bloomberg-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium" scope="col">Portafolio</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">Valor</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">P&L Bruto</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">P&L Neto</th>
                <th className="text-right px-3 py-2 font-medium" scope="col">ISR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {portafolios.map((p) => {
                const sinPrecio = p.valor_total === 0;
                const mostrarFallback = sinPrecio && p.costo_total > 0;

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-bloomberg-text font-medium">{p.nombre}</td>
                    <td className="text-right px-3 py-2 text-bloomberg-text tabular-nums">
                      {mostrarFallback ? (
                        <span className="flex flex-col items-end">
                          <span>{formatMoneda(p.costo_total, p.moneda)}</span>
                          <span className="text-[10px] text-bloomberg-text-muted leading-tight">
                            Valor invertido (precios pendientes)
                          </span>
                        </span>
                      ) : (
                        formatMoneda(p.valor_total, p.moneda)
                      )}
                    </td>
                    <td className={`text-right px-3 py-2 font-medium tabular-nums transition-colors duration-300 ${sinPrecio ? 'text-bloomberg-text-muted' : p.pnl_bruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}`}>
                      {sinPrecio ? '—' : formatMoneda(p.pnl_bruto, p.moneda)}
                    </td>
                    <td className={`text-right px-3 py-2 font-medium tabular-nums transition-colors duration-300 ${sinPrecio ? 'text-bloomberg-text-muted' : p.pnl_neto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}`}>
                      {sinPrecio ? '—' : formatMoneda(p.pnl_neto, p.moneda)}
                    </td>
                    <td className="text-right px-3 py-2 text-bloomberg-yellow tabular-nums">
                      {formatMoneda(p.isr_estimado, p.moneda)}
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

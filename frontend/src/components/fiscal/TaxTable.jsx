/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Fiscal
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { formatMoneda, formatPorcentaje, formatNumero } from '../../utils/formatters';

/**
 * Tabla fiscal con columnas: Ticker, Ganancia Bruta, ISR Estimado,
 * Ganancia Neta, Factor INPC, Ganancia Real (MXN constantes).
 *
 * Requisitos cubiertos: 9.1, 9.2, 9.5
 */
export default function TaxTable({ posiciones = [], resumen = null }) {
  if (!posiciones.length) {
    return (
      <div className="bg-bloomberg-panel rounded-lg p-6 text-center">
        <p className="text-bloomberg-text-muted">
          No hay posiciones activas para mostrar datos fiscales.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bloomberg-panel rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-bloomberg-bg">
        <h3 className="text-sm font-semibold text-bloomberg-text">
          Tabla Fiscal por Posición
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table" aria-label="Tabla fiscal del portafolio">
          <thead>
            <tr className="text-bloomberg-text-muted text-xs uppercase border-b border-bloomberg-bg">
              <th className="px-4 py-3 text-left">Ticker</th>
              <th className="px-4 py-3 text-right">Ganancia Bruta</th>
              <th className="px-4 py-3 text-right">ISR Estimado (10%)</th>
              <th className="px-4 py-3 text-right">Ganancia Neta</th>
              <th className="px-4 py-3 text-right">Factor INPC</th>
              <th className="px-4 py-3 text-right">Ganancia Real (MXN)</th>
            </tr>
          </thead>
          <tbody>
            {posiciones.map((pos) => (
              <tr
                key={pos.ticker}
                className="border-b border-bloomberg-bg/50 hover:bg-bloomberg-bg/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-bloomberg-text">
                  {pos.ticker}
                  <span className="ml-2 text-xs text-bloomberg-text-muted">
                    {pos.moneda}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right ${
                  pos.ganancia_bruta >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                }`}>
                  {formatMoneda(pos.ganancia_bruta, pos.moneda)}
                </td>
                <td className="px-4 py-3 text-right text-bloomberg-yellow">
                  {formatMoneda(pos.isr_estimado, pos.moneda)}
                </td>
                <td className={`px-4 py-3 text-right ${
                  pos.ganancia_neta >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                }`}>
                  {formatMoneda(pos.ganancia_neta, pos.moneda)}
                </td>
                <td className="px-4 py-3 text-right text-bloomberg-text">
                  {formatNumero(pos.factor_inpc, 4)}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  pos.ganancia_real_mxn >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                }`}>
                  {formatMoneda(pos.ganancia_real_mxn, 'MXN')}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Fila de totales */}
          {resumen && (
            <tfoot>
              <tr className="border-t-2 border-bloomberg-accent/30 font-semibold">
                <td className="px-4 py-3 text-bloomberg-text">Total</td>
                <td className={`px-4 py-3 text-right ${
                  resumen.total_ganancia_bruta >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                }`}>
                  {formatMoneda(resumen.total_ganancia_bruta, 'USD')}
                </td>
                <td className="px-4 py-3 text-right text-bloomberg-yellow">
                  {formatMoneda(resumen.total_isr_estimado, 'USD')}
                </td>
                <td className={`px-4 py-3 text-right ${
                  resumen.total_ganancia_neta >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                }`}>
                  {formatMoneda(resumen.total_ganancia_neta, 'USD')}
                </td>
                <td className="px-4 py-3 text-right text-bloomberg-text-muted">—</td>
                <td className={`px-4 py-3 text-right ${
                  resumen.total_ganancia_real_mxn >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                }`}>
                  {formatMoneda(resumen.total_ganancia_real_mxn, 'MXN')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

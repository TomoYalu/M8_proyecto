/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Wizard Ciclo Económico
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import Plot from 'react-plotly.js';
import { mergeLayout, plotlyConfig, chartTitle } from '../../utils/plotlyDefaults';
import { formatMoneda, formatNumero } from '../../utils/formatters';
import {
  BLOOMBERG_ACCENT,
  BLOOMBERG_GREEN,
  BLOOMBERG_YELLOW,
  BLOOMBERG_RED,
  BLOOMBERG_TEXT,
  BLOOMBERG_TEXT_MUTED,
} from '../../utils/colors';
import Tooltip from '../common/Tooltip';

/**
 * Gráfica de dona/pie con distribución de asset allocation recomendada
 * y tabla de ETFs representativos con montos calculados.
 *
 * @param {object} props
 * @param {Array} props.allocation - Array de { clase, porcentaje, etfs }
 * @param {string} props.perfil - Nombre del perfil de riesgo
 * @param {number} props.capital - Capital inicial ingresado
 * @param {string} props.moneda - 'USD' o 'MXN'
 *
 * Valida: plan-v1.1 C5
 */

const CLASE_COLORS = [
  BLOOMBERG_ACCENT,
  BLOOMBERG_GREEN,
  BLOOMBERG_YELLOW,
  '#a855f7',
  '#f59e0b',
  BLOOMBERG_RED,
  '#06b6d4',
  '#ec4899',
];

export default function AllocationChart({ allocation, perfil, capital, moneda }) {
  if (!allocation || allocation.length === 0) return null;

  const labels = allocation.map((a) => a.clase);
  const values = allocation.map((a) => a.porcentaje);
  const colors = allocation.map((_, i) => CLASE_COLORS[i % CLASE_COLORS.length]);

  const layout = mergeLayout({
    title: chartTitle(`Distribución Recomendada — ${perfil}`),
    showlegend: true,
    legend: {
      orientation: 'v',
      x: 1.05,
      y: 0.5,
      font: { size: 12, color: BLOOMBERG_TEXT },
    },
    margin: { l: 20, r: 160, t: 60, b: 20 },
    height: 350,
  });

  const data = [
    {
      type: 'pie',
      labels,
      values,
      hole: 0.55,
      marker: { colors },
      textinfo: 'percent',
      textfont: { color: BLOOMBERG_TEXT, size: 13 },
      hovertemplate: '%{label}<br>%{percent}<br>%{value}%<extra></extra>',
      sort: false,
    },
  ];

  return (
    <div className="space-y-6" role="region" aria-label="Asset allocation recomendado">
      {/* Donut chart */}
      <div className="bg-bloomberg-panel rounded-xl border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-bloomberg-text">
            Asset Allocation Recomendado
          </h3>
          <Tooltip texto="Distribución sugerida de activos según su perfil de riesgo. Diversificar reduce el riesgo total del portafolio.">
            <button
              className="text-bloomberg-text-muted hover:text-bloomberg-accent transition-colors"
              aria-label="Información sobre asset allocation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </Tooltip>
        </div>

        <Plot
          data={data}
          layout={layout}
          config={plotlyConfig}
          className="w-full"
          useResizeHandler
          style={{ width: '100%', height: '350px' }}
        />
      </div>

      {/* Table with ETFs and amounts */}
      <div className="bg-bloomberg-panel rounded-xl border border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h4 className="text-sm font-semibold text-bloomberg-text">
            Distribución por Clase de Activo
            {capital > 0 && (
              <span className="text-bloomberg-text-muted font-normal ml-2">
                — Capital: {formatMoneda(capital, moneda)}
              </span>
            )}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Distribución de activos con ETFs">
            <thead>
              <tr className="bg-white/5 text-bloomberg-text-muted text-left">
                <th className="px-5 py-3 font-medium" scope="col">Clase de Activo</th>
                <th className="px-5 py-3 font-medium text-right" scope="col">Porcentaje</th>
                {capital > 0 && (
                  <th className="px-5 py-3 font-medium text-right" scope="col">
                    Monto ({moneda})
                  </th>
                )}
                <th className="px-5 py-3 font-medium" scope="col">ETFs Representativos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allocation.map((a, i) => {
                const monto = capital > 0 ? (capital * a.porcentaje) / 100 : 0;
                return (
                  <tr key={a.clase} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colors[i] }}
                          aria-hidden="true"
                        />
                        <span className="text-bloomberg-text font-medium">{a.clase}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-bloomberg-accent font-semibold">
                      {a.porcentaje}%
                    </td>
                    {capital > 0 && (
                      <td className="px-5 py-3 text-right text-bloomberg-text font-mono">
                        {formatMoneda(monto, moneda)}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {a.etfs && a.etfs.length > 0 ? (
                          a.etfs.map((etf) => (
                            <span
                              key={etf}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs
                                         bg-bloomberg-accent/10 text-bloomberg-accent border border-bloomberg-accent/20"
                            >
                              {etf}
                            </span>
                          ))
                        ) : (
                          <span className="text-bloomberg-text-muted text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {capital > 0 && (
              <tfoot>
                <tr className="bg-white/5 font-semibold">
                  <td className="px-5 py-3 text-bloomberg-text">Total</td>
                  <td className="px-5 py-3 text-right text-bloomberg-accent">100%</td>
                  <td className="px-5 py-3 text-right text-bloomberg-text font-mono">
                    {formatMoneda(capital, moneda)}
                  </td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

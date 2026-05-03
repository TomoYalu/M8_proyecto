/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState } from 'react';
import { formatMoneda, formatPorcentaje } from '../../utils/formatters';

/**
 * Tarjeta de portafolio con nombre, valor total, P&L bruto/neto,
 * botones de editar y eliminar.
 *
 * @param {object} props
 * @param {object} props.portafolio - Datos del portafolio
 * @param {object} [props.resumen] - Resumen con valor_total, pnl_bruto, pnl_neto
 * @param {boolean} [props.activo] - Si está seleccionado
 * @param {function} props.onSeleccionar - Callback al hacer clic
 * @param {function} props.onEditar - Callback para editar
 * @param {function} props.onEliminar - Callback para eliminar
 *
 * Requisitos cubiertos: 1.1–1.5, 3.1, 3.4, 12.2, 12.7
 */
export default function PortfolioCard({
  portafolio,
  resumen,
  activo = false,
  onSeleccionar,
  onEditar,
  onEliminar,
}) {
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const valorTotal = resumen?.valor_total ?? 0;
  const pnlBruto = resumen?.pnl_bruto ?? 0;
  const pnlNeto = resumen?.pnl_neto ?? 0;
  const pnlPct = valorTotal > 0 ? (pnlBruto / (valorTotal - pnlBruto)) * 100 : 0;

  const colorPnl = pnlBruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red';

  return (
    <article
      className={`rounded-xl border p-5 cursor-pointer transition-all
        ${activo
          ? 'bg-bloomberg-accent/10 border-bloomberg-accent/40'
          : 'bg-bloomberg-panel border-white/5 hover:border-white/15'
        }`}
      onClick={() => onSeleccionar(portafolio.id)}
      role="button"
      tabIndex={0}
      aria-label={`Portafolio ${portafolio.nombre}`}
      aria-pressed={activo}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSeleccionar(portafolio.id);
        }
      }}
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-bloomberg-text truncate">
            {portafolio.nombre}
          </h3>
          {portafolio.descripcion && (
            <p className="text-xs text-bloomberg-text-muted mt-0.5 truncate">
              {portafolio.descripcion}
            </p>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEditar(portafolio)}
            className="p-1.5 rounded-lg text-bloomberg-text-muted
                       hover:text-bloomberg-accent hover:bg-white/5 transition-colors"
            aria-label={`Editar portafolio ${portafolio.nombre}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {confirmandoEliminar ? (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  onEliminar(portafolio.id);
                  setConfirmandoEliminar(false);
                }}
                className="px-2 py-1 text-xs rounded bg-bloomberg-red/20 text-bloomberg-red
                           hover:bg-bloomberg-red/30 transition-colors"
                aria-label="Confirmar eliminación"
              >
                Sí
              </button>
              <button
                onClick={() => setConfirmandoEliminar(false)}
                className="px-2 py-1 text-xs rounded bg-white/5 text-bloomberg-text-muted
                           hover:bg-white/10 transition-colors"
                aria-label="Cancelar eliminación"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmandoEliminar(true)}
              className="p-1.5 rounded-lg text-bloomberg-text-muted
                         hover:text-bloomberg-red hover:bg-white/5 transition-colors"
              aria-label={`Eliminar portafolio ${portafolio.nombre}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-bloomberg-text-muted">Valor Total</p>
          <p className="text-sm font-medium text-bloomberg-text">
            {formatMoneda(valorTotal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-bloomberg-text-muted">P&L Bruto</p>
          <p className={`text-sm font-medium ${colorPnl}`}>
            {formatMoneda(pnlBruto)}
          </p>
          <p className={`text-xs ${colorPnl}`}>
            {formatPorcentaje(pnlPct)}
          </p>
        </div>
        <div>
          <p className="text-xs text-bloomberg-text-muted">P&L Neto</p>
          <p className={`text-sm font-medium ${pnlNeto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'}`}>
            {formatMoneda(pnlNeto)}
          </p>
        </div>
      </div>
    </article>
  );
}

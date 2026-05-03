import { useState } from 'react';
import { formatMoneda, formatFecha, formatNumero } from '../../utils/formatters';
import Badge from '../common/Badge';

/**
 * Historial paginado de transacciones (50 por página).
 *
 * Columnas: Fecha, Ticker, Tipo, Precio, Cantidad, Comisión, Ganancia/Pérdida, Estado.
 * Badges de tipo: compra=azul, venta=rojo, dividendo=verde.
 * Transacciones pendientes muestran badge amarillo y botones Confirmar/Cancelar.
 *
 * @param {object} props
 * @param {object} props.datos - { items, total, pagina, paginas }
 * @param {function} props.onCambiarPagina - Callback con número de página
 * @param {boolean} [props.loading] - Estado de carga
 * @param {number} [props.portafolioId] - ID del portafolio (para confirmar/cancelar)
 * @param {function} [props.onTransaccionActualizada] - Callback tras confirmar/cancelar
 *
 * Requisitos cubiertos: 2.6, 12.1, 12.2, 12.7
 */
export default function TransactionHistory({
  datos,
  onCambiarPagina,
  loading = false,
  portafolioId,
  onTransaccionActualizada,
}) {
  const items = datos?.items ?? [];
  const pagina = datos?.pagina ?? 1;
  const paginas = datos?.paginas ?? 1;
  const total = datos?.total ?? 0;

  const [accionando, setAccionando] = useState(null);

  const handleConfirmar = async (txId) => {
    if (!portafolioId) return;
    setAccionando(txId);
    try {
      const res = await fetch(
        `/api/portafolios/${portafolioId}/transacciones/${txId}/confirmar`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const data = await res.json();
        console.error('Error al confirmar:', data.error);
      }
      onTransaccionActualizada?.();
    } catch (err) {
      console.error('Error al confirmar transacción:', err);
    } finally {
      setAccionando(null);
    }
  };

  const handleCancelar = async (txId) => {
    if (!portafolioId) return;
    setAccionando(txId);
    try {
      const res = await fetch(
        `/api/portafolios/${portafolioId}/transacciones/${txId}/cancelar`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        console.error('Error al cancelar:', data.error);
      }
      onTransaccionActualizada?.();
    } catch (err) {
      console.error('Error al cancelar transacción:', err);
    } finally {
      setAccionando(null);
    }
  };

  const tipoBadge = {
    compra: { variante: 'azul', texto: 'Compra' },
    venta: { variante: 'rojo', texto: 'Venta' },
    dividendo: { variante: 'verde', texto: 'Dividendo' },
  };

  if (items.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-bloomberg-text-muted text-sm">
        No hay transacciones registradas en este portafolio.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-sm" role="table" aria-label="Historial de transacciones">
          <thead>
            <tr className="bg-bloomberg-panel/50 text-bloomberg-text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium" scope="col">Fecha</th>
              <th className="text-left px-4 py-3 font-medium" scope="col">Ticker</th>
              <th className="text-left px-4 py-3 font-medium" scope="col">Tipo</th>
              <th className="text-right px-4 py-3 font-medium" scope="col">Precio</th>
              <th className="text-right px-4 py-3 font-medium" scope="col">Cantidad</th>
              <th className="text-right px-4 py-3 font-medium" scope="col">Comisión</th>
              <th className="text-right px-4 py-3 font-medium" scope="col">Ganancia/Pérdida</th>
              <th className="text-left px-4 py-3 font-medium" scope="col">Estado</th>
              <th className="px-4 py-3 font-medium" scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((tx) => {
              const badge = tipoBadge[tx.tipo] || tipoBadge.compra;
              const gpColor =
                tx.ganancia_perdida == null
                  ? 'text-bloomberg-text-muted'
                  : tx.ganancia_perdida >= 0
                    ? 'text-bloomberg-green'
                    : 'text-bloomberg-red';

              return (
                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-bloomberg-text">
                    {formatFecha(tx.fecha)}
                  </td>
                  <td className="px-4 py-3 text-bloomberg-text font-medium">
                    {tx.ticker}
                  </td>
                  <td className="px-4 py-3">
                    <Badge texto={badge.texto} variante={badge.variante} />
                  </td>
                  <td className="text-right px-4 py-3 text-bloomberg-text">
                    {formatMoneda(tx.precio_unitario, tx.moneda)}
                  </td>
                  <td className="text-right px-4 py-3 text-bloomberg-text">
                    {formatNumero(tx.cantidad, tx.cantidad % 1 === 0 ? 0 : 2)}
                  </td>
                  <td className="text-right px-4 py-3 text-bloomberg-text-muted">
                    {formatMoneda(tx.comision, tx.moneda)}
                  </td>
                  <td className={`text-right px-4 py-3 font-medium ${gpColor}`}>
                    {tx.ganancia_perdida != null
                      ? formatMoneda(tx.ganancia_perdida, tx.moneda)
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {tx.estado === 'confirmada' ? (
                      <span className="text-xs text-bloomberg-green/70">✓ Confirmada</span>
                    ) : tx.estado === 'sin_fondos' ? (
                      <span className="flex flex-col">
                        <Badge texto="Sin fondos" variante="rojo" />
                        <span className="text-[10px] text-bloomberg-text-muted mt-0.5">Capital insuficiente</span>
                      </span>
                    ) : (
                      <span className="flex flex-col">
                        <Badge texto="Pendiente" variante="amarillo" />
                        <span className="text-[10px] text-bloomberg-text-muted mt-0.5">
                          {tx.cantidad > 0 ? `En espera (${tx.tipo})` : 'En pool'}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(tx.estado === 'pendiente' || tx.estado === 'sin_fondos') && portafolioId && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleConfirmar(tx.id)}
                          disabled={accionando === tx.id}
                          className="px-2 py-1 text-[10px] rounded bg-bloomberg-green/15 text-bloomberg-green
                                     border border-bloomberg-green/30 hover:bg-bloomberg-green/25
                                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          aria-label={`Confirmar transacción ${tx.id}`}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelar(tx.id)}
                          disabled={accionando === tx.id}
                          className="px-2 py-1 text-[10px] rounded bg-bloomberg-red/15 text-bloomberg-red
                                     border border-bloomberg-red/30 hover:bg-bloomberg-red/25
                                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          aria-label={`Cancelar transacción ${tx.id}`}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {paginas > 1 && (
        <nav
          className="flex items-center justify-between mt-4 px-1"
          aria-label="Paginación de transacciones"
        >
          <p className="text-xs text-bloomberg-text-muted">
            Mostrando página {pagina} de {paginas} ({total} transacciones)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onCambiarPagina(pagina - 1)}
              disabled={pagina <= 1 || loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-bloomberg-text-muted
                         hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors"
              aria-label="Página anterior"
            >
              ← Anterior
            </button>
            <button
              onClick={() => onCambiarPagina(pagina + 1)}
              disabled={pagina >= paginas || loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-bloomberg-text-muted
                         hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors"
              aria-label="Página siguiente"
            >
              Siguiente →
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

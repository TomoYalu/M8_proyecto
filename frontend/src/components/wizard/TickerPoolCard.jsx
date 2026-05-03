/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Wizard Ciclo Económico
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { formatMoneda, formatNumero } from '../../utils/formatters';
import Badge from '../common/Badge';

/**
 * Tarjeta de ticker del pool final con precio, RSI, P/E y botón "Agregar a Portafolio".
 *
 * @param {object} props
 * @param {object} props.ticker - { ticker, precio, sma200, rsi, nombre?, sector?, pe? }
 * @param {function} props.onAgregar - Callback al hacer clic en "Agregar a Portafolio"
 *
 * Valida: Requisito 7.4, 7.5
 */

function getRsiVariante(rsi) {
  if (rsi == null) return 'azul';
  if (rsi > 60) return 'amarillo';
  if (rsi < 40) return 'amarillo';
  return 'verde';
}

export default function TickerPoolCard({ ticker, onAgregar }) {
  if (!ticker) return null;

  const { ticker: symbol, precio, sma200, rsi, nombre, sector, pe } = ticker;

  return (
    <div
      className="bg-bloomberg-panel rounded-xl border border-white/10 p-5 space-y-4
                 hover:border-bloomberg-accent/30 transition-colors"
      role="article"
      aria-label={`Ticker ${symbol}`}
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-bloomberg-accent font-mono font-bold text-lg">
            {symbol}
          </h4>
          {nombre && (
            <p className="text-sm text-bloomberg-text-muted mt-0.5">{nombre}</p>
          )}
        </div>
        {sector && <Badge texto={sector} variante="azul" />}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-bloomberg-text-muted mb-1">Precio Actual</p>
          <p className="text-base font-semibold text-bloomberg-text">
            {formatMoneda(precio)}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-bloomberg-text-muted mb-1">SMA 200</p>
          <p className="text-base font-semibold text-bloomberg-text">
            {formatMoneda(sma200)}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-bloomberg-text-muted mb-1">RSI (14)</p>
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold text-bloomberg-text">
              {rsi != null ? formatNumero(rsi, 1) : '—'}
            </span>
            {rsi != null && (
              <Badge
                texto={rsi > 60 ? 'Alto' : rsi < 40 ? 'Bajo' : 'Neutral'}
                variante={getRsiVariante(rsi)}
              />
            )}
          </span>
        </div>
        {pe != null && (
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-bloomberg-text-muted mb-1">P/E</p>
            <p className="text-base font-semibold text-bloomberg-text">
              {formatNumero(pe, 1)}
            </p>
          </div>
        )}
      </div>

      {/* Botón Agregar */}
      <button
        onClick={() => onAgregar && onAgregar(ticker)}
        className="w-full py-2.5 rounded-lg bg-bloomberg-accent text-white text-sm
                   font-medium hover:bg-bloomberg-accent/80 transition-colors"
        aria-label={`Agregar ${symbol} a portafolio`}
      >
        Agregar a Portafolio
      </button>
    </div>
  );
}

/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Fiscal
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState } from 'react';
import { formatMoneda, formatNumero, formatFecha } from '../../utils/formatters';

/**
 * Conversor USD/MXN con tipo de cambio actual de Banxico.
 * Muestra ambos valores (USD y MXN) simultáneamente.
 *
 * Requisitos cubiertos: 9.4
 */
export default function CurrencyConverter({ tipoCambio = null }) {
  const [montoUsd, setMontoUsd] = useState('');
  const [direccion, setDireccion] = useState('usd_a_mxn'); // 'usd_a_mxn' | 'mxn_a_usd'

  const tc = tipoCambio?.usd_mxn || 0;
  const monto = parseFloat(montoUsd) || 0;

  const resultado =
    direccion === 'usd_a_mxn'
      ? monto * tc
      : tc > 0
        ? monto / tc
        : 0;

  const monedaOrigen = direccion === 'usd_a_mxn' ? 'USD' : 'MXN';
  const monedaDestino = direccion === 'usd_a_mxn' ? 'MXN' : 'USD';

  return (
    <div className="bg-bloomberg-panel rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-bloomberg-bg">
        <h3 className="text-sm font-semibold text-bloomberg-text">
          Conversor USD / MXN
        </h3>
        {tipoCambio && (
          <p className="text-xs text-bloomberg-text-muted mt-1">
            Tipo de cambio: {formatNumero(tc, 4)} MXN por USD
            {tipoCambio.fuente && (
              <span className="ml-2">
                ({tipoCambio.fuente === 'banxico_api' ? 'Banxico' : 'Caché'})
              </span>
            )}
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Selector de dirección */}
        <div className="flex gap-2">
          <button
            onClick={() => setDireccion('usd_a_mxn')}
            className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors ${
              direccion === 'usd_a_mxn'
                ? 'bg-bloomberg-accent text-white'
                : 'bg-bloomberg-bg text-bloomberg-text-muted hover:text-bloomberg-text'
            }`}
            aria-pressed={direccion === 'usd_a_mxn'}
          >
            USD → MXN
          </button>
          <button
            onClick={() => setDireccion('mxn_a_usd')}
            className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors ${
              direccion === 'mxn_a_usd'
                ? 'bg-bloomberg-accent text-white'
                : 'bg-bloomberg-bg text-bloomberg-text-muted hover:text-bloomberg-text'
            }`}
            aria-pressed={direccion === 'mxn_a_usd'}
          >
            MXN → USD
          </button>
        </div>

        {/* Input de monto */}
        <div>
          <label
            htmlFor="monto-conversion"
            className="block text-xs text-bloomberg-text-muted mb-1"
          >
            Monto en {monedaOrigen}
          </label>
          <input
            id="monto-conversion"
            type="number"
            min="0"
            step="0.01"
            value={montoUsd}
            onChange={(e) => setMontoUsd(e.target.value)}
            placeholder={`Ingrese monto en ${monedaOrigen}`}
            className="w-full px-3 py-2 bg-bloomberg-bg border border-bloomberg-panel
                       rounded-lg text-bloomberg-text text-sm
                       focus:outline-none focus:ring-1 focus:ring-bloomberg-accent"
            aria-label={`Monto en ${monedaOrigen} para convertir`}
          />
        </div>

        {/* Resultado */}
        {monto > 0 && tc > 0 && (
          <div className="bg-bloomberg-bg rounded-lg p-4 text-center space-y-2">
            <div className="text-bloomberg-text-muted text-xs">
              {formatMoneda(monto, monedaOrigen)}
            </div>
            <div className="text-bloomberg-accent text-lg">↓</div>
            <div className="text-bloomberg-green text-xl font-bold">
              {formatMoneda(resultado, monedaDestino)}
            </div>
            <div className="text-bloomberg-text-muted text-xs">
              TC: 1 USD = {formatNumero(tc, 4)} MXN
            </div>
          </div>
        )}

        {/* Fecha de actualización */}
        {tipoCambio?.updated_at && (
          <p className="text-xs text-bloomberg-text-muted text-center">
            Última actualización: {formatFecha(tipoCambio.updated_at, true)}
          </p>
        )}
      </div>
    </div>
  );
}

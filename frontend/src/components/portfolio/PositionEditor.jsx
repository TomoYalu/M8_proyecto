/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { formatMoneda, formatNumero } from '../../utils/formatters';

/**
 * Modal para editar la cantidad de una posición existente.
 *
 * Muestra cantidad actual, precio actual, un input para la cantidad deseada
 * con slider, y un resumen de la transacción resultante (compra/venta).
 *
 * @param {object} props
 * @param {boolean} props.abierto - Controla visibilidad del modal
 * @param {object} props.posicion - Posición a editar { id, ticker, cantidad, precio_actual, moneda }
 * @param {function} props.onCerrar - Callback al cerrar
 * @param {function} props.onGuardar - Callback(posicionId, cantidadDeseada)
 * @param {boolean} [props.loading] - Estado de carga
 * @param {string} [props.error] - Mensaje de error
 */
export default function PositionEditor({
  abierto,
  posicion,
  onCerrar,
  onGuardar,
  loading = false,
  error = null,
}) {
  const [cantidadDeseada, setCantidadDeseada] = useState('');

  const cantidadActual = posicion?.cantidad ?? 0;
  const precioActual = posicion?.precio_actual ?? 0;
  const moneda = posicion?.moneda ?? 'USD';
  const ticker = posicion?.ticker ?? '';

  // Reset when modal opens or position changes
  useEffect(() => {
    if (abierto && posicion) {
      setCantidadDeseada(String(posicion.cantidad ?? 0));
    }
  }, [abierto, posicion]);

  const cantidadNum = parseFloat(cantidadDeseada) || 0;
  const diff = cantidadNum - cantidadActual;
  const absDiff = Math.abs(diff);

  const resumen = useMemo(() => {
    if (diff === 0) return null;
    const tipo = diff > 0 ? 'Compra' : 'Venta';
    const costo = absDiff * precioActual;
    return { tipo, cantidad: absDiff, costo };
  }, [diff, absDiff, precioActual]);

  const sinCambios = diff === 0;
  const sliderMax = Math.max(cantidadActual * 3, 100);

  const handleGuardar = () => {
    if (sinCambios || !posicion) return;
    onGuardar(posicion.id, cantidadNum);
  };

  const handleCerrar = () => {
    setCantidadDeseada('');
    onCerrar();
  };

  const inputClasses =
    'w-full px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/10 text-sm ' +
    'text-bloomberg-text placeholder-bloomberg-text-muted/50 focus:outline-none ' +
    'focus:ring-1 focus:ring-bloomberg-accent transition-colors';

  return (
    <Modal
      abierto={abierto}
      onCerrar={handleCerrar}
      titulo={`Editar Posición — ${ticker}`}
    >
      <div className="space-y-5" role="form" aria-label={`Editar posición de ${ticker}`}>
        {/* Error */}
        {error && (
          <div
            className="p-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                        text-sm text-bloomberg-red"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Current position info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bloomberg-bg/50 rounded-lg px-4 py-3 border border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted mb-1">
              Cantidad actual
            </p>
            <p className="text-lg font-bold text-bloomberg-text">
              {formatNumero(cantidadActual, cantidadActual % 1 === 0 ? 0 : 2)}
              <span className="text-xs font-normal text-bloomberg-text-muted ml-1.5">
                títulos
              </span>
            </p>
          </div>
          <div className="bg-bloomberg-bg/50 rounded-lg px-4 py-3 border border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-bloomberg-text-muted mb-1">
              Precio actual
            </p>
            <p className="text-lg font-bold text-bloomberg-text">
              {precioActual > 0 ? formatMoneda(precioActual, moneda) : 'Sin precio'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Desired quantity input */}
        <div>
          <label
            htmlFor="pos-cantidad-deseada"
            className="block text-xs text-bloomberg-text-muted mb-1"
          >
            Cantidad deseada
          </label>
          <input
            id="pos-cantidad-deseada"
            type="number"
            step="1"
            min="0"
            value={cantidadDeseada}
            onChange={(e) => setCantidadDeseada(e.target.value)}
            className={inputClasses}
            aria-describedby="pos-cantidad-desc"
          />
          {/* Slider */}
          <input
            type="range"
            min="0"
            max={sliderMax}
            step="1"
            value={cantidadNum}
            onChange={(e) => setCantidadDeseada(e.target.value)}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                       bg-white/10 accent-bloomberg-accent mt-2"
            aria-label="Slider cantidad deseada"
          />
          <div className="flex justify-between text-[10px] text-bloomberg-text-muted mt-0.5">
            <span>0</span>
            <span>{formatNumero(sliderMax, 0)}</span>
          </div>
        </div>

        {/* Transaction preview */}
        {resumen && precioActual > 0 && (
          <div
            className={`px-4 py-3 rounded-lg border ${
              resumen.tipo === 'Compra'
                ? 'bg-bloomberg-green/5 border-bloomberg-green/20'
                : 'bg-bloomberg-red/5 border-bloomberg-red/20'
            }`}
            id="pos-cantidad-desc"
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  resumen.tipo === 'Compra' ? 'text-bloomberg-green' : 'text-bloomberg-red'
                }`}
              >
                → {resumen.tipo}
              </span>
              <span className="text-sm text-bloomberg-text">
                de{' '}
                <span className="font-bold">
                  {formatNumero(resumen.cantidad, resumen.cantidad % 1 === 0 ? 0 : 2)}
                </span>{' '}
                títulos a {formatMoneda(precioActual, moneda)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-sm font-medium text-bloomberg-text">
                = {formatMoneda(resumen.costo, moneda)}
              </span>
              <span className="text-[10px] text-bloomberg-text-muted">
                Transacción pendiente de confirmación
              </span>
            </div>
          </div>
        )}

        {sinCambios && (
          <p className="text-xs text-bloomberg-text-muted text-center py-2">
            La cantidad deseada es igual a la actual. No se generará ninguna transacción.
          </p>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleCerrar}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                       hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={sinCambios || loading}
            className="px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                       hover:bg-bloomberg-accent/80 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors"
            aria-label="Guardar cambios de posición"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

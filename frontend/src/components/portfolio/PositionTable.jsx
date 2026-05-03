/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Portafolios
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useEffect, useState, useCallback } from 'react';
import { formatMoneda, formatPorcentaje, formatNumero, formatFecha } from '../../utils/formatters';
import Badge from '../common/Badge';
import SemaforoIndicator from '../news/SemaforoIndicator';
import Tooltip from '../common/Tooltip';
import TickerDrawer from '../search/TickerDrawer';
import useStore from '../../store';

/**
 * Estrella de favorito inline para la tabla de posiciones.
 */
function FavoritoStar({ ticker }) {
  const favoritos = useStore((s) => s.favoritos);
  const toggleFavorito = useStore((s) => s.toggleFavorito);
  const esFav = favoritos.includes(ticker);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorito(ticker);
      }}
      className="p-0.5 transition-colors hover:scale-110 transform"
      title={esFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      aria-label={esFav ? `Quitar ${ticker} de favoritos` : `Agregar ${ticker} a favoritos`}
    >
      {esFav ? (
        <svg className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-bloomberg-text-muted/40 hover:text-yellow-400" fill="none"
             viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
    </button>
  );
}

// ─── Helpers: Precio pendiente (Req 3.1) ────────────────────────

/**
 * Determina si una posición tiene precio no disponible.
 * @param {object} pos - Posición del portafolio
 * @returns {boolean} true si el precio no está disponible
 */
function esPrecioPendiente(pos) {
  return pos.precio_pendiente === true || pos.precio_actual === 0 || pos.precio_actual == null;
}

// ─── Helpers: Semáforo compuesto por activo (Req 11.1–11.6) ────

/**
 * Calcula el semáforo compuesto para un activo basado en 3 señales:
 * - Señal 1: cambio_diario > 0 → positiva, ≤ 0 → negativa
 * - Señal 2: RSI 40–60 → positiva, >70 o <30 → negativa, else neutral (no cuenta)
 * - Señal 3: Semáforo de noticias verde → positiva
 *
 * Verde = ≥2 positivas, Amarillo = 1 positiva, Rojo = 0 positivas.
 * Si RSI no disponible, usa solo 2 señales con mismos umbrales.
 *
 * @param {number|null} cambioPct - Cambio diario porcentual
 * @param {number|null} rsi - Valor RSI (0–100)
 * @param {string|null} semaforoNoticias - 'verde'|'amarillo'|'rojo'
 * @returns {{ color: string, señales: object, positivas: number }}
 */
export function calcularSemaforoCompuesto(cambioPct, rsi, semaforoNoticias) {
  const señales = {};
  let positivas = 0;
  let totalSeñales = 0;

  // Señal 1: Cambio diario
  if (cambioPct != null && !isNaN(cambioPct)) {
    const esPositiva = cambioPct > 0;
    señales.cambio_diario = {
      valor: cambioPct,
      positiva: esPositiva,
    };
    if (esPositiva) positivas++;
    totalSeñales++;
  }

  // Señal 2: RSI (solo si disponible — Req 11.5)
  if (rsi != null && !isNaN(rsi)) {
    let esPositiva = false;
    let zona = 'intermedia';
    if (rsi >= 40 && rsi <= 60) {
      esPositiva = true;
      zona = 'neutral';
    } else if (rsi > 70) {
      esPositiva = false;
      zona = 'sobrecompra';
    } else if (rsi < 30) {
      esPositiva = false;
      zona = 'sobreventa';
    } else {
      // RSI between 30-40 or 60-70: not positive, not extreme
      esPositiva = false;
      zona = rsi > 60 ? 'elevado' : 'bajo';
    }
    señales.rsi = { valor: rsi, zona, positiva: esPositiva };
    if (esPositiva) positivas++;
    totalSeñales++;
  }

  // Señal 3: Semáforo de noticias
  if (semaforoNoticias) {
    const esPositiva = semaforoNoticias === 'verde';
    señales.noticias = {
      semaforo: semaforoNoticias,
      positiva: esPositiva,
    };
    if (esPositiva) positivas++;
    totalSeñales++;
  }

  // Determinar color: verde ≥2, amarillo = 1, rojo = 0
  let color;
  if (positivas >= 2) {
    color = 'verde';
  } else if (positivas === 1) {
    color = 'amarillo';
  } else {
    color = 'rojo';
  }

  return { color, señales, positivas };
}

const SEMAFORO_ACTIVO_COLORS = {
  verde: 'bg-bloomberg-green shadow-bloomberg-green/40',
  amarillo: 'bg-bloomberg-yellow shadow-bloomberg-yellow/40',
  rojo: 'bg-bloomberg-red shadow-bloomberg-red/40',
};

const SEMAFORO_ACTIVO_LABELS = {
  verde: 'Señal positiva',
  amarillo: 'Señal mixta',
  rojo: 'Señal negativa',
};

/**
 * Genera el texto del tooltip con el desglose de señales del semáforo compuesto.
 * @param {object} resultado - Resultado de calcularSemaforoCompuesto
 * @returns {string} Texto descriptivo para el tooltip
 */
function generarTooltipSemaforo(resultado) {
  const lineas = [SEMAFORO_ACTIVO_LABELS[resultado.color]];

  if (resultado.señales.cambio_diario) {
    const s = resultado.señales.cambio_diario;
    const signo = s.valor > 0 ? '+' : '';
    lineas.push(`Cambio diario: ${signo}${s.valor.toFixed(2)}% ${s.positiva ? '✓' : '✗'}`);
  }

  if (resultado.señales.rsi) {
    const s = resultado.señales.rsi;
    lineas.push(`RSI: ${s.valor.toFixed(0)} (${s.zona}) ${s.positiva ? '✓' : '✗'}`);
  } else {
    lineas.push('RSI: sin datos');
  }

  if (resultado.señales.noticias) {
    const s = resultado.señales.noticias;
    lineas.push(`Noticias: ${s.semaforo} ${s.positiva ? '✓' : '✗'}`);
  } else {
    lineas.push('Noticias: sin datos');
  }

  return lineas.join('\n');
}

/**
 * Indicador visual del semáforo compuesto por activo.
 * Muestra un círculo coloreado con tooltip de desglose.
 *
 * @param {object} props
 * @param {object} props.resultado - Resultado de calcularSemaforoCompuesto
 */
const SIGNAL_CHIP = {
  verde:    { text: 'Alcista',  bg: 'bg-bloomberg-green/15', border: 'border-bloomberg-green/30', color: 'text-bloomberg-green' },
  amarillo: { text: 'Neutral',  bg: 'bg-bloomberg-yellow/15', border: 'border-bloomberg-yellow/30', color: 'text-bloomberg-yellow' },
  rojo:     { text: 'Bajista',  bg: 'bg-bloomberg-red/15', border: 'border-bloomberg-red/30', color: 'text-bloomberg-red' },
};

function SemaforoCompuestoIndicator({ resultado }) {
  if (!resultado) return null;

  const chip = SIGNAL_CHIP[resultado.color] || SIGNAL_CHIP.amarillo;
  const tooltipTexto = generarTooltipSemaforo(resultado);

  return (
    <Tooltip texto={tooltipTexto}>
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-default ${chip.bg} ${chip.border} ${chip.color}`}
        role="img"
        aria-label={`Señal: ${chip.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${SEMAFORO_ACTIVO_COLORS[resultado.color]}`} />
        {chip.text}
      </span>
    </Tooltip>
  );
}

/**
 * Tabla de posiciones con columnas: Ticker, Cantidad, Precio Promedio,
 * Precio Actual, Valor de Mercado, P&L Bruto, P&L %, Dividendos.
 *
 * Muestra badge "Delay 15 min" para tickers .MX, indicador de
 * "Precio desactualizado" cuando aplique, semáforo de noticias,
 * semáforo compuesto por activo, y manejo de precios nulos.
 *
 * @param {object} props
 * @param {Array} props.posiciones - Lista de posiciones
 * @param {object} [props.preciosEnVivo] - Precios en tiempo real del store
 * @param {function} [props.onEditarPosicion] - Callback para editar una posición (abre TransactionForm pre-llenado)
 *
 * Requisitos cubiertos: 3.1–3.7, 6.5, 11.1–11.6, 12.2, 12.4, 12.7
 */
export default function PositionTable({ posiciones = [], preciosEnVivo = {}, onEditarPosicion }) {
  const semaforos = useStore((s) => s.semaforosCache);
  const rsiData = useStore((s) => s.rsiCache);
  const fetchSemaforosBatch = useStore((s) => s.fetchSemaforosBatch);
  const fetchRsiBatch = useStore((s) => s.fetchRsiBatch);
  const [drawerTicker, setDrawerTicker] = useState(null);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  const handleTickerClick = useCallback((ticker) => {
    setDrawerTicker(ticker);
    setDrawerAbierto(true);
  }, []);



  // RSI y semáforos se obtienen via batch desde el store
  useEffect(() => {
    const tickers = posiciones.map((p) => p.ticker).filter(Boolean);
    if (tickers.length > 0) {
      fetchSemaforosBatch(tickers);
      fetchRsiBatch(tickers);
    }
  }, [posiciones]);

  if (posiciones.length === 0) {
    return (
      <div className="text-center py-8 text-bloomberg-text-muted text-sm">
        No hay posiciones en este portafolio. Registre una transacción de compra para comenzar.
      </div>
    );
  }

  const esMX = (ticker) => ticker?.endsWith('.MX');

  /**
   * Formatea fecha para tooltip del precio: "dd/mm/yyyy HH:mm".
   * @param {string} fechaISO - Fecha en formato ISO
   * @returns {string} Fecha formateada
   */
  const formatFechaTooltip = (fechaISO) => {
    if (!fechaISO) return 'Nunca actualizado';
    const d = new Date(fechaISO);
    if (isNaN(d.getTime())) return 'Nunca actualizado';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  };

  return (
    <>
    <div className="overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full text-sm" role="table" aria-label="Tabla de posiciones">
        <thead>
          <tr className="text-bloomberg-text/70 text-xs uppercase tracking-[0.15em] border-b border-white/10">
            <th className="text-left px-4 py-3.5 font-semibold" scope="col">Ticker</th>
            <th className="text-right px-4 py-3.5 font-semibold" scope="col">Cantidad</th>
            <th className="text-right px-4 py-3.5 font-semibold" scope="col">Precio Promedio</th>
            <th className="text-right px-4 py-3.5 font-semibold" scope="col">Precio Actual</th>
            <th className="text-right px-4 py-3.5 font-semibold" scope="col">Valor de Mercado</th>
            <th className="text-right px-4 py-3.5 font-semibold" scope="col">P&L Bruto</th>
            <th className="text-right px-4 py-3.5 font-semibold" scope="col">P&L %</th>
            <th className="text-right px-4 py-3.5 font-semibold" scope="col">Dividendos</th>
            <th className="text-left px-4 py-3.5 font-semibold" scope="col">Estado</th>
            {/* Columna de acciones (editar) */}
            <th className="w-10 px-2 py-3" scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.07]">
          {posiciones.map((pos) => {
            const precioVivo = preciosEnVivo[pos.ticker];
            const pendiente = esPrecioPendiente(pos);
            const precioMostrar = precioVivo?.precio ?? pos.precio_actual;
            const pnlColor = pos.pnl_bruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red';
            const pnlPctColor = pos.pnl_porcentual >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red';
            const esPool = pos.cantidad === 0;

            // Semáforo compuesto por activo (Req 11.1–11.6)
            const cambioPct = precioVivo?.cambio_pct ?? pos.cambio_pct ?? null;
            const rsi = rsiData[pos.ticker] ?? null;
            const semaforoNoticias = semaforos[pos.ticker]?.semaforo ?? null;
            const semaforoCompuesto = calcularSemaforoCompuesto(cambioPct, rsi, semaforoNoticias);

            // Tooltip de fecha de actualización del precio
            const tooltipPrecio = pos.ultima_actualizacion
              ? `Actualizado: ${formatFechaTooltip(pos.ultima_actualizacion)}`
              : 'Nunca actualizado';

            // Clases de fila: resaltar en rojo sutil si precio pendiente
            const rowClasses = pendiente
              ? 'bg-bloomberg-red/5 border-l-2 border-l-bloomberg-red/40 hover:bg-bloomberg-red/10 transition-colors duration-150'
              : 'hover:bg-white/[0.06] transition-colors duration-150';

            return (
              <tr
                key={pos.id}
                className={rowClasses}
              >
                {/* Ticker con semáforos y badges */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Favorito */}
                    <FavoritoStar ticker={pos.ticker} />
                    {/* Señal compuesta (combina cambio diario + RSI + noticias) */}
                    <SemaforoCompuestoIndicator resultado={semaforoCompuesto} />
                    <span className="font-medium text-bloomberg-text text-sm">
                      <button
                        type="button"
                        onClick={() => handleTickerClick(pos.ticker)}
                        className="hover:underline hover:text-bloomberg-accent cursor-pointer
                                   transition-colors text-left"
                      >
                        {pos.ticker}
                      </button>
                    </span>
                    {esMX(pos.ticker) && (
                      <Badge texto="Delay 15 min" variante="amarillo" ariaLabel="Precio con retraso de 15 minutos" />
                    )}
                  </div>
                </td>

                {/* Cantidad con badge "Pool" si cantidad === 0 */}
                <td className="text-right px-4 py-3 text-bloomberg-text font-mono tabular-nums">
                  <div className="flex items-center justify-end gap-2">
                    {esPool && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium
                                   bg-bloomberg-accent/10 text-bloomberg-accent/70 border border-bloomberg-accent/20"
                        aria-label="Ticker en pool de análisis"
                      >
                        Pool
                      </span>
                    )}
                    {formatNumero(pos.cantidad, pos.cantidad % 1 === 0 ? 0 : 2)}
                  </div>
                </td>

                {/* Precio Promedio — "—" si es pool con precio 0 */}
                <td className="text-right px-4 py-3 text-bloomberg-text font-mono tabular-nums">
                  {esPool && pos.precio_promedio === 0 ? '—' : formatMoneda(pos.precio_promedio, pos.moneda)}
                </td>

                {/* Precio Actual — badge rojo si pendiente, tooltip con fecha de actualización */}
                <td className="text-right px-4 py-3 text-bloomberg-text font-mono tabular-nums">
                  {pendiente ? (
                    <Tooltip texto={tooltipPrecio} posicion="top">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                                   bg-bloomberg-red/10 text-bloomberg-red border border-bloomberg-red/20"
                        aria-label="Precio no disponible"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none"
                          viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Sin precio
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip texto={tooltipPrecio} posicion="top">
                      <span>{formatMoneda(precioMostrar, pos.moneda)}</span>
                    </Tooltip>
                  )}
                </td>

                {/* Valor de Mercado — "—" si pendiente (Req 3.1) */}
                <td className="text-right px-4 py-3 text-bloomberg-text font-medium font-mono tabular-nums">
                  {pendiente ? '—' : formatMoneda(pos.valor_mercado, pos.moneda)}
                </td>

                {/* P&L Bruto — "—" si pendiente (Req 3.1) */}
                <td className={`text-right px-4 py-3 font-medium font-mono tabular-nums transition-colors duration-300 ${pendiente ? 'text-bloomberg-text-muted' : pnlColor}`}>
                  {pendiente ? '—' : formatMoneda(pos.pnl_bruto, pos.moneda)}
                </td>

                {/* P&L % — "—" si pendiente (Req 3.1) */}
                <td className={`text-right px-4 py-3 font-medium font-mono tabular-nums transition-colors duration-300 ${pendiente ? 'text-bloomberg-text-muted' : pnlPctColor}`}>
                  {pendiente ? '—' : formatPorcentaje(pos.pnl_porcentual)}
                </td>

                <td className="text-right px-4 py-3 text-bloomberg-text font-mono tabular-nums">
                  {formatMoneda(pos.dividendos_acumulados, pos.moneda)}
                </td>


                {/* Estado */}
                <td className="px-4 py-3 text-xs">
                  {pos.estado === 'confirmada' ? (
                    <span className="text-bloomberg-green/70">✓ Activo</span>
                  ) : pos.estado === 'sin_fondos' ? (
                    <span className="text-bloomberg-red">⚠ Sin fondos</span>
                  ) : pos.estado === 'pendiente' ? (
                    <span className="text-bloomberg-yellow">⏳ Pendiente</span>
                  ) : pos.cantidad === 0 ? (
                    <span className="text-bloomberg-text-muted">En pool</span>
                  ) : (
                    <span className="text-bloomberg-text-muted">—</span>
                  )}
                </td>
                {/* Botón editar posición */}
                <td className="px-2 py-3 text-center">
                  {onEditarPosicion && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditarPosicion(pos);
                      }}
                      className="p-1 rounded-md text-bloomberg-text-muted hover:text-bloomberg-accent
                                 hover:bg-white/5 transition-colors"
                      title={`Editar posición de ${pos.ticker}`}
                      aria-label={`Editar posición de ${pos.ticker}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Drawer de detalle de ticker */}
    <TickerDrawer
      ticker={drawerTicker}
      abierto={drawerAbierto}
      onCerrar={() => setDrawerAbierto(false)}
    />
    </>
  );
}

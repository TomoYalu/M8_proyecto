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

  return lineas.join(' · ');
}

/**
 * Indicador visual del semáforo compuesto por activo.
 * Muestra un círculo coloreado con tooltip de desglose.
 *
 * @param {object} props
 * @param {object} props.resultado - Resultado de calcularSemaforoCompuesto
 */
function SemaforoCompuestoIndicator({ resultado }) {
  if (!resultado) return null;

  const colorClass = SEMAFORO_ACTIVO_COLORS[resultado.color] || 'bg-bloomberg-text-muted/40';
  const tooltipTexto = generarTooltipSemaforo(resultado);

  return (
    <Tooltip texto={tooltipTexto}>
      <span
        className={`inline-block w-3 h-3 rounded-full shadow-sm ${colorClass} cursor-default`}
        role="img"
        aria-label={`Semáforo compuesto: ${SEMAFORO_ACTIVO_LABELS[resultado.color]}`}
      />
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
 *
 * Requisitos cubiertos: 3.1–3.7, 6.5, 11.1–11.6, 12.2, 12.4, 12.7
 */
export default function PositionTable({ posiciones = [], preciosEnVivo = {} }) {
  const [semaforos, setSemaforos] = useState({});
  const [rsiData, setRsiData] = useState({});
  const [drawerTicker, setDrawerTicker] = useState(null);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  const handleTickerClick = useCallback((ticker) => {
    setDrawerTicker(ticker);
    setDrawerAbierto(true);
  }, []);

  /**
   * Fetch semáforo data for all tickers in the position table.
   */
  const fetchSemaforos = useCallback(async (tickers) => {
    const resultados = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const res = await fetch(`/api/noticias/${encodeURIComponent(ticker)}/semaforo`);
        if (!res.ok) return { ticker, data: null };
        const data = await res.json();
        return { ticker, data };
      })
    );

    const nuevos = {};
    for (const res of resultados) {
      if (res.status === 'fulfilled' && res.value.data) {
        nuevos[res.value.ticker] = res.value.data;
      }
    }
    setSemaforos(nuevos);
  }, []);

  /**
   * Fetch RSI data for all tickers from the technical analysis endpoint.
   * Uses a short period to get just the latest RSI value.
   */
  const fetchRsiData = useCallback(async (tickers) => {
    const resultados = await Promise.allSettled(
      tickers.map(async (ticker) => {
        try {
          const res = await fetch(`/api/analisis?ticker=${encodeURIComponent(ticker)}&periodo=3mo&intervalo=1d`);
          if (!res.ok) return { ticker, rsi: null };
          const data = await res.json();
          // RSI is an array; take the last non-null value
          const rsiArray = data.rsi || [];
          let lastRsi = null;
          for (let i = rsiArray.length - 1; i >= 0; i--) {
            if (rsiArray[i] != null) {
              lastRsi = rsiArray[i];
              break;
            }
          }
          return { ticker, rsi: lastRsi };
        } catch {
          return { ticker, rsi: null };
        }
      })
    );

    const nuevos = {};
    for (const res of resultados) {
      if (res.status === 'fulfilled') {
        nuevos[res.value.ticker] = res.value.rsi;
      }
    }
    setRsiData(nuevos);
  }, []);

  useEffect(() => {
    const tickers = posiciones.map((p) => p.ticker).filter(Boolean);
    if (tickers.length > 0) {
      fetchSemaforos(tickers);
      fetchRsiData(tickers);
    }
  }, [posiciones, fetchSemaforos, fetchRsiData]);

  if (posiciones.length === 0) {
    return (
      <div className="text-center py-8 text-bloomberg-text-muted text-sm">
        No hay posiciones en este portafolio. Registre una transacción de compra para comenzar.
      </div>
    );
  }

  const esMX = (ticker) => ticker?.endsWith('.MX');

  const precioDesactualizado = (pos) => {
    if (!pos.ultima_actualizacion) return true;
    const ahora = new Date();
    const ultima = new Date(pos.ultima_actualizacion);
    const diffMs = ahora - ultima;
    // Considerar desactualizado si tiene más de 30 minutos
    return diffMs > 30 * 60 * 1000;
  };

  return (
    <>
    <div className="overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full text-sm" role="table" aria-label="Tabla de posiciones">
        <thead>
          <tr className="bg-bloomberg-panel/50 text-bloomberg-text-muted text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium" scope="col">Ticker</th>
            <th className="text-right px-4 py-3 font-medium" scope="col">Cantidad</th>
            <th className="text-right px-4 py-3 font-medium" scope="col">Precio Promedio</th>
            <th className="text-right px-4 py-3 font-medium" scope="col">Precio Actual</th>
            <th className="text-right px-4 py-3 font-medium" scope="col">Valor de Mercado</th>
            <th className="text-right px-4 py-3 font-medium" scope="col">P&L Bruto</th>
            <th className="text-right px-4 py-3 font-medium" scope="col">P&L %</th>
            <th className="text-right px-4 py-3 font-medium" scope="col">Dividendos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {posiciones.map((pos) => {
            const precioVivo = preciosEnVivo[pos.ticker];
            const pendiente = esPrecioPendiente(pos);
            const precioMostrar = precioVivo?.precio ?? pos.precio_actual;
            const pnlColor = pos.pnl_bruto >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red';
            const pnlPctColor = pos.pnl_porcentual >= 0 ? 'text-bloomberg-green' : 'text-bloomberg-red';
            const desactualizado = precioDesactualizado(pos) && !precioVivo;

            // Semáforo compuesto por activo (Req 11.1–11.6)
            const cambioPct = precioVivo?.cambio_pct ?? pos.cambio_pct ?? null;
            const rsi = rsiData[pos.ticker] ?? null;
            const semaforoNoticias = semaforos[pos.ticker]?.semaforo ?? null;
            const semaforoCompuesto = calcularSemaforoCompuesto(cambioPct, rsi, semaforoNoticias);

            return (
              <tr
                key={pos.id}
                className="hover:bg-white/[0.04] transition-colors duration-150"
              >
                {/* Ticker con semáforos y badges */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Favorito */}
                    <FavoritoStar ticker={pos.ticker} />
                    {/* Semáforo compuesto por activo (Req 11.1, 11.6) */}
                    <SemaforoCompuestoIndicator resultado={semaforoCompuesto} />
                    {/* Semáforo de noticias */}
                    {semaforos[pos.ticker] ? (
                      <SemaforoIndicator
                        semaforo={semaforos[pos.ticker].semaforo}
                        score={semaforos[pos.ticker].score}
                        fecha={semaforos[pos.ticker].fecha}
                      />
                    ) : (
                      <span
                        className="inline-block w-3 h-3 rounded-full border border-bloomberg-text-muted/40"
                        aria-label="Semáforo de noticias sin datos"
                        title="Sin datos de noticias"
                      />
                    )}
                    <span className="font-medium text-bloomberg-text">
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
                    {desactualizado && !pendiente && (
                      <span
                        className="text-xs text-bloomberg-yellow flex items-center gap-1"
                        title={`Última actualización: ${pos.ultima_actualizacion ? formatFecha(pos.ultima_actualizacion, true) : 'nunca'}`}
                        aria-label="Precio desactualizado"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                          viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Desactualizado
                      </span>
                    )}
                  </div>
                </td>

                <td className="text-right px-4 py-3 text-bloomberg-text font-mono tabular-nums">
                  {formatNumero(pos.cantidad, pos.cantidad % 1 === 0 ? 0 : 2)}
                </td>

                <td className="text-right px-4 py-3 text-bloomberg-text font-mono tabular-nums">
                  {formatMoneda(pos.precio_promedio, pos.moneda)}
                </td>

                {/* Precio Actual — "—" si pendiente (Req 3.1) */}
                <td className="text-right px-4 py-3 text-bloomberg-text font-mono tabular-nums">
                  {pendiente ? '—' : formatMoneda(precioMostrar, pos.moneda)}
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

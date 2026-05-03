/**
 * Helpers para interpretar valores de indicadores técnicos en el frontend.
 * Retornan objetos con { texto, tipo } donde tipo es 'alcista' | 'bajista' | 'neutral'.
 */

/**
 * Interpreta el valor del RSI.
 * @param {number} rsi - Valor RSI (0–100)
 * @returns {{ texto: string, tipo: string }}
 */
export function interpretarRSI(rsi) {
  if (rsi == null || isNaN(rsi)) return { texto: 'Sin datos de RSI', tipo: 'neutral' };
  if (rsi > 70) return { texto: 'Sobrecompra (RSI > 70): considere reducir posición', tipo: 'bajista' };
  if (rsi < 30) return { texto: 'Sobreventa (RSI < 30): posible oportunidad de compra', tipo: 'alcista' };
  if (rsi >= 40 && rsi <= 60) return { texto: 'Zona neutral (RSI 40–60): sin señal clara', tipo: 'neutral' };
  if (rsi > 60) return { texto: 'RSI elevado, acercándose a sobrecompra', tipo: 'bajista' };
  return { texto: 'RSI bajo, acercándose a sobreventa', tipo: 'alcista' };
}

/**
 * Interpreta el valor del MACD respecto a su señal.
 * @param {number} macd - Valor de la línea MACD
 * @param {number} signal - Valor de la línea de señal
 * @returns {{ texto: string, tipo: string }}
 */
export function interpretarMACD(macd, signal) {
  if (macd == null || signal == null) return { texto: 'Sin datos de MACD', tipo: 'neutral' };
  if (macd > signal && macd > 0) return { texto: 'MACD alcista: línea por encima de la señal', tipo: 'alcista' };
  if (macd < signal && macd < 0) return { texto: 'MACD bajista: línea por debajo de la señal', tipo: 'bajista' };
  if (macd > signal) return { texto: 'Cruce alcista del MACD', tipo: 'alcista' };
  return { texto: 'Cruce bajista del MACD', tipo: 'bajista' };
}

/**
 * Interpreta el estocástico de Lane.
 * @param {number} k - Valor %K
 * @param {number} d - Valor %D
 * @returns {{ texto: string, tipo: string }}
 */
export function interpretarEstocastico(k, d) {
  if (k == null || d == null) return { texto: 'Sin datos de estocástico', tipo: 'neutral' };
  if (k > 80) return { texto: 'Sobrecompra en estocástico (%K > 80)', tipo: 'bajista' };
  if (k < 20) return { texto: 'Sobreventa en estocástico (%K < 20)', tipo: 'alcista' };
  return { texto: 'Estocástico en zona neutral', tipo: 'neutral' };
}

/**
 * Interpreta cruces de medias móviles (Golden Cross / Death Cross).
 * @param {number} sma50 - Valor SMA 50
 * @param {number} sma200 - Valor SMA 200
 * @returns {{ texto: string, tipo: string }}
 */
export function interpretarCrucesSMA(sma50, sma200) {
  if (sma50 == null || sma200 == null) return { texto: 'Sin datos de SMA', tipo: 'neutral' };
  if (sma50 > sma200) return { texto: 'Tendencia alcista: SMA 50 por encima de SMA 200', tipo: 'alcista' };
  return { texto: 'Tendencia bajista: SMA 50 por debajo de SMA 200', tipo: 'bajista' };
}

/**
 * Interpreta la posición del precio respecto a las Bandas de Bollinger.
 * @param {number} precio - Precio actual
 * @param {number} upper - Banda superior
 * @param {number} lower - Banda inferior
 * @returns {{ texto: string, tipo: string }}
 */
export function interpretarBollinger(precio, upper, lower) {
  if (precio == null || upper == null || lower == null) {
    return { texto: 'Sin datos de Bollinger', tipo: 'neutral' };
  }
  if (precio >= upper) return { texto: 'Precio en banda superior de Bollinger: posible sobrecompra', tipo: 'bajista' };
  if (precio <= lower) return { texto: 'Precio en banda inferior de Bollinger: posible sobreventa', tipo: 'alcista' };
  return { texto: 'Precio dentro de las Bandas de Bollinger', tipo: 'neutral' };
}

/**
 * Retorna el color CSS según el tipo de señal.
 * @param {'alcista'|'bajista'|'neutral'} tipo
 * @returns {string} Clase de color Tailwind
 */
export function colorPorTipo(tipo) {
  switch (tipo) {
    case 'alcista': return 'text-bloomberg-green';
    case 'bajista': return 'text-bloomberg-red';
    default:        return 'text-bloomberg-yellow';
  }
}

/**
 * Retorna la variante de Badge según el tipo de señal.
 * @param {'alcista'|'bajista'|'neutral'} tipo
 * @returns {'verde'|'rojo'|'amarillo'}
 */
export function badgePorTipo(tipo) {
  switch (tipo) {
    case 'alcista': return 'verde';
    case 'bajista': return 'rojo';
    default:        return 'amarillo';
  }
}

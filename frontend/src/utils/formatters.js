/**
 * Utilidades de formateo para la UI de Lakshmi Q2.
 * Todos los formatos usan locale es-MX.
 */

/**
 * Formatea un valor como moneda.
 * @param {number} valor - Monto a formatear
 * @param {'MXN'|'USD'} [moneda='USD'] - Código de moneda
 * @returns {string} Valor formateado (ej. "$1,234.56 USD")
 */
export function formatMoneda(valor, moneda = 'USD') {
  if (valor == null || isNaN(valor)) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/**
 * Formatea un valor como porcentaje.
 * @param {number} valor - Valor decimal o porcentual (ej. 0.15 o 15)
 * @param {boolean} [yaEsPorcentaje=true] - Si true, el valor ya está en %
 * @returns {string} Valor formateado con signo (ej. "+15.00%")
 */
export function formatPorcentaje(valor, yaEsPorcentaje = true) {
  if (valor == null || isNaN(valor)) return '—';
  const pct = yaEsPorcentaje ? valor : valor * 100;
  const signo = pct > 0 ? '+' : '';
  return `${signo}${pct.toFixed(2)}%`;
}

/**
 * Formatea una fecha.
 * @param {string|Date} fecha - Fecha a formatear
 * @param {boolean} [conHora=false] - Incluir hora
 * @returns {string} Fecha formateada (ej. "15 ene 2024" o "15 ene 2024, 14:30")
 */
export function formatFecha(fecha, conHora = false) {
  if (!fecha) return '—';
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return '—';

  const opciones = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(conHora && { hour: '2-digit', minute: '2-digit' }),
  };

  return d.toLocaleDateString('es-MX', opciones);
}

/**
 * Formatea un número con separadores de miles.
 * @param {number} valor - Número a formatear
 * @param {number} [decimales=2] - Cantidad de decimales
 * @returns {string} Número formateado (ej. "1,234,567.89")
 */
export function formatNumero(valor, decimales = 2) {
  if (valor == null || isNaN(valor)) return '—';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

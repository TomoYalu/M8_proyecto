/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Alertas
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { formatFecha } from '../../utils/formatters';
import Badge from '../common/Badge';

/**
 * Mapa de tipos de alerta a nombres en español.
 */
const TIPO_NOMBRES = {
  precio_objetivo: 'Precio Objetivo',
  cambio_pct_dia: 'Cambio % Diario',
  rsi_sobrecompra: 'RSI Sobrecompra',
  rsi_sobreventa: 'RSI Sobreventa',
  golden_cross: 'Golden Cross',
  death_cross: 'Death Cross',
  divergencia_macd: 'Divergencia MACD',
  semaforo_rojo: 'Semáforo Rojo',
  concentracion: 'Concentración',
};

/**
 * Variante de color para el badge de canal.
 */
const CANAL_VARIANTE = {
  websocket: 'azul',
  email: 'verde',
  ambos: 'amarillo',
};

/**
 * Nombre legible del canal.
 */
const CANAL_NOMBRE = {
  websocket: 'WebSocket',
  email: 'Email',
  ambos: 'Ambos',
};

/**
 * Historial paginado de alertas disparadas.
 *
 * @param {object} props
 * @param {object} props.historial - { items, total, pagina, paginas }
 * @param {function} props.onCambiarPagina - Callback con número de página
 * @param {boolean} [props.loading] - Estado de carga
 *
 * Requisitos cubiertos: 8.5, 12.1, 12.2, 12.7
 */
export default function AlertHistory({ historial, onCambiarPagina, loading = false }) {
  const items = historial?.items ?? [];
  const pagina = historial?.pagina ?? 1;
  const paginas = historial?.paginas ?? 1;

  if (items.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-bloomberg-text-muted">
        <p className="text-sm">No hay alertas disparadas en el historial.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm" aria-label="Historial de alertas disparadas">
          <thead>
            <tr className="bg-white/5 text-bloomberg-text-muted text-left">
              <th className="px-4 py-3 font-medium" scope="col">Fecha</th>
              <th className="px-4 py-3 font-medium" scope="col">Ticker</th>
              <th className="px-4 py-3 font-medium" scope="col">Tipo</th>
              <th className="px-4 py-3 font-medium" scope="col">Condición</th>
              <th className="px-4 py-3 font-medium" scope="col">Valor</th>
              <th className="px-4 py-3 font-medium" scope="col">Canal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-white/5 transition-colors text-bloomberg-text"
              >
                <td className="px-4 py-3 text-bloomberg-text-muted whitespace-nowrap">
                  {formatFecha(item.timestamp, true)}
                </td>
                <td className="px-4 py-3 font-semibold text-bloomberg-accent">
                  {item.ticker}
                </td>
                <td className="px-4 py-3">
                  {TIPO_NOMBRES[item.tipo] || item.tipo}
                </td>
                <td className="px-4 py-3 text-bloomberg-text-muted">
                  {item.condicion || '—'}
                </td>
                <td className="px-4 py-3">
                  {item.valor_disparado != null ? item.valor_disparado : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    texto={CANAL_NOMBRE[item.canal] || item.canal}
                    variante={CANAL_VARIANTE[item.canal] || 'azul'}
                    ariaLabel={`Canal: ${CANAL_NOMBRE[item.canal] || item.canal}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {paginas > 1 && (
        <nav
          className="flex items-center justify-center gap-2"
          aria-label="Paginación del historial"
        >
          <button
            onClick={() => onCambiarPagina(pagina - 1)}
            disabled={pagina <= 1 || loading}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                       hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors"
            aria-label="Página anterior"
          >
            ← Anterior
          </button>

          <span className="text-sm text-bloomberg-text-muted" aria-current="page">
            Página {pagina} de {paginas}
          </span>

          <button
            onClick={() => onCambiarPagina(pagina + 1)}
            disabled={pagina >= paginas || loading}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                       hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors"
            aria-label="Página siguiente"
          >
            Siguiente →
          </button>
        </nav>
      )}
    </div>
  );
}

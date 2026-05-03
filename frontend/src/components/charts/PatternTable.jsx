import { useState } from 'react';
import Badge from '../common/Badge';
import { badgePorTipo } from '../../utils/indicators';
import { formatFecha } from '../../utils/formatters';
import ChartHeader from './ChartHeader';

const VISIBLE_DEFAULT = 5;

/**
 * Tabla de patrones chartistas detectados.
 * Columnas: Fecha, Patrón, Tipo, Precio, Confirmado 3 días.
 * Muestra 5 filas por defecto con toggle "Ver más / Ver menos".
 *
 * @param {object} props
 * @param {object} props.datos - Respuesta completa del endpoint /api/analisis
 */
export default function PatternTable({ datos }) {
  const [showAll, setShowAll] = useState(false);

  if (!datos?.patrones) return null;

  const { patrones } = datos;

  if (patrones.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-bloomberg-panel">
        <ChartHeader
          titulo="Patrones Detectados"
          tooltip="Patrones chartistas detectados"
          detalle="Los patrones chartistas son formaciones de precio que históricamente preceden movimientos específicos. Los patrones alcistas sugieren subidas, los bajistas sugieren caídas. La columna 'Confirmado 3 días' indica si el precio confirmó el patrón cerrando en la dirección esperada durante 3 sesiones consecutivas (metodología Sánchez Cantú)."
        />
        <p className="text-sm text-bloomberg-text-muted">
          No se detectaron patrones chartistas en el período seleccionado.
        </p>
      </div>
    );
  }

  const visiblePatrones = showAll ? patrones : patrones.slice(0, VISIBLE_DEFAULT);
  const hasMore = patrones.length > VISIBLE_DEFAULT;

  return (
    <div className="p-4 rounded-lg bg-bloomberg-panel" role="region" aria-label="Patrones chartistas detectados">
      <ChartHeader
        titulo={`Patrones Detectados (${patrones.length})`}
        tooltip="Patrones chartistas detectados"
        detalle="Los patrones chartistas son formaciones de precio que históricamente preceden movimientos específicos. Los patrones alcistas sugieren subidas, los bajistas sugieren caídas. La columna 'Confirmado 3 días' indica si el precio confirmó el patrón cerrando en la dirección esperada durante 3 sesiones consecutivas (metodología Sánchez Cantú)."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Tabla de patrones detectados">
          <thead>
            <tr className="border-b border-bloomberg-accent/10">
              <th className="text-left py-2 px-2 text-bloomberg-text-muted font-medium">
                Fecha
              </th>
              <th className="text-left py-2 px-2 text-bloomberg-text-muted font-medium">
                Patrón
              </th>
              <th className="text-left py-2 px-2 text-bloomberg-text-muted font-medium">
                Tipo
              </th>
              <th className="text-right py-2 px-2 text-bloomberg-text-muted font-medium">
                Precio
              </th>
              <th className="text-center py-2 px-2 text-bloomberg-text-muted font-medium">
                Confirmado 3 días
              </th>
            </tr>
          </thead>
          <tbody>
            {visiblePatrones.map((p, idx) => (
              <tr
                key={`${p.fecha}-${p.patron}-${idx}`}
                className="border-b border-bloomberg-accent/5 hover:bg-bloomberg-accent/5 transition-colors"
              >
                <td className="py-2 px-2 text-bloomberg-text font-mono text-xs">
                  {formatFecha(p.fecha)}
                </td>
                <td className="py-2 px-2 text-bloomberg-text">
                  {p.patron}
                </td>
                <td className="py-2 px-2">
                  <Badge texto={p.tipo} variante={badgePorTipo(p.tipo)} />
                </td>
                <td className="py-2 px-2 text-right text-bloomberg-text font-mono">
                  {p.precio != null ? `${p.precio.toFixed(2)}` : '—'}
                </td>
                <td className="py-2 px-2 text-center">
                  {p.confirmado_3_dias ? (
                    <span className="text-bloomberg-green" aria-label="Confirmado">✓</span>
                  ) : (
                    <span className="text-bloomberg-text-muted" aria-label="No confirmado">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-xs text-bloomberg-accent hover:text-bloomberg-accent/80 transition-colors px-3 py-1 rounded
                       border border-bloomberg-accent/20 hover:border-bloomberg-accent/40"
          >
            {showAll ? `Ver menos ▲` : `Ver más (${patrones.length - VISIBLE_DEFAULT} restantes) ▼`}
          </button>
        </div>
      )}
    </div>
  );
}

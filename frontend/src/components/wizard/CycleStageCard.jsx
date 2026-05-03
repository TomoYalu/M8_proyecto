/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Wizard Ciclo Económico
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import Badge from '../common/Badge';
import { formatNumero, formatFecha } from '../../utils/formatters';

/**
 * Tarjeta de fase del ciclo económico con indicadores macro y justificación.
 *
 * @param {object} props
 * @param {object} props.data - Datos del ciclo: { fase, indicadores, fuente, fecha_actualizacion, descripcion }
 *
 * Valida: Requisito 7.2
 */

const FASE_CONFIG = {
  Early: {
    label: 'Expansión Temprana',
    variante: 'verde',
    color: 'text-bloomberg-green',
    bgColor: 'bg-bloomberg-green/10',
    borderColor: 'border-bloomberg-green/30',
  },
  Mid: {
    label: 'Expansión Media',
    variante: 'azul',
    color: 'text-bloomberg-accent',
    bgColor: 'bg-bloomberg-accent/10',
    borderColor: 'border-bloomberg-accent/30',
  },
  Late: {
    label: 'Expansión Tardía',
    variante: 'amarillo',
    color: 'text-bloomberg-yellow',
    bgColor: 'bg-bloomberg-yellow/10',
    borderColor: 'border-bloomberg-yellow/30',
  },
  Recession: {
    label: 'Recesión',
    variante: 'rojo',
    color: 'text-bloomberg-red',
    bgColor: 'bg-bloomberg-red/10',
    borderColor: 'border-bloomberg-red/30',
  },
};

const INDICADOR_LABELS = {
  pmi: { label: 'PMI Manufacturero', sufijo: '' },
  spread_2y_10y: { label: 'Spread 2Y-10Y', sufijo: '%' },
  tasa_desempleo: { label: 'Tasa de Desempleo', sufijo: '%' },
  inflacion_yoy: { label: 'Inflación Anual', sufijo: '%' },
};

export default function CycleStageCard({ data }) {
  if (!data) return null;

  const { fase, indicadores, fuente, fecha_actualizacion, descripcion } = data;
  const config = FASE_CONFIG[fase] || FASE_CONFIG.Mid;

  return (
    <div
      className={`bg-bloomberg-panel rounded-xl border ${config.borderColor} p-6 space-y-5`}
      role="region"
      aria-label={`Fase del ciclo económico: ${config.label}`}
    >
      {/* Encabezado con fase */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${config.bgColor} ${config.color}`}>
            <div className={`w-3 h-3 rounded-full ${config.color.replace('text-', 'bg-')} animate-pulse`} />
          </div>
          <h3 className={`text-lg font-bold ${config.color}`}>
            {config.label}
          </h3>
        </div>
        <Badge texto={fase} variante={config.variante} />
      </div>

      {/* Descripción / Justificación */}
      {descripcion && (
        <p className="text-sm text-bloomberg-text-muted leading-relaxed">
          {descripcion}
        </p>
      )}

      {/* Indicadores macro */}
      {indicadores && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(indicadores).map(([key, valor]) => {
            const meta = INDICADOR_LABELS[key];
            if (!meta) return null;
            return (
              <div
                key={key}
                className="bg-white/5 rounded-lg p-3 border border-white/5"
              >
                <p className="text-xs text-bloomberg-text-muted mb-1">
                  {meta.label}
                </p>
                <p className="text-lg font-semibold text-bloomberg-text">
                  {formatNumero(valor, key === 'pmi' ? 1 : 2)}{meta.sufijo}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Fuente e indicador de actualización */}
      <div className="flex items-center justify-between text-xs text-bloomberg-text-muted pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span>Fuente:</span>
          <Badge
            texto={fuente === 'dinamico' ? 'Dinámico' : 'Estático'}
            variante={fuente === 'dinamico' ? 'verde' : 'amarillo'}
          />
        </div>
        {fecha_actualizacion && (
          <span>
            Actualizado: {formatFecha(fecha_actualizacion)}
          </span>
        )}
      </div>
    </div>
  );
}

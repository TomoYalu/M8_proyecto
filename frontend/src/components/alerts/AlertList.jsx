/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Alertas
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
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
 * Mapa de condiciones a texto legible.
 */
const CONDICION_TEXTO = {
  mayor_que: '>',
  menor_que: '<',
  igual: '=',
};

/**
 * Lista de alertas configuradas con toggle activa/inactiva y botón eliminar.
 *
 * @param {object} props
 * @param {Array} props.alertas - Lista de alertas
 * @param {function} props.onToggle - Callback para activar/desactivar (id)
 * @param {function} props.onEliminar - Callback para eliminar (id)
 *
 * Requisitos cubiertos: 8.1, 8.6, 12.1, 12.2, 12.7
 */
export default function AlertList({ alertas = [], onToggle, onEliminar }) {
  if (alertas.length === 0) {
    return (
      <div className="text-center py-8 text-bloomberg-text-muted">
        <p className="text-sm">No tienes alertas configuradas.</p>
        <p className="text-xs mt-1">Crea una alerta para recibir notificaciones automáticas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label="Lista de alertas">
      {alertas.map((alerta) => (
        <div
          key={alerta.id}
          role="listitem"
          className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
            alerta.activa
              ? 'bg-bloomberg-panel border-white/10'
              : 'bg-bloomberg-panel/50 border-white/5 opacity-60'
          }`}
        >
          {/* Info de la alerta */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Ticker */}
            <span className="text-sm font-semibold text-bloomberg-accent shrink-0">
              {alerta.ticker}
            </span>

            {/* Badge de tipo */}
            <Badge
              texto={TIPO_NOMBRES[alerta.tipo] || alerta.tipo}
              variante="azul"
              ariaLabel={`Tipo: ${TIPO_NOMBRES[alerta.tipo] || alerta.tipo}`}
            />

            {/* Condición y umbral */}
            <span className="text-sm text-bloomberg-text-muted truncate">
              {CONDICION_TEXTO[alerta.condicion] || alerta.condicion}
              {alerta.umbral != null && ` ${alerta.umbral}`}
            </span>

            {/* Indicador de email */}
            {alerta.email_habilitado && (
              <span
                className="text-xs text-bloomberg-text-muted"
                title="Notificación por email activa"
                aria-label="Email habilitado"
              >
                ✉
              </span>
            )}
          </div>

          {/* Controles */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Toggle activa/inactiva */}
            <button
              type="button"
              role="switch"
              aria-checked={alerta.activa}
              aria-label={`${alerta.activa ? 'Desactivar' : 'Activar'} alerta de ${alerta.ticker}`}
              onClick={() => onToggle(alerta.id)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                alerta.activa ? 'bg-bloomberg-green' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  alerta.activa ? 'translate-x-5' : 'translate-x-0'
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Botón eliminar */}
            <button
              onClick={() => onEliminar(alerta.id)}
              className="p-1.5 rounded-lg text-bloomberg-text-muted
                         hover:text-bloomberg-red hover:bg-bloomberg-red/10 transition-colors"
              aria-label={`Eliminar alerta de ${alerta.ticker}`}
              title="Eliminar alerta"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

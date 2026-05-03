/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Alertas
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useEffect } from 'react';
import Modal from '../common/Modal';

/**
 * Tipos de alerta disponibles con nombres en español.
 */
const TIPOS_ALERTA = [
  { valor: 'precio_objetivo', nombre: 'Precio Objetivo' },
  { valor: 'cambio_pct_dia', nombre: 'Cambio % Diario' },
  { valor: 'rsi_sobrecompra', nombre: 'RSI Sobrecompra' },
  { valor: 'rsi_sobreventa', nombre: 'RSI Sobreventa' },
  { valor: 'golden_cross', nombre: 'Golden Cross' },
  { valor: 'death_cross', nombre: 'Death Cross' },
  { valor: 'divergencia_macd', nombre: 'Divergencia MACD' },
  { valor: 'semaforo_rojo', nombre: 'Semáforo Rojo' },
  { valor: 'concentracion', nombre: 'Concentración' },
];

const CONDICIONES = [
  { valor: 'mayor_que', nombre: 'Mayor que' },
  { valor: 'menor_que', nombre: 'Menor que' },
  { valor: 'igual', nombre: 'Igual' },
];

const ESTADO_INICIAL = {
  ticker: '',
  tipo: 'precio_objetivo',
  condicion: 'mayor_que',
  umbral: '',
  portafolio_id: '',
  email_habilitado: false,
};

/**
 * Formulario para crear/editar una alerta.
 * Se muestra dentro de un Modal reutilizable.
 *
 * @param {object} props
 * @param {boolean} props.abierto - Controla visibilidad del modal
 * @param {function} props.onCerrar - Callback al cerrar
 * @param {function} props.onSubmit - Callback con datos del formulario
 * @param {object} [props.alertaEditar] - Alerta existente para edición
 * @param {Array} [props.portafolios] - Lista de portafolios disponibles
 * @param {boolean} [props.loading] - Estado de carga
 * @param {string} [props.error] - Mensaje de error
 *
 * Requisitos cubiertos: 8.1, 8.6, 12.1, 12.7
 */
export default function AlertForm({
  abierto,
  onCerrar,
  onSubmit,
  alertaEditar = null,
  portafolios = [],
  loading = false,
  error = null,
}) {
  const [form, setForm] = useState(ESTADO_INICIAL);

  useEffect(() => {
    if (alertaEditar) {
      setForm({
        ticker: alertaEditar.ticker || '',
        tipo: alertaEditar.tipo || 'precio_objetivo',
        condicion: alertaEditar.condicion || 'mayor_que',
        umbral: alertaEditar.umbral != null ? String(alertaEditar.umbral) : '',
        portafolio_id: alertaEditar.portafolio_id != null ? String(alertaEditar.portafolio_id) : '',
        email_habilitado: alertaEditar.email_habilitado || false,
      });
    } else {
      setForm(ESTADO_INICIAL);
    }
  }, [alertaEditar, abierto]);

  const handleChange = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const datos = {
      ticker: form.ticker.trim().toUpperCase(),
      tipo: form.tipo,
      condicion: form.condicion,
      umbral: form.umbral !== '' ? parseFloat(form.umbral) : null,
      portafolio_id: form.portafolio_id ? parseInt(form.portafolio_id, 10) : null,
      email_habilitado: form.email_habilitado,
    };
    onSubmit(datos);
  };

  const esEdicion = !!alertaEditar;
  const titulo = esEdicion ? 'Editar Alerta' : 'Nueva Alerta';

  const inputClasses =
    'w-full px-3 py-2 rounded-lg bg-bloomberg-bg border border-white/10 text-sm ' +
    'text-bloomberg-text placeholder-bloomberg-text-muted/50 focus:outline-none ' +
    'focus:ring-1 focus:ring-bloomberg-accent transition-colors';

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <form onSubmit={handleSubmit} className="space-y-4" aria-label={titulo}>
        {error && (
          <div
            className="p-3 rounded-lg bg-bloomberg-red/10 border border-bloomberg-red/20
                        text-sm text-bloomberg-red"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Ticker */}
        <div>
          <label htmlFor="alerta-ticker" className="block text-xs text-bloomberg-text-muted mb-1">
            Ticker *
          </label>
          <input
            id="alerta-ticker"
            type="text"
            value={form.ticker}
            onChange={(e) => handleChange('ticker', e.target.value)}
            placeholder="Ej. AAPL, AMXL.MX"
            className={inputClasses}
            required
            aria-required="true"
          />
        </div>

        {/* Tipo de alerta */}
        <div>
          <label htmlFor="alerta-tipo" className="block text-xs text-bloomberg-text-muted mb-1">
            Tipo de Alerta *
          </label>
          <select
            id="alerta-tipo"
            value={form.tipo}
            onChange={(e) => handleChange('tipo', e.target.value)}
            className={inputClasses}
            required
            aria-required="true"
          >
            {TIPOS_ALERTA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Condición */}
        <div>
          <label htmlFor="alerta-condicion" className="block text-xs text-bloomberg-text-muted mb-1">
            Condición *
          </label>
          <select
            id="alerta-condicion"
            value={form.condicion}
            onChange={(e) => handleChange('condicion', e.target.value)}
            className={inputClasses}
            required
            aria-required="true"
          >
            {CONDICIONES.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Umbral */}
        <div>
          <label htmlFor="alerta-umbral" className="block text-xs text-bloomberg-text-muted mb-1">
            Umbral
          </label>
          <input
            id="alerta-umbral"
            type="number"
            step="any"
            value={form.umbral}
            onChange={(e) => handleChange('umbral', e.target.value)}
            placeholder="Ej. 150.00"
            className={inputClasses}
          />
        </div>

        {/* Portafolio (opcional) */}
        <div>
          <label htmlFor="alerta-portafolio" className="block text-xs text-bloomberg-text-muted mb-1">
            Portafolio (opcional)
          </label>
          <select
            id="alerta-portafolio"
            value={form.portafolio_id}
            onChange={(e) => handleChange('portafolio_id', e.target.value)}
            className={inputClasses}
          >
            <option value="">Sin portafolio</option>
            {portafolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Email habilitado */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={form.email_habilitado}
            aria-label="Notificación por email"
            onClick={() => handleChange('email_habilitado', !form.email_habilitado)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              form.email_habilitado ? 'bg-bloomberg-accent' : 'bg-white/10'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                form.email_habilitado ? 'translate-x-5' : 'translate-x-0'
              }`}
              aria-hidden="true"
            />
          </button>
          <span className="text-sm text-bloomberg-text-muted">Notificación por email</span>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 text-bloomberg-text-muted
                       hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !form.ticker.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-bloomberg-accent text-white
                       hover:bg-bloomberg-accent/80 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Guardando...' : esEdicion ? 'Guardar' : 'Crear Alerta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

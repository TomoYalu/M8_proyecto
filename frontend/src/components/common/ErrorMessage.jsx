/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Componentes Comunes
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
/**
 * Mensaje de error amigable sin stack trace.
 * @param {object} props
 * @param {string} [props.mensaje='Ocurrió un error inesperado.'] - Texto del error
 * @param {function} [props.onReintentar] - Callback para botón de reintentar
 */
export default function ErrorMessage({
  mensaje = 'Ocurrió un error inesperado. Por favor, intente de nuevo.',
  onReintentar,
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 p-6 rounded-lg
                 bg-bloomberg-red/10 border border-bloomberg-red/20 text-center"
      role="alert"
      aria-live="assertive"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8 text-bloomberg-red"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      <p className="text-sm text-bloomberg-red">{mensaje}</p>

      {onReintentar && (
        <button
          onClick={onReintentar}
          className="btn-accent text-sm mt-1"
          aria-label="Reintentar operación"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

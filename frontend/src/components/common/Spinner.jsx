/**
 * Spinner de carga con mensaje descriptivo en español.
 * @param {object} props
 * @param {string} [props.mensaje='Cargando datos...'] - Texto descriptivo
 * @param {string} [props.size='md'] - Tamaño: 'sm' | 'md' | 'lg'
 */
export default function Spinner({ mensaje = 'Cargando datos...', size = 'md' }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-8"
      role="status"
      aria-live="polite"
      aria-label={mensaje}
    >
      <div
        className={`${sizes[size] || sizes.md} rounded-full
                    border-bloomberg-accent border-t-transparent animate-spin`}
        aria-hidden="true"
      />
      <p className="text-sm text-bloomberg-text-muted">{mensaje}</p>
    </div>
  );
}

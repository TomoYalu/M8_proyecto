/**
 * Badge con contador de alertas no leídas.
 * Muestra un círculo rojo con el número si count > 0.
 *
 * @param {object} props
 * @param {number} props.count - Número de alertas no leídas
 *
 * Requisitos cubiertos: 8.3, 12.7
 */
export default function AlertBadge({ count = 0 }) {
  if (count <= 0) return null;

  const texto = count > 99 ? '99+' : String(count);

  return (
    <span
      className="absolute -top-1 -right-1 flex items-center justify-center
                 min-w-[18px] h-[18px] px-1 rounded-full
                 bg-bloomberg-red text-white text-[10px] font-bold leading-none"
      role="status"
      aria-label={`${count} alertas no leídas`}
    >
      {texto}
    </span>
  );
}

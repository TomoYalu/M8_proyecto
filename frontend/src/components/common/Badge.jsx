/**
 * Badge de estado con colores semánticos.
 * @param {object} props
 * @param {string} props.texto - Texto del badge
 * @param {'verde'|'amarillo'|'rojo'|'azul'} [props.variante='azul'] - Color
 * @param {string} [props.ariaLabel] - Etiqueta accesible opcional
 */
export default function Badge({ texto, variante = 'azul', ariaLabel }) {
  const variantes = {
    verde:    'bg-bloomberg-green/15 text-bloomberg-green border-bloomberg-green/30',
    amarillo: 'bg-bloomberg-yellow/15 text-bloomberg-yellow border-bloomberg-yellow/30',
    rojo:     'bg-bloomberg-red/15 text-bloomberg-red border-bloomberg-red/30',
    azul:     'bg-bloomberg-accent/15 text-bloomberg-accent border-bloomberg-accent/30',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
                  font-medium border ${variantes[variante] || variantes.azul}`}
      role="status"
      aria-label={ariaLabel || texto}
    >
      {texto}
    </span>
  );
}

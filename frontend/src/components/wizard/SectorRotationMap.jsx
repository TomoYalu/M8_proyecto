import Badge from '../common/Badge';

/**
 * Visualización de sectores favorecidos por fase del ciclo económico.
 * Grid de tarjetas con nombre, justificación y ETF badges.
 *
 * @param {object} props
 * @param {Array} props.sectores - Lista de { nombre, justificacion, etfs }
 * @param {string} props.fase - Fase del ciclo actual
 *
 * Valida: Requisito 7.2
 */

const SECTOR_COLORS = {
  Financiero: 'border-bloomberg-accent/40',
  'Consumo Discrecional': 'border-bloomberg-green/40',
  Tecnología: 'border-purple-500/40',
  Materiales: 'border-amber-500/40',
  Energía: 'border-orange-500/40',
  Industriales: 'border-cyan-500/40',
  Salud: 'border-pink-500/40',
  'Consumo Básico': 'border-emerald-500/40',
  Utilities: 'border-teal-500/40',
  Bonos: 'border-bloomberg-yellow/40',
};

const SECTOR_BG = {
  Financiero: 'bg-bloomberg-accent/5',
  'Consumo Discrecional': 'bg-bloomberg-green/5',
  Tecnología: 'bg-purple-500/5',
  Materiales: 'bg-amber-500/5',
  Energía: 'bg-orange-500/5',
  Industriales: 'bg-cyan-500/5',
  Salud: 'bg-pink-500/5',
  'Consumo Básico': 'bg-emerald-500/5',
  Utilities: 'bg-teal-500/5',
  Bonos: 'bg-bloomberg-yellow/5',
};

export default function SectorRotationMap({ sectores, fase }) {
  if (!sectores || sectores.length === 0) return null;

  return (
    <div
      className="space-y-4"
      role="region"
      aria-label={`Sectores favorecidos para la fase ${fase}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sectores.map((sector) => {
          const borderColor = SECTOR_COLORS[sector.nombre] || 'border-white/10';
          const bgColor = SECTOR_BG[sector.nombre] || 'bg-white/5';

          return (
            <div
              key={sector.nombre}
              className={`rounded-xl border ${borderColor} ${bgColor} p-5 space-y-3
                         hover:border-opacity-60 transition-colors`}
              role="article"
              aria-label={`Sector: ${sector.nombre}`}
            >
              {/* Nombre del sector */}
              <h4 className="text-bloomberg-text font-semibold text-base">
                {sector.nombre}
              </h4>

              {/* Justificación */}
              <p className="text-sm text-bloomberg-text-muted leading-relaxed">
                {sector.justificacion}
              </p>

              {/* ETFs representativos */}
              {sector.etfs && sector.etfs.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {sector.etfs.map((etf) => (
                    <Badge key={etf} texto={etf} variante="azul" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

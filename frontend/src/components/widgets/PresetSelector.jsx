/**
 * PresetSelector — Selector de presets de layout para el dashboard.
 *
 * Muestra un grupo de botones para seleccionar entre los 3 presets:
 * "Análisis Rápido", "Análisis Completo", "Solo Portafolio".
 *
 * Requisitos cubiertos: 5.5
 */

import useStore from '../../store/index';

const PRESETS = [
  {
    id: 'rapido',
    nombre: 'Análisis Rápido',
    descripcion: 'Precio + RSI + MACD',
    icono: '⚡',
  },
  {
    id: 'completo',
    nombre: 'Análisis Completo',
    descripcion: 'Todos los widgets',
    icono: '📊',
  },
  {
    id: 'portafolio',
    nombre: 'Solo Portafolio',
    descripcion: 'Posiciones + P&L + Semáforo',
    icono: '💼',
  },
];

export default function PresetSelector() {
  const presetActivo = useStore((s) => s.presetActivo);
  const aplicarPreset = useStore((s) => s.aplicarPreset);

  const handleSeleccionar = async (presetId) => {
    try {
      await aplicarPreset(presetId);
    } catch {
      // El error se maneja en el store / UI slice
    }
  };

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Presets de layout"
    >
      {PRESETS.map((preset) => {
        const activo = presetActivo === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => handleSeleccionar(preset.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                        transition-colors border ${
                          activo
                            ? 'bg-bloomberg-accent/15 border-bloomberg-accent text-bloomberg-accent font-medium'
                            : 'bg-bloomberg-panel border-white/10 text-bloomberg-text-muted hover:text-bloomberg-text hover:border-white/20'
                        }`}
            aria-pressed={activo}
            aria-label={`Preset: ${preset.nombre} — ${preset.descripcion}`}
            title={preset.descripcion}
          >
            <span aria-hidden="true">{preset.icono}</span>
            <span>{preset.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

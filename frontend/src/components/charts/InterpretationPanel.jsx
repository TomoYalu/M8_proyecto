import { useState } from 'react';

/**
 * Panel de interpretaciones textuales de indicadores técnicos.
 */

const INDICATOR_DETAILS = {
  rsi: 'Mide la fuerza relativa del precio. > 70 = sobrecompra, < 30 = sobreventa.',
  macd: 'Mide el impulso. Cruce alcista = señal de compra, cruce bajista = señal de venta.',
  estocastico: 'Compara el cierre con el rango. > 80 = sobrecompra, < 20 = sobreventa.',
  sma: 'SMA 50 vs SMA 200. Golden Cross = alcista, Death Cross = bajista.',
  bollinger: 'Bandas de volatilidad. Precio cerca de banda superior = posible sobrecompra.',
  divergencia: 'Precio y MACD en direcciones opuestas = posible cambio de tendencia.',
  sar: 'Puntos que siguen la tendencia. Cuando cambian de lado, posible reversión.',
};

const INDICATOR_NAMES = {
  rsi: 'RSI',
  macd: 'MACD',
  estocastico: 'Estocástico',
  sma: 'Medias Móviles',
  bollinger: 'Bollinger',
  divergencia: 'Divergencia MACD',
  sar: 'SAR Parabólico',
};

function getTipo(texto) {
  const t = texto.toLowerCase();
  if (t.includes('alcista') || t.includes('sobreventa') || t.includes('oportunidad de compra')) return 'alcista';
  if (t.includes('bajista') || t.includes('sobrecompra') || t.includes('reducir posición') || t.includes('reversión')) return 'bajista';
  return 'neutral';
}

// Colores con alto contraste sobre fondo oscuro
const TIPO_STYLES = {
  alcista: {
    border: 'border-l-4 border-l-green-400 border-y border-r border-y-white/5 border-r-white/5',
    bg: 'bg-bloomberg-bg',
    dot: 'bg-green-400',
    name: 'text-white',
    label: 'Compra',
    labelBg: 'bg-green-500/30 text-green-300 border border-green-500/40',
    text: 'text-slate-200',
  },
  bajista: {
    border: 'border-l-4 border-l-red-400 border-y border-r border-y-white/5 border-r-white/5',
    bg: 'bg-bloomberg-bg',
    dot: 'bg-red-400',
    name: 'text-white',
    label: 'Venta',
    labelBg: 'bg-red-500/30 text-red-300 border border-red-500/40',
    text: 'text-slate-200',
  },
  neutral: {
    border: 'border-l-4 border-l-yellow-400 border-y border-r border-y-white/5 border-r-white/5',
    bg: 'bg-bloomberg-bg',
    dot: 'bg-yellow-400',
    name: 'text-white',
    label: 'Neutral',
    labelBg: 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40',
    text: 'text-slate-200',
  },
};

function InterpretationCard({ indicatorKey, texto }) {
  const [expanded, setExpanded] = useState(false);
  const tipo = getTipo(texto);
  const s = TIPO_STYLES[tipo] || TIPO_STYLES.neutral;
  const nombre = INDICATOR_NAMES[indicatorKey] || indicatorKey.toUpperCase();
  const detalle = INDICATOR_DETAILS[indicatorKey];

  return (
    <div className={`rounded-lg ${s.border} ${s.bg} px-4 py-3`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.dot}`} />
        <span className={`text-lg font-bold ${s.name}`}>{nombre}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.labelBg}`}>
          {s.label}
        </span>
        {detalle && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className={`ml-auto w-5 h-5 rounded-full border text-xs font-bold flex items-center justify-center
                       transition-colors ${expanded ? 'border-blue-400 text-blue-400 bg-blue-400/10' : 'border-white/30 text-white/50 hover:border-blue-400 hover:text-blue-400'}`}
            aria-label={`Más info sobre ${nombre}`}
          >
            ?
          </button>
        )}
      </div>
      <p className={`text-base leading-relaxed ${s.text}`}>{texto}</p>
      {expanded && detalle && (
        <p className="text-sm text-blue-300/80 mt-2 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/5 leading-relaxed">
          {detalle}
        </p>
      )}
    </div>
  );
}

export default function InterpretationPanel({ datos }) {
  if (!datos?.interpretaciones) return null;
  const entries = Object.entries(datos.interpretaciones);
  if (entries.length === 0) return null;

  return (
    <div className="p-5 rounded-xl bg-bloomberg-panel border border-white/5" role="region" aria-label="Interpretaciones">
      <h3 className="text-lg font-bold text-white mb-4">Interpretaciones de Indicadores</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {entries.map(([key, texto]) => (
          <InterpretationCard key={key} indicatorKey={key} texto={texto} />
        ))}
      </div>
    </div>
  );
}

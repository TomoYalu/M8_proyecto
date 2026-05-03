/**
 * Listas de palabras positivas y negativas para análisis de sentimiento.
 * Usadas por el News_Engine para keyword scoring.
 * Incluye términos en español e inglés.
 */

export const PALABRAS_POSITIVAS = [
  // Español
  'crecimiento', 'récord', 'supera', 'alza', 'dividendo', 'ganancias',
  'beneficio', 'expansión', 'innovación', 'liderazgo', 'optimismo',
  'recuperación', 'sube', 'máximo', 'positivo', 'mejora', 'avance',
  'impulso', 'fortaleza', 'demanda', 'inversión', 'rentabilidad',
  'oportunidad', 'aprobación', 'acuerdo', 'alianza', 'adquisición',
  'superávit', 'estabilidad', 'confianza', 'recomendación',
  // Inglés
  'growth', 'record', 'beat', 'rally', 'dividend', 'earnings',
  'profit', 'expansion', 'innovation', 'leadership', 'optimism',
  'recovery', 'surge', 'high', 'positive', 'upgrade', 'advance',
  'momentum', 'strength', 'demand', 'investment', 'profitability',
  'opportunity', 'approval', 'deal', 'partnership', 'acquisition',
  'surplus', 'stability', 'confidence', 'outperform',
];

export const PALABRAS_NEGATIVAS = [
  // Español
  'caída', 'pérdida', 'quiebra', 'multa', 'recorte', 'crisis',
  'demanda legal', 'fraude', 'investigación', 'sanción', 'baja',
  'mínimo', 'negativo', 'riesgo', 'deuda', 'déficit', 'inflación',
  'recesión', 'despidos', 'cierre', 'retiro', 'escándalo',
  'incertidumbre', 'volatilidad', 'desplome', 'colapso', 'bancarrota',
  'deterioro', 'contracción', 'advertencia',
  // Inglés
  'decline', 'loss', 'bankruptcy', 'fine', 'cut', 'crisis',
  'lawsuit', 'fraud', 'investigation', 'sanction', 'drop',
  'low', 'negative', 'risk', 'debt', 'deficit', 'inflation',
  'recession', 'layoffs', 'shutdown', 'recall', 'scandal',
  'uncertainty', 'volatility', 'crash', 'collapse', 'default',
  'downgrade', 'contraction', 'warning',
];

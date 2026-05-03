/**
 * Mapa ticker → sector/tema para categorización de noticias y análisis.
 */

export const SECTOR_POR_TICKER = {
  // ─── Tecnología ───────────────────────────────────────────────
  AAPL:  'Tecnología / Hardware',
  MSFT:  'Tecnología / Software',
  GOOGL: 'Tecnología / Publicidad Digital',
  AMZN:  'Tecnología / E-Commerce',
  NVDA:  'Tecnología / IA & Semiconductores',
  META:  'Tecnología / Redes Sociales',
  TSLA:  'Tecnología / Vehículos Eléctricos',
  AMD:   'Tecnología / Semiconductores',
  INTC:  'Tecnología / Semiconductores',
  NFLX:  'Tecnología / Streaming',
  ADBE:  'Tecnología / Software',
  CRM:   'Tecnología / Software Empresarial',
  AVGO:  'Tecnología / Semiconductores',
  CSCO:  'Tecnología / Redes',
  QCOM:  'Tecnología / Semiconductores',
  TXN:   'Tecnología / Semiconductores',
  INTU:  'Tecnología / Software Financiero',
  IBM:   'Tecnología / Servicios TI',

  // ─── Finanzas ─────────────────────────────────────────────────
  JPM:  'Finanzas / Banca',
  GS:   'Finanzas / Banca de Inversión',
  BAC:  'Finanzas / Banca',
  MS:   'Finanzas / Banca de Inversión',
  V:    'Finanzas / Pagos',
  MA:   'Finanzas / Pagos',
  BLK:  'Finanzas / Gestión de Activos',
  AXP:  'Finanzas / Pagos',

  // ─── Salud ────────────────────────────────────────────────────
  JNJ:  'Salud / Farmacéutica',
  PFE:  'Salud / Farmacéutica',
  UNH:  'Salud / Seguros',
  MRK:  'Salud / Farmacéutica',
  ABT:  'Salud / Dispositivos Médicos',
  LLY:  'Salud / Farmacéutica',
  AMGN: 'Salud / Biotecnología',
  ABBV: 'Salud / Farmacéutica',
  TMO:  'Salud / Equipos de Laboratorio',
  ISRG: 'Salud / Robótica Médica',
  GSK:  'Salud / Farmacéutica',
  AZN:  'Salud / Farmacéutica',

  // ─── Energía ──────────────────────────────────────────────────
  XOM:  'Energía / Petróleo & Gas',
  CVX:  'Energía / Petróleo & Gas',
  COP:  'Energía / Petróleo & Gas',
  NEE:  'Energía / Renovables',
  SHEL: 'Energía / Petróleo & Gas',
  BP:   'Energía / Petróleo & Gas',

  // ─── Consumo ──────────────────────────────────────────────────
  WMT:  'Consumo / Retail',
  KO:   'Consumo / Bebidas',
  PEP:  'Consumo / Bebidas',
  PG:   'Consumo / Productos del Hogar',
  COST: 'Consumo / Retail',
  HD:   'Consumo / Mejoras del Hogar',
  DIS:  'Consumo / Entretenimiento',
  MCD:  'Consumo / Restaurantes',

  // ─── Industrial ───────────────────────────────────────────────
  CAT:  'Industrial / Maquinaria',
  BA:   'Industrial / Aeroespacial',
  TRV:  'Finanzas / Seguros',

  // ─── México (BMV) ─────────────────────────────────────────────
  'AMXL.MX':        'Telecomunicaciones / México',
  'WALMEX.MX':      'Consumo / Retail México',
  'FEMSAUBD.MX':    'Consumo / Bebidas México',
  'GFNORTEO.MX':    'Finanzas / Banca México',
  'TLEVISACPO.MX':  'Medios / Televisión México',
  'CEMEXCPO.MX':    'Industrial / Cemento México',
  'BIMBOA.MX':      'Consumo / Alimentos México',
  'GMEXICOB.MX':    'Minería / México',

  // ─── ETFs ─────────────────────────────────────────────────────
  SPY:  'ETF / S&P 500',
  QQQ:  'ETF / NASDAQ 100',
  IWM:  'ETF / Russell 2000',
  GLD:  'ETF / Oro',
  SLV:  'ETF / Plata',
  TLT:  'ETF / Bonos Largo Plazo',
  VTI:  'ETF / Mercado Total EE.UU.',
  VEA:  'ETF / Mercados Desarrollados',
  VWO:  'ETF / Mercados Emergentes',
  BND:  'ETF / Bonos Agregados',
  LQD:  'ETF / Bonos Corporativos',
  HYG:  'ETF / Bonos Alto Rendimiento',
  USO:  'ETF / Petróleo',
  UNG:  'ETF / Gas Natural',
  EWU:  'ETF / Reino Unido',
  EWG:  'ETF / Alemania',
  EWJ:  'ETF / Japón',

  // ─── Minería / Commodities ────────────────────────────────────
  RIO:  'Minería / Diversificada',
  COPX: 'ETF / Cobre',
  WEAT: 'ETF / Trigo',
  DBA:  'ETF / Agricultura',
};

/**
 * Obtiene el sector de un ticker. Retorna 'Sin clasificar' si no existe.
 * @param {string} ticker
 * @returns {string}
 */
export function obtenerSector(ticker) {
  return SECTOR_POR_TICKER[ticker] || 'Sin clasificar';
}

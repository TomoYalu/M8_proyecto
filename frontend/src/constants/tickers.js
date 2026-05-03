/**
 * Tickers populares por categoría.
 * Migrado y ampliado desde analizador_v1.
 */

export const TICKERS_POR_CATEGORIA = {
  'Tecnología': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX'],
  'Finanzas': ['JPM', 'GS', 'BAC', 'MS', 'V', 'MA', 'BLK'],
  'Salud': ['JNJ', 'PFE', 'UNH', 'MRK', 'ABT', 'LLY', 'AMGN'],
  'Energía': ['XOM', 'CVX', 'COP', 'NEE'],
  'Consumo': ['WMT', 'KO', 'PEP', 'PG', 'COST', 'HD', 'DIS'],
  'ETFs': ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'VTI', 'VEA', 'VWO', 'BND', 'LQD', 'HYG'],
  'México (BMV)': ['AMXL.MX', 'WALMEX.MX', 'FEMSAUBD.MX', 'GFNORTEO.MX', 'TLEVISACPO.MX', 'CEMEXCPO.MX', 'BIMBOA.MX', 'GMEXICOB.MX'],
};

/**
 * Tickers por índice bursátil con enlaces de referencia.
 * Migrado desde analizador_v1.
 */
export const INDICES = {
  'S&P 500': {
    url: 'https://www.investing.com/indices/us-spx-500',
    tickers: [
      'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'JPM', 'V',
      'UNH', 'XOM', 'JNJ', 'MA', 'PG', 'HD', 'COST', 'MRK', 'ABBV', 'CVX',
      'KO', 'PEP', 'LLY', 'AVGO', 'WMT', 'BAC', 'PFE', 'TMO', 'CSCO', 'ACN',
    ],
  },
  'NASDAQ 100': {
    url: 'https://www.investing.com/indices/nq-100',
    tickers: [
      'AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'TSLA', 'AVGO', 'COST', 'NFLX',
      'AMD', 'ADBE', 'PEP', 'CSCO', 'INTC', 'QCOM', 'TXN', 'AMGN', 'INTU', 'ISRG',
    ],
  },
  'Dow Jones': {
    url: 'https://www.investing.com/indices/us-30',
    tickers: [
      'AAPL', 'MSFT', 'UNH', 'GS', 'HD', 'AMGN', 'V', 'MCD', 'CAT', 'CRM',
      'JPM', 'BA', 'IBM', 'AXP', 'TRV', 'JNJ', 'WMT', 'PG', 'MRK', 'DIS',
    ],
  },
  'Russell 2000 (ETF IWM)': {
    url: 'https://www.investing.com/indices/smallcap-2000',
    tickers: ['IWM'],
  },
  'FTSE 100 (ETF EWU)': {
    url: 'https://www.investing.com/indices/uk-100',
    tickers: ['EWU', 'SHEL', 'AZN', 'HSBC', 'BP', 'RIO', 'GSK', 'UL'],
  },
  'DAX (ETF EWG)': {
    url: 'https://www.investing.com/indices/germany-30',
    tickers: ['EWG', 'SAP', 'SIE.DE', 'ALV.DE', 'DTE.DE'],
  },
  'Nikkei 225 (ETF EWJ)': {
    url: 'https://www.investing.com/indices/japan-ni225',
    tickers: ['EWJ', 'TM', 'SONY', 'NTDOY', 'MUFG'],
  },
  'Commodities': {
    url: 'https://www.investing.com/commodities/',
    tickers: ['GLD', 'SLV', 'USO', 'UNG', 'COPX', 'WEAT', 'DBA'],
  },
  'IPC México': {
    url: 'https://www.investing.com/indices/ipc',
    tickers: ['AMXL.MX', 'WALMEX.MX', 'FEMSAUBD.MX', 'GFNORTEO.MX', 'TLEVISACPO.MX', 'CEMEXCPO.MX', 'BIMBOA.MX', 'GMEXICOB.MX'],
  },
};

/**
 * Mapa de nombres de empresas por ticker.
 * Se usa para mostrar el nombre completo en autocompletado y paneles.
 */
export const NOMBRE_POR_TICKER = {
  // Tecnología
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corp.',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com Inc.',
  NVDA: 'NVIDIA Corp.',
  META: 'Meta Platforms Inc.',
  TSLA: 'Tesla Inc.',
  AMD: 'Advanced Micro Devices',
  INTC: 'Intel Corp.',
  NFLX: 'Netflix Inc.',
  ADBE: 'Adobe Inc.',
  CRM: 'Salesforce Inc.',
  AVGO: 'Broadcom Inc.',
  CSCO: 'Cisco Systems',
  QCOM: 'Qualcomm Inc.',
  TXN: 'Texas Instruments',
  INTU: 'Intuit Inc.',
  IBM: 'IBM Corp.',
  // Finanzas
  JPM: 'JPMorgan Chase & Co.',
  GS: 'Goldman Sachs Group',
  BAC: 'Bank of America Corp.',
  MS: 'Morgan Stanley',
  V: 'Visa Inc.',
  MA: 'Mastercard Inc.',
  BLK: 'BlackRock Inc.',
  AXP: 'American Express Co.',
  // Salud
  JNJ: 'Johnson & Johnson',
  PFE: 'Pfizer Inc.',
  UNH: 'UnitedHealth Group',
  MRK: 'Merck & Co.',
  ABT: 'Abbott Laboratories',
  LLY: 'Eli Lilly & Co.',
  AMGN: 'Amgen Inc.',
  ABBV: 'AbbVie Inc.',
  TMO: 'Thermo Fisher Scientific',
  ISRG: 'Intuitive Surgical',
  GSK: 'GSK plc',
  AZN: 'AstraZeneca plc',
  // Energía
  XOM: 'Exxon Mobil Corp.',
  CVX: 'Chevron Corp.',
  COP: 'ConocoPhillips',
  NEE: 'NextEra Energy',
  SHEL: 'Shell plc',
  BP: 'BP plc',
  // Consumo
  WMT: 'Walmart Inc.',
  KO: 'Coca-Cola Co.',
  PEP: 'PepsiCo Inc.',
  PG: 'Procter & Gamble',
  COST: 'Costco Wholesale',
  HD: 'Home Depot Inc.',
  DIS: 'Walt Disney Co.',
  MCD: "McDonald's Corp.",
  // Industrial
  CAT: 'Caterpillar Inc.',
  BA: 'Boeing Co.',
  TRV: 'Travelers Companies',
  // México (BMV)
  'AMXL.MX': 'América Móvil',
  'WALMEX.MX': 'Walmart de México',
  'FEMSAUBD.MX': 'FEMSA',
  'GFNORTEO.MX': 'Banorte',
  'TLEVISACPO.MX': 'Televisa',
  'CEMEXCPO.MX': 'CEMEX',
  'BIMBOA.MX': 'Grupo Bimbo',
  'GMEXICOB.MX': 'Grupo México',
  // ETFs
  SPY: 'SPDR S&P 500 ETF',
  QQQ: 'Invesco QQQ Trust',
  IWM: 'iShares Russell 2000',
  GLD: 'SPDR Gold Shares',
  SLV: 'iShares Silver Trust',
  TLT: 'iShares 20+ Year Treasury',
  VTI: 'Vanguard Total Stock Market',
  VEA: 'Vanguard FTSE Developed',
  VWO: 'Vanguard FTSE Emerging',
  BND: 'Vanguard Total Bond Market',
  LQD: 'iShares Investment Grade',
  HYG: 'iShares High Yield Corp',
  USO: 'United States Oil Fund',
  UNG: 'United States Natural Gas',
  EWU: 'iShares MSCI United Kingdom',
  EWG: 'iShares MSCI Germany',
  EWJ: 'iShares MSCI Japan',
  // Minería / Commodities
  RIO: 'Rio Tinto plc',
  COPX: 'Global X Copper Miners',
  WEAT: 'Teucrium Wheat Fund',
  DBA: 'Invesco DB Agriculture',
};

/**
 * Obtiene el nombre de empresa de un ticker.
 * @param {string} ticker
 * @returns {string}
 */
export function obtenerNombre(ticker) {
  return NOMBRE_POR_TICKER[ticker] || ticker;
}

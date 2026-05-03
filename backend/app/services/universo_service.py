"""
Servicio para gestionar el universo de tickers.

Responsabilidades:
- Seed inicial desde constantes hardcodeadas
- Enriquecimiento dinámico via yfinance (nombre, tipo, sector, market_cap)
- Consultas filtradas por tipo, sector, región, índice
"""

import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf

from ..extensions import db
from ..models.universo import UniversoTicker

logger = logging.getLogger(__name__)

# ── Mapeo de quoteType de yfinance → tipo interno ────────────────
QUOTE_TYPE_MAP = {
    "EQUITY": "accion",
    "ETF": "etf",
    "MUTUALFUND": "etf",
    "CRYPTOCURRENCY": "crypto",
    "CURRENCY": "commodity",
    "FUTURE": "commodity",
    "INDEX": "etf",
}

# ── Seed data: constantes actuales migradas ──────────────────────
SEED_TICKERS = {
    "S&P 500": [
        "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA",
        "BRK-B", "JPM", "V", "UNH", "XOM", "JNJ", "MA", "PG",
        "HD", "COST", "MRK", "ABBV", "CVX", "KO", "PEP", "LLY",
        "AVGO", "WMT", "BAC", "PFE", "TMO", "CSCO", "ACN",
    ],
    "NASDAQ 100": [
        "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "TSLA",
        "AVGO", "COST", "NFLX", "AMD", "ADBE", "PEP", "CSCO",
        "INTC", "QCOM", "TXN", "AMGN", "INTU", "ISRG",
    ],
    "Dow Jones": [
        "AAPL", "MSFT", "UNH", "GS", "HD", "AMGN", "V", "MCD",
        "CAT", "CRM", "JPM", "BA", "IBM", "AXP", "TRV", "JNJ",
        "WMT", "PG", "MRK", "DIS",
    ],
    "IPC México": [
        "AMXL.MX", "WALMEX.MX", "FEMSAUBD.MX", "GFNORTEO.MX",
        "TLEVISACPO.MX", "CEMEXCPO.MX", "BIMBOA.MX", "GMEXICOB.MX",
    ],
    "FTSE 100 (ETF EWU)": ["EWU", "SHEL", "AZN", "HSBC", "BP", "RIO", "GSK", "UL"],
    "DAX (ETF EWG)": ["EWG", "SAP"],
    "Nikkei 225 (ETF EWJ)": ["EWJ", "TM", "SONY", "NTDOY", "MUFG"],
    "Commodities": ["GLD", "SLV", "USO", "UNG", "COPX", "WEAT", "DBA"],
}

SEED_ETFS = [
    "SPY", "QQQ", "IWM", "GLD", "SLV", "TLT", "VTI", "VEA", "VWO",
    "BND", "LQD", "HYG", "XLK", "XLF", "XLV", "XLE", "XLY", "XLI",
    "XLB", "XLU", "XLRE", "XLC", "DIA", "USO", "UNG", "EWU", "EWG", "EWJ",
    "COPX", "WEAT", "DBA",
]

SEED_SECTORS = {
    "AAPL": "Tecnología", "MSFT": "Tecnología", "GOOGL": "Tecnología",
    "AMZN": "Consumo", "NVDA": "Tecnología", "META": "Tecnología",
    "TSLA": "Consumo", "AMD": "Tecnología", "INTC": "Tecnología",
    "NFLX": "Tecnología", "ADBE": "Tecnología", "CRM": "Tecnología",
    "AVGO": "Tecnología", "CSCO": "Tecnología", "QCOM": "Tecnología",
    "TXN": "Tecnología", "INTU": "Tecnología", "IBM": "Tecnología",
    "ACN": "Tecnología", "JPM": "Finanzas", "GS": "Finanzas",
    "BAC": "Finanzas", "MS": "Finanzas", "V": "Finanzas",
    "MA": "Finanzas", "BLK": "Finanzas", "AXP": "Finanzas",
    "JNJ": "Salud", "PFE": "Salud", "UNH": "Salud",
    "MRK": "Salud", "ABT": "Salud", "LLY": "Salud",
    "AMGN": "Salud", "ABBV": "Salud", "TMO": "Salud", "ISRG": "Salud",
    "XOM": "Energía", "CVX": "Energía", "COP": "Energía", "NEE": "Energía",
    "WMT": "Consumo", "KO": "Consumo", "PEP": "Consumo",
    "PG": "Consumo", "COST": "Consumo", "HD": "Consumo",
    "DIS": "Consumo", "MCD": "Consumo", "CAT": "Industrial",
    "BA": "Industrial", "TRV": "Finanzas",
    "AMXL.MX": "Telecomunicaciones", "WALMEX.MX": "Consumo",
    "FEMSAUBD.MX": "Consumo", "GFNORTEO.MX": "Finanzas",
    "TLEVISACPO.MX": "Medios", "CEMEXCPO.MX": "Industrial",
    "BIMBOA.MX": "Consumo", "GMEXICOB.MX": "Minería",
    "SHEL": "Energía", "AZN": "Salud", "HSBC": "Finanzas",
    "BP": "Energía", "RIO": "Minería", "GSK": "Salud", "UL": "Consumo",
    "SAP": "Tecnología", "TM": "Consumo", "SONY": "Tecnología",
    "NTDOY": "Tecnología", "MUFG": "Finanzas",
    # ETFs sectoriales
    "SPY": "Índice Amplio", "QQQ": "Tecnología", "IWM": "Small Cap",
    "DIA": "Índice Amplio",
    "XLK": "Tecnología", "XLF": "Finanzas", "XLV": "Salud",
    "XLE": "Energía", "XLY": "Consumo", "XLI": "Industrial",
    "XLB": "Materiales", "XLU": "Utilities", "XLRE": "Real Estate",
    "XLC": "Comunicación",
    # ETFs de renta fija
    "TLT": "Bonos", "BND": "Bonos", "LQD": "Bonos", "HYG": "Bonos",
    "VTI": "Índice Amplio", "VEA": "Internacional", "VWO": "Emergentes",
    # Commodities
    "GLD": "Commodities", "SLV": "Commodities",
    "USO": "Energía", "UNG": "Energía",
    "COPX": "Commodities", "WEAT": "Commodities", "DBA": "Commodities",
    # ETFs regionales
    "EWU": "Internacional", "EWG": "Internacional", "EWJ": "Internacional",
}

SEED_NOMBRES = {
    "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.", "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com Inc.", "NVDA": "NVIDIA Corp.", "META": "Meta Platforms",
    "TSLA": "Tesla Inc.", "JPM": "JPMorgan Chase", "V": "Visa Inc.",
    "UNH": "UnitedHealth Group", "XOM": "Exxon Mobil", "JNJ": "Johnson & Johnson",
    "MA": "Mastercard", "PG": "Procter & Gamble", "HD": "Home Depot",
    "COST": "Costco", "MRK": "Merck & Co.", "ABBV": "AbbVie Inc.",
    "CVX": "Chevron Corp.", "KO": "Coca-Cola", "PEP": "PepsiCo",
    "LLY": "Eli Lilly", "AVGO": "Broadcom Inc.", "WMT": "Walmart",
    "BAC": "Bank of America", "PFE": "Pfizer Inc.", "CSCO": "Cisco Systems",
    "ACN": "Accenture", "NFLX": "Netflix Inc.", "AMD": "AMD Inc.",
    "ADBE": "Adobe Inc.", "INTC": "Intel Corp.", "QCOM": "Qualcomm",
    "TXN": "Texas Instruments", "AMGN": "Amgen Inc.", "INTU": "Intuit Inc.",
    "ISRG": "Intuitive Surgical", "GS": "Goldman Sachs", "MCD": "McDonald's",
    "CAT": "Caterpillar", "CRM": "Salesforce", "BA": "Boeing Co.",
    "IBM": "IBM Corp.", "AXP": "American Express", "TRV": "Travelers",
    "DIS": "Walt Disney", "TMO": "Thermo Fisher", "BRK-B": "Berkshire Hathaway",
    "SPY": "SPDR S&P 500 ETF", "QQQ": "Invesco QQQ Trust",
    "IWM": "iShares Russell 2000", "GLD": "SPDR Gold Shares",
    "SLV": "iShares Silver Trust", "TLT": "iShares 20+ Year Treasury",
    "VTI": "Vanguard Total Stock Market", "VEA": "Vanguard FTSE Developed",
    "VWO": "Vanguard FTSE Emerging", "BND": "Vanguard Total Bond",
    "LQD": "iShares Investment Grade", "HYG": "iShares High Yield",
    "DIA": "SPDR Dow Jones ETF", "XLK": "Technology Select Sector SPDR",
    "XLF": "Financial Select Sector SPDR", "XLV": "Health Care Select Sector SPDR",
    "XLE": "Energy Select Sector SPDR", "XLY": "Consumer Discretionary SPDR",
    "XLI": "Industrial Select Sector SPDR", "XLB": "Materials Select Sector SPDR",
    "XLU": "Utilities Select Sector SPDR", "XLRE": "Real Estate Select Sector SPDR",
    "XLC": "Communication Services SPDR",
}


def _detectar_region(ticker: str) -> str:
    if ticker.endswith(".MX"):
        return "México"
    if ticker.endswith(".DE"):
        return "Europa"
    euro = ["SHEL", "AZN", "HSBC", "BP", "RIO", "GSK", "UL", "SAP", "EWU", "EWG"]
    if ticker in euro:
        return "Europa"
    asia = ["TM", "SONY", "NTDOY", "MUFG", "EWJ"]
    if ticker in asia:
        return "Asia"
    return "EE.UU."


def _detectar_tipo(ticker: str) -> str:
    if ticker in SEED_ETFS:
        return "etf"
    commodities = ["GLD", "SLV", "USO", "UNG", "COPX", "WEAT", "DBA"]
    if ticker in commodities:
        return "commodity"
    return "accion"


class UniversoService:
    """Servicio para gestionar el universo de tickers."""

    @staticmethod
    def seed_inicial():
        """
        Migra las constantes hardcodeadas a la tabla universo_tickers.
        Solo inserta tickers que no existen aún.
        """
        count = 0
        all_tickers = set()

        # Collect all tickers with their indices
        ticker_indices = {}
        for indice, tickers in SEED_TICKERS.items():
            for t in tickers:
                all_tickers.add(t)
                if t not in ticker_indices:
                    ticker_indices[t] = []
                ticker_indices[t].append(indice)

        # Add ETFs
        for t in SEED_ETFS:
            all_tickers.add(t)

        for ticker in all_tickers:
            existing = db.session.get(UniversoTicker, ticker)
            if existing:
                continue

            ut = UniversoTicker(
                ticker=ticker,
                nombre=SEED_NOMBRES.get(ticker, ticker),
                tipo=_detectar_tipo(ticker),
                sector=SEED_SECTORS.get(ticker, "Sin clasificar"),
                region=_detectar_region(ticker),
                indices=ticker_indices.get(ticker, []),
                activo=True,
            )
            db.session.add(ut)
            count += 1

        db.session.commit()
        logger.info("Seed inicial: %d tickers insertados.", count)
        return count

    @staticmethod
    def enriquecer_desde_yfinance(max_tickers: int = 50):
        """
        Enriquece tickers de la BD con datos de yfinance.info.
        Actualiza nombre, tipo, sector, market_cap.
        Procesa en paralelo con ThreadPoolExecutor.
        """
        # Get tickers that haven't been updated or are oldest
        tickers = UniversoTicker.query.filter_by(activo=True).order_by(
            UniversoTicker.ultima_actualizacion.asc().nullsfirst()
        ).limit(max_tickers).all()

        if not tickers:
            return 0

        ticker_symbols = [t.ticker for t in tickers]
        logger.info("Enriqueciendo %d tickers desde yfinance...", len(ticker_symbols))

        def _fetch_info(symbol):
            try:
                info = yf.Ticker(symbol).info
                return symbol, info
            except Exception as e:
                logger.debug("Error obteniendo info de '%s': %s", symbol, e)
                return symbol, None

        results = {}
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(_fetch_info, s): s for s in ticker_symbols}
            for future in as_completed(futures, timeout=60):
                try:
                    symbol, info = future.result(timeout=10)
                    if info:
                        results[symbol] = info
                except Exception:
                    pass

        ahora = datetime.now(timezone.utc)
        updated = 0

        for ut in tickers:
            info = results.get(ut.ticker)
            if not info:
                ut.ultima_actualizacion = ahora
                continue

            # Update nombre
            name = info.get("longName") or info.get("shortName")
            if name:
                ut.nombre = name[:200]

            # Update tipo from quoteType
            qt = info.get("quoteType", "")
            mapped_tipo = QUOTE_TYPE_MAP.get(qt, None)
            if mapped_tipo:
                ut.tipo = mapped_tipo

            # Update sector — use 'sector' for stocks, 'category' for ETFs/funds
            sector_raw = info.get("sector")
            category_raw = info.get("category")

            sector_map = {
                "Technology": "Tecnología",
                "Financial Services": "Finanzas",
                "Healthcare": "Salud",
                "Energy": "Energía",
                "Consumer Cyclical": "Consumo",
                "Consumer Defensive": "Consumo",
                "Industrials": "Industrial",
                "Basic Materials": "Materiales",
                "Communication Services": "Comunicación",
                "Utilities": "Utilities",
                "Real Estate": "Real Estate",
            }

            # Category mapping for ETFs (yfinance category field)
            category_map = {
                "Large Blend": "Índice Amplio",
                "Large Growth": "Crecimiento",
                "Large Value": "Valor",
                "Mid-Cap Blend": "Mid Cap",
                "Small Blend": "Small Cap",
                "Technology": "Tecnología",
                "Financial": "Finanzas",
                "Health": "Salud",
                "Energy": "Energía",
                "Consumer Cyclical": "Consumo",
                "Consumer Defensive": "Consumo",
                "Industrials": "Industrial",
                "Communications": "Comunicación",
                "Utilities": "Utilities",
                "Real Estate": "Real Estate",
                "Commodities Precious Metals": "Commodities",
                "Commodities Broad Basket": "Commodities",
                "Commodities Focused": "Commodities",
                "Commodities Energy": "Energía",
                "Commodities Agriculture": "Commodities",
                "Commodities Industrial Metals": "Commodities",
                "Long-Term Bond": "Bonos",
                "Intermediate-Term Bond": "Bonos",
                "Short-Term Bond": "Bonos",
                "Corporate Bond": "Bonos",
                "High Yield Bond": "Bonos",
                "Inflation-Protected Bond": "Bonos",
                "Long Government": "Bonos",
                "Intermediate Core Bond": "Bonos",
                "Intermediate Core-Plus Bond": "Bonos",
                "Ultrashort Bond": "Bonos",
                "Foreign Large Blend": "Internacional",
                "Diversified Emerging Mkts": "Emergentes",
                "Japan Stock": "Japón",
                "Europe Stock": "Europa",
            }

            if sector_raw and sector_raw not in ("", "N/A"):
                ut.sector = sector_map.get(sector_raw, sector_raw)
            elif category_raw and category_raw not in ("", "N/A"):
                # Try exact match first, then partial match
                mapped = category_map.get(category_raw)
                if not mapped:
                    cat_lower = category_raw.lower()
                    for key, val in category_map.items():
                        if key.lower() in cat_lower:
                            mapped = val
                            break
                    # Extra: catch any "Commodities" or "Bond" in category
                    if not mapped:
                        if "commodit" in cat_lower:
                            mapped = "Commodities"
                        elif "bond" in cat_lower or "government" in cat_lower or "treasury" in cat_lower:
                            mapped = "Bonos"
                        elif "growth" in cat_lower:
                            mapped = "Crecimiento"
                        elif "value" in cat_lower:
                            mapped = "Valor"
                if mapped:
                    ut.sector = mapped
                else:
                    ut.sector = category_raw[:100]

            # Update subsector
            industry = info.get("industry")
            if industry:
                ut.subsector = industry[:100]

            # Update market cap
            mc = info.get("marketCap")
            if mc and isinstance(mc, (int, float)):
                ut.market_cap = int(mc)

            ut.ultima_actualizacion = ahora
            updated += 1

        db.session.commit()
        logger.info("Enriquecidos %d tickers desde yfinance.", updated)
        return updated

    @staticmethod
    def listar(
        tipo: str = None,
        sector: str = None,
        region: str = None,
        indice: str = None,
        solo_activos: bool = True,
    ) -> list[dict]:
        """Lista tickers del universo con filtros opcionales."""
        query = UniversoTicker.query

        if solo_activos:
            query = query.filter_by(activo=True)
        if tipo:
            query = query.filter_by(tipo=tipo)
        if sector:
            query = query.filter_by(sector=sector)
        if region:
            query = query.filter_by(region=region)

        tickers = query.order_by(UniversoTicker.ticker).all()

        # Filter by index (JSON contains)
        if indice:
            tickers = [t for t in tickers if indice in (t.indices or [])]

        return [t.to_dict() for t in tickers]

    @staticmethod
    def obtener_filtros() -> dict:
        """Retorna los valores únicos disponibles para cada filtro."""
        tickers = UniversoTicker.query.filter_by(activo=True).all()

        tipos = set()
        sectores = set()
        regiones = set()
        indices = set()

        for t in tickers:
            tipos.add(t.tipo)
            sectores.add(t.sector)
            regiones.add(t.region)
            for idx in (t.indices or []):
                indices.add(idx)

        return {
            "tipos": sorted(tipos),
            "sectores": sorted(sectores),
            "regiones": sorted(regiones),
            "indices": sorted(indices),
        }

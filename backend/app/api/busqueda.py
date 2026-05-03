"""
Blueprint REST para búsqueda y enriquecimiento de activos.

Endpoints:
    GET /api/busqueda/enriquecer — Enriquece tickers con datos en vivo

Requisitos cubiertos: plan-v1.2 F1

Estrategia de rendimiento:
    - Caché en memoria con TTL configurable (default 5 min)
    - Precios y cambio %: primero caché memoria, luego caché DB, luego yf.download() en batch
    - RSI y SMA200: yf.download() en batch (una sola llamada para todos)
    - P/E: yf.Tickers() en batch
    - Timeout de 15s para evitar bloqueos
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd
import yfinance as yf
from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models.cache import PrecioCache
from ..services.yfinance_service import obtener_precio_cierre_historico

logger = logging.getLogger(__name__)

busqueda_bp = Blueprint("busqueda", __name__, url_prefix="/api/busqueda")

MAX_TICKERS_POR_REQUEST = 50

# ── Caché en memoria con TTL ────────────────────────────────────
# Estructura: {ticker: {"data": {precio, cambio_pct, rsi, pe, sma200}, "timestamp": datetime}}
CACHE_TTL_SECONDS = 300  # 5 minutos
_enrichment_cache = {}


def _get_cached(ticker: str) -> dict | None:
    """Retorna datos cacheados si están frescos (dentro del TTL), None si no."""
    entry = _enrichment_cache.get(ticker)
    if entry is None:
        return None
    elapsed = (datetime.now(timezone.utc) - entry["timestamp"]).total_seconds()
    if elapsed > CACHE_TTL_SECONDS:
        return None
    return entry["data"]


def _set_cache(ticker: str, data: dict) -> None:
    """Almacena datos de enriquecimiento en caché con timestamp actual."""
    _enrichment_cache[ticker] = {
        "data": data,
        "timestamp": datetime.now(timezone.utc),
    }


def _calcular_rsi(close: pd.Series, period: int = 14) -> float | None:
    """Calcula RSI(14) a partir de una serie de precios de cierre."""
    if close is None or len(close) < period + 1:
        return None
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    # Usar EMA después del primer cálculo
    for i in range(period, len(avg_gain)):
        avg_gain.iloc[i] = (avg_gain.iloc[i - 1] * (period - 1) + gain.iloc[i]) / period
        avg_loss.iloc[i] = (avg_loss.iloc[i - 1] * (period - 1) + loss.iloc[i]) / period
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    last = rsi.dropna()
    if last.empty:
        return None
    return round(float(last.iloc[-1]), 2)


def _leer_precios_cache(tickers: list[str]) -> dict:
    """Lee precios de la caché DB para una lista de tickers."""
    resultado = {}
    try:
        caches = db.session.query(PrecioCache).filter(
            PrecioCache.ticker.in_(tickers)
        ).all()
        for c in caches:
            resultado[c.ticker] = {
                "precio": float(c.precio),
                "cambio_pct": float(c.cambio_pct) if c.cambio_pct is not None else None,
            }
    except Exception as e:
        logger.debug("Error leyendo caché batch: %s", e)
    return resultado


def _obtener_pe_batch(tickers: list[str]) -> dict:
    """
    Obtiene P/E para múltiples tickers en paralelo usando ThreadPoolExecutor.
    Limita a 8 workers para no saturar yfinance.
    """
    resultado = {}

    def _get_pe(ticker):
        try:
            info = yf.Ticker(ticker).info
            pe = info.get("trailingPE") or info.get("forwardPE")
            if pe is not None and not (isinstance(pe, float) and np.isnan(pe)):
                return ticker, round(float(pe), 2)
        except Exception:
            pass
        return ticker, None

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(_get_pe, t): t for t in tickers}
        for future in as_completed(futures, timeout=20):
            try:
                ticker, pe = future.result(timeout=5)
                resultado[ticker] = pe
            except Exception:
                resultado[futures[future]] = None

    return resultado


@busqueda_bp.route("/precio-historico", methods=["GET"])
def precio_historico():
    """
    Retorna el precio de cierre de un ticker en una fecha dada.

    Query params:
        ticker (str): Símbolo bursátil.
        fecha (str): Fecha en formato YYYY-MM-DD.

    Returns:
        200: { ticker, fecha_solicitada, fecha_real, precio_cierre, moneda }
        400: Fecha futura, formato inválido o parámetros faltantes.
        404: Ticker no encontrado.
        503: Yahoo Finance no disponible.
    """
    ticker = request.args.get("ticker", "").strip()
    fecha_str = request.args.get("fecha", "").strip()

    # Validar parámetros requeridos
    if not ticker or not fecha_str:
        return jsonify({"error": "Parámetros 'ticker' y 'fecha' son requeridos."}), 400

    # Validar formato de fecha (YYYY-MM-DD)
    try:
        fecha = date.fromisoformat(fecha_str)
    except (ValueError, TypeError):
        return jsonify({"error": "Formato de fecha inválido. Use YYYY-MM-DD."}), 400

    # Validar fecha no futura
    if fecha > date.today():
        return jsonify({"error": "La fecha no puede ser futura."}), 400

    # Consultar servicio
    try:
        resultado = obtener_precio_cierre_historico(ticker, fecha)
        return jsonify(resultado), 200
    except ValueError as e:
        error_msg = str(e)
        # La función de servicio también valida fecha futura — tratar como 400
        if "futura" in error_msg.lower():
            return jsonify({"error": error_msg}), 400
        # Ticker no encontrado o sin datos → 404
        logger.warning("Ticker no encontrado: %s — %s", ticker, error_msg)
        return jsonify({"error": error_msg}), 404
    except Exception as e:
        logger.error(
            "Error al consultar precio histórico de '%s': %s", ticker, str(e)
        )
        return jsonify({"error": "El servicio de precios no está disponible temporalmente."}), 503


@busqueda_bp.route("/enriquecer", methods=["GET"])
def enriquecer_tickers():
    """
    Enriquece una lista de tickers con datos en vivo.

    Query params:
        tickers: Lista de tickers separados por comas (máx 50).

    Returns:
        JSON array, cada elemento con:
        ticker, precio, cambio_pct, rsi, pe, sma200, mercado, es_delay.
    """
    tickers_param = request.args.get("tickers", "")
    if not tickers_param.strip():
        return jsonify({"error": "Parámetro 'tickers' requerido."}), 400

    tickers = [t.strip().upper() for t in tickers_param.split(",") if t.strip()]

    if len(tickers) > MAX_TICKERS_POR_REQUEST:
        return jsonify({
            "error": f"Máximo {MAX_TICKERS_POR_REQUEST} tickers por request. "
                     f"Se recibieron {len(tickers)}."
        }), 400

    if not tickers:
        return jsonify({"error": "No se proporcionaron tickers válidos."}), 400

    # ── 0. Verificar caché en memoria ────────────────────────────
    datos = {}
    tickers_pendientes = []

    for t in tickers:
        cached = _get_cached(t)
        if cached is not None:
            datos[t] = cached
        else:
            tickers_pendientes.append(t)

    # Si todos los tickers estaban en caché, retornar inmediatamente
    if not tickers_pendientes:
        return jsonify(list(datos.values())), 200

    # ── 1. Inicializar resultados para tickers sin caché ─────────
    for t in tickers_pendientes:
        datos[t] = {
            "ticker": t,
            "precio": None,
            "cambio_pct": None,
            "rsi": None,
            "pe": None,
            "sma200": None,
            "mercado": "BMV" if t.endswith(".MX") else "NYSE",
            "es_delay": t.endswith(".MX"),
        }

    # ── 2. Precios desde caché DB (instantáneo) ─────────────────
    cache_precios = _leer_precios_cache(tickers_pendientes)
    for t, vals in cache_precios.items():
        datos[t]["precio"] = vals["precio"]
        datos[t]["cambio_pct"] = vals["cambio_pct"]

    # ── 3. Tickers sin precio en caché → batch download ─────────
    sin_precio = [t for t in tickers_pendientes if datos[t]["precio"] is None]
    if sin_precio:
        try:
            # yf.download en batch es mucho más rápido que llamadas individuales
            df_batch = yf.download(
                sin_precio,
                period="5d",
                interval="1d",
                auto_adjust=True,
                progress=False,
                threads=True,
            )
            if not df_batch.empty:
                # Si es un solo ticker, yf.download retorna columnas simples
                if len(sin_precio) == 1:
                    t = sin_precio[0]
                    close = df_batch["Close"].dropna()
                    if not close.empty:
                        precio = float(close.iloc[-1])
                        datos[t]["precio"] = round(precio, 2)
                        if len(close) >= 2:
                            prev = float(close.iloc[-2])
                            if prev > 0:
                                datos[t]["cambio_pct"] = round(((precio - prev) / prev) * 100, 2)
                else:
                    close_df = df_batch["Close"] if "Close" in df_batch.columns.get_level_values(0) else None
                    if close_df is not None:
                        for t in sin_precio:
                            if t in close_df.columns:
                                col = close_df[t].dropna()
                                if not col.empty:
                                    precio = float(col.iloc[-1])
                                    datos[t]["precio"] = round(precio, 2)
                                    if len(col) >= 2:
                                        prev = float(col.iloc[-2])
                                        if prev > 0:
                                            datos[t]["cambio_pct"] = round(((precio - prev) / prev) * 100, 2)
        except Exception as e:
            logger.warning("Error en batch download de precios: %s", e)

    # ── 4. RSI y SMA200 via batch download (1 llamada) ──────────
    try:
        df_hist = yf.download(
            tickers_pendientes,
            period="1y",
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        if not df_hist.empty:
            if len(tickers_pendientes) == 1:
                t = tickers_pendientes[0]
                close = df_hist["Close"].dropna()
                if len(close) >= 30:
                    datos[t]["rsi"] = _calcular_rsi(close)
                if len(close) >= 200:
                    datos[t]["sma200"] = round(float(close.rolling(200).mean().iloc[-1]), 2)
            else:
                close_df = df_hist["Close"] if "Close" in df_hist.columns.get_level_values(0) else None
                if close_df is not None:
                    for t in tickers_pendientes:
                        if t in close_df.columns:
                            col = close_df[t].dropna()
                            if len(col) >= 30:
                                datos[t]["rsi"] = _calcular_rsi(col)
                            if len(col) >= 200:
                                datos[t]["sma200"] = round(float(col.rolling(200).mean().iloc[-1]), 2)
    except Exception as e:
        logger.warning("Error en batch download de históricos: %s", e)

    # ── 5. P/E en paralelo ──────────────────────────────────────
    try:
        pe_map = _obtener_pe_batch(tickers_pendientes)
        for t, pe in pe_map.items():
            datos[t]["pe"] = pe
    except Exception as e:
        logger.warning("Error obteniendo P/E batch: %s", e)

    # ── 6. Guardar en caché en memoria ─────────────────────────
    for t in tickers_pendientes:
        _set_cache(t, datos[t])

    return jsonify(list(datos.values())), 200


# ── Heatmap cache ────────────────────────────────────────────────
_heatmap_cache = {}
HEATMAP_CACHE_TTL = 600  # 10 minutes


@busqueda_bp.route("/heatmap", methods=["GET"])
def heatmap_rendimiento():
    """
    Calcula rendimiento promedio por sector para diferentes períodos.

    Query params:
        tipo: 'sector' (default) or 'indice'

    Returns:
        JSON with sectors/indices as rows and periods as columns.
    """
    tipo = request.args.get("tipo", "sector").lower()

    # ── Definir ETFs representativos ─────────────────────────────
    etfs_sector = {
        "Tecnología": "XLK",
        "Finanzas": "XLF",
        "Salud": "XLV",
        "Energía": "XLE",
        "Consumo": "XLY",
        "Industrial": "XLI",
        "Materiales": "XLB",
        "Utilities": "XLU",
        "Real Estate": "XLRE",
        "Comunicación": "XLC",
    }

    etfs_indice = {
        "S&P 500": "SPY",
        "NASDAQ": "QQQ",
        "Dow Jones": "DIA",
        "Russell 2000": "IWM",
        "FTSE": "EWU",
        "DAX": "EWG",
        "Nikkei": "EWJ",
    }

    etfs = etfs_sector if tipo == "sector" else etfs_indice
    nombres = list(etfs.keys())
    simbolos = list(etfs.values())
    columnas = ["1D", "1W", "1M", "3M", "1Y"]

    # ── Verificar caché ──────────────────────────────────────────
    cache_entry = _heatmap_cache.get(tipo)
    if cache_entry is not None:
        elapsed = (datetime.now(timezone.utc) - cache_entry["timestamp"]).total_seconds()
        if elapsed < HEATMAP_CACHE_TTL:
            return jsonify(cache_entry["data"]), 200

    # ── Descargar datos en batch ─────────────────────────────────
    try:
        df = yf.download(
            simbolos,
            period="1y",
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as e:
        logger.warning("Error descargando datos para heatmap: %s", e)
        empty = {"filas": nombres, "columnas": columnas, "datos": [[0] * len(columnas)] * len(nombres)}
        return jsonify(empty), 200

    if df.empty:
        empty = {"filas": nombres, "columnas": columnas, "datos": [[0] * len(columnas)] * len(nombres)}
        return jsonify(empty), 200

    # ── Calcular rendimientos ────────────────────────────────────
    periodos_dias = {"1D": 1, "1W": 5, "1M": 21, "3M": 63, "1Y": 252}
    datos = []

    for nombre, simbolo in zip(nombres, simbolos):
        fila = []
        try:
            if len(simbolos) == 1:
                close = df["Close"].dropna()
            else:
                close = df["Close"][simbolo].dropna() if simbolo in df["Close"].columns else pd.Series(dtype=float)
        except Exception:
            close = pd.Series(dtype=float)

        for periodo_label, dias in periodos_dias.items():
            try:
                if len(close) > dias and float(close.iloc[-dias - 1]) > 0:
                    ret = ((float(close.iloc[-1]) / float(close.iloc[-dias - 1])) - 1) * 100
                    fila.append(round(ret, 2))
                else:
                    fila.append(0)
            except Exception:
                fila.append(0)
        datos.append(fila)

    resultado = {"filas": nombres, "columnas": columnas, "datos": datos}

    # ── Guardar en caché ─────────────────────────────────────────
    _heatmap_cache[tipo] = {
        "data": resultado,
        "timestamp": datetime.now(timezone.utc),
    }

    return jsonify(resultado), 200


# ── Treemap cache ────────────────────────────────────────────────
_treemap_cache = {}
TREEMAP_CACHE_TTL = 600  # 10 minutes

# Tickers por índice (subset manejable)
TICKERS_POR_INDICE = {
    "S&P 500": [
        "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA",
        "JPM", "V", "UNH", "XOM", "JNJ", "MA", "PG", "HD",
        "COST", "MRK", "ABBV", "CVX", "KO", "PEP", "LLY",
        "AVGO", "WMT", "BAC", "PFE", "CSCO", "ACN",
    ],
    "NASDAQ 100": [
        "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "TSLA",
        "AVGO", "COST", "NFLX", "AMD", "ADBE", "PEP", "CSCO",
        "INTC", "QCOM", "TXN", "AMGN", "INTU", "ISRG",
    ],
    "Dow Jones": [
        "AAPL", "MSFT", "UNH", "GS", "HD", "AMGN", "V", "MCD",
        "CAT", "CRM", "JPM", "BA", "IBM", "AXP", "JNJ",
        "WMT", "PG", "MRK", "DIS",
    ],
}

# Sector por ticker (simplificado)
SECTOR_TICKER = {
    "AAPL": "Tecnología", "MSFT": "Tecnología", "AMZN": "Consumo",
    "NVDA": "Tecnología", "GOOGL": "Tecnología", "META": "Tecnología",
    "TSLA": "Consumo", "JPM": "Finanzas", "V": "Finanzas",
    "UNH": "Salud", "XOM": "Energía", "JNJ": "Salud",
    "MA": "Finanzas", "PG": "Consumo", "HD": "Consumo",
    "COST": "Consumo", "MRK": "Salud", "ABBV": "Salud",
    "CVX": "Energía", "KO": "Consumo", "PEP": "Consumo",
    "LLY": "Salud", "AVGO": "Tecnología", "WMT": "Consumo",
    "BAC": "Finanzas", "PFE": "Salud", "CSCO": "Tecnología",
    "ACN": "Tecnología", "NFLX": "Tecnología", "AMD": "Tecnología",
    "ADBE": "Tecnología", "INTC": "Tecnología", "QCOM": "Tecnología",
    "TXN": "Tecnología", "AMGN": "Salud", "INTU": "Tecnología",
    "ISRG": "Salud", "GS": "Finanzas", "MCD": "Consumo",
    "CAT": "Industrial", "CRM": "Tecnología", "BA": "Industrial",
    "IBM": "Tecnología", "AXP": "Finanzas", "DIS": "Consumo",
}


@busqueda_bp.route("/treemap", methods=["GET"])
def treemap_rendimiento():
    """
    Genera datos para un treemap estilo Finviz.

    Query params:
        indice: 'S&P 500' (default), 'NASDAQ 100', 'Dow Jones'
        periodo: '1D' (default), '1W', '1M'

    Returns:
        JSON con tickers, sectores, rendimientos y labels para Plotly treemap.
    """
    indice = request.args.get("indice", "S&P 500")
    periodo = request.args.get("periodo", "1D")

    cache_key = f"{indice}_{periodo}"
    cache_entry = _treemap_cache.get(cache_key)
    if cache_entry is not None:
        elapsed = (datetime.now(timezone.utc) - cache_entry["timestamp"]).total_seconds()
        if elapsed < TREEMAP_CACHE_TTL:
            return jsonify(cache_entry["data"]), 200

    tickers = TICKERS_POR_INDICE.get(indice, TICKERS_POR_INDICE["S&P 500"])
    periodos_dias = {"1D": 1, "1W": 5, "1M": 21}
    dias = periodos_dias.get(periodo, 1)

    # For 1D, try to use enrichment cache first (much faster)
    ticker_data = {}
    tickers_sin_datos = []

    if periodo == "1D":
        for t in tickers:
            cached = _get_cached(t)
            if cached and cached.get("cambio_pct") is not None:
                ticker_data[t] = round(cached["cambio_pct"], 2)
            else:
                tickers_sin_datos.append(t)
    else:
        tickers_sin_datos = list(tickers)

    # Download only tickers we don't have data for
    if tickers_sin_datos:
        try:
            download_period = "5d" if periodo == "1D" else "1mo"
            df = yf.download(
                tickers_sin_datos,
                period=download_period,
                interval="1d",
                auto_adjust=True,
                progress=False,
                threads=True,
            )

            if not df.empty:
                for t in tickers_sin_datos:
                    try:
                        if len(tickers_sin_datos) == 1:
                            close = df["Close"].dropna()
                        else:
                            close = df["Close"][t].dropna() if t in df["Close"].columns else pd.Series(dtype=float)

                        if len(close) > dias and float(close.iloc[-dias - 1]) > 0:
                            ret = ((float(close.iloc[-1]) / float(close.iloc[-dias - 1])) - 1) * 100
                        else:
                            ret = 0.0
                        ticker_data[t] = round(ret, 2)
                    except Exception:
                        ticker_data[t] = 0.0
        except Exception as e:
            logger.warning("Error descargando datos para treemap: %s", e)
            for t in tickers_sin_datos:
                ticker_data[t] = 0.0

    # Ensure all tickers have data
    for t in tickers:
        if t not in ticker_data:
            ticker_data[t] = 0.0

    # Build treemap data — use 'remainder' branchvalues so parents auto-size
    labels = []
    parents = []
    values = []
    colors = []
    text = []

    sectores_vistos = set()
    sector_order = []

    # Collect sectors in order
    for t in tickers:
        sector = SECTOR_TICKER.get(t, "Otro")
        if sector not in sectores_vistos:
            sectores_vistos.add(sector)
            sector_order.append(sector)

    # Add sector nodes (as direct children of root)
    for sector in sector_order:
        sector_tickers = [tk for tk in tickers if SECTOR_TICKER.get(tk, "Otro") == sector]
        sector_rets = [ticker_data.get(tk, 0) for tk in sector_tickers]
        avg_ret = sum(sector_rets) / len(sector_rets) if sector_rets else 0

        labels.append(sector)
        parents.append("")
        values.append(0)  # Will be computed from children with branchvalues='remainder'
        colors.append(round(avg_ret, 2))
        text.append(f"{avg_ret:+.1f}%")

    # Add ticker nodes
    for t in tickers:
        sector = SECTOR_TICKER.get(t, "Otro")
        ret = ticker_data.get(t, 0)
        labels.append(t)
        parents.append(sector)
        values.append(1)
        colors.append(ret)
        text.append(f"{ret:+.1f}%")

    resultado = {
        "labels": labels,
        "parents": parents,
        "values": values,
        "colors": colors,
        "text": text,
        "indice": indice,
        "periodo": periodo,
    }

    _treemap_cache[cache_key] = {
        "data": resultado,
        "timestamp": datetime.now(timezone.utc),
    }

    return jsonify(resultado), 200


# ── Universo de tickers (fuente dinámica desde BD) ───────────────

@busqueda_bp.route("/universo", methods=["GET"])
def listar_universo():
    """
    Lista el universo de tickers desde la BD con filtros opcionales.

    Query params:
        tipo: 'accion', 'etf', 'commodity', etc.
        sector: 'Tecnología', 'Finanzas', etc.
        region: 'EE.UU.', 'México', etc.
        indice: 'S&P 500', 'NASDAQ 100', etc.

    Returns:
        JSON con lista de tickers y filtros disponibles.
    """
    from ..services.universo_service import UniversoService
    from ..models.universo import UniversoTicker

    # Auto-seed if table is empty
    count = UniversoTicker.query.count()
    if count == 0:
        UniversoService.seed_inicial()

    tipo = request.args.get("tipo")
    sector = request.args.get("sector")
    region = request.args.get("region")
    indice = request.args.get("indice")

    tickers = UniversoService.listar(
        tipo=tipo, sector=sector, region=region, indice=indice
    )
    filtros = UniversoService.obtener_filtros()

    return jsonify({
        "tickers": tickers,
        "total": len(tickers),
        "filtros_disponibles": filtros,
    }), 200


@busqueda_bp.route("/universo/seed", methods=["POST"])
def seed_universo():
    """Ejecuta el seed inicial del universo de tickers."""
    from ..services.universo_service import UniversoService
    count = UniversoService.seed_inicial()
    return jsonify({"mensaje": f"Seed completado: {count} tickers insertados."}), 200


@busqueda_bp.route("/universo/enriquecer", methods=["POST"])
def enriquecer_universo():
    """Enriquece tickers del universo con datos de yfinance."""
    from ..services.universo_service import UniversoService
    max_t = request.args.get("max", 30, type=int)
    updated = UniversoService.enriquecer_desde_yfinance(max_tickers=max_t)
    return jsonify({"mensaje": f"Enriquecidos {updated} tickers."}), 200

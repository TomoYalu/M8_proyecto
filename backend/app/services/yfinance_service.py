# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Datos de Mercado
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Wrapper de yfinance con caché en la tabla precios_cache.

Proporciona acceso a precios actuales, precios múltiples y datos históricos
de Yahoo Finance, con fallback al último precio almacenado en caché cuando
yfinance no está disponible.

Detecta tickers de la BMV (sufijo .MX) y marca es_delay=True.

Requisitos cubiertos: 3.2, 3.6, 3.7
"""

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pandas as pd
import yfinance as yf

from ..extensions import db
from ..models.cache import PrecioCache, HistoricoCache

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────


def es_ticker_bmv(ticker: str) -> bool:
    """
    Verifica si un ticker pertenece a la Bolsa Mexicana de Valores.

    Returns:
        True si el ticker termina con '.MX'.
    """
    return ticker.upper().endswith(".MX")


def _detectar_mercado(ticker: str) -> str:
    """Determina el mercado del ticker."""
    if es_ticker_bmv(ticker):
        return "BMV"
    return "NYSE"


def _now_utc() -> datetime:
    """Retorna la fecha/hora UTC actual."""
    return datetime.now(timezone.utc)


def _guardar_cache(
    ticker: str,
    precio: float,
    cambio_pct: float | None,
    mercado: str,
    es_delay: bool,
) -> None:
    """Almacena o actualiza el precio en la tabla precios_cache."""
    cache = db.session.get(PrecioCache, ticker)
    if cache is None:
        cache = PrecioCache(ticker=ticker)
        db.session.add(cache)

    cache.precio = Decimal(str(precio))
    cache.cambio_pct = Decimal(str(cambio_pct)) if cambio_pct is not None else None
    cache.mercado = mercado
    cache.es_delay = es_delay
    cache.ultima_actualizacion = _now_utc()

    db.session.commit()


def _leer_cache(ticker: str) -> dict | None:
    """
    Lee el último precio conocido de la caché.

    Returns:
        dict con datos del precio o None si no hay caché.
    """
    cache = db.session.get(PrecioCache, ticker)
    if cache is None:
        return None

    return {
        "ticker": cache.ticker,
        "precio": float(cache.precio),
        "cambio_pct": float(cache.cambio_pct) if cache.cambio_pct is not None else None,
        "mercado": cache.mercado,
        "es_delay": cache.es_delay,
        "precio_desactualizado": True,
        "ultima_actualizacion": cache.ultima_actualizacion.isoformat()
        if cache.ultima_actualizacion
        else None,
    }


# ── Funciones públicas ───────────────────────────────────────────


def obtener_precio(ticker: str) -> dict:
    """
    Obtiene el precio actual de un ticker usando yfinance.

    Flujo:
        1. Intenta obtener el precio vía yfinance (fast_info / info).
        2. Almacena/actualiza el resultado en precios_cache.
        3. Si yfinance falla, retorna el último precio de caché
           con precio_desactualizado=True.

    Args:
        ticker: Símbolo bursátil (ej. 'AAPL', 'AMXL.MX').

    Returns:
        dict con: ticker, precio, cambio_pct, mercado, es_delay,
                  precio_desactualizado, ultima_actualizacion.

    Raises:
        ValueError: si el ticker no se encuentra ni en yfinance ni en caché.
    """
    mercado = _detectar_mercado(ticker)
    delay = es_ticker_bmv(ticker)

    try:
        ticker_obj = yf.Ticker(ticker)

        # Intentar fast_info primero (más rápido), luego info como fallback
        precio = None
        previous_close = None

        try:
            fast = ticker_obj.fast_info
            precio = getattr(fast, "last_price", None)
            previous_close = getattr(fast, "previous_close", None)
        except Exception:
            logger.debug(
                "fast_info no disponible para '%s', intentando info", ticker
            )

        if precio is None:
            info = ticker_obj.info
            precio = info.get("currentPrice") or info.get("regularMarketPrice")
            if previous_close is None:
                previous_close = info.get("regularMarketPreviousClose")

        if precio is None:
            raise ValueError(f"No se pudo obtener precio para '{ticker}'")

        # Calcular cambio porcentual
        cambio_pct = None
        if previous_close and previous_close > 0:
            cambio_pct = round(((precio - previous_close) / previous_close) * 100, 4)

        # Guardar en caché
        _guardar_cache(ticker, precio, cambio_pct, mercado, delay)

        return {
            "ticker": ticker,
            "precio": precio,
            "cambio_pct": cambio_pct,
            "mercado": mercado,
            "es_delay": delay,
            "precio_desactualizado": False,
            "ultima_actualizacion": _now_utc().isoformat(),
        }

    except Exception as e:
        logger.warning(
            "Error al obtener precio de yfinance para '%s': %s. "
            "Intentando caché.",
            ticker,
            str(e),
        )

        # Fallback a caché
        cached = _leer_cache(ticker)
        if cached is not None:
            logger.info(
                "Usando precio en caché para '%s' (última actualización: %s)",
                ticker,
                cached["ultima_actualizacion"],
            )
            return cached

        raise ValueError(
            f"No se pudo obtener el precio de '{ticker}' y no hay datos en caché."
        )


def obtener_precios_multiples(tickers: list[str]) -> list[dict]:
    """
    Obtiene precios para múltiples tickers.

    Llama a obtener_precio() para cada ticker individualmente.
    Los fallos individuales no interrumpen el procesamiento de los demás.

    Args:
        tickers: Lista de símbolos bursátiles.

    Returns:
        Lista de dicts con resultados. Los tickers que fallan incluyen
        un dict con error y los datos disponibles.
    """
    resultados = []

    for ticker in tickers:
        try:
            resultado = obtener_precio(ticker)
            resultados.append(resultado)
        except Exception as e:
            logger.error(
                "Error al obtener precio de '%s': %s", ticker, str(e)
            )
            resultados.append({
                "ticker": ticker,
                "precio": None,
                "cambio_pct": None,
                "mercado": _detectar_mercado(ticker),
                "es_delay": es_ticker_bmv(ticker),
                "precio_desactualizado": True,
                "ultima_actualizacion": None,
                "error": str(e),
            })

    return resultados


def _historico_cache_valido(cached, intervalo):
    """Verifica si el caché histórico sigue vigente según el intervalo."""
    if cached is None:
        return False
    edad = (_now_utc() - cached.updated_at).total_seconds()
    # Datos diarios: válidos 12 horas. Mensuales: 24 horas. Intradía: 30 min.
    if intervalo in ("1mo", "3mo"):
        return edad < 86400
    if intervalo == "1d":
        return edad < 43200
    return edad < 1800


def _df_to_json(df):
    """Serializa DataFrame OHLCV a JSON almacenable."""
    records = []
    for idx, row in df.iterrows():
        records.append({
            "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
            "Open": float(row["Open"]),
            "High": float(row["High"]),
            "Low": float(row["Low"]),
            "Close": float(row["Close"]),
            "Volume": int(row["Volume"]) if pd.notna(row["Volume"]) else 0,
        })
    return records


def _json_to_df(records):
    """Reconstruye DataFrame desde JSON del caché."""
    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"], utc=True)
    df = df.set_index("date")
    return df


def obtener_datos_historicos(
    ticker: str,
    periodo: str = "1y",
    intervalo: str = "1d",
) -> pd.DataFrame:
    """
    Obtiene datos históricos OHLCV de un ticker.
    Usa caché en DB (historico_cache) para evitar llamadas repetidas a yfinance.

    Args:
        ticker: Símbolo bursátil.
        periodo: Período de datos (ej. '1y', '6mo', '5d').
        intervalo: Intervalo entre velas (ej. '1d', '1h', '5m').

    Returns:
        pd.DataFrame con columnas Open, High, Low, Close, Volume.

    Raises:
        ValueError: si el ticker no existe o tiene menos de 30 velas.
    """
    # 1. Buscar en caché
    cached = None
    try:
        cached = HistoricoCache.query.filter_by(
            ticker=ticker, periodo=periodo, intervalo=intervalo
        ).first()
        if _historico_cache_valido(cached, intervalo):
            logger.debug("Usando caché histórico para %s %s/%s", ticker, periodo, intervalo)
            return _json_to_df(cached.datos)
    except Exception:
        pass  # Sin contexto de DB o tabla no existe aún

    # 2. Descargar de yfinance
    try:
        ticker_obj = yf.Ticker(ticker)
        df = ticker_obj.history(period=periodo, interval=intervalo)
    except Exception as e:
        logger.error(
            "Error al obtener datos históricos de '%s': %s", ticker, str(e)
        )
        # Fallback a caché expirado si existe
        if cached is not None and cached.datos:
            logger.info("Usando caché expirado para %s", ticker)
            return _json_to_df(cached.datos)
        raise ValueError(
            f"No se pudieron obtener datos históricos para '{ticker}'."
        ) from e

    if df is None or df.empty:
        if cached is not None:
            return _json_to_df(cached.datos)
        raise ValueError(
            f"No se encontraron datos para el ticker '{ticker}'."
        )

    if len(df) < 30:
        raise ValueError(
            f"Datos insuficientes para '{ticker}': se obtuvieron {len(df)} velas, "
            f"se requieren al menos 30 para un análisis confiable."
        )

    # 3. Guardar en caché
    try:
        records = _df_to_json(df)
        if cached is None:
            cached = HistoricoCache(ticker=ticker, periodo=periodo, intervalo=intervalo)
            db.session.add(cached)
        cached.datos = records
        cached.num_velas = len(df)
        cached.updated_at = _now_utc()
        db.session.commit()
    except Exception as e:
        logger.warning("Error guardando caché histórico: %s", e)
        try:
            db.session.rollback()
        except Exception:
            pass

    return df


def obtener_precio_cierre_historico(ticker: str, fecha: date) -> dict:
    """
    Obtiene el precio de cierre de un ticker en una fecha específica.

    Descarga un rango de datos alrededor de la fecha objetivo para manejar
    días no hábiles (fines de semana, feriados). Si la fecha exacta no tiene
    datos de mercado, retorna el precio del día hábil anterior más cercano.

    Args:
        ticker: Símbolo bursátil (ej. 'AAPL', 'AMXL.MX').
        fecha: Fecha objetivo (date object, no puede ser futura).

    Returns:
        dict con: ticker, fecha_solicitada, fecha_real, precio_cierre, moneda.

    Raises:
        ValueError: si la fecha es futura, el ticker no existe o no hay datos.
    """
    # Validar que la fecha no sea futura
    if fecha > date.today():
        raise ValueError("La fecha no puede ser futura.")

    # Calcular rango de descarga: 5 días hábiles atrás ≈ 7 días calendario
    start = fecha - timedelta(days=7)
    end = fecha + timedelta(days=1)

    logger.info(
        "Consultando precio histórico de '%s' para fecha %s (rango: %s a %s)",
        ticker,
        fecha.isoformat(),
        start.isoformat(),
        end.isoformat(),
    )

    try:
        df = yf.download(
            ticker,
            start=start.isoformat(),
            end=end.isoformat(),
            auto_adjust=True,
        )
    except Exception as e:
        logger.error(
            "Error al descargar datos de yfinance para '%s': %s",
            ticker,
            str(e),
        )
        raise

    # Si el DataFrame está vacío, el ticker no existe o no tiene datos
    if df is None or df.empty:
        raise ValueError(
            f"No se encontraron datos para el ticker '{ticker}'."
        )

    # Normalizar índice a date para comparación con la fecha objetivo
    df.index = pd.to_datetime(df.index)

    # Filtrar filas con fecha ≤ fecha objetivo y tomar la última
    fecha_dt = pd.Timestamp(fecha)
    df_filtrado = df[df.index <= fecha_dt]

    if df_filtrado.empty:
        raise ValueError(
            f"No se encontraron datos para '{ticker}' en o antes de {fecha.isoformat()}."
        )

    ultima_fila = df_filtrado.iloc[-1]
    fecha_real = df_filtrado.index[-1].date()

    # Extraer precio de cierre — manejar tanto Series como scalar
    precio_cierre = ultima_fila["Close"]
    if hasattr(precio_cierre, "item"):
        precio_cierre = precio_cierre.item()
    precio_cierre = round(float(precio_cierre), 2)

    # Determinar moneda según mercado
    moneda = "MXN" if es_ticker_bmv(ticker) else "USD"

    logger.info(
        "Precio histórico de '%s': fecha_solicitada=%s, fecha_real=%s, "
        "precio_cierre=%.2f, moneda=%s",
        ticker,
        fecha.isoformat(),
        fecha_real.isoformat(),
        precio_cierre,
        moneda,
    )

    return {
        "ticker": ticker,
        "fecha_solicitada": fecha.isoformat(),
        "fecha_real": fecha_real.isoformat(),
        "precio_cierre": precio_cierre,
        "moneda": moneda,
    }

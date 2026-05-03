# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Análisis Técnico
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Blueprint REST para análisis técnico de tickers.

Endpoints:
    GET    /api/analisis                — Análisis técnico completo
    GET    /api/analisis/tickers        — Tickers populares por categoría
    GET    /api/analisis/indices         — Tickers por índice bursátil
    POST   /api/analisis/portafolio     — Optimización Markowitz
    GET    /api/analisis/patrones/<ticker> — Solo patrones chartistas

Todos los mensajes de error en español.

Requisitos cubiertos: 4.1–4.9
"""

import datetime
import logging

import numpy as np
import pandas as pd
import yfinance as yf
from flask import Blueprint, jsonify, request
from scipy.optimize import minimize
from scipy.stats import norm

from ..services import yfinance_service
from ..services.ta_service import TAService

logger = logging.getLogger(__name__)

analisis_bp = Blueprint("analisis", __name__, url_prefix="/api/analisis")


# ── Datos estáticos ──────────────────────────────────────────────

TICKERS_POR_CATEGORIA = {
    "Tecnología": [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
        "META", "TSLA", "AMD", "INTC", "NFLX",
    ],
    "Finanzas": ["JPM", "GS", "BAC", "MS", "V", "MA", "BLK"],
    "Salud": ["JNJ", "PFE", "UNH", "MRK", "ABT", "LLY", "AMGN"],
    "Energía": ["XOM", "CVX", "COP", "NEE"],
    "Consumo": ["WMT", "KO", "PEP", "PG", "COST", "HD", "DIS"],
    "ETFs": [
        "SPY", "QQQ", "IWM", "GLD", "TLT",
        "VTI", "VEA", "VWO", "BND", "LQD", "HYG",
    ],
    "México (BMV)": [
        "AMXL.MX", "WALMEX.MX", "FEMSAUBD.MX", "GFNORTEO.MX",
        "TLEVISACPO.MX", "CEMEXCPO.MX", "BIMBOA.MX", "GMEXICOB.MX",
    ],
}

INDICES = {
    "S&P 500": {
        "url": "https://www.investing.com/indices/us-spx-500",
        "tickers": [
            "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA",
            "BRK-B", "JPM", "V", "UNH", "XOM", "JNJ", "MA", "PG",
            "HD", "COST", "MRK", "ABBV", "CVX", "KO", "PEP", "LLY",
            "AVGO", "WMT", "BAC", "PFE", "TMO", "CSCO", "ACN",
        ],
    },
    "NASDAQ 100": {
        "url": "https://www.investing.com/indices/nq-100",
        "tickers": [
            "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "TSLA",
            "AVGO", "COST", "NFLX", "AMD", "ADBE", "PEP", "CSCO",
            "INTC", "QCOM", "TXN", "AMGN", "INTU", "ISRG",
        ],
    },
    "Dow Jones": {
        "url": "https://www.investing.com/indices/us-30",
        "tickers": [
            "AAPL", "MSFT", "UNH", "GS", "HD", "AMGN", "V", "MCD",
            "CAT", "CRM", "JPM", "BA", "IBM", "AXP", "TRV", "JNJ",
            "WMT", "PG", "MRK", "DIS",
        ],
    },
    "Russell 2000 (ETF IWM)": {
        "url": "https://www.investing.com/indices/smallcap-2000",
        "tickers": ["IWM"],
    },
    "FTSE 100 (ETF EWU)": {
        "url": "https://www.investing.com/indices/uk-100",
        "tickers": ["EWU", "SHEL", "AZN", "HSBC", "BP", "RIO", "GSK", "UL"],
    },
    "DAX (ETF EWG)": {
        "url": "https://www.investing.com/indices/germany-30",
        "tickers": ["EWG", "SAP", "SIE.DE", "ALV.DE", "DTE.DE"],
    },
    "Nikkei 225 (ETF EWJ)": {
        "url": "https://www.investing.com/indices/japan-ni225",
        "tickers": ["EWJ", "TM", "SONY", "NTDOY", "MUFG"],
    },
    "Commodities": {
        "url": "https://www.investing.com/commodities/",
        "tickers": ["GLD", "SLV", "USO", "UNG", "COPX", "WEAT", "DBA"],
    },
    "IPC México": {
        "url": "https://www.investing.com/indices/ipc",
        "tickers": [
            "AMXL.MX", "WALMEX.MX", "FEMSAUBD.MX", "GFNORTEO.MX",
            "TLEVISACPO.MX", "CEMEXCPO.MX", "BIMBOA.MX", "GMEXICOB.MX",
        ],
    },
}


# ── Helpers ──────────────────────────────────────────────────────

def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


def _safe_list(series: pd.Series) -> list:
    """Convierte pandas Series a lista reemplazando NaN por None."""
    return [None if pd.isna(v) else round(float(v), 4) for v in series]


# ── Markowitz helpers ────────────────────────────────────────────

def _portfolio_stats(w, rend_esp, cov, rf, periodos):
    """Calcula rendimiento, riesgo y Sharpe de un portafolio."""
    rp = np.dot(w, rend_esp) * periodos
    sp = np.sqrt(np.dot(w, np.dot(cov * periodos, w)))
    sharpe = (rp - rf) / sp if sp > 0 else 0.0
    return float(rp), float(sp), float(sharpe)


def _risk_contribution(w, cov, periodos):
    """Calcula la contribución al riesgo de cada activo."""
    ca = cov * periodos
    sp = np.sqrt(np.dot(w, np.dot(ca, w)))
    if sp == 0:
        return np.zeros(len(w))
    rc = w * np.dot(ca, w) / sp
    total = rc.sum()
    return rc / total if total > 0 else rc


# ── Endpoints ────────────────────────────────────────────────────

@analisis_bp.route("", methods=["GET"])
def analisis_completo():
    """
    Análisis técnico completo de un ticker.

    Query params:
        ticker (str, requerido): Símbolo bursátil.
        periodo (str, default '1y'): Período de datos.
        intervalo (str, default '1d'): Intervalo entre velas.

    Returns:
        JSON con indicadores, patrones, interpretaciones y datos OHLCV.
    """
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return _error("El parámetro 'ticker' es requerido.", 400)

    periodo = request.args.get("periodo", "1y")
    intervalo = request.args.get("intervalo", "1d")

    # Obtener datos históricos
    try:
        df = yfinance_service.obtener_datos_historicos(ticker, periodo, intervalo)
    except ValueError as e:
        return _error(str(e), 404)

    # Calcular todos los indicadores
    ta = TAService()
    indicadores = ta.calcular_todos(df)

    # Datos OHLCV para gráficos
    fechas = [
        d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)
        for d in df.index
    ]

    resultado = {
        "ticker": ticker,
        "periodo": periodo,
        "intervalo": intervalo,
        "fechas": fechas,
        "ohlcv": {
            "open": _safe_list(df["Open"]),
            "high": _safe_list(df["High"]),
            "low": _safe_list(df["Low"]),
            "close": _safe_list(df["Close"]),
            "volume": [
                int(v) if not pd.isna(v) else 0 for v in df["Volume"]
            ],
        },
        **indicadores,
        "resumen": {
            "precio_actual": round(float(df["Close"].iloc[-1]), 2),
            "cambio_pct": round(
                float(
                    (df["Close"].iloc[-1] / df["Close"].iloc[0] - 1) * 100
                ),
                2,
            ),
            "max_52w": round(float(df["High"].max()), 2),
            "min_52w": round(float(df["Low"].min()), 2),
        },
    }

    # Marcar tickers BMV
    if yfinance_service.es_ticker_bmv(ticker):
        resultado["mercado"] = "BMV"
        resultado["advertencia_delay"] = (
            "Los datos de la BMV tienen un retraso de 15 minutos."
        )
    else:
        resultado["mercado"] = "NYSE"

    return jsonify(resultado), 200


@analisis_bp.route("/tickers", methods=["GET"])
def tickers_populares():
    """Retorna tickers populares organizados por categoría."""
    return jsonify(TICKERS_POR_CATEGORIA), 200


@analisis_bp.route("/indices", methods=["GET"])
def indices_bursatiles():
    """Retorna tickers organizados por índice bursátil."""
    return jsonify(INDICES), 200


@analisis_bp.route("/portafolio", methods=["POST"])
def optimizar_portafolio():
    """
    Optimización de portafolio Markowitz.

    Body JSON:
        tickers (list[str]): Lista de tickers (mín 2, máx 15).
        rf (float): Tasa libre de riesgo anual (ej. 0.04 = 4%).
        inversion (float): Monto de inversión en USD.

    Returns:
        JSON con portafolios óptimos, frontera eficiente y estadísticas.
    """
    data = request.get_json(silent=True) or {}
    tickers = data.get("tickers", [])
    rf_anual = float(data.get("rf", 0.04))
    inversion = float(data.get("inversion", 100000))

    if not isinstance(tickers, list) or len(tickers) < 2:
        return _error(
            "Se necesitan al menos 2 tickers para la optimización.", 400
        )
    if len(tickers) > 15:
        return _error("Máximo 15 tickers permitidos.", 400)

    # Descargar datos mensuales de 5 años
    fin = datetime.date.today()
    inicio = fin - datetime.timedelta(days=5 * 365)
    periodos_anio = 12

    try:
        precios = yf.download(
            tickers,
            start=inicio,
            end=fin,
            interval="1mo",
            auto_adjust=True,
            progress=False,
        )["Close"]
    except Exception as e:
        logger.error("Error descargando datos para portafolio: %s", e)
        return _error(
            "No se pudieron descargar los datos de mercado. "
            "Intente de nuevo más tarde.",
            500,
        )

    if isinstance(precios, pd.Series):
        precios = precios.to_frame(tickers[0])

    # Aplanar MultiIndex si existe
    if isinstance(precios.columns, pd.MultiIndex):
        precios.columns = precios.columns.get_level_values(0)

    precios = precios.dropna(axis=1, how="all").dropna()
    tickers_ok = precios.columns.tolist()

    if len(tickers_ok) < 2:
        return _error(
            "No se encontraron datos suficientes para al menos 2 tickers.",
            404,
        )

    # Rendimientos logarítmicos
    rendimientos = np.log(precios / precios.shift(1)).dropna()
    n = len(tickers_ok)
    rend_esperado = rendimientos.mean().values
    cov_matrix = rendimientos.cov().values
    corr_matrix = rendimientos.corr()

    rend_anual = rendimientos.mean() * periodos_anio
    std_anual = rendimientos.std() * np.sqrt(periodos_anio)

    # Restricciones: máximo 20% por activo
    bmax = 0.20
    if n >= 10:
        bmin = 0.05
    elif n >= 5:
        bmin = 0.05
        bmax = min(0.40, 1.0 / n + 0.15)
    else:
        bmin = 0.05
        bmax = min(0.80, 1.0 / n + 0.30)

    bounds = [(bmin, bmax)] * n
    cons = {"type": "eq", "fun": lambda w: np.sum(w) - 1}
    w0 = np.array([1.0 / n] * n)

    # Portafolio de mínima varianza
    res_min = minimize(
        lambda w: _portfolio_stats(
            w, rend_esperado, cov_matrix, rf_anual, periodos_anio
        )[1],
        w0,
        method="SLSQP",
        bounds=bounds,
        constraints=cons,
    )
    w_min = res_min.x
    rp_min, sp_min, sh_min = _portfolio_stats(
        w_min, rend_esperado, cov_matrix, rf_anual, periodos_anio
    )

    # Portafolio de máximo Sharpe
    res_max = minimize(
        lambda w: -_portfolio_stats(
            w, rend_esperado, cov_matrix, rf_anual, periodos_anio
        )[2],
        w0,
        method="SLSQP",
        bounds=bounds,
        constraints=cons,
    )
    w_max = res_max.x
    rp_max, sp_max, sh_max = _portfolio_stats(
        w_max, rend_esperado, cov_matrix, rf_anual, periodos_anio
    )

    # Contribución al riesgo
    rc_min = _risk_contribution(w_min, cov_matrix, periodos_anio)
    rc_max = _risk_contribution(w_max, cov_matrix, periodos_anio)

    # Sortino ratio
    def _sortino(w):
        pr = rendimientos.values.dot(w)
        ds = pr[pr < 0].std() * np.sqrt(periodos_anio)
        rp_val = pr.mean() * periodos_anio
        return float((rp_val - rf_anual) / ds) if ds > 0 else 0.0

    # Beta vs SPY
    try:
        spy = yf.download(
            "SPY",
            start=inicio,
            end=fin,
            interval="1mo",
            auto_adjust=True,
            progress=False,
        )["Close"]
        spy_r = np.log(spy / spy.shift(1)).dropna()
        common = rendimientos.index.intersection(spy_r.index)
        spy_vals = spy_r.loc[common].values.flatten()
    except Exception:
        spy_vals = None
        common = None

    def _calc_beta(w):
        if spy_vals is None or common is None or len(spy_vals) == 0:
            return 0.0
        pr = rendimientos.loc[common].values.dot(w)
        var_spy = np.var(spy_vals)
        if var_spy == 0:
            return 0.0
        return float(np.cov(pr, spy_vals)[0, 1] / var_spy)

    # VaR 99%
    z99 = norm.ppf(0.99)

    def _calc_var(w):
        rp_val = np.dot(w, rend_esperado)
        sp_val = np.sqrt(np.dot(w, np.dot(cov_matrix, w)))
        var_m = -(rp_val - z99 * sp_val)
        return {
            "diario": round(float(var_m / np.sqrt(21) * 100), 4),
            "mensual": round(float(var_m * 100), 4),
            "anual": round(float(var_m * np.sqrt(12) * 100), 4),
            "diario_usd": round(float(var_m / np.sqrt(21) * inversion), 0),
            "mensual_usd": round(float(var_m * inversion), 0),
            "anual_usd": round(float(var_m * np.sqrt(12) * inversion), 0),
        }

    # Max drawdown
    def _max_dd(w):
        pv = (precios / precios.iloc[0]).values.dot(w)
        cummax = np.maximum.accumulate(pv)
        dd = pv / cummax - 1
        return float(dd.min())

    # Frontera eficiente — 20 portafolios entre mín varianza y máx rendimiento
    target_returns = np.linspace(rp_min, rp_max, 20)
    frontera_r = []
    frontera_s = []
    frontera_sh = []

    for target in target_returns:
        cons_ef = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1},
            {
                "type": "eq",
                "fun": lambda w, t=target: np.dot(w, rend_esperado)
                * periodos_anio
                - t,
            },
        ]
        res_ef = minimize(
            lambda w: _portfolio_stats(
                w, rend_esperado, cov_matrix, rf_anual, periodos_anio
            )[1],
            w0,
            method="SLSQP",
            bounds=bounds,
            constraints=cons_ef,
        )
        if res_ef.success:
            r_ef, s_ef, sh_ef = _portfolio_stats(
                res_ef.x, rend_esperado, cov_matrix, rf_anual, periodos_anio
            )
            frontera_r.append(round(r_ef * 100, 4))
            frontera_s.append(round(s_ef * 100, 4))
            frontera_sh.append(round(sh_ef, 4))

    # Evolución histórica normalizada
    pn = precios / precios.iloc[0]
    hist_min = pn.values.dot(w_min)
    hist_max = pn.values.dot(w_max)
    fechas_hist = [
        d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)
        for d in pn.index
    ]

    ultimo_precio = precios.iloc[-1]

    def _build_portfolio_result(w, rp, sp, sh, rc):
        return {
            "pesos": {
                t: round(float(w[i] * 100), 2)
                for i, t in enumerate(tickers_ok)
            },
            "rendimiento": round(float(rp * 100), 2),
            "riesgo": round(float(sp * 100), 2),
            "sharpe": round(float(sh), 4),
            "sortino": round(float(_sortino(w)), 4),
            "beta": round(float(_calc_beta(w)), 4),
            "max_drawdown": round(float(_max_dd(w) * 100), 2),
            "var": _calc_var(w),
            "risk_contrib": {
                t: round(float(rc[i] * 100), 2)
                for i, t in enumerate(tickers_ok)
            },
            "acciones": {
                t: int(
                    np.floor(w[i] * inversion / float(ultimo_precio.iloc[i]))
                )
                for i, t in enumerate(tickers_ok)
            },
            "monto": {
                t: round(
                    float(
                        np.floor(
                            w[i] * inversion / float(ultimo_precio.iloc[i])
                        )
                        * float(ultimo_precio.iloc[i])
                    ),
                    2,
                )
                for i, t in enumerate(tickers_ok)
            },
        }

    resultado = {
        "tickers": tickers_ok,
        "restricciones": f"{bmin * 100:.0f}%-{bmax * 100:.0f}%",
        "estadisticas": {
            t: {
                "rend_anual": round(float(rend_anual[t] * 100), 4),
                "std_anual": round(float(std_anual[t] * 100), 4),
                "precio": round(float(ultimo_precio.iloc[i]), 2),
            }
            for i, t in enumerate(tickers_ok)
        },
        "correlacion": {
            t: {
                t2: round(float(corr_matrix.loc[t, t2]), 4)
                for t2 in tickers_ok
            }
            for t in tickers_ok
        },
        "min_varianza": _build_portfolio_result(
            w_min, rp_min, sp_min, sh_min, rc_min
        ),
        "max_sharpe": _build_portfolio_result(
            w_max, rp_max, sp_max, sh_max, rc_max
        ),
        "frontera": {
            "rendimiento": frontera_r,
            "riesgo": frontera_s,
            "sharpe": frontera_sh,
        },
        "historico": {
            "fechas": fechas_hist,
            "min_varianza": [round(float(v), 4) for v in hist_min],
            "max_sharpe": [round(float(v), 4) for v in hist_max],
        },
    }

    return jsonify(resultado), 200


@analisis_bp.route("/patrones/<ticker>", methods=["GET"])
def patrones_ticker(ticker: str):
    """
    Retorna solo los patrones chartistas detectados para un ticker.

    Args:
        ticker: Símbolo bursátil en la URL.

    Query params:
        periodo (str, default '1y'): Período de datos.
        intervalo (str, default '1d'): Intervalo entre velas.
    """
    ticker = ticker.strip().upper()
    periodo = request.args.get("periodo", "1y")
    intervalo = request.args.get("intervalo", "1d")

    try:
        df = yfinance_service.obtener_datos_historicos(
            ticker, periodo, intervalo
        )
    except ValueError as e:
        return _error(str(e), 404)

    ta = TAService()
    patrones = ta._detectar_patrones(df)

    return jsonify({
        "ticker": ticker,
        "periodo": periodo,
        "intervalo": intervalo,
        "patrones": patrones,
    }), 200


@analisis_bp.route("/batch-rsi", methods=["POST"])
def batch_rsi():
    """Retorna el último RSI de múltiples tickers en una sola llamada."""
    data = request.get_json(silent=True) or {}
    tickers = data.get("tickers", [])
    if not tickers or not isinstance(tickers, list):
        return _error("Se requiere lista de tickers.", 400)

    ta = TAService()
    resultado = {}
    for ticker in tickers[:20]:
        try:
            df = yfinance_service.obtener_datos_historicos(ticker, "3mo", "1d")
            indicadores = ta.calcular_todos(df)
            rsi_arr = indicadores.get("rsi", [])
            last_rsi = None
            for v in reversed(rsi_arr):
                if v is not None:
                    last_rsi = round(float(v), 2)
                    break
            resultado[ticker] = last_rsi
        except Exception:
            resultado[ticker] = None
    return jsonify(resultado), 200

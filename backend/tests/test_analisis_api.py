# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el blueprint REST de análisis técnico.

Cubre:
    - GET /api/analisis (análisis completo)
    - GET /api/analisis/tickers (tickers populares)
    - GET /api/analisis/indices (índices bursátiles)
    - POST /api/analisis/portafolio (optimización Markowitz)
    - GET /api/analisis/patrones/<ticker> (patrones chartistas)

Requisitos cubiertos: 4.1–4.9
"""

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest


# ── Fixtures ─────────────────────────────────────────────────────

def _make_ohlcv_df(n=60, base_price=150.0):
    """Genera un DataFrame OHLCV sintético con n velas."""
    dates = pd.date_range(end=pd.Timestamp.today(), periods=n, freq="D")
    np.random.seed(42)
    close = base_price + np.cumsum(np.random.randn(n) * 2)
    close = np.maximum(close, 10)  # evitar precios negativos
    df = pd.DataFrame(
        {
            "Open": close - np.random.rand(n) * 1.5,
            "High": close + np.random.rand(n) * 2,
            "Low": close - np.random.rand(n) * 2,
            "Close": close,
            "Volume": np.random.randint(1_000_000, 10_000_000, n),
        },
        index=dates,
    )
    return df


# ── GET /api/analisis/tickers ────────────────────────────────────

class TestTickersEndpoint:
    """Tests para el endpoint de tickers populares."""

    def test_retorna_200(self, client):
        resp = client.get("/api/analisis/tickers")
        assert resp.status_code == 200

    def test_contiene_categorias_esperadas(self, client):
        resp = client.get("/api/analisis/tickers")
        data = resp.get_json()
        categorias_esperadas = [
            "Tecnología", "Finanzas", "Salud", "Energía",
            "Consumo", "ETFs", "México (BMV)",
        ]
        for cat in categorias_esperadas:
            assert cat in data, f"Falta categoría: {cat}"

    def test_tecnologia_contiene_aapl(self, client):
        resp = client.get("/api/analisis/tickers")
        data = resp.get_json()
        assert "AAPL" in data["Tecnología"]

    def test_mexico_contiene_tickers_mx(self, client):
        resp = client.get("/api/analisis/tickers")
        data = resp.get_json()
        for ticker in data["México (BMV)"]:
            assert ticker.endswith(".MX"), f"{ticker} no termina en .MX"


# ── GET /api/analisis/indices ────────────────────────────────────

class TestIndicesEndpoint:
    """Tests para el endpoint de índices bursátiles."""

    def test_retorna_200(self, client):
        resp = client.get("/api/analisis/indices")
        assert resp.status_code == 200

    def test_contiene_indices_esperados(self, client):
        resp = client.get("/api/analisis/indices")
        data = resp.get_json()
        indices_esperados = [
            "S&P 500", "NASDAQ 100", "Dow Jones", "IPC México",
        ]
        for idx in indices_esperados:
            assert idx in data, f"Falta índice: {idx}"

    def test_cada_indice_tiene_url_y_tickers(self, client):
        resp = client.get("/api/analisis/indices")
        data = resp.get_json()
        for nombre, info in data.items():
            assert "url" in info, f"{nombre} no tiene url"
            assert "tickers" in info, f"{nombre} no tiene tickers"
            assert isinstance(info["tickers"], list)
            assert len(info["tickers"]) > 0


# ── GET /api/analisis (análisis completo) ────────────────────────

class TestAnalisisCompletoEndpoint:
    """Tests para el endpoint de análisis técnico completo."""

    def test_sin_ticker_retorna_400(self, client):
        resp = client.get("/api/analisis")
        assert resp.status_code == 400
        data = resp.get_json()
        assert "ticker" in data["error"].lower()

    def test_ticker_vacio_retorna_400(self, client):
        resp = client.get("/api/analisis?ticker=")
        assert resp.status_code == 400

    @patch("app.api.analisis.yfinance_service")
    @patch("app.api.analisis.TAService")
    def test_analisis_exitoso(self, mock_ta_cls, mock_yf, client):
        df = _make_ohlcv_df(60)
        mock_yf.obtener_datos_historicos.return_value = df
        mock_yf.es_ticker_bmv.return_value = False

        mock_ta = MagicMock()
        mock_ta.calcular_todos.return_value = {
            "sma50": [1.0] * 60,
            "sma200": [1.0] * 60,
            "rsi": [50.0] * 60,
            "interpretaciones": {"rsi": "Zona neutral"},
        }
        mock_ta_cls.return_value = mock_ta

        resp = client.get("/api/analisis?ticker=AAPL")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["ticker"] == "AAPL"
        assert "ohlcv" in data
        assert "fechas" in data
        assert data["mercado"] == "NYSE"

    @patch("app.api.analisis.yfinance_service")
    @patch("app.api.analisis.TAService")
    def test_ticker_bmv_incluye_mercado_y_advertencia(
        self, mock_ta_cls, mock_yf, client
    ):
        df = _make_ohlcv_df(60)
        mock_yf.obtener_datos_historicos.return_value = df
        mock_yf.es_ticker_bmv.return_value = True

        mock_ta = MagicMock()
        mock_ta.calcular_todos.return_value = {
            "sma50": [1.0] * 60,
            "interpretaciones": {},
        }
        mock_ta_cls.return_value = mock_ta

        resp = client.get("/api/analisis?ticker=AMXL.MX")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mercado"] == "BMV"
        assert "advertencia_delay" in data
        assert "15 minutos" in data["advertencia_delay"]

    @patch("app.api.analisis.yfinance_service")
    def test_ticker_no_encontrado_retorna_404(self, mock_yf, client):
        mock_yf.obtener_datos_historicos.side_effect = ValueError(
            "No se encontraron datos para el ticker 'XXXYZ'."
        )

        resp = client.get("/api/analisis?ticker=XXXYZ")
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data

    @patch("app.api.analisis.yfinance_service")
    @patch("app.api.analisis.TAService")
    def test_ohlcv_tiene_listas_correctas(self, mock_ta_cls, mock_yf, client):
        df = _make_ohlcv_df(60)
        mock_yf.obtener_datos_historicos.return_value = df
        mock_yf.es_ticker_bmv.return_value = False

        mock_ta = MagicMock()
        mock_ta.calcular_todos.return_value = {"interpretaciones": {}}
        mock_ta_cls.return_value = mock_ta

        resp = client.get("/api/analisis?ticker=MSFT")
        data = resp.get_json()
        ohlcv = data["ohlcv"]
        assert len(ohlcv["open"]) == 60
        assert len(ohlcv["close"]) == 60
        assert len(ohlcv["volume"]) == 60
        assert len(data["fechas"]) == 60


# ── GET /api/analisis/patrones/<ticker> ──────────────────────────

class TestPatronesEndpoint:
    """Tests para el endpoint de patrones chartistas."""

    @patch("app.api.analisis.yfinance_service")
    def test_patrones_exitoso(self, mock_yf, client):
        df = _make_ohlcv_df(60)
        mock_yf.obtener_datos_historicos.return_value = df

        resp = client.get("/api/analisis/patrones/AAPL")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["ticker"] == "AAPL"
        assert "patrones" in data
        assert isinstance(data["patrones"], list)

    @patch("app.api.analisis.yfinance_service")
    def test_patrones_ticker_invalido_retorna_404(self, mock_yf, client):
        mock_yf.obtener_datos_historicos.side_effect = ValueError(
            "No se encontraron datos"
        )

        resp = client.get("/api/analisis/patrones/XXXYZ")
        assert resp.status_code == 404


# ── POST /api/analisis/portafolio (Markowitz) ────────────────────

class TestPortafolioOptimizacion:
    """Tests para el endpoint de optimización Markowitz."""

    def test_menos_de_2_tickers_retorna_400(self, client):
        resp = client.post(
            "/api/analisis/portafolio",
            json={"tickers": ["AAPL"], "rf": 0.04, "inversion": 100000},
        )
        assert resp.status_code == 400
        data = resp.get_json()
        assert "2 tickers" in data["error"]

    def test_mas_de_15_tickers_retorna_400(self, client):
        tickers = [f"T{i}" for i in range(16)]
        resp = client.post(
            "/api/analisis/portafolio",
            json={"tickers": tickers, "rf": 0.04, "inversion": 100000},
        )
        assert resp.status_code == 400
        assert "15" in resp.get_json()["error"]

    def test_sin_body_retorna_400(self, client):
        resp = client.post(
            "/api/analisis/portafolio",
            content_type="application/json",
            data="{}",
        )
        assert resp.status_code == 400

    @patch("app.api.analisis.yf")
    def test_optimizacion_exitosa(self, mock_yf_module, client):
        """Test con datos sintéticos para verificar la estructura de respuesta."""
        n_months = 60
        dates = pd.date_range(start="2019-01-01", periods=n_months, freq="MS")
        np.random.seed(42)

        # Generar precios sintéticos para 3 tickers
        prices = pd.DataFrame(
            {
                "AAPL": 150 + np.cumsum(np.random.randn(n_months) * 3),
                "MSFT": 300 + np.cumsum(np.random.randn(n_months) * 4),
                "GOOGL": 130 + np.cumsum(np.random.randn(n_months) * 3.5),
            },
            index=dates,
        )
        prices = prices.clip(lower=10)  # evitar negativos

        # SPY prices for beta calculation
        spy_close = pd.Series(
            400 + np.cumsum(np.random.randn(n_months) * 5),
            index=dates,
            name="Close",
        ).clip(lower=10)

        # yf.download returns a DataFrame with MultiIndex columns
        # for multiple tickers: ("Close", "AAPL"), ("Close", "MSFT"), etc.
        # For a single ticker (SPY), it returns simple columns.
        def download_side_effect(tickers_arg, **kwargs):
            if tickers_arg == "SPY":
                # Single ticker: simple DataFrame with "Close" column
                return pd.DataFrame({"Close": spy_close})
            # Multiple tickers: MultiIndex columns under "Close"
            multi_cols = pd.MultiIndex.from_tuples(
                [("Close", t) for t in prices.columns],
                names=["Price", "Ticker"],
            )
            result = pd.DataFrame(prices.values, index=dates, columns=multi_cols)
            return result

        mock_yf_module.download.side_effect = download_side_effect

        resp = client.post(
            "/api/analisis/portafolio",
            json={
                "tickers": ["AAPL", "MSFT", "GOOGL"],
                "rf": 0.04,
                "inversion": 100000,
            },
        )
        assert resp.status_code == 200
        data = resp.get_json()

        # Verificar estructura de respuesta
        assert "tickers" in data
        assert "min_varianza" in data
        assert "max_sharpe" in data
        assert "frontera" in data
        assert "historico" in data
        assert "correlacion" in data
        assert "estadisticas" in data

        # Verificar estructura de portafolio óptimo
        for key in ["min_varianza", "max_sharpe"]:
            port = data[key]
            assert "pesos" in port
            assert "rendimiento" in port
            assert "riesgo" in port
            assert "sharpe" in port
            assert "var" in port

        # Verificar que los pesos suman ~100%
        pesos_max = data["max_sharpe"]["pesos"]
        total = sum(pesos_max.values())
        assert abs(total - 100.0) < 1.0, f"Pesos suman {total}, esperado ~100"

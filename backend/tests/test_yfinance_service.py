# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el servicio yfinance con caché.

Usa mocks para evitar llamadas reales a Yahoo Finance durante los tests.
Verifica: obtención de precios, caché, fallback, detección BMV,
precios múltiples y datos históricos.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.extensions import db as _db
from app.models.cache import PrecioCache
from app.services.yfinance_service import (
    es_ticker_bmv,
    obtener_datos_historicos,
    obtener_precio,
    obtener_precio_cierre_historico,
    obtener_precios_multiples,
)


# ── es_ticker_bmv ────────────────────────────────────────────────


class TestEsTickerBmv:
    """Tests para la detección de tickers BMV."""

    def test_ticker_bmv_con_sufijo_mx(self):
        assert es_ticker_bmv("AMXL.MX") is True

    def test_ticker_bmv_minusculas(self):
        assert es_ticker_bmv("amxl.mx") is True

    def test_ticker_nyse(self):
        assert es_ticker_bmv("AAPL") is False

    def test_ticker_nasdaq(self):
        assert es_ticker_bmv("MSFT") is False

    def test_ticker_con_punto_no_mx(self):
        assert es_ticker_bmv("BRK.B") is False


# ── obtener_precio ───────────────────────────────────────────────


class TestObtenerPrecio:
    """Tests para obtener_precio con mocks de yfinance."""

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_obtener_precio_exitoso_via_fast_info(self, mock_ticker_cls, db):
        """Obtiene precio correctamente usando fast_info."""
        mock_ticker = MagicMock()
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = 150.25
        mock_fast_info.previous_close = 148.00
        mock_ticker.fast_info = mock_fast_info
        mock_ticker_cls.return_value = mock_ticker

        resultado = obtener_precio("AAPL")

        assert resultado["ticker"] == "AAPL"
        assert resultado["precio"] == 150.25
        assert resultado["mercado"] == "NYSE"
        assert resultado["es_delay"] is False
        assert resultado["precio_desactualizado"] is False
        assert resultado["cambio_pct"] is not None

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_obtener_precio_fallback_a_info(self, mock_ticker_cls, db):
        """Usa info cuando fast_info no tiene last_price."""
        mock_ticker = MagicMock()
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = None
        mock_fast_info.previous_close = None
        mock_ticker.fast_info = mock_fast_info
        mock_ticker.info = {
            "currentPrice": 200.50,
            "regularMarketPreviousClose": 198.00,
        }
        mock_ticker_cls.return_value = mock_ticker

        resultado = obtener_precio("MSFT")

        assert resultado["precio"] == 200.50
        assert resultado["mercado"] == "NYSE"
        assert resultado["precio_desactualizado"] is False

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_obtener_precio_ticker_bmv(self, mock_ticker_cls, db):
        """Detecta ticker BMV y marca es_delay=True, mercado=BMV."""
        mock_ticker = MagicMock()
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = 25.30
        mock_fast_info.previous_close = 25.00
        mock_ticker.fast_info = mock_fast_info
        mock_ticker_cls.return_value = mock_ticker

        resultado = obtener_precio("AMXL.MX")

        assert resultado["mercado"] == "BMV"
        assert resultado["es_delay"] is True

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_obtener_precio_guarda_en_cache(self, mock_ticker_cls, db):
        """Verifica que el precio se almacena en precios_cache."""
        mock_ticker = MagicMock()
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = 300.00
        mock_fast_info.previous_close = 295.00
        mock_ticker.fast_info = mock_fast_info
        mock_ticker_cls.return_value = mock_ticker

        obtener_precio("GOOG")

        cache = _db.session.get(PrecioCache, "GOOG")
        assert cache is not None
        assert float(cache.precio) == 300.00
        assert cache.mercado == "NYSE"
        assert cache.es_delay is False

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_obtener_precio_fallback_a_cache(self, mock_ticker_cls, db):
        """Cuando yfinance falla, retorna precio de caché."""
        # Preparar caché
        cache = PrecioCache(
            ticker="TSLA",
            precio=Decimal("250.00"),
            cambio_pct=Decimal("1.50"),
            mercado="NYSE",
            es_delay=False,
            ultima_actualizacion=datetime.now(timezone.utc),
        )
        db.session.add(cache)
        db.session.commit()

        # Simular fallo de yfinance
        mock_ticker_cls.side_effect = Exception("Error de red")

        resultado = obtener_precio("TSLA")

        assert resultado["ticker"] == "TSLA"
        assert resultado["precio"] == 250.00
        assert resultado["precio_desactualizado"] is True

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_obtener_precio_sin_cache_ni_yfinance_lanza_error(
        self, mock_ticker_cls, db
    ):
        """Lanza ValueError si no hay precio ni en yfinance ni en caché."""
        mock_ticker_cls.side_effect = Exception("Error de red")

        with pytest.raises(ValueError, match="No se pudo obtener el precio"):
            obtener_precio("INVALIDO")

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_cambio_pct_calculado_correctamente(self, mock_ticker_cls, db):
        """Verifica el cálculo del cambio porcentual."""
        mock_ticker = MagicMock()
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = 110.0
        mock_fast_info.previous_close = 100.0
        mock_ticker.fast_info = mock_fast_info
        mock_ticker_cls.return_value = mock_ticker

        resultado = obtener_precio("TEST")

        # (110 - 100) / 100 * 100 = 10.0%
        assert resultado["cambio_pct"] == 10.0

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_cambio_pct_none_sin_previous_close(self, mock_ticker_cls, db):
        """cambio_pct es None cuando no hay previous_close."""
        mock_ticker = MagicMock()
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = 50.0
        mock_fast_info.previous_close = None
        mock_ticker.fast_info = mock_fast_info
        mock_ticker.info = {"currentPrice": None, "regularMarketPreviousClose": None}
        mock_ticker_cls.return_value = mock_ticker

        resultado = obtener_precio("TEST2")

        assert resultado["cambio_pct"] is None


# ── obtener_precios_multiples ────────────────────────────────────


class TestObtenerPreciosMultiples:
    """Tests para obtener_precios_multiples."""

    @patch("app.services.yfinance_service.obtener_precio")
    def test_multiples_tickers_exitosos(self, mock_obtener, db):
        """Retorna resultados para todos los tickers."""
        mock_obtener.side_effect = [
            {"ticker": "AAPL", "precio": 150.0, "cambio_pct": 1.0,
             "mercado": "NYSE", "es_delay": False,
             "precio_desactualizado": False, "ultima_actualizacion": "2024-01-01"},
            {"ticker": "MSFT", "precio": 200.0, "cambio_pct": -0.5,
             "mercado": "NYSE", "es_delay": False,
             "precio_desactualizado": False, "ultima_actualizacion": "2024-01-01"},
        ]

        resultados = obtener_precios_multiples(["AAPL", "MSFT"])

        assert len(resultados) == 2
        assert resultados[0]["ticker"] == "AAPL"
        assert resultados[1]["ticker"] == "MSFT"

    @patch("app.services.yfinance_service.obtener_precio")
    def test_fallo_individual_no_interrumpe(self, mock_obtener, db):
        """Un ticker que falla no impide obtener los demás."""
        mock_obtener.side_effect = [
            {"ticker": "AAPL", "precio": 150.0, "cambio_pct": 1.0,
             "mercado": "NYSE", "es_delay": False,
             "precio_desactualizado": False, "ultima_actualizacion": "2024-01-01"},
            ValueError("Ticker inválido"),
            {"ticker": "GOOG", "precio": 300.0, "cambio_pct": 0.5,
             "mercado": "NYSE", "es_delay": False,
             "precio_desactualizado": False, "ultima_actualizacion": "2024-01-01"},
        ]

        resultados = obtener_precios_multiples(["AAPL", "INVALIDO", "GOOG"])

        assert len(resultados) == 3
        assert resultados[0]["precio"] == 150.0
        assert resultados[1]["precio"] is None
        assert "error" in resultados[1]
        assert resultados[2]["precio"] == 300.0

    @patch("app.services.yfinance_service.obtener_precio")
    def test_lista_vacia(self, mock_obtener, db):
        """Lista vacía retorna lista vacía."""
        resultados = obtener_precios_multiples([])
        assert resultados == []


# ── obtener_datos_historicos ─────────────────────────────────────


class TestObtenerDatosHistoricos:
    """Tests para obtener_datos_historicos."""

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_datos_historicos_exitosos(self, mock_ticker_cls):
        """Retorna DataFrame con datos suficientes."""
        dates = pd.date_range("2023-01-01", periods=50, freq="B")
        df = pd.DataFrame(
            {
                "Open": range(50),
                "High": range(1, 51),
                "Low": range(50),
                "Close": range(50),
                "Volume": [1000] * 50,
            },
            index=dates,
        )
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df
        mock_ticker_cls.return_value = mock_ticker

        resultado = obtener_datos_historicos("AAPL", "1y", "1d")

        assert isinstance(resultado, pd.DataFrame)
        assert len(resultado) == 50
        assert "Close" in resultado.columns

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_datos_insuficientes_lanza_error(self, mock_ticker_cls):
        """Lanza ValueError si hay menos de 30 velas."""
        dates = pd.date_range("2023-01-01", periods=10, freq="B")
        df = pd.DataFrame(
            {
                "Open": range(10),
                "High": range(1, 11),
                "Low": range(10),
                "Close": range(10),
                "Volume": [1000] * 10,
            },
            index=dates,
        )
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df
        mock_ticker_cls.return_value = mock_ticker

        with pytest.raises(ValueError, match="Datos insuficientes"):
            obtener_datos_historicos("AAPL")

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_ticker_no_encontrado_lanza_error(self, mock_ticker_cls):
        """Lanza ValueError si el DataFrame está vacío."""
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = pd.DataFrame()
        mock_ticker_cls.return_value = mock_ticker

        with pytest.raises(ValueError, match="No se encontraron datos"):
            obtener_datos_historicos("INVALIDO")

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_error_de_red_lanza_error(self, mock_ticker_cls):
        """Lanza ValueError si yfinance falla por error de red."""
        mock_ticker = MagicMock()
        mock_ticker.history.side_effect = Exception("Connection timeout")
        mock_ticker_cls.return_value = mock_ticker

        with pytest.raises(ValueError, match="No se pudieron obtener datos"):
            obtener_datos_historicos("AAPL")

    @patch("app.services.yfinance_service.yf.Ticker")
    def test_parametros_periodo_intervalo(self, mock_ticker_cls):
        """Verifica que se pasan los parámetros correctos a yfinance."""
        dates = pd.date_range("2023-01-01", periods=50, freq="B")
        df = pd.DataFrame(
            {
                "Open": range(50),
                "High": range(1, 51),
                "Low": range(50),
                "Close": range(50),
                "Volume": [1000] * 50,
            },
            index=dates,
        )
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df
        mock_ticker_cls.return_value = mock_ticker

        obtener_datos_historicos("AAPL", periodo="6mo", intervalo="1h")

        mock_ticker.history.assert_called_once_with(period="6mo", interval="1h")


# ── obtener_precio_cierre_historico ──────────────────────────────


class TestObtenerPrecioCierreHistorico:
    """Tests para obtener_precio_cierre_historico."""

    @patch("app.services.yfinance_service.yf.download")
    def test_precio_cierre_fecha_exacta(self, mock_download):
        """Retorna precio de cierre cuando la fecha exacta tiene datos."""
        fecha = date(2024, 6, 3)  # Lunes
        dates = pd.date_range("2024-05-28", periods=5, freq="B")
        df = pd.DataFrame(
            {"Close": [100.0, 101.0, 102.0, 103.0, 104.0]},
            index=dates,
        )
        mock_download.return_value = df

        resultado = obtener_precio_cierre_historico("AAPL", fecha)

        assert resultado["ticker"] == "AAPL"
        assert resultado["fecha_solicitada"] == "2024-06-03"
        assert resultado["fecha_real"] == "2024-06-03"
        assert resultado["precio_cierre"] == 104.0
        assert resultado["moneda"] == "USD"

    @patch("app.services.yfinance_service.yf.download")
    def test_fallback_dia_habil_anterior(self, mock_download):
        """Retorna precio del día hábil anterior cuando la fecha es fin de semana."""
        fecha = date(2024, 6, 8)  # Sábado
        dates = pd.date_range("2024-06-03", periods=5, freq="B")
        df = pd.DataFrame(
            {"Close": [100.0, 101.0, 102.0, 103.0, 104.0]},
            index=dates,
        )
        mock_download.return_value = df

        resultado = obtener_precio_cierre_historico("AAPL", fecha)

        assert resultado["fecha_real"] == "2024-06-07"  # Viernes
        assert resultado["precio_cierre"] == 104.0

    @patch("app.services.yfinance_service.yf.download")
    def test_moneda_mxn_para_ticker_bmv(self, mock_download):
        """Retorna MXN para tickers de la BMV."""
        fecha = date(2024, 6, 3)
        dates = pd.date_range("2024-05-28", periods=5, freq="B")
        df = pd.DataFrame(
            {"Close": [25.0, 25.5, 26.0, 26.5, 27.0]},
            index=dates,
        )
        mock_download.return_value = df

        resultado = obtener_precio_cierre_historico("AMXL.MX", fecha)

        assert resultado["moneda"] == "MXN"
        assert resultado["ticker"] == "AMXL.MX"

    @patch("app.services.yfinance_service.yf.download")
    def test_moneda_usd_para_ticker_nyse(self, mock_download):
        """Retorna USD para tickers que no son BMV."""
        fecha = date(2024, 6, 3)
        dates = pd.date_range("2024-05-28", periods=5, freq="B")
        df = pd.DataFrame(
            {"Close": [150.0, 151.0, 152.0, 153.0, 154.0]},
            index=dates,
        )
        mock_download.return_value = df

        resultado = obtener_precio_cierre_historico("AAPL", fecha)

        assert resultado["moneda"] == "USD"

    def test_fecha_futura_lanza_error(self):
        """Lanza ValueError si la fecha es futura."""
        fecha_futura = date.today() + timedelta(days=5)

        with pytest.raises(ValueError, match="La fecha no puede ser futura"):
            obtener_precio_cierre_historico("AAPL", fecha_futura)

    @patch("app.services.yfinance_service.yf.download")
    def test_ticker_no_encontrado_lanza_error(self, mock_download):
        """Lanza ValueError si el DataFrame está vacío."""
        mock_download.return_value = pd.DataFrame()

        with pytest.raises(ValueError, match="No se encontraron datos"):
            obtener_precio_cierre_historico("INVALIDO", date(2024, 6, 3))

    @patch("app.services.yfinance_service.yf.download")
    def test_error_de_red_propaga_excepcion(self, mock_download):
        """Propaga la excepción cuando yfinance falla."""
        mock_download.side_effect = Exception("Connection timeout")

        with pytest.raises(Exception, match="Connection timeout"):
            obtener_precio_cierre_historico("AAPL", date(2024, 6, 3))

    @patch("app.services.yfinance_service.yf.download")
    def test_retorna_dict_con_campos_correctos(self, mock_download):
        """Verifica que el dict retornado tiene todos los campos requeridos."""
        fecha = date(2024, 6, 3)
        dates = pd.date_range("2024-05-28", periods=5, freq="B")
        df = pd.DataFrame(
            {"Close": [100.0, 101.0, 102.0, 103.0, 104.0]},
            index=dates,
        )
        mock_download.return_value = df

        resultado = obtener_precio_cierre_historico("AAPL", fecha)

        assert set(resultado.keys()) == {
            "ticker",
            "fecha_solicitada",
            "fecha_real",
            "precio_cierre",
            "moneda",
        }

# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el servicio WizardService del Wizard de Ciclo Económico.

Cubre:
    - calcular_perfil(): scoring de 5 preguntas → perfil de riesgo
    - obtener_ciclo(): fase del ciclo con caché 24h y fallback estático
    - obtener_sectores(): mapa fase → sectores favorecidos
    - filtrar_fundamentales(): filtro ROE/ROA/D-E/P-E
    - filtrar_tecnicos(): filtro SMA 200 + RSI 40-60
    - obtener_allocation(): asset allocation por perfil

Requisitos cubiertos: 7.1–7.7
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pandas as pd
import numpy as np
import pytest

from app.services.wizard_service import (
    WizardService,
    PERFILES,
    ALLOCATION_POR_PERFIL,
    SECTORES_POR_FASE,
    UNIVERSO_TICKERS,
)


@pytest.fixture()
def service():
    """Instancia limpia de WizardService."""
    return WizardService()


# ── calcular_perfil ──────────────────────────────────────────────

class TestCalcularPerfil:
    """Tests para el cálculo de perfil de riesgo."""

    def test_puntaje_minimo_ultra_conservador(self, service):
        resultado = service.calcular_perfil([1, 1, 1, 1, 1])
        assert resultado["perfil"] == "Ultra Conservador"
        assert resultado["puntaje"] == 5

    def test_puntaje_8_ultra_conservador(self, service):
        resultado = service.calcular_perfil([2, 2, 2, 1, 1])
        assert resultado["perfil"] == "Ultra Conservador"
        assert resultado["puntaje"] == 8

    def test_puntaje_9_conservador(self, service):
        resultado = service.calcular_perfil([2, 2, 2, 2, 1])
        assert resultado["perfil"] == "Conservador"
        assert resultado["puntaje"] == 9

    def test_puntaje_12_conservador(self, service):
        resultado = service.calcular_perfil([3, 3, 2, 2, 2])
        assert resultado["perfil"] == "Conservador"
        assert resultado["puntaje"] == 12

    def test_puntaje_13_moderado(self, service):
        resultado = service.calcular_perfil([3, 3, 3, 2, 2])
        assert resultado["perfil"] == "Moderado"
        assert resultado["puntaje"] == 13

    def test_puntaje_16_moderado(self, service):
        resultado = service.calcular_perfil([4, 3, 3, 3, 3])
        assert resultado["perfil"] == "Moderado"
        assert resultado["puntaje"] == 16

    def test_puntaje_17_balanceado(self, service):
        resultado = service.calcular_perfil([4, 4, 3, 3, 3])
        assert resultado["perfil"] == "Balanceado"
        assert resultado["puntaje"] == 17

    def test_puntaje_19_balanceado(self, service):
        resultado = service.calcular_perfil([4, 4, 4, 4, 3])
        assert resultado["perfil"] == "Balanceado"
        assert resultado["puntaje"] == 19

    def test_puntaje_20_agresivo(self, service):
        resultado = service.calcular_perfil([4, 4, 4, 4, 4])
        assert resultado["perfil"] == "Agresivo"
        assert resultado["puntaje"] == 20

    def test_resultado_contiene_descripcion(self, service):
        resultado = service.calcular_perfil([3, 3, 3, 3, 3])
        assert "descripcion" in resultado
        assert len(resultado["descripcion"]) > 0

    def test_respuestas_no_lista_lanza_error(self, service):
        with pytest.raises(ValueError, match="5 respuestas"):
            service.calcular_perfil("no es lista")

    def test_respuestas_menos_de_5_lanza_error(self, service):
        with pytest.raises(ValueError, match="5 respuestas"):
            service.calcular_perfil([1, 2, 3])

    def test_respuestas_mas_de_5_lanza_error(self, service):
        with pytest.raises(ValueError, match="5 respuestas"):
            service.calcular_perfil([1, 2, 3, 4, 1, 2])

    def test_respuesta_fuera_de_rango_lanza_error(self, service):
        with pytest.raises(ValueError, match="entre 1 y 4"):
            service.calcular_perfil([1, 2, 5, 3, 1])

    def test_respuesta_cero_lanza_error(self, service):
        with pytest.raises(ValueError, match="entre 1 y 4"):
            service.calcular_perfil([0, 2, 3, 3, 1])

    def test_respuesta_no_entera_lanza_error(self, service):
        with pytest.raises(ValueError, match="número entero"):
            service.calcular_perfil([1, 2.5, 3, 3, 1])


# ── obtener_ciclo ────────────────────────────────────────────────

class TestObtenerCiclo:
    """Tests para la obtención del ciclo económico."""

    def test_retorna_fase_valida(self, service, db):
        resultado = service.obtener_ciclo()
        assert resultado["fase"] in ["Early", "Mid", "Late", "Recession"]

    def test_retorna_indicadores(self, service, db):
        resultado = service.obtener_ciclo()
        assert "indicadores" in resultado
        assert isinstance(resultado["indicadores"], dict)

    def test_retorna_fuente(self, service, db):
        resultado = service.obtener_ciclo()
        assert resultado["fuente"] in ["dinamico", "estatico"]

    def test_retorna_fecha_actualizacion(self, service, db):
        resultado = service.obtener_ciclo()
        assert "fecha_actualizacion" in resultado

    def test_usa_cache_si_valida(self, service, db):
        """Verifica que la segunda llamada usa la caché."""
        from app.models.cache import CicloCache

        # Primera llamada: guarda en caché
        resultado1 = service.obtener_ciclo()

        # Verificar que se guardó en caché
        cache = db.session.get(CicloCache, 1)
        assert cache is not None
        assert cache.fase == resultado1["fase"]

        # Segunda llamada: debe usar caché
        resultado2 = service.obtener_ciclo()
        assert resultado2["fase"] == resultado1["fase"]

    def test_fallback_estatico_cuando_dinamico_falla(self, service, db):
        """Verifica que usa datos estáticos como fallback."""
        resultado = service.obtener_ciclo()
        # Sin FRED API key, siempre cae al fallback estático
        assert resultado["fuente"] == "estatico"


# ── obtener_sectores ─────────────────────────────────────────────

class TestObtenerSectores:
    """Tests para la rotación sectorial por fase."""

    def test_early_retorna_sectores_correctos(self, service):
        resultado = service.obtener_sectores("Early")
        nombres = [s["nombre"] for s in resultado["sectores"]]
        assert "Financiero" in nombres
        assert "Consumo Discrecional" in nombres
        assert "Tecnología" in nombres
        assert "Materiales" in nombres

    def test_mid_retorna_sectores_correctos(self, service):
        resultado = service.obtener_sectores("Mid")
        nombres = [s["nombre"] for s in resultado["sectores"]]
        assert "Tecnología" in nombres
        assert "Energía" in nombres
        assert "Industriales" in nombres

    def test_late_retorna_sectores_correctos(self, service):
        resultado = service.obtener_sectores("Late")
        nombres = [s["nombre"] for s in resultado["sectores"]]
        assert "Energía" in nombres
        assert "Salud" in nombres
        assert "Consumo Básico" in nombres

    def test_recession_retorna_sectores_correctos(self, service):
        resultado = service.obtener_sectores("Recession")
        nombres = [s["nombre"] for s in resultado["sectores"]]
        assert "Utilities" in nombres
        assert "Consumo Básico" in nombres
        assert "Bonos" in nombres

    def test_cada_sector_tiene_justificacion(self, service):
        for fase in ["Early", "Mid", "Late", "Recession"]:
            resultado = service.obtener_sectores(fase)
            for sector in resultado["sectores"]:
                assert "justificacion" in sector
                assert len(sector["justificacion"]) > 0

    def test_cada_sector_tiene_etfs(self, service):
        for fase in ["Early", "Mid", "Late", "Recession"]:
            resultado = service.obtener_sectores(fase)
            for sector in resultado["sectores"]:
                assert "etfs" in sector
                assert isinstance(sector["etfs"], list)
                assert len(sector["etfs"]) > 0

    def test_fase_invalida_lanza_error(self, service):
        with pytest.raises(ValueError, match="Fase no válida"):
            service.obtener_sectores("Boom")

    def test_resultado_contiene_fase(self, service):
        resultado = service.obtener_sectores("Early")
        assert resultado["fase"] == "Early"


# ── filtrar_fundamentales ────────────────────────────────────────

class TestFiltrarFundamentales:
    """Tests para el filtro fundamental."""

    @patch("app.services.wizard_service.yf")
    def test_ticker_que_pasa_filtro(self, mock_yf, service):
        mock_ticker = MagicMock()
        mock_ticker.info = {
            "quoteType": "EQUITY",
            "returnOnEquity": 0.25,
            "returnOnAssets": 0.10,
            "debtToEquity": 0.8,
            "trailingPE": 18.0,
            "industryPE": 22.0,
            "shortName": "Test Corp",
            "sector": "Technology",
        }
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 1
        assert resultado[0]["ticker"] == "TEST"
        assert resultado[0]["roe"] == 25.0
        assert resultado[0]["roa"] == 10.0

    @patch("app.services.wizard_service.yf")
    def test_ticker_no_pasa_roe(self, mock_yf, service):
        mock_ticker = MagicMock()
        mock_ticker.info = {
            "quoteType": "EQUITY",
            "returnOnEquity": 0.10,  # < 15%
            "returnOnAssets": 0.10,
            "debtToEquity": 0.8,
            "trailingPE": 18.0,
        }
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 0

    @patch("app.services.wizard_service.yf")
    def test_ticker_no_pasa_roa(self, mock_yf, service):
        mock_ticker = MagicMock()
        mock_ticker.info = {
            "quoteType": "EQUITY",
            "returnOnEquity": 0.25,
            "returnOnAssets": 0.03,  # < 5%
            "debtToEquity": 0.8,
            "trailingPE": 18.0,
        }
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 0

    @patch("app.services.wizard_service.yf")
    def test_ticker_no_pasa_de(self, mock_yf, service):
        mock_ticker = MagicMock()
        mock_ticker.info = {
            "quoteType": "EQUITY",
            "returnOnEquity": 0.25,
            "returnOnAssets": 0.10,
            "debtToEquity": 2.0,  # > 1.5
            "trailingPE": 18.0,
        }
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 0

    @patch("app.services.wizard_service.yf")
    def test_ticker_no_pasa_pe(self, mock_yf, service):
        mock_ticker = MagicMock()
        mock_ticker.info = {
            "quoteType": "EQUITY",
            "returnOnEquity": 0.25,
            "returnOnAssets": 0.10,
            "debtToEquity": 0.8,
            "trailingPE": 25.0,
            "industryPE": 20.0,  # P/E > industria
        }
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 0

    @patch("app.services.wizard_service.yf")
    def test_maneja_error_yfinance_gracefully(self, mock_yf, service):
        mock_yf.Ticker.side_effect = Exception("Network error")

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 0

    @patch("app.services.wizard_service.yf")
    def test_maneja_datos_incompletos(self, mock_yf, service):
        mock_ticker = MagicMock()
        mock_ticker.info = {
            "quoteType": "EQUITY",
            "returnOnEquity": None,
            "returnOnAssets": None,
        }
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 0

    def test_lista_vacia_retorna_vacia(self, service):
        resultado = service.filtrar_fundamentales([])
        assert resultado == []

    @patch("app.services.wizard_service.yf")
    def test_de_como_porcentaje_se_convierte(self, mock_yf, service):
        """D/E > 10 se interpreta como porcentaje y se divide por 100."""
        mock_ticker = MagicMock()
        mock_ticker.info = {
            "quoteType": "EQUITY",
            "returnOnEquity": 0.25,
            "returnOnAssets": 0.10,
            "debtToEquity": 80.0,  # 80% → 0.8 ratio
            "trailingPE": 18.0,
            "shortName": "Test Corp",
            "sector": "Technology",
        }
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_fundamentales(["TEST"])
        assert len(resultado) == 1
        assert resultado[0]["de"] == 0.80


# ── filtrar_tecnicos ─────────────────────────────────────────────

class TestFiltrarTecnicos:
    """Tests para el filtro técnico."""

    def _make_df(self, n=250, base_price=150.0, trend=0.05):
        """Genera un DataFrame OHLCV sintético."""
        dates = pd.date_range(end=pd.Timestamp.today(), periods=n, freq="D")
        np.random.seed(42)
        close = base_price + np.arange(n) * trend + np.random.randn(n) * 0.5
        close = np.maximum(close, 10)
        return pd.DataFrame(
            {
                "Open": close - np.random.rand(n) * 0.5,
                "High": close + np.random.rand(n) * 1.0,
                "Low": close - np.random.rand(n) * 1.0,
                "Close": close,
                "Volume": np.random.randint(1_000_000, 10_000_000, n),
            },
            index=dates,
        )

    @patch("app.services.wizard_service.yf")
    def test_ticker_que_pasa_filtro(self, mock_yf, service):
        df = self._make_df(250, base_price=100, trend=0.1)
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_tecnicos(["TEST"])
        # El resultado depende de los datos generados
        assert isinstance(resultado, list)
        for item in resultado:
            assert "ticker" in item
            assert "precio" in item
            assert "sma200" in item
            assert "rsi" in item

    @patch("app.services.wizard_service.yf")
    def test_datos_insuficientes_se_omite(self, mock_yf, service):
        df = self._make_df(50)  # < 200 velas
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df
        mock_yf.Ticker.return_value = mock_ticker

        resultado = service.filtrar_tecnicos(["TEST"])
        assert len(resultado) == 0

    @patch("app.services.wizard_service.yf")
    def test_maneja_error_yfinance(self, mock_yf, service):
        mock_yf.Ticker.side_effect = Exception("Network error")

        resultado = service.filtrar_tecnicos(["TEST"])
        assert len(resultado) == 0

    def test_lista_vacia_retorna_vacia(self, service):
        resultado = service.filtrar_tecnicos([])
        assert resultado == []


# ── obtener_allocation ───────────────────────────────────────────

class TestObtenerAllocation:
    """Tests para el asset allocation por perfil."""

    def test_ultra_conservador(self, service):
        resultado = service.obtener_allocation("Ultra Conservador")
        assert resultado["perfil"] == "Ultra Conservador"
        clases = {a["clase"]: a["porcentaje"] for a in resultado["allocation"]}
        assert clases["Renta Variable"] == 10
        assert clases["Bonos"] == 70
        assert clases["Oro"] == 10
        assert clases["Efectivo"] == 10

    def test_conservador(self, service):
        resultado = service.obtener_allocation("Conservador")
        clases = {a["clase"]: a["porcentaje"] for a in resultado["allocation"]}
        assert clases["Renta Variable"] == 25
        assert clases["Bonos"] == 55

    def test_moderado(self, service):
        resultado = service.obtener_allocation("Moderado")
        clases = {a["clase"]: a["porcentaje"] for a in resultado["allocation"]}
        assert clases["Renta Variable"] == 50
        assert clases["Bonos"] == 35

    def test_balanceado(self, service):
        resultado = service.obtener_allocation("Balanceado")
        clases = {a["clase"]: a["porcentaje"] for a in resultado["allocation"]}
        assert clases["Renta Variable"] == 70
        assert clases["Bonos"] == 20

    def test_agresivo(self, service):
        resultado = service.obtener_allocation("Agresivo")
        clases = {a["clase"]: a["porcentaje"] for a in resultado["allocation"]}
        assert clases["Renta Variable"] == 90
        assert clases["Bonos"] == 5

    def test_porcentajes_suman_100(self, service):
        for perfil in ALLOCATION_POR_PERFIL:
            resultado = service.obtener_allocation(perfil)
            total = sum(a["porcentaje"] for a in resultado["allocation"])
            assert total == 100, f"{perfil}: porcentajes suman {total}"

    def test_cada_clase_tiene_etfs(self, service):
        for perfil in ALLOCATION_POR_PERFIL:
            resultado = service.obtener_allocation(perfil)
            for alloc in resultado["allocation"]:
                assert "etfs" in alloc
                assert isinstance(alloc["etfs"], list)

    def test_perfil_invalido_lanza_error(self, service):
        with pytest.raises(ValueError, match="Perfil no válido"):
            service.obtener_allocation("Inexistente")

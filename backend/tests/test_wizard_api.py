# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el blueprint REST del Wizard de Ciclo Económico.

Cubre:
    POST   /api/wizard/perfil
    GET    /api/wizard/ciclo
    GET    /api/wizard/sectores/<fase>
    GET    /api/wizard/fundamentales
    GET    /api/wizard/tecnicos
    GET    /api/wizard/allocation/<perfil>
    GET    /api/wizard/pool

Todos los mensajes de error en español.

Requisitos cubiertos: 7.1–7.7
"""

from unittest.mock import MagicMock, patch

import pytest


# ── POST /api/wizard/perfil ──────────────────────────────────────

class TestPerfilEndpoint:
    """Tests para el endpoint de cálculo de perfil de riesgo."""

    def test_perfil_exitoso(self, client):
        resp = client.post(
            "/api/wizard/perfil",
            json={"respuestas": [3, 2, 3, 2, 4]},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "perfil" in data
        assert "puntaje" in data
        assert "descripcion" in data
        assert data["puntaje"] == 14

    def test_perfil_ultra_conservador(self, client):
        resp = client.post(
            "/api/wizard/perfil",
            json={"respuestas": [1, 1, 1, 1, 1]},
        )
        assert resp.status_code == 200
        assert resp.get_json()["perfil"] == "Ultra Conservador"

    def test_perfil_agresivo(self, client):
        resp = client.post(
            "/api/wizard/perfil",
            json={"respuestas": [4, 4, 4, 4, 4]},
        )
        assert resp.status_code == 200
        assert resp.get_json()["perfil"] == "Agresivo"

    def test_sin_respuestas_retorna_400(self, client):
        resp = client.post("/api/wizard/perfil", json={})
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_respuestas_invalidas_retorna_400(self, client):
        resp = client.post(
            "/api/wizard/perfil",
            json={"respuestas": [1, 2, 5, 3, 1]},
        )
        assert resp.status_code == 400

    def test_respuestas_incompletas_retorna_400(self, client):
        resp = client.post(
            "/api/wizard/perfil",
            json={"respuestas": [1, 2]},
        )
        assert resp.status_code == 400

    def test_sin_body_retorna_400(self, client):
        resp = client.post(
            "/api/wizard/perfil",
            content_type="application/json",
        )
        assert resp.status_code == 400


# ── GET /api/wizard/ciclo ────────────────────────────────────────

class TestCicloEndpoint:
    """Tests para el endpoint de ciclo económico."""

    def test_ciclo_retorna_200(self, client):
        resp = client.get("/api/wizard/ciclo")
        assert resp.status_code == 200

    def test_ciclo_contiene_campos_requeridos(self, client):
        resp = client.get("/api/wizard/ciclo")
        data = resp.get_json()
        assert "fase" in data
        assert "indicadores" in data
        assert "fuente" in data
        assert "fecha_actualizacion" in data

    def test_ciclo_fase_valida(self, client):
        resp = client.get("/api/wizard/ciclo")
        data = resp.get_json()
        assert data["fase"] in ["Early", "Mid", "Late", "Recession"]


# ── GET /api/wizard/sectores/<fase> ──────────────────────────────

class TestSectoresEndpoint:
    """Tests para el endpoint de sectores por fase."""

    def test_early_retorna_200(self, client):
        resp = client.get("/api/wizard/sectores/Early")
        assert resp.status_code == 200

    def test_mid_retorna_200(self, client):
        resp = client.get("/api/wizard/sectores/Mid")
        assert resp.status_code == 200

    def test_late_retorna_200(self, client):
        resp = client.get("/api/wizard/sectores/Late")
        assert resp.status_code == 200

    def test_recession_retorna_200(self, client):
        resp = client.get("/api/wizard/sectores/Recession")
        assert resp.status_code == 200

    def test_sectores_contiene_lista(self, client):
        resp = client.get("/api/wizard/sectores/Early")
        data = resp.get_json()
        assert "sectores" in data
        assert isinstance(data["sectores"], list)
        assert len(data["sectores"]) > 0

    def test_cada_sector_tiene_campos(self, client):
        resp = client.get("/api/wizard/sectores/Mid")
        data = resp.get_json()
        for sector in data["sectores"]:
            assert "nombre" in sector
            assert "justificacion" in sector
            assert "etfs" in sector

    def test_fase_invalida_retorna_400(self, client):
        resp = client.get("/api/wizard/sectores/Boom")
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data
        assert "Fase no válida" in data["error"]


# ── GET /api/wizard/fundamentales ────────────────────────────────

class TestFundamentalesEndpoint:
    """Tests para el endpoint de filtro fundamental."""

    @patch("app.api.wizard._service")
    def test_fundamentales_retorna_200(self, mock_service, client):
        mock_service.filtrar_fundamentales.return_value = [
            {
                "ticker": "AAPL",
                "roe": 25.0,
                "roa": 10.0,
                "de": 0.8,
                "pe": 18.0,
                "nombre": "Apple Inc.",
                "sector": "Technology",
            }
        ]

        resp = client.get("/api/wizard/fundamentales?tickers=AAPL")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "total_evaluados" in data
        assert "total_aprobados" in data
        assert "tickers" in data

    @patch("app.api.wizard._service")
    def test_fundamentales_con_tickers_custom(self, mock_service, client):
        mock_service.filtrar_fundamentales.return_value = []

        resp = client.get("/api/wizard/fundamentales?tickers=AAPL,MSFT,GOOGL")
        assert resp.status_code == 200
        # Verify the service was called with the right tickers
        args = mock_service.filtrar_fundamentales.call_args[0][0]
        assert "AAPL" in args
        assert "MSFT" in args
        assert "GOOGL" in args

    @patch("app.api.wizard._service")
    def test_fundamentales_sin_tickers_usa_universo(self, mock_service, client):
        mock_service.filtrar_fundamentales.return_value = []

        resp = client.get("/api/wizard/fundamentales")
        assert resp.status_code == 200
        args = mock_service.filtrar_fundamentales.call_args[0][0]
        assert len(args) == len(
            __import__(
                "app.services.wizard_service", fromlist=["UNIVERSO_TICKERS"]
            ).UNIVERSO_TICKERS
        )


# ── GET /api/wizard/tecnicos ────────────────────────────────────

class TestTecnicosEndpoint:
    """Tests para el endpoint de filtro técnico."""

    @patch("app.api.wizard._service")
    def test_tecnicos_retorna_200(self, mock_service, client):
        mock_service.filtrar_tecnicos.return_value = [
            {
                "ticker": "AAPL",
                "precio": 180.50,
                "sma200": 170.25,
                "rsi": 52.3,
            }
        ]

        resp = client.get("/api/wizard/tecnicos?tickers=AAPL")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "total_evaluados" in data
        assert "total_aprobados" in data
        assert "tickers" in data

    @patch("app.api.wizard._service")
    def test_tecnicos_con_tickers_custom(self, mock_service, client):
        mock_service.filtrar_tecnicos.return_value = []

        resp = client.get("/api/wizard/tecnicos?tickers=AAPL,MSFT")
        assert resp.status_code == 200
        args = mock_service.filtrar_tecnicos.call_args[0][0]
        assert "AAPL" in args
        assert "MSFT" in args


# ── GET /api/wizard/allocation/<perfil> ──────────────────────────

class TestAllocationEndpoint:
    """Tests para el endpoint de asset allocation."""

    def test_ultra_conservador_retorna_200(self, client):
        resp = client.get("/api/wizard/allocation/Ultra Conservador")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["perfil"] == "Ultra Conservador"
        assert "allocation" in data

    def test_moderado_retorna_200(self, client):
        resp = client.get("/api/wizard/allocation/Moderado")
        assert resp.status_code == 200

    def test_agresivo_retorna_200(self, client):
        resp = client.get("/api/wizard/allocation/Agresivo")
        assert resp.status_code == 200

    def test_allocation_contiene_clases(self, client):
        resp = client.get("/api/wizard/allocation/Moderado")
        data = resp.get_json()
        clases = [a["clase"] for a in data["allocation"]]
        assert "Renta Variable" in clases
        assert "Bonos" in clases
        assert "Oro" in clases

    def test_porcentajes_suman_100(self, client):
        for perfil in [
            "Ultra Conservador", "Conservador", "Moderado",
            "Balanceado", "Agresivo",
        ]:
            resp = client.get(f"/api/wizard/allocation/{perfil}")
            data = resp.get_json()
            total = sum(a["porcentaje"] for a in data["allocation"])
            assert total == 100, f"{perfil}: porcentajes suman {total}"

    def test_perfil_invalido_retorna_400(self, client):
        resp = client.get("/api/wizard/allocation/Inexistente")
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data
        assert "Perfil no válido" in data["error"]


# ── GET /api/wizard/pool ─────────────────────────────────────────

class TestPoolEndpoint:
    """Tests para el endpoint de pool final de tickers."""

    @patch("app.api.wizard._service")
    def test_pool_retorna_200(self, mock_service, client):
        mock_service.obtener_ciclo.return_value = {
            "fase": "Mid",
            "indicadores": {"pmi": 52.1},
            "fuente": "estatico",
            "fecha_actualizacion": "2025-01-15",
        }
        mock_service.obtener_sectores.return_value = {
            "fase": "Mid",
            "sectores": [{"nombre": "Tecnología", "justificacion": "...", "etfs": ["XLK"]}],
        }
        mock_service.filtrar_fundamentales.return_value = [
            {"ticker": "AAPL", "roe": 25.0, "roa": 10.0, "de": 0.8, "pe": 18.0,
             "nombre": "Apple", "sector": "Technology"},
        ]
        mock_service.filtrar_tecnicos.return_value = [
            {"ticker": "AAPL", "precio": 180.0, "sma200": 170.0, "rsi": 52.0},
        ]

        resp = client.get("/api/wizard/pool")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "ciclo" in data
        assert "sectores" in data
        assert "fundamentales" in data
        assert "pool" in data

    @patch("app.api.wizard._service")
    def test_pool_contiene_estructura_completa(self, mock_service, client):
        mock_service.obtener_ciclo.return_value = {
            "fase": "Early",
            "indicadores": {},
            "fuente": "estatico",
            "fecha_actualizacion": "2025-01-15",
        }
        mock_service.obtener_sectores.return_value = {
            "fase": "Early",
            "sectores": [],
        }
        mock_service.filtrar_fundamentales.return_value = []
        mock_service.filtrar_tecnicos.return_value = []

        resp = client.get("/api/wizard/pool")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "total" in data["pool"]
        assert "tickers" in data["pool"]
        assert "total_evaluados" in data["fundamentales"]
        assert "total_aprobados" in data["fundamentales"]

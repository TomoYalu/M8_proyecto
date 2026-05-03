# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el blueprint REST de widgets.

Cubre: GET /api/widgets/config, PUT /api/widgets/config,
       POST /api/widgets/preset/<nombre>
"""

import pytest


class TestGetWidgetConfig:
    """GET /api/widgets/config"""

    def test_retorna_preset_completo_si_no_hay_config(self, client):
        """Sin configuración previa, retorna preset 'completo' con todos los widgets."""
        resp = client.get("/api/widgets/config")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["preset_activo"] == "completo"
        assert len(data["widgets"]) == 10  # 10 widgets definidos
        # Todos visibles en preset completo
        for w in data["widgets"]:
            assert w["visible"] is True

    def test_retorna_config_existente(self, client):
        """Si ya hay configuración, la retorna sin aplicar preset."""
        # Primero crear configuración
        client.get("/api/widgets/config")  # crea preset completo
        # Modificar un widget
        client.put("/api/widgets/config", json={
            "widgets": [{"widget_id": "rsi", "visible": False}]
        })
        # Verificar que retorna la config modificada
        resp = client.get("/api/widgets/config")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["preset_activo"] is None
        rsi = next(w for w in data["widgets"] if w["widget_id"] == "rsi")
        assert rsi["visible"] is False


class TestPutWidgetConfig:
    """PUT /api/widgets/config"""

    def test_guarda_configuracion(self, client):
        """Guarda posición y visibilidad de widgets."""
        resp = client.put("/api/widgets/config", json={
            "widgets": [
                {"widget_id": "candlestick", "x": 0, "y": 0, "w": 12, "h": 8, "visible": True},
                {"widget_id": "macd", "x": 0, "y": 8, "w": 6, "h": 4, "visible": False},
            ]
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert "mensaje" in data

        # Verificar que se guardó
        resp2 = client.get("/api/widgets/config")
        widgets = {w["widget_id"]: w for w in resp2.get_json()["widgets"]}
        assert widgets["candlestick"]["w"] == 12
        assert widgets["candlestick"]["h"] == 8
        assert widgets["macd"]["visible"] is False

    def test_error_sin_widgets(self, client):
        """Retorna 400 si no se envía lista de widgets."""
        resp = client.put("/api/widgets/config", json={})
        assert resp.status_code == 400

    def test_error_widgets_no_lista(self, client):
        """Retorna 400 si widgets no es una lista."""
        resp = client.put("/api/widgets/config", json={"widgets": "invalido"})
        assert resp.status_code == 400


class TestPostPreset:
    """POST /api/widgets/preset/<nombre>"""

    def test_aplicar_preset_rapido(self, client):
        """Preset 'rapido' muestra solo candlestick, rsi y macd."""
        resp = client.post("/api/widgets/preset/rapido")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["preset_activo"] == "rapido"
        visibles = [w["widget_id"] for w in data["widgets"] if w["visible"]]
        assert set(visibles) == {"candlestick", "rsi", "macd"}

    def test_aplicar_preset_completo(self, client):
        """Preset 'completo' muestra todos los widgets."""
        resp = client.post("/api/widgets/preset/completo")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["preset_activo"] == "completo"
        visibles = [w["widget_id"] for w in data["widgets"] if w["visible"]]
        assert len(visibles) == 10

    def test_aplicar_preset_portafolio(self, client):
        """Preset 'portafolio' muestra solo posiciones, pnl y semaforo."""
        resp = client.post("/api/widgets/preset/portafolio")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["preset_activo"] == "portafolio"
        visibles = [w["widget_id"] for w in data["widgets"] if w["visible"]]
        assert set(visibles) == {"posiciones", "pnl", "semaforo"}

    def test_preset_invalido(self, client):
        """Retorna 404 para preset inexistente."""
        resp = client.post("/api/widgets/preset/inexistente")
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data

    def test_preset_reemplaza_config_anterior(self, client):
        """Aplicar un preset reemplaza toda la configuración previa."""
        # Primero aplicar completo
        client.post("/api/widgets/preset/completo")
        # Luego aplicar rapido
        client.post("/api/widgets/preset/rapido")
        # Verificar que solo 3 son visibles
        resp = client.get("/api/widgets/config")
        widgets = resp.get_json()["widgets"]
        visibles = [w for w in widgets if w["visible"]]
        assert len(visibles) == 3

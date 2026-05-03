# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el blueprint REST de portafolios (/api/portafolios).

Cubre todos los endpoints: CRUD portafolios, posiciones, transacciones,
vista consolidada, paginación y manejo de errores HTTP.
"""

import pytest
from datetime import date
from decimal import Decimal


# ── Helpers ──────────────────────────────────────────────────────

def _crear_portafolio(client, nombre="Test", descripcion=None):
    body = {"nombre": nombre}
    if descripcion:
        body["descripcion"] = descripcion
    return client.post("/api/portafolios", json=body)


def _compra(client, pid, ticker="AAPL", precio=150, cantidad=10):
    return client.post(f"/api/portafolios/{pid}/transacciones", json={
        "ticker": ticker,
        "tipo": "compra",
        "fecha": "2024-01-15",
        "precio_unitario": precio,
        "cantidad": cantidad,
        "comision": 0,
        "moneda": "USD",
    })


# ── GET /api/portafolios ────────────────────────────────────────

class TestListarPortafolios:
    def test_listar_vacio(self, client):
        resp = client.get("/api/portafolios")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_listar_con_datos(self, client):
        _crear_portafolio(client, "A")
        _crear_portafolio(client, "B")
        resp = client.get("/api/portafolios")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        nombres = {p["nombre"] for p in data}
        assert nombres == {"A", "B"}


# ── POST /api/portafolios ───────────────────────────────────────

class TestCrearPortafolio:
    def test_crear_exitoso(self, client):
        resp = _crear_portafolio(client, "Crecimiento", "Mi portafolio")
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["nombre"] == "Crecimiento"
        assert data["descripcion"] == "Mi portafolio"
        assert "id" in data

    def test_nombre_vacio_400(self, client):
        resp = _crear_portafolio(client, "")
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_nombre_duplicado_409(self, client):
        _crear_portafolio(client, "Unico")
        resp = _crear_portafolio(client, "Unico")
        assert resp.status_code == 409
        assert "Ya existe" in resp.get_json()["error"]

    def test_crear_con_moneda_mxn(self, client):
        resp = client.post("/api/portafolios", json={
            "nombre": "MXN Portfolio",
            "moneda": "MXN",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["moneda"] == "MXN"

    def test_crear_sin_moneda_default_mxn(self, client):
        resp = client.post("/api/portafolios", json={
            "nombre": "Default Currency",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["moneda"] == "MXN"

    def test_sin_body_400(self, client):
        resp = client.post("/api/portafolios", json={})
        assert resp.status_code == 400


# ── GET /api/portafolios/consolidado ─────────────────────────────

class TestVistaConsolidada:
    def test_consolidado_vacio(self, client):
        resp = client.get("/api/portafolios/consolidado")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["valor_total"] == 0.0
        assert data["portafolios"] == []

    def test_consolidado_con_datos(self, client):
        r1 = _crear_portafolio(client, "P1")
        r2 = _crear_portafolio(client, "P2")
        _compra(client, r1.get_json()["id"], "AAPL", 100, 10)
        _compra(client, r2.get_json()["id"], "MSFT", 200, 5)
        resp = client.get("/api/portafolios/consolidado")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["portafolios"]) == 2


# ── GET /api/portafolios/<id> ────────────────────────────────────

class TestObtenerPortafolio:
    def test_obtener_existente(self, client):
        r = _crear_portafolio(client, "Detalle")
        pid = r.get_json()["id"]
        resp = client.get(f"/api/portafolios/{pid}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["nombre"] == "Detalle"
        assert "posiciones" in data

    def test_obtener_inexistente_404(self, client):
        resp = client.get("/api/portafolios/9999")
        assert resp.status_code == 404
        assert "error" in resp.get_json()


# ── PUT /api/portafolios/<id> ────────────────────────────────────

class TestActualizarPortafolio:
    def test_renombrar(self, client):
        r = _crear_portafolio(client, "Viejo")
        pid = r.get_json()["id"]
        resp = client.put(f"/api/portafolios/{pid}", json={"nombre": "Nuevo"})
        assert resp.status_code == 200
        assert resp.get_json()["nombre"] == "Nuevo"

    def test_actualizar_descripcion(self, client):
        r = _crear_portafolio(client, "Desc")
        pid = r.get_json()["id"]
        resp = client.put(
            f"/api/portafolios/{pid}",
            json={"descripcion": "Nueva descripción"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["descripcion"] == "Nueva descripción"

    def test_renombrar_vacio_400(self, client):
        r = _crear_portafolio(client, "Test")
        pid = r.get_json()["id"]
        resp = client.put(f"/api/portafolios/{pid}", json={"nombre": ""})
        assert resp.status_code == 400

    def test_renombrar_duplicado_409(self, client):
        _crear_portafolio(client, "A")
        r = _crear_portafolio(client, "B")
        pid = r.get_json()["id"]
        resp = client.put(f"/api/portafolios/{pid}", json={"nombre": "A"})
        assert resp.status_code == 409

    def test_actualizar_inexistente_404(self, client):
        resp = client.put("/api/portafolios/9999", json={"nombre": "X"})
        assert resp.status_code == 404


# ── DELETE /api/portafolios/<id> ─────────────────────────────────

class TestEliminarPortafolio:
    def test_eliminar_exitoso(self, client):
        r = _crear_portafolio(client, "Borrar")
        pid = r.get_json()["id"]
        resp = client.delete(f"/api/portafolios/{pid}")
        assert resp.status_code == 200
        assert "eliminado" in resp.get_json()["mensaje"]
        # Verificar que ya no existe
        resp2 = client.get(f"/api/portafolios/{pid}")
        assert resp2.status_code == 404

    def test_eliminar_con_cascada(self, client):
        r = _crear_portafolio(client, "Cascada")
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 100, 10)
        resp = client.delete(f"/api/portafolios/{pid}")
        assert resp.status_code == 200

    def test_eliminar_inexistente_404(self, client):
        resp = client.delete("/api/portafolios/9999")
        assert resp.status_code == 404


# ── GET /api/portafolios/<id>/posiciones ─────────────────────────

class TestObtenerPosiciones:
    def test_posiciones_vacias(self, client):
        r = _crear_portafolio(client, "Vacio")
        pid = r.get_json()["id"]
        resp = client.get(f"/api/portafolios/{pid}/posiciones")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_posiciones_con_datos(self, client):
        r = _crear_portafolio(client, "Pos")
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 150, 10)
        resp = client.get(f"/api/portafolios/{pid}/posiciones")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["ticker"] == "AAPL"
        assert data[0]["cantidad"] == 10.0

    def test_posiciones_portafolio_inexistente_404(self, client):
        resp = client.get("/api/portafolios/9999/posiciones")
        assert resp.status_code == 404


# ── GET /api/portafolios/<id>/transacciones ──────────────────────

class TestListarTransacciones:
    def test_transacciones_vacias(self, client):
        r = _crear_portafolio(client, "TxVacio")
        pid = r.get_json()["id"]
        resp = client.get(f"/api/portafolios/{pid}/transacciones")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["transacciones"] == []
        assert data["total"] == 0

    def test_paginacion(self, client):
        r = _crear_portafolio(client, "TxPag")
        pid = r.get_json()["id"]
        for i in range(5):
            _compra(client, pid, "AAPL", 100 + i, 1)
        resp = client.get(
            f"/api/portafolios/{pid}/transacciones?page=1&per_page=3"
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["transacciones"]) == 3
        assert data["total"] == 5
        assert data["paginas"] == 2

    def test_transacciones_portafolio_inexistente_404(self, client):
        resp = client.get("/api/portafolios/9999/transacciones")
        assert resp.status_code == 404


# ── POST /api/portafolios/<id>/transacciones ─────────────────────

class TestRegistrarTransaccion:
    def test_compra_exitosa(self, client):
        r = _crear_portafolio(client, "TxCompra")
        pid = r.get_json()["id"]
        resp = _compra(client, pid, "AAPL", 150, 10)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["ticker"] == "AAPL"
        assert data["tipo"] == "compra"
        assert data["cantidad"] == 10.0

    def test_venta_exitosa(self, client):
        r = _crear_portafolio(client, "TxVenta")
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 100, 20)
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "AAPL",
            "tipo": "venta",
            "fecha": "2024-06-01",
            "precio_unitario": 150,
            "cantidad": 10,
            "comision": 0,
            "moneda": "USD",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["ganancia_perdida"] == 500.0

    def test_venta_excede_disponible_422(self, client):
        r = _crear_portafolio(client, "TxExcede")
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 100, 5)
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "AAPL",
            "tipo": "venta",
            "fecha": "2024-06-01",
            "precio_unitario": 150,
            "cantidad": 100,
            "comision": 0,
            "moneda": "USD",
        })
        assert resp.status_code == 422
        assert "excede" in resp.get_json()["error"]

    def test_venta_sin_posicion_422(self, client):
        r = _crear_portafolio(client, "TxSinPos")
        pid = r.get_json()["id"]
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "MSFT",
            "tipo": "venta",
            "fecha": "2024-06-01",
            "precio_unitario": 150,
            "cantidad": 5,
            "comision": 0,
            "moneda": "USD",
        })
        assert resp.status_code == 422

    def test_dividendo_exitoso(self, client):
        r = _crear_portafolio(client, "TxDiv")
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 150, 10)
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "AAPL",
            "tipo": "dividendo",
            "fecha": "2024-03-15",
            "precio_unitario": 0.82,
            "cantidad": 10,
            "comision": 0,
            "moneda": "USD",
        })
        assert resp.status_code == 201

    def test_tipo_invalido_400(self, client):
        r = _crear_portafolio(client, "TxInvalido")
        pid = r.get_json()["id"]
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "AAPL",
            "tipo": "transferencia",
            "fecha": "2024-01-15",
            "precio_unitario": 100,
            "cantidad": 10,
        })
        assert resp.status_code == 400

    def test_campos_faltantes_400(self, client):
        r = _crear_portafolio(client, "TxFaltante")
        pid = r.get_json()["id"]
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "AAPL",
        })
        assert resp.status_code == 400
        assert "requeridos" in resp.get_json()["error"]

    def test_fecha_invalida_400(self, client):
        r = _crear_portafolio(client, "TxFecha")
        pid = r.get_json()["id"]
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "AAPL",
            "tipo": "compra",
            "fecha": "no-es-fecha",
            "precio_unitario": 100,
            "cantidad": 10,
        })
        assert resp.status_code == 400
        assert "fecha" in resp.get_json()["error"].lower()

    def test_portafolio_inexistente_404(self, client):
        resp = client.post("/api/portafolios/9999/transacciones", json={
            "ticker": "AAPL",
            "tipo": "compra",
            "fecha": "2024-01-15",
            "precio_unitario": 100,
            "cantidad": 10,
        })
        assert resp.status_code == 404

    def test_cantidad_negativa_400(self, client):
        r = _crear_portafolio(client, "TxNeg")
        pid = r.get_json()["id"]
        resp = client.post(f"/api/portafolios/{pid}/transacciones", json={
            "ticker": "AAPL",
            "tipo": "compra",
            "fecha": "2024-01-15",
            "precio_unitario": 100,
            "cantidad": -5,
        })
        assert resp.status_code == 400


# ── POST /api/portafolios/<id>/refrescar-precios ─────────────────

class TestRefrescarPrecios:
    """Tests para el endpoint de refresco de precios bajo demanda."""

    def test_refrescar_exitoso_con_precios_faltantes(self, client, db, monkeypatch):
        """Refresca posiciones con precio_actual = 0 (faltante)."""
        # Crear portafolio y compra (precio_actual queda None/0)
        r = _crear_portafolio(client, "Refresh")
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 150, 10)

        # Mock de yfinance para retornar precio actualizado
        def mock_precios(tickers):
            return [{"ticker": "AAPL", "precio": 155.0, "cambio_pct": 3.3}]

        monkeypatch.setattr(
            "app.services.portfolio_service.yfinance_service.obtener_precios_multiples",
            mock_precios,
        )

        resp = client.post(f"/api/portafolios/{pid}/refrescar-precios")
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["ticker"] == "AAPL"

    def test_refrescar_sin_precios_faltantes(self, client, db, monkeypatch):
        """Cuando no hay precios faltantes, retorna posiciones sin llamar a yfinance."""
        from app.extensions import db as _db
        from app.models.portafolio import Posicion

        r = _crear_portafolio(client, "NoRefresh")
        pid = r.get_json()["id"]
        _compra(client, pid, "MSFT", 200, 5)

        # Asignar precio_actual manualmente para que no sea faltante
        with client.application.app_context():
            pos = Posicion.query.filter_by(portafolio_id=pid, ticker="MSFT").first()
            pos.precio_actual = 210.0
            pos.valor_mercado = 210.0 * 5
            _db.session.commit()

        resp = client.post(f"/api/portafolios/{pid}/refrescar-precios")
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["ticker"] == "MSFT"
        assert data[0]["precio_pendiente"] is False

    def test_refrescar_portafolio_inexistente_404(self, client):
        """Portafolio inexistente retorna 404."""
        resp = client.post("/api/portafolios/9999/refrescar-precios")
        assert resp.status_code == 404
        assert "error" in resp.get_json()


# ── GET /api/portafolios/<id>/historico ──────────────────────────

class TestObtenerHistorico:
    """Tests para el endpoint de valor histórico del portafolio."""

    def test_historico_sin_transacciones(self, client):
        """Portafolio sin transacciones retorna listas vacías."""
        r = _crear_portafolio(client, "HistVacio")
        pid = r.get_json()["id"]
        resp = client.get(f"/api/portafolios/{pid}/historico")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["portafolio_id"] == pid
        assert data["rango"] == "30d"
        assert data["fechas"] == []
        assert data["valores"] == []
        assert "moneda" in data

    def test_historico_con_rango_personalizado(self, client):
        """Acepta parámetro rango en query string."""
        r = _crear_portafolio(client, "HistRango")
        pid = r.get_json()["id"]
        resp = client.get(f"/api/portafolios/{pid}/historico?rango=3m")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["rango"] == "3m"

    def test_historico_rango_default_30d(self, client):
        """Sin parámetro rango, usa 30d por defecto."""
        r = _crear_portafolio(client, "HistDefault")
        pid = r.get_json()["id"]
        resp = client.get(f"/api/portafolios/{pid}/historico")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["rango"] == "30d"

    def test_historico_portafolio_inexistente_404(self, client):
        """Portafolio inexistente retorna 404."""
        resp = client.get("/api/portafolios/9999/historico")
        assert resp.status_code == 404
        assert "error" in resp.get_json()

    def test_historico_con_transacciones(self, client, monkeypatch):
        """Portafolio con transacciones retorna datos históricos."""
        import pandas as pd
        from datetime import date, timedelta

        r = _crear_portafolio(client, "HistConDatos")
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 150, 10)

        # Mock de yfinance para retornar datos históricos
        hoy = date.today()
        fechas_idx = pd.date_range(end=hoy, periods=35, freq="B")  # Días hábiles
        n = len(fechas_idx)
        mock_df = pd.DataFrame(
            {"Close": [150.0 + i * 0.5 for i in range(n)]},
            index=fechas_idx,
        )

        def mock_historicos(ticker, periodo="1y", intervalo="1d"):
            return mock_df

        monkeypatch.setattr(
            "app.services.portfolio_service.yfinance_service.obtener_datos_historicos",
            mock_historicos,
        )

        resp = client.get(f"/api/portafolios/{pid}/historico?rango=30d")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["portafolio_id"] == pid
        assert len(data["fechas"]) > 0
        assert len(data["valores"]) > 0
        assert len(data["fechas"]) == len(data["valores"])
        # Todos los valores deben ser positivos (10 acciones × precio > 0)
        assert all(v > 0 for v in data["valores"])


# ── PUT /api/portafolios/<id> — capital_inicial validation ───────

class TestCapitalInicialValidacionAPI:
    """Tests para validación de capital_inicial al editar portafolio via API."""

    def test_capital_menor_a_invertido_400(self, client):
        """Reducir capital por debajo del invertido retorna 400."""
        r = client.post("/api/portafolios", json={
            "nombre": "Cap Val",
            "capital_inicial": 100000,
        })
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 150, 100)  # costo = 15000
        resp = client.put(f"/api/portafolios/{pid}", json={
            "capital_inicial": 10000,
        })
        assert resp.status_code == 400
        assert "no puede ser menor" in resp.get_json()["error"]

    def test_capital_igual_a_invertido_200(self, client):
        """Capital igual al invertido es válido."""
        r = client.post("/api/portafolios", json={
            "nombre": "Cap Igual",
            "capital_inicial": 100000,
        })
        pid = r.get_json()["id"]
        _compra(client, pid, "AAPL", 150, 100)  # costo = 15000
        resp = client.put(f"/api/portafolios/{pid}", json={
            "capital_inicial": 15000,
        })
        assert resp.status_code == 200
        assert resp.get_json()["capital_inicial"] == 15000.0


# ── POST /api/portafolios/<id>/transacciones — auto-pending ─────

class TestAutoPendienteAPI:
    """Tests para auto-pending cuando capital insuficiente via API."""

    def test_compra_excede_capital_pendiente(self, client):
        """Compra que excede capital se marca como pendiente."""
        r = client.post("/api/portafolios", json={
            "nombre": "Auto Pend API",
            "capital_inicial": 10000,
        })
        pid = r.get_json()["id"]
        resp = _compra(client, pid, "AAPL", 150, 100)  # costo = 15000 > 10000
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["estado"] == "sin_fondos"

    def test_compra_dentro_capital_confirmada(self, client):
        """Compra dentro del capital se confirma."""
        r = client.post("/api/portafolios", json={
            "nombre": "Dentro Cap API",
            "capital_inicial": 100000,
        })
        pid = r.get_json()["id"]
        resp = _compra(client, pid, "AAPL", 150, 10)  # costo = 1500 < 100000
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["estado"] == "confirmada"

    def test_compra_sin_capital_no_aplica(self, client):
        """Sin capital_inicial, no se aplica auto-pending."""
        r = _crear_portafolio(client, "Sin Cap API")
        pid = r.get_json()["id"]
        resp = _compra(client, pid, "AAPL", 150, 1000)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["estado"] == "sin_fondos"

"""
Tests para el blueprint REST de alertas (/api/alertas).

Cubre CRUD, toggle, historial y validaciones de entrada.

Requisitos cubiertos: 8.2, 8.5, 8.6
"""

import json
from decimal import Decimal

import pytest

from app.extensions import db as _db
from app.models.alerta import Alerta, AlertaHistorial


# ── Fixtures ─────────────────────────────────────────────────────


@pytest.fixture()
def sample_alerta(db):
    """Crea una alerta de ejemplo."""
    alerta = Alerta(
        user_id=1,
        ticker="AAPL",
        tipo="precio_objetivo",
        condicion="mayor_que",
        umbral=Decimal("200.00"),
        activa=True,
        email_habilitado=False,
    )
    db.session.add(alerta)
    db.session.commit()
    return alerta


@pytest.fixture()
def sample_historial(db, sample_alerta):
    """Crea registros de historial de alertas."""
    registros = []
    for i in range(5):
        h = AlertaHistorial(
            user_id=1,
            alerta_id=sample_alerta.id,
            ticker="AAPL",
            tipo="precio_objetivo",
            condicion=f"Precio superó umbral #{i}",
            valor_disparado=Decimal(f"{201 + i}"),
            canal="websocket",
        )
        registros.append(h)
    db.session.add_all(registros)
    db.session.commit()
    return registros


# ── Tests GET /api/alertas ───────────────────────────────────────


class TestListarAlertas:
    """Tests para GET /api/alertas."""

    def test_listar_vacio(self, client):
        """Retorna lista vacía cuando no hay alertas."""
        resp = client.get("/api/alertas")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["alertas"] == []
        assert data["total"] == 0

    def test_listar_con_alertas(self, client, sample_alerta):
        """Retorna alertas existentes."""
        resp = client.get("/api/alertas")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 1
        assert data["alertas"][0]["ticker"] == "AAPL"


# ── Tests POST /api/alertas ─────────────────────────────────────


class TestCrearAlerta:
    """Tests para POST /api/alertas."""

    def test_crear_alerta_valida(self, client):
        """Crea una alerta con datos válidos."""
        resp = client.post(
            "/api/alertas",
            data=json.dumps({
                "ticker": "AAPL",
                "tipo": "precio_objetivo",
                "condicion": "mayor_que",
                "umbral": 200.0,
                "portafolio_id": None,
                "email_habilitado": False,
            }),
            content_type="application/json",
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["ticker"] == "AAPL"
        assert data["tipo"] == "precio_objetivo"
        assert data["activa"] is True

    def test_crear_alerta_sin_ticker_falla(self, client):
        """Rechaza creación sin ticker."""
        resp = client.post(
            "/api/alertas",
            data=json.dumps({
                "tipo": "precio_objetivo",
                "condicion": "mayor_que",
                "umbral": 200.0,
            }),
            content_type="application/json",
        )
        assert resp.status_code == 400
        assert "ticker" in resp.get_json()["error"].lower()

    def test_crear_alerta_sin_tipo_falla(self, client):
        """Rechaza creación sin tipo."""
        resp = client.post(
            "/api/alertas",
            data=json.dumps({
                "ticker": "AAPL",
                "condicion": "mayor_que",
                "umbral": 200.0,
            }),
            content_type="application/json",
        )
        assert resp.status_code == 400
        assert "tipo" in resp.get_json()["error"].lower()

    def test_crear_alerta_tipo_invalido(self, client):
        """Rechaza tipo de alerta inválido."""
        resp = client.post(
            "/api/alertas",
            data=json.dumps({
                "ticker": "AAPL",
                "tipo": "tipo_falso",
                "condicion": "mayor_que",
                "umbral": 200.0,
            }),
            content_type="application/json",
        )
        assert resp.status_code == 400
        assert "inválido" in resp.get_json()["error"].lower()

    def test_crear_alerta_sin_body_falla(self, client):
        """Rechaza request sin body JSON."""
        resp = client.post("/api/alertas")
        assert resp.status_code == 400

    def test_crear_todos_los_tipos(self, client):
        """Crea alertas de todos los 9 tipos válidos."""
        tipos = [
            "precio_objetivo", "cambio_pct_dia", "rsi_sobrecompra",
            "rsi_sobreventa", "golden_cross", "death_cross",
            "divergencia_macd", "semaforo_rojo", "concentracion",
        ]
        for tipo in tipos:
            resp = client.post(
                "/api/alertas",
                data=json.dumps({
                    "ticker": "AAPL",
                    "tipo": tipo,
                    "condicion": "mayor_que",
                    "umbral": 100.0,
                }),
                content_type="application/json",
            )
            assert resp.status_code == 201, f"Falló para tipo: {tipo}"


# ── Tests PUT /api/alertas/<id> ──────────────────────────────────


class TestActualizarAlerta:
    """Tests para PUT /api/alertas/<id>."""

    def test_actualizar_umbral(self, client, sample_alerta):
        """Actualiza el umbral de una alerta."""
        resp = client.put(
            f"/api/alertas/{sample_alerta.id}",
            data=json.dumps({"umbral": 250.0}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.get_json()["umbral"] == 250.0

    def test_actualizar_alerta_inexistente(self, client):
        """Retorna 404 para alerta inexistente."""
        resp = client.put(
            "/api/alertas/999",
            data=json.dumps({"umbral": 250.0}),
            content_type="application/json",
        )
        assert resp.status_code == 404

    def test_actualizar_sin_body(self, client, sample_alerta):
        """Rechaza request sin body JSON."""
        resp = client.put(f"/api/alertas/{sample_alerta.id}")
        assert resp.status_code == 400


# ── Tests DELETE /api/alertas/<id> ───────────────────────────────


class TestEliminarAlerta:
    """Tests para DELETE /api/alertas/<id>."""

    def test_eliminar_alerta(self, client, sample_alerta):
        """Elimina una alerta correctamente."""
        resp = client.delete(f"/api/alertas/{sample_alerta.id}")
        assert resp.status_code == 200
        assert "eliminada" in resp.get_json()["mensaje"]

    def test_eliminar_alerta_inexistente(self, client):
        """Retorna 404 para alerta inexistente."""
        resp = client.delete("/api/alertas/999")
        assert resp.status_code == 404


# ── Tests PATCH /api/alertas/<id>/toggle ─────────────────────────


class TestToggleAlerta:
    """Tests para PATCH /api/alertas/<id>/toggle."""

    def test_toggle_desactiva(self, client, sample_alerta):
        """Desactiva una alerta activa."""
        resp = client.patch(f"/api/alertas/{sample_alerta.id}/toggle")
        assert resp.status_code == 200
        assert resp.get_json()["activa"] is False

    def test_toggle_activa(self, client, sample_alerta):
        """Activa una alerta desactivada (doble toggle)."""
        client.patch(f"/api/alertas/{sample_alerta.id}/toggle")
        resp = client.patch(f"/api/alertas/{sample_alerta.id}/toggle")
        assert resp.status_code == 200
        assert resp.get_json()["activa"] is True

    def test_toggle_alerta_inexistente(self, client):
        """Retorna 404 para alerta inexistente."""
        resp = client.patch("/api/alertas/999/toggle")
        assert resp.status_code == 404


# ── Tests GET /api/alertas/historial ─────────────────────────────


class TestHistorial:
    """Tests para GET /api/alertas/historial."""

    def test_historial_vacio(self, client):
        """Retorna historial vacío."""
        resp = client.get("/api/alertas/historial")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["historial"] == []
        assert data["total"] == 0

    def test_historial_con_datos(self, client, sample_historial):
        """Retorna historial con datos."""
        resp = client.get("/api/alertas/historial")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 5

    def test_historial_paginado(self, client, sample_historial):
        """Paginación funciona correctamente."""
        resp = client.get("/api/alertas/historial?page=1&per_page=2")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["historial"]) == 2
        assert data["total"] == 5
        assert data["paginas"] == 3

    def test_historial_pagina_2(self, client, sample_historial):
        """Retorna segunda página correctamente."""
        resp = client.get("/api/alertas/historial?page=2&per_page=2")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["historial"]) == 2

# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el blueprint REST fiscal.

Verifica endpoints: tabla fiscal, INPC y tipo de cambio.

Requisitos cubiertos: 9.1–9.7
"""

import pytest
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import patch

from app.models.portafolio import Portafolio, Posicion
from app.models.cache import InpcCache, TipoCambioCache


class TestTablaFiscalEndpoint:
    """Tests para GET /api/fiscal/<portafolio_id>."""

    def test_tabla_fiscal_portafolio_existente(self, client, db):
        """Retorna tabla fiscal para un portafolio válido."""
        p = Portafolio(user_id=1, nombre="Fiscal API Test")
        db.session.add(p)
        db.session.flush()

        pos = Posicion(
            user_id=1,
            portafolio_id=p.id,
            ticker="MSFT",
            cantidad=Decimal("5"),
            precio_promedio=Decimal("300"),
            costo_total=Decimal("1500"),
            precio_actual=Decimal("350"),
            moneda="USD",
        )
        db.session.add(pos)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            response = client.get(f"/api/fiscal/{p.id}")

        assert response.status_code == 200
        data = response.get_json()
        assert "portafolio" in data
        assert "posiciones" in data
        assert "resumen" in data
        assert "tipo_cambio" in data
        assert len(data["posiciones"]) == 1
        assert data["posiciones"][0]["ticker"] == "MSFT"

    def test_tabla_fiscal_portafolio_no_existe(self, client, db):
        """Retorna 404 para portafolio inexistente."""
        response = client.get("/api/fiscal/9999")
        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data


class TestInpcEndpoint:
    """Tests para GET /api/fiscal/inpc."""

    def test_inpc_historial_vacio(self, client, db):
        """Retorna lista vacía si no hay datos en caché."""
        response = client.get("/api/fiscal/inpc")
        assert response.status_code == 200
        data = response.get_json()
        assert "inpc" in data
        assert data["total"] == 0

    def test_inpc_historial_con_datos(self, client, db):
        """Retorna datos de INPC almacenados en caché."""
        entries = [
            InpcCache(anio=2024, mes=1, valor=Decimal("133.000"),
                      updated_at=datetime.now(timezone.utc)),
            InpcCache(anio=2024, mes=2, valor=Decimal("134.000"),
                      updated_at=datetime.now(timezone.utc)),
        ]
        db.session.add_all(entries)
        db.session.commit()

        response = client.get("/api/fiscal/inpc")
        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] == 2

    def test_inpc_filtro_por_anio(self, client, db):
        """Filtra INPC por año."""
        entries = [
            InpcCache(anio=2023, mes=12, valor=Decimal("130.000"),
                      updated_at=datetime.now(timezone.utc)),
            InpcCache(anio=2024, mes=1, valor=Decimal("133.000"),
                      updated_at=datetime.now(timezone.utc)),
        ]
        db.session.add_all(entries)
        db.session.commit()

        response = client.get("/api/fiscal/inpc?anio=2024")
        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] == 1
        assert data["inpc"][0]["anio"] == 2024

    def test_inpc_mes_especifico(self, client, db):
        """Consulta INPC de un mes específico (puede usar mock)."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            response = client.get("/api/fiscal/inpc?anio=2024&mes=6")

        assert response.status_code == 200
        data = response.get_json()
        assert data["anio"] == 2024
        assert data["mes"] == 6
        assert data["valor"] > 0


class TestTipoCambioEndpoint:
    """Tests para GET /api/fiscal/tipo-cambio."""

    def test_tipo_cambio_retorna_datos(self, client, db):
        """Retorna tipo de cambio (mock o caché)."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            response = client.get("/api/fiscal/tipo-cambio")

        assert response.status_code == 200
        data = response.get_json()
        assert "usd_mxn" in data
        assert data["usd_mxn"] > 0
        assert "fuente" in data

    def test_tipo_cambio_con_cache(self, client, db):
        """Retorna tipo de cambio desde caché."""
        tc = TipoCambioCache(
            id=1, usd_mxn=Decimal("18.2500"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(tc)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            response = client.get("/api/fiscal/tipo-cambio")

        assert response.status_code == 200
        data = response.get_json()
        assert data["usd_mxn"] == 18.25

    def test_tipo_cambio_respuesta_enriquecida(self, client, db):
        """Retorna campos enriquecidos: precio, cambio_dia, cambio_pct, ultima_actualizacion, fuente."""
        tc = TipoCambioCache(
            id=1,
            usd_mxn=Decimal("18.5000"),
            usd_mxn_anterior=Decimal("18.2500"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(tc)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            response = client.get("/api/fiscal/tipo-cambio")

        assert response.status_code == 200
        data = response.get_json()
        assert "precio" in data
        assert data["precio"] == 18.5
        assert "cambio_dia" in data
        assert data["cambio_dia"] == 0.25
        assert "cambio_pct" in data
        assert abs(data["cambio_pct"] - 1.3699) < 0.01
        assert "ultima_actualizacion" in data
        assert "fuente" in data

    def test_tipo_cambio_sin_anterior_cambio_nulo(self, client, db):
        """Si no hay valor anterior, cambio_dia y cambio_pct son None."""
        tc = TipoCambioCache(
            id=1,
            usd_mxn=Decimal("17.5000"),
            usd_mxn_anterior=None,
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(tc)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            response = client.get("/api/fiscal/tipo-cambio")

        assert response.status_code == 200
        data = response.get_json()
        assert data["cambio_dia"] is None
        assert data["cambio_pct"] is None

"""
Tests para el blueprint REST de noticias.

Verifica:
    - GET /api/noticias/<ticker> retorna estructura correcta
    - GET /api/noticias/<ticker>/semaforo retorna semáforo válido
    - POST /api/noticias/actualizar ejecuta actualización

Requisitos cubiertos: 6.1, 6.2, 6.7
"""

from decimal import Decimal
from unittest.mock import patch

import pytest

from app.extensions import db
from app.models.noticia import Noticia
from app.models.portafolio import Portafolio, Posicion


class TestGetNoticias:
    """Tests para GET /api/noticias/<ticker>."""

    def test_retorna_estructura_correcta(self, client, db):
        """El endpoint retorna ticker, noticias y total."""
        resp = client.get("/api/noticias/AAPL")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "ticker" in data
        assert "noticias" in data
        assert "total" in data
        assert data["ticker"] == "AAPL"
        assert isinstance(data["noticias"], list)

    def test_retorna_noticias_almacenadas(self, app, client, db):
        """El endpoint retorna noticias previamente almacenadas."""
        with app.app_context():
            noticia = Noticia(
                user_id=1,
                ticker="MSFT",
                titulo="Microsoft reporta crecimiento récord",
                url="https://example.com/msft",
                fuente="Yahoo Finance",
                score_sentimiento=0.75,
                sector="Tecnología / Software",
            )
            db.session.add(noticia)
            db.session.commit()

        resp = client.get("/api/noticias/MSFT")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] >= 1
        assert data["noticias"][0]["ticker"] == "MSFT"
        assert data["noticias"][0]["titulo"] == "Microsoft reporta crecimiento récord"

    def test_ticker_sin_noticias_retorna_lista_vacia(self, client, db):
        """Ticker sin noticias retorna lista vacía."""
        resp = client.get("/api/noticias/XYZABC")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 0
        assert data["noticias"] == []


class TestGetSemaforo:
    """Tests para GET /api/noticias/<ticker>/semaforo."""

    def test_retorna_estructura_correcta(self, client, db):
        """El endpoint retorna ticker, semaforo, score_promedio, total_noticias."""
        resp = client.get("/api/noticias/AAPL/semaforo")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "ticker" in data
        assert "semaforo" in data
        assert "score_promedio" in data
        assert "total_noticias" in data

    def test_semaforo_siempre_valido(self, client, db):
        """El semáforo siempre es verde, amarillo o rojo."""
        resp = client.get("/api/noticias/AAPL/semaforo")
        data = resp.get_json()
        assert data["semaforo"] in ("verde", "amarillo", "rojo")

    def test_sin_noticias_retorna_amarillo(self, client, db):
        """Sin noticias, el semáforo es amarillo."""
        resp = client.get("/api/noticias/XYZABC/semaforo")
        data = resp.get_json()
        assert data["semaforo"] == "amarillo"
        assert data["total_noticias"] == 0


class TestPostActualizar:
    """Tests para POST /api/noticias/actualizar."""

    def test_sin_posiciones_activas(self, client, db):
        """Sin posiciones activas retorna mensaje informativo."""
        resp = client.post("/api/noticias/actualizar")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["tickers_actualizados"] == 0

    def test_con_posiciones_activas(self, app, client, db):
        """Con posiciones activas ejecuta actualización."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test News")
            db.session.add(portafolio)
            db.session.flush()

            posicion = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="AAPL",
                cantidad=Decimal("10"),
                precio_promedio=Decimal("150"),
                costo_total=Decimal("1500"),
                moneda="USD",
            )
            db.session.add(posicion)
            db.session.commit()

        with patch.object(
            __import__('app.services.news_service', fromlist=['NewsService']).NewsService,
            'actualizar_noticias',
            return_value='amarillo',
        ):
            with patch(
                'app.api.noticias.socketio'
            ):
                resp = client.post("/api/noticias/actualizar")

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["tickers_actualizados"] >= 1
        assert "AAPL" in data["resultados"]

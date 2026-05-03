# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el módulo scheduler/jobs.py.

Verifica el job de actualización de precios y el registro de jobs.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest

from app.extensions import db
from app.models.portafolio import Portafolio, Posicion
from app.scheduler.jobs import prices_job, fiscal_job, registrar_jobs


class TestPricesJob:
    """Tests para el job de actualización de precios."""

    def test_sin_posiciones_activas_no_falla(self, app, db):
        """El job no falla cuando no hay posiciones activas."""
        with app.app_context():
            prices_job()

    def test_actualiza_precio_actual(self, app, db):
        """El job actualiza precio_actual en posiciones activas."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test")
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

            mock_precios = [
                {
                    "ticker": "AAPL",
                    "precio": 175.0,
                    "cambio_pct": 1.5,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": False,
                    "ultima_actualizacion": datetime.now(timezone.utc).isoformat(),
                }
            ]

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples",
                return_value=mock_precios,
            ):
                with patch("app.scheduler.jobs.socketio") as mock_socketio:
                    prices_job()

            db.session.refresh(posicion)
            assert float(posicion.precio_actual) == 175.0
            assert posicion.ultima_actualizacion is not None

    def test_calcula_valor_mercado(self, app, db):
        """El job calcula valor_mercado = precio_actual × cantidad."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test VM")
            db.session.add(portafolio)
            db.session.flush()

            posicion = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="MSFT",
                cantidad=Decimal("5"),
                precio_promedio=Decimal("300"),
                costo_total=Decimal("1500"),
                moneda="USD",
            )
            db.session.add(posicion)
            db.session.commit()

            mock_precios = [
                {
                    "ticker": "MSFT",
                    "precio": 350.0,
                    "cambio_pct": 2.0,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": False,
                    "ultima_actualizacion": datetime.now(timezone.utc).isoformat(),
                }
            ]

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples",
                return_value=mock_precios,
            ):
                with patch("app.scheduler.jobs.socketio"):
                    prices_job()

            db.session.refresh(posicion)
            # valor_mercado = 350 × 5 = 1750
            assert float(posicion.valor_mercado) == 1750.0

    def test_calcula_pnl_bruto(self, app, db):
        """El job calcula pnl_bruto = (precio_actual - precio_promedio) × cantidad."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test PnL")
            db.session.add(portafolio)
            db.session.flush()

            posicion = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="GOOG",
                cantidad=Decimal("4"),
                precio_promedio=Decimal("100"),
                costo_total=Decimal("400"),
                moneda="USD",
            )
            db.session.add(posicion)
            db.session.commit()

            mock_precios = [
                {
                    "ticker": "GOOG",
                    "precio": 120.0,
                    "cambio_pct": 3.0,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": False,
                    "ultima_actualizacion": datetime.now(timezone.utc).isoformat(),
                }
            ]

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples",
                return_value=mock_precios,
            ):
                with patch("app.scheduler.jobs.socketio"):
                    prices_job()

            db.session.refresh(posicion)
            # pnl_bruto = (120 - 100) × 4 = 80
            assert float(posicion.pnl_bruto) == 80.0

    def test_calcula_pnl_porcentual(self, app, db):
        """El job calcula pnl_porcentual correctamente."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test PnL%")
            db.session.add(portafolio)
            db.session.flush()

            posicion = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="TSLA",
                cantidad=Decimal("2"),
                precio_promedio=Decimal("200"),
                costo_total=Decimal("400"),
                moneda="USD",
            )
            db.session.add(posicion)
            db.session.commit()

            mock_precios = [
                {
                    "ticker": "TSLA",
                    "precio": 220.0,
                    "cambio_pct": 1.0,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": False,
                    "ultima_actualizacion": datetime.now(timezone.utc).isoformat(),
                }
            ]

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples",
                return_value=mock_precios,
            ):
                with patch("app.scheduler.jobs.socketio"):
                    prices_job()

            db.session.refresh(posicion)
            # pnl_porcentual = (220 - 200) / 200 × 100 = 10%
            assert float(posicion.pnl_porcentual) == 10.0

    def test_emite_evento_prices_updated(self, app, db):
        """El job emite evento WebSocket prices_updated por ticker."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test WS")
            db.session.add(portafolio)
            db.session.flush()

            posicion = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="NVDA",
                cantidad=Decimal("3"),
                precio_promedio=Decimal("500"),
                costo_total=Decimal("1500"),
                moneda="USD",
            )
            db.session.add(posicion)
            db.session.commit()

            mock_precios = [
                {
                    "ticker": "NVDA",
                    "precio": 550.0,
                    "cambio_pct": 2.5,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": False,
                    "ultima_actualizacion": datetime.now(timezone.utc).isoformat(),
                }
            ]

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples",
                return_value=mock_precios,
            ):
                with patch("app.scheduler.jobs.socketio") as mock_socketio:
                    prices_job()

            # Verificar que se emitió prices_updated
            calls = mock_socketio.emit.call_args_list
            prices_calls = [c for c in calls if c[0][0] == "prices_updated"]
            assert len(prices_calls) >= 1
            payload = prices_calls[0][0][1]
            assert payload["ticker"] == "NVDA"
            assert payload["precio"] == 550.0

    def test_emite_evento_portfolio_updated(self, app, db):
        """El job emite evento WebSocket portfolio_updated por portafolio."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test Port WS")
            db.session.add(portafolio)
            db.session.flush()

            posicion = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="META",
                cantidad=Decimal("2"),
                precio_promedio=Decimal("300"),
                costo_total=Decimal("600"),
                moneda="USD",
            )
            db.session.add(posicion)
            db.session.commit()

            mock_precios = [
                {
                    "ticker": "META",
                    "precio": 320.0,
                    "cambio_pct": 1.0,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": False,
                    "ultima_actualizacion": datetime.now(timezone.utc).isoformat(),
                }
            ]

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples",
                return_value=mock_precios,
            ):
                with patch("app.scheduler.jobs.socketio") as mock_socketio:
                    prices_job()

            calls = mock_socketio.emit.call_args_list
            portfolio_calls = [c for c in calls if c[0][0] == "portfolio_updated"]
            assert len(portfolio_calls) >= 1
            payload = portfolio_calls[0][0][1]
            assert payload["portafolio_id"] == portafolio.id
            assert "valor_total" in payload
            assert "pnl_bruto" in payload

    def test_ignora_posiciones_con_cantidad_cero(self, app, db):
        """El job no actualiza posiciones con cantidad = 0."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test Zero")
            db.session.add(portafolio)
            db.session.flush()

            posicion = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="AMZN",
                cantidad=Decimal("0"),
                precio_promedio=Decimal("100"),
                costo_total=Decimal("0"),
                moneda="USD",
            )
            db.session.add(posicion)
            db.session.commit()

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples"
            ) as mock_precios:
                with patch("app.scheduler.jobs.socketio"):
                    prices_job()

            # No debería llamar a obtener_precios_multiples
            mock_precios.assert_not_called()

    def test_ticker_sin_precio_no_interrumpe(self, app, db):
        """Si un ticker no tiene precio, las demás posiciones se actualizan."""
        with app.app_context():
            portafolio = Portafolio(user_id=1, nombre="Test Multi")
            db.session.add(portafolio)
            db.session.flush()

            pos1 = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="AAPL",
                cantidad=Decimal("5"),
                precio_promedio=Decimal("150"),
                costo_total=Decimal("750"),
                moneda="USD",
            )
            pos2 = Posicion(
                user_id=1,
                portafolio_id=portafolio.id,
                ticker="FAIL",
                cantidad=Decimal("3"),
                precio_promedio=Decimal("50"),
                costo_total=Decimal("150"),
                moneda="USD",
            )
            db.session.add_all([pos1, pos2])
            db.session.commit()

            mock_precios = [
                {
                    "ticker": "AAPL",
                    "precio": 160.0,
                    "cambio_pct": 1.0,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": False,
                    "ultima_actualizacion": datetime.now(timezone.utc).isoformat(),
                },
                {
                    "ticker": "FAIL",
                    "precio": None,
                    "cambio_pct": None,
                    "mercado": "NYSE",
                    "es_delay": False,
                    "precio_desactualizado": True,
                    "ultima_actualizacion": None,
                    "error": "No se pudo obtener precio",
                },
            ]

            with patch(
                "app.scheduler.jobs.yfinance_service.obtener_precios_multiples",
                return_value=mock_precios,
            ):
                with patch("app.scheduler.jobs.socketio"):
                    prices_job()

            db.session.refresh(pos1)
            assert float(pos1.precio_actual) == 160.0
            # pos2 no debería haberse actualizado
            db.session.refresh(pos2)
            assert pos2.precio_actual is None


class TestRegistrarJobs:
    """Tests para la función registrar_jobs."""

    def test_registra_prices_job(self, app):
        """Verifica que se registra el job de precios en el scheduler."""
        mock_scheduler = MagicMock()
        registrar_jobs(mock_scheduler, app)

        # Debe llamar add_job al menos para prices_job y prices_job_close
        assert mock_scheduler.add_job.call_count >= 2

        # Verificar que se registró con el ID correcto
        call_args_list = mock_scheduler.add_job.call_args_list
        job_ids = [call.kwargs.get("id") for call in call_args_list]
        assert "prices_job" in job_ids
        assert "prices_job_close" in job_ids

    def test_prices_job_usa_cron_trigger(self, app):
        """Verifica que el job de precios usa trigger cron."""
        mock_scheduler = MagicMock()
        registrar_jobs(mock_scheduler, app)

        call_args_list = mock_scheduler.add_job.call_args_list
        prices_call = [c for c in call_args_list if c.kwargs.get("id") == "prices_job"][0]
        assert prices_call.kwargs["trigger"] == "cron"
        assert prices_call.kwargs["day_of_week"] == "mon-fri"
        assert prices_call.kwargs["timezone"] == "America/New_York"


class TestFiscalJob:
    """Tests para el job de actualización fiscal."""

    def test_fiscal_job_emite_exchange_rate_updated(self, app, db):
        """El fiscal_job emite evento WebSocket exchange_rate_updated."""
        with app.app_context():
            with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
                with patch("app.scheduler.jobs.socketio") as mock_socketio:
                    fiscal_job()

            # Verificar que se emitió exchange_rate_updated
            calls = mock_socketio.emit.call_args_list
            er_calls = [c for c in calls if c[0][0] == "exchange_rate_updated"]
            assert len(er_calls) >= 1
            payload = er_calls[0][0][1]
            assert "precio" in payload
            assert "usd_mxn" in payload
            assert "cambio_dia" in payload
            assert "cambio_pct" in payload
            assert "ultima_actualizacion" in payload
            assert "fuente" in payload

    def test_fiscal_job_no_falla_sin_token(self, app, db):
        """El fiscal_job no falla cuando no hay token de Banxico."""
        with app.app_context():
            with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
                with patch("app.scheduler.jobs.socketio"):
                    fiscal_job()

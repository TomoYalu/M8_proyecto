# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el módulo sockets/events.py.

Verifica los handlers de eventos WebSocket: connect, disconnect,
subscribe_portfolio, unsubscribe_portfolio, subscribe_ticker.
"""

from unittest.mock import patch, MagicMock

import pytest


class TestSocketEvents:
    """Tests para los handlers de eventos WebSocket."""

    def test_subscribe_portfolio_joins_room(self, app):
        """subscribe_portfolio une al cliente al room correcto."""
        with app.app_context():
            with patch("app.sockets.events.join_room") as mock_join:
                from app.sockets.events import handle_subscribe_portfolio
                handle_subscribe_portfolio({"portafolio_id": 42})
                mock_join.assert_called_once_with("portfolio_42")

    def test_subscribe_portfolio_sin_id_no_falla(self, app):
        """subscribe_portfolio sin portafolio_id no lanza excepción."""
        with app.app_context():
            with patch("app.sockets.events.join_room") as mock_join:
                from app.sockets.events import handle_subscribe_portfolio
                handle_subscribe_portfolio({})
                mock_join.assert_not_called()

    def test_unsubscribe_portfolio_leaves_room(self, app):
        """unsubscribe_portfolio saca al cliente del room correcto."""
        with app.app_context():
            with patch("app.sockets.events.leave_room") as mock_leave:
                from app.sockets.events import handle_unsubscribe_portfolio
                handle_unsubscribe_portfolio({"portafolio_id": 7})
                mock_leave.assert_called_once_with("portfolio_7")

    def test_unsubscribe_portfolio_sin_id_no_falla(self, app):
        """unsubscribe_portfolio sin portafolio_id no lanza excepción."""
        with app.app_context():
            with patch("app.sockets.events.leave_room") as mock_leave:
                from app.sockets.events import handle_unsubscribe_portfolio
                handle_unsubscribe_portfolio({})
                mock_leave.assert_not_called()

    def test_subscribe_ticker_joins_room(self, app):
        """subscribe_ticker une al cliente al room del ticker."""
        with app.app_context():
            with patch("app.sockets.events.join_room") as mock_join:
                from app.sockets.events import handle_subscribe_ticker
                handle_subscribe_ticker({"ticker": "AAPL"})
                mock_join.assert_called_once_with("ticker_AAPL")

    def test_subscribe_ticker_sin_ticker_no_falla(self, app):
        """subscribe_ticker sin ticker no lanza excepción."""
        with app.app_context():
            with patch("app.sockets.events.join_room") as mock_join:
                from app.sockets.events import handle_subscribe_ticker
                handle_subscribe_ticker({})
                mock_join.assert_not_called()

    def test_subscribe_ticker_bmv(self, app):
        """subscribe_ticker funciona con tickers BMV (.MX)."""
        with app.app_context():
            with patch("app.sockets.events.join_room") as mock_join:
                from app.sockets.events import handle_subscribe_ticker
                handle_subscribe_ticker({"ticker": "AMXL.MX"})
                mock_join.assert_called_once_with("ticker_AMXL.MX")

    def test_subscribe_exchange_rate_joins_room(self, app):
        """subscribe_exchange_rate une al cliente al room exchange_rate."""
        with app.app_context():
            with patch("app.sockets.events.join_room") as mock_join:
                from app.sockets.events import handle_subscribe_exchange_rate
                handle_subscribe_exchange_rate()
                mock_join.assert_called_once_with("exchange_rate")

    def test_subscribe_exchange_rate_with_data(self, app):
        """subscribe_exchange_rate funciona con o sin payload."""
        with app.app_context():
            with patch("app.sockets.events.join_room") as mock_join:
                from app.sockets.events import handle_subscribe_exchange_rate
                handle_subscribe_exchange_rate({"some": "data"})
                mock_join.assert_called_once_with("exchange_rate")

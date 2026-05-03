# Lakshmi Q2 - Gestión de Inversiones
# Módulo: WebSocket
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Handlers de eventos WebSocket (Flask-SocketIO).

Define los eventos que el servidor escucha del cliente y los que emite.
Usa rooms para entrega dirigida de actualizaciones.

Eventos emitidos (server → client):
    - prices_updated:         {ticker, precio, cambio_pct, timestamp}
    - portfolio_updated:      {portafolio_id, valor_total, pnl_bruto, timestamp}
    - exchange_rate_updated:  {precio, usd_mxn, cambio_dia, cambio_pct,
                               ultima_actualizacion, fuente}

Eventos escuchados (client → server):
    - subscribe_portfolio:      {portafolio_id}
    - unsubscribe_portfolio:    {portafolio_id}
    - subscribe_ticker:         {ticker}
    - subscribe_exchange_rate:  (sin payload)

Requisitos cubiertos: 3.2, 3.3
"""

import logging

from flask_socketio import join_room, leave_room

from ..extensions import socketio

logger = logging.getLogger(__name__)


@socketio.on("connect")
def handle_connect():
    """Maneja la conexión de un cliente WebSocket."""
    logger.info("Cliente WebSocket conectado.")


@socketio.on("disconnect")
def handle_disconnect():
    """Maneja la desconexión de un cliente WebSocket."""
    logger.info("Cliente WebSocket desconectado.")


@socketio.on("subscribe_portfolio")
def handle_subscribe_portfolio(data):
    """
    Suscribe al cliente a actualizaciones de un portafolio.

    El cliente se une al room ``portfolio_{id}`` para recibir
    eventos ``portfolio_updated`` de ese portafolio.

    Args:
        data: dict con ``portafolio_id``.
    """
    portafolio_id = data.get("portafolio_id")
    if portafolio_id is None:
        logger.warning("subscribe_portfolio: falta portafolio_id en los datos.")
        return

    room = f"portfolio_{portafolio_id}"
    join_room(room)
    logger.info("Cliente suscrito al room '%s'.", room)


@socketio.on("unsubscribe_portfolio")
def handle_unsubscribe_portfolio(data):
    """
    Cancela la suscripción del cliente a un portafolio.

    El cliente abandona el room ``portfolio_{id}``.

    Args:
        data: dict con ``portafolio_id``.
    """
    portafolio_id = data.get("portafolio_id")
    if portafolio_id is None:
        logger.warning("unsubscribe_portfolio: falta portafolio_id en los datos.")
        return

    room = f"portfolio_{portafolio_id}"
    leave_room(room)
    logger.info("Cliente desuscrito del room '%s'.", room)


@socketio.on("subscribe_ticker")
def handle_subscribe_ticker(data):
    """
    Suscribe al cliente a actualizaciones de precio de un ticker.

    El cliente se une al room ``ticker_{symbol}`` para recibir
    eventos ``prices_updated`` de ese ticker.

    Args:
        data: dict con ``ticker``.
    """
    ticker = data.get("ticker")
    if not ticker:
        logger.warning("subscribe_ticker: falta ticker en los datos.")
        return

    room = f"ticker_{ticker}"
    join_room(room)
    logger.info("Cliente suscrito al room '%s'.", room)


@socketio.on("subscribe_exchange_rate")
def handle_subscribe_exchange_rate(data=None):
    """
    Suscribe al cliente a actualizaciones de tipo de cambio USD/MXN.

    El cliente se une al room ``exchange_rate`` para recibir
    eventos ``exchange_rate_updated`` cuando el scheduler fiscal
    actualiza el tipo de cambio.
    """
    room = "exchange_rate"
    join_room(room)
    logger.info("Cliente suscrito al room '%s'.", room)

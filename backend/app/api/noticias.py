"""
Blueprint REST para el semáforo de noticias y análisis de sentimiento.

Endpoints:
    GET  /api/noticias/<ticker>              — Últimas 50 noticias con score
    GET  /api/noticias/<ticker>/semaforo      — Semáforo actual (verde/amarillo/rojo)
    GET  /api/noticias/<ticker>/actualizar    — Actualiza noticias on-demand para un ticker
    POST /api/noticias/actualizar             — Fuerza actualización inmediata (todos los activos)

Requisitos cubiertos: 6.1, 6.2, 6.7
"""

import logging

from flask import Blueprint, jsonify

from ..extensions import db, socketio
from ..models.noticia import Noticia
from ..models.portafolio import Posicion
from ..services.news_service import NewsService

logger = logging.getLogger(__name__)

noticias_bp = Blueprint("noticias", __name__, url_prefix="/api/noticias")

_USER_ID = 1


def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


def _auto_fetch_si_vacio(ticker: str) -> None:
    """Llama a NewsService.actualizar_noticias si no hay noticias en DB para el ticker."""
    count = Noticia.query.filter_by(ticker=ticker, user_id=_USER_ID).count()
    if count == 0:
        try:
            NewsService.actualizar_noticias(ticker)
        except Exception as e:
            logger.warning("Error en auto-fetch de noticias para '%s': %s", ticker, e)


@noticias_bp.route("/<string:ticker>", methods=["GET"])
def obtener_noticias(ticker: str):
    """Retorna las últimas 50 noticias con score de sentimiento para un ticker."""
    _auto_fetch_si_vacio(ticker)
    noticias = NewsService.obtener_noticias(ticker, limit=50)
    return jsonify({
        "ticker": ticker,
        "noticias": noticias,
        "total": len(noticias),
    }), 200


@noticias_bp.route("/<string:ticker>/semaforo", methods=["GET"])
def obtener_semaforo(ticker: str):
    """Retorna el semáforo actual (verde/amarillo/rojo) para un ticker."""
    _auto_fetch_si_vacio(ticker)
    resultado = NewsService.obtener_semaforo(ticker)
    return jsonify(resultado), 200


@noticias_bp.route("/<string:ticker>/actualizar", methods=["GET"])
def actualizar_ticker(ticker: str):
    """
    Actualiza noticias on-demand para un ticker específico.

    Llama al pipeline de actualización y retorna el semáforo actualizado
    junto con las últimas 5 noticias.
    """
    try:
        semaforo = NewsService.actualizar_noticias(ticker)
        noticias = NewsService.obtener_noticias(ticker, limit=5)
        semaforo_data = NewsService.obtener_semaforo(ticker)

        return jsonify({
            "ticker": ticker,
            "semaforo": semaforo,
            "score_promedio": semaforo_data.get("score_promedio", 0.0),
            "noticias": noticias,
            "total": len(noticias),
        }), 200
    except Exception as e:
        logger.error("Error al actualizar noticias de '%s': %s", ticker, str(e))
        return _error(f"Error al actualizar noticias de '{ticker}'.", 500)


@noticias_bp.route("/actualizar", methods=["POST"])
def forzar_actualizacion():
    """
    Fuerza actualización inmediata de noticias para todos los tickers activos.

    Obtiene todos los tickers únicos de posiciones activas y ejecuta
    el pipeline de actualización de noticias para cada uno.
    """
    try:
        posiciones_activas = Posicion.query.filter(
            Posicion.cantidad > 0,
            Posicion.user_id == _USER_ID,
        ).all()

        if not posiciones_activas:
            return jsonify({
                "mensaje": "No hay posiciones activas para actualizar.",
                "tickers_actualizados": 0,
            }), 200

        tickers_unicos = list({pos.ticker for pos in posiciones_activas})
        resultados = {}

        for ticker in tickers_unicos:
            try:
                semaforo = NewsService.actualizar_noticias(ticker)
                resultados[ticker] = semaforo

                # Emitir evento WebSocket
                semaforo_data = NewsService.obtener_semaforo(ticker)
                socketio.emit("news_updated", {
                    "ticker": ticker,
                    "semaforo": semaforo,
                    "score": semaforo_data.get("score_promedio", 0.0),
                    "timestamp": None,
                })
            except Exception as e:
                logger.error(
                    "Error al actualizar noticias de '%s': %s", ticker, str(e)
                )
                resultados[ticker] = "error"

        return jsonify({
            "mensaje": f"Noticias actualizadas para {len(resultados)} tickers.",
            "tickers_actualizados": len(resultados),
            "resultados": resultados,
        }), 200

    except Exception as e:
        logger.error("Error al forzar actualización de noticias: %s", str(e))
        return _error("Error interno al actualizar noticias.", 500)

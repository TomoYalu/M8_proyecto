# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Alertas
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Blueprint REST para el motor de alertas.

Endpoints:
    GET    /api/alertas              — Lista todas las alertas del usuario
    POST   /api/alertas              — Crea nueva alerta
    PUT    /api/alertas/<id>         — Actualiza configuración de alerta
    DELETE /api/alertas/<id>         — Elimina alerta
    PATCH  /api/alertas/<id>/toggle  — Activa/desactiva alerta
    GET    /api/alertas/historial    — Historial paginado de alertas disparadas

Requisitos cubiertos: 8.2, 8.5, 8.6
"""

import logging

from flask import Blueprint, jsonify, request, g

from ..services.alert_service import AlertService

logger = logging.getLogger(__name__)

alertas_bp = Blueprint("alertas", __name__, url_prefix="/api/alertas")

def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


@alertas_bp.route("", methods=["GET"])
def listar_alertas():
    """Lista todas las alertas del usuario."""
    alertas = AlertService.listar_alertas(g.user_id)
    return jsonify({"alertas": alertas, "total": len(alertas)}), 200


@alertas_bp.route("", methods=["POST"])
def crear_alerta():
    """
    Crea una nueva alerta.

    Body JSON:
        ticker (str): Símbolo bursátil.
        tipo (str): Tipo de alerta (9 tipos válidos).
        condicion (str): 'mayor_que', 'menor_que' o 'igual'.
        umbral (float, opcional): Valor umbral.
        portafolio_id (int, opcional): ID del portafolio asociado.
        email_habilitado (bool, opcional): Activar notificación por email.
    """
    data = request.get_json(silent=True)
    if not data:
        return _error("Se requiere un cuerpo JSON válido.", 400)

    ticker = data.get("ticker")
    tipo = data.get("tipo")
    condicion = data.get("condicion")
    umbral = data.get("umbral")
    portafolio_id = data.get("portafolio_id")
    email_habilitado = data.get("email_habilitado", False)

    if not ticker:
        return _error("El campo 'ticker' es obligatorio.", 400)
    if not tipo:
        return _error("El campo 'tipo' es obligatorio.", 400)
    if not condicion:
        return _error("El campo 'condicion' es obligatorio.", 400)

    try:
        alerta = AlertService.crear_alerta(
            user_id=g.user_id,
            ticker=ticker,
            tipo=tipo,
            condicion=condicion,
            umbral=umbral,
            portafolio_id=portafolio_id,
            email_habilitado=email_habilitado,
        )
        return jsonify(alerta), 201
    except ValueError as e:
        return _error(str(e), 400)
    except Exception as e:
        logger.error("Error al crear alerta: %s", str(e))
        return _error("Error interno al crear la alerta.", 500)


@alertas_bp.route("/<int:alerta_id>", methods=["PUT"])
def actualizar_alerta(alerta_id: int):
    """Actualiza la configuración de una alerta."""
    data = request.get_json(silent=True)
    if not data:
        return _error("Se requiere un cuerpo JSON válido.", 400)

    try:
        alerta = AlertService.actualizar_alerta(alerta_id, g.user_id, data)
        return jsonify(alerta), 200
    except ValueError as e:
        return _error(str(e), 404)
    except Exception as e:
        logger.error("Error al actualizar alerta %d: %s", alerta_id, str(e))
        return _error("Error interno al actualizar la alerta.", 500)


@alertas_bp.route("/<int:alerta_id>", methods=["DELETE"])
def eliminar_alerta(alerta_id: int):
    """Elimina una alerta."""
    try:
        resultado = AlertService.eliminar_alerta(alerta_id, g.user_id)
        return jsonify(resultado), 200
    except ValueError as e:
        return _error(str(e), 404)
    except Exception as e:
        logger.error("Error al eliminar alerta %d: %s", alerta_id, str(e))
        return _error("Error interno al eliminar la alerta.", 500)


@alertas_bp.route("/<int:alerta_id>/toggle", methods=["PATCH"])
def toggle_alerta(alerta_id: int):
    """Activa/desactiva una alerta sin eliminarla."""
    try:
        alerta = AlertService.toggle_alerta(alerta_id, g.user_id)
        return jsonify(alerta), 200
    except ValueError as e:
        return _error(str(e), 404)
    except Exception as e:
        logger.error("Error al toggle alerta %d: %s", alerta_id, str(e))
        return _error("Error interno al cambiar estado de la alerta.", 500)


@alertas_bp.route("/historial", methods=["GET"])
def listar_historial():
    """Historial paginado de alertas disparadas."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    # Limitar per_page para evitar abusos
    per_page = min(per_page, 100)

    resultado = AlertService.listar_historial(g.user_id, page, per_page)
    return jsonify(resultado), 200

"""
Blueprint REST para gestión de simulaciones de portafolios.

Endpoints:
    POST   /api/simulaciones                    — Crear simulación
    GET    /api/simulaciones                    — Listar simulaciones del usuario
    GET    /api/simulaciones/<id>               — Detalle con activos
    PUT    /api/simulaciones/<id>               — Actualizar tickers/pesos/capital
    POST   /api/simulaciones/<id>/ejecutar      — Convertir a portafolio real
    POST   /api/simulaciones/<id>/calcular      — Calcular acciones y montos
    DELETE /api/simulaciones/<id>               — Eliminar
    POST   /api/simulaciones/importar           — Importar desde portafolio existente

Todas las operaciones usan user_id=1 (modo single-user).
Mensajes de error en español.

Requisitos cubiertos: 1.1–1.8
"""

import logging

from flask import Blueprint, jsonify, request

from ..services import simulator_service as svc

simulaciones_bp = Blueprint(
    "simulaciones", __name__, url_prefix="/api/simulaciones"
)

logger = logging.getLogger(__name__)

# ── user_id fijo (single-user) ──────────────────────────────────
_USER_ID = 1


# ── Helpers ──────────────────────────────────────────────────────

def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


# ── POST /api/simulaciones ──────────────────────────────────────

@simulaciones_bp.route("", methods=["POST"])
def crear_simulacion():
    """
    Crea una nueva simulación de portafolio.

    Request Body:
        nombre: str             — Nombre de la simulación
        capital_total: float    — Capital de inversión
        moneda: str             — Moneda (default "USD")
        activos: list | null    — Lista opcional de {ticker, peso_objetivo}
    """
    data = request.get_json(silent=True) or {}

    nombre = data.get("nombre", "")
    capital_total = data.get("capital_total", 0)
    moneda = data.get("moneda", "USD")
    activos = data.get("activos")

    try:
        resultado = svc.crear_simulacion(
            user_id=_USER_ID,
            nombre=nombre,
            capital_total=capital_total,
            moneda=moneda,
            activos=activos,
        )
    except ValueError as e:
        return _error(str(e), 400)

    return jsonify(resultado), 201


# ── GET /api/simulaciones ───────────────────────────────────────

@simulaciones_bp.route("", methods=["GET"])
def listar_simulaciones():
    """Lista todas las simulaciones del usuario."""
    simulaciones = svc.listar_simulaciones(_USER_ID)
    return jsonify(simulaciones), 200


# ── POST /api/simulaciones/importar (ANTES de /<int:id>) ────────

@simulaciones_bp.route("/importar", methods=["POST"])
def importar_portafolio():
    """
    Importa un portafolio existente como nueva simulación.

    Request Body:
        portafolio_id: int  — ID del portafolio a importar
        nombre: str         — Nombre para la nueva simulación
    """
    data = request.get_json(silent=True) or {}

    portafolio_id = data.get("portafolio_id")
    nombre = data.get("nombre", "")

    if portafolio_id is None:
        return _error("El campo 'portafolio_id' es requerido.", 400)

    try:
        portafolio_id = int(portafolio_id)
    except (TypeError, ValueError):
        return _error("El campo 'portafolio_id' debe ser un número entero.", 400)

    try:
        resultado = svc.importar_portafolio(
            portafolio_id=portafolio_id,
            user_id=_USER_ID,
            nombre=nombre,
        )
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        return _error(msg, 400)

    return jsonify(resultado), 201


# ── GET /api/simulaciones/<id> ──────────────────────────────────

@simulaciones_bp.route("/<int:simulacion_id>", methods=["GET"])
def obtener_simulacion(simulacion_id: int):
    """Detalle de una simulación con sus activos."""
    try:
        resultado = svc.obtener_simulacion(simulacion_id, _USER_ID)
    except ValueError as e:
        return _error(str(e), 404)

    return jsonify(resultado), 200


# ── PUT /api/simulaciones/<id> ──────────────────────────────────

@simulaciones_bp.route("/<int:simulacion_id>", methods=["PUT"])
def actualizar_simulacion(simulacion_id: int):
    """
    Actualiza una simulación existente.

    Request Body (todos opcionales):
        nombre: str             — Nuevo nombre
        capital_total: float    — Nuevo capital
        moneda: str             — Nueva moneda
        activos: list           — Nueva lista de {ticker, peso_objetivo}
    """
    data = request.get_json(silent=True) or {}

    try:
        resultado = svc.actualizar_simulacion(
            simulacion_id=simulacion_id,
            user_id=_USER_ID,
            datos=data,
        )
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        if "ya ejecutada" in msg.lower():
            return _error(msg, 409)
        return _error(msg, 400)

    return jsonify(resultado), 200


# ── POST /api/simulaciones/<id>/ejecutar ────────────────────────

@simulaciones_bp.route("/<int:simulacion_id>/ejecutar", methods=["POST"])
def ejecutar_simulacion(simulacion_id: int):
    """Convierte una simulación en un portafolio real."""
    try:
        resultado = svc.ejecutar_simulacion(simulacion_id, _USER_ID)
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        if "ya fue ejecutada" in msg.lower():
            return _error(msg, 409)
        return _error(msg, 400)

    return jsonify(resultado), 201


# ── POST /api/simulaciones/<id>/calcular ────────────────────────

@simulaciones_bp.route("/<int:simulacion_id>/calcular", methods=["POST"])
def calcular_acciones(simulacion_id: int):
    """Calcula acciones y montos para cada activo de la simulación."""
    try:
        resultado = svc.calcular_acciones(simulacion_id, _USER_ID)
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        if "ya ejecutada" in msg.lower():
            return _error(msg, 409)
        return _error(msg, 400)

    return jsonify(resultado), 200


# ── DELETE /api/simulaciones/<id> ────────────────────────────────

@simulaciones_bp.route("/<int:simulacion_id>", methods=["DELETE"])
def eliminar_simulacion(simulacion_id: int):
    """Elimina una simulación y todos sus activos."""
    try:
        resultado = svc.eliminar_simulacion(simulacion_id, _USER_ID)
    except ValueError as e:
        return _error(str(e), 404)

    return jsonify(resultado), 200

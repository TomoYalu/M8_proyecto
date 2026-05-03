"""
Blueprint REST para gestión de portafolios de inversión.

Endpoints:
    GET    /api/portafolios                     — Lista portafolios del usuario
    POST   /api/portafolios                     — Crea un nuevo portafolio
    GET    /api/portafolios/consolidado          — Vista agregada de todos los portafolios
    GET    /api/portafolios/<id>                 — Detalle de un portafolio con posiciones
    PUT    /api/portafolios/<id>                 — Renombra o actualiza descripción
    DELETE /api/portafolios/<id>                 — Elimina portafolio con cascada
    GET    /api/portafolios/<id>/posiciones      — Posiciones con precios actuales y P&L
    GET    /api/portafolios/<id>/transacciones   — Historial paginado de transacciones
    POST   /api/portafolios/<id>/transacciones   — Registra nueva transacción
    POST   /api/portafolios/<id>/refrescar-precios — Refresca precios faltantes bajo demanda
    GET    /api/portafolios/<id>/historico        — Valor histórico del portafolio (sparkline)

Todas las operaciones usan user_id=1 (modo single-user).
Mensajes de error en español.

Requisitos cubiertos: 1.1–1.5, 2.1–2.6, 12.3, 13.3
"""

from datetime import date

from flask import Blueprint, jsonify, request

from ..services import portfolio_service as svc

portafolios_bp = Blueprint(
    "portafolios", __name__, url_prefix="/api/portafolios"
)

# ── user_id fijo (single-user, Req 11.2) ────────────────────────
_USER_ID = 1


# ── Helpers ──────────────────────────────────────────────────────

def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


def _parse_fecha(valor: str) -> date:
    """
    Convierte una cadena ISO 8601 (YYYY-MM-DD) a objeto date.

    Raises:
        ValueError: si el formato es inválido.
    """
    try:
        return date.fromisoformat(valor)
    except (ValueError, TypeError):
        raise ValueError(
            f"Formato de fecha inválido: '{valor}'. Use el formato YYYY-MM-DD."
        )


# ── CRUD Portafolios ────────────────────────────────────────────

@portafolios_bp.route("", methods=["GET"])
def listar_portafolios():
    """Lista todos los portafolios del usuario."""
    portafolios = svc.listar_portafolios(_USER_ID)
    return jsonify(portafolios), 200


@portafolios_bp.route("", methods=["POST"])
def crear_portafolio():
    """Crea un nuevo portafolio."""
    data = request.get_json(silent=True) or {}
    nombre = data.get("nombre", "")
    descripcion = data.get("descripcion")
    moneda = data.get("moneda", "MXN")
    capital_inicial = data.get("capital_inicial", 0)

    try:
        resultado = svc.crear_portafolio(_USER_ID, nombre, descripcion, moneda=moneda, capital_inicial=capital_inicial)
    except ValueError as e:
        msg = str(e)
        if "Ya existe" in msg:
            return _error(msg, 409)
        return _error(msg, 400)

    return jsonify(resultado), 201


# ── Vista consolidada (ANTES de /<int:id> para evitar conflicto) ─

@portafolios_bp.route("/consolidado", methods=["GET"])
def vista_consolidada():
    """Vista agregada de todos los portafolios del usuario."""
    resultado = svc.vista_consolidada(_USER_ID)
    return jsonify(resultado), 200


# ── Detalle, actualización y eliminación de portafolio ───────────

@portafolios_bp.route("/<int:portafolio_id>", methods=["GET"])
def obtener_portafolio(portafolio_id: int):
    """Detalle de un portafolio con sus posiciones."""
    try:
        resultado = svc.obtener_portafolio(portafolio_id, _USER_ID)
    except ValueError as e:
        return _error(str(e), 404)

    return jsonify(resultado), 200


@portafolios_bp.route("/<int:portafolio_id>", methods=["PUT"])
def actualizar_portafolio(portafolio_id: int):
    """Actualiza nombre, descripción y/o capital inicial de un portafolio."""
    data = request.get_json(silent=True) or {}
    nombre = data.get("nombre")
    descripcion = data.get("descripcion")
    capital_inicial = data.get("capital_inicial")

    try:
        resultado = svc.actualizar_portafolio(
            portafolio_id, _USER_ID, nombre=nombre, descripcion=descripcion,
            capital_inicial=capital_inicial,
        )
    except ValueError as e:
        msg = str(e)
        if "Ya existe" in msg:
            return _error(msg, 409)
        if "No se encontró" in msg:
            return _error(msg, 404)
        return _error(msg, 400)

    return jsonify(resultado), 200


@portafolios_bp.route("/<int:portafolio_id>", methods=["DELETE"])
def eliminar_portafolio(portafolio_id: int):
    """Elimina un portafolio y todos sus datos en cascada."""
    try:
        resultado = svc.eliminar_portafolio(portafolio_id, _USER_ID)
    except ValueError as e:
        return _error(str(e), 404)

    return jsonify(resultado), 200


# ── Posiciones ───────────────────────────────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/posiciones", methods=["GET"])
def obtener_posiciones(portafolio_id: int):
    """Lista posiciones del portafolio con precios actuales y P&L."""
    try:
        resultado = svc.obtener_posiciones(portafolio_id, _USER_ID)
    except ValueError as e:
        return _error(str(e), 404)

    return jsonify(resultado), 200


@portafolios_bp.route("/<int:portafolio_id>/posiciones/<int:posicion_id>", methods=["PUT"])
def actualizar_posicion(portafolio_id: int, posicion_id: int):
    """Actualiza la cantidad de una posición directamente."""
    data = request.get_json(silent=True) or {}
    cantidad_deseada = data.get("cantidad_deseada")

    if cantidad_deseada is None:
        return _error("El campo 'cantidad_deseada' es requerido.", 400)

    try:
        cantidad_deseada = float(cantidad_deseada)
    except (ValueError, TypeError):
        return _error("El campo 'cantidad_deseada' debe ser un número válido.", 400)

    if cantidad_deseada < 0:
        return _error("La cantidad deseada no puede ser negativa.", 400)

    try:
        resultado = svc.actualizar_posicion(
            portafolio_id, _USER_ID, posicion_id, cantidad_deseada
        )
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        return _error(msg, 400)

    return jsonify(resultado), 200


# ── Transacciones ────────────────────────────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/transacciones", methods=["GET"])
def listar_transacciones(portafolio_id: int):
    """Historial paginado de transacciones (50 por página por defecto)."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)

    try:
        resultado = svc.listar_transacciones(
            portafolio_id, _USER_ID, page=page, per_page=per_page
        )
    except ValueError as e:
        return _error(str(e), 404)

    return jsonify(resultado), 200


@portafolios_bp.route("/<int:portafolio_id>/transacciones", methods=["POST"])
def registrar_transaccion(portafolio_id: int):
    """Registra una nueva transacción (compra/venta/dividendo)."""
    data = request.get_json(silent=True) or {}

    # Validar campos requeridos
    campos_requeridos = ["ticker", "tipo", "fecha", "precio_unitario", "cantidad"]
    faltantes = [c for c in campos_requeridos if c not in data or data[c] is None]
    if faltantes:
        return _error(
            f"Campos requeridos faltantes: {', '.join(faltantes)}.", 400
        )

    try:
        fecha = _parse_fecha(data["fecha"])
    except ValueError as e:
        return _error(str(e), 400)

    try:
        resultado = svc.registrar_transaccion(
            portafolio_id=portafolio_id,
            user_id=_USER_ID,
            ticker=data["ticker"],
            tipo=data["tipo"],
            fecha=fecha,
            precio_unitario=data["precio_unitario"],
            cantidad=data["cantidad"],
            comision=data.get("comision", 0),
            moneda=data.get("moneda", "USD"),
            notas=data.get("notas"),
        )
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        if "excede la cantidad disponible" in msg:
            return _error(msg, 422)
        if "No existe posición activa" in msg:
            return _error(msg, 422)
        return _error(msg, 400)

    return jsonify(resultado), 201


# ── Confirmar / Cancelar transacciones pendientes ────────────────

@portafolios_bp.route(
    "/<int:portafolio_id>/transacciones/<int:transaccion_id>/confirmar",
    methods=["POST"],
)
def confirmar_transaccion(portafolio_id: int, transaccion_id: int):
    """Confirma una transacción pendiente."""
    try:
        resultado = svc.confirmar_transaccion(
            portafolio_id, _USER_ID, transaccion_id
        )
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        return _error(msg, 400)

    return jsonify(resultado), 200


@portafolios_bp.route(
    "/<int:portafolio_id>/transacciones/<int:transaccion_id>/cancelar",
    methods=["DELETE"],
)
def cancelar_transaccion(portafolio_id: int, transaccion_id: int):
    """Cancela una transacción pendiente y revierte los cambios."""
    try:
        resultado = svc.cancelar_transaccion(
            portafolio_id, _USER_ID, transaccion_id
        )
    except ValueError as e:
        msg = str(e)
        if "No se encontró" in msg:
            return _error(msg, 404)
        return _error(msg, 400)

    return jsonify(resultado), 200


# ── Refresco de precios bajo demanda ─────────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/refrescar-precios", methods=["POST"])
def refrescar_precios(portafolio_id: int):
    """Refresca precios de posiciones con precio faltante."""
    try:
        resultado = svc.refrescar_precios(portafolio_id, _USER_ID)
    except ValueError as e:
        return _error(str(e), 404)
    return jsonify(resultado), 200


# ── Valor histórico del portafolio ───────────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/historico", methods=["GET"])
def obtener_historico(portafolio_id: int):
    """Valor histórico del portafolio para sparkline."""
    rango = request.args.get("rango", "30d")
    try:
        resultado = svc.obtener_historico(portafolio_id, _USER_ID, rango)
    except ValueError as e:
        return _error(str(e), 404)
    return jsonify(resultado), 200

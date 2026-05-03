"""
Blueprint REST para configuración de widgets del dashboard.

Endpoints:
    GET    /api/widgets/config           — Configuración de layout del usuario
    PUT    /api/widgets/config           — Guarda configuración de layout
    POST   /api/widgets/preset/<nombre>  — Aplica preset (rapido/completo/portafolio)

Todos los mensajes de error en español.

Requisitos cubiertos: 5.1–5.6
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models.widget import WidgetConfig

logger = logging.getLogger(__name__)

widgets_bp = Blueprint("widgets", __name__, url_prefix="/api/widgets")

# ── Definición de widgets disponibles ────────────────────────────

WIDGETS_DISPONIBLES = {
    "candlestick": {"nombre": "Velas japonesas", "x": 0, "y": 0, "w": 8, "h": 6},
    "macd":        {"nombre": "MACD",            "x": 0, "y": 6, "w": 6, "h": 4},
    "rsi":         {"nombre": "RSI",             "x": 6, "y": 6, "w": 6, "h": 4},
    "stochastic":  {"nombre": "Estocástico",     "x": 0, "y": 10, "w": 6, "h": 4},
    "bollinger":   {"nombre": "Bollinger",       "x": 6, "y": 10, "w": 6, "h": 4},
    "volume":      {"nombre": "Volumen",         "x": 8, "y": 0, "w": 4, "h": 6},
    "posiciones":  {"nombre": "Tabla de posiciones", "x": 0, "y": 0, "w": 12, "h": 6},
    "pnl":         {"nombre": "P&L resumen",     "x": 0, "y": 6, "w": 6, "h": 4},
    "semaforo":    {"nombre": "Semáforo noticias", "x": 6, "y": 6, "w": 6, "h": 4},
    "frontier":    {"nombre": "Frontera eficiente", "x": 0, "y": 14, "w": 12, "h": 6},
}

# ── Presets de layout ────────────────────────────────────────────

PRESETS = {
    "rapido": {
        "nombre": "Análisis Rápido",
        "descripcion": "Precio + RSI + MACD",
        "widgets_visibles": {"candlestick", "rsi", "macd"},
    },
    "completo": {
        "nombre": "Análisis Completo",
        "descripcion": "Todos los widgets visibles",
        "widgets_visibles": set(WIDGETS_DISPONIBLES.keys()),
    },
    "portafolio": {
        "nombre": "Solo Portafolio",
        "descripcion": "Posiciones + P&L + Semáforo",
        "widgets_visibles": {"posiciones", "pnl", "semaforo"},
    },
}


# ── Helpers ──────────────────────────────────────────────────────

def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


def _widget_to_dict(wc: WidgetConfig) -> dict:
    """Serializa un WidgetConfig a diccionario."""
    return {
        "widget_id": wc.widget_id,
        "x": wc.x,
        "y": wc.y,
        "w": wc.w,
        "h": wc.h,
        "visible": wc.visible,
        "nombre": WIDGETS_DISPONIBLES.get(wc.widget_id, {}).get("nombre", wc.widget_id),
    }


def _aplicar_preset(user_id: int, nombre_preset: str) -> list[dict]:
    """
    Aplica un preset de layout, reemplazando toda la configuración
    de widgets del usuario.

    Returns:
        Lista de diccionarios con la nueva configuración.
    """
    preset = PRESETS[nombre_preset]
    visibles = preset["widgets_visibles"]

    # Eliminar configuración existente del usuario
    WidgetConfig.query.filter_by(user_id=user_id).delete()

    nuevos = []
    for widget_id, defaults in WIDGETS_DISPONIBLES.items():
        wc = WidgetConfig(
            user_id=user_id,
            widget_id=widget_id,
            x=defaults["x"],
            y=defaults["y"],
            w=defaults["w"],
            h=defaults["h"],
            visible=(widget_id in visibles),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(wc)
        nuevos.append(wc)

    db.session.commit()
    return [_widget_to_dict(wc) for wc in nuevos]


# ── Endpoints ────────────────────────────────────────────────────

@widgets_bp.route("/config", methods=["GET"])
def obtener_config():
    """
    Retorna la configuración de layout de widgets del usuario.

    Si no existe configuración previa, aplica el preset "completo"
    por defecto y retorna esa configuración.

    Returns:
        JSON con lista de widgets y preset activo.
    """
    user_id = 1  # Single-user mode

    configs = WidgetConfig.query.filter_by(user_id=user_id).all()

    if not configs:
        # Aplicar preset "completo" por defecto
        logger.info("Sin configuración de widgets para user_id=%d, aplicando preset 'completo'", user_id)
        widgets = _aplicar_preset(user_id, "completo")
        return jsonify({
            "widgets": widgets,
            "preset_activo": "completo",
        }), 200

    return jsonify({
        "widgets": [_widget_to_dict(wc) for wc in configs],
        "preset_activo": None,
    }), 200


@widgets_bp.route("/config", methods=["PUT"])
def guardar_config():
    """
    Guarda la configuración de layout de widgets.

    Body JSON:
        widgets (list[dict]): Lista de widgets con campos:
            widget_id (str), x (int), y (int), w (int), h (int), visible (bool)

    Returns:
        JSON con la configuración guardada.
    """
    user_id = 1
    data = request.get_json(silent=True) or {}
    widgets_data = data.get("widgets")

    if not widgets_data or not isinstance(widgets_data, list):
        return _error("Se requiere una lista de widgets en el campo 'widgets'.", 400)

    ahora = datetime.now(timezone.utc)

    for w in widgets_data:
        widget_id = w.get("widget_id")
        if not widget_id:
            continue

        # Buscar configuración existente o crear nueva
        wc = WidgetConfig.query.filter_by(
            user_id=user_id, widget_id=widget_id
        ).first()

        if wc is None:
            wc = WidgetConfig(user_id=user_id, widget_id=widget_id)
            db.session.add(wc)

        wc.x = w.get("x", wc.x)
        wc.y = w.get("y", wc.y)
        wc.w = w.get("w", wc.w)
        wc.h = w.get("h", wc.h)
        wc.visible = w.get("visible", wc.visible)
        wc.updated_at = ahora

    db.session.commit()

    configs = WidgetConfig.query.filter_by(user_id=user_id).all()
    return jsonify({
        "widgets": [_widget_to_dict(wc) for wc in configs],
        "mensaje": "Configuración guardada correctamente.",
    }), 200


@widgets_bp.route("/preset/<nombre>", methods=["POST"])
def aplicar_preset(nombre: str):
    """
    Aplica un preset de layout, reemplazando toda la configuración actual.

    Args:
        nombre: Nombre del preset ('rapido', 'completo', 'portafolio').

    Returns:
        JSON con la nueva configuración y datos del preset aplicado.
    """
    user_id = 1
    nombre = nombre.strip().lower()

    if nombre not in PRESETS:
        presets_validos = ", ".join(PRESETS.keys())
        return _error(
            f"Preset '{nombre}' no encontrado. Presets disponibles: {presets_validos}.",
            404,
        )

    widgets = _aplicar_preset(user_id, nombre)
    preset_info = PRESETS[nombre]

    return jsonify({
        "widgets": widgets,
        "preset_activo": nombre,
        "preset_nombre": preset_info["nombre"],
        "preset_descripcion": preset_info["descripcion"],
        "mensaje": f"Preset '{preset_info['nombre']}' aplicado correctamente.",
    }), 200

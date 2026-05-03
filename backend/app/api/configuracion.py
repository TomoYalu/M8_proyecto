"""API de configuración de usuario (capital global)."""

import logging
from decimal import Decimal

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models.configuracion import ConfiguracionUsuario

logger = logging.getLogger(__name__)

configuracion_bp = Blueprint("configuracion", __name__, url_prefix="/api/configuracion")

_USER_ID = 1


def _get_or_create(user_id: int) -> ConfiguracionUsuario:
    config = ConfiguracionUsuario.query.filter_by(user_id=user_id).first()
    if config is None:
        config = ConfiguracionUsuario(user_id=user_id, capital_global=0, moneda_base="MXN")
        db.session.add(config)
        db.session.commit()
    return config


@configuracion_bp.route("/capital", methods=["GET"])
def obtener_capital():
    config = _get_or_create(_USER_ID)
    return jsonify({
        "capital_global": float(config.capital_global),
        "moneda_base": config.moneda_base,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }), 200


@configuracion_bp.route("/capital", methods=["PUT"])
def actualizar_capital():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body JSON requerido."}), 400

    config = _get_or_create(_USER_ID)

    if "capital_global" in data:
        nuevo = Decimal(str(data["capital_global"]))
        if nuevo < 0:
            return jsonify({"error": "El capital no puede ser negativo."}), 400

        # Validar que no sea menor a la suma de capital_inicial de todos los portafolios
        from ..models.portafolio import Portafolio
        portafolios = Portafolio.query.filter_by(user_id=_USER_ID).all()
        total_asignado = sum(
            float(p.capital_inicial) for p in portafolios if p.capital_inicial
        )
        if float(nuevo) < total_asignado:
            return jsonify({
                "error": f"El capital no puede ser menor al total asignado a portafolios (${total_asignado:,.2f})."
            }), 400

        config.capital_global = nuevo

    if "moneda_base" in data:
        moneda = data["moneda_base"].upper().strip()
        if moneda not in ("MXN", "USD"):
            return jsonify({"error": "Moneda debe ser MXN o USD."}), 400
        config.moneda_base = moneda

    db.session.commit()

    return jsonify({
        "capital_global": float(config.capital_global),
        "moneda_base": config.moneda_base,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }), 200

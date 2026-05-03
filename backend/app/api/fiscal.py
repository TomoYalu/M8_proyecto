"""
Blueprint REST para el módulo fiscal México.

Endpoints:
    GET /api/fiscal/<portafolio_id>  — Tabla fiscal completa del portafolio
    GET /api/fiscal/inpc             — INPC mensual histórico (caché)
    GET /api/fiscal/tipo-cambio      — Tipo de cambio USD/MXN actual

Requisitos cubiertos: 9.1–9.7
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..models.cache import InpcCache
from ..services.banxico_service import BanxicoService
from ..services.fiscal_service import FiscalService

logger = logging.getLogger(__name__)

fiscal_bp = Blueprint("fiscal", __name__, url_prefix="/api/fiscal")

_USER_ID = 1


def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


@fiscal_bp.route("/<int:portafolio_id>", methods=["GET"])
def tabla_fiscal(portafolio_id: int):
    """
    Tabla fiscal completa del portafolio.

    Columnas: Ticker, Ganancia Bruta, ISR Estimado, Ganancia Neta,
              Factor INPC, Ganancia Real (MXN constantes).
    """
    try:
        resultado = FiscalService.tabla_fiscal(portafolio_id, _USER_ID)
        return jsonify(resultado), 200
    except ValueError as e:
        return _error(str(e), 404)
    except Exception as e:
        logger.error(
            "Error al generar tabla fiscal para portafolio %d: %s",
            portafolio_id, str(e),
        )
        return _error("Error interno al generar la tabla fiscal.", 500)


@fiscal_bp.route("/inpc", methods=["GET"])
def obtener_inpc():
    """
    INPC mensual histórico almacenado en caché.

    Query params opcionales:
        anio (int): Filtrar por año.
        mes (int): Filtrar por mes (requiere anio).
    """
    anio = request.args.get("anio", type=int)
    mes = request.args.get("mes", type=int)

    try:
        if anio and mes:
            # Consultar un mes específico
            resultado = BanxicoService.obtener_inpc(anio, mes)
            return jsonify(resultado), 200

        # Devolver todo el historial en caché
        query = InpcCache.query.order_by(
            InpcCache.anio.desc(), InpcCache.mes.desc()
        )

        if anio:
            query = query.filter_by(anio=anio)

        registros = query.all()

        datos = [
            {
                "anio": r.anio,
                "mes": r.mes,
                "valor": float(r.valor),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in registros
        ]

        return jsonify({
            "inpc": datos,
            "total": len(datos),
            "consultado_at": datetime.now(timezone.utc).isoformat(),
        }), 200

    except Exception as e:
        logger.error("Error al obtener INPC: %s", str(e))
        return _error("Error interno al obtener datos de INPC.", 500)


@fiscal_bp.route("/tipo-cambio", methods=["GET"])
def obtener_tipo_cambio():
    """Tipo de cambio USD/MXN actual."""
    try:
        resultado = BanxicoService.obtener_tipo_cambio()
        return jsonify(resultado), 200
    except Exception as e:
        logger.error("Error al obtener tipo de cambio: %s", str(e))
        return _error("Error interno al obtener tipo de cambio.", 500)

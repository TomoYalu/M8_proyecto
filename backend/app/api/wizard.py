# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Wizard Ciclo Económico
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Blueprint REST para el Wizard de Ciclo Económico (Top-Down).

Endpoints:
    POST   /api/wizard/perfil              — Calcula perfil de riesgo
    GET    /api/wizard/ciclo               — Fase actual del ciclo económico
    GET    /api/wizard/sectores/<fase>     — Sectores favorecidos por fase
    GET    /api/wizard/fundamentales       — Tickers que pasan filtro fundamental
    GET    /api/wizard/tecnicos            — Tickers que pasan filtro técnico
    GET    /api/wizard/allocation/<perfil> — Asset allocation por perfil
    GET    /api/wizard/pool                — Pool final de tickers recomendados

Todos los mensajes de error en español.

Requisitos cubiertos: 7.1–7.7
"""

import logging

from flask import Blueprint, jsonify, request

from ..services.wizard_service import WizardService, UNIVERSO_TICKERS

logger = logging.getLogger(__name__)

wizard_bp = Blueprint("wizard", __name__, url_prefix="/api/wizard")

_service = WizardService()


# ── Helpers ──────────────────────────────────────────────────────

def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


# ── Endpoints ────────────────────────────────────────────────────

@wizard_bp.route("/perfil", methods=["POST"])
def calcular_perfil():
    """
    Calcula el perfil de riesgo a partir de las respuestas del cuestionario.

    Body JSON:
        respuestas (list[int]): Lista de 5 enteros (1-4 cada uno).

    Returns:
        JSON con perfil, puntaje y descripcion.
    """
    data = request.get_json(silent=True) or {}
    respuestas = data.get("respuestas")

    if respuestas is None:
        return _error("El campo 'respuestas' es requerido.", 400)

    try:
        resultado = _service.calcular_perfil(respuestas)
        return jsonify(resultado), 200
    except ValueError as e:
        return _error(str(e), 400)


@wizard_bp.route("/ciclo", methods=["GET"])
def obtener_ciclo():
    """
    Retorna la fase actual del ciclo económico con indicadores.

    Returns:
        JSON con fase, indicadores, fuente y fecha_actualizacion.
    """
    try:
        resultado = _service.obtener_ciclo()
        return jsonify(resultado), 200
    except Exception as e:
        logger.error("Error al obtener ciclo económico: %s", e)
        return _error(
            "Error al obtener datos del ciclo económico. "
            "Intente de nuevo más tarde.",
            500,
        )


@wizard_bp.route("/sectores/<fase>", methods=["GET"])
def obtener_sectores(fase: str):
    """
    Retorna los sectores favorecidos para una fase del ciclo.

    Args:
        fase: Fase del ciclo en la URL ('Early', 'Mid', 'Late', 'Recession').

    Returns:
        JSON con fase y lista de sectores con justificación y ETFs.
    """
    try:
        resultado = _service.obtener_sectores(fase)
        return jsonify(resultado), 200
    except ValueError as e:
        return _error(str(e), 400)


@wizard_bp.route("/fundamentales", methods=["GET"])
def filtrar_fundamentales():
    """
    Retorna tickers del universo curado que pasan el filtro fundamental.

    Query params:
        tickers (str, opcional): Lista de tickers separados por coma.
            Si no se proporciona, usa el universo curado por defecto.

    Returns:
        JSON con lista de tickers que pasan y sus métricas.
    """
    tickers_param = request.args.get("tickers", "").strip()
    if tickers_param:
        tickers = [t.strip().upper() for t in tickers_param.split(",") if t.strip()]
    else:
        tickers = UNIVERSO_TICKERS

    try:
        resultados = _service.filtrar_fundamentales(tickers)
        return jsonify({
            "total_evaluados": len(tickers),
            "total_aprobados": len(resultados),
            "tickers": resultados,
        }), 200
    except Exception as e:
        logger.error("Error en filtro fundamental: %s", e)
        return _error(
            "Error al aplicar filtro fundamental. "
            "Intente de nuevo más tarde.",
            500,
        )


@wizard_bp.route("/tecnicos", methods=["GET"])
def filtrar_tecnicos():
    """
    Retorna tickers que pasan el filtro técnico (SMA 200 + RSI 40-60).

    Query params:
        tickers (str, opcional): Lista de tickers separados por coma.
            Si no se proporciona, usa el universo curado por defecto.

    Returns:
        JSON con lista de tickers que pasan y sus métricas técnicas.
    """
    tickers_param = request.args.get("tickers", "").strip()
    if tickers_param:
        tickers = [t.strip().upper() for t in tickers_param.split(",") if t.strip()]
    else:
        tickers = UNIVERSO_TICKERS

    try:
        resultados = _service.filtrar_tecnicos(tickers)
        return jsonify({
            "total_evaluados": len(tickers),
            "total_aprobados": len(resultados),
            "tickers": resultados,
        }), 200
    except Exception as e:
        logger.error("Error en filtro técnico: %s", e)
        return _error(
            "Error al aplicar filtro técnico. "
            "Intente de nuevo más tarde.",
            500,
        )


@wizard_bp.route("/allocation/<perfil>", methods=["GET"])
def obtener_allocation(perfil: str):
    """
    Retorna el asset allocation recomendado por perfil de riesgo.

    Args:
        perfil: Nombre del perfil en la URL.

    Returns:
        JSON con perfil y lista de clases de activo con porcentaje y ETFs.
    """
    try:
        resultado = _service.obtener_allocation(perfil)
        return jsonify(resultado), 200
    except ValueError as e:
        return _error(str(e), 400)


@wizard_bp.route("/pool", methods=["GET"])
def obtener_pool():
    """
    Retorna el pool final de tickers recomendados.

    Ejecuta el pipeline completo:
        1. Obtener fase del ciclo
        2. Filtrar fundamentales del universo curado
        3. Filtrar técnicamente los que pasaron fundamentales

    Returns:
        JSON con fase del ciclo, sectores favorecidos y pool de tickers.
    """
    try:
        # Etapa 1: Ciclo económico
        ciclo = _service.obtener_ciclo()
        fase = ciclo["fase"]

        # Etapa 2: Sectores favorecidos
        sectores = _service.obtener_sectores(fase)

        # Etapa 3: Filtro fundamental
        fundamentales = _service.filtrar_fundamentales(UNIVERSO_TICKERS)
        tickers_fundamentales = [t["ticker"] for t in fundamentales]

        # Etapa 4: Filtro técnico
        tecnicos = _service.filtrar_tecnicos(tickers_fundamentales)

        return jsonify({
            "ciclo": ciclo,
            "sectores": sectores["sectores"],
            "fundamentales": {
                "total_evaluados": len(UNIVERSO_TICKERS),
                "total_aprobados": len(fundamentales),
                "tickers": fundamentales,
            },
            "pool": {
                "total": len(tecnicos),
                "tickers": tecnicos,
            },
        }), 200

    except Exception as e:
        logger.error("Error al generar pool de tickers: %s", e)
        return _error(
            "Error al generar el pool de tickers recomendados. "
            "Intente de nuevo más tarde.",
            500,
        )

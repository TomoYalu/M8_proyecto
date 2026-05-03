# Lakshmi Q2 - Gestión de Inversiones
# Módulo: General
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Blueprint REST para optimización de portafolios (Motor Markowitz).

Endpoints:
    POST /api/optimizador — Ejecuta optimización completa de Markowitz

Recibe tickers, inversión, tasa libre de riesgo, período y restricciones.
Opcionalmente acepta portafolio_id para comparar pesos actuales vs óptimos.

Todas las operaciones usan user_id=1 (modo single-user).
Mensajes de error en español.

Requisitos cubiertos: 2.1, 2.11, 3.1–3.8, 4.1–4.4
"""

import logging

from flask import Blueprint, jsonify, request, g

from ..services import optimizer_service, portfolio_service

optimizador_bp = Blueprint(
    "optimizador", __name__, url_prefix="/api/optimizador"
)

logger = logging.getLogger(__name__)

# ── user_id fijo (single-user) ──────────────────────────────────
# ── Períodos válidos ────────────────────────────────────────────
_PERIODOS_VALIDOS = {"1y", "3y", "5y", "10y"}


# ── Helpers ──────────────────────────────────────────────────────

def _error(mensaje: str, codigo: int):
    """Respuesta JSON de error con mensaje en español."""
    return jsonify({"error": mensaje}), codigo


# ── POST /api/optimizador ───────────────────────────────────────

@optimizador_bp.route("", methods=["POST"])
def optimizar():
    """
    Ejecuta la optimización Markowitz completa.

    Request Body:
        tickers: list[str]          — Símbolos bursátiles (2-15)
        inversion: float            — Monto de inversión en USD
        rf: float | null            — Tasa libre de riesgo (null = auto ^IRX)
        periodo: str                — "1y", "3y", "5y", "10y"
        min_peso: float | null      — Override peso mínimo (decimal)
        max_peso: float | null      — Override peso máximo (decimal)
        portafolio_id: int | null   — Optimizar portafolio existente
        max_peso_emisor: float      — Máximo por emisor (default 0.20)
        max_renta_variable: float   — Máximo renta variable (default 0.80)
        min_sectores: int           — Mínimo de sectores (default 3)

    Returns:
        200: Resultado completo de la optimización.
        400: Error de validación de entrada.
        404: Portafolio no encontrado o sin datos suficientes.
        422: Restricciones infactibles.
        503: Error al obtener datos de mercado.
    """
    data = request.get_json(silent=True) or {}

    tickers = data.get("tickers", [])
    inversion = data.get("inversion", 0)
    rf = data.get("rf")
    periodo = data.get("periodo", "5y")
    min_peso = data.get("min_peso")
    max_peso = data.get("max_peso")
    portafolio_id = data.get("portafolio_id")
    max_peso_emisor = data.get("max_peso_emisor", 0.20)
    max_renta_variable = data.get("max_renta_variable", 0.80)
    min_sectores = data.get("min_sectores", 3)

    # ── Validación de entrada ────────────────────────────────────

    # Si hay portafolio_id, extraer tickers de posiciones activas
    pesos_actuales_info = None
    if portafolio_id is not None:
        try:
            posiciones = portfolio_service.obtener_posiciones(
                portafolio_id, g.user_id
            )
        except ValueError as e:
            return _error(str(e), 404)

        posiciones_activas = [p for p in posiciones if p["cantidad"] > 0]
        if not posiciones_activas:
            return _error(
                "El portafolio no tiene posiciones activas para optimizar.",
                400,
            )

        # Extraer tickers del portafolio si no se proporcionaron
        if not tickers:
            tickers = [p["ticker"] for p in posiciones_activas]

        # Calcular pesos actuales basados en valor de mercado
        valor_total = sum(p["valor_mercado"] for p in posiciones_activas)
        if valor_total > 0:
            pesos_actuales = {
                p["ticker"]: round(p["valor_mercado"] / valor_total * 100, 2)
                for p in posiciones_activas
            }
        else:
            pesos_actuales = {
                p["ticker"]: 0.0 for p in posiciones_activas
            }

        # Usar valor total del portafolio como inversión por defecto
        if not inversion or inversion <= 0:
            inversion = valor_total if valor_total > 0 else 0

        pesos_actuales_info = pesos_actuales

    # Validar tickers
    if not isinstance(tickers, list) or len(tickers) < 2:
        return _error(
            "Se necesitan al menos 2 tickers para la optimización.", 400
        )
    if len(tickers) > 15:
        return _error("Máximo 15 tickers permitidos.", 400)

    # Validar período
    if periodo not in _PERIODOS_VALIDOS:
        return _error(
            f"Período inválido. Valores válidos: {', '.join(sorted(_PERIODOS_VALIDOS))}.",
            400,
        )

    # Validar capital
    try:
        inversion = float(inversion)
    except (TypeError, ValueError):
        return _error("El capital de inversión debe ser un número válido.", 400)

    if inversion <= 0:
        return _error("El capital de inversión debe ser mayor a cero.", 400)

    # ── Construir parámetros para el servicio ────────────────────
    params = {
        "tickers": [t.upper().strip() for t in tickers],
        "inversion": inversion,
        "rf": rf,
        "periodo": periodo,
        "min_peso": min_peso,
        "max_peso": max_peso,
        "max_peso_emisor": max_peso_emisor,
        "max_renta_variable": max_renta_variable,
        "min_sectores": min_sectores,
    }

    # ── Ejecutar optimización ────────────────────────────────────
    try:
        resultado = optimizer_service.optimizar(params)
    except ValueError as e:
        msg = str(e)
        if "No se encontraron datos suficientes" in msg:
            return _error(msg, 404)
        if "infactible" in msg.lower():
            return _error(msg, 422)
        return _error(msg, 400)
    except Exception as e:
        logger.exception("Error inesperado en optimización: %s", str(e))
        return _error(
            "Error al obtener datos de mercado. Intente nuevamente.", 503
        )

    # ── Agregar pesos actuales si se optimizó un portafolio ──────
    if pesos_actuales_info is not None:
        tickers_resultado = resultado.get("tickers", [])
        # Calcular diferencia entre pesos óptimos y actuales
        pesos_max_sharpe = resultado.get("max_sharpe", {}).get("pesos", {})
        diferencia = {}
        for t in tickers_resultado:
            peso_optimo = pesos_max_sharpe.get(t, 0.0)
            peso_actual = pesos_actuales_info.get(t, 0.0)
            diferencia[t] = round(peso_optimo - peso_actual, 2)

        resultado["pesos_actuales"] = {
            "pesos_actuales": pesos_actuales_info,
            "diferencia": diferencia,
        }

    return jsonify(resultado), 200

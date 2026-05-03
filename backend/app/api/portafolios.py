# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Portafolios
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
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

from flask import Blueprint, jsonify, request, g

from ..services import portfolio_service as svc

portafolios_bp = Blueprint(
    "portafolios", __name__, url_prefix="/api/portafolios"
)

# ── user_id fijo (single-user, Req 11.2) ────────────────────────
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
    portafolios = svc.listar_portafolios(g.user_id)
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
        resultado = svc.crear_portafolio(g.user_id, nombre, descripcion, moneda=moneda, capital_inicial=capital_inicial)
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
    resultado = svc.vista_consolidada(g.user_id)
    return jsonify(resultado), 200


# ── Detalle, actualización y eliminación de portafolio ───────────

@portafolios_bp.route("/<int:portafolio_id>", methods=["GET"])
def obtener_portafolio(portafolio_id: int):
    """Detalle de un portafolio con sus posiciones."""
    try:
        resultado = svc.obtener_portafolio(portafolio_id, g.user_id)
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
            portafolio_id, g.user_id, nombre=nombre, descripcion=descripcion,
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
        resultado = svc.eliminar_portafolio(portafolio_id, g.user_id)
    except ValueError as e:
        return _error(str(e), 404)

    return jsonify(resultado), 200


# ── Posiciones ───────────────────────────────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/posiciones", methods=["GET"])
def obtener_posiciones(portafolio_id: int):
    """Lista posiciones del portafolio con precios actuales y P&L."""
    try:
        resultado = svc.obtener_posiciones(portafolio_id, g.user_id)
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
            portafolio_id, g.user_id, posicion_id, cantidad_deseada
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
            portafolio_id, g.user_id, page=page, per_page=per_page
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
            user_id=g.user_id,
            ticker=data["ticker"],
            tipo=data["tipo"],
            fecha=fecha,
            precio_unitario=data["precio_unitario"],
            cantidad=data["cantidad"],
            comision=data.get("comision", 0),
            moneda=data.get("moneda", "USD"),
            notas=data.get("notas"),
            estado=data.get("estado", "confirmada"),
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
            portafolio_id, g.user_id, transaccion_id
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
            portafolio_id, g.user_id, transaccion_id
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
        resultado = svc.refrescar_precios(portafolio_id, g.user_id)
    except ValueError as e:
        return _error(str(e), 404)
    return jsonify(resultado), 200


# ── Valor histórico del portafolio ───────────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/historico", methods=["GET"])
def obtener_historico(portafolio_id: int):
    """Valor histórico del portafolio para sparkline."""
    rango = request.args.get("rango", "30d")
    try:
        resultado = svc.obtener_historico(portafolio_id, g.user_id, rango)
    except ValueError as e:
        return _error(str(e), 404)
    return jsonify(resultado), 200

@portafolios_bp.route("/<int:portafolio_id>/aplicar-optimizacion", methods=["POST"])
def aplicar_optimizacion(portafolio_id):
    """
    Aplica los pesos óptimos al portafolio creando transacciones pendientes.
    Compara pesos actuales vs óptimos y genera compras/ventas para ajustar.

    Body: { acciones: { ticker: { cantidad_objetivo: int, cantidad_actual: int, precio: float } } }
    """
    from ..services import portfolio_service as svc
    from datetime import date

    data = request.get_json(silent=True) or {}
    acciones = data.get("acciones", {})

    if not acciones:
        return jsonify({"error": "No se proporcionaron acciones para aplicar."}), 400

    resultados = []
    hoy = date.today()

    for ticker, info in acciones.items():
        objetivo = int(info.get("cantidad_objetivo", 0))
        actual = int(info.get("cantidad_actual", 0))
        precio = float(info.get("precio", 0))
        diff = objetivo - actual

        if diff == 0 or precio <= 0:
            continue

        tipo = "compra" if diff > 0 else "venta"
        cantidad = abs(diff)

        try:
            tx = svc.registrar_transaccion(
                portafolio_id, g.user_id, ticker, tipo, hoy,
                precio, cantidad, 0,
                info.get("moneda", "USD"),
                notas=f"Ajuste de optimización: {actual} → {objetivo}",
                estado="pendiente",
            )
            resultados.append(tx)
        except ValueError as e:
            resultados.append({"ticker": ticker, "error": str(e)})

    return jsonify({
        "mensaje": f"{len(resultados)} transacciones pendientes creadas.",
        "transacciones": resultados,
    }), 201

@portafolios_bp.route("/seed-demo", methods=["GET"])
def check_demo():
    """Verifica si el modo demo está habilitado."""
    import os as _os
    if _os.environ.get("LAKSHMI_DEMO") == "1":
        return jsonify({"demo": True}), 200
    return jsonify({"demo": False}), 403

@portafolios_bp.route("/seed-demo", methods=["POST"])
def seed_demo():
    """Crea un portafolio demo con activos de prueba."""
    from ..services import portfolio_service as svc
    from ..models.configuracion import ConfiguracionUsuario
    from ..extensions import db
    from datetime import date
    from decimal import Decimal

    user_id = g.user_id

    # Configurar capital global si es 0
    config = ConfiguracionUsuario.query.filter_by(user_id=user_id).first()
    if not config:
        config = ConfiguracionUsuario(user_id=user_id, capital_global=50000, moneda_base="MXN")
        db.session.add(config)
    elif float(config.capital_global) <= 0:
        config.capital_global = Decimal("50000")
    db.session.commit()

    # Crear portafolio demo
    try:
        p = svc.crear_portafolio(user_id, "Demo", capital_inicial=0)
    except ValueError:
        from ..models.portafolio import Portafolio
        p_obj = Portafolio.query.filter_by(user_id=user_id, nombre="Demo").first()
        if p_obj:
            return jsonify({"mensaje": "Portafolio Demo ya existe.", "id": p_obj.id}), 200
        raise

    pid = p["id"]
    hoy = date.today()

    from datetime import timedelta
    activos = [
        ("AAPL", 10, "USD", 90),
        ("GLD", 5, "USD", 60),
        ("MSFT", 8, "USD", 45),
        ("PG", 15, "USD", 30),
    ]

    for ticker, cantidad, moneda, dias_atras in activos:
        fecha_compra = hoy - timedelta(days=dias_atras)
        # Ajustar a día hábil (lun-vie)
        while fecha_compra.weekday() >= 5:
            fecha_compra -= timedelta(days=1)
        try:
            from ..services.yfinance_service import obtener_precio_cierre_historico
            datos = obtener_precio_cierre_historico(ticker, fecha_compra)
            precio = datos["precio_cierre"]
        except Exception:
            precio = 100  # fallback

        svc.registrar_transaccion(
            pid, user_id, ticker, "compra", fecha_compra,
            precio, cantidad, 0, moneda, estado="confirmada",
        )

    # Refrescar precios
    svc.refrescar_precios(pid, user_id)

    return jsonify({
        "mensaje": f"Portafolio Demo creado con {len(activos)} activos.",
        "id": pid,
    }), 201



@portafolios_bp.route("/<int:portafolio_id>/proyeccion", methods=["GET"])
def proyeccion_portafolio(portafolio_id: int):
    """
    Proyección Monte Carlo del valor del portafolio.

    Query params:
        horizonte: 6m | 1y (default) | 2y | 5y
        n_sims: número de simulaciones (default 500)

    Returns:
        fechas, percentiles p10/p50/p90, valor_actual,
        rendimiento_anual, volatilidad_anual
    """
    horizonte = request.args.get("horizonte", "1y")
    n_sims = min(int(request.args.get("n_sims", 500)), 2000)

    try:
        resultado = svc.proyeccion_monte_carlo(portafolio_id, g.user_id, horizonte, n_sims)
    except ValueError as e:
        return _error(str(e), 400)
    except Exception as e:
        return _error(f"Error al calcular proyección: {str(e)}", 500)
    return jsonify(resultado), 200


# ── Dashboard analítico del portafolio ───────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/dashboard", methods=["GET"])
def dashboard_portafolio(portafolio_id: int):
    """
    Métricas analíticas del portafolio con pesos actuales.

    Retorna: correlación, métricas de riesgo, contribución al riesgo,
    crecimiento de $1, drawdown, y resumen técnico por ticker.
    """
    import numpy as np
    import pandas as pd
    import yfinance as yf
    import datetime
    from scipy.stats import norm
    from ..services.ta_service import TAService
    from ..services import yfinance_service

    try:
        posiciones = svc.obtener_posiciones(portafolio_id, g.user_id)
    except ValueError as e:
        return _error(str(e), 404)

    activas = [p for p in posiciones if p.get("cantidad", 0) > 0 and p.get("precio_actual", 0) > 0]
    if len(activas) < 2:
        return _error("Se requieren al menos 2 posiciones activas.", 400)

    tickers = [p["ticker"] for p in activas]
    valores = [p.get("valor_mercado") or p["precio_actual"] * p["cantidad"] for p in activas]
    valor_total = sum(valores)
    pesos_actuales = np.array([v / valor_total for v in valores]) if valor_total > 0 else np.ones(len(tickers)) / len(tickers)

    # Descargar precios mensuales 5 años
    fin = datetime.date.today()
    inicio = fin - datetime.timedelta(days=5 * 365)
    periodos_anio = 12

    try:
        precios = yf.download(tickers, start=inicio, end=fin, interval="1mo", auto_adjust=True, progress=False)["Close"]
    except Exception as e:
        return _error(f"Error descargando datos: {e}", 500)

    if isinstance(precios, pd.Series):
        precios = precios.to_frame(tickers[0])
    if isinstance(precios.columns, pd.MultiIndex):
        precios.columns = precios.columns.get_level_values(0)

    precios = precios.dropna(axis=1, how="all").dropna()
    tickers_ok = [t for t in tickers if t in precios.columns]

    if len(tickers_ok) < 2:
        return _error("Datos insuficientes para al menos 2 tickers.", 404)

    # Recalcular pesos solo para tickers con datos
    idx_ok = [tickers.index(t) for t in tickers_ok]
    w = np.array([pesos_actuales[i] for i in idx_ok])
    w = w / w.sum()  # renormalizar

    rendimientos = np.log(precios[tickers_ok] / precios[tickers_ok].shift(1)).dropna()
    rend_esp = rendimientos.mean().values
    cov_matrix = rendimientos.cov().values
    corr_matrix = rendimientos.corr()

    # Métricas del portafolio actual
    rp = float(np.dot(w, rend_esp) * periodos_anio)
    sp = float(np.sqrt(np.dot(w, np.dot(cov_matrix * periodos_anio, w))))
    rf = 0.04
    sharpe = float((rp - rf) / sp) if sp > 0 else 0.0

    # Sortino
    port_ret = rendimientos.values.dot(w)
    ds = port_ret[port_ret < 0].std() * np.sqrt(periodos_anio)
    sortino = float((rp - rf) / ds) if ds > 0 else 0.0

    # Beta vs SPY
    beta = 0.0
    try:
        spy = yf.download("SPY", start=inicio, end=fin, interval="1mo", auto_adjust=True, progress=False)["Close"]
        spy_r = np.log(spy / spy.shift(1)).dropna()
        common = rendimientos.index.intersection(spy_r.index)
        if len(common) > 2:
            spy_vals = spy_r.loc[common].values.flatten()
            pr = rendimientos.loc[common].values.dot(w)
            var_spy = np.var(spy_vals)
            if var_spy > 0:
                beta = float(np.cov(pr, spy_vals)[0, 1] / var_spy)
    except Exception:
        pass

    # VaR 99%
    z99 = norm.ppf(0.99)
    var_m = -(np.dot(w, rend_esp) - z99 * np.sqrt(np.dot(w, np.dot(cov_matrix, w))))
    var_info = {
        "diario": round(float(var_m / np.sqrt(21) * 100), 4),
        "mensual": round(float(var_m * 100), 4),
        "anual": round(float(var_m * np.sqrt(12) * 100), 4),
        "diario_usd": round(float(var_m / np.sqrt(21) * valor_total), 0),
        "mensual_usd": round(float(var_m * valor_total), 0),
        "anual_usd": round(float(var_m * np.sqrt(12) * valor_total), 0),
    }

    # Max drawdown
    pn = (precios[tickers_ok] / precios[tickers_ok].iloc[0]).values.dot(w)
    cummax = np.maximum.accumulate(pn)
    dd = pn / cummax - 1
    max_drawdown = float(dd.min())

    # Risk contribution
    ca = cov_matrix * periodos_anio
    rc = w * np.dot(ca, w) / sp if sp > 0 else np.zeros(len(w))
    rc_total = rc.sum()
    rc_norm = rc / rc_total if rc_total > 0 else rc

    # Crecimiento de $1 y drawdown series
    fechas_hist = [d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d) for d in (precios[tickers_ok] / precios[tickers_ok].iloc[0]).index]
    crecimiento = [round(float(v), 4) for v in pn]
    drawdown_series = [round(float(v * 100), 2) for v in dd]

    # Correlación
    correlacion = {t: {t2: round(float(corr_matrix.loc[t, t2]), 4) for t2 in tickers_ok} for t in tickers_ok}

    # Resumen técnico por ticker
    ta = TAService()
    resumen_tecnico = []
    for ticker in tickers_ok:
        try:
            df = yfinance_service.obtener_datos_historicos(ticker, "6mo", "1d")
            ind = ta.calcular_todos(df)
            # calcular_todos returns lists; get last non-None value
            def _last(lst):
                if not isinstance(lst, list) or not lst:
                    return None
                for v in reversed(lst):
                    if v is not None:
                        return v
                return None

            rsi = _last(ind.get("rsi"))
            macd_hist = _last(ind.get("macd", {}).get("histograma"))
            sma50 = _last(ind.get("sma50"))
            sma200 = _last(ind.get("sma200"))
            precio = round(float(df["Close"].iloc[-1]), 2)

            # Señal simple
            señales = []
            if rsi is not None:
                if rsi > 70: señales.append("RSI sobrecompra")
                elif rsi < 30: señales.append("RSI sobreventa")
            if macd_hist is not None:
                if macd_hist > 0: señales.append("MACD alcista")
                else: señales.append("MACD bajista")
            if sma50 is not None and sma200 is not None:
                if sma50 > sma200: señales.append("Golden Cross")
                else: señales.append("Death Cross")

            tendencia = "neutral"
            if any("alcista" in s or "Golden" in s for s in señales):
                tendencia = "alcista"
            if any("bajista" in s or "Death" in s or "sobrecompra" in s for s in señales):
                tendencia = "bajista" if tendencia != "alcista" else "mixta"

            resumen_tecnico.append({
                "ticker": ticker,
                "precio": precio,
                "rsi": round(float(rsi), 2) if rsi is not None else None,
                "macd_histograma": round(float(macd_hist), 4) if macd_hist is not None else None,
                "sma50": round(float(sma50), 2) if sma50 is not None else None,
                "sma200": round(float(sma200), 2) if sma200 is not None else None,
                "señales": señales,
                "tendencia": tendencia,
            })
        except Exception as e:
            resumen_tecnico.append({"ticker": ticker, "error": str(e)})

    # TWR (Time-Weighted Return) — rendimiento real sin efecto de flujos
    twr_data = None
    try:
        from ..models.portafolio import Transaccion
        from datetime import timedelta
        from collections import defaultdict

        txs = (Transaccion.query
               .filter_by(portafolio_id=portafolio_id)
               .order_by(Transaccion.fecha.asc())
               .all())

        if txs:
            hoy = datetime.date.today()
            primera_fecha = txs[0].fecha if isinstance(txs[0].fecha, datetime.date) else txs[0].fecha.date()
            dias_total = (hoy - primera_fecha).days

            # Obtener precios diarios para todos los tickers
            precios_diarios = {}
            periodo_d = "1mo" if dias_total <= 30 else "3mo" if dias_total <= 90 else "1y" if dias_total <= 365 else "5y"
            for ticker in tickers_ok:
                try:
                    df_d = yfinance_service.obtener_datos_historicos(ticker, periodo_d, "1d")
                    precios_diarios[ticker] = {
                        (idx.date() if hasattr(idx, 'date') else idx): float(row["Close"])
                        for idx, row in df_d.iterrows()
                    }
                except Exception:
                    pass

            # Reconstruir posiciones y calcular TWR
            posiciones_acc = defaultdict(float)
            tx_idx = 0
            twr_total = 1.0
            prev_valor = None
            twr_fechas = []
            twr_valores = []

            fecha_iter = primera_fecha
            while fecha_iter <= hoy:
                # Aplicar transacciones del día
                flujo_dia = 0.0
                while tx_idx < len(txs):
                    tx = txs[tx_idx]
                    tx_f = tx.fecha if isinstance(tx.fecha, datetime.date) else tx.fecha.date()
                    if tx_f > fecha_iter:
                        break
                    tipo = tx.tipo.lower()
                    cant = float(tx.cantidad)
                    precio_tx = float(tx.precio_unitario)
                    if tipo == "compra":
                        posiciones_acc[tx.ticker] += cant
                        flujo_dia += cant * precio_tx
                    elif tipo == "venta":
                        posiciones_acc[tx.ticker] -= cant
                        flujo_dia -= cant * precio_tx
                    tx_idx += 1

                # Calcular valor del portafolio hoy
                def _precio_dia(tk, f):
                    pd_tk = precios_diarios.get(tk, {})
                    for delta in range(8):
                        p = pd_tk.get(f - timedelta(days=delta))
                        if p: return p
                    return None

                valor_hoy = 0.0
                tiene = False
                for tk, cant in posiciones_acc.items():
                    if cant <= 0: continue
                    p = _precio_dia(tk, fecha_iter)
                    if p:
                        valor_hoy += cant * p
                        tiene = True

                if tiene and valor_hoy > 0:
                    if prev_valor is not None and prev_valor > 0:
                        # TWR: rendimiento del período = (V_end - flujo) / V_start
                        r_periodo = (valor_hoy - flujo_dia) / prev_valor - 1
                        twr_total *= (1 + r_periodo)
                    prev_valor = valor_hoy
                    twr_fechas.append(fecha_iter.isoformat())
                    twr_valores.append(round((twr_total - 1) * 100, 2))

                fecha_iter += timedelta(days=1)

            if twr_fechas:
                twr_data = {
                    "twr_total": round((twr_total - 1) * 100, 2),
                    "twr_anualizado": round(((twr_total ** (365 / max(dias_total, 1))) - 1) * 100, 2) if dias_total > 0 else 0,
                    "fechas": twr_fechas,
                    "valores": twr_valores,
                    "dias": dias_total,
                }
    except Exception as e:
        logger.warning("Error calculando TWR: %s", e)

    return jsonify({
        "tickers": tickers_ok,
        "pesos": {t: round(float(w[i] * 100), 2) for i, t in enumerate(tickers_ok)},
        "valor_total": round(valor_total, 2),
        "metricas": {
            "rendimiento": round(rp * 100, 2),
            "riesgo": round(sp * 100, 2),
            "sharpe": round(sharpe, 4),
            "sortino": round(sortino, 4),
            "beta": round(beta, 4),
            "max_drawdown": round(max_drawdown * 100, 2),
            "var": var_info,
        },
        "risk_contrib": {t: round(float(rc_norm[i] * 100), 2) for i, t in enumerate(tickers_ok)},
        "correlacion": correlacion,
        "historico": {
            "fechas": fechas_hist,
            "crecimiento": crecimiento,
            "drawdown": drawdown_series,
        },
        "twr": twr_data,
        "resumen_tecnico": resumen_tecnico,
    }), 200


# ── Backtesting ──────────────────────────────────────────────────

@portafolios_bp.route("/<int:portafolio_id>/backtest", methods=["POST"])
def backtest_portafolio(portafolio_id: int):
    """
    Backtesting: simula mantener los pesos actuales del portafolio
    con rebalanceo periódico sobre datos históricos.

    Body JSON (opcional):
        periodo: "1y" | "3y" | "5y" (default "3y")
        rebalanceo: "mensual" | "trimestral" | "anual" | "nunca" (default "trimestral")
        inversion_inicial: float (default 10000)

    Retorna: serie de valor, métricas de rendimiento, comparación vs SPY.
    """
    import numpy as np
    import pandas as pd
    import yfinance as yf
    import datetime

    data = request.get_json(silent=True) or {}
    periodo = data.get("periodo", "3y")
    rebalanceo = data.get("rebalanceo", "trimestral")
    inversion = float(data.get("inversion_inicial", 10000))

    try:
        posiciones = svc.obtener_posiciones(portafolio_id, g.user_id)
    except ValueError as e:
        return _error(str(e), 404)

    activas = [p for p in posiciones if p.get("cantidad", 0) > 0 and p.get("precio_actual", 0) > 0]
    if len(activas) < 1:
        return _error("Se requiere al menos 1 posición activa.", 400)

    tickers = [p["ticker"] for p in activas]
    valores = [p.get("valor_mercado") or p["precio_actual"] * p["cantidad"] for p in activas]
    valor_total = sum(valores)
    pesos_objetivo = np.array([v / valor_total for v in valores]) if valor_total > 0 else np.ones(len(tickers)) / len(tickers)

    # Período de datos
    periodos_map = {"1y": 365, "3y": 3 * 365, "5y": 5 * 365}
    dias = periodos_map.get(periodo, 3 * 365)
    fin = datetime.date.today()
    inicio = fin - datetime.timedelta(days=dias)

    # Descargar precios diarios
    try:
        precios = yf.download(tickers + ["SPY"], start=inicio, end=fin, interval="1d", auto_adjust=True, progress=False)["Close"]
    except Exception as e:
        return _error(f"Error descargando datos: {e}", 500)

    if isinstance(precios, pd.Series):
        precios = precios.to_frame(tickers[0])
    if isinstance(precios.columns, pd.MultiIndex):
        precios.columns = precios.columns.get_level_values(0)

    precios = precios.dropna()
    tickers_ok = [t for t in tickers if t in precios.columns]
    tiene_spy = "SPY" in precios.columns

    if len(tickers_ok) < 1:
        return _error("Datos insuficientes para backtesting.", 404)

    # Recalcular pesos para tickers disponibles
    idx_ok = [tickers.index(t) for t in tickers_ok]
    w = np.array([pesos_objetivo[i] for i in idx_ok])
    w = w / w.sum()

    # Frecuencia de rebalanceo
    reb_map = {"mensual": 21, "trimestral": 63, "anual": 252, "nunca": 999999}
    reb_dias = reb_map.get(rebalanceo, 63)

    # Simular
    n_dias = len(precios)
    precios_arr = precios[tickers_ok].values
    rendimientos = precios_arr[1:] / precios_arr[:-1] - 1

    # Portafolio con rebalanceo
    valor_port = [inversion]
    pesos_actuales = w.copy()
    dias_desde_reb = 0

    for i in range(len(rendimientos)):
        # Rendimiento del día con pesos actuales
        r_dia = np.dot(pesos_actuales, rendimientos[i])
        nuevo_valor = valor_port[-1] * (1 + r_dia)
        valor_port.append(nuevo_valor)

        # Actualizar pesos por drift
        valores_pos = pesos_actuales * (1 + rendimientos[i])
        total_pos = valores_pos.sum()
        pesos_actuales = valores_pos / total_pos if total_pos > 0 else w.copy()

        dias_desde_reb += 1
        if dias_desde_reb >= reb_dias:
            pesos_actuales = w.copy()
            dias_desde_reb = 0

    valor_port = np.array(valor_port)
    fechas = [d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d) for d in precios.index]

    # SPY benchmark
    spy_valores = None
    if tiene_spy:
        spy_precios = precios["SPY"].values
        spy_valores = (spy_precios / spy_precios[0] * inversion).tolist()

    # Métricas
    retornos_diarios = np.diff(valor_port) / valor_port[:-1]
    rend_total = (valor_port[-1] / valor_port[0] - 1) * 100
    rend_anual = ((valor_port[-1] / valor_port[0]) ** (252 / max(len(retornos_diarios), 1)) - 1) * 100
    vol_anual = float(np.std(retornos_diarios) * np.sqrt(252) * 100)
    sharpe = float((rend_anual - 4) / vol_anual) if vol_anual > 0 else 0

    # Max drawdown
    cummax = np.maximum.accumulate(valor_port)
    dd = valor_port / cummax - 1
    max_dd = float(dd.min() * 100)

    # SPY métricas
    spy_metricas = None
    if spy_valores:
        spy_arr = np.array(spy_valores)
        spy_ret = np.diff(spy_arr) / spy_arr[:-1]
        spy_rend_total = (spy_arr[-1] / spy_arr[0] - 1) * 100
        spy_rend_anual = ((spy_arr[-1] / spy_arr[0]) ** (252 / max(len(spy_ret), 1)) - 1) * 100
        spy_vol = float(np.std(spy_ret) * np.sqrt(252) * 100)
        spy_cummax = np.maximum.accumulate(spy_arr)
        spy_dd = float((spy_arr / spy_cummax - 1).min() * 100)
        spy_metricas = {
            "rendimiento_total": round(spy_rend_total, 2),
            "rendimiento_anual": round(spy_rend_anual, 2),
            "volatilidad": round(spy_vol, 2),
            "max_drawdown": round(spy_dd, 2),
        }

    return jsonify({
        "periodo": periodo,
        "rebalanceo": rebalanceo,
        "inversion_inicial": inversion,
        "tickers": tickers_ok,
        "pesos": {t: round(float(w[i] * 100), 2) for i, t in enumerate(tickers_ok)},
        "fechas": fechas,
        "valores": [round(float(v), 2) for v in valor_port],
        "spy": [round(float(v), 2) for v in spy_valores] if spy_valores else None,
        "metricas": {
            "valor_final": round(float(valor_port[-1]), 2),
            "rendimiento_total": round(rend_total, 2),
            "rendimiento_anual": round(rend_anual, 2),
            "volatilidad": round(vol_anual, 2),
            "sharpe": round(sharpe, 4),
            "max_drawdown": round(max_dd, 2),
        },
        "spy_metricas": spy_metricas,
    }), 200
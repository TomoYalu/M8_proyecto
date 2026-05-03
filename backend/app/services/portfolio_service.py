"""
Servicio de lógica de negocio para portafolios de inversión.

Implementa CRUD de portafolios, registro de transacciones (compra/venta/dividendo),
cálculo de precio promedio ponderado, P&L bruto/neto y vista consolidada.

Todas las operaciones financieras usan Decimal para precisión.
Mensajes de error en español.

Requisitos cubiertos: 1.1–1.5, 2.1–2.6, 3.1, 3.4
"""

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.portafolio import Portafolio, Posicion, Transaccion
from ..services import yfinance_service

logger = logging.getLogger(__name__)


# ── Tasa ISR sobre ganancias de capital (México) ─────────────────
_ISR_TASA = Decimal("0.10")


# ── Helpers internos ─────────────────────────────────────────────

def _dec(value) -> Decimal:
    """Convierte un valor a Decimal de forma segura."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _calcular_pnl_neto(pnl_bruto: Decimal) -> dict:
    """
    Calcula P&L neto aplicando ISR 10 % solo si hay ganancia.

    Returns:
        dict con claves ``isr`` y ``pnl_neto``.
    """
    if pnl_bruto > 0:
        isr = pnl_bruto * _ISR_TASA
    else:
        isr = Decimal("0")
    return {"isr": isr, "pnl_neto": pnl_bruto - isr}


# ── CRUD de portafolios ─────────────────────────────────────────

def crear_portafolio(user_id: int, nombre: str, descripcion: str = None, moneda: str = "MXN", capital_inicial: float = 0) -> dict:
    """
    Crea un nuevo portafolio con nombre único por usuario.

    Raises:
        ValueError: si el nombre está vacío o ya existe para el usuario.
    """
    if not nombre or not nombre.strip():
        raise ValueError("El nombre del portafolio no puede estar vacío.")

    nombre = nombre.strip()


    # Validar contra capital global
    cap = _dec(capital_inicial)
    if cap > 0:
        from ..models.configuracion import ConfiguracionUsuario
        config = ConfiguracionUsuario.query.filter_by(user_id=user_id).first()
        if config and _dec(config.capital_global) > 0:
            total_asignado = sum(
                _dec(p.capital_inicial)
                for p in Portafolio.query.filter_by(user_id=user_id).all()
            )
            disponible = _dec(config.capital_global) - total_asignado
            if cap > disponible:
                raise ValueError(
                    f"Capital excede el disponible global (${float(disponible):,.2f})."
                )

    portafolio = Portafolio(
        user_id=user_id,
        nombre=nombre,
        descripcion=descripcion,
        moneda=moneda,
        capital_inicial=_dec(capital_inicial),
    )
    try:
        db.session.add(portafolio)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValueError(
            f"Ya existe un portafolio con el nombre '{nombre}' para este usuario."
        )

    return _portafolio_to_dict(portafolio)


def listar_portafolios(user_id: int) -> list[dict]:
    """Devuelve todos los portafolios del usuario."""
    portafolios = Portafolio.query.filter_by(user_id=user_id).all()
    return [_portafolio_to_dict(p) for p in portafolios]


def obtener_portafolio(portafolio_id: int, user_id: int) -> dict:
    """
    Devuelve el detalle de un portafolio con sus posiciones.

    Raises:
        ValueError: si el portafolio no existe o no pertenece al usuario.
    """
    portafolio = _get_portafolio(portafolio_id, user_id)
    data = _portafolio_to_dict(portafolio)
    data["posiciones"] = _posiciones_con_pnl(portafolio)
    return data


def actualizar_portafolio(
    portafolio_id: int, user_id: int, nombre: str = None, descripcion: str = None, capital_inicial=None
) -> dict:
    """
    Actualiza nombre, descripción y/o capital inicial de un portafolio.

    Raises:
        ValueError: si el nombre está vacío, duplicado o el portafolio no existe.
    """
    portafolio = _get_portafolio(portafolio_id, user_id)

    if nombre is not None:
        if not nombre or not nombre.strip():
            raise ValueError("El nombre del portafolio no puede estar vacío.")
        portafolio.nombre = nombre.strip()

    if descripcion is not None:
        portafolio.descripcion = descripcion

    if capital_inicial is not None:
        nuevo_capital = _dec(capital_inicial)
        # Validar que el nuevo capital no sea menor al valor invertido
        posiciones = portafolio.posiciones.all()
        valor_invertido = sum(
            _dec(pos.costo_total) for pos in posiciones if _dec(pos.cantidad) > 0
        )
        if nuevo_capital < valor_invertido:
            raise ValueError(
                f"El capital inicial no puede ser menor al valor invertido "
                f"(${float(valor_invertido):,.2f})"
            )
        portafolio.capital_inicial = nuevo_capital
        # Validar que no exceda capital global disponible
        from ..models.configuracion import ConfiguracionUsuario
        config = ConfiguracionUsuario.query.filter_by(user_id=user_id).first()
        if config and _dec(config.capital_global) > 0:
            otros = sum(
                _dec(p.capital_inicial)
                for p in Portafolio.query.filter_by(user_id=user_id).all()
                if p.id != portafolio_id
            )
            max_permitido = _dec(config.capital_global) - otros
            if nuevo_capital > max_permitido:
                raise ValueError(
                    f"Capital excede el disponible global (${float(max_permitido):,.2f})."
                )


    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValueError(
            f"Ya existe un portafolio con el nombre '{nombre.strip()}' para este usuario."
        )

    return _portafolio_to_dict(portafolio)


def eliminar_portafolio(portafolio_id: int, user_id: int) -> dict:
    """
    Elimina un portafolio y todas sus posiciones/transacciones en cascada.

    Raises:
        ValueError: si el portafolio no existe o no pertenece al usuario.
    """
    portafolio = _get_portafolio(portafolio_id, user_id)
    nombre = portafolio.nombre
    db.session.delete(portafolio)
    db.session.commit()
    return {"mensaje": f"Portafolio '{nombre}' eliminado correctamente."}


# ── Vista consolidada ────────────────────────────────────────────

def vista_consolidada(user_id: int) -> dict:
    """
    Devuelve la vista agregada de todos los portafolios del usuario:
    valor total, P&L bruto total y P&L neto total.
    """
    portafolios = Portafolio.query.filter_by(user_id=user_id).all()

    valor_total = Decimal("0")
    pnl_bruto_total = Decimal("0")
    resumen_portafolios = []

    for p in portafolios:
        posiciones = p.posiciones.all()
        valor_p = Decimal("0")
        pnl_p = Decimal("0")
        costo_p = Decimal("0")

        for pos in posiciones:
            cantidad = _dec(pos.cantidad)
            if cantidad <= 0:
                continue
            precio_actual = _dec(pos.precio_actual)
            precio_promedio = _dec(pos.precio_promedio)

            # Si precio_actual es 0 o None, excluir del cálculo de P&L
            if precio_actual <= 0:
                costo_p += _dec(pos.costo_total)
                continue

            costo_p += _dec(pos.costo_total)
            valor_mercado = precio_actual * cantidad
            pnl = (precio_actual - precio_promedio) * cantidad

            valor_p += valor_mercado
            pnl_p += pnl

        neto = _calcular_pnl_neto(pnl_p)
        valor_total += valor_p
        pnl_bruto_total += pnl_p

        resumen_portafolios.append({
            "id": p.id,
            "nombre": p.nombre,
            "moneda": p.moneda,
            "valor_total": float(valor_p),
            "costo_total": float(costo_p),
            "capital_inicial": float(_dec(p.capital_inicial)),
            "capital_disponible": float(_dec(p.capital_inicial) - costo_p),
            "pnl_bruto": float(pnl_p),
            "pnl_neto": float(neto["pnl_neto"]),
            "isr_estimado": float(neto["isr"]),
        })

    neto_total = _calcular_pnl_neto(pnl_bruto_total)

    # Capital global
    from ..models.configuracion import ConfiguracionUsuario
    config = ConfiguracionUsuario.query.filter_by(user_id=user_id).first()
    capital_global = float(_dec(config.capital_global)) if config else 0
    total_asignado = sum(float(_dec(p.capital_inicial)) for p in portafolios)
    capital_no_asignado = capital_global - total_asignado


    return {
        "valor_total": float(valor_total),
        "pnl_bruto": float(pnl_bruto_total),
        "pnl_neto": float(neto_total["pnl_neto"]),
        "isr_estimado": float(neto_total["isr"]),
        "capital_global": capital_global,
        "capital_no_asignado": capital_no_asignado,
        "moneda_base": config.moneda_base if config else "MXN",
        "portafolios": resumen_portafolios,
    }


# ── Transacciones ────────────────────────────────────────────────

def registrar_transaccion(
    portafolio_id: int,
    user_id: int,
    ticker: str,
    tipo: str,
    fecha,
    precio_unitario,
    cantidad,
    comision=0,
    moneda: str = "USD",
    notas: str = None,
    estado: str = "confirmada",
) -> dict:
    """
    Registra una transacción de compra, venta o dividendo.

    - **compra**: crea o actualiza posición con precio promedio ponderado.
    - **venta**: reduce cantidad; rechaza si excede disponible.
    - **dividendo**: acumula en dividendos_acumulados sin modificar cantidad.

    Raises:
        ValueError: si el tipo es inválido o la venta excede la cantidad disponible.
    """
    _get_portafolio(portafolio_id, user_id)

    tipo = tipo.lower().strip()
    if tipo not in ("compra", "venta", "dividendo"):
        raise ValueError(
            f"Tipo de transacción inválido: '{tipo}'. "
            "Debe ser 'compra', 'venta' o 'dividendo'."
        )

    precio_unitario = _dec(precio_unitario)
    cantidad = _dec(cantidad)
    comision = _dec(comision)

    if cantidad < 0:
        raise ValueError("La cantidad no puede ser negativa.")
    if precio_unitario < 0:
        raise ValueError("El precio unitario no puede ser negativo.")

    # Buscar o crear posición
    posicion = Posicion.query.filter_by(
        portafolio_id=portafolio_id, ticker=ticker
    ).first()

    ganancia_perdida = None

    # Auto-pending: verificar capital disponible (local o global)
    if tipo == "compra":
        portafolio = _get_portafolio(portafolio_id, user_id)
        cap_inicial = _dec(portafolio.capital_inicial)
        costo_tx = precio_unitario * cantidad

        if cap_inicial > 0:
            # Portafolio con límite local
            posiciones_all = portafolio.posiciones.all()
            invertido = sum(
                _dec(p.costo_total) for p in posiciones_all if _dec(p.cantidad) > 0
            )
            disponible = cap_inicial - invertido
        else:
            # Portafolio sin límite: usar capital global
            from ..models.configuracion import ConfiguracionUsuario
            config = ConfiguracionUsuario.query.filter_by(user_id=user_id).first()
            capital_global = _dec(config.capital_global) if config else Decimal("0")
            if capital_global <= 0:
                disponible = Decimal("0")
            else:
                # Total invertido en TODOS los portafolios
                todos_port = Portafolio.query.filter_by(user_id=user_id).all()
                total_invertido = Decimal("0")
                for p in todos_port:
                    for pos in p.posiciones.all():
                        if _dec(pos.cantidad) > 0:
                            total_invertido += _dec(pos.costo_total)
                disponible = capital_global - total_invertido

        if costo_tx > disponible:
            estado = "pendiente"
            notas_prefix = "Marcada como pendiente: capital insuficiente"
            notas = f"{notas_prefix}. {notas}" if notas else notas_prefix

    if tipo == "compra":
        posicion, ganancia_perdida = _procesar_compra(
            posicion, portafolio_id, user_id, ticker, precio_unitario, cantidad, moneda
        )
    elif tipo == "venta":
        posicion, ganancia_perdida = _procesar_venta(
            posicion, ticker, precio_unitario, cantidad
        )
    elif tipo == "dividendo":
        posicion = _procesar_dividendo(
            posicion, portafolio_id, user_id, ticker, precio_unitario, cantidad, moneda
        )

    # Registrar transacción
    transaccion = Transaccion(
        user_id=user_id,
        portafolio_id=portafolio_id,
        ticker=ticker,
        tipo=tipo,
        fecha=fecha,
        precio_unitario=precio_unitario,
        cantidad=cantidad,
        comision=comision,
        moneda=moneda,
        ganancia_perdida=ganancia_perdida,
        notas=notas,
        estado=estado,
    )
    db.session.add(transaccion)
    db.session.commit()

    return _transaccion_to_dict(transaccion)


def listar_transacciones(
    portafolio_id: int, user_id: int, page: int = 1, per_page: int = 50
) -> dict:
    """
    Devuelve el historial de transacciones paginado, ordenado por fecha descendente.
    """
    _get_portafolio(portafolio_id, user_id)

    paginacion = (
        Transaccion.query
        .filter_by(portafolio_id=portafolio_id)
        .order_by(Transaccion.fecha.desc(), Transaccion.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return {
        "transacciones": [_transaccion_to_dict(t) for t in paginacion.items],
        "total": paginacion.total,
        "pagina": paginacion.page,
        "por_pagina": paginacion.per_page,
        "paginas": paginacion.pages,
    }


# ── Posiciones ───────────────────────────────────────────────────

def obtener_posiciones(portafolio_id: int, user_id: int) -> list[dict]:
    """
    Devuelve las posiciones del portafolio con precios actuales y P&L.
    """
    portafolio = _get_portafolio(portafolio_id, user_id)
    return _posiciones_con_pnl(portafolio)


def actualizar_posicion(
    portafolio_id: int, user_id: int, posicion_id: int, cantidad_deseada
) -> dict:
    """
    Actualiza la cantidad de una posición creando una transacción pendiente.

    - Si cantidad_deseada > actual → crea transacción de compra con estado='pendiente'
    - Si cantidad_deseada < actual → crea transacción de venta con estado='pendiente'
    - Si cantidad_deseada == actual → no-op, retorna posición sin cambios

    La posición se actualiza inmediatamente; el estado 'pendiente' es para
    seguimiento del usuario.

    Raises:
        ValueError: si la posición no existe o no pertenece al portafolio.
    """
    portafolio = _get_portafolio(portafolio_id, user_id)
    posicion = Posicion.query.filter_by(
        id=posicion_id, portafolio_id=portafolio_id
    ).first()

    if posicion is None:
        raise ValueError(
            f"No se encontró la posición con id {posicion_id} en este portafolio."
        )

    cantidad_deseada = _dec(cantidad_deseada)
    cantidad_actual = _dec(posicion.cantidad)
    diff = cantidad_deseada - cantidad_actual

    if diff == 0:
        # No-op: return current position
        posiciones = _posiciones_con_pnl(portafolio)
        for p in posiciones:
            if p["id"] == posicion_id:
                return p
        return {}

    precio_actual = _dec(posicion.precio_actual) if posicion.precio_actual else _dec(posicion.precio_promedio)
    if precio_actual <= 0:
        precio_actual = _dec(posicion.precio_promedio)

    if diff > 0:
        # Compra
        tipo = "compra"
        cantidad_tx = diff
    else:
        # Venta
        tipo = "venta"
        cantidad_tx = abs(diff)

    tx = registrar_transaccion(
        portafolio_id=portafolio_id,
        user_id=user_id,
        ticker=posicion.ticker,
        tipo=tipo,
        fecha=date.today(),
        precio_unitario=precio_actual,
        cantidad=cantidad_tx,
        comision=0,
        moneda=posicion.moneda,
        notas=f"Ajuste de posición: {float(cantidad_actual)} → {float(cantidad_deseada)}",
        estado="pendiente",
    )

    posiciones = _posiciones_con_pnl(portafolio)
    for p in posiciones:
        if p["id"] == posicion_id:
            return p
    return {}


def confirmar_transaccion(
    portafolio_id: int, user_id: int, transaccion_id: int
) -> dict:
    """
    Confirma una transacción pendiente cambiando su estado a 'confirmada'.

    Raises:
        ValueError: si la transacción no existe o no está pendiente.
    """
    _get_portafolio(portafolio_id, user_id)
    transaccion = Transaccion.query.filter_by(
        id=transaccion_id, portafolio_id=portafolio_id
    ).first()

    if transaccion is None:
        raise ValueError(
            f"No se encontró la transacción con id {transaccion_id} en este portafolio."
        )

    if transaccion.estado != "pendiente":
        raise ValueError(
            "Solo se pueden confirmar transacciones con estado 'pendiente'."
        )


    # Validar capital disponible para compras (local o global)
    if transaccion.tipo == "compra":
        portafolio = _get_portafolio(portafolio_id, user_id)
        cap_inicial = _dec(portafolio.capital_inicial)
        posiciones_all = portafolio.posiciones.all()
        invertido = sum(
            _dec(p.costo_total) for p in posiciones_all if _dec(p.cantidad) > 0
        )

        if cap_inicial > 0:
            # Límite local
            if invertido > cap_inicial:
                raise ValueError(
                    f"Capital insuficiente. Invertido: ${float(invertido):,.2f}, "
                    f"Capital: ${float(cap_inicial):,.2f}."
                )
        else:
            # Sin límite local: verificar capital global
            from ..models.configuracion import ConfiguracionUsuario
            config = ConfiguracionUsuario.query.filter_by(user_id=user_id).first()
            capital_global = _dec(config.capital_global) if config else Decimal("0")
            if capital_global <= 0:
                raise ValueError("No hay capital global configurado.")
            todos_port = Portafolio.query.filter_by(user_id=user_id).all()
            total_invertido = Decimal("0")
            for p in todos_port:
                for pos in p.posiciones.all():
                    if _dec(pos.cantidad) > 0:
                        total_invertido += _dec(pos.costo_total)
            if total_invertido > capital_global:
                raise ValueError(
                    f"Capital global insuficiente. Invertido total: ${float(total_invertido):,.2f}, "
                    f"Capital global: ${float(capital_global):,.2f}."
                )

    transaccion.estado = "confirmada"
    db.session.commit()
    return _transaccion_to_dict(transaccion)


def cancelar_transaccion(
    portafolio_id: int, user_id: int, transaccion_id: int
) -> dict:
    """
    Cancela una transacción pendiente, revierte los cambios en la posición
    y elimina la transacción.

    - Si la transacción era compra → resta la cantidad de la posición
    - Si la transacción era venta → suma la cantidad de vuelta a la posición

    Raises:
        ValueError: si la transacción no existe o no está pendiente.
    """
    _get_portafolio(portafolio_id, user_id)
    transaccion = Transaccion.query.filter_by(
        id=transaccion_id, portafolio_id=portafolio_id
    ).first()

    if transaccion is None:
        raise ValueError(
            f"No se encontró la transacción con id {transaccion_id} en este portafolio."
        )

    if transaccion.estado != "pendiente":
        raise ValueError(
            "Solo se pueden cancelar transacciones con estado 'pendiente'."
        )

    # Revertir cambios en la posición
    posicion = Posicion.query.filter_by(
        portafolio_id=portafolio_id, ticker=transaccion.ticker
    ).first()

    if posicion is not None:
        cantidad_tx = _dec(transaccion.cantidad)
        precio_tx = _dec(transaccion.precio_unitario)

        if transaccion.tipo == "compra":
            # Revertir compra: restar cantidad y ajustar costo
            nueva_cantidad = _dec(posicion.cantidad) - cantidad_tx
            if nueva_cantidad < 0:
                nueva_cantidad = Decimal("0")
            posicion.cantidad = nueva_cantidad
            posicion.costo_total = _dec(posicion.precio_promedio) * nueva_cantidad
        elif transaccion.tipo == "venta":
            # Revertir venta: sumar cantidad de vuelta
            nueva_cantidad = _dec(posicion.cantidad) + cantidad_tx
            posicion.cantidad = nueva_cantidad
            posicion.costo_total = _dec(posicion.precio_promedio) * nueva_cantidad

    db.session.delete(transaccion)
    db.session.commit()
    return {"mensaje": "Transacción cancelada y cambios revertidos."}


# ── Refresco de precios bajo demanda ─────────────────────────────

def refrescar_precios(portafolio_id: int, user_id: int) -> list[dict]:
    """
    Refresca precios de posiciones con precio faltante (0 o NULL).

    Llama a yfinance_service.obtener_precios_multiples() para los tickers
    sin precio y actualiza las posiciones en la DB. Si yfinance falla para
    un ticker, se mantiene el precio original sin modificación.

    Requisitos: 13.1, 13.2, 13.3, 13.4
    """
    portafolio = _get_portafolio(portafolio_id, user_id)
    # Incluir todas las posiciones (también pool con cantidad=0) para refrescar precios
    posiciones = portafolio.posiciones.all()

    tickers_sin_precio = [
        pos.ticker for pos in posiciones
        if pos.precio_actual is None or float(pos.precio_actual) <= 0
    ]

    if not tickers_sin_precio:
        return _posiciones_con_pnl(portafolio)

    precios = yfinance_service.obtener_precios_multiples(tickers_sin_precio)
    precios_map = {r["ticker"]: r for r in precios if r.get("precio")}

    ahora = datetime.now(timezone.utc)
    for pos in posiciones:
        datos = precios_map.get(pos.ticker)
        if datos and datos["precio"]:
            precio = _dec(datos["precio"])
            cantidad = _dec(pos.cantidad)
            precio_promedio = _dec(pos.precio_promedio)
            pos.precio_actual = precio
            pos.valor_mercado = precio * cantidad
            pos.pnl_bruto = (precio - precio_promedio) * cantidad
            pos.pnl_porcentual = (
                ((precio - precio_promedio) / precio_promedio * 100)
                if precio_promedio > 0 else Decimal("0")
            )
            pos.ultima_actualizacion = ahora

    db.session.commit()
    return _posiciones_con_pnl(portafolio)


# ── Valor histórico del portafolio ───────────────────────────────

def obtener_historico(portafolio_id: int, user_id: int, rango: str = "30d") -> dict:
    """
    Reconstruye el valor histórico del portafolio.

    Algoritmo:
    1. Obtener todas las transacciones ordenadas por fecha.
    2. Para cada fecha en el rango, reconstruir posiciones acumuladas.
    3. Multiplicar cantidad × precio_cierre_historico para cada ticker.
    4. Sumar para obtener valor total del portafolio por día.

    Parámetro rango: "30d", "3m", "1y". Default "30d".

    Requisitos: 12.3
    """
    portafolio = _get_portafolio(portafolio_id, user_id)

    # Mapear rango a días
    rangos = {"30d": 30, "3m": 90, "1y": 365}
    dias = rangos.get(rango, 30)

    # Obtener transacciones ordenadas por fecha
    transacciones = (
        Transaccion.query
        .filter_by(portafolio_id=portafolio_id)
        .order_by(Transaccion.fecha.asc(), Transaccion.created_at.asc())
        .all()
    )

    if not transacciones:
        return {
            "portafolio_id": portafolio_id,
            "rango": rango,
            "fechas": [],
            "valores": [],
            "moneda": portafolio.moneda,
        }

    # Determinar rango de fechas
    hoy = date.today()
    fecha_inicio = hoy - timedelta(days=dias)

    # Reconstruir posiciones acumuladas por día
    # Primero, calcular posiciones acumuladas hasta cada fecha
    posiciones_acumuladas = defaultdict(lambda: Decimal("0"))

    # Procesar transacciones anteriores a fecha_inicio para tener el estado base
    for tx in transacciones:
        tx_fecha = tx.fecha if isinstance(tx.fecha, date) else tx.fecha.date() if hasattr(tx.fecha, 'date') else tx.fecha
        if tx_fecha > hoy:
            continue
        tipo = tx.tipo.lower()
        cantidad = _dec(tx.cantidad)
        if tipo == "compra":
            posiciones_acumuladas[tx.ticker] += cantidad
        elif tipo == "venta":
            posiciones_acumuladas[tx.ticker] -= cantidad

    # Ahora reconstruir día a día dentro del rango
    # Primero, obtener el estado base al inicio del rango
    posiciones_base = defaultdict(lambda: Decimal("0"))
    transacciones_en_rango = []

    for tx in transacciones:
        tx_fecha = tx.fecha if isinstance(tx.fecha, date) else tx.fecha.date() if hasattr(tx.fecha, 'date') else tx.fecha
        if tx_fecha < fecha_inicio:
            tipo = tx.tipo.lower()
            cantidad = _dec(tx.cantidad)
            if tipo == "compra":
                posiciones_base[tx.ticker] += cantidad
            elif tipo == "venta":
                posiciones_base[tx.ticker] -= cantidad
        elif tx_fecha <= hoy:
            transacciones_en_rango.append(tx)

    # Obtener todos los tickers con posiciones activas
    todos_tickers = set()
    temp_pos = dict(posiciones_base)
    for ticker, cant in temp_pos.items():
        if cant > 0:
            todos_tickers.add(ticker)
    for tx in transacciones_en_rango:
        todos_tickers.add(tx.ticker)

    if not todos_tickers:
        return {
            "portafolio_id": portafolio_id,
            "rango": rango,
            "fechas": [],
            "valores": [],
            "moneda": portafolio.moneda,
        }

    # Obtener precios históricos para cada ticker
    precios_historicos = {}
    periodo_yf = "1mo" if dias <= 30 else "3mo" if dias <= 90 else "1y"
    for ticker in todos_tickers:
        try:
            df = yfinance_service.obtener_datos_historicos(
                ticker, periodo=periodo_yf, intervalo="1d"
            )
            # Convertir a dict {date: precio_cierre}
            precios_ticker = {}
            for idx, row in df.iterrows():
                fecha_idx = idx.date() if hasattr(idx, 'date') else idx
                close_val = row["Close"]
                if hasattr(close_val, "item"):
                    close_val = close_val.item()
                precios_ticker[fecha_idx] = Decimal(str(round(float(close_val), 2)))
            precios_historicos[ticker] = precios_ticker
        except Exception as e:
            logger.warning(
                "Error al obtener precios históricos de '%s': %s. "
                "Excluyendo del cálculo histórico.",
                ticker, str(e),
            )

    # Generar serie de fechas y calcular valor por día
    fechas = []
    valores = []
    posiciones_dia = defaultdict(lambda: Decimal("0"), posiciones_base)

    # Índice para transacciones en rango
    idx_tx = 0

    fecha_actual = fecha_inicio
    while fecha_actual <= hoy:
        # Aplicar transacciones de este día
        while idx_tx < len(transacciones_en_rango):
            tx = transacciones_en_rango[idx_tx]
            tx_fecha = tx.fecha if isinstance(tx.fecha, date) else tx.fecha.date() if hasattr(tx.fecha, 'date') else tx.fecha
            if tx_fecha > fecha_actual:
                break
            tipo = tx.tipo.lower()
            cantidad = _dec(tx.cantidad)
            if tipo == "compra":
                posiciones_dia[tx.ticker] += cantidad
            elif tipo == "venta":
                posiciones_dia[tx.ticker] -= cantidad
            idx_tx += 1

        # Calcular valor total del portafolio en esta fecha
        valor_dia = Decimal("0")
        tiene_datos = False
        for ticker, cantidad in posiciones_dia.items():
            if cantidad <= 0:
                continue
            precios_ticker = precios_historicos.get(ticker, {})
            # Buscar precio más cercano (mismo día o anterior)
            precio = None
            for delta in range(0, 8):  # Buscar hasta 7 días atrás (fines de semana/feriados)
                fecha_buscar = fecha_actual - timedelta(days=delta)
                if fecha_buscar in precios_ticker:
                    precio = precios_ticker[fecha_buscar]
                    break
            if precio is not None:
                valor_dia += cantidad * precio
                tiene_datos = True

        if tiene_datos:
            fechas.append(fecha_actual.isoformat())
            valores.append(float(valor_dia))

        fecha_actual += timedelta(days=1)

    return {
        "portafolio_id": portafolio_id,
        "rango": rango,
        "fechas": fechas,
        "valores": valores,
        "moneda": portafolio.moneda,
    }


# ── Procesamiento de transacciones ───────────────────────────────

def _procesar_compra(posicion, portafolio_id, user_id, ticker, precio_unitario, cantidad, moneda):
    """
    Crea o actualiza posición con precio promedio ponderado.

    Fórmula: precio_promedio = (costo_anterior + precio_unitario × cantidad)
                               / (cantidad_anterior + cantidad)
    """
    if posicion is None:
        posicion = Posicion(
            user_id=user_id,
            portafolio_id=portafolio_id,
            ticker=ticker,
            cantidad=Decimal("0"),
            precio_promedio=Decimal("0"),
            costo_total=Decimal("0"),
            dividendos_acumulados=Decimal("0"),
            moneda=moneda,
        )
        db.session.add(posicion)

    cantidad_anterior = _dec(posicion.cantidad)
    costo_anterior = _dec(posicion.costo_total)

    nueva_cantidad = cantidad_anterior + cantidad
    nuevo_costo = costo_anterior + (precio_unitario * cantidad)

    posicion.cantidad = nueva_cantidad
    posicion.costo_total = nuevo_costo
    posicion.precio_promedio = nuevo_costo / nueva_cantidad if nueva_cantidad > 0 else Decimal("0")

    # Asignar precio_actual si no tiene uno válido (para que no quede en "Sin precio")
    if posicion.precio_actual is None or _dec(posicion.precio_actual) <= 0:
        posicion.precio_actual = precio_unitario
        posicion.valor_mercado = precio_unitario * nueva_cantidad
        posicion.pnl_bruto = Decimal("0")
        posicion.pnl_porcentual = Decimal("0")
        posicion.ultima_actualizacion = datetime.now(timezone.utc)

    return posicion, None


def _procesar_venta(posicion, ticker, precio_unitario, cantidad):
    """
    Reduce cantidad de la posición y calcula ganancia/pérdida.

    ganancia_perdida = (precio_unitario - precio_promedio) × cantidad

    Raises:
        ValueError: si no hay posición o la cantidad excede la disponible.
    """
    if posicion is None or _dec(posicion.cantidad) <= 0:
        raise ValueError(
            f"No existe posición activa de '{ticker}' en este portafolio. "
            "No es posible registrar una venta."
        )

    cantidad_disponible = _dec(posicion.cantidad)
    if cantidad > cantidad_disponible:
        raise ValueError(
            f"La cantidad a vender ({cantidad}) excede la cantidad disponible "
            f"({cantidad_disponible}) de '{ticker}'. "
            f"Cantidad máxima disponible: {cantidad_disponible}."
        )

    precio_promedio = _dec(posicion.precio_promedio)
    ganancia_perdida = (precio_unitario - precio_promedio) * cantidad

    nueva_cantidad = cantidad_disponible - cantidad
    posicion.cantidad = nueva_cantidad
    posicion.costo_total = precio_promedio * nueva_cantidad

    return posicion, ganancia_perdida


def _procesar_dividendo(posicion, portafolio_id, user_id, ticker, precio_unitario, cantidad, moneda):
    """
    Acumula dividendo sin modificar la cantidad de la posición.

    El monto del dividendo es precio_unitario × cantidad.
    """
    if posicion is None:
        posicion = Posicion(
            user_id=user_id,
            portafolio_id=portafolio_id,
            ticker=ticker,
            cantidad=Decimal("0"),
            precio_promedio=Decimal("0"),
            costo_total=Decimal("0"),
            dividendos_acumulados=Decimal("0"),
            moneda=moneda,
        )
        db.session.add(posicion)

    monto_dividendo = precio_unitario * cantidad
    posicion.dividendos_acumulados = _dec(posicion.dividendos_acumulados) + monto_dividendo

    return posicion


# ── Helpers de consulta ──────────────────────────────────────────

def _get_portafolio(portafolio_id: int, user_id: int) -> Portafolio:
    """
    Obtiene un portafolio verificando que pertenezca al usuario.

    Raises:
        ValueError: si no se encuentra.
    """
    portafolio = Portafolio.query.filter_by(id=portafolio_id, user_id=user_id).first()
    if portafolio is None:
        raise ValueError(
            f"No se encontró el portafolio con id {portafolio_id} para este usuario."
        )
    return portafolio


def _posiciones_con_pnl(portafolio: Portafolio) -> list[dict]:
    """Calcula P&L bruto y neto para cada posición del portafolio."""
    posiciones = portafolio.posiciones.all()
    resultado = []

    for pos in posiciones:
        cantidad = _dec(pos.cantidad)
        precio_promedio = _dec(pos.precio_promedio)
        precio_actual = _dec(pos.precio_actual)
        costo_total = _dec(pos.costo_total)
        precio_pendiente = precio_actual <= 0

        valor_mercado = precio_actual * cantidad if cantidad > 0 else Decimal("0")
        pnl_bruto = (precio_actual - precio_promedio) * cantidad if cantidad > 0 else Decimal("0")
        pnl_porcentual = (
            ((precio_actual - precio_promedio) / precio_promedio * 100)
            if precio_promedio > 0 and cantidad > 0
            else Decimal("0")
        )
        neto = _calcular_pnl_neto(pnl_bruto)

        resultado.append({
            "id": pos.id,
            "ticker": pos.ticker,
            "cantidad": float(cantidad),
            "precio_promedio": float(precio_promedio),
            "costo_total": float(costo_total),
            "precio_actual": float(precio_actual),
            "valor_mercado": float(valor_mercado),
            "pnl_bruto": float(pnl_bruto),
            "pnl_neto": float(neto["pnl_neto"]),
            "isr_estimado": float(neto["isr"]),
            "pnl_porcentual": float(pnl_porcentual),
            "dividendos_acumulados": float(_dec(pos.dividendos_acumulados)),
            "moneda": pos.moneda,
            "precio_pendiente": precio_pendiente,
            "ultima_actualizacion": (
                pos.ultima_actualizacion.isoformat() if pos.ultima_actualizacion else None
            ),
            "created_at": pos.created_at.isoformat() if pos.created_at else None,
            "updated_at": pos.updated_at.isoformat() if pos.updated_at else None,
        })

    return resultado


# ── Serialización ────────────────────────────────────────────────

def _portafolio_to_dict(portafolio: Portafolio) -> dict:
    """Convierte un portafolio a diccionario."""
    return {
        "id": portafolio.id,
        "user_id": portafolio.user_id,
        "nombre": portafolio.nombre,
        "descripcion": portafolio.descripcion,
        "moneda": portafolio.moneda,
        "capital_inicial": float(_dec(portafolio.capital_inicial)),
        "fecha_creacion": portafolio.fecha_creacion.isoformat(),
        "updated_at": portafolio.updated_at.isoformat() if portafolio.updated_at else None,
    }


def _transaccion_to_dict(transaccion: Transaccion) -> dict:
    """Convierte una transacción a diccionario."""
    return {
        "id": transaccion.id,
        "portafolio_id": transaccion.portafolio_id,
        "ticker": transaccion.ticker,
        "tipo": transaccion.tipo,
        "fecha": transaccion.fecha.isoformat() if transaccion.fecha else None,
        "precio_unitario": float(_dec(transaccion.precio_unitario)),
        "cantidad": float(_dec(transaccion.cantidad)),
        "comision": float(_dec(transaccion.comision)),
        "moneda": transaccion.moneda,
        "ganancia_perdida": (
            float(_dec(transaccion.ganancia_perdida))
            if transaccion.ganancia_perdida is not None
            else None
        ),
        "notas": transaccion.notas,
        "estado": transaccion.estado,
        "updated_at": transaccion.updated_at.isoformat() if transaccion.updated_at else None,
        "created_at": transaccion.created_at.isoformat(),
    }

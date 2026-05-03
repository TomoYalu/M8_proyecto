"""
Servicio de lógica de negocio para simulaciones de portafolios.

Implementa CRUD de simulaciones, cálculo de acciones, ejecución
(conversión a portafolio real) e importación desde portafolios existentes.

Todas las operaciones financieras usan Decimal para precisión.
Mensajes de error en español.

Requisitos cubiertos: 1.1–1.8
"""

import logging
import math
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_DOWN

from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.portafolio import Posicion
from ..models.simulacion import Simulacion, SimulacionActivo
from ..services import portfolio_service, yfinance_service

logger = logging.getLogger(__name__)


# ── Helpers internos ─────────────────────────────────────────────


def _dec(value) -> Decimal:
    """Convierte un valor a Decimal de forma segura."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _get_simulacion(simulacion_id: int, user_id: int) -> Simulacion:
    """
    Obtiene una simulación verificando que pertenezca al usuario.

    Raises:
        ValueError: si no se encuentra.
    """
    simulacion = Simulacion.query.filter_by(
        id=simulacion_id, user_id=user_id
    ).first()
    if simulacion is None:
        raise ValueError(
            f"No se encontró la simulación con id {simulacion_id} para este usuario."
        )
    return simulacion


def _validar_suma_pesos(activos_data: list[dict]) -> None:
    """
    Valida que la suma de pesos objetivo sea 100% (±0.01%).

    Args:
        activos_data: Lista de dicts con clave 'peso_objetivo'.

    Raises:
        ValueError: si la suma no está en [99.99, 100.01].
    """
    if not activos_data:
        return

    suma = sum(_dec(a["peso_objetivo"]) for a in activos_data)
    suma_float = float(suma)

    if suma_float < 99.99 or suma_float > 100.01:
        raise ValueError(
            f"La suma de pesos ({suma_float:.2f}%) debe ser 100% (±0.01%)."
        )


def _simulacion_to_dict(simulacion: Simulacion) -> dict:
    """Convierte una simulación a diccionario."""
    return {
        "id": simulacion.id,
        "user_id": simulacion.user_id,
        "nombre": simulacion.nombre,
        "capital_total": float(_dec(simulacion.capital_total)),
        "moneda": simulacion.moneda,
        "estado": simulacion.estado,
        "portafolio_origen_id": simulacion.portafolio_origen_id,
        "portafolio_resultado_id": simulacion.portafolio_resultado_id,
        "fecha_creacion": simulacion.fecha_creacion.isoformat(),
        "fecha_ejecucion": (
            simulacion.fecha_ejecucion.isoformat()
            if simulacion.fecha_ejecucion
            else None
        ),
    }


def _activo_to_dict(activo: SimulacionActivo) -> dict:
    """Convierte un activo de simulación a diccionario."""
    return {
        "id": activo.id,
        "simulacion_id": activo.simulacion_id,
        "ticker": activo.ticker,
        "peso_objetivo": float(_dec(activo.peso_objetivo)),
        "precio_spot": (
            float(_dec(activo.precio_spot)) if activo.precio_spot is not None else None
        ),
        "acciones_calculadas": activo.acciones_calculadas,
        "monto_calculado": (
            float(_dec(activo.monto_calculado))
            if activo.monto_calculado is not None
            else None
        ),
    }


# ── CRUD de simulaciones ────────────────────────────────────────


def crear_simulacion(
    user_id: int,
    nombre: str,
    capital_total,
    moneda: str = "USD",
    activos: list[dict] | None = None,
) -> dict:
    """
    Crea una nueva simulación con activos opcionales.

    Args:
        user_id: ID del usuario.
        nombre: Nombre de la simulación.
        capital_total: Capital total de inversión.
        moneda: Moneda (default "USD").
        activos: Lista opcional de dicts con 'ticker' y 'peso_objetivo'.

    Returns:
        dict con los datos de la simulación creada.

    Raises:
        ValueError: si el nombre está vacío, el capital es inválido
                    o los pesos no suman 100%.
    """
    if not nombre or not nombre.strip():
        raise ValueError("El nombre de la simulación no puede estar vacío.")

    capital = _dec(capital_total)
    if capital <= 0:
        raise ValueError("El capital de inversión debe ser mayor a cero.")

    if activos:
        _validar_suma_pesos(activos)

    simulacion = Simulacion(
        user_id=user_id,
        nombre=nombre.strip(),
        capital_total=capital,
        moneda=moneda,
    )
    db.session.add(simulacion)
    db.session.flush()  # Obtener el ID antes de agregar activos

    if activos:
        for activo_data in activos:
            activo = SimulacionActivo(
                simulacion_id=simulacion.id,
                ticker=activo_data["ticker"].upper().strip(),
                peso_objetivo=_dec(activo_data["peso_objetivo"]),
            )
            db.session.add(activo)

    db.session.commit()

    data = _simulacion_to_dict(simulacion)
    data["activos"] = [_activo_to_dict(a) for a in simulacion.activos.all()]
    return data


def agregar_activo(
    simulacion_id: int,
    user_id: int,
    ticker: str,
    peso_objetivo,
) -> dict:
    """
    Agrega un ticker a una simulación existente.

    Args:
        simulacion_id: ID de la simulación.
        user_id: ID del usuario.
        ticker: Símbolo bursátil.
        peso_objetivo: Peso objetivo en porcentaje.

    Returns:
        dict con los datos del activo agregado.

    Raises:
        ValueError: si la simulación no existe, ya fue ejecutada,
                    o el ticker ya existe en la simulación.
    """
    simulacion = _get_simulacion(simulacion_id, user_id)

    if simulacion.estado == "ejecutada":
        raise ValueError(
            "No se pueden agregar activos a una simulación ya ejecutada."
        )

    ticker = ticker.upper().strip()
    if not ticker:
        raise ValueError("El ticker no puede estar vacío.")

    peso = _dec(peso_objetivo)
    if peso <= 0:
        raise ValueError("El peso objetivo debe ser mayor a cero.")

    activo = SimulacionActivo(
        simulacion_id=simulacion.id,
        ticker=ticker,
        peso_objetivo=peso,
    )

    try:
        db.session.add(activo)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValueError(
            f"El ticker '{ticker}' ya existe en esta simulación."
        )

    return _activo_to_dict(activo)


def actualizar_simulacion(
    simulacion_id: int,
    user_id: int,
    datos: dict,
) -> dict:
    """
    Actualiza una simulación existente.

    El dict 'datos' puede contener: nombre, capital_total, moneda,
    activos (lista de {ticker, peso_objetivo}).

    Args:
        simulacion_id: ID de la simulación.
        user_id: ID del usuario.
        datos: Diccionario con los campos a actualizar.

    Returns:
        dict con los datos actualizados de la simulación.

    Raises:
        ValueError: si la simulación no existe, ya fue ejecutada,
                    o los datos son inválidos.
    """
    simulacion = _get_simulacion(simulacion_id, user_id)

    if simulacion.estado == "ejecutada":
        raise ValueError(
            "No se puede actualizar una simulación ya ejecutada."
        )

    if "nombre" in datos:
        nombre = datos["nombre"]
        if not nombre or not nombre.strip():
            raise ValueError("El nombre de la simulación no puede estar vacío.")
        simulacion.nombre = nombre.strip()

    if "capital_total" in datos:
        capital = _dec(datos["capital_total"])
        if capital <= 0:
            raise ValueError("El capital de inversión debe ser mayor a cero.")
        simulacion.capital_total = capital

    if "moneda" in datos:
        simulacion.moneda = datos["moneda"]

    if "activos" in datos:
        activos_data = datos["activos"]
        if activos_data:
            _validar_suma_pesos(activos_data)

        # Eliminar activos existentes
        SimulacionActivo.query.filter_by(
            simulacion_id=simulacion.id
        ).delete()

        # Agregar nuevos activos
        if activos_data:
            for activo_data in activos_data:
                activo = SimulacionActivo(
                    simulacion_id=simulacion.id,
                    ticker=activo_data["ticker"].upper().strip(),
                    peso_objetivo=_dec(activo_data["peso_objetivo"]),
                )
                db.session.add(activo)

    db.session.commit()

    data = _simulacion_to_dict(simulacion)
    data["activos"] = [_activo_to_dict(a) for a in simulacion.activos.all()]
    return data


def calcular_acciones(simulacion_id: int, user_id: int) -> dict:
    """
    Auto-calcula acciones y montos para cada activo de la simulación.

    Fórmula:
        acciones = floor(capital × peso / 100 / precio_spot)
        monto = acciones × precio_spot

    Obtiene precios spot actuales vía yfinance_service.

    Args:
        simulacion_id: ID de la simulación.
        user_id: ID del usuario.

    Returns:
        dict con la simulación y activos actualizados.

    Raises:
        ValueError: si la simulación no existe, no tiene activos,
                    los pesos no suman 100%, o no se puede obtener precio.
    """
    simulacion = _get_simulacion(simulacion_id, user_id)

    if simulacion.estado == "ejecutada":
        raise ValueError(
            "No se pueden calcular acciones de una simulación ya ejecutada."
        )

    activos = simulacion.activos.all()
    if not activos:
        raise ValueError("La simulación no tiene activos definidos.")

    # Validar suma de pesos
    _validar_suma_pesos([{"peso_objetivo": float(a.peso_objetivo)} for a in activos])

    capital = _dec(simulacion.capital_total)

    for activo in activos:
        # Obtener precio spot actual
        try:
            precio_data = yfinance_service.obtener_precio(activo.ticker)
            precio_spot = _dec(precio_data["precio"])
        except Exception as e:
            logger.error(
                "Error al obtener precio de '%s': %s", activo.ticker, str(e)
            )
            raise ValueError(
                f"No se pudo obtener el precio de '{activo.ticker}': {str(e)}"
            )

        if precio_spot <= 0:
            raise ValueError(
                f"El precio de '{activo.ticker}' es inválido ({precio_spot})."
            )

        peso = _dec(activo.peso_objetivo)

        # floor(capital × peso / 100 / precio_spot)
        acciones_exactas = capital * peso / Decimal("100") / precio_spot
        acciones = int(acciones_exactas.to_integral_value(rounding=ROUND_DOWN))

        # monto = acciones × precio_spot
        monto = _dec(acciones) * precio_spot

        activo.precio_spot = precio_spot
        activo.acciones_calculadas = acciones
        activo.monto_calculado = monto

    db.session.commit()

    data = _simulacion_to_dict(simulacion)
    data["activos"] = [_activo_to_dict(a) for a in simulacion.activos.all()]
    return data


def ejecutar_simulacion(simulacion_id: int, user_id: int) -> dict:
    """
    Convierte una simulación en un portafolio real.

    Crea un Portafolio real usando portfolio_service, registra transacciones
    de compra para cada activo y cambia el estado a "ejecutada".

    Args:
        simulacion_id: ID de la simulación.
        user_id: ID del usuario.

    Returns:
        dict con la simulación actualizada y el portafolio creado.

    Raises:
        ValueError: si la simulación ya fue ejecutada, no tiene activos,
                    los pesos no suman 100%, o falla la creación del portafolio.
    """
    simulacion = _get_simulacion(simulacion_id, user_id)

    if simulacion.estado == "ejecutada":
        fecha = (
            simulacion.fecha_ejecucion.strftime("%Y-%m-%d %H:%M")
            if simulacion.fecha_ejecucion
            else "fecha desconocida"
        )
        raise ValueError(
            f"La simulación ya fue ejecutada el {fecha}."
        )

    activos = simulacion.activos.all()
    if not activos:
        raise ValueError("La simulación no tiene activos definidos.")

    # Validar suma de pesos
    _validar_suma_pesos([{"peso_objetivo": float(a.peso_objetivo)} for a in activos])

    # Calcular acciones si no se han calculado aún
    activos_sin_calcular = [a for a in activos if a.acciones_calculadas is None]
    if activos_sin_calcular:
        calcular_acciones(simulacion_id, user_id)
        # Refrescar activos después del cálculo
        activos = simulacion.activos.all()

    # Crear portafolio real (propagar moneda de la simulación)
    portafolio = portfolio_service.crear_portafolio(
        user_id=user_id,
        nombre=simulacion.nombre,
        descripcion=f"Portafolio creado desde simulación '{simulacion.nombre}'",
        moneda=simulacion.moneda,
    )

    # Registrar transacciones de compra para cada activo
    hoy = date.today()
    for activo in activos:
        if activo.acciones_calculadas and activo.acciones_calculadas > 0:
            portfolio_service.registrar_transaccion(
                portafolio_id=portafolio["id"],
                user_id=user_id,
                ticker=activo.ticker,
                tipo="compra",
                fecha=hoy,
                precio_unitario=float(_dec(activo.precio_spot)),
                cantidad=activo.acciones_calculadas,
                comision=0,
                moneda=simulacion.moneda,
                notas=f"Compra automática desde simulación '{simulacion.nombre}'",
            )

    # Asignar precio_actual a cada posición creada desde precio_spot
    ahora = datetime.now(timezone.utc)
    posiciones = Posicion.query.filter_by(portafolio_id=portafolio["id"]).all()
    for pos in posiciones:
        activo_sim = next(
            (a for a in activos if a.ticker == pos.ticker), None
        )
        if activo_sim and activo_sim.precio_spot:
            precio = _dec(activo_sim.precio_spot)
            cantidad = _dec(pos.cantidad)
            pos.precio_actual = precio
            pos.valor_mercado = precio * cantidad
            pos.pnl_bruto = Decimal("0")
            pos.pnl_porcentual = Decimal("0")
            pos.ultima_actualizacion = ahora
    db.session.commit()

    # Actualizar estado de la simulación
    simulacion.estado = "ejecutada"
    simulacion.fecha_ejecucion = ahora
    simulacion.portafolio_resultado_id = portafolio["id"]
    db.session.commit()

    data = _simulacion_to_dict(simulacion)
    data["activos"] = [_activo_to_dict(a) for a in simulacion.activos.all()]
    data["portafolio"] = portafolio
    return data


def importar_portafolio(
    portafolio_id: int,
    user_id: int,
    nombre: str,
) -> dict:
    """
    Crea una simulación con pesos proporcionales al valor de mercado
    de las posiciones de un portafolio existente.

    Args:
        portafolio_id: ID del portafolio a importar.
        user_id: ID del usuario.
        nombre: Nombre para la nueva simulación.

    Returns:
        dict con la simulación creada.

    Raises:
        ValueError: si el portafolio no existe, no tiene posiciones activas,
                    o el nombre está vacío.
    """
    if not nombre or not nombre.strip():
        raise ValueError("El nombre de la simulación no puede estar vacío.")

    # Obtener posiciones del portafolio
    posiciones = portfolio_service.obtener_posiciones(portafolio_id, user_id)

    # Filtrar posiciones activas (cantidad > 0)
    posiciones_activas = [p for p in posiciones if p["cantidad"] > 0]

    if not posiciones_activas:
        raise ValueError(
            "El portafolio no tiene posiciones activas para importar."
        )

    # Calcular valor total del portafolio
    valor_total = Decimal("0")
    for pos in posiciones_activas:
        valor_mercado = _dec(pos["valor_mercado"])
        if valor_mercado <= 0:
            # Usar costo_total como fallback si valor_mercado no está disponible
            valor_mercado = _dec(pos["costo_total"])
        valor_total += valor_mercado

    if valor_total <= 0:
        raise ValueError(
            "No se pudo calcular el valor total del portafolio."
        )

    # Calcular pesos proporcionales al valor de mercado
    activos = []
    for pos in posiciones_activas:
        valor_mercado = _dec(pos["valor_mercado"])
        if valor_mercado <= 0:
            valor_mercado = _dec(pos["costo_total"])

        peso = (valor_mercado / valor_total) * Decimal("100")
        # Redondear a 4 decimales
        peso = peso.quantize(Decimal("0.0001"))

        activos.append({
            "ticker": pos["ticker"],
            "peso_objetivo": float(peso),
        })

    # Ajustar para que sumen exactamente 100%
    suma_pesos = sum(_dec(a["peso_objetivo"]) for a in activos)
    diferencia = Decimal("100") - suma_pesos
    if diferencia != 0 and activos:
        # Ajustar el activo con mayor peso
        idx_max = max(range(len(activos)), key=lambda i: activos[i]["peso_objetivo"])
        activos[idx_max]["peso_objetivo"] = float(
            _dec(activos[idx_max]["peso_objetivo"]) + diferencia
        )

    # Crear la simulación
    simulacion = Simulacion(
        user_id=user_id,
        nombre=nombre.strip(),
        capital_total=valor_total,
        moneda=posiciones_activas[0].get("moneda", "USD"),
        portafolio_origen_id=portafolio_id,
    )
    db.session.add(simulacion)
    db.session.flush()

    for activo_data in activos:
        activo = SimulacionActivo(
            simulacion_id=simulacion.id,
            ticker=activo_data["ticker"],
            peso_objetivo=_dec(activo_data["peso_objetivo"]),
        )
        db.session.add(activo)

    db.session.commit()

    data = _simulacion_to_dict(simulacion)
    data["activos"] = [_activo_to_dict(a) for a in simulacion.activos.all()]
    return data


# ── Consultas ────────────────────────────────────────────────────


def listar_simulaciones(user_id: int) -> list[dict]:
    """Devuelve todas las simulaciones del usuario."""
    simulaciones = Simulacion.query.filter_by(user_id=user_id).all()
    resultado = []
    for sim in simulaciones:
        data = _simulacion_to_dict(sim)
        data["activos"] = [_activo_to_dict(a) for a in sim.activos.all()]
        resultado.append(data)
    return resultado


def obtener_simulacion(simulacion_id: int, user_id: int) -> dict:
    """
    Devuelve el detalle de una simulación con sus activos.

    Raises:
        ValueError: si la simulación no existe o no pertenece al usuario.
    """
    simulacion = _get_simulacion(simulacion_id, user_id)
    data = _simulacion_to_dict(simulacion)
    data["activos"] = [_activo_to_dict(a) for a in simulacion.activos.all()]
    return data


def eliminar_simulacion(simulacion_id: int, user_id: int) -> dict:
    """
    Elimina una simulación y todos sus activos en cascada.

    Raises:
        ValueError: si la simulación no existe o no pertenece al usuario.
    """
    simulacion = _get_simulacion(simulacion_id, user_id)
    nombre = simulacion.nombre
    db.session.delete(simulacion)
    db.session.commit()
    return {"mensaje": f"Simulación '{nombre}' eliminada correctamente."}

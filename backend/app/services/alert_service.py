# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Alertas
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Servicio de alertas: evaluación, disparo y CRUD.

Evalúa 9 tipos de alerta contra datos de mercado en tiempo real,
dispara notificaciones por WebSocket y email, y gestiona el ciclo
de vida completo de las alertas del usuario.

Tipos soportados:
    precio_objetivo, cambio_pct_dia, rsi_sobrecompra, rsi_sobreventa,
    golden_cross, death_cross, divergencia_macd, semaforo_rojo,
    concentracion (>20% del portafolio).

Requisitos cubiertos: 8.1–8.7
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from ..extensions import db, socketio
from ..models.alerta import Alerta, AlertaHistorial
from ..models.portafolio import Posicion

logger = logging.getLogger(__name__)

_USER_ID = 1

# ── Tipos de alerta válidos ──────────────────────────────────────

TIPOS_ALERTA = [
    "precio_objetivo",
    "cambio_pct_dia",
    "rsi_sobrecompra",
    "rsi_sobreventa",
    "golden_cross",
    "death_cross",
    "divergencia_macd",
    "semaforo_rojo",
    "concentracion",
]


def _dec(value) -> Decimal:
    """Convierte un valor a Decimal de forma segura."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


class AlertService:
    """Servicio de evaluación, disparo y gestión de alertas."""

    # ── Evaluación masiva ────────────────────────────────────────

    @staticmethod
    def evaluar_todas():
        """
        Itera todas las alertas activas, evalúa sus condiciones
        y dispara las que se cumplan.
        """
        alertas_activas = Alerta.query.filter_by(activa=True).all()

        if not alertas_activas:
            logger.info("No hay alertas activas para evaluar.")
            return

        logger.info("Evaluando %d alertas activas...", len(alertas_activas))

        for alerta in alertas_activas:
            try:
                cumplida, datos = AlertService._evaluar_alerta(alerta)
                if cumplida:
                    AlertService._disparar_alerta(alerta, datos)
            except Exception as e:
                logger.error(
                    "Error al evaluar alerta %d (%s %s): %s",
                    alerta.id, alerta.ticker, alerta.tipo, str(e),
                )

    # ── Evaluación individual ────────────────────────────────────

    @staticmethod
    def _evaluar_alerta(alerta: Alerta) -> tuple[bool, dict]:
        """
        Evalúa una alerta según su tipo y retorna (cumplida, datos).

        Returns:
            Tupla (bool, dict) donde bool indica si la condición se cumplió
            y dict contiene los datos relevantes para el disparo.
        """
        evaluadores = {
            "precio_objetivo": AlertService._eval_precio_objetivo,
            "cambio_pct_dia": AlertService._eval_cambio_pct_dia,
            "rsi_sobrecompra": AlertService._eval_rsi_sobrecompra,
            "rsi_sobreventa": AlertService._eval_rsi_sobreventa,
            "golden_cross": AlertService._eval_golden_cross,
            "death_cross": AlertService._eval_death_cross,
            "divergencia_macd": AlertService._eval_divergencia_macd,
            "semaforo_rojo": AlertService._eval_semaforo_rojo,
            "concentracion": AlertService._eval_concentracion,
        }

        evaluador = evaluadores.get(alerta.tipo)
        if evaluador is None:
            logger.warning("Tipo de alerta desconocido: '%s'", alerta.tipo)
            return False, {}

        return evaluador(alerta)

    # ── Evaluadores por tipo ─────────────────────────────────────

    @staticmethod
    def _eval_precio_objetivo(alerta: Alerta) -> tuple[bool, dict]:
        """Precio cruza umbral (arriba o abajo)."""
        from . import yfinance_service

        resultado = yfinance_service.obtener_precio(alerta.ticker)
        precio = resultado.get("precio")
        if precio is None:
            return False, {}

        umbral = float(_dec(alerta.umbral))
        condicion = alerta.condicion

        cumplida = False
        if condicion == "mayor_que" and precio > umbral:
            cumplida = True
        elif condicion == "menor_que" and precio < umbral:
            cumplida = True
        elif condicion == "igual" and abs(precio - umbral) < 0.01:
            cumplida = True

        return cumplida, {
            "valor_actual": precio,
            "umbral": umbral,
            "condicion": condicion,
            "descripcion": (
                f"Precio de {alerta.ticker}: ${precio:.2f} "
                f"({'supera' if condicion == 'mayor_que' else 'cae por debajo de'} "
                f"${umbral:.2f})"
            ),
        }

    @staticmethod
    def _eval_cambio_pct_dia(alerta: Alerta) -> tuple[bool, dict]:
        """Cambio porcentual diario excede umbral."""
        from . import yfinance_service

        resultado = yfinance_service.obtener_precio(alerta.ticker)
        cambio_pct = resultado.get("cambio_pct")
        if cambio_pct is None:
            return False, {}

        umbral = float(_dec(alerta.umbral))
        condicion = alerta.condicion

        cumplida = False
        if condicion == "mayor_que" and cambio_pct > umbral:
            cumplida = True
        elif condicion == "menor_que" and cambio_pct < umbral:
            cumplida = True

        return cumplida, {
            "valor_actual": cambio_pct,
            "umbral": umbral,
            "condicion": condicion,
            "descripcion": (
                f"Cambio diario de {alerta.ticker}: {cambio_pct:+.2f}% "
                f"(umbral: {umbral:+.2f}%)"
            ),
        }

    @staticmethod
    def _eval_rsi_sobrecompra(alerta: Alerta) -> tuple[bool, dict]:
        """RSI > 70."""
        rsi_val = AlertService._obtener_rsi(alerta.ticker)
        if rsi_val is None:
            return False, {}

        cumplida = rsi_val > 70
        return cumplida, {
            "valor_actual": rsi_val,
            "umbral": 70,
            "condicion": "mayor_que",
            "descripcion": (
                f"RSI de {alerta.ticker}: {rsi_val:.2f} "
                f"(sobrecompra > 70)"
            ),
        }

    @staticmethod
    def _eval_rsi_sobreventa(alerta: Alerta) -> tuple[bool, dict]:
        """RSI < 30."""
        rsi_val = AlertService._obtener_rsi(alerta.ticker)
        if rsi_val is None:
            return False, {}

        cumplida = rsi_val < 30
        return cumplida, {
            "valor_actual": rsi_val,
            "umbral": 30,
            "condicion": "menor_que",
            "descripcion": (
                f"RSI de {alerta.ticker}: {rsi_val:.2f} "
                f"(sobreventa < 30)"
            ),
        }

    @staticmethod
    def _eval_golden_cross(alerta: Alerta) -> tuple[bool, dict]:
        """SMA50 cruza por encima de SMA200."""
        cruce = AlertService._detectar_cruce_sma(alerta.ticker)
        if cruce is None:
            return False, {}

        cumplida = cruce == "golden_cross"
        return cumplida, {
            "valor_actual": cruce,
            "umbral": None,
            "condicion": "igual",
            "descripcion": (
                f"Golden Cross detectado en {alerta.ticker}: "
                f"SMA50 cruza por encima de SMA200"
            ),
        }

    @staticmethod
    def _eval_death_cross(alerta: Alerta) -> tuple[bool, dict]:
        """SMA50 cruza por debajo de SMA200."""
        cruce = AlertService._detectar_cruce_sma(alerta.ticker)
        if cruce is None:
            return False, {}

        cumplida = cruce == "death_cross"
        return cumplida, {
            "valor_actual": cruce,
            "umbral": None,
            "condicion": "igual",
            "descripcion": (
                f"Death Cross detectado en {alerta.ticker}: "
                f"SMA50 cruza por debajo de SMA200"
            ),
        }

    @staticmethod
    def _eval_divergencia_macd(alerta: Alerta) -> tuple[bool, dict]:
        """Divergencia bajista del MACD detectada."""
        from .ta_service import TAService
        from . import yfinance_service

        try:
            df = yfinance_service.obtener_datos_historicos(alerta.ticker)
            ta = TAService()
            divergencia = ta._detectar_divergencia_macd(df)
            tipo_div = divergencia.get("tipo")

            cumplida = tipo_div == "bajista"
            return cumplida, {
                "valor_actual": tipo_div,
                "umbral": None,
                "condicion": "igual",
                "descripcion": divergencia.get("descripcion", ""),
            }
        except Exception as e:
            logger.warning(
                "No se pudo evaluar divergencia MACD para '%s': %s",
                alerta.ticker, str(e),
            )
            return False, {}

    @staticmethod
    def _eval_semaforo_rojo(alerta: Alerta) -> tuple[bool, dict]:
        """Semáforo de noticias es 'rojo'."""
        from .news_service import NewsService

        semaforo_data = NewsService.obtener_semaforo(alerta.ticker)
        semaforo = semaforo_data.get("semaforo", "amarillo")

        cumplida = semaforo == "rojo"
        return cumplida, {
            "valor_actual": semaforo,
            "umbral": "rojo",
            "condicion": "igual",
            "descripcion": (
                f"Semáforo de noticias de {alerta.ticker}: {semaforo} "
                f"(sentimiento negativo dominante)"
            ),
        }

    @staticmethod
    def _eval_concentracion(alerta: Alerta) -> tuple[bool, dict]:
        """Posición > 20% del valor total del portafolio."""
        if alerta.portafolio_id is None:
            return False, {}

        posiciones = Posicion.query.filter_by(
            portafolio_id=alerta.portafolio_id,
        ).filter(Posicion.cantidad > 0).all()

        if not posiciones:
            return False, {}

        valor_total = sum(
            float(_dec(p.valor_mercado)) for p in posiciones
            if p.valor_mercado is not None
        )

        if valor_total <= 0:
            return False, {}

        # Buscar la posición del ticker de la alerta
        posicion_ticker = None
        for p in posiciones:
            if p.ticker == alerta.ticker:
                posicion_ticker = p
                break

        if posicion_ticker is None or posicion_ticker.valor_mercado is None:
            return False, {}

        valor_posicion = float(_dec(posicion_ticker.valor_mercado))
        porcentaje = (valor_posicion / valor_total) * 100

        umbral = float(_dec(alerta.umbral)) if alerta.umbral else 20.0
        cumplida = porcentaje > umbral

        return cumplida, {
            "valor_actual": round(porcentaje, 2),
            "umbral": umbral,
            "condicion": "mayor_que",
            "descripcion": (
                f"Concentración de {alerta.ticker}: {porcentaje:.1f}% "
                f"del portafolio (umbral: {umbral:.0f}%)"
            ),
        }

    # ── Helpers de datos técnicos ────────────────────────────────

    @staticmethod
    def _obtener_rsi(ticker: str) -> float | None:
        """Obtiene el último valor de RSI para un ticker."""
        from .ta_service import TAService
        from . import yfinance_service

        try:
            df = yfinance_service.obtener_datos_historicos(ticker)
            ta = TAService()
            rsi = ta._rsi(df, 14)
            valid = rsi.dropna()
            if valid.empty:
                return None
            return float(valid.iloc[-1])
        except Exception as e:
            logger.warning(
                "No se pudo obtener RSI para '%s': %s", ticker, str(e),
            )
            return None

    @staticmethod
    def _detectar_cruce_sma(ticker: str) -> str | None:
        """
        Detecta si hubo un cruce de SMA50/SMA200 en las últimas 2 velas.

        Returns:
            'golden_cross', 'death_cross' o None.
        """
        from .ta_service import TAService
        from . import yfinance_service

        try:
            df = yfinance_service.obtener_datos_historicos(ticker)
            ta = TAService()
            sma50 = ta._sma(df, 50)
            sma200 = ta._sma(df, 200)

            if len(sma50) < 2 or len(sma200) < 2:
                return None

            # Verificar las últimas 2 velas para detectar cruce
            prev_50 = sma50.iloc[-2]
            curr_50 = sma50.iloc[-1]
            prev_200 = sma200.iloc[-2]
            curr_200 = sma200.iloc[-1]

            if any(
                v is None or (hasattr(v, '__class__') and v.__class__.__name__ == 'float' and v != v)
                for v in [prev_50, curr_50, prev_200, curr_200]
            ):
                return None

            import pandas as pd
            if any(pd.isna(v) for v in [prev_50, curr_50, prev_200, curr_200]):
                return None

            # Golden Cross: SMA50 cruza de abajo hacia arriba de SMA200
            if prev_50 <= prev_200 and curr_50 > curr_200:
                return "golden_cross"

            # Death Cross: SMA50 cruza de arriba hacia abajo de SMA200
            if prev_50 >= prev_200 and curr_50 < curr_200:
                return "death_cross"

            return None
        except Exception as e:
            logger.warning(
                "No se pudo detectar cruce SMA para '%s': %s", ticker, str(e),
            )
            return None

    # ── Disparo de alerta ────────────────────────────────────────

    @staticmethod
    def _disparar_alerta(alerta: Alerta, datos: dict):
        """
        Dispara una alerta: guarda en historial, emite WebSocket,
        envía email si está habilitado.
        """
        ahora = datetime.now(timezone.utc)

        # Determinar canal
        canal = "websocket"
        email_enviado = False

        if alerta.email_habilitado:
            try:
                from .email_service import enviar_alerta
                enviar_alerta(alerta, datos)
                email_enviado = True
                canal = "ambos"
            except Exception as e:
                logger.error(
                    "Error al enviar email para alerta %d: %s",
                    alerta.id, str(e),
                )
                # Continuar con WebSocket aunque falle el email

        # Guardar en historial
        historial = AlertaHistorial(
            user_id=alerta.user_id,
            alerta_id=alerta.id,
            ticker=alerta.ticker,
            tipo=alerta.tipo,
            condicion=datos.get("descripcion", f"{alerta.condicion} {alerta.umbral}"),
            valor_disparado=datos.get("valor_actual"),
            timestamp=ahora,
            canal=canal,
        )
        db.session.add(historial)
        db.session.commit()

        # Emitir WebSocket
        socketio.emit("alert_triggered", {
            "id": historial.id,
            "ticker": alerta.ticker,
            "tipo": alerta.tipo,
            "valor_actual": datos.get("valor_actual"),
            "umbral": datos.get("umbral"),
            "descripcion": datos.get("descripcion", ""),
            "timestamp": ahora.isoformat(),
        })

        logger.info(
            "Alerta disparada: %s %s (canal: %s)",
            alerta.ticker, alerta.tipo, canal,
        )

    # ── CRUD de alertas ──────────────────────────────────────────

    @staticmethod
    def crear_alerta(
        user_id: int,
        ticker: str,
        tipo: str,
        condicion: str,
        umbral=None,
        portafolio_id: int = None,
        email_habilitado: bool = False,
    ) -> dict:
        """
        Crea una nueva alerta.

        Raises:
            ValueError: si los datos son inválidos.
        """
        if not ticker or not ticker.strip():
            raise ValueError("El ticker no puede estar vacío.")

        if tipo not in TIPOS_ALERTA:
            raise ValueError(
                f"Tipo de alerta inválido: '{tipo}'. "
                f"Tipos válidos: {', '.join(TIPOS_ALERTA)}"
            )

        if condicion not in ("mayor_que", "menor_que", "igual"):
            raise ValueError(
                f"Condición inválida: '{condicion}'. "
                "Debe ser 'mayor_que', 'menor_que' o 'igual'."
            )

        alerta = Alerta(
            user_id=user_id,
            ticker=ticker.strip().upper(),
            tipo=tipo,
            condicion=condicion,
            umbral=Decimal(str(umbral)) if umbral is not None else None,
            portafolio_id=portafolio_id,
            activa=True,
            email_habilitado=email_habilitado,
        )
        db.session.add(alerta)
        db.session.commit()

        return AlertService._alerta_to_dict(alerta)

    @staticmethod
    def listar_alertas(user_id: int) -> list[dict]:
        """Devuelve todas las alertas del usuario."""
        alertas = Alerta.query.filter_by(user_id=user_id).order_by(
            Alerta.created_at.desc()
        ).all()
        return [AlertService._alerta_to_dict(a) for a in alertas]

    @staticmethod
    def actualizar_alerta(alerta_id: int, user_id: int, datos: dict) -> dict:
        """
        Actualiza la configuración de una alerta.

        Raises:
            ValueError: si la alerta no existe o los datos son inválidos.
        """
        alerta = AlertService._get_alerta(alerta_id, user_id)

        if "ticker" in datos:
            ticker = datos["ticker"]
            if not ticker or not ticker.strip():
                raise ValueError("El ticker no puede estar vacío.")
            alerta.ticker = ticker.strip().upper()

        if "tipo" in datos:
            if datos["tipo"] not in TIPOS_ALERTA:
                raise ValueError(f"Tipo de alerta inválido: '{datos['tipo']}'.")
            alerta.tipo = datos["tipo"]

        if "condicion" in datos:
            if datos["condicion"] not in ("mayor_que", "menor_que", "igual"):
                raise ValueError(f"Condición inválida: '{datos['condicion']}'.")
            alerta.condicion = datos["condicion"]

        if "umbral" in datos:
            alerta.umbral = (
                Decimal(str(datos["umbral"])) if datos["umbral"] is not None else None
            )

        if "portafolio_id" in datos:
            alerta.portafolio_id = datos["portafolio_id"]

        if "email_habilitado" in datos:
            alerta.email_habilitado = bool(datos["email_habilitado"])

        alerta.updated_at = datetime.now(timezone.utc)
        db.session.commit()

        return AlertService._alerta_to_dict(alerta)

    @staticmethod
    def eliminar_alerta(alerta_id: int, user_id: int) -> dict:
        """
        Elimina una alerta.

        Raises:
            ValueError: si la alerta no existe.
        """
        alerta = AlertService._get_alerta(alerta_id, user_id)
        db.session.delete(alerta)
        db.session.commit()
        return {"mensaje": f"Alerta {alerta_id} eliminada correctamente."}

    @staticmethod
    def toggle_alerta(alerta_id: int, user_id: int) -> dict:
        """
        Activa/desactiva una alerta.

        Raises:
            ValueError: si la alerta no existe.
        """
        alerta = AlertService._get_alerta(alerta_id, user_id)
        alerta.activa = not alerta.activa
        alerta.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return AlertService._alerta_to_dict(alerta)

    @staticmethod
    def listar_historial(
        user_id: int, page: int = 1, per_page: int = 20
    ) -> dict:
        """Devuelve el historial paginado de alertas disparadas."""
        paginacion = (
            AlertaHistorial.query
            .filter_by(user_id=user_id)
            .order_by(AlertaHistorial.timestamp.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return {
            "historial": [
                AlertService._historial_to_dict(h) for h in paginacion.items
            ],
            "total": paginacion.total,
            "pagina": paginacion.page,
            "por_pagina": paginacion.per_page,
            "paginas": paginacion.pages,
        }

    # ── Helpers internos ─────────────────────────────────────────

    @staticmethod
    def _get_alerta(alerta_id: int, user_id: int) -> Alerta:
        """
        Obtiene una alerta verificando que pertenezca al usuario.

        Raises:
            ValueError: si no se encuentra.
        """
        alerta = Alerta.query.filter_by(id=alerta_id, user_id=user_id).first()
        if alerta is None:
            raise ValueError(
                f"No se encontró la alerta con id {alerta_id} para este usuario."
            )
        return alerta

    @staticmethod
    def _alerta_to_dict(alerta: Alerta) -> dict:
        """Serializa una alerta a diccionario."""
        return {
            "id": alerta.id,
            "user_id": alerta.user_id,
            "ticker": alerta.ticker,
            "tipo": alerta.tipo,
            "condicion": alerta.condicion,
            "umbral": float(_dec(alerta.umbral)) if alerta.umbral is not None else None,
            "portafolio_id": alerta.portafolio_id,
            "activa": alerta.activa,
            "email_habilitado": alerta.email_habilitado,
            "created_at": alerta.created_at.isoformat() if alerta.created_at else None,
            "updated_at": alerta.updated_at.isoformat() if alerta.updated_at else None,
        }

    @staticmethod
    def _historial_to_dict(h: AlertaHistorial) -> dict:
        """Serializa un registro de historial a diccionario."""
        return {
            "id": h.id,
            "user_id": h.user_id,
            "alerta_id": h.alerta_id,
            "ticker": h.ticker,
            "tipo": h.tipo,
            "condicion": h.condicion,
            "valor_disparado": (
                float(_dec(h.valor_disparado))
                if h.valor_disparado is not None
                else None
            ),
            "timestamp": h.timestamp.isoformat() if h.timestamp else None,
            "canal": h.canal,
        }

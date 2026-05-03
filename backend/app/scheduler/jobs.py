"""
Jobs periódicos de APScheduler.

Define los jobs que se ejecutan en background para mantener
actualizados los precios, noticias, datos fiscales y alertas.

Requisitos cubiertos: 3.2, 3.3, 6.1, 6.2, 6.7
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from ..extensions import db, socketio
from ..models.portafolio import Posicion
from ..services import yfinance_service
from ..services.news_service import NewsService
from ..services.alert_service import AlertService
from ..services.banxico_service import BanxicoService

logger = logging.getLogger(__name__)


def _dec(value) -> Decimal:
    """Convierte un valor a Decimal de forma segura."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def prices_job():
    """
    Job de actualización de precios de mercado.

    Flujo:
        1. Consulta todos los tickers únicos de posiciones activas (cantidad > 0).
        2. Obtiene precios actuales vía yfinance_service.
        3. Actualiza precio_actual, valor_mercado, pnl_bruto, pnl_porcentual
           y ultima_actualizacion en cada posición.
        4. Emite eventos WebSocket prices_updated y portfolio_updated.

    Cron: lunes-viernes, 09:30–16:00 ET, cada 5 minutos.
    """
    logger.info("Iniciando job de actualización de precios...")

    try:
        # 1. Obtener tickers únicos de posiciones activas
        posiciones_activas = Posicion.query.filter(Posicion.cantidad > 0).all()

        if not posiciones_activas:
            logger.info("No hay posiciones activas para actualizar.")
            return

        tickers_unicos = list({pos.ticker for pos in posiciones_activas})
        logger.info(
            "Actualizando precios de %d tickers: %s",
            len(tickers_unicos),
            ", ".join(tickers_unicos),
        )

        # 2. Obtener precios actuales
        resultados_precios = yfinance_service.obtener_precios_multiples(tickers_unicos)

        # Crear mapa ticker -> resultado para acceso rápido
        precios_map = {}
        for resultado in resultados_precios:
            ticker = resultado.get("ticker")
            precio = resultado.get("precio")
            if ticker and precio is not None:
                precios_map[ticker] = resultado

        if not precios_map:
            logger.warning("No se obtuvieron precios para ningún ticker.")
            return

        # 3. Actualizar cada posición activa
        ahora = datetime.now(timezone.utc)
        portafolios_actualizados = set()

        for posicion in posiciones_activas:
            datos_precio = precios_map.get(posicion.ticker)
            if datos_precio is None:
                logger.warning(
                    "Sin precio disponible para '%s', omitiendo actualización.",
                    posicion.ticker,
                )
                continue

            precio_actual = _dec(datos_precio["precio"])
            cantidad = _dec(posicion.cantidad)
            precio_promedio = _dec(posicion.precio_promedio)

            posicion.precio_actual = precio_actual
            posicion.valor_mercado = precio_actual * cantidad
            posicion.pnl_bruto = (precio_actual - precio_promedio) * cantidad
            posicion.pnl_porcentual = (
                ((precio_actual - precio_promedio) / precio_promedio * 100)
                if precio_promedio > 0
                else Decimal("0")
            )
            posicion.ultima_actualizacion = ahora

            portafolios_actualizados.add(posicion.portafolio_id)

            # Emitir evento de precio actualizado por ticker
            socketio.emit(
                "prices_updated",
                {
                    "ticker": posicion.ticker,
                    "precio": float(precio_actual),
                    "cambio_pct": datos_precio.get("cambio_pct"),
                    "timestamp": ahora.isoformat(),
                },
                room=f"ticker_{posicion.ticker}",
            )

        # 4. Commit de todos los cambios
        db.session.commit()
        logger.info(
            "Precios actualizados correctamente para %d posiciones.",
            len(posiciones_activas),
        )

        # 5. Emitir evento de portafolio actualizado por cada portafolio afectado
        for portafolio_id in portafolios_actualizados:
            posiciones_port = Posicion.query.filter_by(
                portafolio_id=portafolio_id
            ).filter(Posicion.cantidad > 0).all()

            valor_total = sum(
                float(_dec(p.valor_mercado)) for p in posiciones_port
            )
            pnl_bruto = sum(
                float(_dec(p.pnl_bruto)) for p in posiciones_port
            )

            socketio.emit(
                "portfolio_updated",
                {
                    "portafolio_id": portafolio_id,
                    "valor_total": valor_total,
                    "pnl_bruto": pnl_bruto,
                    "timestamp": ahora.isoformat(),
                },
                room=f"portfolio_{portafolio_id}",
            )

    except Exception as e:
        logger.error("Error en job de actualización de precios: %s", str(e))
        db.session.rollback()


def news_job():
    """
    Job de actualización de noticias y semáforo de sentimiento.

    Flujo:
        1. Obtiene todos los tickers únicos de posiciones activas.
        2. Ejecuta actualizar_noticias() para cada ticker.
        3. Emite evento WebSocket news_updated tras cada actualización.

    Intervalo: cada 60 minutos.
    Requisitos: 6.1, 6.2, 6.7
    """
    logger.info("Iniciando job de actualización de noticias...")

    try:
        posiciones_activas = Posicion.query.filter(Posicion.cantidad > 0).all()

        if not posiciones_activas:
            logger.info("No hay posiciones activas para actualizar noticias.")
            return

        tickers_unicos = list({pos.ticker for pos in posiciones_activas})
        logger.info(
            "Actualizando noticias de %d tickers: %s",
            len(tickers_unicos),
            ", ".join(tickers_unicos),
        )

        ahora = datetime.now(timezone.utc)

        for ticker in tickers_unicos:
            try:
                semaforo = NewsService.actualizar_noticias(ticker)
                semaforo_data = NewsService.obtener_semaforo(ticker)

                socketio.emit("news_updated", {
                    "ticker": ticker,
                    "semaforo": semaforo,
                    "score": semaforo_data.get("score_promedio", 0.0),
                    "timestamp": ahora.isoformat(),
                })

                logger.info(
                    "Noticias actualizadas para '%s': semáforo=%s",
                    ticker, semaforo,
                )
            except Exception as e:
                logger.error(
                    "Error al actualizar noticias de '%s': %s", ticker, str(e)
                )

        logger.info("Job de noticias completado para %d tickers.", len(tickers_unicos))

    except Exception as e:
        logger.error("Error en job de actualización de noticias: %s", str(e))


def alerts_job():
    """
    Job de evaluación de alertas.

    Flujo:
        1. Llama a AlertService.evaluar_todas() para evaluar todas
           las alertas activas contra datos de mercado actuales.
        2. Las alertas que se cumplan se disparan automáticamente
           (historial + WebSocket + email si habilitado).

    Cron: lunes-viernes, 09:30–16:00 ET, cada 5 minutos.
    Sincronizado con prices_job para usar precios actualizados.
    Requisitos: 8.2
    """
    logger.info("Iniciando job de evaluación de alertas...")

    try:
        AlertService.evaluar_todas()
        logger.info("Job de alertas completado.")
    except Exception as e:
        logger.error("Error en job de evaluación de alertas: %s", str(e))


def fiscal_job():
    """
    Job de actualización de datos fiscales (Banxico).

    Flujo:
        1. Actualiza tipo de cambio USD/MXN.
        2. Actualiza INPC del mes actual y anterior.
        3. Emite evento WebSocket exchange_rate_updated con datos enriquecidos.

    Cron: diario a las 18:00 hora Ciudad de México.
    Requisitos: 9.6
    """
    logger.info("Iniciando job de actualización fiscal (Banxico)...")

    try:
        BanxicoService.actualizar_datos()

        # Emitir evento WebSocket con tipo de cambio actualizado
        try:
            tc_data = BanxicoService.obtener_tipo_cambio()
            socketio.emit("exchange_rate_updated", {
                "precio": tc_data.get("precio"),
                "usd_mxn": tc_data.get("usd_mxn"),
                "cambio_dia": tc_data.get("cambio_dia"),
                "cambio_pct": tc_data.get("cambio_pct"),
                "ultima_actualizacion": tc_data.get("ultima_actualizacion"),
                "fuente": tc_data.get("fuente"),
            })
            logger.info("Evento exchange_rate_updated emitido vía WebSocket.")
        except Exception as ws_err:
            logger.error(
                "Error al emitir exchange_rate_updated: %s", str(ws_err)
            )

        logger.info("Job fiscal completado correctamente.")
    except Exception as e:
        logger.error("Error en job de actualización fiscal: %s", str(e))


def registrar_jobs(scheduler, app):
    """
    Registra todos los jobs periódicos en el scheduler.

    Args:
        scheduler: Instancia de APScheduler BackgroundScheduler.
        app: Instancia de la aplicación Flask (para app_context).
    """

    def _prices_job_wrapper():
        """Wrapper que ejecuta prices_job dentro del contexto de la app."""
        with app.app_context():
            prices_job()

    scheduler.add_job(
        _prices_job_wrapper,
        trigger="cron",
        id="prices_job",
        day_of_week="mon-fri",
        hour="9-15",
        minute="*/5",
        second="0",
        timezone="America/New_York",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Agregar también la franja de 16:00 (última ejecución del día)
    scheduler.add_job(
        _prices_job_wrapper,
        trigger="cron",
        id="prices_job_close",
        day_of_week="mon-fri",
        hour="16",
        minute="0",
        second="0",
        timezone="America/New_York",
        replace_existing=True,
        misfire_grace_time=60,
    )

    logger.info("Job de precios registrado: lunes-viernes 09:30-16:00 ET, cada 5 min.")

    # ── News job: cada 60 minutos (Req 6.1, 6.2) ──────────────────
    def _news_job_wrapper():
        """Wrapper que ejecuta news_job dentro del contexto de la app."""
        with app.app_context():
            news_job()

    scheduler.add_job(
        _news_job_wrapper,
        trigger="interval",
        id="news_job",
        minutes=60,
        replace_existing=True,
        misfire_grace_time=120,
    )

    logger.info("Job de noticias registrado: cada 60 minutos.")

    # ── Fiscal job: diario a las 18:00 CDMX (Req 9.6) ──────────
    def _fiscal_job_wrapper():
        """Wrapper que ejecuta fiscal_job dentro del contexto de la app."""
        with app.app_context():
            fiscal_job()

    scheduler.add_job(
        _fiscal_job_wrapper,
        trigger="cron",
        id="fiscal_job",
        hour=18,
        minute=0,
        timezone="America/Mexico_City",
        replace_existing=True,
        misfire_grace_time=120,
    )

    logger.info("Job fiscal registrado: diario a las 18:00 CDMX.")

    # ── Alerts job: lunes-viernes 09:30-16:00 ET, cada 5 min (Req 8.2) ──
    def _alerts_job_wrapper():
        """Wrapper que ejecuta alerts_job dentro del contexto de la app."""
        with app.app_context():
            alerts_job()

    scheduler.add_job(
        _alerts_job_wrapper,
        trigger="cron",
        id="alerts_job",
        day_of_week="mon-fri",
        hour="9-15",
        minute="*/5",
        second="0",
        timezone="America/New_York",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Agregar también la franja de 16:00 para alertas
    scheduler.add_job(
        _alerts_job_wrapper,
        trigger="cron",
        id="alerts_job_close",
        day_of_week="mon-fri",
        hour="16",
        minute="0",
        second="0",
        timezone="America/New_York",
        replace_existing=True,
        misfire_grace_time=60,
    )

    logger.info("Job de alertas registrado: lunes-viernes 09:30-16:00 ET, cada 5 min.")


    # ── Universo enrichment job: semanal, domingos a las 02:00 UTC ──
    def _universo_job_wrapper():
        """Enriquece tickers del universo con datos de yfinance."""
        with app.app_context():
            try:
                from ..services.universo_service import UniversoService
                from ..models.universo import UniversoTicker

                # Auto-seed if empty
                if UniversoTicker.query.count() == 0:
                    UniversoService.seed_inicial()

                # Enrich in batches of 30
                UniversoService.enriquecer_desde_yfinance(max_tickers=30)
                logger.info("Job de enriquecimiento de universo completado.")
            except Exception as e:
                logger.error("Error en job de universo: %s", str(e))

    scheduler.add_job(
        _universo_job_wrapper,
        trigger="cron",
        id="universo_job",
        day_of_week="sun",
        hour=2,
        minute=0,
        timezone="UTC",
        replace_existing=True,
        misfire_grace_time=300,
    )

    logger.info("Job de universo registrado: domingos a las 02:00 UTC.")

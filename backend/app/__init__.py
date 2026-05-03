"""
Factory function para la aplicación Flask.

Usa el patrón Application Factory para permitir múltiples instancias
(testing, desarrollo, producción) y registro limpio de extensiones.
"""

import os

from flask import Flask

from .config import BaseConfig, config_by_name
from .extensions import db, migrate, socketio
from .extensions import scheduler as _scheduler


def create_app(config_name=None):
    """
    Crea y configura la aplicación Flask.

    Args:
        config_name: Nombre del entorno ('development' o 'production').
                     Si es None, se lee de la variable FLASK_ENV (default: development).

    Returns:
        Instancia de Flask configurada con extensiones y blueprints.
    """
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name.get(config_name, config_by_name["development"]))

    # ── Extensiones ──────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app, cors_allowed_origins="*", async_mode="eventlet")

    # ── Logging ──────────────────────────────────────────────────
    BaseConfig.init_logging(app)

    # ── Blueprints ───────────────────────────────────────────────
    from .api.portafolios import portafolios_bp
    app.register_blueprint(portafolios_bp)
    from .api.analisis import analisis_bp
    app.register_blueprint(analisis_bp)
    from .api.noticias import noticias_bp
    app.register_blueprint(noticias_bp)
    from .api.wizard import wizard_bp
    app.register_blueprint(wizard_bp)
    from .api.alertas import alertas_bp
    app.register_blueprint(alertas_bp)
    from .api.widgets import widgets_bp
    app.register_blueprint(widgets_bp)
    from .api.fiscal import fiscal_bp
    app.register_blueprint(fiscal_bp)
    from .api.busqueda import busqueda_bp
    app.register_blueprint(busqueda_bp)
    from .api.optimizador import optimizador_bp
    app.register_blueprint(optimizador_bp)
    from .api.simulaciones import simulaciones_bp
    app.register_blueprint(simulaciones_bp)
    from .api.configuracion import configuracion_bp
    app.register_blueprint(configuracion_bp)

    # ── Crear tablas automáticamente (Req 11.4) ──────────────────
    with app.app_context():
        # Importar modelos para que SQLAlchemy los registre
        from .models import portafolio, alerta, noticia, widget, cache, universo, simulacion, configuracion  # noqa: F401
        db.create_all()

        # Verificar que las tablas críticas existen
        import logging
        _log = logging.getLogger(__name__)
        from sqlalchemy import inspect as sa_inspect
        inspector = sa_inspect(db.engine)
        tables = inspector.get_table_names()
        _log.info("DB inicializada: %d tablas (%s)", len(tables), ", ".join(sorted(tables)[:5]) + ("..." if len(tables) > 5 else ""))

    # ── WebSocket event handlers ────────────────────────────────
    from .sockets import events  # noqa: F401

    # ── Scheduler (se inicia solo si no está corriendo) ──────────
    if not _scheduler.running:
        _scheduler.start()

    # ── Registrar jobs periódicos ────────────────────────────────
    from .scheduler.jobs import registrar_jobs
    registrar_jobs(_scheduler, app)

    app.logger.info("Lakshmi Q2 iniciada en modo %s", config_name)

    return app

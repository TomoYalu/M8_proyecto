"""
Configuración de la aplicación Flask por entorno.

Incluye configuración de logging a archivo (logs/lakshmi.log) y consola.
"""

import os
import logging
from logging.handlers import RotatingFileHandler


class BaseConfig:
    """Configuración base compartida por todos los entornos."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Ruta de la DB SQLite relativa al directorio del backend
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, 'lakshmi.db')}",
    )

    # Variables SMTP (opcionales, para alertas por email)
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

    # Token Banxico API
    BANXICO_TOKEN = os.environ.get("BANXICO_TOKEN", "")

    # Logging
    LOG_DIR = os.path.join(BASE_DIR, "logs")
    LOG_FILE = os.path.join(LOG_DIR, "lakshmi.log")
    LOG_LEVEL = logging.INFO

    @staticmethod
    def init_logging(app):
        """Configura logging a archivo rotativo y consola."""
        # Crear directorio de logs si no existe
        os.makedirs(BaseConfig.LOG_DIR, exist_ok=True)

        # Formato compartido
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
        )

        # Handler de archivo rotativo (5 MB, 3 backups)
        file_handler = RotatingFileHandler(
            BaseConfig.LOG_FILE,
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(app.config.get("LOG_LEVEL", logging.INFO))

        # Handler de consola
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(app.config.get("LOG_LEVEL", logging.INFO))

        # Aplicar al logger de la app
        app.logger.addHandler(file_handler)
        app.logger.addHandler(console_handler)
        app.logger.setLevel(app.config.get("LOG_LEVEL", logging.INFO))


class DevelopmentConfig(BaseConfig):
    """Configuración para desarrollo local."""

    DEBUG = True
    LOG_LEVEL = logging.DEBUG


class ProductionConfig(BaseConfig):
    """Configuración para producción (Docker / Gunicorn)."""

    DEBUG = False
    LOG_LEVEL = logging.WARNING


# Mapa de entornos para selección dinámica
config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}

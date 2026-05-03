# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Infraestructura
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Instancias de extensiones Flask compartidas.

Se inicializan aquí sin app para permitir el factory pattern.
Se vinculan a la app en create_app() via init_app().
"""

from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_migrate import Migrate
from apscheduler.schedulers.background import BackgroundScheduler

# ORM y migraciones
db = SQLAlchemy()
migrate = Migrate()

# WebSocket con soporte eventlet
socketio = SocketIO()

# Scheduler para jobs periódicos (precios, noticias, fiscal, alertas)
scheduler = BackgroundScheduler()

# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Infraestructura
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Punto de entrada para ejecutar Lakshmi Q2 en desarrollo.

En producción se usa Gunicorn + eventlet (ver gunicorn.conf.py).
"""

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=app.config.get("DEBUG", False))

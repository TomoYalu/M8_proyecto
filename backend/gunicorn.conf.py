# =============================================================================
# Lakshmi Q2 — Gunicorn Configuration
# Worker class: eventlet (requerido para Flask-SocketIO / WebSocket)
# =============================================================================

# Bind a todas las interfaces en puerto 5000
bind = "0.0.0.0:5000"

# Worker class eventlet para soporte de WebSocket
worker_class = "eventlet"

# Un solo worker para eventlet (maneja concurrencia internamente)
workers = 1

# Timeout generoso para operaciones de yfinance/Banxico
timeout = 120

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

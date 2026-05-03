# =============================================================================
# Lakshmi Q2 — Backend Dockerfile
# Python 3.11-slim + Gunicorn + eventlet (WebSocket support)
# Expone puerto 5000
# =============================================================================

FROM python:3.11-slim

# Evitar prompts interactivos y buffering de stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar paquetes Python
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python primero (cache de Docker layers)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente del backend
COPY . .

# Crear directorios para datos persistentes
RUN mkdir -p /app/logs /app/data

EXPOSE 5000

# Ejecutar con Gunicorn + eventlet para soporte de WebSocket
CMD ["gunicorn", "--config", "gunicorn.conf.py", "run:app"]

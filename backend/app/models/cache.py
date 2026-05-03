# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Modelos de Datos
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Modelos SQLAlchemy para tablas de caché.

Almacenan datos de precios, INPC, tipo de cambio y ciclo económico
para reducir llamadas a APIs externas (yfinance, Banxico).
"""

from datetime import datetime, timezone

from ..extensions import db


class PrecioCache(db.Model):
    """Caché de último precio conocido por ticker."""

    __tablename__ = "precios_cache"

    ticker = db.Column(db.String(20), primary_key=True)
    precio = db.Column(db.Numeric(18, 6), nullable=False)
    cambio_pct = db.Column(db.Numeric(10, 4))
    mercado = db.Column(db.String(10), nullable=False, default="NYSE")
    ultima_actualizacion = db.Column(db.DateTime, nullable=False)
    es_delay = db.Column(db.Boolean, nullable=False, default=False)

    def __repr__(self):
        return f"<PrecioCache {self.ticker} ${self.precio}>"


class InpcCache(db.Model):
    """Caché de INPC mensual histórico (Banxico)."""

    __tablename__ = "inpc_cache"

    anio = db.Column(db.Integer, primary_key=True)
    mes = db.Column(db.Integer, primary_key=True)
    valor = db.Column(db.Numeric(10, 4), nullable=False)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<InpcCache {self.anio}-{self.mes:02d} {self.valor}>"


class TipoCambioCache(db.Model):
    """Caché de tipo de cambio USD/MXN (singleton, id=1)."""

    __tablename__ = "tipo_cambio_cache"

    id = db.Column(db.Integer, primary_key=True)
    usd_mxn = db.Column(db.Numeric(10, 4), nullable=False)
    usd_mxn_anterior = db.Column(db.Numeric(10, 4), nullable=True)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.CheckConstraint("id = 1", name="ck_tipo_cambio_cache_singleton"),
    )

    def __repr__(self):
        return f"<TipoCambioCache USD/MXN={self.usd_mxn}>"


class CicloCache(db.Model):
    """Caché de fase del ciclo económico (singleton, id=1)."""

    __tablename__ = "ciclo_cache"

    id = db.Column(db.Integer, primary_key=True)
    fase = db.Column(db.String(20), nullable=False)
    indicadores = db.Column(db.JSON, nullable=False)
    fuente = db.Column(db.String(20), nullable=False)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.CheckConstraint("id = 1", name="ck_ciclo_cache_singleton"),
        db.CheckConstraint(
            "fase IN ('Early', 'Mid', 'Late', 'Recession')",
            name="ck_ciclo_cache_fase",
        ),
        db.CheckConstraint(
            "fuente IN ('dinamico', 'estatico')",
            name="ck_ciclo_cache_fuente",
        ),
    )

    def __repr__(self):
        return f"<CicloCache fase={self.fase} fuente={self.fuente}>"

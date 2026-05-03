# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Modelos de Datos
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Modelos SQLAlchemy para simulaciones de portafolios.

Permite crear portafolios hipotéticos con tickers y pesos objetivo
antes de ejecutar transacciones reales.
"""

from datetime import datetime, timezone

from ..extensions import db


class Simulacion(db.Model):
    """Portafolio hipotético para planificación."""

    __tablename__ = "simulaciones"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1, index=True)
    nombre = db.Column(db.String(100), nullable=False)
    capital_total = db.Column(db.Numeric(18, 2), nullable=False)
    moneda = db.Column(db.String(3), nullable=False, default="USD")
    estado = db.Column(db.String(20), nullable=False, default="simulada")
    portafolio_origen_id = db.Column(
        db.Integer, db.ForeignKey("portafolios.id"), nullable=True
    )
    portafolio_resultado_id = db.Column(
        db.Integer, db.ForeignKey("portafolios.id"), nullable=True
    )
    fecha_creacion = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    fecha_ejecucion = db.Column(db.DateTime, nullable=True)

    # Relación con activos de la simulación
    activos = db.relationship(
        "SimulacionActivo",
        backref="simulacion",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    __table_args__ = (
        db.CheckConstraint(
            "estado IN ('simulada', 'ejecutada')",
            name="ck_simulacion_estado",
        ),
    )

    def __repr__(self):
        return f"<Simulacion {self.id} '{self.nombre}'>"


class SimulacionActivo(db.Model):
    """Activo dentro de una simulación con peso objetivo."""

    __tablename__ = "simulacion_activos"

    id = db.Column(db.Integer, primary_key=True)
    simulacion_id = db.Column(
        db.Integer,
        db.ForeignKey("simulaciones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticker = db.Column(db.String(20), nullable=False)
    peso_objetivo = db.Column(db.Numeric(8, 4), nullable=False)
    precio_spot = db.Column(db.Numeric(18, 6), nullable=True)
    acciones_calculadas = db.Column(db.Integer, nullable=True)
    monto_calculado = db.Column(db.Numeric(18, 2), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("simulacion_id", "ticker"),
    )

    def __repr__(self):
        return f"<SimulacionActivo {self.id} {self.ticker} {self.peso_objetivo}%>"

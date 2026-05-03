# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Modelos de Datos
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Modelos SQLAlchemy para alertas y su historial de disparos.

Soporta 9 tipos de alerta con condiciones configurables y
notificación por WebSocket y/o email.
"""

from datetime import datetime, timezone

from ..extensions import db


class Alerta(db.Model):
    """Alerta configurable por ticker con condición y umbral."""

    __tablename__ = "alertas"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1, index=True)
    ticker = db.Column(db.String(20), nullable=False, index=True)
    tipo = db.Column(db.String(50), nullable=False)
    condicion = db.Column(db.String(10), nullable=False)
    umbral = db.Column(db.Numeric(18, 6))
    portafolio_id = db.Column(
        db.Integer,
        db.ForeignKey("portafolios.id", ondelete="CASCADE"),
    )
    activa = db.Column(db.Boolean, nullable=False, default=True)
    email_habilitado = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.CheckConstraint(
            "condicion IN ('mayor_que', 'menor_que', 'igual')",
            name="ck_alertas_condicion",
        ),
    )

    def __repr__(self):
        return f"<Alerta {self.id} {self.ticker} {self.tipo}>"


class AlertaHistorial(db.Model):
    """Registro histórico de alertas disparadas."""

    __tablename__ = "alertas_historial"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1, index=True)
    alerta_id = db.Column(
        db.Integer,
        db.ForeignKey("alertas.id", ondelete="SET NULL"),
    )
    ticker = db.Column(db.String(20), nullable=False)
    tipo = db.Column(db.String(50), nullable=False)
    condicion = db.Column(db.Text, nullable=False)
    valor_disparado = db.Column(db.Numeric(18, 6))
    timestamp = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    canal = db.Column(db.String(20), nullable=False)

    __table_args__ = (
        db.CheckConstraint(
            "canal IN ('websocket', 'email', 'ambos')",
            name="ck_alertas_historial_canal",
        ),
    )

    def __repr__(self):
        return f"<AlertaHistorial {self.id} {self.ticker} {self.tipo}>"

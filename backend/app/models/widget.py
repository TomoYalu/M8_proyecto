# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Modelos de Datos
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Modelo SQLAlchemy para configuración de widgets del dashboard.

Persiste posición, tamaño y visibilidad de cada widget por usuario.
"""

from datetime import datetime, timezone

from ..extensions import db


class WidgetConfig(db.Model):
    """Configuración de layout de un widget individual."""

    __tablename__ = "widget_config"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1)
    widget_id = db.Column(db.String(50), nullable=False)
    x = db.Column(db.Integer, nullable=False, default=0)
    y = db.Column(db.Integer, nullable=False, default=0)
    w = db.Column(db.Integer, nullable=False, default=6)
    h = db.Column(db.Integer, nullable=False, default=4)
    visible = db.Column(db.Boolean, nullable=False, default=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (db.UniqueConstraint("user_id", "widget_id"),)

    def __repr__(self):
        return f"<WidgetConfig {self.id} widget={self.widget_id}>"

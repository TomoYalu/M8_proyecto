"""Modelo de configuración de usuario (capital global)."""

from datetime import datetime, timezone

from ..extensions import db


class ConfiguracionUsuario(db.Model):
    """Capital global y moneda base del usuario."""

    __tablename__ = "configuracion_usuario"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, unique=True, default=1)
    capital_global = db.Column(db.Numeric(18, 2), nullable=False, default=0)
    moneda_base = db.Column(db.String(3), nullable=False, default="MXN")
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self):
        return f"<ConfiguracionUsuario user={self.user_id} capital={self.capital_global}>"

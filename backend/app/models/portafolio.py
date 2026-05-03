"""
Modelos SQLAlchemy para portafolios, posiciones y transacciones.

Esquema preparado para multiusuario con user_id (default 1).
"""

from datetime import datetime, timezone

from ..extensions import db


class Portafolio(db.Model):
    """Portafolio de inversión nombrado, perteneciente a un usuario."""

    __tablename__ = "portafolios"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1, index=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text)
    moneda = db.Column(db.String(3), nullable=False, default="MXN")
    capital_inicial = db.Column(db.Numeric(18, 2), nullable=False, default=0)
    fecha_creacion = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relaciones con cascada para eliminación completa
    posiciones = db.relationship(
        "Posicion",
        backref="portafolio",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    transacciones = db.relationship(
        "Transaccion",
        backref="portafolio",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    __table_args__ = (db.UniqueConstraint("user_id", "nombre"),)

    def __repr__(self):
        return f"<Portafolio {self.id} '{self.nombre}'>"


class Posicion(db.Model):
    """Tenencia actual de un ticker dentro de un portafolio."""

    __tablename__ = "posiciones"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1)
    portafolio_id = db.Column(
        db.Integer,
        db.ForeignKey("portafolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticker = db.Column(db.String(20), nullable=False, index=True)
    cantidad = db.Column(db.Numeric(18, 6), nullable=False, default=0)
    precio_promedio = db.Column(db.Numeric(18, 6), nullable=False, default=0)
    costo_total = db.Column(db.Numeric(18, 6), nullable=False, default=0)
    precio_actual = db.Column(db.Numeric(18, 6))
    valor_mercado = db.Column(db.Numeric(18, 6))
    pnl_bruto = db.Column(db.Numeric(18, 6))
    pnl_porcentual = db.Column(db.Numeric(10, 4))
    dividendos_acumulados = db.Column(db.Numeric(18, 6), nullable=False, default=0)
    moneda = db.Column(db.String(3), nullable=False, default="USD")
    ultima_actualizacion = db.Column(db.DateTime)

    __table_args__ = (db.UniqueConstraint("portafolio_id", "ticker"),)

    def __repr__(self):
        return f"<Posicion {self.id} {self.ticker} x{self.cantidad}>"


class Transaccion(db.Model):
    """Registro de compra, venta o dividendo asociado a un ticker."""

    __tablename__ = "transacciones"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1)
    portafolio_id = db.Column(
        db.Integer,
        db.ForeignKey("portafolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticker = db.Column(db.String(20), nullable=False, index=True)
    tipo = db.Column(db.String(20), nullable=False)
    fecha = db.Column(db.Date, nullable=False)
    precio_unitario = db.Column(db.Numeric(18, 6), nullable=False)
    cantidad = db.Column(db.Numeric(18, 6), nullable=False)
    comision = db.Column(db.Numeric(18, 6), nullable=False, default=0)
    moneda = db.Column(db.String(3), nullable=False, default="USD")
    ganancia_perdida = db.Column(db.Numeric(18, 6))
    notas = db.Column(db.Text)
    estado = db.Column(db.String(20), nullable=False, default="confirmada")
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.CheckConstraint(
            "tipo IN ('compra', 'venta', 'dividendo')",
            name="ck_transacciones_tipo",
        ),
    )

    def __repr__(self):
        return f"<Transaccion {self.id} {self.tipo} {self.ticker}>"

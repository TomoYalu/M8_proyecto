"""
Modelo SQLAlchemy para el universo de tickers.

Almacena todos los tickers disponibles con su clasificación,
sector, región e índices. Reemplaza las constantes hardcodeadas.
Se actualiza dinámicamente via yfinance.
"""

from datetime import datetime, timezone

from ..extensions import db


class UniversoTicker(db.Model):
    """Ticker del universo de inversión con metadatos."""

    __tablename__ = "universo_tickers"

    ticker = db.Column(db.String(20), primary_key=True)
    nombre = db.Column(db.String(200), nullable=False, default="")
    tipo = db.Column(
        db.String(20), nullable=False, default="accion",
        # accion, etf, commodity, bono, crypto
    )
    sector = db.Column(db.String(100), nullable=False, default="Sin clasificar")
    subsector = db.Column(db.String(100), nullable=True)
    region = db.Column(db.String(50), nullable=False, default="EE.UU.")
    indices = db.Column(db.JSON, nullable=False, default=list)
    # JSON array: ["S&P 500", "NASDAQ 100"]
    market_cap = db.Column(db.BigInteger, nullable=True)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    ultima_actualizacion = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.Index("ix_universo_tipo", "tipo"),
        db.Index("ix_universo_sector", "sector"),
        db.Index("ix_universo_region", "region"),
        db.Index("ix_universo_activo", "activo"),
    )

    def __repr__(self):
        return f"<UniversoTicker {self.ticker} ({self.tipo})>"

    def to_dict(self):
        return {
            "ticker": self.ticker,
            "nombre": self.nombre,
            "tipo": self.tipo,
            "sector": self.sector,
            "subsector": self.subsector,
            "region": self.region,
            "indices": self.indices or [],
            "market_cap": self.market_cap,
            "activo": self.activo,
        }

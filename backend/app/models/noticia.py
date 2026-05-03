"""
Modelo SQLAlchemy para noticias con score de sentimiento.

Almacena las últimas 50 noticias por ticker con clasificación
de sentimiento y sector.
"""

from datetime import datetime, timezone

from ..extensions import db


class Noticia(db.Model):
    """Noticia asociada a un ticker con score de sentimiento."""

    __tablename__ = "noticias"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, default=1)
    ticker = db.Column(db.String(20), nullable=False, index=True)
    titulo = db.Column(db.Text, nullable=False)
    url = db.Column(db.Text)
    fuente = db.Column(db.String(100))
    fecha_publicacion = db.Column(db.DateTime)
    score_sentimiento = db.Column(db.Numeric(5, 4))
    sector = db.Column(db.String(100))
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<Noticia {self.id} {self.ticker} '{self.titulo[:30]}...'>"

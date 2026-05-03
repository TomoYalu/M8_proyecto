# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Fixtures compartidas para tests del backend Lakshmi Q2.

Crea una app Flask de prueba con base de datos SQLite en memoria.
"""

import pytest

from app import create_app
from app.extensions import db as _db


@pytest.fixture(scope="session")
def app():
    """Crea la aplicación Flask configurada para testing."""
    app = create_app("development")
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })

    # Recrear tablas con la URI en memoria
    with app.app_context():
        _db.drop_all()
        _db.create_all()

    yield app


@pytest.fixture()
def db(app):
    """Proporciona una sesión de DB limpia para cada test."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture()
def client(app, db):
    """Cliente de prueba HTTP."""
    return app.test_client()

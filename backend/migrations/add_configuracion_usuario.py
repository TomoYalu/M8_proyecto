"""
Migración: Crear tabla configuracion_usuario para capital global.

Uso:
    python migrations/add_configuracion_usuario.py

Idempotente: no falla si la tabla ya existe.
"""

import sqlite3
import os
import sys


def migrate(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='configuracion_usuario'"
    )
    if cursor.fetchone():
        print("Tabla 'configuracion_usuario' ya existe. Nada que hacer.")
        conn.close()
        return

    cursor.execute("""
        CREATE TABLE configuracion_usuario (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE DEFAULT 1,
            capital_global NUMERIC(18,2) NOT NULL DEFAULT 0,
            moneda_base VARCHAR(3) NOT NULL DEFAULT 'MXN',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("Tabla 'configuracion_usuario' creada.")
    conn.close()


if __name__ == "__main__":
    default_db = os.path.join(os.path.dirname(__file__), "..", "lakshmi.db")
    db_path = sys.argv[1] if len(sys.argv) > 1 else default_db
    db_path = os.path.abspath(db_path)

    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada: {db_path}")
        sys.exit(1)

    print(f"Migrando: {db_path}")
    migrate(db_path)

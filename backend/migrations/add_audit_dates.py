"""
Migración: Agregar campos de auditoría (created_at, updated_at) a tablas.

- portafolios: updated_at
- posiciones: created_at, updated_at
- transacciones: updated_at

Uso:
    python migrations/add_audit_dates.py

Compatible con SQLite. Idempotente.
"""

import sqlite3
import os
import sys

# (tabla, columna, tipo SQL con default)
COLUMNS = [
    ("portafolios", "updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ("posiciones", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"),
    ("posiciones", "updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ("transacciones", "updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
]


def migrate(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    for tabla, columna, tipo in COLUMNS:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabla,)
        )
        if not cursor.fetchone():
            print(f"  Tabla '{tabla}' no existe aún. Se creará al iniciar la app.")
            continue

        cursor.execute(f"PRAGMA table_info({tabla})")
        columnas = [col[1] for col in cursor.fetchall()]

        if columna in columnas:
            print(f"  '{tabla}.{columna}' ya existe. Saltando.")
            continue

        cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo}")
        print(f"  '{tabla}.{columna}' agregada.")

    conn.commit()
    conn.close()
    print("Migración completada.")


if __name__ == "__main__":
    default_db = os.path.join(os.path.dirname(__file__), "..", "lakshmi.db")
    db_path = sys.argv[1] if len(sys.argv) > 1 else default_db
    db_path = os.path.abspath(db_path)

    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada: {db_path}")
        sys.exit(1)

    print(f"Migrando: {db_path}")
    migrate(db_path)

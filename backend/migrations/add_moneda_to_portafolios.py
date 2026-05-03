# Lakshmi Q2 - Gestión de Inversiones
# Módulo: General
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Migración: Agregar campo `moneda` a la tabla `portafolios`.

Uso:
    python migrations/add_moneda_to_portafolios.py

Compatible con SQLite (usa ADD COLUMN con DEFAULT).
Idempotente: no falla si la columna ya existe.
"""

import sqlite3
import os
import sys


def migrate(db_path: str) -> None:
    """Agrega la columna `moneda` a la tabla portafolios si no existe."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Verificar si la tabla existe
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='portafolios'"
    )
    if not cursor.fetchone():
        print("La tabla 'portafolios' no existe aún. Se creará con el campo 'moneda' al iniciar la app.")
        conn.close()
        return

    # Verificar si la columna ya existe
    cursor.execute("PRAGMA table_info(portafolios)")
    columnas = [col[1] for col in cursor.fetchall()]

    if "moneda" in columnas:
        print("La columna 'moneda' ya existe en 'portafolios'. Nada que hacer.")
        conn.close()
        return

    # Agregar columna con default 'USD'
    cursor.execute(
        "ALTER TABLE portafolios ADD COLUMN moneda VARCHAR(3) NOT NULL DEFAULT 'USD'"
    )
    conn.commit()
    print("Columna 'moneda' agregada exitosamente a 'portafolios' con default 'USD'.")
    conn.close()


if __name__ == "__main__":
    # Ruta por defecto al archivo de base de datos del proyecto
    default_db = os.path.join(
        os.path.dirname(__file__), "..", "lakshmi.db"
    )
    db_path = sys.argv[1] if len(sys.argv) > 1 else default_db
    db_path = os.path.abspath(db_path)

    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada: {db_path}")
        sys.exit(1)

    print(f"Migrando base de datos: {db_path}")
    migrate(db_path)

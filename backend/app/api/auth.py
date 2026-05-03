# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Autenticación
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-03
#
"""Rutas de autenticación: login, logout, me, register."""

import re

from flask import Blueprint, jsonify, request, session

from ..extensions import db
from ..models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Dominios de email permitidos (proveedores comunes)
_DOMINIOS_PERMITIDOS = {
    "gmail.com", "googlemail.com",
    "outlook.com", "hotmail.com", "live.com", "msn.com",
    "yahoo.com", "yahoo.com.mx",
    "icloud.com", "me.com", "mac.com",
    "protonmail.com", "proton.me",
    "aol.com",
}

# Regex RFC 5322 simplificado
_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9](?:[a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9\-]+(?:\.[a-zA-Z]{2,})+$"
)


def _validar_email(email):
    """Valida formato y dominio del email. Retorna (ok, error_msg)."""
    if not email:
        return False, "El correo electrónico es requerido."
    if len(email) > 254:
        return False, "El correo es demasiado largo."
    if not _EMAIL_RE.match(email):
        return False, "Formato de correo inválido."

    dominio = email.rsplit("@", 1)[1].lower()

    # Permitir dominios institucionales (.edu, .edu.mx, .gob.mx, etc.)
    if dominio in _DOMINIOS_PERMITIDOS:
        return True, None
    if any(dominio.endswith(ext) for ext in (".edu", ".edu.mx", ".gob", ".gob.mx", ".org", ".org.mx")):
        return True, None

    # Dominios corporativos: al menos 2 partes y TLD >= 2 chars
    partes = dominio.split(".")
    if len(partes) >= 2 and len(partes[-1]) >= 2:
        return True, None

    return False, "Dominio de correo no válido."


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Usuario y contraseña requeridos."}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Credenciales inválidas."}), 401

    session["user_id"] = user.id
    return jsonify(user.to_dict()), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"mensaje": "Sesión cerrada."}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "No autenticado."}), 401
    user = db.session.get(User, user_id)
    if not user:
        session.pop("user_id", None)
        return jsonify({"error": "No autenticado."}), 401
    return jsonify(user.to_dict()), 200


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    nombre = data.get("nombre", "").strip() or None

    if not username or not password:
        return jsonify({"error": "Usuario y contraseña requeridos."}), 400
    if len(username) < 3:
        return jsonify({"error": "El usuario debe tener al menos 3 caracteres."}), 400
    if len(password) < 4:
        return jsonify({"error": "La contraseña debe tener al menos 4 caracteres."}), 400

    ok, err = _validar_email(email)
    if not ok:
        return jsonify({"error": err}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "El usuario ya existe."}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "El correo ya está registrado."}), 409

    user = User(username=username, email=email, nombre=nombre)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session["user_id"] = user.id
    return jsonify(user.to_dict()), 201

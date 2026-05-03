# Lakshmi Q2 - Gestión de Inversiones
# Módulo: General
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Servicio de email SMTP para notificaciones de alertas.

Envía correos electrónicos cuando se dispara una alerta con email habilitado.
Usa smtplib con configuración desde variables de entorno.

Si SMTP falla: registra error en log, continúa sin interrumpir WebSocket.

Requisitos cubiertos: 8.4, 8.7
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app

logger = logging.getLogger(__name__)


def _construir_email(alerta, datos: dict) -> tuple[str, str]:
    """
    Construye asunto y cuerpo del email en español.

    Args:
        alerta: Instancia del modelo Alerta.
        datos: Dict con valor_actual, umbral, descripcion.

    Returns:
        Tupla (asunto, cuerpo_html).
    """
    tipo_nombres = {
        "precio_objetivo": "Precio Objetivo",
        "cambio_pct_dia": "Cambio Porcentual Diario",
        "rsi_sobrecompra": "RSI Sobrecompra",
        "rsi_sobreventa": "RSI Sobreventa",
        "golden_cross": "Golden Cross",
        "death_cross": "Death Cross",
        "divergencia_macd": "Divergencia MACD",
        "semaforo_rojo": "Semáforo Rojo",
        "concentracion": "Concentración Excesiva",
    }

    tipo_nombre = tipo_nombres.get(alerta.tipo, alerta.tipo)
    descripcion = datos.get("descripcion", f"Alerta {alerta.tipo} para {alerta.ticker}")

    asunto = f"🔔 Lakshmi Alerta: {tipo_nombre} — {alerta.ticker}"

    cuerpo = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #141b2d; border-radius: 8px; padding: 24px;">
            <h2 style="color: #3b82f6; margin-top: 0;">🔔 Alerta Disparada</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;">Ticker:</td>
                    <td style="padding: 8px 0; font-weight: bold;">{alerta.ticker}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;">Tipo de Alerta:</td>
                    <td style="padding: 8px 0;">{tipo_nombre}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #94a3b8;">Detalle:</td>
                    <td style="padding: 8px 0;">{descripcion}</td>
                </tr>
            </table>
            <hr style="border-color: #1e293b; margin: 16px 0;">
            <p style="color: #64748b; font-size: 12px;">
                Este correo fue enviado automáticamente por Lakshmi Q2.
                Puede desactivar las notificaciones por email desde la configuración de alertas.
            </p>
        </div>
    </body>
    </html>
    """

    return asunto, cuerpo


def enviar_alerta(alerta, datos: dict) -> bool:
    """
    Envía un email de notificación de alerta vía SMTP.

    Args:
        alerta: Instancia del modelo Alerta.
        datos: Dict con valor_actual, umbral, descripcion.

    Returns:
        True si el envío fue exitoso, False en caso contrario.

    Raises:
        Exception: si SMTP falla (el caller debe manejar el error).
    """
    try:
        smtp_host = current_app.config.get("SMTP_HOST", "")
        smtp_port = current_app.config.get("SMTP_PORT", 587)
        smtp_user = current_app.config.get("SMTP_USER", "")
        smtp_password = current_app.config.get("SMTP_PASSWORD", "")

        if not smtp_host or not smtp_user:
            logger.warning(
                "SMTP no configurado. No se puede enviar email para alerta %d.",
                alerta.id,
            )
            return False

        asunto, cuerpo = _construir_email(alerta, datos)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = asunto
        msg["From"] = smtp_user
        msg["To"] = smtp_user  # En modo single-user, enviar al mismo usuario SMTP

        msg.attach(MIMEText(cuerpo, "html", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        logger.info(
            "Email de alerta enviado exitosamente para alerta %d (%s %s).",
            alerta.id, alerta.ticker, alerta.tipo,
        )
        return True

    except smtplib.SMTPException as e:
        logger.error(
            "Error SMTP al enviar email para alerta %d: %s",
            alerta.id, str(e),
        )
        raise
    except Exception as e:
        logger.error(
            "Error inesperado al enviar email para alerta %d: %s",
            alerta.id, str(e),
        )
        raise

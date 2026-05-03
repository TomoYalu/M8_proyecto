# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Fiscal
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Servicio para consumir la API de Banxico (Banco de México).

Obtiene INPC mensual histórico y tipo de cambio USD/MXN.
Almacena resultados en caché (inpc_cache, tipo_cambio_cache).
Fallback: si la API no está disponible, retorna último valor de caché.

Requisitos cubiertos: 9.2, 9.4, 9.7
"""

import logging
import os
from datetime import datetime, timezone
from decimal import Decimal

import requests

from ..extensions import db
from ..models.cache import InpcCache, TipoCambioCache

logger = logging.getLogger(__name__)

# ── Constantes de la API Banxico ─────────────────────────────────
_BANXICO_BASE = "https://www.banxico.org.mx/SieAPIRest/service/v1/series"
_INPC_SERIE = "SP1"
_TIPO_CAMBIO_SERIE = "SF43718"
_REQUEST_TIMEOUT = 15  # segundos


# ── Datos mock para cuando no hay token ──────────────────────────
_MOCK_INPC = {
    (2024, 1): Decimal("133.241"),
    (2024, 2): Decimal("133.765"),
    (2024, 3): Decimal("134.203"),
    (2024, 4): Decimal("134.652"),
    (2024, 5): Decimal("134.988"),
    (2024, 6): Decimal("135.436"),
    (2024, 7): Decimal("135.836"),
    (2024, 8): Decimal("136.268"),
    (2024, 9): Decimal("136.664"),
    (2024, 10): Decimal("137.186"),
    (2024, 11): Decimal("137.542"),
    (2024, 12): Decimal("137.895"),
    (2025, 1): Decimal("138.321"),
    (2025, 2): Decimal("138.756"),
    (2025, 3): Decimal("139.104"),
    (2025, 4): Decimal("139.489"),
    (2025, 5): Decimal("139.832"),
    (2025, 6): Decimal("140.215"),
}

_MOCK_TIPO_CAMBIO = Decimal("17.1520")


def _get_token() -> str:
    """Obtiene el token de Banxico desde la configuración."""
    return os.environ.get("BANXICO_TOKEN", "")


class BanxicoService:
    """Wrapper para la API de Banxico con caché en DB."""

    # ── INPC ─────────────────────────────────────────────────────

    @staticmethod
    def obtener_inpc(anio: int, mes: int) -> dict:
        """
        Obtiene el INPC para un año/mes específico.

        Flujo:
            1. Buscar en caché (inpc_cache).
            2. Si no existe, consultar API Banxico.
            3. Si API falla o no hay token, usar datos mock/estáticos.
            4. Almacenar resultado en caché.

        Returns:
            dict con claves: anio, mes, valor, updated_at, fuente
        """
        # 1. Buscar en caché
        cached = InpcCache.query.filter_by(anio=anio, mes=mes).first()
        if cached:
            return {
                "anio": cached.anio,
                "mes": cached.mes,
                "valor": float(cached.valor),
                "updated_at": cached.updated_at.isoformat(),
                "fuente": "cache",
            }

        # 2. Intentar API Banxico
        token = _get_token()
        if token:
            try:
                valor = BanxicoService._fetch_inpc_api(anio, mes, token)
                if valor is not None:
                    BanxicoService._guardar_inpc(anio, mes, valor)
                    return {
                        "anio": anio,
                        "mes": mes,
                        "valor": float(valor),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "fuente": "banxico_api",
                    }
            except Exception as e:
                logger.error(
                    "Error al consultar INPC de Banxico para %d-%02d: %s",
                    anio, mes, str(e),
                )

        # 3. Fallback: datos mock/estáticos
        mock_valor = _MOCK_INPC.get((anio, mes))
        if mock_valor is not None:
            BanxicoService._guardar_inpc(anio, mes, mock_valor)
            return {
                "anio": anio,
                "mes": mes,
                "valor": float(mock_valor),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "fuente": "datos_estaticos",
            }

        # 4. Último recurso: buscar el INPC más reciente en caché
        ultimo = (
            InpcCache.query
            .order_by(InpcCache.anio.desc(), InpcCache.mes.desc())
            .first()
        )
        if ultimo:
            return {
                "anio": ultimo.anio,
                "mes": ultimo.mes,
                "valor": float(ultimo.valor),
                "updated_at": ultimo.updated_at.isoformat(),
                "fuente": "cache_ultimo",
            }

        # Sin datos disponibles — retornar valor base
        return {
            "anio": anio,
            "mes": mes,
            "valor": 100.0,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "fuente": "valor_base",
        }

    @staticmethod
    def _fetch_inpc_api(anio: int, mes: int, token: str):
        """
        Consulta la API de Banxico para obtener el INPC de un mes.

        URL: /series/SP1/datos/{fecha_inicio}/{fecha_fin}?token={token}
        """
        fecha_inicio = f"{anio}-{mes:02d}-01"
        # Último día del mes (usar día 28 como seguro)
        fecha_fin = f"{anio}-{mes:02d}-28"

        url = f"{_BANXICO_BASE}/{_INPC_SERIE}/datos/{fecha_inicio}/{fecha_fin}"
        params = {"token": token}

        response = requests.get(url, params=params, timeout=_REQUEST_TIMEOUT)
        response.raise_for_status()

        data = response.json()
        series = data.get("bmx", {}).get("series", [])
        if not series:
            return None

        datos = series[0].get("datos", [])
        if not datos:
            return None

        # Tomar el último dato del período
        ultimo_dato = datos[-1]
        valor_str = ultimo_dato.get("dato", "").replace(",", "")
        if valor_str and valor_str != "N/E":
            return Decimal(valor_str)

        return None

    @staticmethod
    def _guardar_inpc(anio: int, mes: int, valor: Decimal):
        """Guarda o actualiza el INPC en caché."""
        try:
            existing = InpcCache.query.filter_by(anio=anio, mes=mes).first()
            if existing:
                existing.valor = valor
                existing.updated_at = datetime.now(timezone.utc)
            else:
                entry = InpcCache(
                    anio=anio,
                    mes=mes,
                    valor=valor,
                    updated_at=datetime.now(timezone.utc),
                )
                db.session.add(entry)
            db.session.commit()
        except Exception as e:
            logger.error("Error al guardar INPC en caché: %s", str(e))
            db.session.rollback()

    # ── Tipo de Cambio USD/MXN ───────────────────────────────────

    @staticmethod
    def _build_tipo_cambio_response(
        usd_mxn: float,
        usd_mxn_anterior,
        updated_at: str,
        fuente: str,
    ) -> dict:
        """
        Construye la respuesta enriquecida de tipo de cambio.

        Incluye precio, cambio del día (absoluto y porcentual),
        timestamp de última actualización y fuente.
        """
        cambio_dia = None
        cambio_pct = None
        if usd_mxn_anterior is not None:
            anterior = float(usd_mxn_anterior)
            if anterior > 0:
                cambio_dia = round(usd_mxn - anterior, 4)
                cambio_pct = round((usd_mxn - anterior) / anterior * 100, 4)

        return {
            "usd_mxn": usd_mxn,
            "precio": usd_mxn,
            "cambio_dia": cambio_dia,
            "cambio_pct": cambio_pct,
            "ultima_actualizacion": updated_at,
            "updated_at": updated_at,
            "fuente": fuente,
        }

    @staticmethod
    def obtener_tipo_cambio() -> dict:
        """
        Obtiene el tipo de cambio USD/MXN actual.

        Flujo:
            1. Intentar API Banxico.
            2. Si falla o no hay token, buscar en caché.
            3. Si no hay caché, usar dato mock/estático.

        Returns:
            dict con claves: usd_mxn, precio, cambio_dia, cambio_pct,
            ultima_actualizacion, updated_at, fuente
        """
        token = _get_token()

        # 1. Intentar API Banxico
        if token:
            try:
                valor = BanxicoService._fetch_tipo_cambio_api(token)
                if valor is not None:
                    BanxicoService._guardar_tipo_cambio(valor)
                    cached = db.session.get(TipoCambioCache, 1)
                    usd_mxn_anterior = (
                        float(cached.usd_mxn_anterior)
                        if cached and cached.usd_mxn_anterior is not None
                        else None
                    )
                    return BanxicoService._build_tipo_cambio_response(
                        usd_mxn=float(valor),
                        usd_mxn_anterior=usd_mxn_anterior,
                        updated_at=datetime.now(timezone.utc).isoformat(),
                        fuente="banxico_api",
                    )
            except Exception as e:
                logger.error(
                    "Error al consultar tipo de cambio de Banxico: %s", str(e)
                )

        # 2. Buscar en caché
        cached = db.session.get(TipoCambioCache, 1)
        if cached:
            usd_mxn_anterior = (
                float(cached.usd_mxn_anterior)
                if cached.usd_mxn_anterior is not None
                else None
            )
            return BanxicoService._build_tipo_cambio_response(
                usd_mxn=float(cached.usd_mxn),
                usd_mxn_anterior=usd_mxn_anterior,
                updated_at=cached.updated_at.isoformat(),
                fuente="cache",
            )

        # 3. Fallback: dato mock/estático
        BanxicoService._guardar_tipo_cambio(_MOCK_TIPO_CAMBIO)
        return BanxicoService._build_tipo_cambio_response(
            usd_mxn=float(_MOCK_TIPO_CAMBIO),
            usd_mxn_anterior=None,
            updated_at=datetime.now(timezone.utc).isoformat(),
            fuente="datos_estaticos",
        )

    @staticmethod
    def _fetch_tipo_cambio_api(token: str):
        """
        Consulta la API de Banxico para el tipo de cambio USD/MXN.

        URL: /series/SF43718/datos/oportuno?token={token}
        """
        url = f"{_BANXICO_BASE}/{_TIPO_CAMBIO_SERIE}/datos/oportuno"
        params = {"token": token}

        response = requests.get(url, params=params, timeout=_REQUEST_TIMEOUT)
        response.raise_for_status()

        data = response.json()
        series = data.get("bmx", {}).get("series", [])
        if not series:
            return None

        datos = series[0].get("datos", [])
        if not datos:
            return None

        ultimo_dato = datos[-1]
        valor_str = ultimo_dato.get("dato", "").replace(",", "")
        if valor_str and valor_str != "N/E":
            return Decimal(valor_str)

        return None

    @staticmethod
    def _guardar_tipo_cambio(valor: Decimal):
        """Guarda o actualiza el tipo de cambio en caché (singleton id=1).

        Preserva el valor anterior en ``usd_mxn_anterior`` para calcular
        el cambio diario que se muestra en el banner Bloomberg.
        """
        try:
            existing = db.session.get(TipoCambioCache, 1)
            if existing:
                # Guardar el valor actual como anterior antes de sobreescribir
                existing.usd_mxn_anterior = existing.usd_mxn
                existing.usd_mxn = valor
                existing.updated_at = datetime.now(timezone.utc)
            else:
                entry = TipoCambioCache(
                    id=1,
                    usd_mxn=valor,
                    usd_mxn_anterior=None,
                    updated_at=datetime.now(timezone.utc),
                )
                db.session.add(entry)
            db.session.commit()
        except Exception as e:
            logger.error("Error al guardar tipo de cambio en caché: %s", str(e))
            db.session.rollback()

    # ── Actualización masiva (para scheduler) ────────────────────

    @staticmethod
    def actualizar_datos():
        """
        Actualiza INPC reciente y tipo de cambio.
        Llamado por el scheduler fiscal diario.
        """
        ahora = datetime.now(timezone.utc)
        logger.info("Actualizando datos de Banxico...")

        # Actualizar tipo de cambio
        BanxicoService.obtener_tipo_cambio()

        # Actualizar INPC del mes actual y anterior
        BanxicoService.obtener_inpc(ahora.year, ahora.month)
        if ahora.month == 1:
            BanxicoService.obtener_inpc(ahora.year - 1, 12)
        else:
            BanxicoService.obtener_inpc(ahora.year, ahora.month - 1)

        logger.info("Datos de Banxico actualizados correctamente.")

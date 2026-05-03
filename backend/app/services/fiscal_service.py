"""
Servicio de cálculos fiscales para el contexto mexicano.

Implementa ISR 10%, ajuste por INPC, retención de dividendos,
conversión USD/MXN y tabla fiscal completa por portafolio.

Requisitos cubiertos: 9.1–9.5
"""

import logging
from datetime import date
from decimal import Decimal

from ..extensions import db
from ..models.portafolio import Portafolio, Posicion, Transaccion
from .banxico_service import BanxicoService

logger = logging.getLogger(__name__)

# ── Constantes fiscales ──────────────────────────────────────────
_ISR_TASA = Decimal("0.10")  # 10% ISR sobre ganancias de capital
_RETENCION_DIVIDENDOS_EXTRANJERO = Decimal("0.10")  # 10% retención
_RETENCION_DIVIDENDOS_MEXICANO = Decimal("0.00")  # 0% retención


def _dec(value) -> Decimal:
    """Convierte un valor a Decimal de forma segura."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


class FiscalService:
    """Servicio de cálculos fiscales mexicanos."""

    # ── ISR sobre ganancias de capital ───────────────────────────

    @staticmethod
    def calcular_pnl_neto(ganancia_bruta) -> dict:
        """
        Calcula P&L neto aplicando ISR 10% sobre ganancias positivas.

        ISR = ganancia × 10% si ganancia > 0, else 0.

        Args:
            ganancia_bruta: Ganancia bruta (Decimal o float).

        Returns:
            dict con claves: ganancia_bruta, isr_estimado, ganancia_neta
        """
        ganancia = _dec(ganancia_bruta)
        isr = ganancia * _ISR_TASA if ganancia > 0 else Decimal("0")
        ganancia_neta = ganancia - isr

        return {
            "ganancia_bruta": float(ganancia),
            "isr_estimado": float(isr),
            "ganancia_neta": float(ganancia_neta),
        }

    # ── Ajuste por INPC (ganancia real) ──────────────────────────

    @staticmethod
    def calcular_pnl_real(
        precio_venta, costo_original, fecha_compra, fecha_venta
    ) -> dict:
        """
        Calcula la ganancia real ajustada por inflación (INPC).

        factor = INPC_venta / INPC_compra
        costo_ajustado = costo_original × factor
        ganancia_real = precio_venta - costo_ajustado

        Args:
            precio_venta: Precio de venta.
            costo_original: Costo original de adquisición.
            fecha_compra: Fecha de compra (date o str YYYY-MM-DD).
            fecha_venta: Fecha de venta (date o str YYYY-MM-DD).

        Returns:
            dict con claves: precio_venta, costo_original, factor_inpc,
                             costo_ajustado, ganancia_real, inpc_compra, inpc_venta
        """
        precio_venta = _dec(precio_venta)
        costo_original = _dec(costo_original)

        # Parsear fechas
        if isinstance(fecha_compra, str):
            fecha_compra = date.fromisoformat(fecha_compra)
        if isinstance(fecha_venta, str):
            fecha_venta = date.fromisoformat(fecha_venta)

        # Obtener INPC de compra y venta
        inpc_compra_data = BanxicoService.obtener_inpc(
            fecha_compra.year, fecha_compra.month
        )
        inpc_venta_data = BanxicoService.obtener_inpc(
            fecha_venta.year, fecha_venta.month
        )

        inpc_compra = _dec(inpc_compra_data["valor"])
        inpc_venta = _dec(inpc_venta_data["valor"])

        # Calcular factor INPC
        if inpc_compra > 0:
            factor_inpc = inpc_venta / inpc_compra
        else:
            factor_inpc = Decimal("1")

        costo_ajustado = costo_original * factor_inpc
        ganancia_real = precio_venta - costo_ajustado

        return {
            "precio_venta": float(precio_venta),
            "costo_original": float(costo_original),
            "factor_inpc": float(factor_inpc),
            "costo_ajustado": float(costo_ajustado),
            "ganancia_real": float(ganancia_real),
            "inpc_compra": float(inpc_compra),
            "inpc_venta": float(inpc_venta),
        }

    # ── Retención de dividendos ──────────────────────────────────

    @staticmethod
    def calcular_dividendo_neto(dividendo_bruto, ticker: str) -> dict:
        """
        Calcula el dividendo neto después de retención.

        - Tickers sin .MX (extranjeros): retención 10%
        - Tickers con .MX (mexicanos): retención 0%

        Args:
            dividendo_bruto: Monto bruto del dividendo.
            ticker: Símbolo bursátil.

        Returns:
            dict con claves: dividendo_bruto, retencion, dividendo_neto,
                             tasa_retencion, es_mexicano
        """
        dividendo = _dec(dividendo_bruto)
        es_mexicano = ticker.upper().endswith(".MX")

        if es_mexicano:
            tasa = _RETENCION_DIVIDENDOS_MEXICANO
        else:
            tasa = _RETENCION_DIVIDENDOS_EXTRANJERO

        retencion = dividendo * tasa
        dividendo_neto = dividendo - retencion

        return {
            "dividendo_bruto": float(dividendo),
            "retencion": float(retencion),
            "dividendo_neto": float(dividendo_neto),
            "tasa_retencion": float(tasa),
            "es_mexicano": es_mexicano,
        }

    # ── Conversión USD/MXN ───────────────────────────────────────

    @staticmethod
    def convertir_usd_mxn(monto_usd) -> dict:
        """
        Convierte un monto de USD a MXN usando tipo de cambio Banxico.

        Args:
            monto_usd: Monto en dólares.

        Returns:
            dict con claves: monto_usd, monto_mxn, tipo_cambio, updated_at, fuente
        """
        monto = _dec(monto_usd)
        tc_data = BanxicoService.obtener_tipo_cambio()
        tipo_cambio = _dec(tc_data["usd_mxn"])
        monto_mxn = monto * tipo_cambio

        return {
            "monto_usd": float(monto),
            "monto_mxn": float(monto_mxn),
            "tipo_cambio": float(tipo_cambio),
            "updated_at": tc_data["updated_at"],
            "fuente": tc_data["fuente"],
        }

    # ── Tabla fiscal completa ────────────────────────────────────

    @staticmethod
    def tabla_fiscal(portafolio_id: int, user_id: int) -> dict:
        """
        Genera la tabla fiscal completa para un portafolio.

        Columnas por posición:
            Ticker, Ganancia Bruta, ISR Estimado, Ganancia Neta,
            Factor INPC, Ganancia Real (MXN constantes)

        Args:
            portafolio_id: ID del portafolio.
            user_id: ID del usuario.

        Returns:
            dict con claves: portafolio, posiciones (lista), resumen, tipo_cambio
        """
        portafolio = Portafolio.query.filter_by(
            id=portafolio_id, user_id=user_id
        ).first()
        if portafolio is None:
            raise ValueError(
                f"No se encontró el portafolio con id {portafolio_id} "
                "para este usuario."
            )

        posiciones = Posicion.query.filter_by(
            portafolio_id=portafolio_id
        ).all()

        # Obtener tipo de cambio actual
        tc_data = BanxicoService.obtener_tipo_cambio()
        tipo_cambio = _dec(tc_data["usd_mxn"])

        filas = []
        total_ganancia_bruta = Decimal("0")
        total_isr = Decimal("0")
        total_ganancia_neta = Decimal("0")
        total_ganancia_real = Decimal("0")

        for pos in posiciones:
            cantidad = _dec(pos.cantidad)
            if cantidad <= 0:
                continue

            precio_actual = _dec(pos.precio_actual)
            precio_promedio = _dec(pos.precio_promedio)
            costo_total = _dec(pos.costo_total)

            # Ganancia bruta
            ganancia_bruta = (precio_actual - precio_promedio) * cantidad

            # ISR
            pnl_neto = FiscalService.calcular_pnl_neto(ganancia_bruta)
            isr = _dec(pnl_neto["isr_estimado"])
            ganancia_neta = _dec(pnl_neto["ganancia_neta"])

            # Factor INPC — buscar fecha de primera compra
            primera_compra = (
                Transaccion.query
                .filter_by(
                    portafolio_id=portafolio_id,
                    ticker=pos.ticker,
                    tipo="compra",
                )
                .order_by(Transaccion.fecha.asc())
                .first()
            )

            factor_inpc = Decimal("1")
            ganancia_real_mxn = Decimal("0")

            if primera_compra:
                from datetime import date as date_type

                fecha_compra = primera_compra.fecha
                fecha_venta = date_type.today()

                inpc_compra_data = BanxicoService.obtener_inpc(
                    fecha_compra.year, fecha_compra.month
                )
                inpc_venta_data = BanxicoService.obtener_inpc(
                    fecha_venta.year, fecha_venta.month
                )

                inpc_compra = _dec(inpc_compra_data["valor"])
                inpc_venta = _dec(inpc_venta_data["valor"])

                if inpc_compra > 0:
                    factor_inpc = inpc_venta / inpc_compra

                costo_ajustado = costo_total * factor_inpc
                valor_mercado = precio_actual * cantidad
                ganancia_real = valor_mercado - costo_ajustado

                # Convertir a MXN si es USD
                if pos.moneda == "USD":
                    ganancia_real_mxn = ganancia_real * tipo_cambio
                else:
                    ganancia_real_mxn = ganancia_real
            else:
                # Sin transacciones de compra, usar ganancia bruta
                if pos.moneda == "USD":
                    ganancia_real_mxn = ganancia_bruta * tipo_cambio
                else:
                    ganancia_real_mxn = ganancia_bruta

            filas.append({
                "ticker": pos.ticker,
                "cantidad": float(cantidad),
                "moneda": pos.moneda,
                "ganancia_bruta": float(ganancia_bruta),
                "isr_estimado": float(isr),
                "ganancia_neta": float(ganancia_neta),
                "factor_inpc": float(round(factor_inpc, 6)),
                "ganancia_real_mxn": float(round(ganancia_real_mxn, 2)),
            })

            total_ganancia_bruta += ganancia_bruta
            total_isr += isr
            total_ganancia_neta += ganancia_neta
            total_ganancia_real += ganancia_real_mxn

        return {
            "portafolio": {
                "id": portafolio.id,
                "nombre": portafolio.nombre,
            },
            "posiciones": filas,
            "resumen": {
                "total_ganancia_bruta": float(total_ganancia_bruta),
                "total_isr_estimado": float(total_isr),
                "total_ganancia_neta": float(total_ganancia_neta),
                "total_ganancia_real_mxn": float(round(total_ganancia_real, 2)),
            },
            "tipo_cambio": {
                "usd_mxn": float(tipo_cambio),
                "updated_at": tc_data["updated_at"],
                "fuente": tc_data["fuente"],
            },
        }

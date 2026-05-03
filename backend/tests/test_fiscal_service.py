# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para FiscalService.

Verifica cálculos de ISR, ajuste INPC, retención de dividendos,
conversión USD/MXN y tabla fiscal completa.

Requisitos cubiertos: 9.1–9.5
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import patch

from app.services.fiscal_service import FiscalService
from app.models.portafolio import Portafolio, Posicion, Transaccion
from app.models.cache import InpcCache, TipoCambioCache


class TestCalcularPnlNeto:
    """Tests para FiscalService.calcular_pnl_neto()."""

    def test_isr_10_porciento_ganancia_positiva(self, db):
        """ISR = ganancia × 10% cuando ganancia > 0."""
        resultado = FiscalService.calcular_pnl_neto(1000)
        assert resultado["isr_estimado"] == 100.0
        assert resultado["ganancia_neta"] == 900.0

    def test_isr_cero_ganancia_negativa(self, db):
        """ISR = 0 cuando ganancia ≤ 0."""
        resultado = FiscalService.calcular_pnl_neto(-500)
        assert resultado["isr_estimado"] == 0.0
        assert resultado["ganancia_neta"] == -500.0

    def test_isr_cero_ganancia_cero(self, db):
        """ISR = 0 cuando ganancia = 0."""
        resultado = FiscalService.calcular_pnl_neto(0)
        assert resultado["isr_estimado"] == 0.0
        assert resultado["ganancia_neta"] == 0.0

    def test_isr_con_decimal(self, db):
        """ISR se calcula correctamente con valores decimales."""
        resultado = FiscalService.calcular_pnl_neto(1234.56)
        assert abs(resultado["isr_estimado"] - 123.456) < 0.01
        assert abs(resultado["ganancia_neta"] - 1111.104) < 0.01


class TestCalcularDividendoNeto:
    """Tests para FiscalService.calcular_dividendo_neto()."""

    def test_retencion_10_extranjero(self, db):
        """Tickers sin .MX tienen retención del 10%."""
        resultado = FiscalService.calcular_dividendo_neto(100, "AAPL")
        assert resultado["retencion"] == 10.0
        assert resultado["dividendo_neto"] == 90.0
        assert resultado["tasa_retencion"] == 0.10
        assert resultado["es_mexicano"] is False

    def test_retencion_0_mexicano(self, db):
        """Tickers con .MX tienen retención del 0%."""
        resultado = FiscalService.calcular_dividendo_neto(100, "AMXL.MX")
        assert resultado["retencion"] == 0.0
        assert resultado["dividendo_neto"] == 100.0
        assert resultado["tasa_retencion"] == 0.0
        assert resultado["es_mexicano"] is True

    def test_retencion_case_insensitive(self, db):
        """El sufijo .MX se detecta sin importar mayúsculas."""
        resultado = FiscalService.calcular_dividendo_neto(100, "amxl.mx")
        assert resultado["es_mexicano"] is True
        assert resultado["retencion"] == 0.0

    def test_dividendo_cero(self, db):
        """Dividendo de 0 retorna 0 en todo."""
        resultado = FiscalService.calcular_dividendo_neto(0, "AAPL")
        assert resultado["dividendo_bruto"] == 0.0
        assert resultado["retencion"] == 0.0
        assert resultado["dividendo_neto"] == 0.0


class TestConvertirUsdMxn:
    """Tests para FiscalService.convertir_usd_mxn()."""

    def test_conversion_basica(self, db):
        """Convierte USD a MXN usando tipo de cambio."""
        # Insertar tipo de cambio en caché
        from datetime import datetime, timezone
        tc = TipoCambioCache(
            id=1, usd_mxn=Decimal("17.5000"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(tc)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = FiscalService.convertir_usd_mxn(100)

        assert resultado["monto_usd"] == 100.0
        assert resultado["monto_mxn"] == 1750.0
        assert resultado["tipo_cambio"] == 17.5

    def test_conversion_cero(self, db):
        """Monto 0 retorna 0 MXN."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = FiscalService.convertir_usd_mxn(0)

        assert resultado["monto_usd"] == 0.0
        assert resultado["monto_mxn"] == 0.0


class TestCalcularPnlReal:
    """Tests para FiscalService.calcular_pnl_real()."""

    def test_ajuste_inpc_basico(self, db):
        """Calcula ganancia real con factor INPC."""
        from datetime import datetime, timezone

        # Insertar INPC en caché
        inpc_compra = InpcCache(
            anio=2024, mes=1, valor=Decimal("133.000"),
            updated_at=datetime.now(timezone.utc),
        )
        inpc_venta = InpcCache(
            anio=2024, mes=12, valor=Decimal("138.000"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add_all([inpc_compra, inpc_venta])
        db.session.commit()

        resultado = FiscalService.calcular_pnl_real(
            precio_venta=150,
            costo_original=100,
            fecha_compra=date(2024, 1, 15),
            fecha_venta=date(2024, 12, 15),
        )

        assert resultado["factor_inpc"] > 1.0  # Hubo inflación
        assert resultado["costo_ajustado"] > 100.0  # Costo ajustado mayor
        assert resultado["ganancia_real"] < 50.0  # Ganancia real menor que nominal

    def test_ajuste_inpc_sin_inflacion(self, db):
        """Si INPC compra == INPC venta, factor = 1."""
        from datetime import datetime, timezone

        inpc = InpcCache(
            anio=2024, mes=6, valor=Decimal("135.000"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(inpc)
        db.session.commit()

        resultado = FiscalService.calcular_pnl_real(
            precio_venta=150,
            costo_original=100,
            fecha_compra=date(2024, 6, 1),
            fecha_venta=date(2024, 6, 30),
        )

        assert resultado["factor_inpc"] == 1.0
        assert resultado["ganancia_real"] == 50.0


class TestTablaFiscal:
    """Tests para FiscalService.tabla_fiscal()."""

    def test_tabla_fiscal_portafolio_vacio(self, db):
        """Portafolio sin posiciones retorna tabla vacía."""
        p = Portafolio(user_id=1, nombre="Test Fiscal")
        db.session.add(p)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = FiscalService.tabla_fiscal(p.id, 1)

        assert resultado["portafolio"]["nombre"] == "Test Fiscal"
        assert resultado["posiciones"] == []
        assert resultado["resumen"]["total_ganancia_bruta"] == 0.0

    def test_tabla_fiscal_portafolio_no_existe(self, db):
        """Portafolio inexistente lanza ValueError."""
        with pytest.raises(ValueError, match="No se encontró"):
            FiscalService.tabla_fiscal(9999, 1)

    def test_tabla_fiscal_con_posiciones(self, db):
        """Tabla fiscal con posiciones activas calcula correctamente."""
        from datetime import datetime, timezone

        # Crear portafolio con posición
        p = Portafolio(user_id=1, nombre="Fiscal Test")
        db.session.add(p)
        db.session.flush()

        pos = Posicion(
            user_id=1,
            portafolio_id=p.id,
            ticker="AAPL",
            cantidad=Decimal("10"),
            precio_promedio=Decimal("150"),
            costo_total=Decimal("1500"),
            precio_actual=Decimal("180"),
            moneda="USD",
        )
        db.session.add(pos)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = FiscalService.tabla_fiscal(p.id, 1)

        assert len(resultado["posiciones"]) == 1
        fila = resultado["posiciones"][0]
        assert fila["ticker"] == "AAPL"
        assert fila["ganancia_bruta"] == 300.0  # (180-150)*10
        assert fila["isr_estimado"] == 30.0  # 300 * 10%
        assert fila["ganancia_neta"] == 270.0  # 300 - 30
        assert "tipo_cambio" in resultado

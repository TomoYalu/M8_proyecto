"""
Tests unitarios para el servicio de portafolios.

Cubre: CRUD de portafolios, transacciones (compra/venta/dividendo),
cálculo de precio promedio ponderado, P&L bruto/neto, vista consolidada.
"""

import pytest
from datetime import date
from decimal import Decimal

from app.services import portfolio_service as svc


# ── Helpers ──────────────────────────────────────────────────────

USER_ID = 1


def _crear_portafolio(db, nombre="Mi Portafolio", desc=None, moneda="MXN"):
    return svc.crear_portafolio(USER_ID, nombre, desc, moneda=moneda)


def _compra(db, pid, ticker="AAPL", precio=100, cantidad=10, comision=0):
    return svc.registrar_transaccion(
        pid, USER_ID, ticker, "compra", date(2024, 1, 15),
        precio, cantidad, comision, "USD",
    )


# ── CRUD Portafolios ────────────────────────────────────────────

class TestCrearPortafolio:
    def test_crear_portafolio_basico(self, db):
        result = _crear_portafolio(db, "Crecimiento")
        assert result["nombre"] == "Crecimiento"
        assert result["user_id"] == USER_ID

    def test_nombre_vacio_rechazado(self, db):
        with pytest.raises(ValueError, match="no puede estar vacío"):
            _crear_portafolio(db, "")

    def test_nombre_solo_espacios_rechazado(self, db):
        with pytest.raises(ValueError, match="no puede estar vacío"):
            _crear_portafolio(db, "   ")

    def test_nombre_duplicado_rechazado(self, db):
        _crear_portafolio(db, "Duplicado")
        with pytest.raises(ValueError, match="Ya existe"):
            _crear_portafolio(db, "Duplicado")


class TestListarPortafolios:
    def test_listar_vacio(self, db):
        assert svc.listar_portafolios(USER_ID) == []

    def test_listar_multiples(self, db):
        _crear_portafolio(db, "A")
        _crear_portafolio(db, "B")
        result = svc.listar_portafolios(USER_ID)
        assert len(result) == 2


class TestObtenerPortafolio:
    def test_obtener_existente(self, db):
        p = _crear_portafolio(db, "Test")
        result = svc.obtener_portafolio(p["id"], USER_ID)
        assert result["nombre"] == "Test"
        assert "posiciones" in result

    def test_obtener_inexistente(self, db):
        with pytest.raises(ValueError, match="No se encontró"):
            svc.obtener_portafolio(9999, USER_ID)


class TestActualizarPortafolio:
    def test_renombrar(self, db):
        p = _crear_portafolio(db, "Viejo")
        result = svc.actualizar_portafolio(p["id"], USER_ID, nombre="Nuevo")
        assert result["nombre"] == "Nuevo"

    def test_renombrar_nombre_vacio(self, db):
        p = _crear_portafolio(db, "Test")
        with pytest.raises(ValueError, match="no puede estar vacío"):
            svc.actualizar_portafolio(p["id"], USER_ID, nombre="")

    def test_renombrar_duplicado(self, db):
        _crear_portafolio(db, "A")
        p2 = _crear_portafolio(db, "B")
        with pytest.raises(ValueError, match="Ya existe"):
            svc.actualizar_portafolio(p2["id"], USER_ID, nombre="A")


class TestEliminarPortafolio:
    def test_eliminar_con_cascada(self, db):
        p = _crear_portafolio(db, "Eliminar")
        _compra(db, p["id"], "AAPL", 150, 5)
        result = svc.eliminar_portafolio(p["id"], USER_ID)
        assert "eliminado" in result["mensaje"]
        # Verificar que ya no existe
        with pytest.raises(ValueError):
            svc.obtener_portafolio(p["id"], USER_ID)

    def test_eliminar_inexistente(self, db):
        with pytest.raises(ValueError, match="No se encontró"):
            svc.eliminar_portafolio(9999, USER_ID)


# ── Transacciones ────────────────────────────────────────────────

class TestCompra:
    def test_primera_compra_crea_posicion(self, db):
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 150, 10)
        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        assert len(posiciones) == 1
        pos = posiciones[0]
        assert pos["ticker"] == "AAPL"
        assert pos["cantidad"] == 10.0
        assert pos["precio_promedio"] == 150.0
        assert pos["costo_total"] == 1500.0

    def test_segunda_compra_precio_promedio_ponderado(self, db):
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 100, 10)  # costo = 1000
        _compra(db, p["id"], "AAPL", 200, 10)  # costo = 2000
        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        pos = posiciones[0]
        assert pos["cantidad"] == 20.0
        # Precio promedio = (1000 + 2000) / 20 = 150
        assert pos["precio_promedio"] == 150.0
        assert pos["costo_total"] == 3000.0


class TestVenta:
    def test_venta_parcial(self, db):
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 100, 20)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "venta", date(2024, 6, 1),
            150, 10, 0, "USD",
        )
        # ganancia = (150 - 100) * 10 = 500
        assert tx["ganancia_perdida"] == 500.0
        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        assert posiciones[0]["cantidad"] == 10.0

    def test_venta_excede_disponible(self, db):
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 100, 5)
        with pytest.raises(ValueError, match="excede la cantidad disponible"):
            svc.registrar_transaccion(
                p["id"], USER_ID, "AAPL", "venta", date(2024, 6, 1),
                150, 10, 0, "USD",
            )

    def test_venta_sin_posicion(self, db):
        p = _crear_portafolio(db)
        with pytest.raises(ValueError, match="No existe posición activa"):
            svc.registrar_transaccion(
                p["id"], USER_ID, "MSFT", "venta", date(2024, 6, 1),
                150, 5, 0, "USD",
            )

    def test_venta_con_perdida(self, db):
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 200, 10)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "venta", date(2024, 6, 1),
            150, 5, 0, "USD",
        )
        # ganancia = (150 - 200) * 5 = -250
        assert tx["ganancia_perdida"] == -250.0


class TestDividendo:
    def test_dividendo_acumula(self, db):
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 150, 10)
        svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "dividendo", date(2024, 3, 15),
            0.82, 10, 0, "USD",
        )
        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        pos = posiciones[0]
        # dividendo = 0.82 * 10 = 8.2
        assert pos["dividendos_acumulados"] == pytest.approx(8.2, abs=0.01)
        # Cantidad no cambia
        assert pos["cantidad"] == 10.0

    def test_dividendo_sin_posicion_previa(self, db):
        """Dividendo crea posición con cantidad 0."""
        p = _crear_portafolio(db)
        svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "dividendo", date(2024, 3, 15),
            1.0, 5, 0, "USD",
        )
        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        assert len(posiciones) == 1
        assert posiciones[0]["cantidad"] == 0.0
        assert posiciones[0]["dividendos_acumulados"] == pytest.approx(5.0)


# ── P&L ──────────────────────────────────────────────────────────

class TestPnL:
    def test_pnl_bruto_con_ganancia(self, db):
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 100, 10)
        # Simular precio actual
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = Decimal("150")
        db.session.commit()

        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        pos_data = posiciones[0]
        # P&L bruto = (150 - 100) * 10 = 500
        assert pos_data["pnl_bruto"] == 500.0
        # ISR = 500 * 0.10 = 50
        assert pos_data["isr_estimado"] == 50.0
        # P&L neto = 500 - 50 = 450
        assert pos_data["pnl_neto"] == 450.0

    def test_pnl_bruto_con_perdida_sin_isr(self, db):
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db)
        _compra(db, p["id"], "AAPL", 200, 10)
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = Decimal("150")
        db.session.commit()

        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        pos_data = posiciones[0]
        # P&L bruto = (150 - 200) * 10 = -500
        assert pos_data["pnl_bruto"] == -500.0
        # ISR = 0 (no hay ganancia)
        assert pos_data["isr_estimado"] == 0.0
        # P&L neto = -500
        assert pos_data["pnl_neto"] == -500.0


# ── Vista consolidada ────────────────────────────────────────────

class TestVistaConsolidada:
    def test_consolidada_vacia(self, db):
        result = svc.vista_consolidada(USER_ID)
        assert result["valor_total"] == 0.0
        assert result["pnl_bruto"] == 0.0
        assert result["portafolios"] == []

    def test_consolidada_multiples_portafolios(self, db):
        from app.models.portafolio import Posicion
        p1 = _crear_portafolio(db, "P1")
        p2 = _crear_portafolio(db, "P2")
        _compra(db, p1["id"], "AAPL", 100, 10)
        _compra(db, p2["id"], "MSFT", 200, 5)

        # Simular precios actuales
        pos1 = Posicion.query.filter_by(portafolio_id=p1["id"]).first()
        pos1.precio_actual = Decimal("120")
        pos2 = Posicion.query.filter_by(portafolio_id=p2["id"]).first()
        pos2.precio_actual = Decimal("250")
        db.session.commit()

        result = svc.vista_consolidada(USER_ID)
        # P1: valor = 120*10 = 1200, pnl = (120-100)*10 = 200
        # P2: valor = 250*5 = 1250, pnl = (250-200)*5 = 250
        assert result["valor_total"] == pytest.approx(2450.0)
        assert result["pnl_bruto"] == pytest.approx(450.0)
        assert len(result["portafolios"]) == 2


# ── Paginación de transacciones ──────────────────────────────────

class TestListarTransacciones:
    def test_paginacion(self, db):
        p = _crear_portafolio(db)
        for i in range(5):
            _compra(db, p["id"], "AAPL", 100 + i, 1)
        result = svc.listar_transacciones(p["id"], USER_ID, page=1, per_page=3)
        assert len(result["transacciones"]) == 3
        assert result["total"] == 5
        assert result["paginas"] == 2


# ── Validaciones ─────────────────────────────────────────────────

class TestValidaciones:
    def test_tipo_invalido(self, db):
        p = _crear_portafolio(db)
        with pytest.raises(ValueError, match="Tipo de transacción inválido"):
            svc.registrar_transaccion(
                p["id"], USER_ID, "AAPL", "transferencia", date(2024, 1, 1),
                100, 10, 0, "USD",
            )

    def test_cantidad_cero_permitida(self, db):
        """Cantidad 0 se permite para agregar tickers al pool sin posición."""
        p = _crear_portafolio(db)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "compra", date(2024, 1, 1),
            100, 0, 0, "MXN",
        )
        assert tx["cantidad"] == 0.0

    def test_cantidad_negativa_rechazada(self, db):
        p = _crear_portafolio(db)
        with pytest.raises(ValueError, match="no puede ser negativa"):
            svc.registrar_transaccion(
                p["id"], USER_ID, "AAPL", "compra", date(2024, 1, 1),
                100, -5, 0, "MXN",
            )


# ── Moneda en portafolio ─────────────────────────────────────────

class TestMonedaPortafolio:
    """Tests para propagación de moneda en portafolio (Requisitos 15.2, 15.3, 15.4)."""

    def test_crear_portafolio_moneda_default_mxn(self, db):
        result = _crear_portafolio(db, "Default MXN")
        assert result["moneda"] == "MXN"

    def test_crear_portafolio_moneda_mxn(self, db):
        result = _crear_portafolio(db, "MXN Port", moneda="MXN")
        assert result["moneda"] == "MXN"

    def test_obtener_portafolio_incluye_moneda(self, db):
        p = _crear_portafolio(db, "Con Moneda", moneda="MXN")
        result = svc.obtener_portafolio(p["id"], USER_ID)
        assert result["moneda"] == "MXN"

    def test_listar_portafolios_incluye_moneda(self, db):
        _crear_portafolio(db, "P1", moneda="USD")
        _crear_portafolio(db, "P2", moneda="MXN")
        result = svc.listar_portafolios(USER_ID)
        monedas = {p["nombre"]: p["moneda"] for p in result}
        assert monedas["P1"] == "USD"
        assert monedas["P2"] == "MXN"

    def test_vista_consolidada_incluye_moneda_y_costo_total(self, db):
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "MXN Consolidado", moneda="MXN")
        _compra(db, p["id"], "AMXL.MX", 50, 20)
        # Simular precio actual
        pos = Posicion.query.filter_by(portafolio_id=p["id"]).first()
        pos.precio_actual = Decimal("60")
        db.session.commit()

        result = svc.vista_consolidada(USER_ID)
        port = result["portafolios"][0]
        assert port["moneda"] == "MXN"
        assert port["costo_total"] == pytest.approx(1000.0)  # 50 * 20
        assert port["valor_total"] == pytest.approx(1200.0)  # 60 * 20


# ── Validación de capital_inicial al editar ──────────────────────

class TestCapitalInicialValidacion:
    """Tests para validación de capital_inicial en actualizar_portafolio."""

    def test_capital_menor_a_invertido_rechazado(self, db):
        """No se puede reducir capital_inicial por debajo del valor invertido."""
        p = svc.crear_portafolio(USER_ID, "Capital Test", capital_inicial=100000)
        _compra(db, p["id"], "AAPL", 150, 100)  # costo = 15000
        with pytest.raises(ValueError, match="no puede ser menor al valor invertido"):
            svc.actualizar_portafolio(p["id"], USER_ID, capital_inicial=10000)

    def test_capital_igual_a_invertido_permitido(self, db):
        """Capital_inicial igual al valor invertido es válido."""
        p = svc.crear_portafolio(USER_ID, "Capital Igual", capital_inicial=100000)
        _compra(db, p["id"], "AAPL", 150, 100)  # costo = 15000
        result = svc.actualizar_portafolio(p["id"], USER_ID, capital_inicial=15000)
        assert result["capital_inicial"] == 15000.0

    def test_capital_mayor_a_invertido_permitido(self, db):
        """Capital_inicial mayor al valor invertido es válido."""
        p = svc.crear_portafolio(USER_ID, "Capital Mayor", capital_inicial=50000)
        _compra(db, p["id"], "AAPL", 150, 100)  # costo = 15000
        result = svc.actualizar_portafolio(p["id"], USER_ID, capital_inicial=200000)
        assert result["capital_inicial"] == 200000.0

    def test_capital_sin_posiciones_permitido(self, db):
        """Sin posiciones, cualquier capital_inicial es válido."""
        p = svc.crear_portafolio(USER_ID, "Sin Pos", capital_inicial=100000)
        result = svc.actualizar_portafolio(p["id"], USER_ID, capital_inicial=0)
        assert result["capital_inicial"] == 0.0


# ── Auto-pending por capital insuficiente ────────────────────────

class TestAutoPendienteCapital:
    """Tests para auto-pending cuando el capital es insuficiente."""

    def test_compra_excede_capital_marca_pendiente(self, db):
        """Compra que excede capital disponible se marca como pendiente."""
        p = svc.crear_portafolio(USER_ID, "Auto Pend", capital_inicial=10000)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "compra", date(2024, 1, 15),
            150, 100, 0, "USD",  # costo = 15000 > 10000
        )
        assert tx["estado"] == "sin_fondos"
        assert "Capital insuficiente" in tx["notas"]

    def test_compra_dentro_de_capital_confirmada(self, db):
        """Compra dentro del capital disponible se confirma normalmente."""
        p = svc.crear_portafolio(USER_ID, "Dentro Cap", capital_inicial=100000)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "compra", date(2024, 1, 15),
            150, 10, 0, "USD",  # costo = 1500 < 100000
        )
        assert tx["estado"] == "confirmada"

    def test_compra_sin_capital_inicial_no_aplica(self, db):
        """Sin capital_inicial (0), compra queda como sin_fondos."""
        p = svc.crear_portafolio(USER_ID, "Sin Cap", capital_inicial=0)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "compra", date(2024, 1, 15),
            150, 1000, 0, "USD",  # costo = 150000 pero capital = 0
        )
        assert tx["estado"] == "sin_fondos"

    def test_compra_con_capital_parcialmente_invertido(self, db):
        """Compra que excede capital disponible (no total) se marca pendiente."""
        p = svc.crear_portafolio(USER_ID, "Parcial", capital_inicial=20000)
        # Primera compra: 15000 invertido, 5000 disponible
        svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "compra", date(2024, 1, 15),
            150, 100, 0, "USD",
        )
        # Segunda compra: 10000 > 5000 disponible
        tx2 = svc.registrar_transaccion(
            p["id"], USER_ID, "MSFT", "compra", date(2024, 1, 16),
            100, 100, 0, "USD",
        )
        assert tx2["estado"] == "sin_fondos"

    def test_dividendo_no_aplica_auto_pending(self, db):
        """Dividendos no se ven afectados por auto-pending."""
        p = svc.crear_portafolio(USER_ID, "Div No Pend", capital_inicial=100)
        _compra(db, p["id"], "AAPL", 150, 10)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "dividendo", date(2024, 3, 15),
            5.0, 10, 0, "USD",
        )
        assert tx["estado"] == "confirmada"

    def test_auto_pending_preserva_notas_existentes(self, db):
        """Auto-pending agrega nota sin perder notas del usuario."""
        p = svc.crear_portafolio(USER_ID, "Notas Pend", capital_inicial=1000)
        tx = svc.registrar_transaccion(
            p["id"], USER_ID, "AAPL", "compra", date(2024, 1, 15),
            150, 100, 0, "USD",
            notas="Mi nota personal",
        )
        assert tx["estado"] == "sin_fondos"
        assert "capital insuficiente" in tx["notas"].lower()
        assert "Mi nota personal" in tx["notas"]


# ── Task 3.1: Precios nulos en vista_consolidada ─────────────────

class TestVistaConsolidadaPreciosNulos:
    """Tests para manejo de precios nulos en vista_consolidada() (Req 3.2, 8.1)."""

    def test_posicion_sin_precio_excluida_de_valor_y_pnl(self, db):
        """Posiciones con precio_actual=0 no suman a valor_total ni pnl_bruto."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Mixto")
        _compra(db, p["id"], "AAPL", 100, 10)  # costo = 1000
        _compra(db, p["id"], "MSFT", 200, 5)   # costo = 1000

        # AAPL tiene precio, MSFT no
        pos_aapl = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos_aapl.precio_actual = Decimal("120")
        # MSFT queda con precio_actual = None (default)
        pos_msft = Posicion.query.filter_by(portafolio_id=p["id"], ticker="MSFT").first()
        pos_msft.precio_actual = None
        db.session.commit()

        result = svc.vista_consolidada(USER_ID)
        port = result["portafolios"][0]
        # Solo AAPL contribuye: valor = 120*10 = 1200, pnl = (120-100)*10 = 200
        assert port["valor_total"] == pytest.approx(1200.0)
        assert port["pnl_bruto"] == pytest.approx(200.0)
        # Costo total incluye ambas posiciones
        assert port["costo_total"] == pytest.approx(2000.0)

    def test_todas_posiciones_sin_precio(self, db):
        """Cuando ninguna posición tiene precio, valor_total y pnl son 0."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Sin Precios")
        _compra(db, p["id"], "AAPL", 100, 10)
        # Reset precio_actual to None after compra
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = None
        db.session.commit()

        result = svc.vista_consolidada(USER_ID)
        port = result["portafolios"][0]
        assert port["valor_total"] == 0.0
        assert port["pnl_bruto"] == 0.0
        assert port["costo_total"] == pytest.approx(1000.0)

    def test_posicion_precio_cero_excluida(self, db):
        """Posiciones con precio_actual=0 explícito se excluyen igual que None."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Precio Cero")
        _compra(db, p["id"], "AAPL", 100, 10)
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = Decimal("0")
        db.session.commit()

        result = svc.vista_consolidada(USER_ID)
        port = result["portafolios"][0]
        assert port["valor_total"] == 0.0
        assert port["pnl_bruto"] == 0.0
        assert port["costo_total"] == pytest.approx(1000.0)


# ── Task 3.2: precio_pendiente en _posiciones_con_pnl ────────────

class TestPrecioPendiente:
    """Tests para campo precio_pendiente en posiciones (Req 3.1, 3.2)."""

    def test_precio_pendiente_true_cuando_sin_precio(self, db):
        """Posición sin precio_actual tiene precio_pendiente=True."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Pendiente")
        _compra(db, p["id"], "AAPL", 100, 10)
        # Reset precio_actual to None after compra
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = None
        db.session.commit()

        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        assert posiciones[0]["precio_pendiente"] is True

    def test_precio_pendiente_true_cuando_precio_cero(self, db):
        """Posición con precio_actual=0 tiene precio_pendiente=True."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Cero")
        _compra(db, p["id"], "AAPL", 100, 10)
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = Decimal("0")
        db.session.commit()

        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        assert posiciones[0]["precio_pendiente"] is True

    def test_precio_pendiente_false_cuando_precio_valido(self, db):
        """Posición con precio_actual > 0 tiene precio_pendiente=False."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Valido")
        _compra(db, p["id"], "AAPL", 100, 10)
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = Decimal("150")
        db.session.commit()

        posiciones = svc.obtener_posiciones(p["id"], USER_ID)
        assert posiciones[0]["precio_pendiente"] is False


# ── Task 3.3: refrescar_precios ──────────────────────────────────

class TestRefrescarPrecios:
    """Tests para refrescar_precios() (Req 13.1–13.4)."""

    def test_refrescar_sin_precios_faltantes(self, db):
        """Refresca precios de todas las posiciones, incluso las que ya tienen precio."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Completo")
        _compra(db, p["id"], "AAPL", 100, 10)
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = Decimal("150")
        db.session.commit()

        result = svc.refrescar_precios(p["id"], USER_ID)
        assert len(result) == 1
        # El precio se actualiza desde yfinance (puede cambiar del valor manual)
        assert result[0]["precio_actual"] > 0

    def test_refrescar_actualiza_posiciones(self, db, monkeypatch):
        """Refresco actualiza precio_actual, valor_mercado y pnl de posiciones."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Refrescar")
        _compra(db, p["id"], "AAPL", 100, 10)
        # Reset precio_actual to None after compra
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = None
        db.session.commit()

        # Mock yfinance_service.obtener_precios_multiples
        def mock_precios(tickers):
            return [{"ticker": "AAPL", "precio": 150.0, "cambio_pct": 2.5}]

        monkeypatch.setattr(
            "app.services.portfolio_service.yfinance_service.obtener_precios_multiples",
            mock_precios,
        )

        result = svc.refrescar_precios(p["id"], USER_ID)
        pos_data = result[0]
        assert pos_data["precio_actual"] == 150.0
        assert pos_data["valor_mercado"] == pytest.approx(1500.0)
        assert pos_data["pnl_bruto"] == pytest.approx(500.0)
        assert pos_data["precio_pendiente"] is False

        # Verificar en DB
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        assert float(pos.precio_actual) == pytest.approx(150.0)
        assert pos.ultima_actualizacion is not None

    def test_refrescar_fallo_mantiene_precio_original(self, db, monkeypatch):
        """Si yfinance falla para un ticker, se mantiene el precio original."""
        from app.models.portafolio import Posicion
        p = _crear_portafolio(db, "Fallo")
        _compra(db, p["id"], "AAPL", 100, 10)
        # Reset precio_actual to None after compra
        pos = Posicion.query.filter_by(portafolio_id=p["id"], ticker="AAPL").first()
        pos.precio_actual = None
        db.session.commit()

        # Mock que retorna sin precio
        def mock_precios(tickers):
            return [{"ticker": "AAPL", "precio": None, "error": "No data"}]

        monkeypatch.setattr(
            "app.services.portfolio_service.yfinance_service.obtener_precios_multiples",
            mock_precios,
        )

        result = svc.refrescar_precios(p["id"], USER_ID)
        # Precio sigue pendiente
        assert result[0]["precio_pendiente"] is True

    def test_refrescar_portafolio_inexistente(self, db):
        """Refrescar un portafolio inexistente lanza ValueError."""
        with pytest.raises(ValueError, match="No se encontró"):
            svc.refrescar_precios(9999, USER_ID)


# ── Task 3.4: obtener_historico ──────────────────────────────────

class TestObtenerHistorico:
    """Tests para obtener_historico() (Req 12.3)."""

    def test_historico_sin_transacciones(self, db):
        """Portafolio sin transacciones retorna listas vacías."""
        p = _crear_portafolio(db, "Vacio")
        result = svc.obtener_historico(p["id"], USER_ID)
        assert result["portafolio_id"] == p["id"]
        assert result["rango"] == "30d"
        assert result["fechas"] == []
        assert result["valores"] == []
        assert result["moneda"] == "MXN"

    def test_historico_estructura_respuesta(self, db, monkeypatch):
        """Verifica la estructura de la respuesta del histórico."""
        import pandas as pd
        from datetime import timedelta

        p = _crear_portafolio(db, "Historico")
        _compra(db, p["id"], "AAPL", 100, 10)

        # Mock obtener_datos_historicos para retornar datos simulados
        hoy = date.today()
        fechas_hist = [hoy - timedelta(days=i) for i in range(30, -1, -1)]
        df = pd.DataFrame(
            {"Close": [150.0 + i * 0.5 for i in range(31)]},
            index=pd.DatetimeIndex(fechas_hist),
        )

        def mock_historicos(ticker, periodo="1y", intervalo="1d"):
            return df

        monkeypatch.setattr(
            "app.services.portfolio_service.yfinance_service.obtener_datos_historicos",
            mock_historicos,
        )

        result = svc.obtener_historico(p["id"], USER_ID, rango="30d")
        assert "portafolio_id" in result
        assert "rango" in result
        assert "fechas" in result
        assert "valores" in result
        assert "moneda" in result
        assert result["rango"] == "30d"
        assert result["moneda"] == "MXN"
        # Debe tener datos (fechas y valores con misma longitud)
        assert len(result["fechas"]) == len(result["valores"])
        assert len(result["fechas"]) > 0

    def test_historico_rango_default(self, db):
        """Rango por defecto es 30d."""
        p = _crear_portafolio(db, "Default Rango")
        result = svc.obtener_historico(p["id"], USER_ID)
        assert result["rango"] == "30d"

    def test_historico_portafolio_inexistente(self, db):
        """Portafolio inexistente lanza ValueError."""
        with pytest.raises(ValueError, match="No se encontró"):
            svc.obtener_historico(9999, USER_ID)

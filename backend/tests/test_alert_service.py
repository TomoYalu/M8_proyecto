"""
Tests para el servicio de alertas (AlertService).

Cubre CRUD de alertas, evaluación de condiciones, disparo de alertas
y gestión de historial.

Requisitos cubiertos: 8.1–8.7
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest

from app.extensions import db
from app.models.alerta import Alerta, AlertaHistorial
from app.models.portafolio import Portafolio, Posicion
from app.services.alert_service import AlertService, TIPOS_ALERTA


# ── Fixtures ─────────────────────────────────────────────────────


@pytest.fixture()
def sample_alerta(db):
    """Crea una alerta de ejemplo en la DB."""
    alerta = Alerta(
        user_id=1,
        ticker="AAPL",
        tipo="precio_objetivo",
        condicion="mayor_que",
        umbral=Decimal("200.00"),
        activa=True,
        email_habilitado=False,
    )
    db.session.add(alerta)
    db.session.commit()
    return alerta


@pytest.fixture()
def sample_portafolio_con_posiciones(db):
    """Crea un portafolio con posiciones para tests de concentración."""
    port = Portafolio(user_id=1, nombre="Test Port")
    db.session.add(port)
    db.session.flush()

    # Posición grande: AAPL vale 5000 de 10000 total = 50%
    pos1 = Posicion(
        user_id=1,
        portafolio_id=port.id,
        ticker="AAPL",
        cantidad=Decimal("50"),
        precio_promedio=Decimal("80"),
        costo_total=Decimal("4000"),
        precio_actual=Decimal("100"),
        valor_mercado=Decimal("5000"),
    )
    # Posición pequeña: MSFT vale 5000 de 10000 total = 50%
    pos2 = Posicion(
        user_id=1,
        portafolio_id=port.id,
        ticker="MSFT",
        cantidad=Decimal("25"),
        precio_promedio=Decimal("160"),
        costo_total=Decimal("4000"),
        precio_actual=Decimal("200"),
        valor_mercado=Decimal("5000"),
    )
    db.session.add_all([pos1, pos2])
    db.session.commit()
    return port


# ── Tests CRUD ───────────────────────────────────────────────────


class TestCrearAlerta:
    """Tests para crear alertas."""

    def test_crear_alerta_valida(self, db):
        """Crea una alerta con datos válidos."""
        result = AlertService.crear_alerta(
            user_id=1,
            ticker="AAPL",
            tipo="precio_objetivo",
            condicion="mayor_que",
            umbral=200.0,
        )
        assert result["ticker"] == "AAPL"
        assert result["tipo"] == "precio_objetivo"
        assert result["condicion"] == "mayor_que"
        assert result["umbral"] == 200.0
        assert result["activa"] is True
        assert result["id"] is not None

    def test_crear_alerta_ticker_vacio_falla(self, db):
        """Rechaza ticker vacío."""
        with pytest.raises(ValueError, match="ticker no puede estar vacío"):
            AlertService.crear_alerta(
                user_id=1, ticker="", tipo="precio_objetivo",
                condicion="mayor_que", umbral=100,
            )

    def test_crear_alerta_tipo_invalido_falla(self, db):
        """Rechaza tipo de alerta inválido."""
        with pytest.raises(ValueError, match="Tipo de alerta inválido"):
            AlertService.crear_alerta(
                user_id=1, ticker="AAPL", tipo="tipo_falso",
                condicion="mayor_que", umbral=100,
            )

    def test_crear_alerta_condicion_invalida_falla(self, db):
        """Rechaza condición inválida."""
        with pytest.raises(ValueError, match="Condición inválida"):
            AlertService.crear_alerta(
                user_id=1, ticker="AAPL", tipo="precio_objetivo",
                condicion="diferente_de", umbral=100,
            )

    def test_crear_alerta_con_email(self, db):
        """Crea alerta con email habilitado."""
        result = AlertService.crear_alerta(
            user_id=1, ticker="MSFT", tipo="rsi_sobrecompra",
            condicion="mayor_que", email_habilitado=True,
        )
        assert result["email_habilitado"] is True

    def test_crear_alerta_ticker_se_normaliza(self, db):
        """El ticker se convierte a mayúsculas y se limpia."""
        result = AlertService.crear_alerta(
            user_id=1, ticker="  aapl  ", tipo="precio_objetivo",
            condicion="mayor_que", umbral=100,
        )
        assert result["ticker"] == "AAPL"


class TestListarAlertas:
    """Tests para listar alertas."""

    def test_listar_alertas_vacio(self, db):
        """Lista vacía cuando no hay alertas."""
        result = AlertService.listar_alertas(1)
        assert result == []

    def test_listar_alertas_con_datos(self, db, sample_alerta):
        """Lista alertas existentes."""
        result = AlertService.listar_alertas(1)
        assert len(result) == 1
        assert result[0]["ticker"] == "AAPL"

    def test_listar_alertas_filtra_por_usuario(self, db, sample_alerta):
        """No muestra alertas de otros usuarios."""
        result = AlertService.listar_alertas(999)
        assert result == []


class TestActualizarAlerta:
    """Tests para actualizar alertas."""

    def test_actualizar_umbral(self, db, sample_alerta):
        """Actualiza el umbral de una alerta."""
        result = AlertService.actualizar_alerta(
            sample_alerta.id, 1, {"umbral": 250.0}
        )
        assert result["umbral"] == 250.0

    def test_actualizar_alerta_inexistente_falla(self, db):
        """Falla al actualizar alerta que no existe."""
        with pytest.raises(ValueError, match="No se encontró"):
            AlertService.actualizar_alerta(999, 1, {"umbral": 100})


class TestEliminarAlerta:
    """Tests para eliminar alertas."""

    def test_eliminar_alerta(self, db, sample_alerta):
        """Elimina una alerta correctamente."""
        result = AlertService.eliminar_alerta(sample_alerta.id, 1)
        assert "eliminada" in result["mensaje"]
        assert Alerta.query.get(sample_alerta.id) is None

    def test_eliminar_alerta_inexistente_falla(self, db):
        """Falla al eliminar alerta que no existe."""
        with pytest.raises(ValueError, match="No se encontró"):
            AlertService.eliminar_alerta(999, 1)


class TestToggleAlerta:
    """Tests para activar/desactivar alertas."""

    def test_toggle_desactiva(self, db, sample_alerta):
        """Desactiva una alerta activa."""
        assert sample_alerta.activa is True
        result = AlertService.toggle_alerta(sample_alerta.id, 1)
        assert result["activa"] is False

    def test_toggle_activa(self, db, sample_alerta):
        """Activa una alerta desactivada."""
        sample_alerta.activa = False
        db.session.commit()
        result = AlertService.toggle_alerta(sample_alerta.id, 1)
        assert result["activa"] is True


class TestListarHistorial:
    """Tests para historial de alertas."""

    def test_historial_vacio(self, db):
        """Historial vacío cuando no hay disparos."""
        result = AlertService.listar_historial(1)
        assert result["historial"] == []
        assert result["total"] == 0

    def test_historial_paginado(self, db, sample_alerta):
        """Historial con paginación."""
        # Crear registros de historial
        for i in range(5):
            h = AlertaHistorial(
                user_id=1,
                alerta_id=sample_alerta.id,
                ticker="AAPL",
                tipo="precio_objetivo",
                condicion="Precio superó umbral",
                valor_disparado=Decimal("201"),
                canal="websocket",
            )
            db.session.add(h)
        db.session.commit()

        result = AlertService.listar_historial(1, page=1, per_page=3)
        assert len(result["historial"]) == 3
        assert result["total"] == 5
        assert result["paginas"] == 2


# ── Tests de evaluación ─────────────────────────────────────────


class TestEvaluarPrecioObjetivo:
    """Tests para evaluación de precio objetivo."""

    @patch("app.services.alert_service.AlertService._obtener_rsi")
    @patch("app.services.yfinance_service.obtener_precio")
    def test_precio_mayor_que_cumplida(self, mock_precio, mock_rsi, db, sample_alerta):
        """Alerta se cumple cuando precio > umbral."""
        mock_precio.return_value = {"precio": 210.0, "cambio_pct": 1.5}
        cumplida, datos = AlertService._eval_precio_objetivo(sample_alerta)
        assert cumplida is True
        assert datos["valor_actual"] == 210.0

    @patch("app.services.yfinance_service.obtener_precio")
    def test_precio_mayor_que_no_cumplida(self, mock_precio, db, sample_alerta):
        """Alerta no se cumple cuando precio < umbral."""
        mock_precio.return_value = {"precio": 190.0, "cambio_pct": -0.5}
        cumplida, datos = AlertService._eval_precio_objetivo(sample_alerta)
        assert cumplida is False

    @patch("app.services.yfinance_service.obtener_precio")
    def test_precio_menor_que_cumplida(self, mock_precio, db):
        """Alerta menor_que se cumple cuando precio < umbral."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="precio_objetivo",
            condicion="menor_que", umbral=Decimal("150"),
            activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_precio.return_value = {"precio": 140.0, "cambio_pct": -2.0}
        cumplida, datos = AlertService._eval_precio_objetivo(alerta)
        assert cumplida is True


class TestEvaluarCambioPctDia:
    """Tests para evaluación de cambio porcentual diario."""

    @patch("app.services.yfinance_service.obtener_precio")
    def test_cambio_pct_mayor_que(self, mock_precio, db):
        """Detecta cambio porcentual que excede umbral."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="cambio_pct_dia",
            condicion="menor_que", umbral=Decimal("-5"),
            activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_precio.return_value = {"precio": 180.0, "cambio_pct": -6.5}
        cumplida, datos = AlertService._eval_cambio_pct_dia(alerta)
        assert cumplida is True
        assert datos["valor_actual"] == -6.5


class TestEvaluarRSI:
    """Tests para evaluación de RSI."""

    @patch("app.services.alert_service.AlertService._obtener_rsi")
    def test_rsi_sobrecompra(self, mock_rsi, db):
        """Detecta RSI > 70."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="rsi_sobrecompra",
            condicion="mayor_que", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_rsi.return_value = 75.0
        cumplida, datos = AlertService._eval_rsi_sobrecompra(alerta)
        assert cumplida is True
        assert datos["valor_actual"] == 75.0

    @patch("app.services.alert_service.AlertService._obtener_rsi")
    def test_rsi_sobreventa(self, mock_rsi, db):
        """Detecta RSI < 30."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="rsi_sobreventa",
            condicion="menor_que", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_rsi.return_value = 25.0
        cumplida, datos = AlertService._eval_rsi_sobreventa(alerta)
        assert cumplida is True

    @patch("app.services.alert_service.AlertService._obtener_rsi")
    def test_rsi_none_no_cumple(self, mock_rsi, db):
        """No se cumple si RSI no está disponible."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="rsi_sobrecompra",
            condicion="mayor_que", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_rsi.return_value = None
        cumplida, datos = AlertService._eval_rsi_sobrecompra(alerta)
        assert cumplida is False


class TestEvaluarCrucesSMA:
    """Tests para Golden Cross y Death Cross."""

    @patch("app.services.alert_service.AlertService._detectar_cruce_sma")
    def test_golden_cross(self, mock_cruce, db):
        """Detecta Golden Cross."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="golden_cross",
            condicion="igual", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_cruce.return_value = "golden_cross"
        cumplida, datos = AlertService._eval_golden_cross(alerta)
        assert cumplida is True

    @patch("app.services.alert_service.AlertService._detectar_cruce_sma")
    def test_death_cross(self, mock_cruce, db):
        """Detecta Death Cross."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="death_cross",
            condicion="igual", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_cruce.return_value = "death_cross"
        cumplida, datos = AlertService._eval_death_cross(alerta)
        assert cumplida is True

    @patch("app.services.alert_service.AlertService._detectar_cruce_sma")
    def test_sin_cruce(self, mock_cruce, db):
        """No se cumple si no hay cruce."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="golden_cross",
            condicion="igual", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_cruce.return_value = None
        cumplida, datos = AlertService._eval_golden_cross(alerta)
        assert cumplida is False


class TestEvaluarSemaforoRojo:
    """Tests para evaluación de semáforo rojo."""

    @patch("app.services.news_service.NewsService.obtener_semaforo")
    def test_semaforo_rojo(self, mock_semaforo, db):
        """Detecta semáforo rojo."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="semaforo_rojo",
            condicion="igual", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_semaforo.return_value = {"semaforo": "rojo", "score_promedio": -0.5}
        cumplida, datos = AlertService._eval_semaforo_rojo(alerta)
        assert cumplida is True

    @patch("app.services.news_service.NewsService.obtener_semaforo")
    def test_semaforo_verde_no_cumple(self, mock_semaforo, db):
        """No se cumple con semáforo verde."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="semaforo_rojo",
            condicion="igual", activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_semaforo.return_value = {"semaforo": "verde", "score_promedio": 0.5}
        cumplida, datos = AlertService._eval_semaforo_rojo(alerta)
        assert cumplida is False


class TestEvaluarConcentracion:
    """Tests para evaluación de concentración."""

    def test_concentracion_excesiva(self, db, sample_portafolio_con_posiciones):
        """Detecta posición > 20% del portafolio (50% en este caso)."""
        port = sample_portafolio_con_posiciones
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="concentracion",
            condicion="mayor_que", umbral=Decimal("20"),
            portafolio_id=port.id, activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        cumplida, datos = AlertService._eval_concentracion(alerta)
        assert cumplida is True
        assert datos["valor_actual"] == 50.0

    def test_concentracion_sin_portafolio(self, db):
        """No se cumple sin portafolio_id."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="concentracion",
            condicion="mayor_que", umbral=Decimal("20"),
            portafolio_id=None, activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        cumplida, datos = AlertService._eval_concentracion(alerta)
        assert cumplida is False


# ── Tests de disparo ─────────────────────────────────────────────


class TestDispararAlerta:
    """Tests para el disparo de alertas."""

    @patch("app.services.alert_service.socketio")
    def test_disparar_alerta_websocket(self, mock_socketio, db, sample_alerta):
        """Dispara alerta por WebSocket y guarda historial."""
        datos = {
            "valor_actual": 210.0,
            "umbral": 200.0,
            "descripcion": "Precio superó umbral",
        }
        AlertService._disparar_alerta(sample_alerta, datos)

        # Verificar historial guardado
        historial = AlertaHistorial.query.filter_by(alerta_id=sample_alerta.id).first()
        assert historial is not None
        assert historial.ticker == "AAPL"
        assert historial.canal == "websocket"

        # Verificar WebSocket emitido
        mock_socketio.emit.assert_called_once()
        call_args = mock_socketio.emit.call_args
        assert call_args[0][0] == "alert_triggered"
        assert call_args[0][1]["ticker"] == "AAPL"

    @patch("app.services.email_service.enviar_alerta")
    @patch("app.services.alert_service.socketio")
    def test_disparar_alerta_con_email(self, mock_socketio, mock_email, db):
        """Dispara alerta por WebSocket y email."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="precio_objetivo",
            condicion="mayor_que", umbral=Decimal("200"),
            activa=True, email_habilitado=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_email.return_value = True

        datos = {
            "valor_actual": 210.0,
            "umbral": 200.0,
            "descripcion": "Precio superó umbral",
        }
        AlertService._disparar_alerta(alerta, datos)

        historial = AlertaHistorial.query.filter_by(alerta_id=alerta.id).first()
        assert historial.canal == "ambos"
        mock_email.assert_called_once()

    @patch("app.services.email_service.enviar_alerta", side_effect=Exception("SMTP error"))
    @patch("app.services.alert_service.socketio")
    def test_disparar_alerta_email_falla_continua(self, mock_socketio, mock_email, db):
        """Si email falla, continúa con WebSocket."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="precio_objetivo",
            condicion="mayor_que", umbral=Decimal("200"),
            activa=True, email_habilitado=True,
        )
        db.session.add(alerta)
        db.session.commit()

        datos = {
            "valor_actual": 210.0,
            "umbral": 200.0,
            "descripcion": "Precio superó umbral",
        }
        AlertService._disparar_alerta(alerta, datos)

        historial = AlertaHistorial.query.filter_by(alerta_id=alerta.id).first()
        assert historial is not None
        assert historial.canal == "websocket"
        mock_socketio.emit.assert_called_once()


# ── Tests de evaluar_todas ───────────────────────────────────────


class TestEvaluarTodas:
    """Tests para evaluación masiva."""

    @patch("app.services.yfinance_service.obtener_precio")
    @patch("app.services.alert_service.socketio")
    def test_evaluar_todas_dispara_cumplidas(self, mock_socketio, mock_precio, db):
        """Evalúa todas las alertas y dispara las que se cumplen."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="precio_objetivo",
            condicion="mayor_que", umbral=Decimal("200"),
            activa=True,
        )
        db.session.add(alerta)
        db.session.commit()

        mock_precio.return_value = {"precio": 210.0, "cambio_pct": 1.5}

        AlertService.evaluar_todas()

        historial = AlertaHistorial.query.all()
        assert len(historial) == 1
        mock_socketio.emit.assert_called_once()

    def test_evaluar_todas_sin_alertas(self, db):
        """No falla cuando no hay alertas activas."""
        AlertService.evaluar_todas()  # No debe lanzar excepción

    @patch("app.services.yfinance_service.obtener_precio")
    @patch("app.services.alert_service.socketio")
    def test_evaluar_todas_ignora_inactivas(self, mock_socketio, mock_precio, db):
        """No evalúa alertas desactivadas."""
        alerta = Alerta(
            user_id=1, ticker="AAPL", tipo="precio_objetivo",
            condicion="mayor_que", umbral=Decimal("200"),
            activa=False,
        )
        db.session.add(alerta)
        db.session.commit()

        AlertService.evaluar_todas()

        historial = AlertaHistorial.query.all()
        assert len(historial) == 0
        mock_socketio.emit.assert_not_called()

"""
Tests para BanxicoService.

Verifica obtención de INPC, tipo de cambio, fallback a caché
y manejo de datos mock cuando no hay token.

Requisitos cubiertos: 9.2, 9.4, 9.7
"""

import pytest
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import patch

from app.services.banxico_service import BanxicoService


class TestObtenerInpc:
    """Tests para BanxicoService.obtener_inpc()."""

    def test_inpc_retorna_datos_mock_sin_token(self, db):
        """Sin token de Banxico, debe retornar datos estáticos/mock."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = BanxicoService.obtener_inpc(2024, 6)

        assert resultado["anio"] == 2024
        assert resultado["mes"] == 6
        assert resultado["valor"] > 0
        assert "fuente" in resultado
        assert "updated_at" in resultado

    def test_inpc_se_guarda_en_cache(self, db):
        """Después de obtener INPC, debe quedar en caché."""
        from app.models.cache import InpcCache

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            BanxicoService.obtener_inpc(2024, 3)

        cached = InpcCache.query.filter_by(anio=2024, mes=3).first()
        assert cached is not None
        assert float(cached.valor) > 0

    def test_inpc_retorna_cache_si_existe(self, db):
        """Si el INPC ya está en caché, debe retornarlo sin llamar API."""
        from app.models.cache import InpcCache
        from datetime import datetime, timezone

        entry = InpcCache(
            anio=2023, mes=1, valor=Decimal("130.500"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(entry)
        db.session.commit()

        resultado = BanxicoService.obtener_inpc(2023, 1)
        assert resultado["valor"] == 130.5
        assert resultado["fuente"] == "cache"

    def test_inpc_valor_base_cuando_no_hay_datos(self, db):
        """Si no hay datos en caché ni mock, retorna valor base 100."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = BanxicoService.obtener_inpc(1990, 1)

        assert resultado["valor"] > 0
        assert "fuente" in resultado

    def test_inpc_fallback_api_error(self, db):
        """Si la API falla, debe usar fallback (mock o caché)."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": "fake_token"}, clear=False):
            with patch("app.services.banxico_service.requests.get") as mock_get:
                mock_get.side_effect = Exception("Connection error")
                resultado = BanxicoService.obtener_inpc(2024, 6)

        assert resultado["valor"] > 0
        assert resultado["fuente"] in ("datos_estaticos", "cache", "cache_ultimo", "valor_base")


class TestObtenerTipoCambio:
    """Tests para BanxicoService.obtener_tipo_cambio()."""

    def test_tipo_cambio_retorna_datos_sin_token(self, db):
        """Sin token, debe retornar datos estáticos/mock."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = BanxicoService.obtener_tipo_cambio()

        assert resultado["usd_mxn"] > 0
        assert "fuente" in resultado
        assert "updated_at" in resultado

    def test_tipo_cambio_se_guarda_en_cache(self, db):
        """Después de obtener tipo de cambio, debe quedar en caché."""
        from app.models.cache import TipoCambioCache

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            BanxicoService.obtener_tipo_cambio()

        cached = TipoCambioCache.query.get(1)
        assert cached is not None
        assert float(cached.usd_mxn) > 0

    def test_tipo_cambio_retorna_cache_si_existe(self, db):
        """Si hay caché, debe retornarlo."""
        from app.models.cache import TipoCambioCache
        from datetime import datetime, timezone

        entry = TipoCambioCache(
            id=1, usd_mxn=Decimal("18.5000"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(entry)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = BanxicoService.obtener_tipo_cambio()

        assert resultado["usd_mxn"] == 18.5
        assert resultado["fuente"] == "cache"

    def test_tipo_cambio_fallback_api_error(self, db):
        """Si la API falla, debe usar fallback."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": "fake_token"}, clear=False):
            with patch("app.services.banxico_service.requests.get") as mock_get:
                mock_get.side_effect = Exception("Connection error")
                resultado = BanxicoService.obtener_tipo_cambio()

        assert resultado["usd_mxn"] > 0
        assert resultado["fuente"] in ("cache", "datos_estaticos")


class TestActualizarDatos:
    """Tests para BanxicoService.actualizar_datos()."""

    def test_actualizar_datos_no_falla(self, db):
        """actualizar_datos() no debe lanzar excepciones."""
        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            BanxicoService.actualizar_datos()

        # Verificar que se guardaron datos
        from app.models.cache import TipoCambioCache
        cached = TipoCambioCache.query.get(1)
        assert cached is not None


class TestGuardarTipoCambioAnterior:
    """Tests para verificar que se almacena usd_mxn_anterior."""

    def test_primera_insercion_anterior_es_none(self, db):
        """La primera vez que se guarda, usd_mxn_anterior es None."""
        from app.models.cache import TipoCambioCache

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            BanxicoService.obtener_tipo_cambio()

        cached = db.session.get(TipoCambioCache, 1)
        assert cached is not None
        assert cached.usd_mxn_anterior is None

    def test_segunda_actualizacion_guarda_anterior(self, db):
        """Al actualizar, el valor previo se guarda en usd_mxn_anterior."""
        from app.models.cache import TipoCambioCache

        # Primera inserción
        entry = TipoCambioCache(
            id=1,
            usd_mxn=Decimal("17.5000"),
            usd_mxn_anterior=None,
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(entry)
        db.session.commit()

        # Actualizar con nuevo valor
        BanxicoService._guardar_tipo_cambio(Decimal("18.0000"))

        cached = db.session.get(TipoCambioCache, 1)
        assert float(cached.usd_mxn) == 18.0
        assert float(cached.usd_mxn_anterior) == 17.5

    def test_respuesta_incluye_campos_enriquecidos(self, db):
        """obtener_tipo_cambio() retorna precio, cambio_dia, cambio_pct."""
        from app.models.cache import TipoCambioCache

        entry = TipoCambioCache(
            id=1,
            usd_mxn=Decimal("18.0000"),
            usd_mxn_anterior=Decimal("17.5000"),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(entry)
        db.session.commit()

        with patch.dict("os.environ", {"BANXICO_TOKEN": ""}, clear=False):
            resultado = BanxicoService.obtener_tipo_cambio()

        assert resultado["precio"] == 18.0
        assert resultado["cambio_dia"] == 0.5
        assert abs(resultado["cambio_pct"] - 2.8571) < 0.01
        assert resultado["fuente"] == "cache"

# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el servicio de análisis técnico TAService.

Usa DataFrames sintéticos para verificar indicadores, patrones
e interpretaciones sin depender de yfinance.

Requisitos cubiertos: 4.1–4.9
"""

import numpy as np
import pandas as pd
import pytest

from app.services.ta_service import TAService


# ── Fixtures ─────────────────────────────────────────────────────


@pytest.fixture
def ta():
    """Instancia de TAService."""
    return TAService()


@pytest.fixture
def df_basic():
    """
    DataFrame sintético con 250 velas de datos OHLCV.
    Simula una tendencia alcista con ruido.
    """
    np.random.seed(42)
    n = 250
    dates = pd.date_range("2023-01-01", periods=n, freq="B")

    # Tendencia alcista base con ruido
    base = 100 + np.cumsum(np.random.randn(n) * 0.5 + 0.05)
    noise = np.random.randn(n) * 1.5

    close = base + noise
    high = close + np.abs(np.random.randn(n) * 1.0)
    low = close - np.abs(np.random.randn(n) * 1.0)
    open_ = close + np.random.randn(n) * 0.5
    volume = np.random.randint(100000, 1000000, n).astype(float)

    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume},
        index=dates,
    )


@pytest.fixture
def df_overbought():
    """DataFrame donde RSI debería estar > 70 (tendencia alcista fuerte)."""
    np.random.seed(10)
    n = 50
    dates = pd.date_range("2023-01-01", periods=n, freq="B")

    # Tendencia alcista fuerte y constante
    close = np.linspace(100, 200, n)
    high = close + 1
    low = close - 0.5
    open_ = close - 0.3
    volume = np.full(n, 500000.0)

    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume},
        index=dates,
    )


@pytest.fixture
def df_oversold():
    """DataFrame donde RSI debería estar < 30 (tendencia bajista fuerte)."""
    np.random.seed(11)
    n = 50
    dates = pd.date_range("2023-01-01", periods=n, freq="B")

    # Tendencia bajista fuerte y constante
    close = np.linspace(200, 100, n)
    high = close + 0.5
    low = close - 1
    open_ = close + 0.3
    volume = np.full(n, 500000.0)

    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume},
        index=dates,
    )


@pytest.fixture
def df_doji():
    """DataFrame con un Doji en la última vela."""
    n = 30
    dates = pd.date_range("2023-01-01", periods=n, freq="B")

    close = np.full(n, 100.0)
    high = np.full(n, 102.0)
    low = np.full(n, 98.0)
    open_ = np.full(n, 100.0)
    volume = np.full(n, 500000.0)

    # Última vela: Doji (open ≈ close, rango amplio)
    open_[-1] = 100.0
    close[-1] = 100.1  # body = 0.1
    high[-1] = 105.0  # range = 7.0
    low[-1] = 98.0  # body/range = 0.1/7.0 ≈ 1.4% < 10%

    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume},
        index=dates,
    )


# ── Tests: calcular_todos — completitud ──────────────────────────


class TestCalcularTodos:
    """Verifica que calcular_todos retorna todos los indicadores esperados."""

    def test_todas_las_claves_presentes(self, ta, df_basic):
        """Todos los indicadores deben estar presentes en el resultado."""
        resultado = ta.calcular_todos(df_basic)

        claves_esperadas = [
            "sma50", "sma200", "ema20", "rsi", "macd", "estocastico",
            "bollinger", "sar", "fibonacci", "vol_avg", "stop_loss",
            "trailing_stop", "patrones", "divergencia_macd",
            "regla_3_dias", "interpretaciones",
        ]
        for clave in claves_esperadas:
            assert clave in resultado, f"Falta la clave '{clave}' en el resultado"

    def test_series_son_listas(self, ta, df_basic):
        """Las series deben ser listas (no pandas Series) para JSON."""
        resultado = ta.calcular_todos(df_basic)

        assert isinstance(resultado["sma50"], list)
        assert isinstance(resultado["sma200"], list)
        assert isinstance(resultado["ema20"], list)
        assert isinstance(resultado["rsi"], list)
        assert isinstance(resultado["sar"], list)
        assert isinstance(resultado["vol_avg"], list)

    def test_macd_tiene_subcampos(self, ta, df_basic):
        """MACD debe tener macd, signal, histograma como listas."""
        resultado = ta.calcular_todos(df_basic)
        macd = resultado["macd"]

        assert "macd" in macd
        assert "signal" in macd
        assert "histograma" in macd
        assert isinstance(macd["macd"], list)
        assert isinstance(macd["signal"], list)
        assert isinstance(macd["histograma"], list)

    def test_estocastico_tiene_k_y_d(self, ta, df_basic):
        """Estocástico debe tener k y d como listas."""
        resultado = ta.calcular_todos(df_basic)
        stoch = resultado["estocastico"]

        assert "k" in stoch
        assert "d" in stoch
        assert isinstance(stoch["k"], list)
        assert isinstance(stoch["d"], list)

    def test_bollinger_tiene_mid_upper_lower(self, ta, df_basic):
        """Bollinger debe tener mid, upper, lower como listas."""
        resultado = ta.calcular_todos(df_basic)
        boll = resultado["bollinger"]

        assert "mid" in boll
        assert "upper" in boll
        assert "lower" in boll
        assert isinstance(boll["mid"], list)

    def test_fibonacci_tiene_niveles(self, ta, df_basic):
        """Fibonacci debe tener todos los niveles de retroceso."""
        resultado = ta.calcular_todos(df_basic)
        fib = resultado["fibonacci"]

        niveles = ["nivel_0", "nivel_236", "nivel_382", "nivel_50",
                    "nivel_618", "nivel_786", "nivel_100"]
        for nivel in niveles:
            assert nivel in fib, f"Falta nivel '{nivel}' en Fibonacci"
            assert isinstance(fib[nivel], float)

    def test_longitud_series_coincide_con_df(self, ta, df_basic):
        """Las series deben tener la misma longitud que el DataFrame."""
        resultado = ta.calcular_todos(df_basic)
        n = len(df_basic)

        assert len(resultado["sma50"]) == n
        assert len(resultado["ema20"]) == n
        assert len(resultado["rsi"]) == n
        assert len(resultado["sar"]) == n


# ── Tests: Stop Loss ─────────────────────────────────────────────


class TestStopLoss:
    """Verifica el cálculo de Stop Loss."""

    def test_stop_loss_formula_correcta(self, ta):
        """Stop Loss = min(Low últimas 10 velas) × 0.975."""
        dates = pd.date_range("2023-01-01", periods=30, freq="B")
        lows = [100.0] * 20 + [95.0, 96.0, 97.0, 98.0, 99.0,
                                 94.0, 96.0, 97.0, 98.0, 99.0]
        df = pd.DataFrame({
            "Open": [100.0] * 30,
            "High": [105.0] * 30,
            "Low": lows,
            "Close": [100.0] * 30,
            "Volume": [500000.0] * 30,
        }, index=dates)

        stop = ta._stop_loss(df)

        # min de últimas 10 velas: 94.0
        expected = round(94.0 * 0.975, 4)
        assert stop == expected

    def test_stop_loss_precision_4_decimales(self, ta, df_basic):
        """Stop Loss debe tener 4 decimales de precisión."""
        stop = ta._stop_loss(df_basic)
        # Verificar que es un float con máximo 4 decimales
        assert isinstance(stop, float)
        assert stop == round(stop, 4)

    def test_stop_loss_menor_que_minimo(self, ta, df_basic):
        """Stop Loss debe ser menor que el mínimo de las últimas 10 velas."""
        stop = ta._stop_loss(df_basic)
        min_10 = float(df_basic["Low"].iloc[-10:].min())
        assert stop < min_10

    def test_stop_loss_con_pocos_datos(self, ta):
        """Stop Loss funciona con menos de 10 velas."""
        dates = pd.date_range("2023-01-01", periods=5, freq="B")
        df = pd.DataFrame({
            "Open": [100.0] * 5,
            "High": [105.0] * 5,
            "Low": [95.0, 96.0, 97.0, 98.0, 99.0],
            "Close": [100.0] * 5,
            "Volume": [500000.0] * 5,
        }, index=dates)

        stop = ta._stop_loss(df)
        expected = round(95.0 * 0.975, 4)
        assert stop == expected


# ── Tests: Trailing Stop ─────────────────────────────────────────


class TestTrailingStop:
    """Verifica el Trailing Stop basado en SAR Parabólico."""

    def test_trailing_stop_es_float(self, ta, df_basic):
        """Trailing Stop debe ser un float."""
        ts = ta._trailing_stop(df_basic)
        assert isinstance(ts, float)

    def test_trailing_stop_precision_4_decimales(self, ta, df_basic):
        """Trailing Stop debe tener 4 decimales."""
        ts = ta._trailing_stop(df_basic)
        assert ts == round(ts, 4)


# ── Tests: RSI ───────────────────────────────────────────────────


class TestRSI:
    """Verifica el cálculo del RSI."""

    def test_rsi_rango_valido(self, ta, df_basic):
        """RSI debe estar entre 0 y 100 (excluyendo NaN)."""
        rsi = ta._rsi(df_basic, 14)
        valid = rsi.dropna()
        assert all(0 <= v <= 100 for v in valid)

    def test_rsi_tendencia_alcista_alto(self, ta, df_overbought):
        """RSI en tendencia alcista fuerte debe ser > 70."""
        rsi = ta._rsi(df_overbought, 14)
        last_rsi = float(rsi.dropna().iloc[-1])
        assert last_rsi > 70

    def test_rsi_tendencia_bajista_bajo(self, ta, df_oversold):
        """RSI en tendencia bajista fuerte debe ser < 30."""
        rsi = ta._rsi(df_oversold, 14)
        last_rsi = float(rsi.dropna().iloc[-1])
        assert last_rsi < 30


# ── Tests: Interpretaciones ──────────────────────────────────────


class TestInterpretaciones:
    """Verifica las interpretaciones automáticas en español."""

    def test_interpretacion_rsi_sobrecompra(self, ta, df_overbought):
        """RSI > 70 debe generar interpretación de sobrecompra."""
        interp = ta._generar_interpretaciones(df_overbought)
        assert "rsi" in interp
        assert "Sobrecompra" in interp["rsi"]
        assert "RSI > 70" in interp["rsi"]

    def test_interpretacion_rsi_sobreventa(self, ta, df_oversold):
        """RSI < 30 debe generar interpretación de sobreventa."""
        interp = ta._generar_interpretaciones(df_oversold)
        assert "rsi" in interp
        assert "Sobreventa" in interp["rsi"]
        assert "RSI < 30" in interp["rsi"]

    def test_interpretacion_rsi_neutral(self, ta):
        """RSI 40–60 debe generar interpretación neutral."""
        np.random.seed(99)
        n = 50
        dates = pd.date_range("2023-01-01", periods=n, freq="B")
        # Precio oscilante alrededor de un valor fijo
        close = 100 + np.random.randn(n) * 0.5
        df = pd.DataFrame({
            "Open": close - 0.1,
            "High": close + 1,
            "Low": close - 1,
            "Close": close,
            "Volume": np.full(n, 500000.0),
        }, index=dates)

        interp = ta._generar_interpretaciones(df)
        if "rsi" in interp:
            # Si RSI está en 40-60, debe decir neutral
            rsi_val = float(ta._rsi(df, 14).dropna().iloc[-1])
            if 40 <= rsi_val <= 60:
                assert "neutral" in interp["rsi"].lower() or "Zona neutral" in interp["rsi"]

    def test_interpretaciones_es_dict(self, ta, df_basic):
        """Las interpretaciones deben ser un dict."""
        interp = ta._generar_interpretaciones(df_basic)
        assert isinstance(interp, dict)

    def test_interpretacion_estocastico_sobrecompra(self, ta, df_overbought):
        """Estocástico > 80 debe generar interpretación de sobrecompra."""
        interp = ta._generar_interpretaciones(df_overbought)
        if "estocastico" in interp:
            assert "Sobrecompra" in interp["estocastico"] or "sobrecompra" in interp["estocastico"].lower()

    def test_interpretacion_estocastico_sobreventa(self, ta, df_oversold):
        """Estocástico < 20 debe generar interpretación de sobreventa."""
        interp = ta._generar_interpretaciones(df_oversold)
        if "estocastico" in interp:
            assert "Sobreventa" in interp["estocastico"] or "sobreventa" in interp["estocastico"].lower()


# ── Tests: Patrones ──────────────────────────────────────────────


class TestPatrones:
    """Verifica la detección de patrones chartistas."""

    def test_patrones_retorna_lista(self, ta, df_basic):
        """_detectar_patrones debe retornar una lista."""
        patrones = ta._detectar_patrones(df_basic)
        assert isinstance(patrones, list)

    def test_patron_formato_valido(self, ta, df_basic):
        """Cada patrón debe tener los campos requeridos."""
        patrones = ta._detectar_patrones(df_basic)
        campos_requeridos = {"fecha", "patron", "tipo", "precio", "confirmado_3_dias"}

        for patron in patrones:
            assert isinstance(patron, dict)
            for campo in campos_requeridos:
                assert campo in patron, f"Falta campo '{campo}' en patrón {patron}"

    def test_patron_tipo_valido(self, ta, df_basic):
        """El tipo de patrón debe ser alcista, bajista o neutral."""
        patrones = ta._detectar_patrones(df_basic)
        tipos_validos = {"alcista", "bajista", "neutral"}

        for patron in patrones:
            assert patron["tipo"] in tipos_validos, (
                f"Tipo inválido '{patron['tipo']}' en patrón {patron['patron']}"
            )

    def test_doji_detectado(self, ta, df_doji):
        """Debe detectar un Doji cuando body < 10% del rango."""
        patrones = ta._detectar_patrones(df_doji)
        dojis = [p for p in patrones if p["patron"] == "Doji"]
        assert len(dojis) > 0, "No se detectó ningún Doji"

    def test_patron_confirmado_3_dias_es_bool(self, ta, df_basic):
        """confirmado_3_dias debe ser booleano."""
        patrones = ta._detectar_patrones(df_basic)
        for patron in patrones:
            assert isinstance(patron["confirmado_3_dias"], bool)


# ── Tests: Divergencia MACD ──────────────────────────────────────


class TestDivergenciaMACD:
    """Verifica la detección de divergencia MACD."""

    def test_divergencia_retorna_dict(self, ta, df_basic):
        """_detectar_divergencia_macd debe retornar un dict."""
        div = ta._detectar_divergencia_macd(df_basic)
        assert isinstance(div, dict)
        assert "tipo" in div
        assert "descripcion" in div

    def test_divergencia_tipo_valido(self, ta, df_basic):
        """El tipo de divergencia debe ser alcista, bajista o None."""
        div = ta._detectar_divergencia_macd(df_basic)
        assert div["tipo"] in {"alcista", "bajista", None}

    def test_divergencia_datos_insuficientes(self, ta):
        """Con pocos datos, debe indicar datos insuficientes."""
        dates = pd.date_range("2023-01-01", periods=10, freq="B")
        df = pd.DataFrame({
            "Open": [100.0] * 10,
            "High": [105.0] * 10,
            "Low": [95.0] * 10,
            "Close": [100.0] * 10,
            "Volume": [500000.0] * 10,
        }, index=dates)

        div = ta._detectar_divergencia_macd(df)
        assert div["tipo"] is None


# ── Tests: Regla 3 Días ──────────────────────────────────────────


class TestRegla3Dias:
    """Verifica la Regla de 3 Días."""

    def test_regla_3_dias_retorna_dict(self, ta, df_basic):
        """_regla_3_dias debe retornar un dict."""
        regla = ta._regla_3_dias(df_basic)
        assert isinstance(regla, dict)

    def test_regla_3_dias_tiene_claves(self, ta, df_basic):
        """Debe tener claves para sma200, bollinger_upper, bollinger_lower."""
        regla = ta._regla_3_dias(df_basic)
        assert "sma200" in regla
        assert "bollinger_upper" in regla
        assert "bollinger_lower" in regla

    def test_regla_3_dias_datos_insuficientes(self, ta):
        """Con < 200 velas, debe retornar sin confirmaciones."""
        dates = pd.date_range("2023-01-01", periods=50, freq="B")
        df = pd.DataFrame({
            "Open": [100.0] * 50,
            "High": [105.0] * 50,
            "Low": [95.0] * 50,
            "Close": [100.0] * 50,
            "Volume": [500000.0] * 50,
        }, index=dates)

        regla = ta._regla_3_dias(df)
        assert regla["sma200"]["confirmado"] is False


# ── Tests: Fibonacci ─────────────────────────────────────────────


class TestFibonacci:
    """Verifica los niveles de Fibonacci."""

    def test_fibonacci_niveles_ordenados(self, ta, df_basic):
        """Los niveles deben estar ordenados de mayor a menor."""
        fib = ta._fibonacci(df_basic)
        assert fib["nivel_0"] >= fib["nivel_236"]
        assert fib["nivel_236"] >= fib["nivel_382"]
        assert fib["nivel_382"] >= fib["nivel_50"]
        assert fib["nivel_50"] >= fib["nivel_618"]
        assert fib["nivel_618"] >= fib["nivel_786"]
        assert fib["nivel_786"] >= fib["nivel_100"]

    def test_fibonacci_nivel_0_es_maximo(self, ta, df_basic):
        """Nivel 0% debe ser el máximo del período."""
        fib = ta._fibonacci(df_basic)
        assert fib["nivel_0"] == fib["maximo"]

    def test_fibonacci_nivel_100_es_minimo(self, ta, df_basic):
        """Nivel 100% debe ser el mínimo del período."""
        fib = ta._fibonacci(df_basic)
        assert fib["nivel_100"] == fib["minimo"]


# ── Tests: SAR Parabólico ────────────────────────────────────────


class TestSARParabolico:
    """Verifica el SAR Parabólico."""

    def test_sar_longitud_correcta(self, ta, df_basic):
        """SAR debe tener la misma longitud que el DataFrame."""
        sar = ta._parabolic_sar(df_basic)
        assert len(sar) == len(df_basic)

    def test_sar_valores_no_todos_nan(self, ta, df_basic):
        """SAR debe tener valores válidos (no todos NaN)."""
        sar = ta._parabolic_sar(df_basic)
        valid = sar.dropna()
        assert len(valid) > 0


# ── Tests: NaN handling ──────────────────────────────────────────


class TestNaNHandling:
    """Verifica que NaN se convierte a None en las listas."""

    def test_nan_convertido_a_none(self, ta, df_basic):
        """Los NaN en las series deben ser None en las listas."""
        resultado = ta.calcular_todos(df_basic)

        # SMA 200 tendrá NaN en las primeras 199 posiciones
        sma200 = resultado["sma200"]
        assert sma200[0] is None  # Primer valor debe ser None
        # Último valor debe ser un float
        assert isinstance(sma200[-1], float)

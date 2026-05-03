"""
Motor de Análisis Técnico Avanzado — TAService.

Calcula indicadores técnicos, detecta patrones chartistas y genera
interpretaciones automáticas en español para cualquier ticker.

Indicadores: SMA 50/200, EMA 20, RSI (14), MACD (12,26,9),
Estocástico de Lane (%K 14, %D 3), Bollinger Bands (20, ±2σ),
SAR Parabólico, Fibonacci, volumen promedio 20 días,
Stop Loss, Trailing Stop, Divergencia MACD, Regla 3 Días.

Patrones: Doji, Hammer, Shooting Star, Bullish/Bearish Engulfing,
Doble Techo, Doble Suelo, Cabeza y Hombros, C&H Invertido,
Triángulo Simétrico, Bandera Alcista, Bandera Bajista, Rectángulo.

Requisitos cubiertos: 4.1–4.9
"""

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _safe_list(series: pd.Series) -> list:
    """Convierte una pandas Series a lista reemplazando NaN por None."""
    return [None if pd.isna(v) else float(v) for v in series]


class TAService:
    """Servicio de análisis técnico con indicadores, patrones e interpretaciones."""

    # ── Método principal ─────────────────────────────────────────

    def calcular_todos(self, df: pd.DataFrame) -> dict:
        """
        Calcula todos los indicadores técnicos para un DataFrame OHLCV.

        Args:
            df: DataFrame con columnas Open, High, Low, Close, Volume.

        Returns:
            dict con todos los indicadores, patrones e interpretaciones.
            Las series se devuelven como listas para serialización JSON.
        """
        return {
            "sma50": _safe_list(self._sma(df, 50)),
            "sma200": _safe_list(self._sma(df, 200)),
            "ema20": _safe_list(self._ema(df, 20)),
            "rsi": _safe_list(self._rsi(df, 14)),
            "macd": {
                k: _safe_list(v)
                for k, v in self._macd(df, 12, 26, 9).items()
            },
            "estocastico": {
                k: _safe_list(v)
                for k, v in self._stochastic(df, 14, 3).items()
            },
            "bollinger": {
                k: _safe_list(v)
                for k, v in self._bollinger(df, 20, 2).items()
            },
            "sar": _safe_list(self._parabolic_sar(df, 0.02, 0.2)),
            "fibonacci": self._fibonacci(df),
            "vol_avg": _safe_list(self._vol_avg(df, 20)),
            "stop_loss": self._stop_loss(df),
            "trailing_stop": self._trailing_stop(df),
            "patrones": self._detectar_patrones(df),
            "divergencia_macd": self._detectar_divergencia_macd(df),
            "regla_3_dias": self._regla_3_dias(df),
            "interpretaciones": self._generar_interpretaciones(df),
        }

    # ── Indicadores base ─────────────────────────────────────────

    def _sma(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Media Móvil Simple."""
        return df["Close"].rolling(window=period).mean()

    def _ema(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Media Móvil Exponencial."""
        return df["Close"].ewm(span=period, adjust=False).mean()

    def _rsi(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """
        Índice de Fuerza Relativa usando suavizado de Wilder.

        Wilder's smoothing: avg = prev_avg * (period-1)/period + current/period
        """
        delta = df["Close"].diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)

        # Primera media: SMA de los primeros `period` valores
        avg_gain = gain.rolling(window=period, min_periods=period).mean()
        avg_loss = loss.rolling(window=period, min_periods=period).mean()

        # Wilder's smoothing para el resto
        for i in range(period, len(df)):
            if pd.notna(avg_gain.iloc[i - 1]):
                avg_gain.iloc[i] = (
                    avg_gain.iloc[i - 1] * (period - 1) + gain.iloc[i]
                ) / period
                avg_loss.iloc[i] = (
                    avg_loss.iloc[i - 1] * (period - 1) + loss.iloc[i]
                ) / period

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def _macd(
        self, df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9
    ) -> dict[str, pd.Series]:
        """MACD con línea de señal e histograma."""
        ema_fast = df["Close"].ewm(span=fast, adjust=False).mean()
        ema_slow = df["Close"].ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histograma = macd_line - signal_line
        return {
            "macd": macd_line,
            "signal": signal_line,
            "histograma": histograma,
        }

    def _stochastic(
        self, df: pd.DataFrame, k_period: int = 14, d_period: int = 3
    ) -> dict[str, pd.Series]:
        """Oscilador Estocástico de Lane: %K y %D."""
        low_min = df["Low"].rolling(k_period).min()
        high_max = df["High"].rolling(k_period).max()
        denom = high_max - low_min
        # Evitar división por cero
        denom = denom.replace(0, np.nan)
        k = 100 * (df["Close"] - low_min) / denom
        d = k.rolling(d_period).mean()
        return {"k": k, "d": d}

    def _bollinger(
        self, df: pd.DataFrame, period: int = 20, std_dev: int = 2
    ) -> dict[str, pd.Series]:
        """Bandas de Bollinger (SMA 20, ±2σ)."""
        mid = df["Close"].rolling(window=period).mean()
        std = df["Close"].rolling(window=period).std()
        upper = mid + std_dev * std
        lower = mid - std_dev * std
        return {"mid": mid, "upper": upper, "lower": lower}

    def _parabolic_sar(
        self,
        df: pd.DataFrame,
        aceleracion: float = 0.02,
        maximo: float = 0.2,
    ) -> pd.Series:
        """SAR Parabólico — implementación iterativa."""
        high = df["High"].values
        low = df["Low"].values
        close = df["Close"].values
        n = len(df)

        sar = np.full(n, np.nan)
        if n < 2:
            return pd.Series(sar, index=df.index)

        # Inicialización: determinar tendencia inicial
        is_uptrend = close[1] > close[0]
        af = aceleracion
        ep = high[0] if is_uptrend else low[0]
        sar[0] = low[0] if is_uptrend else high[0]

        for i in range(1, n):
            prev_sar = sar[i - 1]

            if is_uptrend:
                sar[i] = prev_sar + af * (ep - prev_sar)
                # SAR no puede estar por encima de los mínimos previos
                sar[i] = min(sar[i], low[i - 1])
                if i >= 2:
                    sar[i] = min(sar[i], low[i - 2])

                if low[i] < sar[i]:
                    # Cambio a tendencia bajista
                    is_uptrend = False
                    sar[i] = ep
                    af = aceleracion
                    ep = low[i]
                else:
                    if high[i] > ep:
                        ep = high[i]
                        af = min(af + aceleracion, maximo)
            else:
                sar[i] = prev_sar + af * (ep - prev_sar)
                # SAR no puede estar por debajo de los máximos previos
                sar[i] = max(sar[i], high[i - 1])
                if i >= 2:
                    sar[i] = max(sar[i], high[i - 2])

                if high[i] > sar[i]:
                    # Cambio a tendencia alcista
                    is_uptrend = True
                    sar[i] = ep
                    af = aceleracion
                    ep = high[i]
                else:
                    if low[i] < ep:
                        ep = low[i]
                        af = min(af + aceleracion, maximo)

        return pd.Series(sar, index=df.index)

    def _fibonacci(self, df: pd.DataFrame) -> dict[str, float]:
        """
        Niveles de retroceso de Fibonacci basados en máximo/mínimo del período.

        Retorna dict con niveles: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%.
        """
        high = float(df["High"].max())
        low = float(df["Low"].min())
        diff = high - low

        return {
            "nivel_0": round(high, 4),
            "nivel_236": round(high - 0.236 * diff, 4),
            "nivel_382": round(high - 0.382 * diff, 4),
            "nivel_50": round(high - 0.5 * diff, 4),
            "nivel_618": round(high - 0.618 * diff, 4),
            "nivel_786": round(high - 0.786 * diff, 4),
            "nivel_100": round(low, 4),
            "maximo": round(high, 4),
            "minimo": round(low, 4),
        }

    def _vol_avg(self, df: pd.DataFrame, period: int = 20) -> pd.Series:
        """Volumen promedio de los últimos N días."""
        return df["Volume"].rolling(window=period).mean()

    def _stop_loss(self, df: pd.DataFrame) -> float:
        """
        Stop Loss sugerido: min(Low últimas 10 velas) × 0.975.

        Retorna valor con 4 decimales de precisión.
        """
        window = min(10, len(df))
        min_local = float(df["Low"].iloc[-window:].min())
        return round(min_local * 0.975, 4)

    def _trailing_stop(self, df: pd.DataFrame) -> float:
        """Trailing Stop basado en el último valor del SAR Parabólico."""
        sar = self._parabolic_sar(df, aceleracion=0.02, maximo=0.2)
        # Buscar el último valor no-NaN
        valid_sar = sar.dropna()
        if valid_sar.empty:
            return round(float(df["Low"].iloc[-1]) * 0.975, 4)
        return round(float(valid_sar.iloc[-1]), 4)

    def _detectar_divergencia_macd(
        self, df: pd.DataFrame, ventana: int = 20
    ) -> dict[str, Any]:
        """
        Detecta divergencia entre precio y MACD en las últimas N velas.

        Divergencia bajista: precio hace nuevo máximo pero histograma MACD no.
        Divergencia alcista: precio hace nuevo mínimo pero histograma MACD no.

        Returns:
            dict con 'tipo' ('alcista'/'bajista'/None) y 'descripcion'.
        """
        if len(df) < ventana + 5:
            return {"tipo": None, "descripcion": "Datos insuficientes para detectar divergencia"}

        macd_data = self._macd(df)
        hist = macd_data["histograma"]

        # Tomar las últimas `ventana` velas
        recent_close = df["Close"].iloc[-ventana:]
        recent_hist = hist.iloc[-ventana:]

        # Dividir en dos mitades para comparar
        mid = ventana // 2
        first_half_close = recent_close.iloc[:mid]
        second_half_close = recent_close.iloc[mid:]
        first_half_hist = recent_hist.iloc[:mid]
        second_half_hist = recent_hist.iloc[mid:]

        # Divergencia bajista: precio sube, histograma baja
        price_new_high = float(second_half_close.max()) > float(first_half_close.max())
        hist_lower = float(second_half_hist.max()) < float(first_half_hist.max())

        if price_new_high and hist_lower:
            return {
                "tipo": "bajista",
                "descripcion": (
                    "Divergencia bajista detectada: el precio sube "
                    "pero el MACD baja, señal de posible reversión"
                ),
            }

        # Divergencia alcista: precio baja, histograma sube
        price_new_low = float(second_half_close.min()) < float(first_half_close.min())
        hist_higher = float(second_half_hist.min()) > float(first_half_hist.min())

        if price_new_low and hist_higher:
            return {
                "tipo": "alcista",
                "descripcion": (
                    "Divergencia alcista detectada: el precio baja "
                    "pero el MACD sube, señal de posible reversión"
                ),
            }

        return {"tipo": None, "descripcion": "Sin divergencia detectada"}

    def _regla_3_dias(self, df: pd.DataFrame) -> dict[str, Any]:
        """
        Regla de 3 Días: confirma rompimientos cuando el precio cierra
        por encima/debajo de un nivel durante 3 sesiones consecutivas.

        Verifica contra SMA 200 y bandas de Bollinger.

        Returns:
            dict con señales de rompimiento confirmadas.
        """
        result: dict[str, Any] = {
            "sma200": {"rompimiento": None, "confirmado": False, "direccion": None},
            "bollinger_upper": {"rompimiento": None, "confirmado": False, "direccion": None},
            "bollinger_lower": {"rompimiento": None, "confirmado": False, "direccion": None},
        }

        if len(df) < 200:
            return result

        sma200 = self._sma(df, 200)
        bollinger = self._bollinger(df, 20, 2)

        closes = df["Close"].iloc[-3:]
        sma200_vals = sma200.iloc[-3:]
        upper_vals = bollinger["upper"].iloc[-3:]
        lower_vals = bollinger["lower"].iloc[-3:]

        # Verificar SMA 200
        if all(pd.notna(s) for s in sma200_vals):
            above_sma = all(
                float(c) > float(s) for c, s in zip(closes, sma200_vals)
            )
            below_sma = all(
                float(c) < float(s) for c, s in zip(closes, sma200_vals)
            )
            if above_sma:
                result["sma200"] = {
                    "rompimiento": "alcista",
                    "confirmado": True,
                    "direccion": "arriba",
                }
            elif below_sma:
                result["sma200"] = {
                    "rompimiento": "bajista",
                    "confirmado": True,
                    "direccion": "abajo",
                }

        # Verificar Bollinger superior
        if all(pd.notna(u) for u in upper_vals):
            above_upper = all(
                float(c) > float(u) for c, u in zip(closes, upper_vals)
            )
            if above_upper:
                result["bollinger_upper"] = {
                    "rompimiento": "alcista",
                    "confirmado": True,
                    "direccion": "arriba",
                }

        # Verificar Bollinger inferior
        if all(pd.notna(l) for l in lower_vals):
            below_lower = all(
                float(c) < float(l) for c, l in zip(closes, lower_vals)
            )
            if below_lower:
                result["bollinger_lower"] = {
                    "rompimiento": "bajista",
                    "confirmado": True,
                    "direccion": "abajo",
                }

        return result

    # ── Patrones chartistas ──────────────────────────────────────

    def _detectar_patrones(self, df: pd.DataFrame) -> list[dict]:
        """
        Detecta patrones chartistas básicos y avanzados.

        Patrones básicos: Doji, Hammer, Shooting Star,
                          Bullish Engulfing, Bearish Engulfing.
        Patrones avanzados: Doble Techo, Doble Suelo, Cabeza y Hombros,
                            C&H Invertido, Triángulo Simétrico,
                            Bandera Alcista, Bandera Bajista, Rectángulo.

        Returns:
            Lista de dicts con: fecha, patron, tipo, precio, confirmado_3_dias.
        """
        patrones: list[dict] = []

        # Patrones de velas individuales y de dos velas
        patrones.extend(self._patrones_basicos(df))

        # Patrones chartistas avanzados
        patrones.extend(self._patrones_avanzados(df))

        return patrones

    def _patrones_basicos(self, df: pd.DataFrame) -> list[dict]:
        """Detecta patrones de velas básicos."""
        patrones: list[dict] = []
        if len(df) < 2:
            return patrones

        for i in range(1, len(df)):
            o = float(df["Open"].iloc[i])
            h = float(df["High"].iloc[i])
            l = float(df["Low"].iloc[i])
            c = float(df["Close"].iloc[i])
            fecha = str(df.index[i].date()) if hasattr(df.index[i], "date") else str(df.index[i])

            body = abs(c - o)
            rango = h - l
            upper_shadow = h - max(o, c)
            lower_shadow = min(o, c) - l

            # Previo
            prev_o = float(df["Open"].iloc[i - 1])
            prev_c = float(df["Close"].iloc[i - 1])
            prev_body = abs(prev_c - prev_o)

            # Tendencia reciente (últimas 5 velas)
            if i >= 5:
                trend_close = df["Close"].iloc[i - 5 : i]
                is_downtrend = float(trend_close.iloc[-1]) < float(trend_close.iloc[0])
                is_uptrend = float(trend_close.iloc[-1]) > float(trend_close.iloc[0])
            else:
                is_downtrend = False
                is_uptrend = False

            # Confirmación 3 días
            confirmado = self._confirmar_3_dias(df, i)

            # Doji: cuerpo < 10% del rango
            if rango > 0 and body < 0.1 * rango:
                patrones.append({
                    "fecha": fecha,
                    "patron": "Doji",
                    "tipo": "neutral",
                    "precio": round(c, 4),
                    "confirmado_3_dias": confirmado,
                })

            # Hammer: sombra inferior > 2× cuerpo, sombra superior pequeña, en tendencia bajista
            if (
                body > 0
                and lower_shadow > 2 * body
                and upper_shadow < body
                and is_downtrend
            ):
                patrones.append({
                    "fecha": fecha,
                    "patron": "Hammer",
                    "tipo": "alcista",
                    "precio": round(c, 4),
                    "confirmado_3_dias": confirmado,
                })

            # Shooting Star: sombra superior > 2× cuerpo, sombra inferior pequeña, en tendencia alcista
            if (
                body > 0
                and upper_shadow > 2 * body
                and lower_shadow < body
                and is_uptrend
            ):
                patrones.append({
                    "fecha": fecha,
                    "patron": "Shooting Star",
                    "tipo": "bajista",
                    "precio": round(c, 4),
                    "confirmado_3_dias": confirmado,
                })

            # Bullish Engulfing: vela actual alcista envuelve vela previa bajista
            if (
                prev_c < prev_o  # previa bajista
                and c > o  # actual alcista
                and c > prev_o  # cierre actual > apertura previa
                and o < prev_c  # apertura actual < cierre previo
            ):
                patrones.append({
                    "fecha": fecha,
                    "patron": "Bullish Engulfing",
                    "tipo": "alcista",
                    "precio": round(c, 4),
                    "confirmado_3_dias": confirmado,
                })

            # Bearish Engulfing: vela actual bajista envuelve vela previa alcista
            if (
                prev_c > prev_o  # previa alcista
                and c < o  # actual bajista
                and o > prev_c  # apertura actual > cierre previo
                and c < prev_o  # cierre actual < apertura previa
            ):
                patrones.append({
                    "fecha": fecha,
                    "patron": "Bearish Engulfing",
                    "tipo": "bajista",
                    "precio": round(c, 4),
                    "confirmado_3_dias": confirmado,
                })

        return patrones

    def _confirmar_3_dias(self, df: pd.DataFrame, idx: int) -> bool:
        """
        Verifica si hay confirmación de 3 días después del patrón.

        Comprueba si el precio cierra en la misma dirección durante
        3 sesiones consecutivas después del patrón.
        """
        if idx + 3 >= len(df):
            return False

        patron_close = float(df["Close"].iloc[idx])
        patron_open = float(df["Open"].iloc[idx])
        is_bullish = patron_close > patron_open

        for j in range(1, 4):
            next_close = float(df["Close"].iloc[idx + j])
            if is_bullish and next_close <= patron_close:
                return False
            if not is_bullish and next_close >= patron_close:
                return False

        return True

    def _patrones_avanzados(self, df: pd.DataFrame) -> list[dict]:
        """Detecta patrones chartistas avanzados multi-vela."""
        patrones: list[dict] = []

        if len(df) < 20:
            return patrones

        patrones.extend(self._detectar_doble_techo(df))
        patrones.extend(self._detectar_doble_suelo(df))
        patrones.extend(self._detectar_cabeza_hombros(df))
        patrones.extend(self._detectar_cabeza_hombros_invertido(df))
        patrones.extend(self._detectar_triangulo_simetrico(df))
        patrones.extend(self._detectar_bandera_alcista(df))
        patrones.extend(self._detectar_bandera_bajista(df))
        patrones.extend(self._detectar_rectangulo(df))

        return patrones

    def _detectar_doble_techo(self, df: pd.DataFrame) -> list[dict]:
        """
        Doble Techo: dos máximos similares (< 2% diferencia)
        separados por > 5 velas.
        """
        patrones: list[dict] = []
        highs = df["High"].values
        n = len(highs)

        # Buscar máximos locales
        peaks = []
        for i in range(2, n - 2):
            if highs[i] > highs[i - 1] and highs[i] > highs[i - 2] and \
               highs[i] > highs[i + 1] and highs[i] > highs[i + 2]:
                peaks.append(i)

        for a in range(len(peaks)):
            for b in range(a + 1, len(peaks)):
                idx_a, idx_b = peaks[a], peaks[b]
                if idx_b - idx_a <= 5:
                    continue
                h_a, h_b = float(highs[idx_a]), float(highs[idx_b])
                if h_a == 0:
                    continue
                diff_pct = abs(h_a - h_b) / h_a * 100
                if diff_pct < 2:
                    fecha = str(df.index[idx_b].date()) if hasattr(df.index[idx_b], "date") else str(df.index[idx_b])
                    patrones.append({
                        "fecha": fecha,
                        "patron": "Doble Techo",
                        "tipo": "bajista",
                        "precio": round(h_b, 4),
                        "confirmado_3_dias": self._confirmar_3_dias(df, idx_b),
                    })
                    return patrones  # Solo reportar el primero encontrado

        return patrones

    def _detectar_doble_suelo(self, df: pd.DataFrame) -> list[dict]:
        """
        Doble Suelo: dos mínimos similares (< 2% diferencia)
        separados por > 5 velas.
        """
        patrones: list[dict] = []
        lows = df["Low"].values
        n = len(lows)

        # Buscar mínimos locales
        valleys = []
        for i in range(2, n - 2):
            if lows[i] < lows[i - 1] and lows[i] < lows[i - 2] and \
               lows[i] < lows[i + 1] and lows[i] < lows[i + 2]:
                valleys.append(i)

        for a in range(len(valleys)):
            for b in range(a + 1, len(valleys)):
                idx_a, idx_b = valleys[a], valleys[b]
                if idx_b - idx_a <= 5:
                    continue
                l_a, l_b = float(lows[idx_a]), float(lows[idx_b])
                if l_a == 0:
                    continue
                diff_pct = abs(l_a - l_b) / l_a * 100
                if diff_pct < 2:
                    fecha = str(df.index[idx_b].date()) if hasattr(df.index[idx_b], "date") else str(df.index[idx_b])
                    patrones.append({
                        "fecha": fecha,
                        "patron": "Doble Suelo",
                        "tipo": "alcista",
                        "precio": round(l_b, 4),
                        "confirmado_3_dias": self._confirmar_3_dias(df, idx_b),
                    })
                    return patrones

        return patrones

    def _detectar_cabeza_hombros(self, df: pd.DataFrame) -> list[dict]:
        """
        Cabeza y Hombros: tres picos donde el del medio es el más alto.
        """
        patrones: list[dict] = []
        highs = df["High"].values
        n = len(highs)

        peaks = []
        for i in range(2, n - 2):
            if highs[i] > highs[i - 1] and highs[i] > highs[i - 2] and \
               highs[i] > highs[i + 1] and highs[i] > highs[i + 2]:
                peaks.append(i)

        for i in range(len(peaks) - 2):
            left, head, right = peaks[i], peaks[i + 1], peaks[i + 2]
            h_left = float(highs[left])
            h_head = float(highs[head])
            h_right = float(highs[right])

            # Cabeza debe ser el más alto
            if h_head > h_left and h_head > h_right:
                # Hombros deben ser similares (< 5% diferencia)
                if h_left > 0 and abs(h_left - h_right) / h_left * 100 < 5:
                    fecha = str(df.index[right].date()) if hasattr(df.index[right], "date") else str(df.index[right])
                    patrones.append({
                        "fecha": fecha,
                        "patron": "Cabeza y Hombros",
                        "tipo": "bajista",
                        "precio": round(h_head, 4),
                        "confirmado_3_dias": self._confirmar_3_dias(df, right),
                    })
                    return patrones

        return patrones

    def _detectar_cabeza_hombros_invertido(self, df: pd.DataFrame) -> list[dict]:
        """
        Cabeza y Hombros Invertido: tres valles donde el del medio es el más bajo.
        """
        patrones: list[dict] = []
        lows = df["Low"].values
        n = len(lows)

        valleys = []
        for i in range(2, n - 2):
            if lows[i] < lows[i - 1] and lows[i] < lows[i - 2] and \
               lows[i] < lows[i + 1] and lows[i] < lows[i + 2]:
                valleys.append(i)

        for i in range(len(valleys) - 2):
            left, head, right = valleys[i], valleys[i + 1], valleys[i + 2]
            l_left = float(lows[left])
            l_head = float(lows[head])
            l_right = float(lows[right])

            # Cabeza invertida debe ser el más bajo
            if l_head < l_left and l_head < l_right:
                # Hombros deben ser similares
                if l_left > 0 and abs(l_left - l_right) / l_left * 100 < 5:
                    fecha = str(df.index[right].date()) if hasattr(df.index[right], "date") else str(df.index[right])
                    patrones.append({
                        "fecha": fecha,
                        "patron": "Cabeza y Hombros Invertido",
                        "tipo": "alcista",
                        "precio": round(l_head, 4),
                        "confirmado_3_dias": self._confirmar_3_dias(df, right),
                    })
                    return patrones

        return patrones

    def _detectar_triangulo_simetrico(self, df: pd.DataFrame) -> list[dict]:
        """
        Triángulo Simétrico: máximos decrecientes + mínimos crecientes convergentes.
        Busca en las últimas 30 velas.
        """
        patrones: list[dict] = []
        window = min(30, len(df))
        recent = df.iloc[-window:]

        highs = recent["High"].values
        lows = recent["Low"].values
        n = len(recent)

        # Buscar máximos y mínimos locales
        local_highs = []
        local_lows = []
        for i in range(1, n - 1):
            if highs[i] > highs[i - 1] and highs[i] > highs[i + 1]:
                local_highs.append((i, float(highs[i])))
            if lows[i] < lows[i - 1] and lows[i] < lows[i + 1]:
                local_lows.append((i, float(lows[i])))

        if len(local_highs) >= 3 and len(local_lows) >= 3:
            # Verificar máximos decrecientes
            highs_decreasing = all(
                local_highs[j][1] > local_highs[j + 1][1]
                for j in range(len(local_highs) - 1)
            )
            # Verificar mínimos crecientes
            lows_increasing = all(
                local_lows[j][1] < local_lows[j + 1][1]
                for j in range(len(local_lows) - 1)
            )

            if highs_decreasing and lows_increasing:
                last_idx = recent.index[-1]
                fecha = str(last_idx.date()) if hasattr(last_idx, "date") else str(last_idx)
                patrones.append({
                    "fecha": fecha,
                    "patron": "Triángulo Simétrico",
                    "tipo": "neutral",
                    "precio": round(float(recent["Close"].iloc[-1]), 4),
                    "confirmado_3_dias": False,
                })

        return patrones

    def _detectar_bandera_alcista(self, df: pd.DataFrame) -> list[dict]:
        """
        Bandera Alcista: impulso alcista fuerte seguido de consolidación
        en canal descendente.
        """
        patrones: list[dict] = []
        if len(df) < 20:
            return patrones

        # Buscar impulso alcista (últimas 20 velas)
        window = min(20, len(df))
        recent = df.iloc[-window:]

        # Impulso: primera mitad sube significativamente (> 5%)
        mid = window // 2
        impulse = recent.iloc[:mid]
        consolidation = recent.iloc[mid:]

        impulse_return = (
            float(impulse["Close"].iloc[-1]) - float(impulse["Close"].iloc[0])
        ) / float(impulse["Close"].iloc[0]) * 100

        if impulse_return > 5:
            # Consolidación: máximos y mínimos descendentes (canal descendente)
            cons_highs = consolidation["High"].values
            cons_lows = consolidation["Low"].values

            if len(cons_highs) >= 3:
                highs_desc = all(
                    cons_highs[j] >= cons_highs[j + 1]
                    for j in range(len(cons_highs) - 1)
                )
                lows_desc = all(
                    cons_lows[j] >= cons_lows[j + 1]
                    for j in range(len(cons_lows) - 1)
                )

                # Rango de consolidación menor que el impulso
                cons_range = float(cons_highs.max() - cons_lows.min())
                impulse_range = float(impulse["High"].max() - impulse["Low"].min())

                if (highs_desc or lows_desc) and cons_range < impulse_range:
                    last_idx = recent.index[-1]
                    fecha = str(last_idx.date()) if hasattr(last_idx, "date") else str(last_idx)
                    patrones.append({
                        "fecha": fecha,
                        "patron": "Bandera Alcista",
                        "tipo": "alcista",
                        "precio": round(float(recent["Close"].iloc[-1]), 4),
                        "confirmado_3_dias": False,
                    })

        return patrones

    def _detectar_bandera_bajista(self, df: pd.DataFrame) -> list[dict]:
        """
        Bandera Bajista: impulso bajista fuerte seguido de consolidación
        en canal ascendente.
        """
        patrones: list[dict] = []
        if len(df) < 20:
            return patrones

        window = min(20, len(df))
        recent = df.iloc[-window:]

        mid = window // 2
        impulse = recent.iloc[:mid]
        consolidation = recent.iloc[mid:]

        impulse_return = (
            float(impulse["Close"].iloc[-1]) - float(impulse["Close"].iloc[0])
        ) / float(impulse["Close"].iloc[0]) * 100

        if impulse_return < -5:
            cons_highs = consolidation["High"].values
            cons_lows = consolidation["Low"].values

            if len(cons_highs) >= 3:
                highs_asc = all(
                    cons_highs[j] <= cons_highs[j + 1]
                    for j in range(len(cons_highs) - 1)
                )
                lows_asc = all(
                    cons_lows[j] <= cons_lows[j + 1]
                    for j in range(len(cons_lows) - 1)
                )

                cons_range = float(cons_highs.max() - cons_lows.min())
                impulse_range = float(impulse["High"].max() - impulse["Low"].min())

                if (highs_asc or lows_asc) and cons_range < impulse_range:
                    last_idx = recent.index[-1]
                    fecha = str(last_idx.date()) if hasattr(last_idx, "date") else str(last_idx)
                    patrones.append({
                        "fecha": fecha,
                        "patron": "Bandera Bajista",
                        "tipo": "bajista",
                        "precio": round(float(recent["Close"].iloc[-1]), 4),
                        "confirmado_3_dias": False,
                    })

        return patrones

    def _detectar_rectangulo(self, df: pd.DataFrame) -> list[dict]:
        """
        Rectángulo: precio oscila entre soporte y resistencia horizontales.
        Busca en las últimas 20 velas.
        """
        patrones: list[dict] = []
        window = min(20, len(df))
        recent = df.iloc[-window:]

        highs = recent["High"].values
        lows = recent["Low"].values

        resistance = float(highs.max())
        support = float(lows.min())

        if support == 0 or resistance == support:
            return patrones

        # Verificar que los máximos están cerca de la resistencia
        # y los mínimos cerca del soporte (< 2% de variación)
        range_size = resistance - support
        high_tolerance = range_size * 0.15
        low_tolerance = range_size * 0.15

        touches_resistance = sum(
            1 for h in highs if abs(float(h) - resistance) < high_tolerance
        )
        touches_support = sum(
            1 for l in lows if abs(float(l) - support) < low_tolerance
        )

        # Al menos 3 toques en cada nivel
        if touches_resistance >= 3 and touches_support >= 3:
            # Verificar que el rango no es demasiado amplio (< 10% del precio)
            mid_price = (resistance + support) / 2
            if range_size / mid_price < 0.10:
                last_idx = recent.index[-1]
                fecha = str(last_idx.date()) if hasattr(last_idx, "date") else str(last_idx)
                patrones.append({
                    "fecha": fecha,
                    "patron": "Rectángulo",
                    "tipo": "neutral",
                    "precio": round(float(recent["Close"].iloc[-1]), 4),
                    "confirmado_3_dias": False,
                })

        return patrones

    # ── Interpretaciones automáticas en español ──────────────────

    def _generar_interpretaciones(self, df: pd.DataFrame) -> dict[str, str]:
        """
        Genera interpretaciones en texto en español para cada indicador.

        Reglas:
        - RSI > 70 → sobrecompra
        - RSI < 30 → sobreventa
        - RSI 40–60 → zona neutral
        - RSI 60–70 → acercándose a sobrecompra
        - RSI 30–40 → acercándose a sobreventa
        - Golden Cross → señal alcista largo plazo
        - Death Cross → señal bajista largo plazo
        - Divergencia MACD → señal de posible reversión
        - Estocástico > 80 → sobrecompra
        - Estocástico < 20 → sobreventa
        - Bollinger upper touch → posible sobrecompra
        - Bollinger lower touch → posible sobreventa

        Returns:
            dict con clave por indicador y valor texto en español.
        """
        interpretaciones: dict[str, str] = {}

        # ── RSI ──
        rsi = self._rsi(df, 14)
        rsi_valid = rsi.dropna()
        if not rsi_valid.empty:
            rsi_actual = float(rsi_valid.iloc[-1])
            if rsi_actual > 70:
                interpretaciones["rsi"] = (
                    "Sobrecompra (RSI > 70): considere reducir posición"
                )
            elif rsi_actual < 30:
                interpretaciones["rsi"] = (
                    "Sobreventa (RSI < 30): posible oportunidad de compra"
                )
            elif 40 <= rsi_actual <= 60:
                interpretaciones["rsi"] = (
                    "Zona neutral (RSI 40–60): sin señal clara"
                )
            elif 60 < rsi_actual <= 70:
                interpretaciones["rsi"] = (
                    "RSI elevado, acercándose a sobrecompra"
                )
            elif 30 <= rsi_actual < 40:
                interpretaciones["rsi"] = (
                    "RSI bajo, acercándose a sobreventa"
                )

        # ── Golden Cross / Death Cross ──
        if len(df) >= 200:
            sma50 = self._sma(df, 50)
            sma200 = self._sma(df, 200)

            sma50_valid = sma50.dropna()
            sma200_valid = sma200.dropna()

            if len(sma50_valid) >= 2 and len(sma200_valid) >= 2:
                # Alinear por índice para comparar los últimos valores
                common_idx = sma50_valid.index.intersection(sma200_valid.index)
                if len(common_idx) >= 2:
                    last_sma50 = float(sma50_valid.loc[common_idx[-1]])
                    last_sma200 = float(sma200_valid.loc[common_idx[-1]])
                    prev_sma50 = float(sma50_valid.loc[common_idx[-2]])
                    prev_sma200 = float(sma200_valid.loc[common_idx[-2]])

                    # Golden Cross: SMA50 cruza por encima de SMA200
                    if last_sma50 > last_sma200 and prev_sma50 <= prev_sma200:
                        interpretaciones["cruces_medias"] = (
                            "Señal alcista de largo plazo detectada (Golden Cross)"
                        )
                    # Death Cross: SMA50 cruza por debajo de SMA200
                    elif last_sma50 < last_sma200 and prev_sma50 >= prev_sma200:
                        interpretaciones["cruces_medias"] = (
                            "Señal bajista de largo plazo detectada (Death Cross)"
                        )

        # ── Divergencia MACD ──
        divergencia = self._detectar_divergencia_macd(df)
        if divergencia["tipo"] == "bajista":
            interpretaciones["divergencia_macd"] = (
                "Divergencia bajista detectada: el precio sube pero el MACD baja, "
                "señal de posible reversión"
            )
        elif divergencia["tipo"] == "alcista":
            interpretaciones["divergencia_macd"] = (
                "Divergencia alcista detectada: el precio baja pero el MACD sube, "
                "señal de posible reversión"
            )

        # ── Estocástico ──
        stoch = self._stochastic(df, 14, 3)
        k_valid = stoch["k"].dropna()
        if not k_valid.empty:
            k_actual = float(k_valid.iloc[-1])
            if k_actual > 80:
                interpretaciones["estocastico"] = (
                    "Sobrecompra en estocástico (%K > 80)"
                )
            elif k_actual < 20:
                interpretaciones["estocastico"] = (
                    "Sobreventa en estocástico (%K < 20)"
                )

        # ── Bollinger Bands ──
        bollinger = self._bollinger(df, 20, 2)
        upper_valid = bollinger["upper"].dropna()
        lower_valid = bollinger["lower"].dropna()

        if not upper_valid.empty and not lower_valid.empty:
            last_close = float(df["Close"].iloc[-1])
            last_upper = float(upper_valid.iloc[-1])
            last_lower = float(lower_valid.iloc[-1])

            # "Touch" = precio dentro del 1% de la banda
            if last_upper > 0:
                upper_proximity = abs(last_close - last_upper) / last_upper
                if upper_proximity < 0.01 or last_close >= last_upper:
                    interpretaciones["bollinger"] = (
                        "Precio en banda superior de Bollinger: posible sobrecompra"
                    )

            if last_lower > 0:
                lower_proximity = abs(last_close - last_lower) / last_lower
                if lower_proximity < 0.01 or last_close <= last_lower:
                    interpretaciones["bollinger"] = (
                        "Precio en banda inferior de Bollinger: posible sobreventa"
                    )

        return interpretaciones

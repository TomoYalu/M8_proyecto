# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Wizard Ciclo Económico
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Servicio del Wizard de Ciclo Económico — Pipeline Top-Down.

Implementa el flujo de 4 etapas:
    Etapa 0: Cálculo de perfil de riesgo (5 preguntas)
    Etapa 1: Determinación del ciclo económico (caché 24h)
    Etapa 2: Rotación sectorial por fase
    Etapa 3: Filtro fundamental (ROE, ROA, D/E, P/E)
    Etapa 4: Filtro técnico (SMA 200, RSI 40-60)
    + Asset Allocation por perfil de riesgo

Requisitos cubiertos: 7.1–7.7
"""

import logging
from datetime import datetime, timezone, timedelta

import yfinance as yf

from ..extensions import db
from ..models.cache import CicloCache
from .ta_service import TAService

logger = logging.getLogger(__name__)


# ── Constantes ───────────────────────────────────────────────────

PERFILES = {
    "Ultra Conservador": {
        "rango": (5, 8),
        "descripcion": (
            "Prioriza la preservación del capital. Mínima exposición a "
            "renta variable, alta concentración en bonos y activos seguros."
        ),
    },
    "Conservador": {
        "rango": (9, 12),
        "descripcion": (
            "Busca estabilidad con algo de crecimiento. Predominan bonos "
            "con exposición moderada a renta variable."
        ),
    },
    "Moderado": {
        "rango": (13, 16),
        "descripcion": (
            "Equilibrio entre crecimiento y protección. Distribución "
            "balanceada entre renta variable y renta fija."
        ),
    },
    "Balanceado": {
        "rango": (17, 19),
        "descripcion": (
            "Orientado al crecimiento con tolerancia a volatilidad. "
            "Mayor peso en renta variable con diversificación."
        ),
    },
    "Agresivo": {
        "rango": (20, 20),
        "descripcion": (
            "Máximo crecimiento a largo plazo. Alta concentración en "
            "renta variable, mínima renta fija."
        ),
    },
}

ALLOCATION_POR_PERFIL = {
    "Ultra Conservador": [
        {"clase": "Renta Variable", "porcentaje": 10, "etfs": ["SPY", "QQQ", "IWM"]},
        {"clase": "Bonos", "porcentaje": 70, "etfs": ["BND", "TLT", "LQD", "HYG"]},
        {"clase": "Oro", "porcentaje": 10, "etfs": ["GLD"]},
        {"clase": "Efectivo", "porcentaje": 10, "etfs": []},
    ],
    "Conservador": [
        {"clase": "Renta Variable", "porcentaje": 25, "etfs": ["SPY", "QQQ", "IWM"]},
        {"clase": "Bonos", "porcentaje": 55, "etfs": ["BND", "TLT", "LQD", "HYG"]},
        {"clase": "Oro", "porcentaje": 10, "etfs": ["GLD"]},
        {"clase": "Efectivo", "porcentaje": 10, "etfs": []},
    ],
    "Moderado": [
        {"clase": "Renta Variable", "porcentaje": 50, "etfs": ["SPY", "QQQ", "IWM"]},
        {"clase": "Bonos", "porcentaje": 35, "etfs": ["BND", "TLT", "LQD", "HYG"]},
        {"clase": "Oro", "porcentaje": 10, "etfs": ["GLD"]},
        {"clase": "Efectivo", "porcentaje": 5, "etfs": []},
    ],
    "Balanceado": [
        {"clase": "Renta Variable", "porcentaje": 70, "etfs": ["SPY", "QQQ", "IWM"]},
        {"clase": "Bonos", "porcentaje": 20, "etfs": ["BND", "TLT", "LQD", "HYG"]},
        {"clase": "Oro", "porcentaje": 7, "etfs": ["GLD"]},
        {"clase": "Efectivo", "porcentaje": 3, "etfs": []},
    ],
    "Agresivo": [
        {"clase": "Renta Variable", "porcentaje": 90, "etfs": ["SPY", "QQQ", "IWM"]},
        {"clase": "Bonos", "porcentaje": 5, "etfs": ["BND", "TLT", "LQD", "HYG"]},
        {"clase": "Oro", "porcentaje": 5, "etfs": ["GLD"]},
        {"clase": "Efectivo", "porcentaje": 0, "etfs": []},
    ],
}

SECTORES_POR_FASE = {
    "Early": [
        {
            "nombre": "Financiero",
            "justificacion": (
                "Las tasas de interés comienzan a subir desde niveles bajos, "
                "beneficiando márgenes de intermediación bancaria."
            ),
            "etfs": ["XLF", "KBE", "KRE"],
        },
        {
            "nombre": "Consumo Discrecional",
            "justificacion": (
                "La confianza del consumidor se recupera y el gasto "
                "discrecional aumenta con la mejora económica."
            ),
            "etfs": ["XLY", "VCR"],
        },
        {
            "nombre": "Tecnología",
            "justificacion": (
                "Las empresas retoman inversiones en tecnología "
                "para impulsar productividad en la recuperación."
            ),
            "etfs": ["XLK", "QQQ", "VGT"],
        },
        {
            "nombre": "Materiales",
            "justificacion": (
                "La demanda de materias primas crece con la reactivación "
                "de la producción industrial."
            ),
            "etfs": ["XLB", "VAW"],
        },
    ],
    "Mid": [
        {
            "nombre": "Tecnología",
            "justificacion": (
                "El crecimiento económico sostenido impulsa la adopción "
                "tecnológica y la expansión de márgenes."
            ),
            "etfs": ["XLK", "QQQ", "VGT"],
        },
        {
            "nombre": "Energía",
            "justificacion": (
                "La demanda energética crece con la actividad económica "
                "en plena expansión."
            ),
            "etfs": ["XLE", "VDE"],
        },
        {
            "nombre": "Industriales",
            "justificacion": (
                "La producción industrial alcanza su ritmo máximo "
                "con pedidos y capacidad utilizada en alza."
            ),
            "etfs": ["XLI", "VIS"],
        },
        {
            "nombre": "Consumo Discrecional",
            "justificacion": (
                "El empleo fuerte y los salarios en alza sostienen "
                "el gasto del consumidor."
            ),
            "etfs": ["XLY", "VCR"],
        },
    ],
    "Late": [
        {
            "nombre": "Energía",
            "justificacion": (
                "Los precios de commodities suben por presiones inflacionarias "
                "y demanda acumulada."
            ),
            "etfs": ["XLE", "VDE"],
        },
        {
            "nombre": "Materiales",
            "justificacion": (
                "La inflación beneficia a productores de materias primas "
                "con poder de fijación de precios."
            ),
            "etfs": ["XLB", "VAW"],
        },
        {
            "nombre": "Salud",
            "justificacion": (
                "Sector defensivo que mantiene demanda estable "
                "independientemente del ciclo económico."
            ),
            "etfs": ["XLV", "VHT"],
        },
        {
            "nombre": "Consumo Básico",
            "justificacion": (
                "Los productos de primera necesidad mantienen ventas "
                "estables ante la desaceleración."
            ),
            "etfs": ["XLP", "VDC"],
        },
    ],
    "Recession": [
        {
            "nombre": "Utilities",
            "justificacion": (
                "Sector defensivo por excelencia con flujos de caja "
                "predecibles y dividendos estables."
            ),
            "etfs": ["XLU", "VPU"],
        },
        {
            "nombre": "Consumo Básico",
            "justificacion": (
                "La demanda de productos esenciales es inelástica "
                "y resiste la contracción económica."
            ),
            "etfs": ["XLP", "VDC"],
        },
        {
            "nombre": "Salud",
            "justificacion": (
                "El gasto en salud es no discrecional y se mantiene "
                "durante recesiones."
            ),
            "etfs": ["XLV", "VHT"],
        },
        {
            "nombre": "Bonos",
            "justificacion": (
                "Los bonos del tesoro se benefician de la caída de tasas "
                "y la búsqueda de refugio seguro."
            ),
            "etfs": ["TLT", "BND", "SHY"],
        },
    ],
}

# Datos estáticos curados de ciclo económico (fallback)
DATOS_CICLO_ESTATICO = {
    "fase": "Mid",
    "indicadores": {
        "pmi": 52.1,
        "spread_2y_10y": 0.45,
        "tasa_desempleo": 4.1,
        "inflacion_yoy": 2.9,
    },
    "fuente": "estatico",
    "fecha_actualizacion": "2025-01-15",
    "descripcion": (
        "Fase de expansión media: el PMI se mantiene por encima de 50, "
        "el spread de la curva de rendimientos es positivo pero se estrecha, "
        "y el desempleo está en niveles bajos."
    ),
}

# Universo curado de ~50 tickers populares para filtros
UNIVERSO_TICKERS = [
    # Tecnología
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "INTC", "CRM",
    # Finanzas
    "JPM", "GS", "BAC", "MS", "V", "MA",
    # Salud
    "JNJ", "PFE", "UNH", "MRK", "ABT", "LLY",
    # Energía
    "XOM", "CVX", "COP",
    # Consumo Discrecional
    "HD", "NKE", "SBUX", "DIS",
    # Consumo Básico
    "WMT", "KO", "PEP", "PG", "COST",
    # Industriales
    "CAT", "HON", "UPS", "BA",
    # Materiales
    "LIN", "APD", "NEM",
    # Utilities
    "NEE", "DUK", "SO",
    # ETFs
    "SPY", "QQQ", "IWM", "GLD", "TLT", "BND",
]

# Umbrales de filtro fundamental
FILTRO_ROE_MIN = 0.15
FILTRO_ROA_MIN = 0.05
FILTRO_DE_MAX = 1.5


# ── Clase principal ──────────────────────────────────────────────

class WizardService:
    """Servicio del Wizard de Ciclo Económico — Pipeline Top-Down."""

    # ── Etapa 0: Perfil de riesgo ────────────────────────────────

    def calcular_perfil(self, respuestas: list) -> dict:
        """
        Calcula el perfil de riesgo a partir de las respuestas del cuestionario.

        Cada pregunta se puntúa de 1 a 4. El total determina el perfil:
            5-8:   Ultra Conservador
            9-12:  Conservador
            13-16: Moderado
            17-19: Balanceado
            20:    Agresivo

        Args:
            respuestas: Lista de 5 enteros (1-4 cada uno).

        Returns:
            dict con perfil, puntaje y descripcion.

        Raises:
            ValueError: Si las respuestas no son válidas.
        """
        if not isinstance(respuestas, list) or len(respuestas) != 5:
            raise ValueError("Se requieren exactamente 5 respuestas.")

        for i, r in enumerate(respuestas):
            if not isinstance(r, (int, float)) or int(r) != r:
                raise ValueError(
                    f"La respuesta {i + 1} debe ser un número entero."
                )
            if r < 1 or r > 4:
                raise ValueError(
                    f"La respuesta {i + 1} debe estar entre 1 y 4."
                )

        puntaje = sum(int(r) for r in respuestas)

        for nombre, info in PERFILES.items():
            rango_min, rango_max = info["rango"]
            if rango_min <= puntaje <= rango_max:
                return {
                    "perfil": nombre,
                    "puntaje": puntaje,
                    "descripcion": info["descripcion"],
                }

        # Fallback (no debería ocurrir con respuestas válidas 1-4)
        return {
            "perfil": "Moderado",
            "puntaje": puntaje,
            "descripcion": PERFILES["Moderado"]["descripcion"],
        }

    # ── Etapa 1: Ciclo económico ─────────────────────────────────

    def obtener_ciclo(self) -> dict:
        """
        Determina la fase actual del ciclo económico.

        Flujo:
            1. Verificar caché en tabla ciclo_cache (válida 24h).
            2. Si caché válida, retornar datos cacheados.
            3. Intentar fuentes dinámicas (FRED API — mock/estático por ahora).
            4. Fallback a datos curados estáticos con fecha visible.

        Returns:
            dict con fase, indicadores, fuente y fecha_actualizacion.
        """
        # 1. Verificar caché
        cached = self._leer_cache_ciclo()
        if cached is not None:
            return cached

        # 2. Intentar fuentes dinámicas (mock — requiere FRED API key)
        ciclo_dinamico = self._intentar_fuentes_dinamicas()
        if ciclo_dinamico is not None:
            self._guardar_cache_ciclo(ciclo_dinamico)
            return ciclo_dinamico

        # 3. Fallback a datos estáticos
        resultado = {
            "fase": DATOS_CICLO_ESTATICO["fase"],
            "indicadores": DATOS_CICLO_ESTATICO["indicadores"],
            "fuente": "estatico",
            "fecha_actualizacion": DATOS_CICLO_ESTATICO["fecha_actualizacion"],
            "descripcion": DATOS_CICLO_ESTATICO["descripcion"],
        }

        self._guardar_cache_ciclo(resultado)
        return resultado

    def _leer_cache_ciclo(self) -> dict | None:
        """Lee el ciclo económico de la caché si es válido (< 24h)."""
        try:
            cache = db.session.get(CicloCache, 1)
            if cache is None:
                return None

            ahora = datetime.now(timezone.utc)
            edad = ahora - cache.updated_at.replace(tzinfo=timezone.utc)
            if edad > timedelta(hours=24):
                return None

            return {
                "fase": cache.fase,
                "indicadores": cache.indicadores,
                "fuente": cache.fuente,
                "fecha_actualizacion": cache.updated_at.isoformat(),
            }
        except Exception as e:
            logger.warning("Error al leer caché de ciclo: %s", e)
            return None

    def _guardar_cache_ciclo(self, datos: dict) -> None:
        """Guarda los datos del ciclo en la caché."""
        try:
            cache = db.session.get(CicloCache, 1)
            if cache is None:
                cache = CicloCache(id=1)
                db.session.add(cache)

            cache.fase = datos["fase"]
            cache.indicadores = datos.get("indicadores", {})
            cache.fuente = datos.get("fuente", "estatico")
            cache.updated_at = datetime.now(timezone.utc)

            db.session.commit()
        except Exception as e:
            logger.error("Error al guardar caché de ciclo: %s", e)
            db.session.rollback()

    def _intentar_fuentes_dinamicas(self) -> dict | None:
        """
        Intenta obtener datos de ciclo de fuentes dinámicas.

        Actualmente retorna None (requiere FRED API key).
        En producción consultaría PMI, curva de rendimientos y desempleo.
        """
        # TODO: Implementar con FRED API cuando se tenga la key
        # from fredapi import Fred
        # fred = Fred(api_key=os.environ.get('FRED_API_KEY'))
        # pmi = fred.get_series('MANEMP')
        # ...
        return None

    # ── Etapa 2: Rotación sectorial ──────────────────────────────

    def obtener_sectores(self, fase: str) -> dict:
        """
        Retorna los sectores favorecidos para una fase del ciclo.

        Args:
            fase: Fase del ciclo ('Early', 'Mid', 'Late', 'Recession').

        Returns:
            dict con fase y lista de sectores con justificación y ETFs.

        Raises:
            ValueError: Si la fase no es válida.
        """
        fases_validas = list(SECTORES_POR_FASE.keys())
        if fase not in fases_validas:
            raise ValueError(
                f"Fase no válida: '{fase}'. "
                f"Las fases válidas son: {', '.join(fases_validas)}"
            )

        return {
            "fase": fase,
            "sectores": SECTORES_POR_FASE[fase],
        }

    # ── Etapa 3: Filtro fundamental ──────────────────────────────

    def filtrar_fundamentales(self, tickers: list) -> list:
        """
        Filtra tickers por criterios fundamentales.

        Criterios:
            - ROE > 15%
            - ROA > 5%
            - D/E < 1.5
            - P/E < promedio de la industria

        Args:
            tickers: Lista de símbolos bursátiles a evaluar.

        Returns:
            Lista de dicts con tickers que pasan el filtro y sus métricas.
        """
        if not tickers:
            return []

        resultados = []

        for ticker in tickers:
            try:
                info = yf.Ticker(ticker).info
                if not info or info.get("quoteType") is None:
                    logger.debug("Sin datos fundamentales para '%s'", ticker)
                    continue

                roe = info.get("returnOnEquity")
                roa = info.get("returnOnAssets")
                de = info.get("debtToEquity")
                pe = info.get("trailingPE") or info.get("forwardPE")
                pe_industria = info.get("industryPE") or info.get("sectorPE")

                # Convertir D/E de porcentaje a ratio si viene como porcentaje
                if de is not None and de > 10:
                    de = de / 100.0

                # Verificar que tenemos datos suficientes
                if roe is None or roa is None:
                    logger.debug(
                        "Datos fundamentales incompletos para '%s': "
                        "ROE=%s, ROA=%s",
                        ticker, roe, roa,
                    )
                    continue

                # Aplicar filtros
                pasa_roe = roe > FILTRO_ROE_MIN
                pasa_roa = roa > FILTRO_ROA_MIN
                pasa_de = de is None or de < FILTRO_DE_MAX
                # Si no hay P/E de industria, solo verificar que P/E sea razonable
                pasa_pe = True
                if pe is not None and pe_industria is not None:
                    pasa_pe = pe < pe_industria
                elif pe is not None:
                    pasa_pe = pe < 30  # umbral razonable como fallback

                if pasa_roe and pasa_roa and pasa_de and pasa_pe:
                    resultados.append({
                        "ticker": ticker,
                        "roe": round(roe * 100, 2) if roe else None,
                        "roa": round(roa * 100, 2) if roa else None,
                        "de": round(de, 2) if de else None,
                        "pe": round(pe, 2) if pe else None,
                        "nombre": info.get("shortName", ticker),
                        "sector": info.get("sector", "N/A"),
                    })

            except Exception as e:
                logger.warning(
                    "Error al obtener fundamentales de '%s': %s",
                    ticker, str(e),
                )
                continue

        return resultados

    # ── Etapa 4: Filtro técnico ──────────────────────────────────

    def filtrar_tecnicos(self, tickers: list) -> list:
        """
        Filtra tickers por criterios técnicos.

        Criterios:
            - Precio actual > SMA 200
            - RSI entre 40 y 60

        Args:
            tickers: Lista de símbolos bursátiles a evaluar.

        Returns:
            Lista de dicts con tickers que pasan y sus métricas técnicas.
        """
        if not tickers:
            return []

        ta = TAService()
        resultados = []

        for ticker in tickers:
            try:
                ticker_obj = yf.Ticker(ticker)
                df = ticker_obj.history(period="1y", interval="1d")

                if df is None or df.empty or len(df) < 200:
                    logger.debug(
                        "Datos insuficientes para filtro técnico de '%s' "
                        "(%d velas)",
                        ticker,
                        len(df) if df is not None else 0,
                    )
                    continue

                # Calcular SMA 200 y RSI
                sma200 = ta._sma(df, 200)
                rsi = ta._rsi(df, 14)

                precio_actual = float(df["Close"].iloc[-1])
                sma200_actual = float(sma200.iloc[-1]) if not sma200.empty else None
                rsi_actual = float(rsi.iloc[-1]) if not rsi.empty else None

                if sma200_actual is None or rsi_actual is None:
                    continue

                # Aplicar filtros
                pasa_sma = precio_actual > sma200_actual
                pasa_rsi = 40 <= rsi_actual <= 60

                if pasa_sma and pasa_rsi:
                    resultados.append({
                        "ticker": ticker,
                        "precio": round(precio_actual, 2),
                        "sma200": round(sma200_actual, 2),
                        "rsi": round(rsi_actual, 2),
                    })

            except Exception as e:
                logger.warning(
                    "Error al filtrar técnicamente '%s': %s",
                    ticker, str(e),
                )
                continue

        return resultados

    # ── Asset Allocation ─────────────────────────────────────────

    def obtener_allocation(self, perfil: str) -> dict:
        """
        Retorna el asset allocation recomendado por perfil de riesgo.

        Args:
            perfil: Nombre del perfil de riesgo.

        Returns:
            dict con perfil y lista de clases de activo con porcentaje y ETFs.

        Raises:
            ValueError: Si el perfil no es válido.
        """
        if perfil not in ALLOCATION_POR_PERFIL:
            perfiles_validos = list(ALLOCATION_POR_PERFIL.keys())
            raise ValueError(
                f"Perfil no válido: '{perfil}'. "
                f"Los perfiles válidos son: {', '.join(perfiles_validos)}"
            )

        return {
            "perfil": perfil,
            "allocation": ALLOCATION_POR_PERFIL[perfil],
        }

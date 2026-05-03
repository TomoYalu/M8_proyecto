# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Optimización Markowitz
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Servicio de optimización de portafolios — Motor Markowitz.

Migrado y adaptado de fuentes/analizador_v1/app.py.
Implementa optimización Mean-Variance con simulación Monte Carlo,
métricas de riesgo (Sharpe, Sortino, Beta, VaR, Max Drawdown),
contribución de riesgo y evolución histórica.

Todas las funciones de cálculo son puras (sin estado de DB).
La función orquestadora `optimizar(params)` coordina el flujo completo.

Requisitos cubiertos: 2.1–2.12, 3.1–3.8, 4.1–4.4
"""

import datetime
import logging

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.optimize import minimize
from scipy.stats import norm

logger = logging.getLogger(__name__)

# ── Constantes ───────────────────────────────────────────────────

PERIODOS_ANIO = 12  # Datos mensuales → anualización con factor 12
PERIODOS_VALIDOS = {"1y": 1, "3y": 3, "5y": 5, "10y": 10}
RF_FALLBACK = 0.045  # 4.5% anual como fallback
N_SIMS_DEFAULT = 5000
CONFIANZA_VAR = 0.99
MIN_TICKERS = 2
MAX_TICKERS = 15


# ── Tasa libre de riesgo ─────────────────────────────────────────

def obtener_tasa_libre_riesgo():
    """
    Obtiene la tasa libre de riesgo del bono del Tesoro a 3 meses (^IRX).

    Descarga el último precio de ^IRX vía yfinance y lo divide entre 100
    para convertirlo a decimal. Si falla, retorna el fallback de 4.5%.

    Returns:
        tuple: (tasa_decimal, fuente_str)
            - tasa_decimal: float, ej. 0.0435
            - fuente_str: "^IRX" o "fallback (4.5%)"
    """
    try:
        ticker = yf.Ticker("^IRX")
        hist = ticker.history(period="5d")
        if hist is not None and not hist.empty:
            ultimo = float(hist["Close"].iloc[-1])
            tasa = ultimo / 100.0
            logger.info("Tasa libre de riesgo obtenida de ^IRX: %.4f", tasa)
            return tasa, "^IRX"
    except Exception as e:
        logger.warning(
            "No se pudo obtener ^IRX: %s. Usando fallback %.1f%%.",
            str(e),
            RF_FALLBACK * 100,
        )

    logger.info("Usando tasa libre de riesgo por defecto: %.1f%%", RF_FALLBACK * 100)
    return RF_FALLBACK, "fallback (4.5%)"


# ── Descarga de precios ──────────────────────────────────────────

def descargar_precios(tickers, periodo="5y"):
    """
    Descarga precios mensuales ajustados para una lista de tickers.

    Usa yf.download() en batch para eficiencia. Excluye tickers sin datos.
    Maneja el caso de MultiIndex en columnas para un solo ticker.

    Args:
        tickers: Lista de símbolos bursátiles.
        periodo: Cadena de período ("1y", "3y", "5y", "10y").

    Returns:
        tuple: (precios_df, tickers_validos, tickers_excluidos)
            - precios_df: DataFrame con columnas = tickers válidos, index = fechas
            - tickers_validos: lista de tickers con datos
            - tickers_excluidos: lista de tickers sin datos

    Raises:
        ValueError: si el período es inválido o no hay datos suficientes.
    """
    if periodo not in PERIODOS_VALIDOS:
        raise ValueError(
            f"Período inválido: '{periodo}'. Valores válidos: "
            f"{', '.join(PERIODOS_VALIDOS.keys())}."
        )

    anios = PERIODOS_VALIDOS[periodo]
    fin = datetime.date.today()
    inicio = fin - datetime.timedelta(days=anios * 365)

    logger.info(
        "Descargando precios mensuales para %d tickers, período %s (%s a %s)",
        len(tickers),
        periodo,
        inicio.isoformat(),
        fin.isoformat(),
    )

    precios = yf.download(
        tickers,
        start=inicio.isoformat(),
        end=fin.isoformat(),
        interval="1mo",
        auto_adjust=True,
    )

    if precios is None or precios.empty:
        raise ValueError(
            "No se encontraron datos suficientes para ningún ticker."
        )

    # Extraer columna Close
    if isinstance(precios.columns, pd.MultiIndex):
        precios = precios["Close"]
    else:
        # Un solo ticker: yf.download retorna columnas planas
        if "Close" in precios.columns:
            precios = precios[["Close"]]
            precios.columns = [tickers[0]]

    # Si es Series (un solo ticker), convertir a DataFrame
    if isinstance(precios, pd.Series):
        precios = precios.to_frame(tickers[0])

    # Excluir tickers sin datos
    precios = precios.dropna(axis=1, how="all")
    precios = precios.dropna()

    tickers_validos = precios.columns.tolist()
    tickers_excluidos = [t for t in tickers if t not in tickers_validos]

    if tickers_excluidos:
        logger.warning(
            "Tickers excluidos por falta de datos: %s", tickers_excluidos
        )

    if len(tickers_validos) < MIN_TICKERS:
        raise ValueError(
            "No se encontraron datos suficientes para al menos 2 tickers."
        )

    logger.info(
        "Precios descargados: %d tickers válidos, %d filas",
        len(tickers_validos),
        len(precios),
    )

    return precios, tickers_validos, tickers_excluidos


# ── Rendimientos logarítmicos ────────────────────────────────────

def calcular_rendimientos_log(precios):
    """
    Calcula rendimientos logarítmicos a partir de un DataFrame de precios.

    rendimiento[t] = ln(precio[t] / precio[t-1])

    Args:
        precios: DataFrame con precios (columnas = tickers, index = fechas).

    Returns:
        DataFrame de rendimientos logarítmicos (una fila menos que precios).
    """
    rendimientos = np.log(precios / precios.shift(1)).dropna()
    logger.debug("Rendimientos logarítmicos calculados: %d filas", len(rendimientos))
    return rendimientos


# ── Restricciones de peso ────────────────────────────────────────

def calcular_restricciones_peso(n, min_peso=None, max_peso=None):
    """
    Calcula los bounds de peso por activo según el número de tickers.

    Reglas por defecto:
        - 10+ tickers → 5%-20%
        - 5-9 tickers → 5%-40%
        - 2-4 tickers → 5%-55%

    Si se proporcionan min_peso y/o max_peso, se usan como override.

    Args:
        n: Número de tickers.
        min_peso: Override de peso mínimo (decimal, ej. 0.05 para 5%).
        max_peso: Override de peso máximo (decimal, ej. 0.20 para 20%).

    Returns:
        tuple: (bounds, bmin, bmax)
            - bounds: lista de tuplas [(bmin, bmax)] × n
            - bmin: peso mínimo aplicado
            - bmax: peso máximo aplicado
    """
    # Defaults dinámicos
    if n >= 10:
        bmin_default, bmax_default = 0.05, 0.20
    elif n >= 5:
        bmin_default, bmax_default = 0.05, 0.40
    else:
        bmin_default, bmax_default = 0.05, 0.55

    bmin = min_peso if min_peso is not None else bmin_default
    bmax = max_peso if max_peso is not None else bmax_default

    bounds = [(bmin, bmax)] * n

    logger.info(
        "Restricciones de peso: n=%d, min=%.1f%%, max=%.1f%%",
        n,
        bmin * 100,
        bmax * 100,
    )

    return bounds, bmin, bmax


# ── Estadísticas de portafolio ───────────────────────────────────

def _portfolio_stats(w, rend_esperado, cov, rf, periodos=PERIODOS_ANIO):
    """
    Calcula rendimiento, riesgo y Sharpe de un portafolio.

    Args:
        w: Vector de pesos (numpy array).
        rend_esperado: Rendimientos esperados mensuales por activo.
        cov: Matriz de covarianza mensual.
        rf: Tasa libre de riesgo anual (decimal).
        periodos: Períodos por año para anualización.

    Returns:
        tuple: (rendimiento_anual, riesgo_anual, sharpe)
    """
    rp = np.dot(w, rend_esperado) * periodos
    sp = np.sqrt(np.dot(w, np.dot(cov * periodos, w)))
    sharpe = (rp - rf) / sp if sp > 0 else 0.0
    return rp, sp, sharpe


# ── Optimización Max Sharpe ──────────────────────────────────────

def optimizar_max_sharpe(rend_esperado, cov_matrix, rf, bounds):
    """
    Encuentra el portafolio que maximiza el Sharpe Ratio.

    Usa scipy.optimize.minimize con método SLSQP, minimizando el negativo
    del Sharpe Ratio sujeto a que los pesos sumen 1.

    Args:
        rend_esperado: Series/array de rendimientos esperados mensuales.
        cov_matrix: Matriz de covarianza mensual.
        rf: Tasa libre de riesgo anual (decimal).
        bounds: Lista de tuplas (min, max) por activo.

    Returns:
        numpy array: Vector de pesos óptimos.

    Raises:
        ValueError: si la optimización es infactible.
    """
    n = len(rend_esperado)
    w0 = np.array([1.0 / n] * n)
    cons = {"type": "eq", "fun": lambda w: np.sum(w) - 1.0}

    resultado = minimize(
        lambda w: -_portfolio_stats(w, rend_esperado, cov_matrix, rf)[2],
        w0,
        method="SLSQP",
        bounds=bounds,
        constraints=cons,
    )

    if not resultado.success:
        logger.warning(
            "Optimización Max Sharpe no convergió: %s", resultado.message
        )
        raise ValueError(
            "Las restricciones configuradas son infactibles para Max Sharpe: "
            f"{resultado.message}"
        )

    logger.info("Optimización Max Sharpe completada exitosamente.")
    return resultado.x


# ── Optimización Min Varianza ────────────────────────────────────

def optimizar_min_varianza(rend_esperado, cov_matrix, bounds):
    """
    Encuentra el portafolio que minimiza la volatilidad.

    Usa scipy.optimize.minimize con método SLSQP, minimizando la
    volatilidad anualizada sujeto a que los pesos sumen 1.

    Args:
        rend_esperado: Series/array de rendimientos esperados mensuales.
        cov_matrix: Matriz de covarianza mensual.
        bounds: Lista de tuplas (min, max) por activo.

    Returns:
        numpy array: Vector de pesos óptimos.

    Raises:
        ValueError: si la optimización es infactible.
    """
    n = len(rend_esperado)
    w0 = np.array([1.0 / n] * n)
    cons = {"type": "eq", "fun": lambda w: np.sum(w) - 1.0}

    resultado = minimize(
        lambda w: _portfolio_stats(w, rend_esperado, cov_matrix, 0, PERIODOS_ANIO)[1],
        w0,
        method="SLSQP",
        bounds=bounds,
        constraints=cons,
    )

    if not resultado.success:
        logger.warning(
            "Optimización Min Varianza no convergió: %s", resultado.message
        )
        raise ValueError(
            "Las restricciones configuradas son infactibles para Min Varianza: "
            f"{resultado.message}"
        )

    logger.info("Optimización Min Varianza completada exitosamente.")
    return resultado.x


# ── Simulación Monte Carlo ───────────────────────────────────────

def simulacion_monte_carlo(rend_esperado, cov_matrix, rf, bounds, n_sims=N_SIMS_DEFAULT):
    """
    Genera portafolios aleatorios respetando los bounds de peso.

    Genera pesos uniformes dentro de [bmin, bmax] y los normaliza
    para que sumen 1. Descarta portafolios que violen los bounds
    después de la normalización.

    Args:
        rend_esperado: Series/array de rendimientos esperados mensuales.
        cov_matrix: Matriz de covarianza mensual.
        rf: Tasa libre de riesgo anual (decimal).
        bounds: Lista de tuplas (min, max) por activo.
        n_sims: Número de simulaciones a generar.

    Returns:
        dict: {"rendimiento": [...], "riesgo": [...], "sharpe": [...]}
            Listas de valores en porcentaje (rendimiento, riesgo) y ratio (sharpe).
    """
    n = len(rend_esperado)
    bmin = bounds[0][0]
    bmax = bounds[0][1]

    sim_r, sim_s, sim_sh = [], [], []

    logger.info(
        "Iniciando simulación Monte Carlo: %d portafolios, %d activos",
        n_sims,
        n,
    )

    for _ in range(n_sims):
        w = np.random.uniform(bmin, bmax, n)
        w = w / w.sum()

        # Verificar que los pesos normalizados respeten los bounds
        if np.any(w < bmin) or np.any(w > bmax):
            continue

        r, s, sh = _portfolio_stats(w, rend_esperado, cov_matrix, rf)
        sim_r.append(round(float(r * 100), 4))
        sim_s.append(round(float(s * 100), 4))
        sim_sh.append(round(float(sh), 4))

    logger.info(
        "Simulación Monte Carlo completada: %d portafolios válidos de %d intentos",
        len(sim_r),
        n_sims,
    )

    return {"rendimiento": sim_r, "riesgo": sim_s, "sharpe": sim_sh}


# ── Métricas de portafolio ───────────────────────────────────────

def calcular_metricas(pesos, rendimientos, cov, precios, rf, inversion, spy_rend):
    """
    Calcula métricas completas para un portafolio optimizado.

    Incluye: Sharpe, Sortino, Beta vs SPY, Max Drawdown, VaR, contribución
    de riesgo, acciones y montos por activo.

    Args:
        pesos: numpy array de pesos del portafolio.
        rendimientos: DataFrame de rendimientos logarítmicos mensuales.
        cov: Matriz de covarianza mensual.
        precios: DataFrame de precios históricos.
        rf: Tasa libre de riesgo anual (decimal).
        inversion: Monto de inversión en USD.
        spy_rend: Series de rendimientos logarítmicos de SPY (puede ser None).

    Returns:
        dict con todas las métricas calculadas.
    """
    tickers = rendimientos.columns.tolist()
    n = len(tickers)
    rend_esperado = rendimientos.mean()

    # Rendimiento y riesgo anualizados
    rp, sp, sharpe = _portfolio_stats(pesos, rend_esperado, cov, rf)

    # Sortino Ratio
    sortino = _calcular_sortino(pesos, rendimientos, rf)

    # Beta vs SPY
    beta = _calcular_beta(pesos, rendimientos, spy_rend)

    # Max Drawdown
    max_dd = _calcular_max_drawdown(pesos, precios)

    # VaR paramétrico
    var = calcular_var_parametrico(pesos, rend_esperado, cov, inversion)

    # Contribución de riesgo
    risk_contrib = calcular_contribucion_riesgo(pesos, cov)

    # Acciones y montos por activo
    ultimo_precio = precios.iloc[-1]
    acciones = {}
    montos = {}
    pesos_dict = {}

    for i, t in enumerate(tickers):
        precio_t = float(ultimo_precio.iloc[i]) if hasattr(ultimo_precio, 'iloc') else float(ultimo_precio[t])
        n_acciones = int(np.floor(pesos[i] * inversion / precio_t)) if precio_t > 0 else 0
        acciones[t] = n_acciones
        montos[t] = round(float(n_acciones * precio_t), 2)
        pesos_dict[t] = round(float(pesos[i] * 100), 2)

    # Contribución de riesgo como dict
    risk_contrib_dict = {
        t: round(float(risk_contrib[i] * 100), 2) for i, t in enumerate(tickers)
    }

    return {
        "pesos": pesos_dict,
        "rendimiento": round(float(rp * 100), 2),
        "riesgo": round(float(sp * 100), 2),
        "sharpe": round(float(sharpe), 4),
        "sortino": round(float(sortino), 4),
        "beta": round(float(beta), 4) if beta is not None else None,
        "max_drawdown": round(float(max_dd * 100), 2),
        "var": var,
        "risk_contrib": risk_contrib_dict,
        "acciones": acciones,
        "monto": montos,
    }


# ── Sortino Ratio ────────────────────────────────────────────────

def _calcular_sortino(pesos, rendimientos, rf):
    """
    Calcula el Sortino Ratio del portafolio.

    Usa solo la desviación estándar de los rendimientos negativos
    (downside deviation) para penalizar únicamente la volatilidad a la baja.

    Args:
        pesos: numpy array de pesos.
        rendimientos: DataFrame de rendimientos mensuales.
        rf: Tasa libre de riesgo anual.

    Returns:
        float: Sortino Ratio.
    """
    port_rend = rendimientos.dot(pesos)
    downside = port_rend[port_rend < 0].std() * np.sqrt(PERIODOS_ANIO)
    if downside > 0:
        return (port_rend.mean() * PERIODOS_ANIO - rf) / downside
    return 0.0


# ── Beta vs SPY ──────────────────────────────────────────────────

def _calcular_beta(pesos, rendimientos, spy_rend):
    """
    Calcula el Beta del portafolio respecto a SPY.

    Beta = Cov(Rp, Rm) / Var(Rm)

    Args:
        pesos: numpy array de pesos.
        rendimientos: DataFrame de rendimientos mensuales.
        spy_rend: Series de rendimientos de SPY (puede ser None).

    Returns:
        float o None: Beta del portafolio, None si SPY no disponible.
    """
    if spy_rend is None or spy_rend.empty:
        logger.warning("Datos de SPY no disponibles para cálculo de Beta.")
        return None

    common = rendimientos.index.intersection(spy_rend.index)
    if len(common) < 2:
        logger.warning("Datos insuficientes para calcular Beta vs SPY.")
        return None

    spy_vals = spy_rend.loc[common].values.flatten()
    port_rend = rendimientos.loc[common].dot(pesos).values

    var_spy = np.var(spy_vals)
    if var_spy > 0:
        return np.cov(port_rend, spy_vals)[0, 1] / var_spy
    return 0.0


# ── Max Drawdown ─────────────────────────────────────────────────

def _calcular_max_drawdown(pesos, precios):
    """
    Calcula el máximo drawdown histórico del portafolio.

    Drawdown = caída máxima desde un pico hasta un valle.

    Args:
        pesos: numpy array de pesos.
        precios: DataFrame de precios históricos.

    Returns:
        float: Max drawdown como fracción negativa (ej. -0.15 = -15%).
    """
    # Normalizar precios a base 1
    precios_norm = precios / precios.iloc[0]
    valor_portafolio = precios_norm.dot(pesos)
    drawdown = valor_portafolio / valor_portafolio.cummax() - 1
    return float(drawdown.min())


# ── VaR Paramétrico ──────────────────────────────────────────────

def calcular_var_parametrico(pesos, rend_esperado, cov, inversion, confianza=CONFIANZA_VAR):
    """
    Calcula el Value at Risk paramétrico en tres horizontes temporales.

    Asume distribución normal de rendimientos. Escala temporal:
        - VaR mensual = -(rend_mensual - z × vol_mensual)
        - VaR diario = VaR_mensual / sqrt(21)
        - VaR anual = VaR_mensual × sqrt(12)

    Args:
        pesos: numpy array de pesos.
        rend_esperado: Series/array de rendimientos esperados mensuales.
        cov: Matriz de covarianza mensual.
        inversion: Monto de inversión en USD.
        confianza: Nivel de confianza (default 0.99).

    Returns:
        dict con VaR diario/mensual/anual en % y USD.
    """
    z = norm.ppf(confianza)
    rp = np.dot(pesos, rend_esperado)
    sp = np.sqrt(np.dot(pesos, np.dot(cov, pesos)))

    var_mensual = -(rp - z * sp)
    var_diario = var_mensual / np.sqrt(21)
    var_anual = var_mensual * np.sqrt(12)

    return {
        "diario": round(float(var_diario * 100), 4),
        "mensual": round(float(var_mensual * 100), 4),
        "anual": round(float(var_anual * 100), 4),
        "diario_usd": round(float(var_diario * inversion), 0),
        "mensual_usd": round(float(var_mensual * inversion), 0),
        "anual_usd": round(float(var_anual * inversion), 0),
    }


# ── Contribución de riesgo ───────────────────────────────────────

def calcular_contribucion_riesgo(pesos, cov, periodos=PERIODOS_ANIO):
    """
    Calcula la contribución de riesgo de cada activo al riesgo total.

    La contribución de riesgo del activo i es:
        RC_i = w_i × (Σ × w)_i / σ_p

    Normalizada para que la suma sea 100%.

    Args:
        pesos: numpy array de pesos.
        cov: Matriz de covarianza mensual.
        periodos: Períodos por año para anualización.

    Returns:
        numpy array: Contribuciones de riesgo normalizadas (suman 1.0).
    """
    cov_anual = cov * periodos
    sp = np.sqrt(np.dot(pesos, np.dot(cov_anual, pesos)))

    if sp == 0:
        return np.zeros(len(pesos))

    # Contribución marginal × peso
    rc = pesos * np.dot(cov_anual, pesos) / sp
    total = rc.sum()

    if total > 0:
        return rc / total
    return np.zeros(len(pesos))


# ── Evolución histórica ─────────────────────────────────────────

def calcular_evolucion_historica(pesos, precios):
    """
    Calcula la evolución de $1 invertido con los pesos dados.

    Normaliza los precios a base 1 (primer día) y calcula el valor
    del portafolio ponderado en cada fecha.

    Args:
        pesos: numpy array de pesos.
        precios: DataFrame de precios históricos.

    Returns:
        dict: {"fechas": [...], "valores": [...]}
    """
    precios_norm = precios / precios.iloc[0]
    evolucion = precios_norm.dot(pesos)

    fechas = [d.strftime("%Y-%m-%d") for d in precios_norm.index]
    valores = [round(float(v), 4) for v in evolucion.values]

    return {"fechas": fechas, "valores": valores}


# ── Descarga de SPY para Beta ────────────────────────────────────

def _descargar_spy(inicio, fin):
    """
    Descarga rendimientos logarítmicos de SPY para cálculo de Beta.

    Args:
        inicio: Fecha de inicio (date o string ISO).
        fin: Fecha de fin (date o string ISO).

    Returns:
        Series de rendimientos logarítmicos de SPY, o None si falla.
    """
    try:
        spy_data = yf.download(
            "SPY",
            start=str(inicio),
            end=str(fin),
            interval="1mo",
            auto_adjust=True,
        )

        if spy_data is None or spy_data.empty:
            logger.warning("No se pudieron descargar datos de SPY.")
            return None

        # Manejar MultiIndex para un solo ticker
        if isinstance(spy_data.columns, pd.MultiIndex):
            spy_close = spy_data["Close"]
            if isinstance(spy_close, pd.DataFrame):
                spy_close = spy_close.iloc[:, 0]
        else:
            spy_close = spy_data["Close"]

        spy_rend = np.log(spy_close / spy_close.shift(1)).dropna()
        logger.info("Datos de SPY descargados: %d rendimientos", len(spy_rend))
        return spy_rend

    except Exception as e:
        logger.warning("Error al descargar SPY: %s", str(e))
        return None


# ── Función orquestadora principal ───────────────────────────────

def optimizar(params):
    """
    Función orquestadora que ejecuta la optimización completa de Markowitz.

    Coordina: descarga de datos → rendimientos → restricciones → optimización
    SLSQP → Monte Carlo → métricas → VaR → contribución de riesgo → evolución.

    Args:
        params: dict con claves:
            - tickers: list[str] — símbolos bursátiles (2-15)
            - inversion: float — monto de inversión en USD
            - rf: float o None — tasa libre de riesgo (None = auto ^IRX)
            - periodo: str — "1y", "3y", "5y", "10y"
            - min_peso: float o None — override peso mínimo (decimal)
            - max_peso: float o None — override peso máximo (decimal)
            - portafolio_id: int o None — optimizar portafolio existente
            - max_peso_emisor: float — máximo por emisor (default 0.20)
            - max_renta_variable: float — máximo renta variable (default 0.80)
            - min_sectores: int — mínimo de sectores (default 3)

    Returns:
        dict: Resultado completo de la optimización con estructura:
            - tickers, tickers_excluidos, restricciones, rf_utilizada, rf_fuente
            - estadisticas: rendimiento/riesgo/precio por ticker
            - correlacion: matriz de correlación
            - max_sharpe: métricas del portafolio Max Sharpe
            - min_varianza: métricas del portafolio Min Varianza
            - frontera: nube de puntos Monte Carlo
            - historico: evolución de $1 para ambos portafolios
            - pesos_actuales: None o dict con pesos actuales y diferencia

    Raises:
        ValueError: si los parámetros son inválidos o la optimización falla.
    """
    tickers = params.get("tickers", [])
    inversion = params.get("inversion", 1_000_000)
    rf_param = params.get("rf")
    periodo = params.get("periodo", "5y")
    min_peso = params.get("min_peso")
    max_peso = params.get("max_peso")

    # ── Validación de entrada ────────────────────────────────────
    if len(tickers) < MIN_TICKERS:
        raise ValueError(
            "Se necesitan al menos 2 tickers para la optimización."
        )
    if len(tickers) > MAX_TICKERS:
        raise ValueError("Máximo 15 tickers permitidos.")
    if inversion <= 0:
        raise ValueError("El capital de inversión debe ser mayor a cero.")
    if periodo not in PERIODOS_VALIDOS:
        raise ValueError(
            f"Período inválido. Valores válidos: "
            f"{', '.join(PERIODOS_VALIDOS.keys())}."
        )

    logger.info(
        "Iniciando optimización: %d tickers, inversión=$%s, período=%s",
        len(tickers),
        f"{inversion:,.0f}",
        periodo,
    )

    # ── Tasa libre de riesgo ─────────────────────────────────────
    if rf_param is not None:
        rf = rf_param
        rf_fuente = "manual"
        logger.info("Tasa libre de riesgo manual: %.4f", rf)
    else:
        rf, rf_fuente = obtener_tasa_libre_riesgo()

    # ── Descarga de precios ──────────────────────────────────────
    precios, tickers_ok, tickers_excluidos = descargar_precios(tickers, periodo)

    # ── Rendimientos y estadísticas ──────────────────────────────
    rendimientos = calcular_rendimientos_log(precios)
    n = len(tickers_ok)
    rend_esperado = rendimientos.mean()
    rend_anual = rend_esperado * PERIODOS_ANIO
    std_anual = rendimientos.std() * np.sqrt(PERIODOS_ANIO)
    cov_matrix = rendimientos.cov()
    corr_matrix = rendimientos.corr()

    # ── Restricciones de peso ────────────────────────────────────
    bounds, bmin, bmax = calcular_restricciones_peso(n, min_peso, max_peso)

    # ── Optimización ─────────────────────────────────────────────
    w_max_sharpe = optimizar_max_sharpe(rend_esperado, cov_matrix, rf, bounds)
    w_min_var = optimizar_min_varianza(rend_esperado, cov_matrix, bounds)

    # ── Descarga de SPY para Beta ────────────────────────────────
    anios = PERIODOS_VALIDOS[periodo]
    fin = datetime.date.today()
    inicio = fin - datetime.timedelta(days=anios * 365)
    spy_rend = _descargar_spy(inicio, fin)

    # ── Métricas de ambos portafolios ────────────────────────────
    metricas_max_sharpe = calcular_metricas(
        w_max_sharpe, rendimientos, cov_matrix, precios, rf, inversion, spy_rend
    )
    metricas_min_var = calcular_metricas(
        w_min_var, rendimientos, cov_matrix, precios, rf, inversion, spy_rend
    )

    # ── Simulación Monte Carlo ───────────────────────────────────
    frontera = simulacion_monte_carlo(rend_esperado, cov_matrix, rf, bounds)

    # ── Evolución histórica ──────────────────────────────────────
    evol_max_sharpe = calcular_evolucion_historica(w_max_sharpe, precios)
    evol_min_var = calcular_evolucion_historica(w_min_var, precios)

    # ── Estadísticas por ticker ──────────────────────────────────
    ultimo_precio = precios.iloc[-1]
    estadisticas = {}
    for t in tickers_ok:
        precio_t = float(ultimo_precio[t]) if t in ultimo_precio.index else 0.0
        estadisticas[t] = {
            "rend_anual": round(float(rend_anual[t] * 100), 4),
            "std_anual": round(float(std_anual[t] * 100), 4),
            "precio": round(precio_t, 2),
        }

    # ── Matriz de correlación serializada ────────────────────────
    correlacion = {
        t: {
            t2: round(float(corr_matrix.loc[t, t2]), 4)
            for t2 in tickers_ok
        }
        for t in tickers_ok
    }

    # ── Resultado final ──────────────────────────────────────────
    resultado = {
        "tickers": tickers_ok,
        "tickers_excluidos": tickers_excluidos,
        "restricciones": f"{bmin * 100:.0f}%-{bmax * 100:.0f}%",
        "rf_utilizada": round(float(rf * 100), 2),
        "rf_fuente": rf_fuente,
        "estadisticas": estadisticas,
        "correlacion": correlacion,
        "max_sharpe": metricas_max_sharpe,
        "min_varianza": metricas_min_var,
        "frontera": frontera,
        "historico": {
            "fechas": evol_max_sharpe["fechas"],
            "min_varianza": evol_min_var["valores"],
            "max_sharpe": evol_max_sharpe["valores"],
        },
        "pesos_actuales": None,
    }

    logger.info(
        "Optimización completada. Max Sharpe: %.4f, Min Var riesgo: %.2f%%",
        metricas_max_sharpe["sharpe"],
        metricas_min_var["riesgo"],
    )

    return resultado

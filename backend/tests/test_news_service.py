# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests para el servicio de noticias y análisis de sentimiento.

Verifica:
    - calcular_score() con texto positivo, negativo, mixto y vacío
    - calcular_semaforo() con diversas listas de scores
    - Score siempre en rango [-1, +1]
    - Semáforo siempre verde/amarillo/rojo
    - obtener_sector() retorna sector correcto o 'Sin clasificar'

Requisitos cubiertos: 6.1–6.8
"""

import pytest

from app.services.news_service import NewsService


class TestCalcularScore:
    """Tests para el cálculo de score de sentimiento."""

    def test_texto_positivo_retorna_score_positivo(self):
        """Texto con solo palabras positivas retorna score > 0."""
        texto = "Gran crecimiento y récord de ganancias"
        score = NewsService.calcular_score(texto)
        assert score > 0

    def test_texto_negativo_retorna_score_negativo(self):
        """Texto con solo palabras negativas retorna score < 0."""
        texto = "Caída y pérdida por crisis financiera"
        score = NewsService.calcular_score(texto)
        assert score < 0

    def test_texto_mixto_retorna_score_intermedio(self):
        """Texto con palabras positivas y negativas retorna score entre -1 y 1."""
        texto = "Crecimiento a pesar de la crisis y riesgo"
        score = NewsService.calcular_score(texto)
        assert -1 <= score <= 1

    def test_texto_vacio_retorna_cero(self):
        """Texto vacío retorna score 0.0."""
        assert NewsService.calcular_score("") == 0.0

    def test_texto_none_retorna_cero(self):
        """Texto None retorna score 0.0."""
        assert NewsService.calcular_score(None) == 0.0

    def test_texto_sin_keywords_retorna_cero(self):
        """Texto sin palabras clave retorna score 0.0."""
        texto = "El cielo es azul y el agua es transparente"
        assert NewsService.calcular_score(texto) == 0.0

    def test_score_siempre_en_rango(self):
        """El score siempre está en [-1, +1] sin importar el texto."""
        textos = [
            "crecimiento récord supera alza dividendo ganancias expansión innovación",
            "caída pérdida quiebra multa recorte crisis fraude investigación sanción",
            "growth record beat rally dividend earnings profit expansion",
            "decline loss bankruptcy fine cut crisis lawsuit fraud",
            "",
            "texto sin palabras clave relevantes",
        ]
        for texto in textos:
            score = NewsService.calcular_score(texto)
            assert -1 <= score <= 1, f"Score {score} fuera de rango para: {texto}"

    def test_score_redondeado_a_4_decimales(self):
        """El score se redondea a 4 decimales."""
        texto = "crecimiento y crisis"
        score = NewsService.calcular_score(texto)
        score_str = str(score)
        if '.' in score_str:
            decimales = len(score_str.split('.')[1])
            assert decimales <= 4

    def test_palabras_ingles_positivas(self):
        """Palabras positivas en inglés son reconocidas."""
        texto = "Strong growth and record earnings beat expectations"
        score = NewsService.calcular_score(texto)
        assert score > 0

    def test_palabras_ingles_negativas(self):
        """Palabras negativas en inglés son reconocidas."""
        texto = "Decline and loss amid bankruptcy fears"
        score = NewsService.calcular_score(texto)
        assert score < 0

    def test_score_maximo_es_uno(self):
        """Texto con solo positivas retorna exactamente 1.0."""
        texto = "crecimiento récord supera alza"
        score = NewsService.calcular_score(texto)
        assert score == 1.0

    def test_score_minimo_es_menos_uno(self):
        """Texto con solo negativas retorna exactamente -1.0."""
        texto = "caída pérdida quiebra multa"
        score = NewsService.calcular_score(texto)
        assert score == -1.0


class TestCalcularSemaforo:
    """Tests para el cálculo de semáforo."""

    def test_scores_positivos_retorna_verde(self):
        """Promedio > 0.2 retorna 'verde'."""
        scores = [0.5, 0.6, 0.4, 0.3, 0.5]
        assert NewsService.calcular_semaforo(scores) == 'verde'

    def test_scores_negativos_retorna_rojo(self):
        """Promedio < -0.2 retorna 'rojo'."""
        scores = [-0.5, -0.6, -0.4, -0.3, -0.5]
        assert NewsService.calcular_semaforo(scores) == 'rojo'

    def test_scores_mixtos_retorna_amarillo(self):
        """Promedio entre -0.2 y 0.2 retorna 'amarillo'."""
        scores = [0.1, -0.1, 0.05, -0.05, 0.0]
        assert NewsService.calcular_semaforo(scores) == 'amarillo'

    def test_lista_vacia_retorna_amarillo(self):
        """Lista vacía retorna 'amarillo'."""
        assert NewsService.calcular_semaforo([]) == 'amarillo'

    def test_usa_ultimos_10_scores(self):
        """Solo usa los últimos 10 scores de la lista."""
        # Primeros 5 muy negativos, últimos 10 muy positivos
        scores = [-1.0] * 5 + [0.5] * 10
        assert NewsService.calcular_semaforo(scores) == 'verde'

    def test_semaforo_siempre_valido(self):
        """El semáforo siempre es verde, amarillo o rojo."""
        listas = [
            [], [0.0], [1.0], [-1.0],
            [0.5, -0.5], [0.3] * 20,
            [-0.3] * 20, [0.1, -0.1] * 5,
        ]
        for scores in listas:
            resultado = NewsService.calcular_semaforo(scores)
            assert resultado in ('verde', 'amarillo', 'rojo'), \
                f"Semáforo inválido '{resultado}' para scores: {scores}"

    def test_umbral_verde_exacto(self):
        """Promedio exactamente 0.2 retorna 'amarillo' (no verde)."""
        scores = [0.2]
        assert NewsService.calcular_semaforo(scores) == 'amarillo'

    def test_umbral_rojo_exacto(self):
        """Promedio exactamente -0.2 retorna 'amarillo' (no rojo)."""
        scores = [-0.2]
        assert NewsService.calcular_semaforo(scores) == 'amarillo'

    def test_justo_arriba_de_verde(self):
        """Promedio justo arriba de 0.2 retorna 'verde'."""
        scores = [0.21]
        assert NewsService.calcular_semaforo(scores) == 'verde'

    def test_justo_debajo_de_rojo(self):
        """Promedio justo debajo de -0.2 retorna 'rojo'."""
        scores = [-0.21]
        assert NewsService.calcular_semaforo(scores) == 'rojo'


class TestObtenerSector:
    """Tests para obtener_sector."""

    def test_ticker_conocido(self):
        """Ticker conocido retorna su sector."""
        assert NewsService.obtener_sector('AAPL') == 'Tecnología / Hardware'
        assert NewsService.obtener_sector('JPM') == 'Finanzas / Banca'

    def test_ticker_mexicano(self):
        """Ticker BMV retorna su sector."""
        assert NewsService.obtener_sector('AMXL.MX') == 'Telecomunicaciones / México'

    def test_ticker_desconocido(self):
        """Ticker desconocido retorna 'Sin clasificar'."""
        assert NewsService.obtener_sector('XYZABC') == 'Sin clasificar'

    def test_etf(self):
        """ETF retorna su categoría."""
        assert NewsService.obtener_sector('SPY') == 'ETF / S&P 500'

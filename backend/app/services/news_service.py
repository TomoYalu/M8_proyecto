"""
Motor de noticias y análisis de sentimiento.

Consume RSS feeds de Yahoo Finance News, El Financiero y Expansión,
calcula un score de sentimiento por keyword scoring normalizado en [-1, +1],
y genera un semáforo (verde/amarillo/rojo) por ticker.

Requisitos cubiertos: 6.1–6.8
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

import feedparser

from ..extensions import db
from ..models.noticia import Noticia

logger = logging.getLogger(__name__)


# ── Palabras positivas y negativas (español + inglés) ────────────

PALABRAS_POSITIVAS = [
    # Español
    'crecimiento', 'récord', 'supera', 'alza', 'dividendo', 'ganancias',
    'beneficio', 'expansión', 'innovación', 'liderazgo', 'optimismo',
    'recuperación', 'sube', 'máximo', 'positivo', 'mejora', 'avance',
    'impulso', 'fortaleza', 'demanda', 'inversión', 'rentabilidad',
    'oportunidad', 'aprobación', 'acuerdo', 'alianza', 'adquisición',
    'superávit', 'estabilidad', 'confianza', 'recomendación',
    # Inglés
    'growth', 'record', 'beat', 'rally', 'dividend', 'earnings',
    'profit', 'expansion', 'innovation', 'leadership', 'optimism',
    'recovery', 'surge', 'high', 'positive', 'upgrade', 'advance',
    'momentum', 'strength', 'demand', 'investment', 'profitability',
    'opportunity', 'approval', 'deal', 'partnership', 'acquisition',
    'surplus', 'stability', 'confidence', 'outperform',
]

PALABRAS_NEGATIVAS = [
    # Español
    'caída', 'pérdida', 'quiebra', 'multa', 'recorte', 'crisis',
    'demanda legal', 'fraude', 'investigación', 'sanción', 'baja',
    'mínimo', 'negativo', 'riesgo', 'deuda', 'déficit', 'inflación',
    'recesión', 'despidos', 'cierre', 'retiro', 'escándalo',
    'incertidumbre', 'volatilidad', 'desplome', 'colapso', 'bancarrota',
    'deterioro', 'contracción', 'advertencia',
    # Inglés
    'decline', 'loss', 'bankruptcy', 'fine', 'cut', 'crisis',
    'lawsuit', 'fraud', 'investigation', 'sanction', 'drop',
    'low', 'negative', 'risk', 'debt', 'deficit', 'inflation',
    'recession', 'layoffs', 'shutdown', 'recall', 'scandal',
    'uncertainty', 'volatility', 'crash', 'collapse', 'default',
    'downgrade', 'contraction', 'warning',
]

# ── Mapa ticker → nombre de empresa para filtrado de RSS ─────

NOMBRE_POR_TICKER = {
    'AAPL': 'Apple',
    'MSFT': 'Microsoft',
    'GOOGL': 'Google',
    'AMZN': 'Amazon',
    'NVDA': 'NVIDIA',
    'META': 'Meta',
    'TSLA': 'Tesla',
    'AMD': 'AMD',
    'INTC': 'Intel',
    'NFLX': 'Netflix',
    'ADBE': 'Adobe',
    'CRM': 'Salesforce',
    'AVGO': 'Broadcom',
    'CSCO': 'Cisco',
    'QCOM': 'Qualcomm',
    'TXN': 'Texas Instruments',
    'INTU': 'Intuit',
    'IBM': 'IBM',
    'JPM': 'JPMorgan',
    'GS': 'Goldman Sachs',
    'BAC': 'Bank of America',
    'MS': 'Morgan Stanley',
    'V': 'Visa',
    'MA': 'Mastercard',
    'BLK': 'BlackRock',
    'AXP': 'American Express',
    'JNJ': 'Johnson & Johnson',
    'PFE': 'Pfizer',
    'UNH': 'UnitedHealth',
    'MRK': 'Merck',
    'ABT': 'Abbott',
    'LLY': 'Eli Lilly',
    'AMGN': 'Amgen',
    'ABBV': 'AbbVie',
    'XOM': 'Exxon',
    'CVX': 'Chevron',
    'WMT': 'Walmart',
    'KO': 'Coca-Cola',
    'PEP': 'Pepsi',
    'PG': 'Procter Gamble',
    'COST': 'Costco',
    'HD': 'Home Depot',
    'DIS': 'Disney',
    'MCD': 'McDonald',
    'CAT': 'Caterpillar',
    'BA': 'Boeing',
    'AMXL.MX': 'América Móvil',
    'WALMEX.MX': 'Walmex Walmart México',
    'FEMSAUBD.MX': 'FEMSA',
    'GFNORTEO.MX': 'Banorte',
    'TLEVISACPO.MX': 'Televisa',
    'CEMEXCPO.MX': 'Cemex',
    'BIMBOA.MX': 'Bimbo',
    'GMEXICOB.MX': 'Grupo México',
    'SPY': 'S&P 500',
    'QQQ': 'NASDAQ',
}

# ── Mapa estático ticker → sector (equivalente a frontend sectors.js) ─

SECTOR_POR_TICKER = {
    # Tecnología
    'AAPL':  'Tecnología / Hardware',
    'MSFT':  'Tecnología / Software',
    'GOOGL': 'Tecnología / Publicidad Digital',
    'AMZN':  'Tecnología / E-Commerce',
    'NVDA':  'Tecnología / IA & Semiconductores',
    'META':  'Tecnología / Redes Sociales',
    'TSLA':  'Tecnología / Vehículos Eléctricos',
    'AMD':   'Tecnología / Semiconductores',
    'INTC':  'Tecnología / Semiconductores',
    'NFLX':  'Tecnología / Streaming',
    'ADBE':  'Tecnología / Software',
    'CRM':   'Tecnología / Software Empresarial',
    'AVGO':  'Tecnología / Semiconductores',
    'CSCO':  'Tecnología / Redes',
    'QCOM':  'Tecnología / Semiconductores',
    'TXN':   'Tecnología / Semiconductores',
    'INTU':  'Tecnología / Software Financiero',
    'IBM':   'Tecnología / Servicios TI',
    # Finanzas
    'JPM':  'Finanzas / Banca',
    'GS':   'Finanzas / Banca de Inversión',
    'BAC':  'Finanzas / Banca',
    'MS':   'Finanzas / Banca de Inversión',
    'V':    'Finanzas / Pagos',
    'MA':   'Finanzas / Pagos',
    'BLK':  'Finanzas / Gestión de Activos',
    'AXP':  'Finanzas / Pagos',
    # Salud
    'JNJ':  'Salud / Farmacéutica',
    'PFE':  'Salud / Farmacéutica',
    'UNH':  'Salud / Seguros',
    'MRK':  'Salud / Farmacéutica',
    'ABT':  'Salud / Dispositivos Médicos',
    'LLY':  'Salud / Farmacéutica',
    'AMGN': 'Salud / Biotecnología',
    'ABBV': 'Salud / Farmacéutica',
    'TMO':  'Salud / Equipos de Laboratorio',
    'ISRG': 'Salud / Robótica Médica',
    'GSK':  'Salud / Farmacéutica',
    'AZN':  'Salud / Farmacéutica',
    # Energía
    'XOM':  'Energía / Petróleo & Gas',
    'CVX':  'Energía / Petróleo & Gas',
    'COP':  'Energía / Petróleo & Gas',
    'NEE':  'Energía / Renovables',
    'SHEL': 'Energía / Petróleo & Gas',
    'BP':   'Energía / Petróleo & Gas',
    # Consumo
    'WMT':  'Consumo / Retail',
    'KO':   'Consumo / Bebidas',
    'PEP':  'Consumo / Bebidas',
    'PG':   'Consumo / Productos del Hogar',
    'COST': 'Consumo / Retail',
    'HD':   'Consumo / Mejoras del Hogar',
    'DIS':  'Consumo / Entretenimiento',
    'MCD':  'Consumo / Restaurantes',
    # Industrial
    'CAT':  'Industrial / Maquinaria',
    'BA':   'Industrial / Aeroespacial',
    'TRV':  'Finanzas / Seguros',
    # México (BMV)
    'AMXL.MX':       'Telecomunicaciones / México',
    'WALMEX.MX':     'Consumo / Retail México',
    'FEMSAUBD.MX':   'Consumo / Bebidas México',
    'GFNORTEO.MX':   'Finanzas / Banca México',
    'TLEVISACPO.MX': 'Medios / Televisión México',
    'CEMEXCPO.MX':   'Industrial / Cemento México',
    'BIMBOA.MX':     'Consumo / Alimentos México',
    'GMEXICOB.MX':   'Minería / México',
    # ETFs
    'SPY':  'ETF / S&P 500',
    'QQQ':  'ETF / NASDAQ 100',
    'IWM':  'ETF / Russell 2000',
    'GLD':  'ETF / Oro',
    'SLV':  'ETF / Plata',
    'TLT':  'ETF / Bonos Largo Plazo',
    'VTI':  'ETF / Mercado Total EE.UU.',
    'VEA':  'ETF / Mercados Desarrollados',
    'VWO':  'ETF / Mercados Emergentes',
    'BND':  'ETF / Bonos Agregados',
    'LQD':  'ETF / Bonos Corporativos',
    'HYG':  'ETF / Bonos Alto Rendimiento',
    'USO':  'ETF / Petróleo',
    'UNG':  'ETF / Gas Natural',
    'EWU':  'ETF / Reino Unido',
    'EWG':  'ETF / Alemania',
    'EWJ':  'ETF / Japón',
    # Minería / Commodities
    'RIO':  'Minería / Diversificada',
    'COPX': 'ETF / Cobre',
    'WEAT': 'ETF / Trigo',
    'DBA':  'ETF / Agricultura',
}

# ── RSS feed URLs por fuente ─────────────────────────────────────

RSS_FUENTES = {
    'Yahoo Finance': 'https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US',
    'El Financiero': 'https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/?outputType=xml',
    'Expansión': 'https://expansion.mx/arc/outboundfeeds/rss/?outputType=xml',
}


class NewsService:
    """Servicio de noticias con análisis de sentimiento por keyword scoring."""

    # ── Filtrado de relevancia para feeds genéricos ──────────────

    @staticmethod
    def _es_relevante(titulo: str, ticker: str) -> bool:
        """
        Verifica si un título de noticia es relevante para un ticker.

        Compara contra el símbolo del ticker y el nombre de la empresa.
        """
        titulo_lower = titulo.lower()
        # Verificar ticker (sin sufijo .MX)
        ticker_base = ticker.replace('.MX', '').lower()
        if ticker_base in titulo_lower:
            return True
        # Verificar nombre de empresa
        nombre = NOMBRE_POR_TICKER.get(ticker, '')
        if nombre:
            # Verificar cada palabra del nombre (case-insensitive)
            palabras = nombre.lower().split()
            for palabra in palabras:
                if len(palabra) >= 3 and palabra in titulo_lower:
                    return True
        return False

    # ── Fetch RSS ────────────────────────────────────────────────

    @staticmethod
    def _fetch_rss(ticker: str, fuente: str) -> List[dict]:
        """
        Obtiene noticias de un feed RSS para un ticker.

        Args:
            ticker: Símbolo bursátil (ej. AAPL, AMXL.MX).
            fuente: Nombre de la fuente ('Yahoo Finance', 'El Financiero', 'Expansión').

        Returns:
            Lista de dicts con: titulo, url, fuente, fecha_publicacion.
            Lista vacía si el feed falla.
        """
        url_template = RSS_FUENTES.get(fuente)
        if not url_template:
            logger.warning("Fuente RSS desconocida: '%s'", fuente)
            return []

        url = url_template.format(ticker=ticker)

        try:
            feed = feedparser.parse(url)

            if feed.bozo and not feed.entries:
                logger.warning(
                    "Error al parsear RSS de '%s' para '%s': %s",
                    fuente, ticker, getattr(feed, 'bozo_exception', 'desconocido')
                )
                return []

            noticias = []
            for entry in feed.entries:
                fecha_pub = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        fecha_pub = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                    except (TypeError, ValueError):
                        fecha_pub = None

                noticias.append({
                    'titulo': entry.get('title', ''),
                    'url': entry.get('link', ''),
                    'fuente': fuente,
                    'fecha_publicacion': fecha_pub,
                })

            # Filtrar noticias genéricas (El Financiero, Expansión) por relevancia
            # Yahoo Finance ya es ticker-específico, no necesita filtro
            if fuente != 'Yahoo Finance':
                noticias = [n for n in noticias if NewsService._es_relevante(n['titulo'], ticker)]

            return noticias

        except Exception as e:
            logger.error(
                "Error al obtener RSS de '%s' para '%s': %s",
                fuente, ticker, str(e)
            )
            return []

    # ── Cálculo de score de sentimiento ──────────────────────────

    @staticmethod
    def calcular_score(texto: str) -> float:
        """
        Calcula el score de sentimiento de un texto por keyword scoring.

        Cuenta palabras positivas y negativas, normaliza al rango [-1, +1].
        Score = (positivos - negativos) / total si total > 0, else 0.0.

        Args:
            texto: Texto a analizar (título de noticia).

        Returns:
            Score normalizado en [-1, +1], redondeado a 4 decimales.
        """
        if not texto:
            return 0.0

        texto_lower = texto.lower()

        positivos = sum(1 for p in PALABRAS_POSITIVAS if p in texto_lower)
        negativos = sum(1 for n in PALABRAS_NEGATIVAS if n in texto_lower)

        total = positivos + negativos
        if total == 0:
            return 0.0

        score = (positivos - negativos) / total
        return round(score, 4)

    # ── Cálculo de semáforo ──────────────────────────────────────

    @staticmethod
    def calcular_semaforo(scores: List[float]) -> str:
        """
        Calcula el semáforo a partir de los scores de las últimas 10 noticias.

        Promedio de últimos 10 scores:
            > 0.2  → 'verde'
            -0.2 a 0.2 → 'amarillo'
            < -0.2 → 'rojo'
            Lista vacía → 'amarillo'

        Args:
            scores: Lista de scores de sentimiento.

        Returns:
            'verde', 'amarillo' o 'rojo'.
        """
        if not scores:
            return 'amarillo'

        ultimos_10 = scores[-10:]
        promedio = sum(ultimos_10) / len(ultimos_10)

        if promedio > 0.2:
            return 'verde'
        elif promedio < -0.2:
            return 'rojo'
        else:
            return 'amarillo'

    # ── Obtener sector ───────────────────────────────────────────

    @staticmethod
    def obtener_sector(ticker: str) -> str:
        """
        Obtiene el sector de un ticker desde el mapa estático.

        Args:
            ticker: Símbolo bursátil.

        Returns:
            Sector del ticker o 'Sin clasificar' si no se encuentra.
        """
        return SECTOR_POR_TICKER.get(ticker, 'Sin clasificar')

    # ── Pipeline completo de actualización ───────────────────────

    @staticmethod
    def actualizar_noticias(ticker: str) -> str:
        """
        Pipeline completo de actualización de noticias para un ticker.

        1. Fetch RSS de todas las fuentes.
        2. Calcula score de sentimiento para cada noticia.
        3. Obtiene sector del ticker.
        4. Almacena últimas 50 noticias en DB.
        5. Retorna el semáforo resultante.

        Args:
            ticker: Símbolo bursátil.

        Returns:
            Semáforo: 'verde', 'amarillo' o 'rojo'.
        """
        service = NewsService()
        todas_noticias = []

        # 1. Fetch de todas las fuentes
        for fuente in RSS_FUENTES:
            noticias_fuente = service._fetch_rss(ticker, fuente)
            todas_noticias.extend(noticias_fuente)

        if not todas_noticias:
            logger.info("No se obtuvieron noticias para '%s'.", ticker)
            # Calcular semáforo con noticias existentes en DB
            existentes = Noticia.query.filter_by(
                ticker=ticker, user_id=1
            ).order_by(Noticia.created_at.desc()).limit(10).all()
            scores_existentes = [
                float(n.score_sentimiento) for n in existentes
                if n.score_sentimiento is not None
            ]
            return service.calcular_semaforo(scores_existentes)

        # 2. Calcular score y sector
        sector = service.obtener_sector(ticker)
        scores = []

        for noticia_data in todas_noticias:
            score = service.calcular_score(noticia_data['titulo'])
            noticia_data['score_sentimiento'] = score
            noticia_data['sector'] = sector
            scores.append(score)

        # 3. Eliminar noticias antiguas del ticker (mantener últimas 50)
        existentes_count = Noticia.query.filter_by(
            ticker=ticker, user_id=1
        ).count()

        # Insertar nuevas noticias
        nuevas_noticias = []
        for noticia_data in todas_noticias:
            nueva = Noticia(
                user_id=1,
                ticker=ticker,
                titulo=noticia_data['titulo'],
                url=noticia_data.get('url'),
                fuente=noticia_data.get('fuente'),
                fecha_publicacion=noticia_data.get('fecha_publicacion'),
                score_sentimiento=noticia_data['score_sentimiento'],
                sector=noticia_data['sector'],
            )
            nuevas_noticias.append(nueva)

        db.session.add_all(nuevas_noticias)
        db.session.flush()

        # Mantener solo las últimas 50 noticias por ticker
        total = Noticia.query.filter_by(ticker=ticker, user_id=1).count()
        if total > 50:
            exceso = total - 50
            antiguas = Noticia.query.filter_by(
                ticker=ticker, user_id=1
            ).order_by(Noticia.created_at.asc()).limit(exceso).all()
            for antigua in antiguas:
                db.session.delete(antigua)

        db.session.commit()

        # 4. Calcular semáforo con las últimas 10 noticias
        ultimas = Noticia.query.filter_by(
            ticker=ticker, user_id=1
        ).order_by(Noticia.created_at.desc()).limit(10).all()
        scores_finales = [
            float(n.score_sentimiento) for n in ultimas
            if n.score_sentimiento is not None
        ]

        return service.calcular_semaforo(scores_finales)

    # ── Consultas de lectura ─────────────────────────────────────

    @staticmethod
    def obtener_noticias(ticker: str, limit: int = 50) -> List[dict]:
        """
        Obtiene las noticias almacenadas para un ticker.

        Args:
            ticker: Símbolo bursátil.
            limit: Número máximo de noticias a retornar (default 50).

        Returns:
            Lista de dicts con datos de cada noticia.
        """
        noticias = Noticia.query.filter_by(
            ticker=ticker, user_id=1
        ).order_by(
            Noticia.created_at.desc()
        ).limit(limit).all()

        return [
            {
                'id': n.id,
                'ticker': n.ticker,
                'titulo': n.titulo,
                'url': n.url,
                'fuente': n.fuente,
                'fecha_publicacion': (
                    n.fecha_publicacion.isoformat() if n.fecha_publicacion else None
                ),
                'score_sentimiento': (
                    float(n.score_sentimiento) if n.score_sentimiento is not None else None
                ),
                'sector': n.sector,
                'created_at': n.created_at.isoformat() if n.created_at else None,
            }
            for n in noticias
        ]

    @staticmethod
    def obtener_semaforo(ticker: str) -> dict:
        """
        Obtiene el semáforo actual para un ticker.

        Args:
            ticker: Símbolo bursátil.

        Returns:
            Dict con: ticker, semaforo, score_promedio, total_noticias.
        """
        service = NewsService()

        ultimas = Noticia.query.filter_by(
            ticker=ticker, user_id=1
        ).order_by(Noticia.created_at.desc()).limit(10).all()

        scores = [
            float(n.score_sentimiento) for n in ultimas
            if n.score_sentimiento is not None
        ]

        semaforo = service.calcular_semaforo(scores)
        promedio = round(sum(scores) / len(scores), 4) if scores else 0.0

        total = Noticia.query.filter_by(ticker=ticker, user_id=1).count()

        return {
            'ticker': ticker,
            'semaforo': semaforo,
            'score_promedio': promedio,
            'total_noticias': total,
        }

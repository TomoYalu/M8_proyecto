# Lakshmi Q2 — Prompt de Contexto para IA

> Este documento describe la arquitectura, módulos, tecnologías y convenciones del proyecto Lakshmi Q2.
> Su propósito es servir como contexto para que una IA pueda entender, replicar o extender la aplicación.

---

## Identidad del Proyecto

- **Nombre**: Lakshmi Q2
- **Descripción**: Plataforma web full-stack para gestión, optimización y monitoreo de portafolios de inversión, diseñada para usuarios mexicanos desde nivel novato hasta intermedio.
- **Autor**: Luis Yhaser Olmos Torres
- **Institución**: Tecnológico de Monterrey
- **Idioma de la UI**: Español (México)
- **Idioma del código**: Variables y funciones en inglés/español mixto; docstrings, comentarios y mensajes al usuario en español.

---

## Stack Tecnológico

### Backend
- **Lenguaje**: Python 3.11+
- **Framework**: Flask con Flask-SocketIO (eventlet)
- **ORM**: SQLAlchemy con Flask-Migrate
- **Base de datos**: SQLite (archivo `backend/lakshmi.db`)
- **Datos de mercado**: yfinance (Yahoo Finance)
- **Datos macro México**: API de Banxico (INPC, tipo de cambio USD/MXN)
- **Scheduler**: APScheduler (precios cada 5 min, noticias cada 60 min, fiscal diario)
- **WebSocket**: Flask-SocketIO para precios en tiempo real y alertas
- **Optimización**: scipy.optimize (Markowitz), numpy, pandas
- **Análisis técnico**: Cálculos propios en `ta_service.py` (SMA, EMA, RSI, MACD, Bollinger, Estocástico, SAR, Fibonacci, patrones chartistas)
- **Tests**: pytest (436 tests)

### Frontend
- **Framework**: React 18 con Vite
- **Estado global**: Zustand (slices: portfolio, optimizer, simulator, alerts, analysis, widgets, favoritos, ui, capital)
- **Estilos**: TailwindCSS con tema custom "Bloomberg" (fondo oscuro, acentos azules/verdes)
- **Gráficos**: Plotly.js (react-plotly.js) para todos los charts
- **Routing**: React Router v6
- **Layout de widgets**: GridStack (drag-and-drop)

### Infraestructura
- Docker + Docker Compose (3 servicios: backend, frontend, nginx)
- Nginx como proxy reverso
- Volúmenes persistentes para SQLite y logs

---

## Estructura de Directorios

```
lakshmi-q2/
├── backend/
│   ├── run.py                    # Entry point (puerto 5000)
│   ├── app/
│   │   ├── __init__.py           # create_app(), DB init, auto-seed demo
│   │   ├── config.py             # Configuración Flask, DB URI
│   │   ├── extensions.py         # db, socketio, scheduler instances
│   │   ├── api/                  # Blueprints REST
│   │   │   ├── portafolios.py    # CRUD portafolios, transacciones, dashboard, backtest, proyección
│   │   │   ├── analisis.py       # Análisis técnico, optimización Markowitz
│   │   │   ├── busqueda.py       # Búsqueda y filtrado de activos
│   │   │   ├── noticias.py       # RSS feeds, semáforo de sentimiento
│   │   │   ├── alertas.py        # CRUD alertas, historial
│   │   │   ├── fiscal.py         # ISR, INPC, tipo de cambio
│   │   │   ├── wizard.py         # Wizard ciclo económico top-down
│   │   │   ├── widgets.py        # Configuración de layout dashboard
│   │   │   ├── simulaciones.py   # Simulador de escenarios
│   │   │   └── configuracion.py  # Capital global, moneda base
│   │   ├── models/               # SQLAlchemy models
│   │   │   ├── portafolio.py     # Portafolio, Posicion, Transaccion
│   │   │   ├── alerta.py         # Alerta, AlertaHistorial
│   │   │   ├── noticia.py        # Noticia, SemaforoCache
│   │   │   ├── cache.py          # PrecioCache, TipoCambioCache, InpcCache, CicloCache
│   │   │   ├── widget.py         # WidgetConfig
│   │   │   ├── universo.py       # UniversoActivo (búsqueda)
│   │   │   ├── simulacion.py     # Simulacion, SimulacionResultado
│   │   │   └── configuracion.py  # ConfiguracionUsuario
│   │   ├── services/             # Lógica de negocio
│   │   │   ├── portfolio_service.py   # Posiciones, P&L, histórico, TWR, Monte Carlo
│   │   │   ├── optimizer_service.py   # Markowitz Monte Carlo (5000 sims)
│   │   │   ├── ta_service.py          # 12+ indicadores técnicos, patrones chartistas
│   │   │   ├── news_service.py        # RSS parsing, sentiment scoring
│   │   │   ├── alert_service.py       # 9 tipos de alerta, evaluación periódica
│   │   │   ├── fiscal_service.py      # ISR 10%, ajuste INPC, retención dividendos
│   │   │   ├── banxico_service.py     # API Banxico (INPC, tipo de cambio)
│   │   │   ├── yfinance_service.py    # Wrapper yfinance con caché
│   │   │   ├── wizard_service.py      # Pipeline 6 pasos ciclo económico
│   │   │   ├── universo_service.py    # Búsqueda y filtrado de activos
│   │   │   ├── simulator_service.py   # Simulación de escenarios
│   │   │   └── email_service.py       # SMTP para alertas
│   │   ├── sockets/events.py     # WebSocket handlers
│   │   └── scheduler/jobs.py     # Jobs periódicos (precios, noticias, fiscal)
│   └── tests/                    # 436 tests pytest
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Router principal
│   │   ├── main.jsx              # Entry point React
│   │   ├── pages/                # Páginas (una por ruta)
│   │   │   ├── Portafolios.jsx   # Gestión de portafolios (sidebar + detail)
│   │   │   ├── Analisis.jsx      # Análisis técnico por ticker
│   │   │   ├── Busqueda.jsx      # Búsqueda y filtrado de activos
│   │   │   ├── Wizard.jsx        # Wizard ciclo económico (6 pasos)
│   │   │   ├── Noticias.jsx      # Feed de noticias con semáforo
│   │   │   ├── Alertas.jsx       # Gestión de alertas (TODO pendiente)
│   │   │   ├── Fiscal.jsx        # Módulo fiscal (TODO pendiente)
│   │   │   └── Dashboard.jsx     # Dashboard widgets (TODO pendiente)
│   │   ├── components/
│   │   │   ├── portfolio/        # PortfolioDetail, PositionTable, PortfolioDashboard, etc.
│   │   │   ├── optimizer/        # OptimizerResults, RiskCards, EfficientFrontierChart, etc.
│   │   │   ├── charts/           # CandlestickChart, RSIChart, MACDChart, BollingerChart, etc.
│   │   │   ├── search/           # TickerDrawer, SearchResultsTable, FilterPanel, HeatmapChart
│   │   │   ├── wizard/           # RiskProfileForm, CycleStageCard, AllocationChart, etc.
│   │   │   ├── news/             # NewsFeed, NewsCard, SemaforoIndicator
│   │   │   ├── alerts/           # AlertForm, AlertList, AlertHistory
│   │   │   ├── fiscal/           # TaxTable, InpcAdjustment, CurrencyConverter
│   │   │   ├── widgets/          # WidgetGrid, WidgetContainer, PresetSelector
│   │   │   ├── layout/           # Sidebar, Navbar, ExchangeRateBanner
│   │   │   └── common/           # Tooltip, Spinner, Modal, ErrorMessage, Badge
│   │   ├── hooks/                # useOptimizer, useAnalysis, usePortfolio, useWebSocket, etc.
│   │   ├── store/                # Zustand slices
│   │   ├── utils/                # formatters, colors, plotlyDefaults, indicators
│   │   └── constants/            # tickers, sectors, keywords
│   └── tailwind.config.js        # Tema Bloomberg custom
└── docker-compose.yml
```

---

## Módulos Funcionales

### 1. Portafolios (módulo principal)
- CRUD de portafolios nombrados con moneda (USD/MXN)
- Transacciones: compra, venta, dividendo con fecha y precio
- Precio promedio ponderado, P&L bruto/neto, valor de mercado
- **4 pestañas en el detalle**:
  - **Posiciones**: Tabla con semáforo compuesto (3 señales), donut de asignación
  - **Transacciones**: Historial paginado con filtros
  - **Dashboard**: Métricas de riesgo (Sharpe, Sortino, Beta, VaR, Max Drawdown), correlación (heatmap), contribución al riesgo, crecimiento de $1, drawdown, TWR (Time-Weighted Return), proyección Monte Carlo (p10/p50/p90), backtesting vs SPY, resumen técnico por ticker
  - **Optimizador**: Markowitz con 3 perfiles (Conservador/Moderado/Agresivo), frontera eficiente, pesos sugeridos, botón "Aplicar al portafolio"
- Vista consolidada de todos los portafolios
- Favoritos con link al buscador
- Demo auto-seed con `LAKSHMI_DEMO=1`

### 2. Análisis Técnico
- Indicadores: SMA 50/200, EMA 20, RSI(14), MACD(12,26,9), Estocástico, Bollinger(20,2), SAR Parabólico, Fibonacci, Volumen
- Patrones chartistas: Doble Techo, Cabeza y Hombros, Triángulos, Banderas, etc.
- Divergencia MACD, Regla de 3 días, Stop Loss, Trailing Stop
- Interpretaciones automáticas en español
- Pool de tickers de portafolios para selección rápida
- Gráficos: Candlestick, MACD, RSI, Estocástico, Volumen, Bollinger (todos con Plotly)

### 3. Semáforo de Noticias
- RSS feeds: Yahoo Finance, El Financiero, Expansión
- Sentiment scoring por keywords
- Semáforo verde/amarillo/rojo por ticker (promedio últimas 10 noticias)

### 4. Wizard Ciclo Económico (Top-Down)
- 6 pasos: Perfil de riesgo → Fase del ciclo → Rotación sectorial → Filtro fundamental (ROE, ROA, D/E, P/E) → Filtro técnico (SMA 200, RSI) → Pool de tickers con asset allocation

### 5. Motor de Alertas (pendiente de UI)
- 9 tipos: precio objetivo, cambio %, RSI sobrecompra/sobreventa, Golden/Death Cross, divergencia MACD, semáforo rojo, concentración excesiva
- WebSocket en tiempo real + email SMTP opcional

### 6. Módulo Fiscal México (pendiente de UI)
- ISR 10% sobre ganancias de capital
- Ajuste inflacionario por INPC (Banxico API)
- Retención dividendos (10% extranjeros, 0% mexicanos)
- Conversión USD/MXN automática

### 7. Búsqueda de Activos
- Búsqueda por ticker/nombre con autocompletado
- Filtros: sector, mercado, rango de precio, volumen, indicadores técnicos
- Heatmap de rendimiento por sector
- Drawer lateral con análisis técnico completo del ticker seleccionado

### 8. Simulador de Escenarios
- Simulación what-if de compras/ventas
- Impacto en métricas del portafolio

---

## API Endpoints Principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/portafolios` | Lista portafolios |
| POST | `/api/portafolios` | Crear portafolio |
| GET | `/api/portafolios/{id}` | Detalle con posiciones |
| GET | `/api/portafolios/{id}/posiciones` | Posiciones con P&L |
| GET/POST | `/api/portafolios/{id}/transacciones` | Historial / registrar |
| GET | `/api/portafolios/{id}/dashboard` | Métricas analíticas (correlación, riesgo, TWR, resumen técnico) |
| POST | `/api/portafolios/{id}/backtest` | Backtesting con rebalanceo vs SPY |
| GET | `/api/portafolios/{id}/proyeccion` | Monte Carlo GBM (p10/p50/p90) |
| GET | `/api/portafolios/{id}/historico` | Valor histórico reconstruido |
| POST | `/api/portafolios/{id}/aplicar-optimizacion` | Aplicar pesos óptimos |
| POST | `/api/portafolios/seed-demo` | Crear portafolio demo |
| GET | `/api/analisis?ticker=X` | Análisis técnico completo |
| POST | `/api/analisis/portafolio` | Optimización Markowitz |
| GET | `/api/noticias/{ticker}` | Noticias con score |
| GET | `/api/noticias/{ticker}/semaforo` | Semáforo sentimiento |
| POST | `/api/wizard/perfil` | Perfil de riesgo |
| GET | `/api/wizard/ciclo` | Fase del ciclo económico |
| GET/POST | `/api/alertas` | CRUD alertas |
| GET | `/api/fiscal/{id}` | Tabla fiscal del portafolio |

---

## Convenciones de Código

### Backend (Python)
- Blueprints Flask por módulo en `app/api/`
- Servicios en `app/services/` (lógica de negocio separada de rutas)
- Modelos SQLAlchemy en `app/models/`
- Docstrings en español, formato Google-style
- Logging con `logging.getLogger(__name__)`
- Errores retornados como `{"error": "mensaje"}` con código HTTP apropiado
- User ID hardcodeado (`_USER_ID = 1`) — sin autenticación por ahora

### Frontend (React/JSX)
- Componentes funcionales con hooks
- Un archivo por componente, nombre PascalCase
- Props documentadas con JSDoc
- Zustand para estado global, useState para estado local
- Fetch directo a `/api/...` (Vite proxy a puerto 5000)
- Tema Bloomberg: `bg-bloomberg-panel`, `text-bloomberg-accent`, `text-bloomberg-green/red/yellow`
- Plotly para todos los gráficos (no Chart.js, no Recharts)
- Tooltips con portal (`createPortal`) para evitar recortes por overflow
- Accesibilidad: `role`, `aria-label`, `aria-selected` en tabs y tablas

### Tema Visual (Tailwind)
```js
bloomberg: {
  bg: '#0a0e17',
  panel: '#111827',
  accent: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  text: { DEFAULT: '#e5e7eb', muted: '#9ca3af' }
}
```

---

## Cómo Ejecutar

### Desarrollo local
```bash
# Backend
cd backend
pip install -r requirements.txt
LAKSHMI_DEMO=1 python run.py  # Puerto 5000, auto-seed demo

# Frontend
cd frontend
npm install
npm run dev  # Puerto 3000, proxy a 5000
```

### Docker
```bash
docker-compose up --build  # http://localhost
```

### Tests
```bash
python -m pytest backend/tests --tb=short -q  # 436 tests
```

---

## Estado Actual y Pendientes

### Funcional
- ✅ Portafolios completo (CRUD, posiciones, transacciones, dashboard, optimizador)
- ✅ Análisis técnico completo (12+ indicadores, patrones, interpretaciones)
- ✅ Semáforo de noticias
- ✅ Wizard ciclo económico
- ✅ Búsqueda de activos con filtros
- ✅ Backtesting con rebalanceo y benchmark SPY
- ✅ TWR (rendimiento real)
- ✅ Proyección Monte Carlo
- ✅ Simulador de escenarios

### Pendiente (TODO en UI)
- 🚧 Alertas — Backend funcional, UI con banner "Implementación pendiente"
- 🚧 Fiscal — Backend funcional, UI con banner "Implementación pendiente"
- 🚧 Dashboard de widgets — Oculto del sidebar, pendiente de rediseño
- 🔮 Autenticación de usuarios (actualmente user_id=1 hardcodeado)
- 🔮 Migración a PostgreSQL para producción

# Lakshmi Q2

Plataforma web full-stack para gestión, optimización y monitoreo de portafolios de inversión, diseñada para usuarios mexicanos desde nivel novato hasta intermedio. Integra análisis técnico avanzado, semáforo de noticias, wizard de ciclo económico, motor de alertas, módulo fiscal México y un dashboard con widgets configurables.

---

## Requisitos Previos

| Herramienta       | Versión mínima |
|-------------------|----------------|
| Docker            | 24+            |
| Docker Compose    | v2+            |
| Node.js (dev)     | 20+            |
| Python (dev)      | 3.11+          |

---

## Instalación con Docker

La forma más rápida de levantar toda la plataforma es con Docker Compose:

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd lakshmi-q2

# 2. Crear archivo de variables de entorno
cp .env.example .env
# Editar .env con valores reales (ver sección Variables de Entorno)

# 3. Levantar los tres servicios (backend, frontend, nginx)
docker-compose up --build

# La aplicación estará disponible en http://localhost
```

Para detener los servicios:

```bash
docker-compose down
```

Los datos de SQLite y los logs se persisten en volúmenes Docker (`sqlite-data`, `backend-logs`).

---

## Desarrollo Local

### Backend (Flask)

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor de desarrollo
python run.py
```

El backend se ejecuta en `http://localhost:5000`.

### Frontend (React + Vite)

```bash
cd frontend

# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev
```

El frontend se ejecuta en `http://localhost:5173` (Vite dev server).

Para generar el build de producción:

```bash
npm run build
```

---

## Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto basado en `.env.example`:

| Variable         | Descripción                                                        | Ejemplo                          |
|------------------|--------------------------------------------------------------------|----------------------------------|
| `SECRET_KEY`     | Clave secreta para sesiones Flask. Cambiar en producción.          | `mi-clave-secreta-segura`        |
| `FLASK_ENV`      | Entorno de Flask: `development` o `production`.                    | `development`                    |
| `SMTP_HOST`      | Servidor SMTP para envío de alertas por email.                     | `smtp.gmail.com`                 |
| `SMTP_PORT`      | Puerto del servidor SMTP.                                          | `587`                            |
| `SMTP_USER`      | Usuario/email para autenticación SMTP.                             | `tu-email@gmail.com`             |
| `SMTP_PASSWORD`  | Contraseña o app password para SMTP.                               | `tu-app-password`                |
| `BANXICO_TOKEN`  | Token de la API de Banxico para consultar INPC y tipo de cambio.   | `tu-token-banxico`               |

El token de Banxico se obtiene en: https://www.banxico.org.mx/SieAPIRest/service/v1/token

---

## Módulos

### 1. Portfolio Manager
Gestión de múltiples portafolios nombrados con historial completo de transacciones (compra, venta, dividendo). Calcula precio promedio ponderado, P&L bruto, P&L neto (con ISR) y vista consolidada de todos los portafolios.

### 2. Dashboard de Análisis Técnico
Indicadores técnicos completos: SMA 50/200, EMA 20, RSI (14), MACD (12,26,9), Estocástico de Lane, Bandas de Bollinger, SAR Parabólico, Fibonacci, volumen. Incluye detección de patrones chartistas avanzados (Doble Techo, Cabeza y Hombros, Triángulos, Banderas, etc.), divergencia MACD, regla de 3 días, Stop Loss y Trailing Stop. Interpretaciones automáticas en español.

### 3. Semáforo de Noticias
Consume RSS feeds de Yahoo Finance, El Financiero y Expansión. Calcula un score de sentimiento por noticia mediante keyword scoring y genera un semáforo (verde/amarillo/rojo) por ticker basado en el promedio de las últimas 10 noticias.

### 4. Wizard de Ciclo Económico (Top-Down)
Pipeline guiado de 6 pasos: cuestionario de perfil de riesgo → fase del ciclo económico → rotación sectorial → filtro fundamental (ROE, ROA, D/E, P/E) → filtro técnico (SMA 200, RSI) → pool de tickers recomendados con asset allocation por perfil.

### 5. Motor de Alertas
Soporta 9 tipos de alerta: precio objetivo, cambio porcentual diario, RSI sobrecompra/sobreventa, Golden Cross, Death Cross, divergencia MACD, semáforo rojo y concentración excesiva. Notificaciones vía WebSocket en tiempo real y email SMTP opcional.

### 6. Panel de Widgets Configurable
Dashboard con widgets arrastrables y redimensionables (GridStack, 12 columnas). Tres presets: Análisis Rápido, Análisis Completo y Solo Portafolio. La configuración de layout se persiste en base de datos.

### 7. Módulo Fiscal México
Cálculo de ISR estimado (10% sobre ganancias de capital), ajuste inflacionario por factor INPC (Banxico API), retención de dividendos (10% extranjeros, 0% mexicanos) y conversión automática USD/MXN con tipo de cambio de Banxico.

### 8. Infraestructura Docker
Dos Dockerfiles (backend Python + frontend Node/Nginx), docker-compose con tres servicios, Nginx como proxy reverso, volúmenes persistentes, límites de recursos y restart automático.

---

## API Endpoints

### Portafolios (`/api/portafolios`)

| Método | Ruta                                        | Descripción                                    |
|--------|---------------------------------------------|------------------------------------------------|
| GET    | `/api/portafolios`                          | Lista todos los portafolios                    |
| POST   | `/api/portafolios`                          | Crea un nuevo portafolio                       |
| GET    | `/api/portafolios/{id}`                     | Detalle de un portafolio con posiciones        |
| PUT    | `/api/portafolios/{id}`                     | Renombra o actualiza descripción               |
| DELETE | `/api/portafolios/{id}`                     | Elimina portafolio en cascada                  |
| GET    | `/api/portafolios/consolidado`              | Vista agregada de todos los portafolios        |
| GET    | `/api/portafolios/{id}/posiciones`          | Lista posiciones con precios y P&L             |
| GET    | `/api/portafolios/{id}/transacciones`       | Historial paginado (page, per_page=50)         |
| POST   | `/api/portafolios/{id}/transacciones`       | Registra transacción (compra/venta/dividendo)  |
| DELETE | `/api/portafolios/{id}/transacciones/{tid}` | Elimina una transacción                        |

### Análisis Técnico (`/api/analisis`)

| Método | Ruta                              | Descripción                                         |
|--------|-----------------------------------|-----------------------------------------------------|
| GET    | `/api/analisis`                   | Indicadores técnicos (params: ticker, periodo, intervalo) |
| GET    | `/api/analisis/tickers`           | Tickers populares por categoría                     |
| GET    | `/api/analisis/indices`           | Tickers por índice bursátil                         |
| POST   | `/api/analisis/portafolio`        | Optimización Markowitz (body: tickers, rf, inversión) |
| GET    | `/api/analisis/patrones/{ticker}` | Patrones chartistas del ticker                      |

### Noticias (`/api/noticias`)

| Método | Ruta                              | Descripción                              |
|--------|------------------------------------|------------------------------------------|
| GET    | `/api/noticias/{ticker}`           | Últimas 50 noticias con score            |
| GET    | `/api/noticias/{ticker}/semaforo`  | Semáforo actual (verde/amarillo/rojo)    |
| POST   | `/api/noticias/actualizar`         | Fuerza actualización inmediata           |

### Wizard (`/api/wizard`)

| Método | Ruta                              | Descripción                                    |
|--------|-----------------------------------|------------------------------------------------|
| POST   | `/api/wizard/perfil`              | Calcula perfil de riesgo                       |
| GET    | `/api/wizard/ciclo`               | Fase actual del ciclo económico                |
| GET    | `/api/wizard/sectores/{fase}`     | Sectores favorecidos por fase                  |
| GET    | `/api/wizard/fundamentales`       | Tickers que pasan filtro fundamental           |
| GET    | `/api/wizard/tecnicos`            | Tickers que pasan filtro técnico               |
| GET    | `/api/wizard/allocation/{perfil}` | Asset allocation recomendado                   |
| GET    | `/api/wizard/pool`                | Pool final de tickers recomendados             |

### Alertas (`/api/alertas`)

| Método | Ruta                          | Descripción                          |
|--------|-------------------------------|--------------------------------------|
| GET    | `/api/alertas`                | Lista todas las alertas              |
| POST   | `/api/alertas`                | Crea nueva alerta                    |
| PUT    | `/api/alertas/{id}`           | Actualiza configuración de alerta    |
| DELETE | `/api/alertas/{id}`           | Elimina alerta                       |
| PATCH  | `/api/alertas/{id}/toggle`    | Activa/desactiva alerta              |
| GET    | `/api/alertas/historial`      | Historial de alertas disparadas      |

### Widgets (`/api/widgets`)

| Método | Ruta                            | Descripción                                |
|--------|---------------------------------|--------------------------------------------|
| GET    | `/api/widgets/config`           | Configuración de layout del usuario        |
| PUT    | `/api/widgets/config`           | Guarda configuración de layout             |
| POST   | `/api/widgets/preset/{nombre}`  | Aplica preset (rapido/completo/portafolio) |

### Fiscal (`/api/fiscal`)

| Método | Ruta                              | Descripción                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/api/fiscal/{portafolio_id}`     | Tabla fiscal completa del portafolio |
| GET    | `/api/fiscal/inpc`                | INPC mensual histórico (caché)       |
| GET    | `/api/fiscal/tipo-cambio`         | Tipo de cambio USD/MXN actual        |

---

## Nota sobre Delay BMV

Los precios de tickers de la Bolsa Mexicana de Valores (sufijo `.MX`, por ejemplo `AMXL.MX`) tienen un **retraso de 15 minutos** debido a las limitaciones de la fuente de datos (Yahoo Finance vía yfinance). Este delay se indica en la interfaz con una etiqueta visible junto al precio de cada ticker mexicano.

Los tickers de NYSE y NASDAQ no tienen este retraso.

---

## Stack Tecnológico

| Capa       | Tecnología                                                    |
|------------|---------------------------------------------------------------|
| Frontend   | React 18, Vite, TailwindCSS, Zustand, React Router v6        |
| Gráficos   | Plotly.js (react-plotly.js), GridStack                        |
| Backend    | Flask, Flask-SocketIO, SQLAlchemy, Flask-Migrate              |
| Datos      | yfinance, Banxico API, RSS feeds                              |
| Base datos | SQLite (preparada para migración a PostgreSQL)                |
| Tiempo real| WebSocket (Flask-SocketIO + eventlet)                         |
| Scheduler  | APScheduler (precios 5 min, noticias 60 min, fiscal diario)  |
| Deploy     | Docker, Docker Compose, Nginx, Gunicorn                       |

---

## Licencia

Proyecto privado. Todos los derechos reservados.

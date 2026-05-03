# Guía de Navegación — Lakshmi Q2

## ¿Qué es Lakshmi Q2?

Lakshmi Q2 es una plataforma web de gestión de portafolios de inversión diseñada para inversionistas mexicanos, desde nivel novato hasta intermedio. Permite crear y administrar portafolios, analizar activos con indicadores técnicos, consultar noticias con análisis de sentimiento, optimizar la distribución de activos con el modelo de Markowitz, y generar reportes en PDF. El nombre "Lakshmi" viene de la diosa hindú de la prosperidad y la fortuna.

---

## Estructura General de la Interfaz

La aplicación tiene un diseño estilo terminal Bloomberg con tema oscuro. La pantalla se divide en:

- **Barra lateral izquierda (Sidebar)**: Menú de navegación principal con 5 secciones.
- **Barra superior (Navbar)**: Muestra el nombre de la sección actual y el tipo de cambio USD/MXN.
- **Área principal**: Contenido de la sección seleccionada.

### Secciones del Menú Principal

1. 💼 **Portafolios** — Gestión de portafolios de inversión.
2. ⚡ **Portafolio Automático** (Wizard) — Generador automático de portafolios basado en tu perfil de riesgo.
3. 🔍 **Búsqueda de Activos** — Explorador y filtro del universo de tickers disponibles.
4. 📈 **Análisis Técnico** — Gráficos e indicadores técnicos detallados por ticker.
5. 📰 **Noticias** — Feed de noticias con semáforo de sentimiento por ticker.

El sidebar se puede colapsar haciendo clic en el botón de flechas para tener más espacio.

---

## 1. Portafolios (💼)

Esta es la sección principal de la aplicación. Aquí gestionas todos tus portafolios de inversión.

### ¿Cómo llego?
Haz clic en "Portafolios" en el menú lateral izquierdo, o navega a la ruta /portafolios.

### ¿Qué veo al entrar?
La pantalla se divide en dos columnas:
- **Columna izquierda**: Lista de tus portafolios con su valor total y ganancia/pérdida.
- **Columna derecha**: Detalle del portafolio seleccionado.

Si es tu primera vez, verás un mensaje "No tienes portafolios aún" y un botón "Cargar Demo" para cargar datos de ejemplo.

### ¿Cómo creo un portafolio?
1. Haz clic en el botón "+" azul junto al título "PORTAFOLIOS" en la columna izquierda.
2. Se abre un formulario donde ingresas: nombre (obligatorio), descripción (opcional), y límite de capital (opcional, en MXN o USD).
3. Haz clic en "Crear".

### ¿Cómo agrego activos a mi portafolio?
Hay varias formas:
- **Botón "Agregar Activo"**: En la parte superior del detalle del portafolio, haz clic en el botón verde "Agregar Activo". Se abre un formulario donde buscas el ticker, ingresas cantidad, precio y fecha.
- **Búsqueda rápida**: Debajo del encabezado hay una barra de búsqueda rápida para buscar y agregar tickers directamente.
- **Desde Búsqueda de Activos**: En la sección de Búsqueda, puedes seleccionar tickers y agregarlos a un portafolio existente.
- **Desde Favoritos**: En el panel de favoritos debajo de la lista de portafolios, cada ticker tiene un botón "Agregar a Portafolio".

### Panel de Favoritos
Debajo de la lista de portafolios hay un panel colapsable llamado "FAVORITOS" con una estrella amarilla. Aquí aparecen los tickers que has marcado como favoritos desde la Búsqueda de Activos o el Wizard. Cada favorito muestra el ticker, nombre de empresa y sector, con botones para agregarlo a un portafolio o eliminarlo de favoritos. Si no tienes favoritos, verás un enlace "Ir al buscador de activos".

### Tarjetas de Resumen
Al seleccionar un portafolio, en la parte superior del detalle verás 4 tarjetas con:
- **Valor Total**: Valor de mercado de todas tus posiciones.
- **P&L Diario**: Ganancia o pérdida del día, en verde si es positiva, en rojo si es negativa.
- **Retorno Proyectado**: Rendimiento anual estimado (aparece después de ejecutar el optimizador).
- **VaR Diario 99%**: Máxima pérdida esperada en un día con 99% de confianza.

También hay un semáforo de riesgo (verde, amarillo o rojo) basado en el Sharpe Ratio.

### Las 4 Pestañas del Portafolio

Al seleccionar un portafolio, verás 4 pestañas en la parte superior del panel de detalle:

#### Pestaña "Posiciones"
Muestra una tabla con todos los activos que tienes en el portafolio: ticker, cantidad de acciones, precio actual, valor de mercado, ganancia/pérdida, y peso porcentual. También muestra una gráfica de dona con la distribución porcentual de tu portafolio.

#### Pestaña "Transacciones"
Historial completo de todas las operaciones: compras, ventas y dividendos, con fecha, cantidad, precio y monto total. Las transacciones se muestran paginadas.

#### Pestaña "Dashboard"
Panel de análisis avanzado de tu portafolio. Requiere al menos 2 posiciones activas. Incluye:

- **Métricas de Riesgo**: 8 tarjetas con Rendimiento Anual, Volatilidad, Sharpe Ratio, Sortino Ratio, Beta vs SPY, Máximo Drawdown, VaR 99% Diario, y TWR (Rendimiento Real Ponderado por Tiempo).
- **Gráfica TWR**: Línea que muestra el rendimiento real de tu portafolio eliminando el efecto de depósitos y retiros.
- **Matriz de Correlación**: Mapa de calor que muestra qué tan correlacionados están tus activos entre sí. Valores cercanos a 1 significan que se mueven juntos, cercanos a -1 que se mueven en direcciones opuestas.
- **Contribución al Riesgo**: Barras horizontales que muestran qué porcentaje del riesgo total aporta cada activo.
- **Crecimiento de $1**: Gráfica que muestra cómo habría crecido un dólar invertido en tu portafolio.
- **Drawdown**: Gráfica que muestra las caídas desde el máximo histórico. Útil para entender los peores momentos de tu portafolio.
- **Proyección Monte Carlo**: Simulación estadística del valor futuro de tu portafolio. Puedes elegir horizonte de 6 meses, 1 año, 2 años o 5 años. Muestra 3 escenarios: optimista, mediana y pesimista.
- **Backtesting**: Simulación histórica de tu portafolio. Puedes elegir período (1, 3 o 5 años) y frecuencia de rebalanceo (mensual, trimestral, anual o sin rebalanceo). Compara tu portafolio contra el índice SPY como benchmark.
- **Resumen Técnico por Activo**: Tabla con el estado técnico de cada activo: precio, RSI, MACD, medias móviles, señales de compra/venta, y tendencia. Cada ticker tiene un enlace "Ver más" que te lleva al Análisis Técnico completo.

#### Pestaña "Optimizador"
Optimización de portafolio usando el modelo de Markowitz (Teoría Moderna de Portafolios). Requiere al menos 2 activos.

1. Lee las instrucciones que explican qué hace el optimizador.
2. Elige un perfil de riesgo:
   - 🟢 **Conservador**: Máximo 25% en un solo activo. Prioriza estabilidad.
   - 🟡 **Moderado**: Sin restricción de peso. Balance entre riesgo y rendimiento.
   - 🔴 **Agresivo**: Permite hasta 50% en un solo activo. Busca máximo rendimiento.
3. La optimización se ejecuta automáticamente al seleccionar el perfil.
4. Verás los resultados: frontera eficiente, pesos óptimos por activo, métricas de riesgo-rendimiento.
5. Si quieres aplicar los pesos sugeridos, haz clic en "Aplicar al portafolio". Esto genera transacciones pendientes de compra/venta para alinear tu portafolio con la distribución óptima.

### Exportar PDF
En el encabezado del detalle del portafolio hay un botón con ícono de descarga. Al hacer clic, genera un reporte PDF completo con las posiciones, transacciones, gráficas del dashboard y métricas de riesgo.

### ¿Cómo edito o elimino un portafolio?
En el encabezado del detalle, junto al botón de PDF, hay un botón de lápiz para editar (nombre, descripción, capital) y un botón de papelera para eliminar. La eliminación pide confirmación porque borra todas las posiciones y transacciones.

---

## 2. Portafolio Automático — Wizard (⚡)

El Wizard es un asistente guiado que te ayuda a construir un portafolio desde cero usando análisis top-down: empieza por tu perfil de riesgo y termina con tickers específicos recomendados.

### ¿Cómo llego?
Haz clic en "Portafolio Automático" en el menú lateral.

### ¿Cómo funciona?

#### Paso 1 — Cuestionario de Perfil de Riesgo
Responde preguntas sobre tu horizonte de inversión, tolerancia a pérdidas y experiencia. El sistema calcula tu perfil: conservador, moderado o agresivo.

#### Paso 2 — Capital Inicial
Ingresa cuánto dinero quieres invertir. Puedes elegir entre USD y MXN.

#### Paso 3 — Generar Portafolio
Haz clic en "Generar Portafolio". Verás una barra de progreso animada con 6 fases:

1. **Perfil de Riesgo**: Muestra tu perfil calculado con puntaje y descripción.
2. **Ciclo Económico**: Identifica la fase actual del ciclo (expansión, pico, recesión, recuperación) con indicadores macroeconómicos.
3. **Rotación Sectorial**: Muestra qué sectores están favorecidos según la fase del ciclo. Por ejemplo, en expansión se favorecen tecnología y consumo discrecional.
4. **Filtro Fundamental**: Filtra tickers por métricas fundamentales: ROE mayor a 15%, ROA mayor a 5%, deuda/capital menor a 1.5, y P/E razonable.
5. **Filtro Técnico**: De los que pasaron el filtro fundamental, selecciona los que tienen precio sobre su media móvil de 200 días y RSI entre 40 y 60.
6. **Asset Allocation**: Distribución recomendada del capital según tu perfil.

#### Resultados
Cada fase se muestra como una sección colapsable con un tooltip explicativo. Al final verás:
- Gráfica de distribución de activos recomendada.
- Tarjetas de los tickers recomendados con precio, SMA 200, RSI, P/E, sector e índices.
- Puedes seleccionar tickers y agregarlos a un portafolio existente o crear uno nuevo.
- También puedes marcar tickers como favoritos.

---

## 3. Búsqueda de Activos (🔍)

Explorador completo del universo de tickers disponibles con filtros avanzados.

### ¿Cómo llego?
Haz clic en "Búsqueda de Activos" en el menú lateral.

### ¿Qué veo al entrar?
- **Panel de filtros** a la izquierda con 5 categorías.
- **Mapa de rendimiento** (colapsable) en la parte superior.
- **Tabla de resultados** con todos los tickers filtrados.

### Filtros Disponibles
- **Tipo de Instrumento**: Acciones, ETFs, Commodities, Bonos, Crypto.
- **Índice**: S&P 500, NASDAQ 100, Dow Jones, IPC (México), etc.
- **Sector**: Tecnología, Salud, Energía, Financiero, etc.
- **Región**: Estados Unidos, México, Europa, Asia.
- **Métricas**: Rangos de RSI (0-100) y P/E Ratio.

Hay un botón especial "Recomendación del ciclo" que automáticamente selecciona los sectores favorecidos según la fase actual del ciclo económico.

### Mapa de Rendimiento
Sección colapsable con 3 vistas:
- **Treemap estilo Finviz**: Rectángulos coloreados por rendimiento (verde positivo, rojo negativo). Puedes elegir índice y período.
- **Sectores**: Mapa de calor de rendimiento por sector.
- **Índices**: Mapa de calor de rendimiento por índice bursátil.

### Tabla de Resultados
Tabla paginada (20 por página) con columnas: favorito (estrella), ticker, nombre, sector, índices, precio actual, cambio porcentual diario, RSI y P/E. Todas las columnas son ordenables.

### Detalle de un Ticker (Drawer)
Al hacer clic en cualquier ticker de la tabla, se abre un panel lateral derecho con:
- Gráfica sparkline de los últimos 30 días.
- Indicadores clave: precio, RSI, SMA 50, SMA 200.
- Semáforo de noticias (verde, amarillo o rojo) con score de sentimiento.
- Últimas 3 noticias del ticker.
- Botones para agregar a favoritos o ir al análisis técnico completo.

### ¿Cómo agrego tickers a favoritos?
Tres formas:
1. Haz clic en la estrella de cualquier fila en la tabla.
2. Selecciona varios tickers con los checkboxes y usa el botón "Agregar a favoritos" en la barra de acciones.
3. Desde el drawer lateral, usa el botón "Agregar a favoritos".

### ¿Cómo agrego tickers a un portafolio?
1. Selecciona uno o más tickers con los checkboxes.
2. Haz clic en "Agregar a portafolio" en la barra de acciones.
3. Elige el portafolio destino en el modal que aparece.

---

## 4. Análisis Técnico (📈)

Herramienta completa de análisis técnico con gráficos interactivos e indicadores.

### ¿Cómo llego?
Haz clic en "Análisis Técnico" en el menú lateral. También puedes llegar desde el resumen técnico del Dashboard de un portafolio (enlace "Ver más"), desde el drawer de Búsqueda, o desde la URL directa con un ticker: /analisis?ticker=AAPL.

### ¿Cómo busco un ticker?
Escribe el símbolo o nombre de la empresa en la barra de búsqueda superior. El autocompletado te muestra hasta 15 resultados. También puedes hacer clic en los tickers de tus portafolios que aparecen en la sección "Mis Portafolios" debajo de la barra de búsqueda.

### Controles de Período e Intervalo
- **Período**: 1 mes, 3 meses, 6 meses, 1 año, 2 años, 5 años.
- **Intervalo**: Diario, semanal, mensual.

### Panel de Interpretaciones
Tarjetas con semáforo de colores que resumen cada indicador:
- **Verde (Compra)**: Señal alcista.
- **Rojo (Venta)**: Señal bajista.
- **Amarillo (Neutral)**: Sin señal clara.

Cada tarjeta tiene un botón "?" que expande una explicación didáctica del indicador.

Indicadores cubiertos: RSI, MACD, Estocástico, Medias Móviles (SMA), Bandas de Bollinger, Divergencia MACD, SAR Parabólico.

### Gráficos Disponibles
Todos los gráficos son interactivos (zoom, pan, hover) y redimensionables:

1. **Velas Japonesas (Candlestick)**: Gráfico principal con precios de apertura, cierre, máximo y mínimo. Superpone indicadores como SMA, EMA, Bandas de Bollinger, SAR Parabólico y niveles de Fibonacci.
2. **MACD**: Línea MACD, línea de señal e histograma. Útil para identificar cambios de tendencia.
3. **RSI (Índice de Fuerza Relativa)**: Oscilador entre 0 y 100. Sobre 70 indica sobrecompra, bajo 30 indica sobreventa.
4. **Estocástico de Lane**: Oscilador con líneas %K y %D. Sobre 80 indica sobrecompra, bajo 20 indica sobreventa.
5. **Volumen**: Barras de volumen de operaciones diarias.

### Paneles Adicionales

- **Stop Loss y Trailing Stop**: Muestra el precio de stop loss sugerido (2.5% debajo del mínimo reciente de 10 velas) y el trailing stop basado en SAR Parabólico. Incluye la distancia porcentual desde el precio actual.
- **Niveles de Fibonacci**: Los 7 niveles de retroceso (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%) con sus precios correspondientes. Útiles como zonas de soporte y resistencia.
- **Patrones Chartistas**: Tabla con patrones detectados automáticamente (Doble Techo, Cabeza y Hombros, Triángulos, Banderas, etc.). Cada patrón muestra fecha, tipo (alcista/bajista), precio, y si fue confirmado por la regla de 3 días.

### Nota sobre tickers mexicanos
Los precios de tickers de la Bolsa Mexicana de Valores (con sufijo .MX, como AMXL.MX) tienen un retraso de 15 minutos. Esto se indica con una etiqueta visible "BMV — Delay 15 min".

---

## 5. Noticias (📰)

Feed de noticias financieras con análisis de sentimiento automático.

### ¿Cómo llego?
Haz clic en "Noticias" en el menú lateral.

### ¿Qué veo al entrar?
- **Panel de Semáforos**: Un semáforo de sentimiento por cada ticker que tienes en tus portafolios.
  - 🟢 **Verde**: Sentimiento positivo. Las noticias recientes son mayormente favorables.
  - 🟡 **Amarillo**: Sentimiento neutral. Noticias mixtas.
  - 🔴 **Rojo**: Sentimiento negativo. Las noticias recientes son mayormente desfavorables.
- **Feed de Noticias**: Lista de noticias ordenadas por fecha, con título, fuente (Yahoo Finance, El Financiero, Expansión), fecha y score de sentimiento.

### ¿Cómo actualizo las noticias?
Haz clic en el botón "Actualizar Noticias" en la esquina superior derecha. Esto fuerza una recarga desde las fuentes RSS.

### ¿Cómo se calcula el sentimiento?
El sistema analiza las palabras clave de cada noticia y asigna un score numérico. El semáforo se calcula con el promedio de las últimas 10 noticias de cada ticker.

---

## Conceptos Clave Explicados

### ¿Qué es el Sharpe Ratio?
Mide el rendimiento ajustado por riesgo. Un Sharpe mayor a 1 es bueno, mayor a 2 es excelente. Se calcula como (rendimiento - tasa libre de riesgo) / volatilidad.

### ¿Qué es el Sortino Ratio?
Similar al Sharpe pero solo penaliza la volatilidad negativa (caídas). Es más justo porque no castiga las subidas fuertes.

### ¿Qué es Beta?
Mide qué tan sensible es tu portafolio al mercado (SPY). Beta = 1 significa que se mueve igual que el mercado. Beta > 1 es más volátil, Beta < 1 es más estable.

### ¿Qué es el VaR (Value at Risk)?
La máxima pérdida esperada en un día con 99% de confianza. Si tu VaR es -2%, significa que solo 1 de cada 100 días perderías más de 2%.

### ¿Qué es el Max Drawdown?
La mayor caída desde un máximo histórico hasta un mínimo posterior. Mide el peor escenario que ha vivido tu portafolio.

### ¿Qué es TWR (Time-Weighted Return)?
El rendimiento real de tu portafolio eliminando el efecto de depósitos y retiros. Es la forma más justa de medir qué tan bien han rendido tus inversiones.

### ¿Qué es la optimización de Markowitz?
Modelo matemático que encuentra la mejor combinación de activos para maximizar el rendimiento esperado dado un nivel de riesgo, o minimizar el riesgo dado un rendimiento objetivo. Usa la correlación entre activos para encontrar la diversificación óptima.

### ¿Qué es Monte Carlo?
Simulación estadística que genera miles de escenarios posibles del valor futuro de tu portafolio, basándose en el rendimiento y volatilidad históricos. Muestra un rango de resultados probables.

### ¿Qué es el Backtesting?
Simulación que aplica tu estrategia actual (pesos del portafolio) a datos históricos para ver cómo habría funcionado en el pasado. Compara contra un benchmark (SPY) para evaluar si tu estrategia agrega valor.

### ¿Qué son los niveles de Fibonacci?
Niveles horizontales de precio basados en la secuencia de Fibonacci (23.6%, 38.2%, 50%, 61.8%, 78.6%). Se usan como zonas probables de soporte (donde el precio podría dejar de caer) y resistencia (donde podría dejar de subir).

### ¿Qué es la regla de 3 días?
Metodología que requiere que el precio cierre en la dirección esperada durante 3 sesiones consecutivas para confirmar un patrón chartista. Reduce las señales falsas.

### ¿Qué es el RSI?
El Índice de Fuerza Relativa mide la velocidad y magnitud de los cambios de precio. Va de 0 a 100. Sobre 70 indica sobrecompra (posible caída), bajo 30 indica sobreventa (posible rebote).

### ¿Qué es el MACD?
El MACD (Moving Average Convergence Divergence) muestra la relación entre dos medias móviles exponenciales. Cuando la línea MACD cruza por encima de la línea de señal, es una señal alcista. Cuando cruza por debajo, es bajista.

### ¿Qué son las Bandas de Bollinger?
Tres líneas: una media móvil central y dos bandas a 2 desviaciones estándar arriba y abajo. Cuando el precio toca la banda superior, puede estar sobrecomprado. Cuando toca la inferior, puede estar sobrevendido. Bandas estrechas indican baja volatilidad y posible movimiento fuerte próximo.

### ¿Qué es el Estocástico de Lane?
Oscilador que compara el precio de cierre con el rango de precios de un período. Va de 0 a 100. Sobre 80 indica sobrecompra, bajo 20 indica sobreventa. Las líneas %K y %D generan señales cuando se cruzan.

---

## Flujos Comunes — Paso a Paso

### "Quiero empezar desde cero"
1. Ve a **Portafolio Automático** (Wizard).
2. Responde el cuestionario de perfil de riesgo.
3. Ingresa tu capital.
4. Haz clic en "Generar Portafolio".
5. Revisa los tickers recomendados.
6. Selecciona los que te gusten y crea un nuevo portafolio.

### "Quiero analizar un ticker antes de comprarlo"
1. Ve a **Búsqueda de Activos**.
2. Filtra por sector, índice o región.
3. Haz clic en el ticker para ver el drawer con resumen rápido.
4. Haz clic en "Ir a análisis completo" para ver todos los indicadores técnicos.
5. Revisa las interpretaciones (semáforo verde/amarillo/rojo por indicador).
6. Consulta los patrones chartistas y niveles de Fibonacci.

### "Quiero saber cómo va mi portafolio"
1. Ve a **Portafolios**.
2. Selecciona tu portafolio en la lista izquierda.
3. Revisa las tarjetas de resumen (valor, P&L, VaR).
4. Haz clic en la pestaña **Dashboard** para ver métricas avanzadas.
5. Revisa el Sharpe Ratio, la correlación entre activos, y el drawdown.
6. Usa Monte Carlo para ver proyecciones futuras.
7. Ejecuta un Backtest para ver cómo habría funcionado históricamente.

### "Quiero optimizar mi portafolio"
1. Ve a **Portafolios** y selecciona tu portafolio.
2. Haz clic en la pestaña **Optimizador**.
3. Elige tu perfil de riesgo (Conservador, Moderado o Agresivo).
4. Revisa los pesos óptimos sugeridos y la frontera eficiente.
5. Si estás de acuerdo, haz clic en "Aplicar al portafolio" para generar las transacciones de rebalanceo.

### "Quiero ver las noticias de mis activos"
1. Ve a **Noticias**.
2. Revisa los semáforos: verde es bueno, rojo es preocupante.
3. Lee las noticias individuales para entender el contexto.
4. Haz clic en "Actualizar Noticias" si quieres datos frescos.

### "Quiero exportar un reporte"
1. Ve a **Portafolios** y selecciona tu portafolio.
2. Haz clic en el botón de descarga (ícono de documento) en el encabezado.
3. Se genera un PDF con posiciones, transacciones, gráficas y métricas.

---

## Preguntas Frecuentes

### ¿Por qué algunos precios tienen retraso?
Los tickers de la Bolsa Mexicana de Valores (con sufijo .MX) tienen 15 minutos de retraso por limitaciones de la fuente de datos. Los tickers de NYSE y NASDAQ son en tiempo real.

### ¿Qué significa el semáforo de riesgo en el portafolio?
Es un indicador basado en el Sharpe Ratio: verde si es mayor a 1 (buen rendimiento ajustado por riesgo), amarillo si está entre 0.5 y 1, rojo si es menor a 0.5.

### ¿Por qué el Dashboard dice que necesito al menos 2 posiciones?
Las métricas de correlación, diversificación y optimización requieren al menos 2 activos diferentes para poder calcular relaciones entre ellos.

### ¿Qué pasa si aplico la optimización?
Se generan transacciones pendientes (compras y ventas) para ajustar los pesos de tu portafolio a los pesos óptimos sugeridos. Puedes confirmarlas o cancelarlas en la pestaña de Transacciones.

### ¿De dónde vienen las noticias?
De tres fuentes RSS: Yahoo Finance, El Financiero y Expansión. Se actualizan automáticamente cada 60 minutos.

### ¿Qué es la regla de 3 días en los patrones?
Es una metodología del libro "Invierta con Éxito en la Bolsa de Valores" de Leopoldo Sánchez Cantú. Requiere que después de detectar un patrón chartista, el precio confirme la dirección esperada cerrando en esa dirección durante 3 sesiones consecutivas.

import { useEffect, useRef, useState, useCallback } from 'react';
import Spinner from '../common/Spinner';
import ErrorMessage from '../common/ErrorMessage';
import RiskCards from './RiskCards';
import EfficientFrontierChart from './EfficientFrontierChart';
import AllocationDonut from './AllocationDonut';
import CorrelationHeatmap from './CorrelationHeatmap';
import WeightBars from './WeightBars';
import GrowthChart from './GrowthChart';
import DrawdownChart from './DrawdownChart';
import ExecutionTable from './ExecutionTable';

/**
 * Contenedor principal que organiza todos los gráficos y métricas
 * del optimizador en un layout responsivo con paneles Bloomberg.
 *
 * @param {object} props
 * @param {object} props.resultado - Respuesta completa del API /api/optimizador
 * @param {boolean} props.cargando - Estado de carga
 * @param {string} props.error - Mensaje de error
 * @param {function} [props.onReintentar] - Callback para reintentar la optimización
 *
 * Requisitos cubiertos: 7.5, 7.6, 6.8, 7.8
 */
export default function OptimizerResults({ resultado, cargando, error, onReintentar, portafolioId }) {
  const containerRef = useRef(null);

  // Resize Plotly charts when container resizes
  useEffect(() => {
    if (!containerRef.current || !resultado) return;

    const observer = new ResizeObserver(() => {
      // Find all Plotly plot divs and trigger resize
      const plots = containerRef.current?.querySelectorAll('.js-plotly-plot');
      if (plots && window.Plotly) {
        plots.forEach((plot) => {
          try {
            window.Plotly.Plots.resize(plot);
          } catch {
            // Plotly may not be ready yet
          }
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resultado]);

  // Estado de carga
  if (cargando) {
    return (
      <div aria-live="polite" aria-busy="true">
        <Spinner
          mensaje="Ejecutando optimización Markowitz... Esto puede tomar unos segundos"
          size="lg"
        />
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <ErrorMessage
        mensaje={error}
        onReintentar={onReintentar}
      />
    );
  }

  // Sin resultados
  if (!resultado) {
    return (
      <div
        className="flex items-center justify-center py-16 text-bloomberg-text-muted text-sm"
        aria-label="Sin resultados de optimización"
      >
        <p>Sin resultados. Ejecuta una optimización para ver el análisis.</p>
      </div>
    );
  }

  const {
    tickers,
    tickers_excluidos,
    restricciones,
    rf_utilizada,
    estadisticas,
    correlacion,
    max_sharpe,
    min_varianza,
    frontera,
    historico,
    pesos_actuales,
  } = resultado;

  return (
    <div ref={containerRef} className="space-y-6" aria-label="Resultados de optimización Markowitz">
      {/* Tickers excluidos */}
      {tickers_excluidos && tickers_excluidos.length > 0 && (
        <div
          className="p-3 rounded-lg bg-bloomberg-yellow/10 border border-bloomberg-yellow/20
                     text-sm text-bloomberg-yellow"
          role="alert"
        >
          Tickers excluidos por datos insuficientes: {tickers_excluidos.join(', ')}
        </div>
      )}

      {/* 1. RiskCards — métricas principales arriba */}
      <Panel titulo="Métricas de Riesgo">
        <RiskCards
          maxSharpe={max_sharpe}
          minVarianza={min_varianza}
          inversion={resultado.inversion || max_sharpe?.monto
            ? Object.values(max_sharpe.monto || {}).reduce((s, v) => s + v, 0)
            : null}
          rf={rf_utilizada}
          restricciones={restricciones}
        />
      </Panel>

      {/* 2. EfficientFrontierChart + AllocationDonut en fila */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel titulo="Frontera Eficiente">
          <EfficientFrontierChart
            frontera={frontera}
            maxSharpe={{
              rendimiento: max_sharpe?.rendimiento,
              riesgo: max_sharpe?.riesgo,
              sharpe: max_sharpe?.sharpe,
            }}
            minVarianza={{
              rendimiento: min_varianza?.rendimiento,
              riesgo: min_varianza?.riesgo,
              sharpe: min_varianza?.sharpe,
            }}
            rf={rf_utilizada}
          />
        </Panel>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-6">
          <Panel titulo="Asignación Max Sharpe">
            <AllocationDonut pesos={max_sharpe?.pesos} titulo="Max Sharpe" />
          </Panel>
          <Panel titulo="Asignación Min Varianza">
            <AllocationDonut pesos={min_varianza?.pesos} titulo="Min Varianza" />
          </Panel>
        </div>
      </div>

      {/* 3. CorrelationHeatmap + WeightBars */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel titulo="Matriz de Correlación">
          <CorrelationHeatmap correlacion={correlacion} tickers={tickers} />
        </Panel>
        <Panel titulo="Comparación de Pesos">
          <WeightBars
            maxSharpe={max_sharpe?.pesos}
            minVarianza={min_varianza?.pesos}
            pesosActuales={pesos_actuales}
          />
        </Panel>
      </div>

      {/* 4. GrowthChart + DrawdownChart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel titulo="Crecimiento Histórico ($1 invertido)">
          <GrowthChart historico={historico} />
        </Panel>
        <Panel titulo="Drawdown Histórico">
          <DrawdownChart historico={historico} />
        </Panel>
      </div>

      {/* 5. ExecutionTable — tabla de asignación abajo */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel titulo="Orden de Ejecución — Max Sharpe">
          <ExecutionTable
            portafolio={max_sharpe}
            estadisticas={estadisticas}
            restricciones={restricciones}
            rf={rf_utilizada}
          />
        </Panel>
        <Panel titulo="Orden de Ejecución — Min Varianza">
          <ExecutionTable
            portafolio={min_varianza}
            estadisticas={estadisticas}
            restricciones={restricciones}
            rf={rf_utilizada}
          />
        </Panel>
      </div>
    </div>
  );
}

/**
 * Panel Bloomberg-styled para agrupar secciones de resultados.
 */
function Panel({ titulo, children }) {
  return (
    <section
      className="bg-bloomberg-panel border border-white/5 rounded-xl p-5"
      aria-label={titulo}
    >
      {titulo && (
        <h3 className="text-xs font-bold uppercase tracking-widest text-bloomberg-text-muted mb-4">
          {titulo}
        </h3>
      )}
      {children}
    </section>
  );
}

import { useEffect, useState, useCallback } from 'react';
import useStore from '../store';

import TaxTable from '../components/fiscal/TaxTable';
import InpcAdjustment from '../components/fiscal/InpcAdjustment';
import CurrencyConverter from '../components/fiscal/CurrencyConverter';
import Spinner from '../components/common/Spinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { formatFecha } from '../utils/formatters';

/**
 * Página completa del módulo fiscal México.
 *
 * Integra TaxTable, InpcAdjustment y CurrencyConverter.
 * Muestra fecha de última actualización de Banxico.
 *
 * Requisitos cubiertos: 9.1–9.7, 12.1–12.7
 */

const API_BASE = '/api';

export default function Fiscal() {
  const portafolios = useStore((s) => s.portafolios);
  const fetchPortafolios = useStore((s) => s.fetchPortafolios);

  const [portafolioId, setPortafolioId] = useState(null);
  const [tablaFiscal, setTablaFiscal] = useState(null);
  const [tipoCambio, setTipoCambio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [error, setError] = useState(null);

  // ─── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        await fetchPortafolios();

        // Obtener tipo de cambio
        const tcRes = await fetch(`${API_BASE}/fiscal/tipo-cambio`);
        if (tcRes.ok) {
          const tcData = await tcRes.json();
          setTipoCambio(tcData);
        }
      } catch (err) {
        setError(err.message || 'Error al cargar datos fiscales');
      } finally {
        setLoading(false);
      }
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seleccionar primer portafolio por defecto
  useEffect(() => {
    if (portafolios.length > 0 && !portafolioId) {
      setPortafolioId(portafolios[0].id);
    }
  }, [portafolios, portafolioId]);

  // ─── Cargar tabla fiscal al cambiar portafolio ────────────────
  const cargarTablaFiscal = useCallback(async (id) => {
    if (!id) return;
    setLoadingTabla(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/fiscal/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al obtener tabla fiscal');
      }
      const data = await res.json();
      setTablaFiscal(data);
    } catch (err) {
      setError(err.message);
      setTablaFiscal(null);
    } finally {
      setLoadingTabla(false);
    }
  }, []);

  useEffect(() => {
    if (portafolioId) {
      cargarTablaFiscal(portafolioId);
    }
  }, [portafolioId, cargarTablaFiscal]);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleCambiarPortafolio = (e) => {
    const id = parseInt(e.target.value, 10);
    setPortafolioId(id);
  };

  // ─── Render ───────────────────────────────────────────────────
  if (loading) {
    return <Spinner mensaje="Cargando módulo fiscal..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Error global */}
      {error && (
        <ErrorMessage
          mensaje={error}
          onReintentar={() => {
            setError(null);
            if (portafolioId) cargarTablaFiscal(portafolioId);
          }}
        />
      )}

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-bloomberg-text">
            Módulo Fiscal México
          </h1>
          <p className="text-sm text-bloomberg-text-muted mt-1">
            ISR estimado, ajuste INPC y conversión USD/MXN.
          </p>
        </div>

        {/* Indicador de última actualización Banxico */}
        {tipoCambio?.updated_at && (
          <div className="text-xs text-bloomberg-text-muted bg-bloomberg-panel px-3 py-2 rounded-lg">
            <span className="inline-block w-2 h-2 rounded-full bg-bloomberg-green mr-2" />
            Banxico actualizado: {formatFecha(tipoCambio.updated_at, true)}
            {tipoCambio.fuente && (
              <span className="ml-1 text-bloomberg-accent">
                ({tipoCambio.fuente === 'banxico_api' ? 'API' :
                  tipoCambio.fuente === 'cache' ? 'Caché' : 'Estático'})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Selector de portafolio */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="fiscal-portafolio"
          className="text-sm text-bloomberg-text-muted"
        >
          Portafolio:
        </label>
        <select
          id="fiscal-portafolio"
          value={portafolioId || ''}
          onChange={handleCambiarPortafolio}
          className="px-3 py-2 bg-bloomberg-panel border border-bloomberg-bg
                     rounded-lg text-bloomberg-text text-sm
                     focus:outline-none focus:ring-1 focus:ring-bloomberg-accent"
          aria-label="Seleccionar portafolio para análisis fiscal"
        >
          {portafolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Contenido principal */}
      {loadingTabla ? (
        <Spinner mensaje="Calculando datos fiscales..." />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Tabla fiscal — ocupa 2 columnas */}
          <div className="xl:col-span-2 space-y-6">
            <TaxTable
              posiciones={tablaFiscal?.posiciones || []}
              resumen={tablaFiscal?.resumen || null}
            />

            {/* Ajuste INPC */}
            <InpcAdjustment
              posiciones={tablaFiscal?.posiciones || []}
            />
          </div>

          {/* Panel lateral — conversor */}
          <div className="space-y-6">
            <CurrencyConverter tipoCambio={tipoCambio} />

            {/* Resumen fiscal */}
            {tablaFiscal?.resumen && (
              <div className="bg-bloomberg-panel rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-bloomberg-text">
                  Resumen Fiscal
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-bloomberg-text-muted">Ganancia Bruta Total</span>
                    <span className={
                      tablaFiscal.resumen.total_ganancia_bruta >= 0
                        ? 'text-bloomberg-green'
                        : 'text-bloomberg-red'
                    }>
                      ${tablaFiscal.resumen.total_ganancia_bruta?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bloomberg-text-muted">ISR Estimado (10%)</span>
                    <span className="text-bloomberg-yellow">
                      ${tablaFiscal.resumen.total_isr_estimado?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-bloomberg-bg pt-2">
                    <span className="text-bloomberg-text font-medium">Ganancia Neta</span>
                    <span className={`font-medium ${
                      tablaFiscal.resumen.total_ganancia_neta >= 0
                        ? 'text-bloomberg-green'
                        : 'text-bloomberg-red'
                    }`}>
                      ${tablaFiscal.resumen.total_ganancia_neta?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-bloomberg-bg pt-2">
                    <span className="text-bloomberg-text font-medium">
                      Ganancia Real (MXN)
                    </span>
                    <span className={`font-medium ${
                      tablaFiscal.resumen.total_ganancia_real_mxn >= 0
                        ? 'text-bloomberg-green'
                        : 'text-bloomberg-red'
                    }`}>
                      ${tablaFiscal.resumen.total_ganancia_real_mxn?.toFixed(2)} MXN
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Info tipo de cambio */}
            {tablaFiscal?.tipo_cambio && (
              <div className="bg-bloomberg-panel rounded-lg p-4">
                <h3 className="text-sm font-semibold text-bloomberg-text mb-2">
                  Tipo de Cambio Aplicado
                </h3>
                <div className="text-center">
                  <span className="text-2xl font-bold text-bloomberg-accent">
                    ${tablaFiscal.tipo_cambio.usd_mxn?.toFixed(4)}
                  </span>
                  <p className="text-xs text-bloomberg-text-muted mt-1">
                    MXN por 1 USD
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <div className="bg-bloomberg-panel/50 rounded-lg p-4 text-xs text-bloomberg-text-muted">
        <p>
          <strong className="text-bloomberg-text">Nota:</strong> Los cálculos fiscales son estimados
          con fines informativos. El ISR se calcula al 10% sobre ganancias de capital realizadas.
          El ajuste por INPC utiliza datos del Banco de México. Consulte a un asesor fiscal para
          su declaración oficial.
        </p>
      </div>
    </div>
  );
}

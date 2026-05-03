/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Búsqueda de Activos
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import FilterPanel from '../components/search/FilterPanel';
import SearchResultsTable from '../components/search/SearchResultsTable';
import HeatmapChart from '../components/search/HeatmapChart';
import TickerDrawer from '../components/search/TickerDrawer';
import Modal from '../components/common/Modal';

// ─── Helpers ────────────────────────────────────────────────────

const TICKERS_POR_PAGINA = 20;

// ─── Filtros iniciales ──────────────────────────────────────────

const FILTROS_INICIALES = {
  tipos: [],
  indices: [],
  sectores: [],
  regiones: [],
  rsiMin: '',
  rsiMax: '',
  peMin: '',
  peMax: '',
};

// ─── Componente principal ───────────────────────────────────────

export default function Busqueda() {
  const navigate = useNavigate();
  const toggleFavorito = useStore((s) => s.toggleFavorito);
  const favoritos = useStore((s) => s.favoritos);
  const portafolios = useStore((s) => s.portafolios);
  const fetchPortafolios = useStore((s) => s.fetchPortafolios);
  const registrarTransaccion = useStore((s) => s.registrarTransaccion);

  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [modalPortafolio, setModalPortafolio] = useState(false);
  const [cargandoPortafolios, setCargandoPortafolios] = useState(false);
  const [paginaActual, setPaginaActual] = useState(0);
  const [datosEnVivo, setDatosEnVivo] = useState({});
  const [cargandoDatos, setCargandoDatos] = useState(false);

  // Universe loaded from backend API
  const [universo, setUniverso] = useState([]);
  const [cargandoUniverso, setCargandoUniverso] = useState(true);
  const [filtrosDisponibles, setFiltrosDisponibles] = useState({ tipos: [], sectores: [], regiones: [], indices: [] });

  // Drawer state
  const [drawerTicker, setDrawerTicker] = useState(null);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  const handleTickerClick = useCallback((ticker) => {
    setDrawerTicker(ticker);
    setDrawerAbierto(true);
  }, []);

  // Fetch universe from backend API on mount
  useEffect(() => {
    let cancelado = false;
    setCargandoUniverso(true);

    fetch('/api/busqueda/universo')
      .then(res => res.json())
      .then(data => {
        if (cancelado) return;
        const tickers = (data.tickers || []).map(t => ({
          ticker: t.ticker,
          nombre: t.nombre || t.ticker,
          sector: t.sector || 'Sin clasificar',
          indices: t.indices || [],
          region: t.region || 'EE.UU.',
          tipo: t.tipo || 'accion',
        }));
        setUniverso(tickers);
        setFiltrosDisponibles(data.filtros_disponibles || { tipos: [], sectores: [], regiones: [], indices: [] });
      })
      .catch(err => {
        console.error('Error cargando universo:', err);
      })
      .finally(() => {
        if (!cancelado) setCargandoUniverso(false);
      });

    return () => { cancelado = true; };
  }, []);

  // Aplicar filtros en cascada (sin filtros de métricas primero)
  const datosFiltradosBase = useMemo(() => {
    let resultado = universo;

    if (filtros.tipos.length > 0) {
      resultado = resultado.filter((item) => filtros.tipos.includes(item.tipo));
    }

    if (filtros.indices.length > 0) {
      resultado = resultado.filter((item) =>
        item.indices.some((idx) => filtros.indices.includes(idx))
      );
    }

    if (filtros.sectores.length > 0) {
      resultado = resultado.filter((item) => {
        const sectorPrincipal = item.sector.split(' / ')[0];
        return filtros.sectores.includes(sectorPrincipal);
      });
    }

    if (filtros.regiones.length > 0) {
      resultado = resultado.filter((item) =>
        filtros.regiones.includes(item.region)
      );
    }

    return resultado;
  }, [universo, filtros.tipos, filtros.indices, filtros.sectores, filtros.regiones]);

  // Aplicar filtros de métricas con datos en vivo
  const datosFiltrados = useMemo(() => {
    let resultado = datosFiltradosBase;

    const rsiMin = filtros.rsiMin !== '' ? parseFloat(filtros.rsiMin) : null;
    const rsiMax = filtros.rsiMax !== '' ? parseFloat(filtros.rsiMax) : null;
    const peMin = filtros.peMin !== '' ? parseFloat(filtros.peMin) : null;
    const peMax = filtros.peMax !== '' ? parseFloat(filtros.peMax) : null;

    const hayFiltroMetricas = rsiMin !== null || rsiMax !== null || peMin !== null || peMax !== null;

    if (hayFiltroMetricas) {
      resultado = resultado.filter((item) => {
        const live = datosEnVivo[item.ticker];
        if (!live) return false; // Si no hay datos en vivo, excluir cuando hay filtros de métricas

        if (rsiMin !== null && (live.rsi == null || live.rsi < rsiMin)) return false;
        if (rsiMax !== null && (live.rsi == null || live.rsi > rsiMax)) return false;
        if (peMin !== null && (live.pe == null || live.pe < peMin)) return false;
        if (peMax !== null && (live.pe == null || live.pe > peMax)) return false;

        return true;
      });
    }

    return resultado;
  }, [datosFiltradosBase, filtros.rsiMin, filtros.rsiMax, filtros.peMin, filtros.peMax, datosEnVivo]);

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(datosFiltrados.length / TICKERS_POR_PAGINA));
  const datosPagina = useMemo(() => {
    const inicio = paginaActual * TICKERS_POR_PAGINA;
    return datosFiltrados.slice(inicio, inicio + TICKERS_POR_PAGINA);
  }, [datosFiltrados, paginaActual]);

  // Reset página al cambiar filtros
  useEffect(() => {
    setPaginaActual(0);
  }, [filtros]);

  // Enriquecer tickers de la página visible
  useEffect(() => {
    const tickers = datosPagina.map((d) => d.ticker);
    if (tickers.length === 0) return;

    // Solo enriquecer tickers que no tenemos aún
    const tickersSinDatos = tickers.filter((t) => !datosEnVivo[t]);
    if (tickersSinDatos.length === 0) return;

    let cancelado = false;
    setCargandoDatos(true);

    // Dividir en lotes de 10 para no sobrecargar el backend
    const BATCH_SIZE = 10;
    const lotes = [];
    for (let i = 0; i < tickersSinDatos.length; i += BATCH_SIZE) {
      lotes.push(tickersSinDatos.slice(i, i + BATCH_SIZE));
    }

    async function enriquecerLotes() {
      for (const lote of lotes) {
        if (cancelado) return;
        try {
          const res = await fetch(`/api/busqueda/enriquecer?tickers=${lote.join(',')}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (cancelado) return;
          const nuevos = {};
          for (const item of data) {
            nuevos[item.ticker] = item;
          }
          setDatosEnVivo((prev) => ({ ...prev, ...nuevos }));
        } catch (err) {
          if (!cancelado) {
            console.error('Error enriqueciendo lote:', err);
          }
        }
      }
    }

    enriquecerLotes().finally(() => {
      if (!cancelado) setCargandoDatos(false);
    });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datosPagina]);

  // Conteos para el panel de filtros
  const conteos = useMemo(() => {
    const indicesCount = {};
    const sectoresCount = {};
    const regionesCount = {};
    const tiposCount = {};

    universo.forEach((item) => {
      item.indices.forEach((idx) => {
        indicesCount[idx] = (indicesCount[idx] || 0) + 1;
      });
      const sectorPrincipal = item.sector.split(' / ')[0];
      sectoresCount[sectorPrincipal] = (sectoresCount[sectorPrincipal] || 0) + 1;
      regionesCount[item.region] = (regionesCount[item.region] || 0) + 1;
      tiposCount[item.tipo] = (tiposCount[item.tipo] || 0) + 1;
    });

    return { indices: indicesCount, sectores: sectoresCount, regiones: regionesCount, tipos: tiposCount };
  }, [universo]);

  // ─── Selección ────────────────────────────────────────────────

  const toggleSeleccion = useCallback((ticker) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        next.add(ticker);
      }
      return next;
    });
  }, []);

  const toggleTodos = useCallback(() => {
    setSeleccionados((prev) => {
      const todosVisibles = datosPagina.map((d) => d.ticker);
      const todosYaSeleccionados = todosVisibles.every((t) => prev.has(t));
      if (todosYaSeleccionados) {
        const next = new Set(prev);
        todosVisibles.forEach((t) => next.delete(t));
        return next;
      }
      const next = new Set(prev);
      todosVisibles.forEach((t) => next.add(t));
      return next;
    });
  }, [datosPagina]);

  // ─── Acciones ─────────────────────────────────────────────────

  const handleAgregarFavoritos = () => {
    seleccionados.forEach((ticker) => {
      if (!favoritos.includes(ticker)) {
        toggleFavorito(ticker);
      }
    });
    setSeleccionados(new Set());
  };

  const handleAnalizar = () => {
    const ticker = [...seleccionados][0];
    if (ticker) {
      navigate(`/analisis?ticker=${encodeURIComponent(ticker)}`);
    }
  };

  const handleAbrirModalPortafolio = async () => {
    setCargandoPortafolios(true);
    try {
      await fetchPortafolios();
    } catch {
      // Si falla, usamos los que ya estén en el store
    }
    setCargandoPortafolios(false);
    setModalPortafolio(true);
  };

  const handleAgregarAPortafolio = async (portafolioId) => {
    for (const ticker of seleccionados) {
      try {
        await registrarTransaccion(portafolioId, {
          ticker,
          tipo: 'compra',
          cantidad: 1,
          precio: 0,
          fecha: new Date().toISOString().split('T')[0],
          notas: 'Agregado desde Búsqueda de Activos',
        });
      } catch {
        // Silently continue if one fails
      }
    }
    setModalPortafolio(false);
    setSeleccionados(new Set());
  };

  const limpiarFiltros = () => {
    setFiltros(FILTROS_INICIALES);
    setDatosEnVivo({});
  };

  const handleCambiarPagina = (nuevaPagina) => {
    setPaginaActual(nuevaPagina);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Encabezado */}
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-bloomberg-text">
            Búsqueda de Activos
          </h1>
          {favoritos.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                             font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
              ★ {favoritos.length} favorito{favoritos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-sm text-bloomberg-text-muted mt-1">
          Explora y filtra el universo de tickers disponibles por índice, sector, región y métricas.
        </p>
      </header>

      {/* Loading spinner while universe is loading */}
      {cargandoUniverso ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-bloomberg-accent/30 border-t-bloomberg-accent
                            rounded-full animate-spin" />
            <span className="text-sm text-bloomberg-text-muted">Cargando universo de activos…</span>
          </div>
        </div>
      ) : (
        <>
          {/* Barra de acciones (visible cuando hay seleccionados) */}
      {seleccionados.size > 0 && (
        <div
          className="mx-6 mb-3 flex items-center gap-2 px-4 py-2.5 rounded-lg
                     bg-bloomberg-accent/10 border border-bloomberg-accent/20"
          role="toolbar"
          aria-label="Acciones sobre tickers seleccionados"
        >
          <span className="text-xs text-bloomberg-accent font-medium mr-2">
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </span>

          <button
            type="button"
            onClick={handleAbrirModalPortafolio}
            className="px-3 py-1.5 text-xs font-medium rounded-lg
                       bg-bloomberg-accent text-white hover:bg-bloomberg-accent/80
                       transition-colors"
            aria-label="Agregar tickers seleccionados a portafolio"
          >
            Agregar a portafolio
          </button>

          <button
            type="button"
            onClick={handleAgregarFavoritos}
            className="px-3 py-1.5 text-xs font-medium rounded-lg
                       bg-bloomberg-yellow/15 text-bloomberg-yellow border border-bloomberg-yellow/30
                       hover:bg-bloomberg-yellow/25 transition-colors"
            aria-label="Agregar tickers seleccionados a favoritos"
          >
            ★ Agregar a favoritos
          </button>

          {seleccionados.size === 1 && (
            <button
              type="button"
              onClick={handleAnalizar}
              className="px-3 py-1.5 text-xs font-medium rounded-lg
                         bg-bloomberg-green/15 text-bloomberg-green border border-bloomberg-green/30
                         hover:bg-bloomberg-green/25 transition-colors"
              aria-label="Analizar ticker seleccionado"
            >
              Analizar
            </button>
          )}

          <button
            type="button"
            onClick={() => setSeleccionados(new Set())}
            className="ml-auto px-2 py-1 text-xs text-bloomberg-text-muted
                       hover:text-bloomberg-text transition-colors"
            aria-label="Deseleccionar todos"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Heatmap de rendimiento (colapsable) */}
      <HeatmapChart />

      {/* Contenido principal: filtros + tabla */}
      <div className="flex-1 flex gap-4 px-6 pb-6 min-h-0">
        <FilterPanel
          filtros={filtros}
          onFiltrosChange={setFiltros}
          onLimpiar={limpiarFiltros}
          conteos={conteos}
          filtrosDisponibles={filtrosDisponibles}
        />
        <SearchResultsTable
          datos={datosPagina}
          seleccionados={seleccionados}
          onToggleSeleccion={toggleSeleccion}
          onToggleTodos={toggleTodos}
          datosEnVivo={datosEnVivo}
          cargandoDatos={cargandoDatos}
          paginaActual={paginaActual}
          totalPaginas={totalPaginas}
          onCambiarPagina={handleCambiarPagina}
          onTickerClick={handleTickerClick}
        />
      </div>
        </>
      )}

      {/* Modal: Seleccionar portafolio destino */}
      <Modal
        abierto={modalPortafolio}
        onCerrar={() => setModalPortafolio(false)}
        titulo="Agregar a portafolio"
      >
        <div className="space-y-3">
          <p className="text-sm text-bloomberg-text-muted">
            Selecciona el portafolio destino para {seleccionados.size} ticker{seleccionados.size !== 1 ? 's' : ''}:
          </p>

          {cargandoPortafolios ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-bloomberg-accent/30 border-t-bloomberg-accent
                              rounded-full animate-spin" />
            </div>
          ) : portafolios.length === 0 ? (
            <p className="text-sm text-bloomberg-text-muted text-center py-6">
              No hay portafolios creados. Crea uno primero en la sección de Portafolios.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {portafolios.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAgregarAPortafolio(p.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg
                             bg-bloomberg-bg border border-white/5 hover:border-bloomberg-accent/30
                             hover:bg-bloomberg-accent/5 transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-bloomberg-text">
                      {p.nombre}
                    </span>
                    {p.descripcion && (
                      <span className="block text-xs text-bloomberg-text-muted mt-0.5">
                        {p.descripcion}
                      </span>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-bloomberg-text-muted" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setModalPortafolio(false)}
              className="px-4 py-2 text-xs font-medium text-bloomberg-text-muted
                         hover:text-bloomberg-text transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Drawer de detalle de ticker */}
      <TickerDrawer
        ticker={drawerTicker}
        abierto={drawerAbierto}
        onCerrar={() => setDrawerAbierto(false)}
      />
    </div>
  );
}

/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Layout
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useStore from '../../store';
import AlertBadge from '../alerts/AlertBadge';

/* ── Dropdown de favoritos ─────────────────────────────────────── */
function FavoritosDropdown({ favoritos, onQuitar, onCerrar }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onCerrar(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onCerrar]);

  return (
    <div ref={ref}
      className="absolute right-0 top-full mt-2 w-64 rounded-xl
                 border border-white/10 shadow-2xl z-50"
      style={{ background: 'rgba(10, 14, 12, 0.95)', backdropFilter: 'blur(16px)' }}
      role="menu" aria-label="Lista de favoritos"
    >
      <div className="px-4 py-2.5 border-b border-white/5">
        <span className="text-[10px] font-light uppercase tracking-[0.2em] text-bloomberg-text-muted">
          Favoritos
        </span>
      </div>
      {favoritos.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs text-bloomberg-text-muted font-light">
          Sin favoritos aún
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto py-1">
          {favoritos.map((ticker) => (
            <div key={ticker}
              className="flex items-center justify-between px-4 py-2
                         hover:bg-white/[0.04] transition-colors"
              role="menuitem"
            >
              <span className="text-sm font-mono text-bloomberg-accent">{ticker}</span>
              <button type="button" onClick={() => onQuitar(ticker)}
                className="p-1 text-bloomberg-text-muted hover:text-bloomberg-red transition-colors rounded"
                title={`Quitar ${ticker}`} aria-label={`Quitar ${ticker}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Navbar principal ──────────────────────────────────────────── */
const TITULOS = {
  '/portafolios': 'Portafolios',
  '/analisis': 'Análisis Técnico',
  '/noticias': 'Noticias',
  '/wizard': 'Portafolio Automático',
  '/busqueda': 'Búsqueda',
  '/alertas': 'Alertas',
  '/fiscal': 'Módulo Fiscal',
  '/dashboard': 'Dashboard',
  '/dev-tests': 'Dev Tests',
};

export default function Navbar() {
  const alertasNoLeidas = useStore((s) => s.alertasNoLeidas);
  const wsConnected = useStore((s) => s.wsConnected);
  const favoritos = useStore((s) => s.favoritos);
  const toggleFavorito = useStore((s) => s.toggleFavorito);
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const { pathname } = useLocation();
  const titulo = TITULOS[pathname] || 'Lakshmi Q2';

  return (
    <header
      className="h-16 border-b border-white/5
                 flex items-center justify-between px-6 shrink-0"
      style={{ background: 'rgba(10, 14, 12, 0.6)', backdropFilter: 'blur(12px)' }}
      role="banner"
    >
      {/* Izquierda: título + contexto */}
      <div className="flex items-baseline gap-4">
        <h1 className="text-4xl font-semibold tracking-wide text-bloomberg-text">
          {titulo}
        </h1>
        <span className="hidden sm:inline text-sm text-bloomberg-text/60 font-light tracking-[0.2em] uppercase">
          Plataforma de Inversiones
        </span>
      </div>

      {/* Derecha: acciones */}
      <div className="flex items-center gap-2">
        {/* Favoritos */}
        <div className="relative">
          <button type="button" onClick={() => setDropdownAbierto((p) => !p)}
            className="relative p-2.5 rounded-lg text-bloomberg-text-muted
                       hover:text-bloomberg-text hover:bg-white/5 transition-all"
            aria-label={`Favoritos: ${favoritos.length}`} title="Favoritos"
          >
            <svg className={`w-[22px] h-[22px] ${favoritos.length > 0 ? 'text-yellow-400 fill-yellow-400' : ''}`}
              viewBox="0 0 24 24" fill={favoritos.length > 0 ? 'currentColor' : 'none'}
              stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                strokeWidth={favoritos.length > 0 ? 0 : 2}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {favoritos.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1
                               flex items-center justify-center rounded-full
                               bg-yellow-500 text-[9px] font-bold text-black">
                {favoritos.length > 99 ? '99+' : favoritos.length}
              </span>
            )}
          </button>
          {dropdownAbierto && (
            <FavoritosDropdown favoritos={favoritos} onQuitar={toggleFavorito}
              onCerrar={() => setDropdownAbierto(false)} />
          )}
        </div>

        {/* Alertas */}
        <button
          className="relative p-2.5 rounded-lg text-bloomberg-text-muted
                     hover:text-bloomberg-text hover:bg-white/5 transition-all"
          aria-label={`Alertas: ${alertasNoLeidas}`} title="Alertas"
        >
          <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11
                 a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341
                 C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436
                 L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <AlertBadge count={alertasNoLeidas} />
        </button>

        {/* Separador */}
        <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />

        {/* Usuario */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-bloomberg-accent/20 flex items-center justify-center">
              <span className="text-xs font-medium text-bloomberg-accent">
                {(user.nombre || user.username || '?')[0].toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-bloomberg-text hidden sm:inline">
              {user.nombre || user.username}
            </span>
            <button type="button" onClick={logout}
              className="p-1.5 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-red
                         hover:bg-white/5 transition-all"
              title="Cerrar sesión" aria-label="Cerrar sesión"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}

        {/* Separador */}
        <div className="w-px h-5 bg-white/10 mx-1" aria-hidden="true" />

        {/* Estado WS */}
        <div className="flex items-center gap-1.5" role="status" aria-live="polite"
          aria-label={wsConnected ? 'Conectado' : 'Desconectado'}>
          <span className={`w-2 h-2 rounded-full ${
            wsConnected ? 'bg-bloomberg-green shadow-[0_0_4px_#22c55e]' : 'bg-bloomberg-red'
          }`} aria-hidden="true" />
          <span className="text-xs font-light text-bloomberg-text-muted hidden lg:inline">
            {wsConnected ? 'Live' : 'Off'}
          </span>
        </div>
      </div>
    </header>
  );
}

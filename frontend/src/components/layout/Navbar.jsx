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

/**
 * Mini-dropdown de favoritos que se abre al hacer click en el badge.
 */
function FavoritosDropdown({ favoritos, onQuitar, onCerrar }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onCerrar();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCerrar]);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-64 rounded-lg
                 bg-bloomberg-panel border border-white/10 shadow-xl z-50"
      role="menu"
      aria-label="Lista de favoritos"
    >
      <div className="px-3 py-2 border-b border-white/5">
        <span className="text-xs font-semibold text-bloomberg-text-muted uppercase tracking-wider">
          Favoritos
        </span>
      </div>
      {favoritos.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-bloomberg-text-muted">
          Sin favoritos
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto py-1">
          {favoritos.map((ticker) => (
            <div
              key={ticker}
              className="flex items-center justify-between px-3 py-2
                         hover:bg-white/[0.04] transition-colors"
              role="menuitem"
            >
              <span className="text-sm font-mono font-medium text-bloomberg-accent">
                {ticker}
              </span>
              <button
                type="button"
                onClick={() => onQuitar(ticker)}
                className="p-1 text-bloomberg-text-muted hover:text-bloomberg-red
                           transition-colors rounded"
                title={`Quitar ${ticker} de favoritos`}
                aria-label={`Quitar ${ticker} de favoritos`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const alertasNoLeidas = useStore((s) => s.alertasNoLeidas);
  const wsConnected = useStore((s) => s.wsConnected);
  const favoritos = useStore((s) => s.favoritos);
  const toggleFavorito = useStore((s) => s.toggleFavorito);
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const { pathname } = useLocation();
  const titulos = {
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
  const titulo = titulos[pathname] || 'Lakshmi Q2';

  return (
    <header
      className="h-14 bg-bloomberg-panel border-b border-white/5
                 flex items-center justify-between px-6 shrink-0"
      role="banner"
    >
      {/* Título de la pantalla */}
      <h1 className="text-lg font-semibold text-bloomberg-text">
        {titulo}
      </h1>

      <div className="flex items-center gap-4">
        {/* Badge de favoritos */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownAbierto((prev) => !prev)}
            className="relative p-2 rounded-lg text-bloomberg-text-muted
                       hover:text-bloomberg-text hover:bg-white/5 transition-colors"
            aria-label={`Favoritos: ${favoritos.length}`}
            title="Favoritos"
          >
            <svg
              className={`w-5 h-5 ${favoritos.length > 0 ? 'text-yellow-400 fill-yellow-400' : ''}`}
              viewBox="0 0 24 24"
              fill={favoritos.length > 0 ? 'currentColor' : 'none'}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={favoritos.length > 0 ? 0 : 2}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            {favoritos.length > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1
                           flex items-center justify-center rounded-full
                           bg-yellow-500 text-[10px] font-bold text-black"
                aria-hidden="true"
              >
                {favoritos.length > 99 ? '99+' : favoritos.length}
              </span>
            )}
          </button>

          {dropdownAbierto && (
            <FavoritosDropdown
              favoritos={favoritos}
              onQuitar={toggleFavorito}
              onCerrar={() => setDropdownAbierto(false)}
            />
          )}
        </div>

        {/* Badge de alertas no leídas */}
        <button
          className="relative p-2 rounded-lg text-bloomberg-text-muted
                     hover:text-bloomberg-text hover:bg-white/5 transition-colors"
          aria-label={`Alertas no leídas: ${alertasNoLeidas}`}
          title="Alertas"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11
                 a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341
                 C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436
                 L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <AlertBadge count={alertasNoLeidas} />
        </button>

        {/* Usuario y logout */}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-bloomberg-text-muted">
              {user.nombre || user.username}
            </span>
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-red hover:bg-white/5 transition-colors"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}

        {/* Indicador de conexión WebSocket */}
        <div
          className="flex items-center gap-2 text-sm"
          aria-label="Estado de conexión WebSocket"
          role="status"
          aria-live="polite"
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              wsConnected ? 'bg-bloomberg-green' : 'bg-bloomberg-red'
            }`}
            aria-hidden="true"
          />
          <span className="text-bloomberg-text-muted">
            {wsConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>
    </header>
  );
}

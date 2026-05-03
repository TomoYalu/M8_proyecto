/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Layout
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/portafolios',  label: 'Portafolios',          icon: '💼' },
  { to: '/wizard',       label: 'Portafolio Automático', icon: '⚡' },
  { to: '/busqueda',     label: 'Búsqueda de Activos',  icon: '🔍' },
  { to: '/analisis',     label: 'Análisis Técnico',     icon: '📈' },
  { to: '/noticias',     label: 'Noticias',             icon: '📰' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } shrink-0 border-r border-white/5
        flex flex-col h-screen sticky top-0 transition-all duration-200`}
      style={{ background: 'rgba(10, 14, 12, 0.8)', backdropFilter: 'blur(12px)' }}
      role="navigation"
      aria-label="Menú principal"
    >
      {/* Brand */}
      <div className="px-3 py-5 border-b border-white/5 flex items-center justify-between">
        {!collapsed && (
          <div className="px-2">
            <h2 className="font-serif text-2xl font-light tracking-wider text-bloomberg-text">
              Lakshm<span className="text-bloomberg-accent not-italic">i</span>.
            </h2>
            <p className="text-xs text-bloomberg-text-muted mt-0.5 font-light">
              Gestión de Inversiones
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-1.5 rounded-lg text-bloomberg-text-muted hover:text-bloomberg-text
                     hover:bg-white/5 transition-colors"
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 transition-transform duration-200 ${
              collapsed ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-6 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                   font-light transition-all duration-300 ${
                    isActive
                      ? 'text-bloomberg-text'
                      : 'text-bloomberg-text-muted hover:text-bloomberg-text hover:translate-x-2'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                aria-label={label}
                title={collapsed ? label : undefined}
              >
                {({ isActive }) => (
                  <>
                    {/* Active dot indicator */}
                    {isActive && !collapsed && (
                      <span
                        className="absolute left-0 w-1 h-1 rounded-full bg-bloomberg-accent"
                        style={{ boxShadow: '0 0 8px #10b981' }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-base" aria-hidden="true">
                      {icon}
                    </span>
                    {!collapsed && <span>{label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={`px-3 py-3 border-t border-white/5 text-xs text-bloomberg-text-muted font-light ${
          collapsed ? 'text-center' : 'px-5'
        }`}
      >
        {collapsed ? 'v1' : 'v1.0.0'}
      </div>
    </aside>
  );
}

/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Layout
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/portafolios',  label: 'Portafolios',          icon: '💼' },
  { to: '/wizard',       label: 'Portafolio Automático', icon: '⚡' },
  { to: '/busqueda',     label: 'Búsqueda de Activos',  icon: '🔍' },
  { to: '/analisis',     label: 'Análisis Técnico',     icon: '📈' },
  { to: '/noticias',     label: 'Noticias',             icon: '📰' },
  { to: '/dev-tests',    label: 'Dev Tests',           icon: '🧪' },
  // TODO: habilitar cuando estén listos
  // { to: '/dashboard',    label: 'Dashboard',            icon: '📊' },
  // { to: '/alertas',      label: 'Alertas',              icon: '🔔' },
  // { to: '/fiscal',       label: 'Fiscal',               icon: '🧾' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } shrink-0 bg-bloomberg-panel border-r border-white/5
        flex flex-col h-screen sticky top-0 transition-all duration-200`}
      role="navigation"
      aria-label="Menú principal"
    >
      {/* Encabezado */}
      <div className="px-3 py-5 border-b border-white/5 flex items-center justify-between">
        {!collapsed && (
          <div className="px-2 cursor-pointer" onClick={() => navigate('/portafolios')}>
            <h2 className="text-lg font-bold text-bloomberg-accent tracking-wide hover:text-bloomberg-accent/80 transition-colors">
              Lakshmi Q2
            </h2>
            <p className="text-xs text-bloomberg-text-muted mt-0.5">
              Gestión de Inversiones · v0.1.0
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

      {/* Enlaces de navegación */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-bloomberg-accent/10 text-bloomberg-accent font-medium'
                      : 'text-bloomberg-text-muted hover:text-bloomberg-text hover:bg-white/5'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                aria-label={label}
                title={collapsed ? label : undefined}
              >
                <span className="text-base" aria-hidden="true">
                  {icon}
                </span>
                {!collapsed && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Pie */}
      <div
        className={`px-3 py-3 border-t border-white/5 text-xs text-bloomberg-text-muted ${
          collapsed ? 'text-center' : 'px-5'
        }`}
      >
        {collapsed ? 'v1' : 'v1.0.0'}
        {!collapsed && <div className="text-[10px] text-bloomberg-text-muted/40 mt-1">L.Y.O.T.</div>}
      </div>
    </aside>
  );
}

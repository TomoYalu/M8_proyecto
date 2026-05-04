/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Infraestructura
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-02
 */
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store';
import useInactivityLogout from './hooks/useInactivityLogout';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import ExchangeRateBanner from './components/layout/ExchangeRateBanner';
import NotificationBadge from './components/layout/NotificationBadge';
import DesktopWarning from './components/common/DesktopWarning';
import ElevenLabsWidget from './components/common/ElevenLabsWidget';
import Login from './pages/Login';
import Portafolios from './pages/Portafolios';
import Analisis from './pages/Analisis';
import Noticias from './pages/Noticias';
import Alertas from './pages/Alertas';
import Wizard from './pages/Wizard';
import Fiscal from './pages/Fiscal';
import Dashboard from './pages/Dashboard';
import Busqueda from './pages/Busqueda';
import DevTests from './pages/DevTests';

// ─── App (Layout + Routes) ──────────────────────────────────────

export default function App() {
  const user = useStore((s) => s.user);
  const authLoading = useStore((s) => s.authLoading);
  const checkAuth = useStore((s) => s.checkAuth);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useInactivityLogout();
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bloomberg-bg flex items-center justify-center">
        <div className="text-bloomberg-accent text-xl">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="flex min-h-screen bg-bloomberg-bg">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <ExchangeRateBanner />

        <main className="flex-1 overflow-y-auto" role="main">
          <Routes>
            <Route path="/" element={<Navigate to="/portafolios" replace />} />
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/portafolios" element={<Portafolios />} />
            <Route path="/analisis"    element={<Analisis />} />
            <Route path="/noticias"    element={<Noticias />} />
            <Route path="/wizard"      element={<Wizard />} />
            <Route path="/busqueda"    element={<Busqueda />} />
            <Route path="/alertas"     element={<Alertas />} />
            <Route path="/fiscal"      element={<Fiscal />} />
            <Route path="/dev-tests"   element={<DevTests />} />
          </Routes>
        </main>
      </div>

      <DesktopWarning />
      <ElevenLabsWidget />
      <NotificationBadge />
    </div>
  );
}

/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Hook: useInactivityLogout
 * Cierra la sesión automáticamente tras 10 minutos sin actividad
 * (mouse, teclado, touch, scroll).
 */
import { useEffect, useRef } from 'react';
import useStore from '../store';

const TIMEOUT_MS = (parseFloat(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 10) * 60 * 1000;

export default function useInactivityLogout() {
  const logout = useStore((s) => s.logout);
  const user = useStore((s) => s.user);
  const timer = useRef(null);

  useEffect(() => {
    if (!user) return;

    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => logout(), TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, logout]);
}

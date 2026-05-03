/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Autenticación
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */

export const createAuthSlice = (set) => ({
  user: null,
  authLoading: true,

  /** Verifica sesión activa al cargar la app */
  checkAuth: async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const user = await res.json();
        set({ user, authLoading: false });
      } else {
        set({ user: null, authLoading: false });
      }
    } catch {
      set({ user: null, authLoading: false });
    }
  },

  /** Login con username/password */
  login: async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      set({ user: data });
      return { ok: true };
    }
    return { ok: false, error: data.error };
  },

  /** Logout */
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    set({ user: null });
  },

  /** Registro */
  register: async (username, password, nombre, email) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, nombre, email }),
    });
    const data = await res.json();
    if (res.ok) {
      set({ user: data });
      return { ok: true };
    }
    return { ok: false, error: data.error };
  },
});

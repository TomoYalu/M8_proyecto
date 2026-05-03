/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Autenticación
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */
import { useState } from 'react';
import useStore from '../store';

export default function Login() {
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = mode === 'login'
      ? await login(username, password)
      : await register(username, password, nombre);
    setLoading(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-bloomberg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-bloomberg-accent tracking-tight">
            Lakshmi<span className="text-bloomberg-text">.</span>
          </h1>
          <p className="text-bloomberg-text-muted text-sm mt-1">
            Gestión de Portafolios de Inversión
          </p>
        </div>

        {/* Card */}
        <div className="bg-bloomberg-panel rounded-xl p-6 border border-white/5 shadow-lg">
          <h2 className="text-lg font-semibold text-bloomberg-text mb-4">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-bloomberg-text-muted mb-1" htmlFor="nombre">
                  Nombre (opcional)
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-bloomberg-bg border border-white/10 rounded-lg px-3 py-2 text-bloomberg-text focus:outline-none focus:border-bloomberg-accent"
                  placeholder="Tu nombre"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-bloomberg-text-muted mb-1" htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bloomberg-bg border border-white/10 rounded-lg px-3 py-2 text-bloomberg-text focus:outline-none focus:border-bloomberg-accent"
                placeholder="usuario"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-bloomberg-text-muted mb-1" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bloomberg-bg border border-white/10 rounded-lg px-3 py-2 text-bloomberg-text focus:outline-none focus:border-bloomberg-accent"
                placeholder="••••••"
                required
              />
            </div>

            {error && (
              <p className="text-bloomberg-red text-sm" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-bloomberg-accent hover:bg-bloomberg-accent/80 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-sm text-bloomberg-accent hover:underline"
            >
              {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>

          {mode === 'login' && (
            <p className="mt-3 text-center text-xs text-bloomberg-text-muted">
              Demo: usuario <span className="text-bloomberg-text">demo</span> / contraseña <span className="text-bloomberg-text">demo</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

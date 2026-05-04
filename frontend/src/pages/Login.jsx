/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Autenticación
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */
import { useState } from 'react';
import useStore from '../store';

const EMAIL_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9\-]+(?:\.[a-zA-Z]{2,})+$/;

function validarEmail(email) {
  if (!email) return 'El correo electrónico es requerido.';
  if (email.length > 254) return 'El correo es demasiado largo.';
  if (!EMAIL_RE.test(email)) return 'Formato de correo inválido.';
  const [, dominio] = email.split('@');
  const partes = dominio.split('.');
  if (partes.length < 2 || partes[partes.length - 1].length < 2) return 'Dominio de correo no válido.';
  return null;
}

export default function Login() {
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (val && mode === 'register') {
      setEmailError(validarEmail(val) || '');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      const emailErr = validarEmail(email);
      if (emailErr) { setEmailError(emailErr); return; }
    }
    setLoading(true);
    const result = mode === 'login'
      ? await login(username, password)
      : await register(username, password, nombre, email);
    setLoading(false);
    if (!result.ok) setError(result.error);
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[#e2e8f0] placeholder-[#94a3b8]/50 focus:outline-none focus:border-cyan-400/60 transition-colors';
  const inputErrCls = 'w-full bg-white/5 border border-red-500/50 rounded-lg px-3 py-2.5 text-[#e2e8f0] placeholder-[#94a3b8]/50 focus:outline-none focus:border-red-400/60 transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0e14' }}>
      {/* Glow decorativo */}
      <div className="fixed top-1/4 left-1/3 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/3 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand — font-serif como el sidebar */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-5xl font-bold tracking-tight text-white">
            Lakshm<span className="text-cyan-400">i</span>
          </h1>
          <h1 className="font-serif text-5xl font-bold tracking-tight text-white -mt-2">
            Q2<span className="text-cyan-400">.</span>
          </h1>
          <p className="text-[#94a3b8] text-sm mt-2 font-light">
            Gestión de Inversiones
          </p>
        </div>

        {/* Card glassmorphism */}
        <div
          className="rounded-2xl p-6 border border-white/10 shadow-2xl"
          style={{
            background: 'rgba(10, 14, 20, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Tabs login/register */}
          <div className="flex gap-4 mb-6 border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setEmailError(''); }}
              className={`text-sm font-light transition-colors ${
                mode === 'login' ? 'text-cyan-400' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              ◇ Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setEmailError(''); }}
              className={`text-sm font-light transition-colors ${
                mode === 'register' ? 'text-cyan-400' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              ◈ Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs text-[#94a3b8] mb-1.5 font-light" htmlFor="nombre">
                    Nombre (opcional)
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className={inputCls}
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94a3b8] mb-1.5 font-light" htmlFor="email">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    className={emailError ? inputErrCls : inputCls}
                    placeholder="tu@correo.com"
                    required
                  />
                  {emailError && (
                    <p className="text-red-400 text-xs mt-1">{emailError}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-[#94a3b8] mb-1.5 font-light" htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputCls}
                placeholder="usuario"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-[#94a3b8] mb-1.5 font-light" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'register' && !!emailError)}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
            >
              {loading ? '...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="mt-4 text-center text-xs text-[#94a3b8] font-light">
              Demo: <span className="text-white">demo</span> / <span className="text-white">demo</span>
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#94a3b8]/40 mt-6 font-light tracking-widest">
          L.Y.O.T. — TEC DE MONTERREY
        </p>
      </div>
    </div>
  );
}

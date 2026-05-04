/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Asistente de Voz (ElevenLabs)
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */
import { useEffect, useState, useRef, useCallback } from 'react';

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

export default function ElevenLabsWidget() {
  const [minimized, setMinimized] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  // Initialize position to bottom-right
  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  }, []);

  // Load script and create widget element
  useEffect(() => {
    if (!AGENT_ID) return;

    if (!document.querySelector('script[src*="convai-widget-embed"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      const el = document.querySelector('elevenlabs-convai');
      if (el) el.remove();
    };
  }, []);

  // Mount/unmount widget into our container
  useEffect(() => {
    if (!AGENT_ID || !widgetRef.current) return;

    if (!minimized) {
      let el = document.querySelector('elevenlabs-convai');
      if (!el) {
        el = document.createElement('elevenlabs-convai');
        el.setAttribute('agent-id', AGENT_ID);
        el.setAttribute('avatar-orb-color-1', '#06b6d4');
        el.setAttribute('avatar-orb-color-2', '#0ea5e9');
        el.setAttribute('action-text', 'Hablar con Lakshmi');
        el.setAttribute('start-call-text', 'Iniciar conversación');
        el.setAttribute('end-call-text', 'Terminar');
        el.setAttribute('listening-text', 'Escuchando...');
        el.setAttribute('speaking-text', 'Lakshmi habla...');
      }
      widgetRef.current.appendChild(el);
    } else {
      const el = document.querySelector('elevenlabs-convai');
      if (el) el.remove();
    }
  }, [minimized]);

  // Drag handlers
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('[data-no-drag]')) return;
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offset.current.y)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (!AGENT_ID) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999]"
      style={{ left: pos.x, top: pos.y, cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
    >
      {minimized ? (
        /* Minimized: small floating button */
        <button
          data-no-drag
          onClick={() => setMinimized(false)}
          className="w-12 h-12 rounded-full bg-cyan-600 hover:bg-cyan-500 shadow-lg
                     shadow-cyan-500/30 flex items-center justify-center transition-all
                     hover:scale-110"
          title="Abrir asistente de voz"
          aria-label="Abrir asistente de voz Lakshmi"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      ) : (
        /* Expanded: widget container with header */
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10"
          style={{ background: 'rgba(10, 14, 20, 0.95)', width: 320 }}
        >
          {/* Drag handle + minimize */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-grab">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
              <span className="text-xs font-medium text-bloomberg-text">Lakshmi AI</span>
            </div>
            <button
              data-no-drag
              onClick={() => setMinimized(true)}
              className="p-1 rounded text-bloomberg-text-muted hover:text-bloomberg-text
                         hover:bg-white/10 transition-colors"
              title="Minimizar"
              aria-label="Minimizar asistente"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {/* Widget mount point */}
          <div ref={widgetRef} className="min-h-[200px]" data-no-drag />
        </div>
      )}
    </div>
  );
}

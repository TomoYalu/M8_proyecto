/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Asistente de Voz (ElevenLabs)
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */
import { useEffect, useState, useRef } from 'react';

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

export default function ElevenLabsWidget() {
  const [minimized, setMinimized] = useState(true);
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const dragState = useRef({ active: false, startX: 0, startY: 0, moved: false });
  const widgetRef = useRef(null);

  // Set initial position
  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  }, []);

  // Load ElevenLabs script
  useEffect(() => {
    if (!AGENT_ID) return;
    if (!document.querySelector('script[src*="convai-widget-embed"]')) {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      s.async = true;
      document.body.appendChild(s);
    }
    return () => { document.querySelector('elevenlabs-convai')?.remove(); };
  }, []);

  // Mount/unmount widget
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
      document.querySelector('elevenlabs-convai')?.remove();
    }
  }, [minimized]);

  // Global mouse move/up for drag
  useEffect(() => {
    const onMove = (e) => {
      const d = dragState.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      if (d.moved) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 60, d.origX + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, d.origY + dy)),
        });
      }
    };
    const onUp = () => { dragState.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e) => {
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  };

  const handleClick = (action) => {
    // Only fire click if we didn't drag
    if (!dragState.current.moved) action();
  };

  if (!AGENT_ID || pos.x < 0) return null;

  return (
    <div
      className="fixed z-[9999] select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {minimized ? (
        <div
          onMouseDown={startDrag}
          onClick={() => handleClick(() => setMinimized(false))}
          className="w-12 h-12 rounded-full bg-cyan-600 hover:bg-cyan-500 shadow-lg
                     shadow-cyan-500/30 flex items-center justify-center transition-all
                     hover:scale-110 cursor-grab active:cursor-grabbing"
          title="Abrir asistente · Arrastra para mover"
          role="button"
          aria-label="Abrir asistente de voz Lakshmi"
        >
          <svg className="w-6 h-6 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10"
          style={{ background: 'rgba(10, 14, 20, 0.95)', width: 320 }}>
          {/* Drag handle */}
          <div
            onMouseDown={startDrag}
            className="flex items-center justify-between px-3 py-2 border-b border-white/10
                       cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
              <span className="text-xs font-medium text-bloomberg-text">Lakshmi AI</span>
            </div>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setMinimized(true)}
              className="p-1 rounded text-bloomberg-text-muted hover:text-bloomberg-text
                         hover:bg-white/10 transition-colors cursor-pointer"
              title="Minimizar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div ref={widgetRef} className="min-h-[200px]" />
        </div>
      )}
    </div>
  );
}

/**
 * Lakshmi Q2 - Gestión de Inversiones
 * Módulo: Asistente de Voz (ElevenLabs)
 * Autor: Luis Yhaser Olmos Torres
 * Institución: Tecnológico de Monterrey
 * Fecha de creación: 2026-05-03
 */
import { useEffect } from 'react';

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

export default function ElevenLabsWidget() {
  useEffect(() => {
    if (!AGENT_ID) return;

    if (!document.querySelector('script[src*="convai-widget-embed"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      document.body.appendChild(script);
    }

    if (!document.querySelector('elevenlabs-convai')) {
      const widget = document.createElement('elevenlabs-convai');
      widget.setAttribute('agent-id', AGENT_ID);
      widget.setAttribute('avatar-orb-color-1', '#06b6d4');
      widget.setAttribute('avatar-orb-color-2', '#0ea5e9');
      widget.setAttribute('action-text', 'Hablar con Lakshmi');
      widget.setAttribute('start-call-text', 'Iniciar conversación');
      widget.setAttribute('end-call-text', 'Terminar');
      widget.setAttribute('listening-text', 'Escuchando...');
      widget.setAttribute('speaking-text', 'Lakshmi habla...');
      document.body.appendChild(widget);
    }

    return () => {
      const el = document.querySelector('elevenlabs-convai');
      if (el) el.remove();
    };
  }, []);

  return null;
}

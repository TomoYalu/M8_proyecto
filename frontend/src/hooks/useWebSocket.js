import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store';

/**
 * Hook para conexión WebSocket con Flask-SocketIO.
 *
 * Escucha eventos: prices_updated, portfolio_updated
 * Expone: subscribe_portfolio, unsubscribe_portfolio, subscribe_ticker
 *
 * Requisitos cubiertos: 3.2, 3.3, 12.6
 */
export default function useWebSocket() {
  const socketRef = useRef(null);

  const setWsConnected = useStore((s) => s.setWsConnected);
  const actualizarPrecio = useStore((s) => s.actualizarPrecio);
  const fetchPosiciones = useStore((s) => s.fetchPosiciones);
  const fetchConsolidado = useStore((s) => s.fetchConsolidado);
  const incrementarNoLeidas = useStore((s) => s.incrementarNoLeidas);
  const setTipoCambio = useStore((s) => s.setTipoCambio);

  useEffect(() => {
    // Conectar al servidor WebSocket (mismo origen, Vite proxy o Nginx)
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setWsConnected(true);
      // Suscribirse a actualizaciones de tipo de cambio al conectar
      socket.emit('subscribe_exchange_rate');
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
    });

    // Actualización de precios en tiempo real
    socket.on('prices_updated', (data) => {
      if (data && data.ticker) {
        actualizarPrecio(data.ticker, {
          precio: data.precio,
          cambio_pct: data.cambio_pct,
          timestamp: data.timestamp,
        });
      }
    });

    // Recálculo de portafolio tras actualización de precios
    socket.on('portfolio_updated', (data) => {
      if (data && data.portafolio_id) {
        // Refrescar posiciones del portafolio actualizado
        fetchPosiciones(data.portafolio_id).catch(() => {});
        fetchConsolidado().catch(() => {});
      }
    });

    // Alerta disparada — incrementar contador y mostrar toast
    socket.on('alert_triggered', (data) => {
      if (data) {
        incrementarNoLeidas();
        // Notificar al componente NotificationBadge via función global
        if (typeof window.__lakshmiNotificar === 'function') {
          window.__lakshmiNotificar(data);
        }
      }
    });

    // Tipo de cambio actualizado — actualizar store
    socket.on('exchange_rate_updated', (data) => {
      if (data) {
        setTipoCambio(data);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe_portfolio = useCallback((id) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_portfolio', { portafolio_id: id });
    }
  }, []);

  const unsubscribe_portfolio = useCallback((id) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe_portfolio', { portafolio_id: id });
    }
  }, []);

  const subscribe_ticker = useCallback((ticker) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_ticker', { ticker });
    }
  }, []);

  const subscribe_exchange_rate = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_exchange_rate');
    }
  }, []);

  return {
    subscribe_portfolio,
    unsubscribe_portfolio,
    subscribe_ticker,
    subscribe_exchange_rate,
  };
}

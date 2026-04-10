import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../store/useTelemetryStore';

const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000') + '/dashboard';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  const { 
    setConnected, 
    setWsError, 
    addTelemetry, 
    setOnlineNodes, 
    setOfflineNodes,
    addTransaction
  } = useTelemetryStore();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setWsError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'telemetry':
              addTelemetry(message.data);
              break;
              
            case 'node_status':
              if (message.payload?.online_nodes) {
                setOnlineNodes(message.payload.online_nodes);
              }
              if (message.payload?.offline_nodes) {
                setOfflineNodes(message.payload.offline_nodes);
              }
              break;
              
            case 'new_transaction':
              addTransaction(message.payload);
              break;
              
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
              
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setWsError('Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsError('WebSocket connection error');
      };

    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setWsError('Failed to create WebSocket connection');
    }
  }, [setConnected, setWsError, addTelemetry, setOnlineNodes, setOfflineNodes, addTransaction]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, [setConnected]);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }, []);

  return { connect, disconnect, sendMessage };
}

export default useWebSocket;

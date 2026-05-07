import { useCallback, useEffect, useRef, useState } from "react";

/** WebSocket на том же хосте, что и страница (один origin в production на Railway). */
export function getWebSocketUrl(path: string = "/ws"): string {
  const wsUrl =
    window.location.protocol === "https:"
      ? `wss://${window.location.host}${path}`
      : `ws://${window.location.host}${path}`;
  return wsUrl;
}

type UseWebSocketOptions = {
  /** Полный ws/wss URL или путь (по умолчанию `/ws`). */
  url?: string;
};

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const url = options.url ?? getWebSocketUrl();
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => setLastMessage(event.data as string);
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [url]);

  const send = useCallback((data: string | ArrayBuffer | Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { lastMessage, connected, send };
}

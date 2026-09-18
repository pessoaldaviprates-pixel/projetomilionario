'use client';

import { useEffect, useRef } from 'react';

export interface RealtimeMessage<T = unknown> {
  type: string;
  companyId: string;
  topic?: string;
  payload: T;
  at: string;
}

/**
 * Assina o fluxo de eventos do tenant.
 *
 * O handler é guardado em ref para que a conexão SSE não seja recriada a cada
 * render — reconectar a cada digitação seria desastroso para o chat.
 */
export function useRealtime(
  types: string[],
  onEvent: (event: RealtimeMessage) => void,
  enabled = true,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const typesKey = types.join(',');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const source = new EventSource('/api/eventos');
    const listeners: [string, (event: MessageEvent) => void][] = [];

    for (const type of typesKey.split(',').filter(Boolean)) {
      const listener = (event: MessageEvent) => {
        try {
          handlerRef.current(JSON.parse(event.data) as RealtimeMessage);
        } catch {
          // Payload malformado: ignorar em vez de derrubar a interface.
        }
      };
      source.addEventListener(type, listener);
      listeners.push([type, listener]);
    }

    // O EventSource já reconecta sozinho; só registramos para diagnóstico.
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        console.warn('[realtime] conexão encerrada; o navegador tentará reconectar.');
      }
    };

    return () => {
      for (const [type, listener] of listeners) source.removeEventListener(type, listener);
      source.close();
    };
  }, [typesKey, enabled]);
}

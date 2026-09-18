/**
 * Canal de eventos em tempo real (Server-Sent Events).
 *
 * Escolhemos SSE em vez de WebSocket porque o tráfego do produto é quase todo
 * servidor → cliente (mensagem nova, notificação, tarefa mudou). SSE passa por
 * qualquer proxy HTTP, reconecta sozinho e não precisa de servidor separado.
 * As escritas continuam indo por requisições normais.
 *
 * Isolamento: a assinatura é feita pelo companyId resolvido da SESSÃO. O cliente
 * não escolhe o que escuta — é impossível assinar o fluxo de outra empresa.
 */
import { getAuthContext } from '@/lib/auth/context';
import { bus, type RealtimeEvent } from '@/lib/realtime/bus';

export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: RealtimeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      controller.enqueue(encoder.encode(`event: ready\ndata: {"companyId":"${ctx.companyId}"}\n\n`));

      const unsubscribe = bus.subscribe(ctx.companyId, send);

      // Comentário SSE periódico impede que proxies derrubem a conexão ociosa.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Já fechado pelo cliente.
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}

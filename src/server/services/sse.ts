import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

interface SSEClient {
  controller: ReadableStreamDefaultController;
  serverId: number | null;
}

const clients = new Set<SSEClient>();

export function sseEmit(serverId: number, event: { type: string; [key: string]: unknown }) {
  for (const client of clients) {
    if (client.serverId === null || client.serverId === serverId) {
      try {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        client.controller.enqueue(new TextEncoder().encode(data));
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function sseHandler(serverId: number | null) {
  return (c: Context) => {
    const stream = new ReadableStream({
      start(controller) {
        const client: SSEClient = { controller, serverId };
        clients.add(client);

        c.req.raw.signal.addEventListener('abort', () => {
          clients.delete(client);
          controller.close();
        });

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
          } catch {
            clearInterval(keepAlive);
            clients.delete(client);
          }
        }, 30000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  };
}

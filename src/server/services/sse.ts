import { Context } from 'hono';
import { Monitor } from './monitor.js';

interface SSEClient {
  controller: ReadableStreamDefaultController;
  serverId: number | null;
}

const clients = new Set<SSEClient>();
const serverListeners = new Map<number, number>(); // serverId -> listener count

export function sseEmit(serverId: number, event: { type: string; [key: string]: unknown }) {
  for (const client of clients) {
    if (client.serverId === null || client.serverId === serverId) {
      try {
        const data = `event: ${event.type}\ndata: ${JSON.stringify({ ...event, serverId })}\n\n`;
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

        // Track server-specific listeners and start monitoring if needed
        if (serverId !== null) {
          const currentCount = serverListeners.get(serverId) || 0;
          serverListeners.set(serverId, currentCount + 1);
          
          if (currentCount === 0) {
            // First listener for this server, start monitoring
            Monitor.startMonitoring(serverId);
          }
        }

        c.req.raw.signal.addEventListener('abort', () => {
          clients.delete(client);
          controller.close();

          // Decrement listener count and stop monitoring if no more listeners
          if (serverId !== null) {
            const currentCount = serverListeners.get(serverId) || 0;
            if (currentCount > 1) {
              serverListeners.set(serverId, currentCount - 1);
            } else {
              serverListeners.delete(serverId);
              Monitor.stopMonitoring(serverId);
            }
          }
        });

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
          } catch {
            clearInterval(keepAlive);
            clients.delete(client);
            
            // Clean up listener tracking on error
            if (serverId !== null) {
              const currentCount = serverListeners.get(serverId) || 0;
              if (currentCount > 1) {
                serverListeners.set(serverId, currentCount - 1);
              } else {
                serverListeners.delete(serverId);
                Monitor.stopMonitoring(serverId);
              }
            }
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

export function getActiveServers(): Set<number> {
  return new Set(serverListeners.keys());
}
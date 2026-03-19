import { Context } from 'hono';
import { Monitor } from './monitor.js';

interface SSEClient {
  controller: ReadableStreamDefaultController;
  serverId: number | null;
}

const clients = new Set<SSEClient>();
const serverListeners = new Map<number, number>();
let globalListeners = 0;

function addListener(serverId: number | null) {
  if (serverId !== null) {
    const count = serverListeners.get(serverId) || 0;
    serverListeners.set(serverId, count + 1);
    if (count === 0) Monitor.startMonitoring(serverId);
  } else {
    globalListeners++;
    if (globalListeners === 1) Monitor.startMonitoringAll();
  }
}

function removeListener(serverId: number | null) {
  if (serverId !== null) {
    const count = serverListeners.get(serverId) || 0;
    if (count > 1) {
      serverListeners.set(serverId, count - 1);
    } else {
      serverListeners.delete(serverId);
      Monitor.stopMonitoring(serverId);
    }
  } else {
    globalListeners = Math.max(0, globalListeners - 1);
    if (globalListeners === 0) Monitor.stopMonitoringAll();
  }
}

function triggerStatusSync(serverId: number | null) {
  if (serverId !== null) {
    Monitor.syncStatus(serverId);
  } else {
    Monitor.syncAll();
  }
}

export function sseEmit(serverId: number, event: { type: string; [key: string]: unknown }) {
  const encoded = new TextEncoder().encode(
    `event: ${event.type}\ndata: ${JSON.stringify({ ...event, serverId })}\n\n`
  );
  for (const client of clients) {
    if (client.serverId === null || client.serverId === serverId) {
      try { client.controller.enqueue(encoded); } catch { clients.delete(client); }
    }
  }
}

export function sseHandler(serverId: number | null) {
  return (c: Context) => {
    const stream = new ReadableStream({
      start(controller) {
        const client: SSEClient = { controller, serverId };
        clients.add(client);
        addListener(serverId);
        triggerStatusSync(serverId);

        const cleanup = () => {
          clients.delete(client);
          removeListener(serverId);
          clearInterval(keepAlive);
          try { controller.close(); } catch {}
        };

        c.req.raw.signal.addEventListener('abort', cleanup);

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
          } catch {
            cleanup();
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
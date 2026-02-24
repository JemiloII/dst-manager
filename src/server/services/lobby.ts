import db from '../db/schema.js';
import { sseEmit } from './sse.js';

interface LobbyServer {
  name: string;
  connected: number;
  maxconnections: number;
  players: string[];
  port: number;
  host: string;
}

let lobbyCache: LobbyServer[] = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchLobbyListings(): Promise<LobbyServer[]> {
  try {
    const response = await fetch('https://d26ly0au0tyuy.cloudfront.net/lobbyListings.json.gz');
    if (!response.ok) return [];

    const decompressed = new Response(
      response.body!.pipeThrough(new DecompressionStream('gzip'))
    );
    const data = await decompressed.json();

    if (Array.isArray(data)) {
      return data.map((entry: Record<string, unknown>) => ({
        name: (entry.name as string) || '',
        connected: (entry.connected as number) || 0,
        maxconnections: (entry.maxconnections as number) || 0,
        players: Array.isArray(entry.players) ? entry.players as string[] : [],
        port: (entry.port as number) || 0,
        host: (entry.host as string) || '',
      }));
    }
    return [];
  } catch {
    return [];
  }
}

async function pollLobby() {
  const listings = await fetchLobbyListings();
  if (listings.length === 0) return;

  lobbyCache = listings;

  const servers = await db.execute({ sql: 'SELECT id, name, port_offset FROM servers WHERE status != ?', args: ['stopped'] });

  for (const server of servers.rows) {
    const serverName = server.name as string;
    const match = listings.find((l) => l.name === serverName);

    if (match) {
      const playerCount = match.connected;
      const status = playerCount === 0 ? 'paused' : 'running';

      await db.execute({
        sql: 'UPDATE servers SET status = ? WHERE id = ? AND status != ?',
        args: [status, server.id as number, 'stopped'],
      });

      sseEmit(server.id as number, {
        type: 'players',
        data: {
          count: playerCount,
          max: match.maxconnections,
          list: match.players,
        },
      });

      sseEmit(server.id as number, { type: 'status', data: status });
    }
  }
}

export function startLobbyPoller(intervalMs = 30000) {
  if (pollInterval) return;
  pollLobby();
  pollInterval = setInterval(pollLobby, intervalMs);
}

export function stopLobbyPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function getLobbyCache(): LobbyServer[] {
  return lobbyCache;
}

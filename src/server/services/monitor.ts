import db from '../db/schema.js';
import { sseEmit } from './sse.js';
import Servers from '../features/servers/servers.queries.js';

interface ServerInstance {
  name: string;
  connected: number;
  maxconnections: number;
  players: string[];
  port: number;
  host: string;
}

class ServerMonitor {
  private instanceCache: ServerInstance[] = [];
  private monitoringServers = new Map<number, ReturnType<typeof setInterval>>();
  private globalPollInterval: ReturnType<typeof setInterval> | null = null;

  private async fetchLobbyListings(): Promise<ServerInstance[]> {
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

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async checkServerStatus(serverId: number): Promise<void> {
    const server = await Servers.findById(serverId);
    if (!server) return;

    // Get PIDs from database
    const dbPids = await Servers.getPids(serverId);
    
    // No PIDs = server is not running, don't check anything
    if (!dbPids) {
      if (server.status !== 'stopped') {
        // Inconsistent state - fix it
        await Servers.updateStatus(serverId, 'stopped');
        sseEmit(serverId, { type: 'status', data: 'stopped' });
      }
      this.stopMonitoring(serverId);
      return;
    }

    // We have PIDs - check if processes are actually running
    const masterRunning = dbPids.master ? await this.isProcessRunning(dbPids.master) : false;
    const cavesRunning = dbPids.caves ? await this.isProcessRunning(dbPids.caves) : false;
    
    if (!masterRunning && !cavesRunning) {
      // Server crashed - clear PIDs and mark as stopped
      await Servers.updateStatus(serverId, 'stopped');
      await Servers.updatePids(serverId, null);
      sseEmit(serverId, { type: 'status', data: 'stopped' });
      this.stopMonitoring(serverId);
      return;
    }

    // Fetch player info from lobby API
    const listings = await this.fetchLobbyListings();
    this.instanceCache = listings;

    const serverName = server.name;
    const match = listings.find((l) => l.name === serverName);

    if (match) {
      const playerCount = match.connected;
      const status = playerCount === 0 ? 'paused' : 'running';

      await Servers.updateStatus(serverId, status);

      sseEmit(serverId, {
        type: 'players',
        data: {
          count: playerCount,
          max: match.maxconnections,
          list: match.players,
        },
      });

      sseEmit(serverId, { type: 'status', data: status });
    }
  }

  private async pollAllServers() {
    // This runs less frequently to update the cache and check for dead servers
    const servers = await db.execute({ 
      sql: 'SELECT id, pids FROM servers WHERE status != ?', 
      args: ['stopped'] 
    });
    
    for (const server of servers.rows) {
      const row = server as any;
      if (row.pids && row.pids !== '{}') {
        try {
          const pids = JSON.parse(row.pids);
          const masterRunning = pids.master ? await this.isProcessRunning(pids.master) : false;
          const cavesRunning = pids.caves ? await this.isProcessRunning(pids.caves) : false;
          
          if (!masterRunning && !cavesRunning) {
            await Servers.updateStatus(row.id, 'stopped');
            await Servers.updatePids(row.id, null);
            sseEmit(row.id, { type: 'status', data: 'stopped' });
          }
        } catch (e) {
          console.error(`Failed to check PIDs for server ${row.id}:`, e);
        }
      }
    }

    // Update lobby cache
    this.instanceCache = await this.fetchLobbyListings();
  }

  async startMonitoring(serverId: number, intervalMs = 15000) {
    if (this.monitoringServers.has(serverId)) return;
    
    // Check if server has PIDs (is running) before starting monitoring
    const pids = await Servers.getPids(serverId);
    if (!pids) {
      // No PIDs = not running, don't monitor
      return;
    }
    
    // Initial check
    this.checkServerStatus(serverId);
    
    // Set up polling for this specific server
    const interval = setInterval(() => this.checkServerStatus(serverId), intervalMs);
    this.monitoringServers.set(serverId, interval);
  }

  stopMonitoring(serverId: number) {
    const interval = this.monitoringServers.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.monitoringServers.delete(serverId);
    }
  }

  start(intervalMs = 60000) {
    // Global polling for dead server detection (less frequent)
    if (this.globalPollInterval) return;
    this.pollAllServers();
    this.globalPollInterval = setInterval(() => this.pollAllServers(), intervalMs);
  }

  stop() {
    // Stop global polling
    if (this.globalPollInterval) {
      clearInterval(this.globalPollInterval);
      this.globalPollInterval = null;
    }
    
    // Stop all individual server monitoring
    for (const interval of this.monitoringServers.values()) {
      clearInterval(interval);
    }
    this.monitoringServers.clear();
  }

  getInstances(): ServerInstance[] {
    return this.instanceCache;
  }

  getPlayersOnServer(portOffset: number): { count: number; players: string[] } {
    // Port calculation: game ports start at 10998, +2 for each server (master port)
    const serverPort = 10998 + (portOffset * 2);
    const found = this.instanceCache.find(s => s.port === serverPort);
    
    return {
      count: found?.connected || 0,
      players: found?.players || []
    };
  }
}

export const Monitor = new ServerMonitor();
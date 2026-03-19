import fs from 'fs/promises';
import { watch, openSync, writeSync, closeSync, constants, statSync } from 'node:fs';
import path from 'path';
import db from '../db/schema.js';
import { sseEmit } from './sse.js';
import Servers from '../features/servers/servers.queries.js';
import { getClusterPath } from './dst.js';

interface ServerInstance {
  name: string;
  connected: number;
  maxconnections: number;
  players: string[];
  port: number;
  host: string;
}

interface LogWatcher {
  close(): void;
}

class ServerMonitor {
  private instanceCache: ServerInstance[] = [];
  private watchers = new Map<number, LogWatcher>();
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

  private sendCavesShutdown(shareCode: string): void {
    try {
      const fifoPath = path.join(getClusterPath(shareCode), 'Caves', 'console_pipe');
      const fd = openSync(fifoPath, constants.O_WRONLY | constants.O_NONBLOCK);
      writeSync(fd, Buffer.from('c_shutdown()\n'));
      closeSync(fd);
    } catch {}
  }

  private async markServerStopped(serverId: number, shareCode: string) {
    const dbPids = await Servers.getPids(serverId);
    const cavesRunning = dbPids?.caves ? await this.isProcessRunning(dbPids.caves) : false;
    if (cavesRunning) this.sendCavesShutdown(shareCode);

    await Servers.updateStatus(serverId, 'stopped');
    await Servers.updatePids(serverId, null);
    sseEmit(serverId, { type: 'status', data: 'stopped' });
    this.stopMonitoring(serverId);
  }

  private watchLog(serverId: number, shareCode: string): LogWatcher {
    const masterDir = path.join(getClusterPath(shareCode), 'Master');
    const logPath = path.join(masterDir, 'server_log.txt');
    let offset = 0;
    let buffer = '';
    let fileWatcher: ReturnType<typeof watch> | null = null;
    let dirWatcher: ReturnType<typeof watch> | null = null;
    let closed = false;

    const processLine = async (line: string) => {
      if (line.includes('Sim paused') || line.includes('Sim unpaused')) {
        const server = await Servers.findById(serverId);
        if (server?.status === 'starting') {
          await Servers.updateStatus(serverId, 'running');
          sseEmit(serverId, { type: 'status', data: 'running' });
        }
      }

      if (line.includes('Shutting down')) {
        await this.markServerStopped(serverId, shareCode);
      }
    };

    const readNewLines = async () => {
      try {
        const handle = await fs.open(logPath, 'r');
        const stat = await handle.stat();
        if (stat.size <= offset) {
          if (stat.size < offset) offset = 0;
          await handle.close();
          return;
        }

        const chunk = Buffer.alloc(stat.size - offset);
        await handle.read(chunk, 0, chunk.length, offset);
        offset = stat.size;
        await handle.close();

        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          await processLine(line);
        }
      } catch {}
    };

    const startFileWatch = () => {
      if (closed || fileWatcher) return;
      try {
        offset = statSync(logPath).size;
      } catch {
        return;
      }
      try {
        fileWatcher = watch(logPath, () => readNewLines());
        dirWatcher?.close();
        dirWatcher = null;
      } catch {}
    };

    // Try file watch first, fall back to directory watch
    try {
      statSync(logPath);
      startFileWatch();
    } catch {
      try {
        dirWatcher = watch(masterDir, (_event, filename) => {
          if (filename === 'server_log.txt') startFileWatch();
        });
      } catch {}
    }

    return {
      close() {
        closed = true;
        fileWatcher?.close();
        dirWatcher?.close();
      }
    };
  }

  async startMonitoring(serverId: number) {
    if (this.watchers.has(serverId)) return;

    const server = await Servers.findById(serverId);
    if (!server) return;

    const pids = await Servers.getPids(serverId);
    if (!pids) return;

    const watcher = this.watchLog(serverId, server.share_code);
    this.watchers.set(serverId, watcher);
  }

  stopMonitoring(serverId: number) {
    const watcher = this.watchers.get(serverId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(serverId);
    }
  }

  async startMonitoringAll() {
    const servers = await db.execute({
      sql: 'SELECT id FROM servers WHERE status != ?',
      args: ['stopped']
    });

    for (const row of servers.rows) {
      const { id } = row as any;
      this.startMonitoring(id);
    }
  }

  stopMonitoringAll() {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  private async pollAllServers() {
    const servers = await db.execute({
      sql: 'SELECT id, pids FROM servers WHERE status != ?',
      args: ['stopped']
    });

    for (const server of servers.rows) {
      const row = server as any;
      if (!row.pids || row.pids === '{}') {
        await Servers.updateStatus(row.id, 'stopped');
        sseEmit(row.id, { type: 'status', data: 'stopped' });
        continue;
      }

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

    this.instanceCache = await this.fetchLobbyListings();
  }

  start(intervalMs = 60000) {
    if (this.globalPollInterval) return;
    this.pollAllServers();
    this.globalPollInterval = setInterval(() => this.pollAllServers(), intervalMs);
  }

  stop() {
    if (this.globalPollInterval) {
      clearInterval(this.globalPollInterval);
      this.globalPollInterval = null;
    }

    this.stopMonitoringAll();
  }

  async syncStatus(serverId: number) {
    const server = await Servers.findById(serverId);
    if (!server) return;

    // Check PIDs
    const dbPids = await Servers.getPids(serverId);
    if (!dbPids) {
      if (server.status !== 'stopped') {
        await Servers.updateStatus(serverId, 'stopped');
      }
      sseEmit(serverId, { type: 'status', data: 'stopped' });
      return;
    }

    const masterRunning = dbPids.master ? await this.isProcessRunning(dbPids.master) : false;
    if (!masterRunning) {
      await this.markServerStopped(serverId, server.share_code);
      return;
    }

    // Read last line of Master log
    try {
      const logPath = path.join(getClusterPath(server.share_code), 'Master', 'server_log.txt');
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';

      if (lastLine.includes('Shutting down')) {
        await this.markServerStopped(serverId, server.share_code);
        return;
      }
    } catch {}

    // Start watching if not already
    if (!this.watchers.has(serverId)) {
      this.startMonitoring(serverId);
    }

    sseEmit(serverId, { type: 'status', data: server.status });
  }

  async syncAll() {
    const servers = await db.execute({
      sql: 'SELECT id FROM servers',
      args: []
    });
    for (const row of servers.rows) {
      const { id } = row as any;
      await this.syncStatus(id);
    }
  }

  getInstances(): ServerInstance[] {
    return this.instanceCache;
  }

  getPlayersOnServer(portOffset: number): { count: number; players: string[] } {
    const serverPort = 10998 + (portOffset * 2);
    const found = this.instanceCache.find(s => s.port === serverPort);

    return {
      count: found?.connected || 0,
      players: found?.players || []
    };
  }
}

export const Monitor = new ServerMonitor();

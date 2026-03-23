import fs from 'fs/promises';
import { watch, openSync, writeSync, closeSync, constants, statSync } from 'node:fs';
import path from 'path';
import db from '../db/schema.js';
import { sseEmit } from './sse.js';
import Servers from '../features/servers/servers.queries.js';
import { getClusterPath } from './dst.js';

interface LogWatcher {
  close(): void;
}

interface PlayerInfo {
  count: number;
  max: number;
  list: string[];
}

const PLAYER_QUERY_CMD = 'local t=TheNet:GetClientTable() if t then local k={} for i,v in ipairs(t) do if v.userid~="" and v.netid~=nil and v.netid~="" then k[#k+1]=v.userid end end print("__PC:"..#k..":"..table.concat(k,",")) end\n';

class ServerMonitor {
  private watchers = new Map<number, LogWatcher>();
  private globalPollInterval: ReturnType<typeof setInterval> | null = null;
  private playerCache = new Map<number, PlayerInfo>();

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private sendFifoCommand(shareCode: string, shard: 'Master' | 'Caves', command: string): boolean {
    try {
      const fifoPath = path.join(getClusterPath(shareCode), shard, 'console_pipe');
      const fd = openSync(fifoPath, constants.O_WRONLY | constants.O_NONBLOCK);
      writeSync(fd, Buffer.from(command));
      closeSync(fd);
      return true;
    } catch {
      return false;
    }
  }

  private emitPlayerUpdate(serverId: number, next: PlayerInfo) {
    const prev = this.playerCache.get(serverId);
    if (prev && prev.count === next.count && prev.max === next.max && prev.list.join() === next.list.join()) return;
    this.playerCache.set(serverId, next);
    sseEmit(serverId, { type: 'players', data: next });
  }

  private async markServerStopped(serverId: number, shareCode: string) {
    const dbPids = await Servers.getPids(serverId);
    const cavesRunning = dbPids?.caves ? await this.isProcessRunning(dbPids.caves) : false;
    if (cavesRunning) this.sendFifoCommand(shareCode, 'Caves', 'c_shutdown()\n');

    await Servers.updateStatus(serverId, 'stopped');
    await Servers.updatePids(serverId, null);
    sseEmit(serverId, { type: 'status', data: 'stopped' });
    this.clearPlayerCache(serverId);
    this.stopMonitoring(serverId);
  }

  private watchLog(serverId: number, shareCode: string, maxPlayers: number): LogWatcher {
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

      // Parse player query response: __PC:count:kuid1,kuid2,...
      const pcIndex = line.indexOf('__PC:');
      if (pcIndex !== -1) {
        const payload = line.substring(pcIndex + 5);
        const colonIndex = payload.indexOf(':');
        if (colonIndex !== -1) {
          const count = parseInt(payload.substring(0, colonIndex));
          const kuidsStr = payload.substring(colonIndex + 1);
          const list = kuidsStr ? kuidsStr.split(',') : [];
          this.emitPlayerUpdate(serverId, { count, max: maxPlayers, list });
        }
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

    // Query players periodically via FIFO
    const queryPlayers = () => this.sendFifoCommand(shareCode, 'Master', PLAYER_QUERY_CMD);
    const playerInterval = setInterval(queryPlayers, 15000);
    setTimeout(queryPlayers, 3000); // Initial query after server has time to boot

    return {
      close() {
        closed = true;
        clearInterval(playerInterval);
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

    const watcher = this.watchLog(serverId, server.share_code, server.max_players);
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
        this.clearPlayerCache(row.id);
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
          this.clearPlayerCache(row.id);
        }
      } catch (e) {
        console.error(`Failed to check PIDs for server ${row.id}:`, e);
      }
    }
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

    // Send cached player data immediately so SSE clients don't wait for next query
    const cached = this.playerCache.get(serverId);
    if (cached) {
      sseEmit(serverId, { type: 'players', data: cached });
    }
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

  clearPlayerCache(serverId: number) {
    this.playerCache.delete(serverId);
  }
}

export const Monitor = new ServerMonitor();

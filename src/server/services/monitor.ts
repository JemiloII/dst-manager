import fs from 'fs/promises';
import { watch, openSync, writeSync, closeSync, constants, statSync } from 'node:fs';
import path from 'path';
import db from '../db/schema.js';
import { sseEmit } from './sse.js';
import Servers from '../features/servers/servers.queries.js';
import { getClusterPath } from './dst.js';

type Shard = 'Master' | 'Caves';

interface ShardWatcher {
  close(): void;
}

interface ServerWatchers {
  master: ShardWatcher;
  caves: ShardWatcher;
  playerInterval: ReturnType<typeof setInterval>;
}

interface PlayerInfo {
  count: number;
  max: number;
  list: string[];
}

const PLAYER_QUERY_CMD = 'local t=TheNet:GetClientTable() if t then local k={} for i,v in ipairs(t) do if v.userid~="" and v.netid~=nil and v.netid~="" then k[#k+1]=v.userid end end print("__PC:"..#k..":"..table.concat(k,",")) end\n';

class ServerMonitor {
  private watchers = new Map<number, ServerWatchers>();
  private globalPollInterval: ReturnType<typeof setInterval> | null = null;
  private playerCache = new Map<number, PlayerInfo>();
  // Tracks per-shard shutdown to prevent duplicate kill timers (e.g. "1-Master", "1-Caves")
  private shuttingDown = new Set<string>();

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private sendFifoCommand(shareCode: string, shard: Shard, command: string): boolean {
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

  private killProcess(pid: number): void {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  }

  // Handles a single shard's shutdown independently. DST on Linux does not exit after
  // c_shutdown() — the process hangs after writing "Shutting down" as its final log line.
  // The world/player save completes BEFORE that message, but we wait 15 seconds as a
  // safety buffer to ensure all data is fully flushed to disk before killing the process.
  // Without this delay, killing too early corrupts save files and wipes player data.
  private async markShardStopped(serverId: number, shard: Shard) {
    const key = `${serverId}-${shard}`;
    if (this.shuttingDown.has(key)) return;
    this.shuttingDown.add(key);

    setTimeout(async () => {
      try {
        const pids = await Servers.getPids(serverId);
        const pid = shard === 'Master' ? pids?.master : pids?.caves;
        if (pid && await this.isProcessRunning(pid)) this.killProcess(pid);

        // Update DB to remove only this shard's PID
        const remaining = shard === 'Master'
          ? { caves: pids?.caves }
          : { master: pids?.master };

        const otherPid = shard === 'Master' ? pids?.caves : pids?.master;
        const otherAlive = otherPid ? await this.isProcessRunning(otherPid) : false;

        if (!otherAlive) {
          // Both shards are dead — fully stopped
          await Servers.updateStatus(serverId, 'stopped');
          await Servers.updatePids(serverId, null);
          sseEmit(serverId, { type: 'status', data: 'stopped' });
          this.clearPlayerCache(serverId);
          this.stopMonitoring(serverId);
        } else {
          // Other shard still running — update PIDs to reflect this shard is gone
          await Servers.updatePids(serverId, remaining);
        }
      } catch {}

      this.shuttingDown.delete(key);
    }, 15000);
  }

  private watchShardLog(serverId: number, shareCode: string, shard: Shard, maxPlayers: number): ShardWatcher {
    const shardDir = path.join(getClusterPath(shareCode), shard);
    const logPath = path.join(shardDir, 'server_log.txt');
    let offset = 0;
    let buffer = '';
    let fileWatcher: ReturnType<typeof watch> | null = null;
    let dirWatcher: ReturnType<typeof watch> | null = null;
    let closed = false;

    const processLine = async (line: string) => {
      // Only detect running status from Master shard
      if (shard === 'Master' && (line.includes('Sim paused') || line.includes('Sim unpaused'))) {
        const server = await Servers.findById(serverId);
        if (server?.status === 'starting') {
          await Servers.updateStatus(serverId, 'running');
          sseEmit(serverId, { type: 'status', data: 'running' });
        }
      }

      if (line.includes('Shutting down')) {
        await this.markShardStopped(serverId, shard);
      }

      // Parse player query response from Master only: __PC:count:kuid1,kuid2,...
      if (shard === 'Master') {
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
        dirWatcher = watch(shardDir, (_event, filename) => {
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

    const master = this.watchShardLog(serverId, server.share_code, 'Master', server.max_players);
    const caves = this.watchShardLog(serverId, server.share_code, 'Caves', server.max_players);

    const queryPlayers = () => this.sendFifoCommand(server.share_code, 'Master', PLAYER_QUERY_CMD);
    const playerInterval = setInterval(queryPlayers, 15000);
    setTimeout(queryPlayers, 3000);

    this.watchers.set(serverId, { master, caves, playerInterval });
  }

  stopMonitoring(serverId: number) {
    const w = this.watchers.get(serverId);
    if (w) {
      w.master.close();
      w.caves.close();
      clearInterval(w.playerInterval);
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
    for (const [id] of this.watchers) {
      this.stopMonitoring(id);
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

    const dbPids = await Servers.getPids(serverId);
    if (!dbPids) {
      if (server.status !== 'stopped') {
        await Servers.updateStatus(serverId, 'stopped');
      }
      sseEmit(serverId, { type: 'status', data: 'stopped' });
      return;
    }

    const masterRunning = dbPids.master ? await this.isProcessRunning(dbPids.master) : false;
    const cavesRunning = dbPids.caves ? await this.isProcessRunning(dbPids.caves) : false;

    if (!masterRunning && !cavesRunning) {
      await Servers.updateStatus(serverId, 'stopped');
      await Servers.updatePids(serverId, null);
      sseEmit(serverId, { type: 'status', data: 'stopped' });
      return;
    }

    // Check each shard's log for "Shutting down" independently
    for (const shard of ['Master', 'Caves'] as Shard[]) {
      try {
        const logPath = path.join(getClusterPath(server.share_code), shard, 'server_log.txt');
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.trim().split('\n');
        const lastLine = lines[lines.length - 1] || '';

        if (lastLine.includes('Shutting down')) {
          await this.markShardStopped(serverId, shard);
        }
      } catch {}
    }

    // Start watching if not already
    if (!this.watchers.has(serverId)) {
      this.startMonitoring(serverId);
    }

    sseEmit(serverId, { type: 'status', data: server.status });

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

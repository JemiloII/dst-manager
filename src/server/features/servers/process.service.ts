import { spawn, execSync } from 'child_process';
import fs from 'fs/promises';
import { openSync, writeSync, closeSync, statSync, unlinkSync, constants } from 'node:fs';
import path from 'path';
import { getClusterPath } from '@server/services/dst.js';
import Servers from './servers.queries.js';
import { sseEmit } from '@server/services/sse.js';

const { DST_INSTALL_DIR } = process.env;

if (!DST_INSTALL_DIR) {
  throw new Error('DST_INSTALL_DIR environment variable is required');
}

interface ServerProcess {
  masterPid?: number;
  cavesPid?: number;
  shareCode: string;
}

export class ProcessService {
  private processes = new Map<number, ServerProcess>();

  private getDstBinary(): string {
    return path.join(DST_INSTALL_DIR!, 'bin64', 'dontstarve_dedicated_server_nullrenderer_x64');
  }

  private getFifoPath(shareCode: string, shard: 'Master' | 'Caves' = 'Master'): string {
    return path.join(getClusterPath(shareCode), shard, 'console_pipe');
  }

  private ensureFifo(fifoPath: string): void {
    try {
      if (statSync(fifoPath).isFIFO()) return;
      unlinkSync(fifoPath);
    } catch {}
    execSync(`mkfifo "${fifoPath}"`);
  }

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private sendCommand(shareCode: string, command: string, shard: 'Master' | 'Caves' = 'Master'): boolean {
    try {
      const fifoPath = this.getFifoPath(shareCode, shard);
      const fd = openSync(fifoPath, constants.O_WRONLY | constants.O_NONBLOCK);
      writeSync(fd, Buffer.from(command + '\n'));
      closeSync(fd);
      return true;
    } catch {
      return false;
    }
  }

  private killProcess(pid: number): void {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  }

  private async markStopped(serverId: number): Promise<void> {
    await Servers.updateStatus(serverId, 'stopped');
    sseEmit(serverId, { type: 'status', data: 'stopped' });
    await Servers.updatePids(serverId, null);
    this.processes.delete(serverId);
  }

  private async resolveProcess(serverId: number): Promise<ServerProcess | null> {
    const cached = this.processes.get(serverId);
    if (cached) return cached;

    const dbServer = await Servers.findById(serverId);
    const dbPids = await Servers.getPids(serverId);
    if (!dbServer?.share_code || !dbPids || (!dbPids.master && !dbPids.caves)) return null;

    const proc: ServerProcess = {
      masterPid: dbPids.master,
      cavesPid: dbPids.caves,
      shareCode: dbServer.share_code,
    };

    this.processes.set(serverId, proc);
    return proc;
  }

  async startServer(serverId: number, kuid: string, shareCode: string): Promise<{ masterPid?: number, cavesPid?: number }> {
    const cached = this.processes.get(serverId);
    if (cached && (cached.masterPid || cached.cavesPid)) {
      const masterRunning = cached.masterPid ? await this.isProcessRunning(cached.masterPid) : false;
      const cavesRunning = cached.cavesPid ? await this.isProcessRunning(cached.cavesPid) : false;

      if (masterRunning || cavesRunning) {
        return { masterPid: cached.masterPid, cavesPid: cached.cavesPid };
      }
      this.processes.delete(serverId);
    }

    const dbServer = await Servers.findById(serverId);
    if (dbServer?.pids) {
      try {
        const pids = JSON.parse(dbServer.pids);
        if (pids.master || pids.caves) {
          const masterRunning = pids.master ? await this.isProcessRunning(pids.master) : false;
          const cavesRunning = pids.caves ? await this.isProcessRunning(pids.caves) : false;

          if (masterRunning || cavesRunning) {
            this.processes.set(serverId, { masterPid: pids.master, cavesPid: pids.caves, shareCode });
            return { masterPid: pids.master, cavesPid: pids.caves };
          }
          await Servers.updateStatus(serverId, 'stopped');
          await Servers.updatePids(serverId, null);
        }
      } catch {}
    }

    const clusterDir = getClusterPath(shareCode);
    const binary = this.getDstBinary();

    await Servers.updateStatus(serverId, 'starting');
    sseEmit(serverId, { type: 'status', data: 'starting' });
    await Servers.updatePids(serverId, null);

    // Create agreements file if it doesn't exist
    const agreementsDir = path.join(clusterDir, 'Agreements', 'DoNotStarveTogether');
    await fs.mkdir(agreementsDir, { recursive: true, mode: 0o775 });
    const agreementsFile = path.join(agreementsDir, 'agreements.ini');
    try {
      await fs.access(agreementsFile);
    } catch {
      await fs.writeFile(agreementsFile, '[agreements]\nprivacy_policy=accepted\neula=accepted\n');
    }

    // Create FIFOs for both shards
    const masterFifoPath = this.getFifoPath(shareCode, 'Master');
    const cavesFifoPath = this.getFifoPath(shareCode, 'Caves');
    this.ensureFifo(masterFifoPath);
    this.ensureFifo(cavesFifoPath);
    const masterFifoFd = openSync(masterFifoPath, constants.O_RDWR);
    const cavesFifoFd = openSync(cavesFifoPath, constants.O_RDWR);

    const masterProcess = spawn(binary, [
      '-console',
      '-persistent_storage_root', clusterDir,
      '-conf_dir', '.',
      '-cluster', '.',
      '-shard', 'Master',
    ], {
      cwd: path.dirname(binary),
      stdio: [masterFifoFd, 'ignore', 'ignore'],
      detached: true
    });

    const cavesProcess = spawn(binary, [
      '-console',
      '-persistent_storage_root', clusterDir,
      '-conf_dir', '.',
      '-cluster', '.',
      '-shard', 'Caves',
    ], {
      cwd: path.dirname(binary),
      stdio: [cavesFifoFd, 'ignore', 'ignore'],
      detached: true
    });

    masterProcess.unref();
    cavesProcess.unref();

    closeSync(masterFifoFd);
    closeSync(cavesFifoFd);

    await Servers.updatePids(serverId, {
      master: masterProcess.pid,
      caves: cavesProcess.pid
    });

    this.processes.set(serverId, {
      masterPid: masterProcess.pid,
      cavesPid: cavesProcess.pid,
      shareCode,
    });

    return {
      masterPid: masterProcess.pid,
      cavesPid: cavesProcess.pid
    };
  }

  private async waitForDeath(pids: number[], timeoutMs = 10000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const alive = await Promise.all(pids.map((p) => this.isProcessRunning(p)));
      if (alive.every((a) => !a)) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }

  async stopServer(serverId: number): Promise<void> {
    const proc = await this.resolveProcess(serverId);
    if (!proc) throw new Error('Server is not running');

    // Send c_shutdown() to both shards
    this.sendCommand(proc.shareCode, 'c_shutdown()', 'Master');
    this.sendCommand(proc.shareCode, 'c_shutdown()', 'Caves');

    // Wait for both processes to die, force kill if they don't
    const pids = [proc.masterPid, proc.cavesPid].filter(Boolean) as number[];
    const died = await this.waitForDeath(pids);
    if (!died) {
      for (const pid of pids) this.killProcess(pid);
    }

    await this.markStopped(serverId);
  }

  async forceKillServer(serverId: number): Promise<void> {
    const proc = await this.resolveProcess(serverId);
    if (!proc) throw new Error('Server is not running');

    if (proc.masterPid) this.killProcess(proc.masterPid);
    if (proc.cavesPid) this.killProcess(proc.cavesPid);
    await this.markStopped(serverId);
  }

  private async readLog(shareCode: string, shard: 'Master' | 'Caves'): Promise<string> {
    try {
      const logPath = path.join(getClusterPath(shareCode), shard, 'server_log.txt');
      return await fs.readFile(logPath, 'utf-8');
    } catch {
      return '';
    }
  }

  private lastLogLine(log: string): string {
    const lines = log.trim().split('\n');
    return lines[lines.length - 1] || '';
  }

  async verifyStatus(serverId: number, status: string, pidsJson?: string): Promise<string> {
    if (status === 'stopped' || !pidsJson) return status;

    const server = await Servers.findById(serverId);
    if (!server) return status;

    try {
      const pids = JSON.parse(pidsJson);

      // 1. Check if PIDs are running
      const masterRunning = pids.master ? await this.isProcessRunning(pids.master) : false;
      const cavesRunning = pids.caves ? await this.isProcessRunning(pids.caves) : false;

      // Both dead — done
      if (!masterRunning && !cavesRunning) {
        await this.markStopped(serverId);
        return 'stopped';
      }

      // 2. Read Master log — last line is the source of truth
      const masterLog = await this.readLog(server.share_code, 'Master');
      const lastLine = this.lastLogLine(masterLog);

      // Last line says "Shutting down" OR Master PID dead — kill Caves
      if ((lastLine.includes('Shutting down') || !masterRunning) && cavesRunning) {
        // 3. Tell Caves to shut down
        this.sendCommand(server.share_code, 'c_shutdown()', 'Caves');

        // 4. Poll for up to 30s waiting for both to die
        const allPids = [pids.master, pids.caves].filter(Boolean) as number[];
        const died = await this.waitForDeath(allPids, 30000);

        // 5. Force kill anything still alive
        if (!died) {
          for (const pid of allPids) this.killProcess(pid);
        }

        await this.markStopped(serverId);
        return 'stopped';
      }

      // Master dead alone (no caves PID) — clean up
      if (!masterRunning) {
        await this.markStopped(serverId);
        return 'stopped';
      }
    } catch {}

    return status;
  }

  async getServerStatus(serverId: number): Promise<{
    status: 'running' | 'stopped',
    masterPid?: number,
    cavesPid?: number
  }> {
    const proc = this.processes.get(serverId);
    if (proc && (proc.masterPid || proc.cavesPid)) {
      const masterRunning = proc.masterPid ? await this.isProcessRunning(proc.masterPid) : false;
      const cavesRunning = proc.cavesPid ? await this.isProcessRunning(proc.cavesPid) : false;

      if (masterRunning || cavesRunning) {
        return {
          status: 'running',
          masterPid: masterRunning ? proc.masterPid : undefined,
          cavesPid: cavesRunning ? proc.cavesPid : undefined
        };
      }
    }

    const dbServer = await Servers.findById(serverId);
    const dbPids = dbServer?.pids ? await Servers.getPids(serverId) : null;
    if (dbPids) {
      const masterRunning = dbPids.master ? await this.isProcessRunning(dbPids.master) : false;
      const cavesRunning = dbPids.caves ? await this.isProcessRunning(dbPids.caves) : false;

      if (masterRunning || cavesRunning) {
        if (dbServer?.share_code) {
          this.processes.set(serverId, {
            masterPid: masterRunning ? dbPids.master : undefined,
            cavesPid: cavesRunning ? dbPids.caves : undefined,
            shareCode: dbServer.share_code,
          });
        }

        return {
          status: 'running',
          masterPid: masterRunning ? dbPids.master : undefined,
          cavesPid: cavesRunning ? dbPids.caves : undefined
        };
      }
    }

    return { status: 'stopped' };
  }

  async checkAllServersOnStartup(): Promise<void> {
    const servers = await Servers.findAll();

    for (const server of servers) {
      const status = await this.getServerStatus(server.id);
      await Servers.updateStatus(server.id, status.status);

      if (status.status === 'running') {
        console.log(`Server ${server.id} is running (Master PID: ${status.masterPid}, Caves PID: ${status.cavesPid})`);
      } else if (server.pids) {
        console.log(`Server ${server.id} has dead PIDs, clearing...`);
        await Servers.updatePids(server.id, null);
      }
    }
  }
}

export const processService = new ProcessService();

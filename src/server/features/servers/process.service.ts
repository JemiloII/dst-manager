import { spawn, ChildProcess, execSync } from 'child_process';
import fs from 'fs/promises';
import { openSync, writeSync, closeSync, unlinkSync, constants } from 'node:fs';
import path from 'path';
import { getClusterPath } from '@server/services/dst.js';
import Servers from './servers.queries.js';
import { sseEmit } from '@server/services/sse.js';

const { DST_INSTALL_DIR } = process.env;

if (!DST_INSTALL_DIR) {
  throw new Error('DST_INSTALL_DIR environment variable is required');
}

interface ServerProcess {
  master: ChildProcess | null;
  caves: ChildProcess | null;
  masterPid?: number;
  cavesPid?: number;
  masterFifoFd?: number;
  cavesFifoFd?: number;
  shareCode?: string;
}

export class ProcessService {
  private processes = new Map<number, ServerProcess>();

  private getDstBinary(): string {
    return path.join(DST_INSTALL_DIR!, 'bin64', 'dontstarve_dedicated_server_nullrenderer_x64');
  }

  private getFifoPath(shareCode: string, shard: 'Master' | 'Caves'): string {
    return path.join(getClusterPath(shareCode), shard, 'stdin-fifo');
  }

  private createFifo(fifoPath: string): void {
    try { unlinkSync(fifoPath); } catch {}
    execSync(`mkfifo "${fifoPath}"`);
  }

  private openFifo(fifoPath: string): number {
    return openSync(fifoPath, constants.O_RDWR);
  }

  private closeFifos(proc: ServerProcess): void {
    if (proc.masterFifoFd !== undefined) {
      try { closeSync(proc.masterFifoFd); } catch {}
    }
    if (proc.cavesFifoFd !== undefined) {
      try { closeSync(proc.cavesFifoFd); } catch {}
    }
  }

  private tryReattachFifos(shareCode: string): { masterFd?: number; cavesFd?: number } | null {
    let masterFd: number | undefined;
    let cavesFd: number | undefined;
    try { masterFd = this.openFifo(this.getFifoPath(shareCode, 'Master')); } catch {}
    try { cavesFd = this.openFifo(this.getFifoPath(shareCode, 'Caves')); } catch {}
    if (masterFd === undefined && cavesFd === undefined) return null;
    return { masterFd, cavesFd };
  }

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async startServer(serverId: number, kuid: string, shareCode: string): Promise<{ masterPid?: number, cavesPid?: number }> {
    // First check cache but ALWAYS verify processes are actually running
    if (this.processes.has(serverId)) {
      const existing = this.processes.get(serverId)!;
      if (existing.masterPid || existing.cavesPid) {
        const masterRunning = existing.masterPid ? await this.isProcessRunning(existing.masterPid) : false;
        const cavesRunning = existing.cavesPid ? await this.isProcessRunning(existing.cavesPid) : false;

        if (masterRunning || cavesRunning) {
          return { masterPid: existing.masterPid, cavesPid: existing.cavesPid };
        } else {
          this.closeFifos(existing);
          this.processes.delete(serverId);
        }
      }
    }

    // Check database for running PIDs
    const dbServer = await Servers.findById(serverId);
    if (dbServer?.pids) {
      try {
        const pids = JSON.parse(dbServer.pids);
        if (pids.master || pids.caves) {
          const masterRunning = pids.master ? await this.isProcessRunning(pids.master) : false;
          const cavesRunning = pids.caves ? await this.isProcessRunning(pids.caves) : false;

          if (masterRunning || cavesRunning) {
            const fifos = this.tryReattachFifos(shareCode);
            this.processes.set(serverId, {
              master: null, caves: null,
              masterPid: pids.master, cavesPid: pids.caves,
              masterFifoFd: fifos?.masterFd, cavesFifoFd: fifos?.cavesFd,
              shareCode,
            });
            return { masterPid: pids.master, cavesPid: pids.caves };
          } else {
            await Servers.updateStatus(serverId, 'stopped');
            await Servers.updatePids(serverId, null);
          }
        }
      } catch (e) {
        // Invalid JSON, continue with starting
      }
    }

    const clusterDir = getClusterPath(shareCode);
    const binary = this.getDstBinary();

    // Update status to starting and clear old PIDs
    await Servers.updateStatus(serverId, 'starting');
    sseEmit(serverId, { type: 'status', data: 'starting' });
    await Servers.updatePids(serverId, null);

    // Create agreements file if it doesn't exist
    const agreementsDir = path.join(clusterDir, 'Agreements', 'DoNotStarveTogether');
    await fs.mkdir(agreementsDir, { recursive: true });
    const agreementsFile = path.join(agreementsDir, 'agreements.ini');
    try {
      await fs.access(agreementsFile);
    } catch {
      await fs.writeFile(agreementsFile, '[agreements]\nprivacy_policy=accepted\neula=accepted\n');
    }

    // Create named pipes (FIFOs) for stdin — survives Node restarts
    const masterFifoPath = this.getFifoPath(shareCode, 'Master');
    const cavesFifoPath = this.getFifoPath(shareCode, 'Caves');
    this.createFifo(masterFifoPath);
    this.createFifo(cavesFifoPath);
    const masterFifoFd = this.openFifo(masterFifoPath);
    const cavesFifoFd = this.openFifo(cavesFifoPath);

    // Start Master shard — O_RDWR fd keeps FIFO alive even if Node crashes
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

    // Start Caves shard
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

    // Unref to allow independent running
    masterProcess.unref();
    cavesProcess.unref();

    // Update status to running and save PIDs to database
    await Servers.updateStatus(serverId, 'running');
    sseEmit(serverId, { type: 'status', data: 'running' });
    await Servers.updatePids(serverId, {
      master: masterProcess.pid,
      caves: cavesProcess.pid
    });

    // Cache process info
    this.processes.set(serverId, {
      master: masterProcess,
      caves: cavesProcess,
      masterPid: masterProcess.pid,
      cavesPid: cavesProcess.pid,
      masterFifoFd,
      cavesFifoFd,
      shareCode,
    });

    return {
      masterPid: masterProcess.pid,
      cavesPid: cavesProcess.pid
    };
  }

  private killProcess(pid: number): void {
    try {
      // Kill the entire process group (negative PID)
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Already dead
      }
    }
  }

  private async waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!(await this.isProcessRunning(pid))) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }

  private sendCommand(proc: ServerProcess, command: string): boolean {
    const buf = Buffer.from(command + '\n');
    let sent = false;
    if (proc.masterFifoFd !== undefined) {
      try { writeSync(proc.masterFifoFd, buf); sent = true; } catch {}
    }
    if (proc.cavesFifoFd !== undefined) {
      try { writeSync(proc.cavesFifoFd, buf); sent = true; } catch {}
    }
    return sent;
  }

  private ensureFifos(proc: ServerProcess): boolean {
    if (proc.masterFifoFd !== undefined || proc.cavesFifoFd !== undefined) return true;
    if (!proc.shareCode) return false;

    const fifos = this.tryReattachFifos(proc.shareCode);
    if (!fifos) return false;

    proc.masterFifoFd = fifos.masterFd;
    proc.cavesFifoFd = fifos.cavesFd;
    return true;
  }

  async stopServer(serverId: number, force = false): Promise<void> {
    let proc = this.processes.get(serverId);

    if (!proc || (!proc.masterPid && !proc.cavesPid)) {
      // No cached process — check DB for running PIDs
      const dbServer = await Servers.findById(serverId);
      const dbPids = await Servers.getPids(serverId);
      if (!dbPids || (!dbPids.master && !dbPids.caves)) {
        throw new Error('Server is not running');
      }

      if (!force && dbServer?.share_code) {
        // Try graceful shutdown via FIFO reattach
        const fifos = this.tryReattachFifos(dbServer.share_code);
        if (fifos) {
          const tempProc: ServerProcess = {
            master: null, caves: null,
            masterPid: dbPids.master, cavesPid: dbPids.caves,
            masterFifoFd: fifos.masterFd, cavesFifoFd: fifos.cavesFd,
            shareCode: dbServer.share_code,
          };
          this.sendCommand(tempProc, 'c_shutdown()');
          const pids = [dbPids.master, dbPids.caves].filter(Boolean) as number[];
          const results = await Promise.all(pids.map((pid) => this.waitForExit(pid, 30000)));
          for (let i = 0; i < pids.length; i++) {
            if (!results[i]) this.killProcess(pids[i]);
          }
          this.closeFifos(tempProc);
        } else {
          // No FIFOs available — force kill only option
          if (dbPids.master) this.killProcess(dbPids.master);
          if (dbPids.caves) this.killProcess(dbPids.caves);
        }
      } else {
        if (dbPids.master) this.killProcess(dbPids.master);
        if (dbPids.caves) this.killProcess(dbPids.caves);
      }
    } else if (force) {
      if (proc.masterPid) this.killProcess(proc.masterPid);
      if (proc.cavesPid) this.killProcess(proc.cavesPid);
      this.closeFifos(proc);
    } else {
      // Graceful: ensure FIFOs, send c_shutdown(), wait up to 30s
      this.ensureFifos(proc);
      const sent = this.sendCommand(proc, 'c_shutdown()');
      const pids = [proc.masterPid, proc.cavesPid].filter(Boolean) as number[];

      if (sent) {
        const results = await Promise.all(pids.map((pid) => this.waitForExit(pid, 30000)));
        for (let i = 0; i < pids.length; i++) {
          if (!results[i]) this.killProcess(pids[i]);
        }
      } else {
        // Couldn't send command — force kill
        for (const pid of pids) this.killProcess(pid);
      }
      this.closeFifos(proc);
    }

    await Servers.updateStatus(serverId, 'stopped');
    sseEmit(serverId, { type: 'status', data: 'stopped' });
    await Servers.updatePids(serverId, null);
    this.processes.delete(serverId);
  }

  async getServerStatus(serverId: number): Promise<{
    status: 'running' | 'stopped',
    masterPid?: number,
    cavesPid?: number
  }> {
    // Check in-memory processes first
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

    // Check database PIDs
    const dbServer = await Servers.findById(serverId);
    const dbPids = dbServer?.pids ? await Servers.getPids(serverId) : null;
    if (dbPids) {
      const masterRunning = dbPids.master ? await this.isProcessRunning(dbPids.master) : false;
      const cavesRunning = dbPids.caves ? await this.isProcessRunning(dbPids.caves) : false;

      if (masterRunning || cavesRunning) {
        // Cache with shareCode for potential FIFO reattach later
        this.processes.set(serverId, {
          master: null, caves: null,
          masterPid: masterRunning ? dbPids.master : undefined,
          cavesPid: cavesRunning ? dbPids.caves : undefined,
          shareCode: dbServer?.share_code,
        });

        return {
          status: 'running',
          masterPid: masterRunning ? dbPids.master : undefined,
          cavesPid: cavesRunning ? dbPids.caves : undefined
        };
      }
    }

    // No PIDs found
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
        // Server has PIDs but isn't running - clear them
        console.log(`Server ${server.id} has dead PIDs, clearing...`);
        await Servers.updatePids(server.id, null);
      }
    }
  }
}

export const processService = new ProcessService();

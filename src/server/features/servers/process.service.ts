import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
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
}

export class ProcessService {
  private processes = new Map<number, ServerProcess>();
  
  private getDstBinary(): string {
    return path.join(DST_INSTALL_DIR, 'bin64', 'dontstarve_dedicated_server_nullrenderer_x64');
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
        // Verify the cached PIDs are still running
        const masterRunning = existing.masterPid ? await this.isProcessRunning(existing.masterPid) : false;
        const cavesRunning = existing.cavesPid ? await this.isProcessRunning(existing.cavesPid) : false;
        
        if (masterRunning || cavesRunning) {
          // Processes still running, return them
          return { 
            masterPid: existing.masterPid, 
            cavesPid: existing.cavesPid 
          };
        } else {
          // Processes dead, clear cache
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
          // Check if processes are actually running
          const masterRunning = pids.master ? await this.isProcessRunning(pids.master) : false;
          const cavesRunning = pids.caves ? await this.isProcessRunning(pids.caves) : false;
          
          if (masterRunning || cavesRunning) {
            // Cache the process info and return
            this.processes.set(serverId, {
              master: null,
              caves: null,
              masterPid: pids.master,
              cavesPid: pids.caves
            });
            return { 
              masterPid: pids.master, 
              cavesPid: pids.caves 
            };
          } else {
            // Processes are dead, clear the database
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

    // Start Master shard
    const masterProcess = spawn(binary, [
      '-console',
      '-persistent_storage_root', clusterDir,
      '-conf_dir', '.',
      '-cluster', '.',
      '-shard', 'Master',
    ], { 
      cwd: path.dirname(binary), // Run from bin64 directory
      stdio: 'ignore',
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
      cwd: path.dirname(binary), // Run from bin64 directory
      stdio: 'ignore',
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
      cavesPid: cavesProcess.pid
    });

    return {
      masterPid: masterProcess.pid,
      cavesPid: cavesProcess.pid
    };
  }

  async stopServer(serverId: number): Promise<void> {
    const proc = this.processes.get(serverId);
    
    // If not in memory, try to get PIDs from database
    if (!proc || (!proc.masterPid && !proc.cavesPid)) {
      const dbPids = await Servers.getPids(serverId);
      
      if (!dbPids || (!dbPids.master && !dbPids.caves)) {
        throw new Error('Server is not running');
      }
      
      // Kill by PID
      if (dbPids.master && await this.isProcessRunning(dbPids.master)) {
        process.kill(dbPids.master, 'SIGTERM');
      }
      if (dbPids.caves && await this.isProcessRunning(dbPids.caves)) {
        process.kill(dbPids.caves, 'SIGTERM');
      }
    } else {
      // Use existing process handles
      if (proc.master) proc.master.kill('SIGTERM');
      if (proc.caves) proc.caves.kill('SIGTERM');
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
    
    // Check database PIDs first
    const dbPids = await Servers.getPids(serverId);
    if (dbPids) {
      const masterRunning = dbPids.master ? await this.isProcessRunning(dbPids.master) : false;
      const cavesRunning = dbPids.caves ? await this.isProcessRunning(dbPids.caves) : false;
      
      if (masterRunning || cavesRunning) {
        // Update cache
        this.processes.set(serverId, {
          master: null,
          caves: null,
          masterPid: masterRunning ? dbPids.master : undefined,
          cavesPid: cavesRunning ? dbPids.caves : undefined
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
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { env } from '../env.js';
import { getClusterPath } from './dst.js';
import db from '../db/schema.js';
import { sseEmit } from './sse.js';

interface ServerProcess {
  master: ChildProcess | null;
  caves: ChildProcess | null;
}

const processes = new Map<number, ServerProcess>();

function getDstBinary(): string {
  return path.join(env.DST_INSTALL_DIR, 'bin64', 'dontstarve_dedicated_server_nullrenderer_x64');
}

export async function startServer(serverId: number, kuid: string, shareCode: string, clusterToken: string) {
  if (processes.has(serverId)) {
    const existing = processes.get(serverId)!;
    if (existing.master || existing.caves) {
      throw new Error('Server is already running');
    }
  }

  const clusterDir = getClusterPath(kuid, shareCode);
  const binary = getDstBinary();

  await db.execute({ sql: 'UPDATE servers SET status = ? WHERE id = ?', args: ['starting', serverId] });
  sseEmit(serverId, { type: 'status', data: 'starting' });

  const masterProcess = spawn(binary, [
    '-console',
    '-persistent_storage_root', env.SERVERS_DIR,
    '-conf_dir', shareCode,
    '-cluster', shareCode,
    '-token', clusterToken,
    '-shard', 'Master',
  ], { cwd: path.join(env.DST_INSTALL_DIR, 'bin64'), stdio: ['pipe', 'pipe', 'pipe'] });

  const cavesProcess = spawn(binary, [
    '-console',
    '-persistent_storage_root', env.SERVERS_DIR,
    '-conf_dir', shareCode,
    '-cluster', shareCode,
    '-token', clusterToken,
    '-shard', 'Caves',
  ], { cwd: path.join(env.DST_INSTALL_DIR, 'bin64'), stdio: ['pipe', 'pipe', 'pipe'] });

  processes.set(serverId, { master: masterProcess, caves: cavesProcess });

  masterProcess.stdout?.on('data', (data: Buffer) => {
    const line = data.toString();
    sseEmit(serverId, { type: 'log', shard: 'Master', data: line });
    if (line.includes('Sim paused')) {
      db.execute({ sql: 'UPDATE servers SET status = ? WHERE id = ?', args: ['running', serverId] });
      sseEmit(serverId, { type: 'status', data: 'running' });
    }
  });

  cavesProcess.stdout?.on('data', (data: Buffer) => {
    sseEmit(serverId, { type: 'log', shard: 'Caves', data: data.toString() });
  });

  masterProcess.stderr?.on('data', (data: Buffer) => {
    sseEmit(serverId, { type: 'log', shard: 'Master', data: data.toString() });
  });

  cavesProcess.stderr?.on('data', (data: Buffer) => {
    sseEmit(serverId, { type: 'log', shard: 'Caves', data: data.toString() });
  });

  const onExit = (shard: string) => (code: number | null) => {
    sseEmit(serverId, { type: 'log', shard, data: `Process exited with code ${code}` });
    const proc = processes.get(serverId);
    if (proc) {
      if (shard === 'Master') proc.master = null;
      if (shard === 'Caves') proc.caves = null;
      if (!proc.master && !proc.caves) {
        processes.delete(serverId);
        db.execute({ sql: 'UPDATE servers SET status = ? WHERE id = ?', args: ['stopped', serverId] });
        sseEmit(serverId, { type: 'status', data: 'stopped' });
      }
    }
  };

  masterProcess.on('exit', onExit('Master'));
  cavesProcess.on('exit', onExit('Caves'));
}

export async function stopServer(serverId: number) {
  const proc = processes.get(serverId);
  if (!proc) {
    throw new Error('Server is not running');
  }

  if (proc.master) {
    proc.master.stdin?.write('c_shutdown(true)\n');
  }
  if (proc.caves) {
    proc.caves.stdin?.write('c_shutdown(true)\n');
  }

  setTimeout(() => {
    const current = processes.get(serverId);
    if (current?.master) current.master.kill('SIGTERM');
    if (current?.caves) current.caves.kill('SIGTERM');
  }, 10000);
}

export function getServerProcessStatus(serverId: number): 'running' | 'stopped' {
  const proc = processes.get(serverId);
  if (!proc) return 'stopped';
  if (proc.master || proc.caves) return 'running';
  return 'stopped';
}

export function sendCommand(serverId: number, shard: 'Master' | 'Caves', command: string) {
  const proc = processes.get(serverId);
  if (!proc) throw new Error('Server is not running');
  const target = shard === 'Master' ? proc.master : proc.caves;
  if (!target) throw new Error(`${shard} shard is not running`);
  target.stdin?.write(command + '\n');
}

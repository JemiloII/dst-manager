import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DSTLobbyClient, Regions } from '@server/features/lobbies/lobby-client.service.js';
import Servers from '@server/features/servers/servers.queries.js';
import { Monitor } from '@server/services/monitor.js';

const execAsync = promisify(exec);
const { DST_INSTALL_DIR = '' } = process.env;

class DSTUpdater {
  private updating = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  async getLocalVersion(): Promise<number> {
    try {
      const content = await fs.readFile(path.join(DST_INSTALL_DIR, 'version.txt'), 'utf-8');
      return parseInt(content.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  async getLiveVersion(): Promise<number> {
    try {
      const client = new DSTLobbyClient();
      const servers = await client.getLobbyServers(Regions.US_EAST_1);
      if (!servers.length) return 0;
      return Math.max(...servers.map(s => s.v));
    } catch {
      return 0;
    }
  }

  async updateDST(): Promise<boolean> {
    const cmd = `steamcmd +force_install_dir "${DST_INSTALL_DIR}" +login anonymous +app_update 343050 validate +quit`;
    try {
      console.log('[updater] Running steamcmd update...');
      await execAsync(cmd, { timeout: 300000 });
      console.log('[updater] steamcmd update completed');
      return true;
    } catch (e) {
      console.error('[updater] steamcmd update failed:', e);
      return false;
    }
  }

  async announceAndRestartAll(): Promise<void> {
    // Lazy imports to avoid circular dependency with process.service
    const { processService } = await import('@server/features/servers/process.service.js');
    const { serverService } = await import('@server/features/servers/servers.service.js');

    const servers = await Servers.getRunningServers();
    if (!servers.length) return;

    console.log(`[updater] Announcing update to ${servers.length} running server(s)`);

    for (const server of servers) {
      processService.announce(server.share_code, 'Server restarting in 30 seconds for game update');
    }

    await new Promise(r => setTimeout(r, 30000));

    for (const server of servers) {
      try {
        await processService.stopServer(server.id);
        console.log(`[updater] Stopped server ${server.id}`);
      } catch (e) {
        console.error(`[updater] Failed to stop server ${server.id}:`, e);
      }
    }

    for (const server of servers) {
      try {
        await serverService.startServer(server.id, server.user_id, true);
        Monitor.startMonitoring(server.id);
        console.log(`[updater] Restarted server ${server.id}`);
      } catch (e) {
        console.error(`[updater] Failed to restart server ${server.id}:`, e);
      }
    }
  }

  async checkAndUpdate(): Promise<boolean> {
    if (this.updating) return false;

    this.updating = true;
    try {
      const [local, live] = await Promise.all([this.getLocalVersion(), this.getLiveVersion()]);

      if (live === 0 || local === 0) {
        if (local === 0) console.log('[updater] Local version unknown, running steamcmd to ensure up-to-date');
        if (live === 0) console.log('[updater] Could not fetch live version, skipping');
        if (local === 0) await this.updateDST();
        return false;
      }

      if (live === local) return false;

      console.log(`[updater] Update available (local: ${local}, live: ${live}), updating DST...`);
      const success = await this.updateDST();
      if (!success) return false;

      const newLocal = await this.getLocalVersion();
      if (newLocal === local) {
        console.log('[updater] steamcmd ran but version unchanged, skipping restart');
        return false;
      }

      console.log(`[updater] DST updated from ${local} to ${newLocal}`);
      await this.announceAndRestartAll();
      return true;
    } finally {
      this.updating = false;
    }
  }

  async checkOnServerStart(): Promise<void> {
    await this.checkAndUpdate();
  }

  startPeriodicCheck(intervalMs = 300000): void {
    if (this.intervalId) return;
    console.log(`[updater] Starting periodic check every ${intervalMs / 1000}s`);
    this.intervalId = setInterval(() => this.checkAndUpdate(), intervalMs);
  }

  stopPeriodicCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const updater = new DSTUpdater();

import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import AdminQueries from './admin.queries.js';
import { getClusterPath } from '@server/services/dst.js';

const execAsync = promisify(exec);

class AdminService {
  async updateDst() {
    const { stdout, stderr } = await execAsync('steamcmd +login anonymous +app_update 343050 +quit', {
      timeout: 300000,
    });
    return stdout + stderr;
  }

  async exportServer(serverId: number, userId: number, userRole: string) {
    const server = await AdminQueries.findServerById(serverId);
    if (!server) throw new Error('Server not found');
    if (userRole !== 'admin' && server.user_id !== userId) {
      throw new Error('Forbidden');
    }

    const clusterDir = getClusterPath(server.share_code);
    const zipName = `Cluster_${server.share_code}.tar.gz`;
    const zipPath = path.join('/tmp', zipName);

    await execAsync(`tar -czf "${zipPath}" -C "${path.dirname(clusterDir)}" "${path.basename(clusterDir)}"`);

    const stat = await fs.stat(zipPath);
    const fileStream = createReadStream(zipPath);

    return { fileStream, zipName, size: stat.size };
  }
}

export const adminService = new AdminService();

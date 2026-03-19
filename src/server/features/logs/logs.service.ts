import fs from 'fs/promises';
import path from 'path';
import LogQueries from './logs.queries.js';
import { getClusterPath } from '@server/services/dst.js';

class LogService {
  async getLogPath(userId: number, userRole: string, code: string, shard: string): Promise<string | null> {
    if (shard !== 'Master' && shard !== 'Caves' && shard !== 'Chat') return null;

    const server = await LogQueries.findServerByCode(code);
    if (!server) return null;
    if (userRole !== 'admin' && server.user_id !== userId) return null;

    const clusterPath = getClusterPath(server.share_code);
    if (shard === 'Chat') return path.join(clusterPath, 'Master', 'server_chat_log.txt');
    return path.join(clusterPath, shard, 'server_log.txt');
  }

  async readLog(logPath: string, lines: number): Promise<string> {
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    } catch {
      return '';
    }
  }

  async clearLog(logPath: string): Promise<void> {
    try {
      await fs.writeFile(logPath, '');
    } catch {
      // file might not exist
    }
  }
}

export const logService = new LogService();

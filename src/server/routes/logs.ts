import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';
import { getClusterPath } from '../services/dst.js';

const logs = new Hono();

logs.use('*', authMiddleware());

async function getServerLogPath(userId: number, userRole: string, serverId: string, shard: string) {
  if (shard !== 'Master' && shard !== 'Caves' && shard !== 'Chat') return null;

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE share_code = ?', args: [serverId] });
  if (result.rows.length === 0) return null;

  const server = result.rows[0];
  if (userRole !== 'admin' && server.user_id !== userId) return null;

  const clusterPath = getClusterPath(server.share_code as string);
  if (shard === 'Chat') return path.join(clusterPath, 'Master', 'server_chat_log.txt');
  return path.join(clusterPath, shard, 'server_log.txt');
}

logs.get('/:serverId/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = c.req.param('serverId');
  const shard = c.req.param('shard');
  const lines = parseInt(c.req.query('lines') || '200');

  const logFile = await getServerLogPath(user.id, user.role, serverId, shard);
  if (!logFile) return c.json({ error: 'Not found or forbidden' }, 404);

  try {
    const content = await fs.readFile(logFile, 'utf-8');
    const allLines = content.split('\n');
    const tail = allLines.slice(-lines).join('\n');
    return c.json({ log: tail });
  } catch {
    return c.json({ log: '' });
  }
});

logs.get('/:serverId/:shard/stream', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = c.req.param('serverId');
  const shard = c.req.param('shard');

  const logFile = await getServerLogPath(user.id, user.role, serverId, shard);
  if (!logFile) return c.json({ error: 'Not found or forbidden' }, 404);

  return streamSSE(c, async (stream) => {
    let offset = 0;
    let alive = true;

    stream.onAbort(() => { alive = false; });

    // Get initial file size
    try {
      const stat = await fs.stat(logFile);
      offset = stat.size;
    } catch {
      offset = 0;
    }

    while (alive) {
      try {
        const stat = await fs.stat(logFile);

        // File was truncated/cleared
        if (stat.size < offset) {
          offset = 0;
        }

        if (stat.size > offset) {
          const fh = await fs.open(logFile, 'r');
          const buf = Buffer.alloc(stat.size - offset);
          await fh.read(buf, 0, buf.length, offset);
          await fh.close();
          offset = stat.size;

          const text = buf.toString('utf-8');
          if (text.trim()) {
            await stream.writeSSE({ data: text, event: 'log' });
          }
        }
      } catch {
        // File might not exist yet, keep polling
      }

      await stream.sleep(1500);
    }
  });
});

logs.delete('/:serverId/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = c.req.param('serverId');
  const shard = c.req.param('shard');

  const logFile = await getServerLogPath(user.id, user.role, serverId, shard);
  if (!logFile) return c.json({ error: 'Not found or forbidden' }, 404);

  try {
    await fs.writeFile(logFile, '');
  } catch {}

  return c.json({ success: true });
});

export default logs;

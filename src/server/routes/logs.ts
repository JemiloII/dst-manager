import { Hono } from 'hono';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';
import { getClusterPath } from '../services/dst.js';

const logs = new Hono();

logs.use('*', authMiddleware());

logs.get('/:serverId/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = parseInt(c.req.param('serverId'));
  const shard = c.req.param('shard');
  const lines = parseInt(c.req.query('lines') || '200');

  if (shard !== 'Master' && shard !== 'Caves') {
    return c.json({ error: 'Invalid shard' }, 400);
  }

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [serverId] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const clusterDir = getClusterPath(server.kuid as string, server.share_code as string);
  const logFile = path.join(clusterDir, shard, 'server_log.txt');

  try {
    const content = await fs.readFile(logFile, 'utf-8');
    const allLines = content.split('\n');
    const tail = allLines.slice(-lines).join('\n');
    return c.json({ log: tail });
  } catch {
    return c.json({ log: '' });
  }
});

logs.delete('/:serverId/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = parseInt(c.req.param('serverId'));
  const shard = c.req.param('shard');

  if (shard !== 'Master' && shard !== 'Caves') {
    return c.json({ error: 'Invalid shard' }, 400);
  }

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [serverId] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const clusterDir = getClusterPath(server.kuid as string, server.share_code as string);
  const logFile = path.join(clusterDir, shard, 'server_log.txt');

  try {
    await fs.writeFile(logFile, '');
  } catch {}

  return c.json({ success: true });
});

export default logs;

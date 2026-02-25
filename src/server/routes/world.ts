import { Hono } from 'hono';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';
import { getClusterPath } from '../services/dst.js';
import { parseLuaOverrides, generateLevelDataOverride } from '../services/lua.js';

const world = new Hono();

world.use('*', authMiddleware());

world.get('/:code/:shard', async (c) => {
  const user = c.get('user') as JwtPayload;
  const code = c.req.param('code');
  const shard = c.req.param('shard');

  if (shard !== 'Master' && shard !== 'Caves') {
    return c.json({ error: 'Invalid shard, must be Master or Caves' }, 400);
  }

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE share_code = ?', args: [code] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && user.role !== 'guest' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const clusterDir = getClusterPath(server.kuid as string, server.share_code as string);
  const filePath = path.join(clusterDir, shard, 'leveldataoverride.lua');

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const overrides = parseLuaOverrides(content);
    if (!overrides) {
      return c.json({ error: 'Failed to parse level data override' }, 500);
    }
    return c.json({ overrides, raw: content });
  } catch {
    return c.json({ overrides: {}, raw: '' });
  }
});

world.put('/:code/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const code = c.req.param('code');
  const shard = c.req.param('shard');

  if (shard !== 'Master' && shard !== 'Caves') {
    return c.json({ error: 'Invalid shard, must be Master or Caves' }, 400);
  }

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE share_code = ?', args: [code] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { overrides, raw } = body;

  let finalOverrides: Record<string, string | boolean | number>;

  if (raw) {
    const parsed = parseLuaOverrides(raw);
    if (!parsed) {
      return c.json({ error: 'Invalid or dangerous Lua content detected' }, 400);
    }
    finalOverrides = parsed;
  } else {
    finalOverrides = overrides || {};
  }

  const location = shard === 'Caves' ? 'cave' : 'forest';
  const preset = shard === 'Caves' ? 'DST_CAVE' : 'ENDLESS';
  const content = generateLevelDataOverride(preset, location, finalOverrides);

  const clusterDir = getClusterPath(server.kuid as string, server.share_code as string);
  await fs.writeFile(path.join(clusterDir, shard, 'leveldataoverride.lua'), content);

  return c.json({ success: true });
});

export default world;

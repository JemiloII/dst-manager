import { Hono } from 'hono';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';
import { env } from '../env.js';
import {
  extractKuid,
  generateShareCode,
  createServerFiles,
  updateClusterIni,
  getClusterPath,
  getPortsForServer,
} from '../services/dst.js';
import { startServer, stopServer, sendCommand } from '../services/process.js';
import { sseHandler } from '../services/sse.js';
import { checkPortRange } from '../utils/ports.js';

const servers = new Hono();

servers.use('*', authMiddleware());

servers.get('/', async (c) => {
  const user = c.get('user') as JwtPayload;
  let result;
  if (user.role === 'admin') {
    result = await db.execute({ sql: 'SELECT * FROM servers ORDER BY created_at DESC', args: [] });
  } else {
    result = await db.execute({
      sql: 'SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC',
      args: [user.id],
    });
  }
  return c.json(result.rows);
});

servers.get('/shared/:code', async (c) => {
  const code = c.req.param('code');
  const result = await db.execute({
    sql: 'SELECT id, name, description, max_players, game_mode, pvp, status, share_code FROM servers WHERE share_code = ?',
    args: [code],
  });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }
  return c.json(result.rows[0]);
});

servers.post('/', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const body = await c.req.json();
  const { name, clusterToken, description, gameMode, maxPlayers, pvp, password } = body;

  if (!name || !clusterToken) {
    return c.json({ error: 'Name and cluster token required' }, 400);
  }

  const kuid = extractKuid(clusterToken);
  if (!kuid) {
    return c.json({ error: 'Could not extract KUID from cluster token' }, 400);
  }

  const maxAllowed = user.role === 'admin' ? 64 : 6;
  const playerCount = Math.min(maxPlayers || 6, maxAllowed);

  const shareCode = generateShareCode();

  // Find an available port range
  let portOffset = 0;
  let portsAvailable = false;
  const maxTries = 100; // Check up to 100 server slots
  
  for (let i = 0; i < maxTries; i++) {
    const testPorts = getPortsForServer(i);
    const available = await checkPortRange(testPorts.masterPort, 7);
    
    if (available) {
      // Also check if this offset is not already in use
      const existing = await db.execute({
        sql: 'SELECT id FROM servers WHERE port_offset = ?',
        args: [i],
      });
      
      if (existing.rows.length === 0) {
        portOffset = i;
        portsAvailable = true;
        break;
      }
    }
  }
  
  if (!portsAvailable) {
    return c.json({ error: 'No available port range found. Please check if ports are in use.' }, 400);
  }

  const result = await db.execute({
    sql: `INSERT INTO servers (user_id, name, description, cluster_token, kuid, share_code, max_players, game_mode, pvp, password, port_offset)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      user.id, name, description || '', clusterToken, kuid, shareCode,
      playerCount, gameMode || 'survival', pvp ? 1 : 0, password || '', portOffset,
    ],
  });

  const serverId = Number(result.lastInsertRowid);

  await createServerFiles(kuid, serverId, clusterToken, portOffset, {
    name,
    description: description || '',
    gameMode: gameMode || 'survival',
    maxPlayers: playerCount,
    pvp: !!pvp,
    password: password || '',
  });

  return c.json({ id: serverId, shareCode }, 201);
});

servers.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload;
  const id = parseInt(c.req.param('id'));

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  return c.json(server);
});

servers.put('/:id', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const id = parseInt(c.req.param('id'));

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { name, description, gameMode, maxPlayers, pvp, password } = body;

  const maxAllowed = user.role === 'admin' ? 64 : 6;
  const playerCount = Math.min(maxPlayers || (server.max_players as number), maxAllowed);

  await db.execute({
    sql: `UPDATE servers SET name = ?, description = ?, game_mode = ?, max_players = ?, pvp = ?, password = ? WHERE id = ?`,
    args: [
      name || server.name, description ?? server.description,
      gameMode || server.game_mode, playerCount, pvp !== undefined ? (pvp ? 1 : 0) : server.pvp,
      password ?? server.password, id,
    ],
  });

  await updateClusterIni(server.kuid as string, id, server.port_offset as number, {
    name: name || (server.name as string),
    description: (description ?? server.description) as string,
    gameMode: gameMode || (server.game_mode as string),
    maxPlayers: playerCount,
    pvp: pvp !== undefined ? !!pvp : !!(server.pvp as number),
    password: (password ?? server.password) as string,
  });

  return c.json({ success: true });
});

servers.delete('/:id', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const id = parseInt(c.req.param('id'));

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    await stopServer(id);
  } catch {}

  const clusterDir = getClusterPath(server.kuid as string, id);
  await fs.rm(clusterDir, { recursive: true, force: true });

  await db.execute({ sql: 'DELETE FROM mod_suggestions WHERE server_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM servers WHERE id = ?', args: [id] });

  return c.json({ success: true });
});

servers.post('/:id/start', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const id = parseInt(c.req.param('id'));

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Check if ports are available before starting
  const ports = getPortsForServer(server.port_offset as number);
  const portsAvailable = await checkPortRange(ports.masterPort, 7);
  
  if (!portsAvailable) {
    return c.json({ 
      error: `Ports ${ports.masterPort}-${ports.masterPort + 6} are already in use. Please stop any conflicting services.` 
    }, 400);
  }
  
  try {
    await startServer(id, server.kuid as string, server.cluster_token as string);
    return c.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to start server';
    return c.json({ error: msg }, 400);
  }
});

servers.post('/:id/stop', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const id = parseInt(c.req.param('id'));

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    await stopServer(id);
    return c.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to stop server';
    return c.json({ error: msg }, 400);
  }
});

servers.post('/:id/command', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const id = parseInt(c.req.param('id'));
  const { shard, command } = await c.req.json();

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    sendCommand(id, shard || 'Master', command);
    return c.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to send command';
    return c.json({ error: msg }, 400);
  }
});

servers.get('/:id/events', (c) => {
  const id = parseInt(c.req.param('id'));
  return sseHandler(id)(c);
});

export default servers;

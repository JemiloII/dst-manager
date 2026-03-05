import { Hono } from 'hono';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';
import * as modService from '../features/mods/mods.service.js';
import { generateModOverrides } from '../services/lua.js';
import { updateModsSetup } from '../services/dst.js';
import Servers from '../features/servers/servers.queries.js';

type Variables = {
  user: JwtPayload;
};

const suggestions = new Hono<{ Variables: Variables }>();

suggestions.use('*', authMiddleware());

suggestions.get('/:serverId', async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');

  const serverResult = await db.execute({ sql: 'SELECT * FROM servers WHERE share_code = ?', args: [serverId] });
  if (serverResult.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = serverResult.rows[0];
  const isMember = await Servers.isGuest(server.id as number, user.id);
  if (user.role !== 'admin' && server.user_id !== user.id && !isMember) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const result = await db.execute({
    sql: `SELECT ms.*, u.display_name as suggested_by
          FROM mod_suggestions ms
          JOIN users u ON ms.user_id = u.id
          WHERE ms.server_id = (SELECT id FROM servers WHERE share_code = ?)
          ORDER BY CASE ms.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'denied' THEN 2 END, ms.created_at DESC`,
    args: [serverId],
  });

  return c.json(result.rows);
});

suggestions.post('/:serverId', async (c) => {
  const user = c.get('user');
  const shareCode = c.req.param('serverId');
  const { workshopId, suggestedConfig } = await c.req.json();

  if (!workshopId) {
    return c.json({ error: 'Workshop ID required' }, 400);
  }

  const serverResult = await db.execute({ sql: 'SELECT id, user_id FROM servers WHERE share_code = ?', args: [shareCode] });
  if (serverResult.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = serverResult.rows[0];

  // Any authenticated non-owner can submit suggestions
  if (user.role !== 'admin' && server.user_id === user.id) {
    return c.json({ error: 'Owners cannot suggest mods on their own server' }, 403);
  }

  const serverId = server.id as number;
  await db.execute({
    sql: 'INSERT INTO mod_suggestions (server_id, user_id, workshop_id, suggested_config) VALUES (?, ?, ?, ?)',
    args: [serverId, user.id, workshopId, JSON.stringify(suggestedConfig || {})],
  });

  return c.json({ success: true }, 201);
});

suggestions.put('/:id/approve', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  const result = await db.execute({
    sql: `SELECT ms.*, s.user_id as server_owner, s.share_code, s.id as srv_id
          FROM mod_suggestions ms
          JOIN servers s ON ms.server_id = s.id
          WHERE ms.id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return c.json({ error: 'Suggestion not found' }, 404);
  }

  const suggestion = result.rows[0];
  if (user.role !== 'admin' && suggestion.server_owner !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Update suggestion status
  await db.execute({
    sql: 'UPDATE mod_suggestions SET status = ? WHERE id = ?',
    args: ['approved', id],
  });

  // Auto-install the mod
  const shareCode = suggestion.share_code as string;
  const workshopId = suggestion.workshop_id as string;
  const suggestedConfig = suggestion.suggested_config
    ? JSON.parse(suggestion.suggested_config as string)
    : {};

  const currentMods = await modService.getServerModOverrides(shareCode) || {};
  const modKey = `workshop-${workshopId}`;

  if (!(modKey in currentMods)) {
    currentMods[modKey] = {
      enabled: true,
      configuration_options: suggestedConfig,
    };

    const content = generateModOverrides(currentMods);
    await modService.saveModOverrides(shareCode, content);

    const enabledCount = Object.values(currentMods).filter((m) => m.enabled).length;
    await Servers.updateModCount(suggestion.srv_id as number, enabledCount);

    // Update dedicated_server_mods_setup.lua with all workshop IDs
    const allServers = await modService.getAllServers();
    const allWorkshopIds = new Set<string>();

    for (const srv of allServers) {
      const parsed = await modService.getServerModOverrides(srv.share_code as string);
      if (parsed) {
        for (const key of Object.keys(parsed)) {
          allWorkshopIds.add(key.replace('workshop-', ''));
        }
      }
    }

    await updateModsSetup(Array.from(allWorkshopIds));
  }

  return c.json({ success: true });
});

suggestions.put('/:id/deny', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  const result = await db.execute({
    sql: 'SELECT ms.*, s.user_id as server_owner FROM mod_suggestions ms JOIN servers s ON ms.server_id = s.id WHERE ms.id = ?',
    args: [id],
  });

  if (result.rows.length === 0) {
    return c.json({ error: 'Suggestion not found' }, 404);
  }

  const suggestion = result.rows[0];
  if (user.role !== 'admin' && suggestion.server_owner !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await db.execute({
    sql: 'UPDATE mod_suggestions SET status = ? WHERE id = ?',
    args: ['denied', id],
  });

  return c.json({ success: true });
});

export default suggestions;

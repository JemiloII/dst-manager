import { Hono } from 'hono';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';

const suggestions = new Hono();

suggestions.use('*', authMiddleware());

suggestions.get('/:serverId', async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = parseInt(c.req.param('serverId'));

  const serverResult = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [serverId] });
  if (serverResult.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = serverResult.rows[0];
  if (user.role !== 'admin' && user.role !== 'guest' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const result = await db.execute({
    sql: `SELECT ms.*, u.display_name as suggested_by
          FROM mod_suggestions ms
          JOIN users u ON ms.user_id = u.id
          WHERE ms.server_id = ?
          ORDER BY ms.created_at DESC`,
    args: [serverId],
  });

  return c.json(result.rows);
});

suggestions.post('/:serverId', async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = parseInt(c.req.param('serverId'));
  const { workshopId, suggestedConfig } = await c.req.json();

  if (!workshopId) {
    return c.json({ error: 'Workshop ID required' }, 400);
  }

  const serverResult = await db.execute({ sql: 'SELECT id FROM servers WHERE id = ?', args: [serverId] });
  if (serverResult.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  await db.execute({
    sql: 'INSERT INTO mod_suggestions (server_id, user_id, workshop_id, suggested_config) VALUES (?, ?, ?, ?)',
    args: [serverId, user.id, workshopId, JSON.stringify(suggestedConfig || {})],
  });

  return c.json({ success: true }, 201);
});

suggestions.put('/:id/approve', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
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
    args: ['approved', id],
  });

  return c.json({ success: true });
});

suggestions.put('/:id/deny', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
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

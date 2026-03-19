import { Hono } from 'hono';
import { authMiddleware, requireRole } from '@server/middleware/auth.js';
import type { JwtPayload } from '@server/middleware/auth.js';
import { worldService } from './world.service.js';

type Variables = { user: JwtPayload };

const worldRoutes = new Hono<{ Variables: Variables }>();

worldRoutes.use('*', authMiddleware());

worldRoutes.get('/:code/:shard', async (c) => {
  const user = c.get('user');
  const code = c.req.param('code');
  const shard = c.req.param('shard');

  if (shard !== 'Master' && shard !== 'Caves') {
    return c.json({ error: 'Invalid shard, must be Master or Caves' }, 400);
  }

  try {
    const result = await worldService.getOverrides(code, shard, user.id, user.role);
    return c.json(result);
  } catch (e: any) {
    if (e.message === 'Server not found') return c.json({ error: e.message }, 404);
    if (e.message === 'Forbidden') return c.json({ error: e.message }, 403);
    return c.json({ error: e.message }, 500);
  }
});

worldRoutes.put('/:code/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const code = c.req.param('code');
  const shard = c.req.param('shard');

  if (shard !== 'Master' && shard !== 'Caves') {
    return c.json({ error: 'Invalid shard, must be Master or Caves' }, 400);
  }

  const body = await c.req.json();

  try {
    await worldService.updateOverrides(code, shard, user.id, user.role, body);
    return c.json({ success: true });
  } catch (e: any) {
    if (e.message === 'Server not found') return c.json({ error: e.message }, 404);
    if (e.message === 'Forbidden') return c.json({ error: e.message }, 403);
    return c.json({ error: e.message }, 400);
  }
});

export default worldRoutes;

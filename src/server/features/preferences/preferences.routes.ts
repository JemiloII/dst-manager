import { Hono } from 'hono';
import { authMiddleware, JwtPayload } from '@server/middleware/auth.js';
import Preferences from './preferences.queries.js';

const preferences = new Hono();

preferences.use('*', authMiddleware());

preferences.get('/', async (c) => {
  const user = c.get('user') as JwtPayload;
  const prefs = await Preferences.getAll(user.id);
  return c.json(prefs);
});

preferences.put('/', async (c) => {
  const user = c.get('user') as JwtPayload;
  const body = await c.req.json();

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid preferences' }, 400);
  }

  await Preferences.setBatch(user.id, body);
  return c.json({ success: true });
});

export default preferences;

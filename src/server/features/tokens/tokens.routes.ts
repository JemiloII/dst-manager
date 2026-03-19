import { Hono } from 'hono';
import { authMiddleware, requireRole } from '@server/middleware/auth.js';
import type { JwtPayload } from '@server/middleware/auth.js';
import { tokenService } from './tokens.service.js';

type Variables = { user: JwtPayload };

const tokensRoutes = new Hono<{ Variables: Variables }>();

tokensRoutes.use('*', authMiddleware());
tokensRoutes.use('*', requireRole('admin', 'user'));

tokensRoutes.get('/', async (c) => {
  const user = c.get('user');
  const available = c.req.query('available') === 'true';
  const tokens = await tokenService.getTokens(user.id, available);
  return c.json(tokens);
});

tokensRoutes.post('/', async (c) => {
  const user = c.get('user');
  const { token, nickname = '' } = await c.req.json();

  if (!token || typeof token !== 'string') {
    return c.json({ error: 'Token is required' }, 400);
  }

  try {
    const created = await tokenService.createToken(user.id, token, nickname);
    return c.json(created, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

tokensRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json({ error: 'Invalid token ID' }, 400);
  }

  try {
    await tokenService.deleteToken(id, user.id, user.role === 'admin');
    return c.json({ success: true });
  } catch (err: any) {
    const status = err.message === 'Unauthorized' ? 403
      : err.message === 'Token not found' ? 404 : 409;
    return c.json({ error: err.message }, status);
  }
});

export default tokensRoutes;

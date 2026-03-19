import { Hono } from 'hono';
import { authMiddleware, requireRole } from '@server/middleware/auth.js';
import type { JwtPayload } from '@server/middleware/auth.js';
import { suggestionService } from './suggestions.service.js';

type Variables = { user: JwtPayload };

const suggestionRoutes = new Hono<{ Variables: Variables }>();

suggestionRoutes.use('*', authMiddleware());

suggestionRoutes.get('/:serverId', async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');

  try {
    const suggestions = await suggestionService.getSuggestions(serverId, user.id, user.role);
    return c.json(suggestions);
  } catch (e: any) {
    if (e.message === 'Server not found') return c.json({ error: e.message }, 404);
    if (e.message === 'Forbidden') return c.json({ error: e.message }, 403);
    return c.json({ error: e.message }, 400);
  }
});

suggestionRoutes.post('/:serverId', async (c) => {
  const user = c.get('user');
  const code = c.req.param('serverId');
  const { workshopId, suggestedConfig } = await c.req.json();

  try {
    await suggestionService.createSuggestion(code, user.id, user.role, workshopId, suggestedConfig);
    return c.json({ success: true }, 201);
  } catch (e: any) {
    if (e.message === 'Server not found') return c.json({ error: e.message }, 404);
    if (e.message === 'Forbidden' || e.message.includes('cannot suggest')) return c.json({ error: e.message }, 403);
    return c.json({ error: e.message }, 400);
  }
});

suggestionRoutes.put('/:id/approve', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  try {
    await suggestionService.approveSuggestion(id, user.id, user.role);
    return c.json({ success: true });
  } catch (e: any) {
    if (e.message === 'Suggestion not found') return c.json({ error: e.message }, 404);
    if (e.message === 'Forbidden') return c.json({ error: e.message }, 403);
    return c.json({ error: e.message }, 400);
  }
});

suggestionRoutes.put('/:id/deny', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  try {
    await suggestionService.denySuggestion(id, user.id, user.role);
    return c.json({ success: true });
  } catch (e: any) {
    if (e.message === 'Suggestion not found') return c.json({ error: e.message }, 404);
    if (e.message === 'Forbidden') return c.json({ error: e.message }, 403);
    return c.json({ error: e.message }, 400);
  }
});

export default suggestionRoutes;

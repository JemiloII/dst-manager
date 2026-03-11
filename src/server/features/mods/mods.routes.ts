import { Hono } from 'hono';
import { authMiddleware, requireRole, JwtPayload } from '../../middleware/auth';
import { generateModOverrides } from '../../services/lua';
import Servers from '../servers/servers.queries';
import * as modService from './mods.service';

type Variables = {
  user: JwtPayload;
};

const mods = new Hono<{ Variables: Variables }>();

mods.use('*', authMiddleware());

mods.get('/search', async (c) => {
  const query = c.req.query('q');
  if (!query) {
    return c.json({ error: 'Search query required' }, 400);
  }

  try {
    const results = await modService.searchWorkshop(query);
    return c.json(results);
  } catch {
    return c.json({ error: 'Failed to search workshop' }, 500);
  }
});

mods.get('/details/:workshopId', async (c) => {
  const workshopId = c.req.param('workshopId');
  const details = await modService.getWorkshopDetails(workshopId);
  return c.json(details);
});

mods.get('/config/:workshopId', async (c) => {
  const workshopId = c.req.param('workshopId');
  const config = await modService.getModConfig(workshopId);
  return c.json(config);
});

mods.post('/has-config', async (c) => {
  const { workshopIds } = await c.req.json<{ workshopIds: string[] }>();
  if (!workshopIds?.length) return c.json({});
  const result = await modService.batchHasConfig(workshopIds);
  return c.json(result);
});

mods.get('/server/:serverId', async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');

  const server = await modService.getServerById(serverId);
  if (!server) {
    return c.json({ error: 'Server not found' }, 404);
  }

  if (user.role !== 'admin' && user.role !== 'guest' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const parsed = await modService.getServerModOverrides(server.share_code as string);

  return c.json(parsed || {});
});

mods.put('/server/:serverId', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');

  const server = await modService.getServerById(serverId);
  if (!server) {
    return c.json({ error: 'Server not found' }, 404);
  }

  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const modsData = body as Record<string, { enabled: boolean; configuration_options: Record<string, unknown> }>;

  const workshopIds = Object.keys(modsData).map((k) => k.replace('workshop-', ''));
  await modService.downloadMods(workshopIds);

  const content = generateModOverrides(modsData);
  await modService.saveModOverrides(server.share_code as string, content);

  const enabledCount = Object.values(modsData).filter((m) => m.enabled).length;
  await Servers.updateModCount(server.id as number, enabledCount);

  return c.json({ success: true });
});

export default mods;
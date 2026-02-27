import { Hono } from 'hono';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';
import { getClusterPath, updateModsSetup } from '../services/dst.js';
import { parseModOverrides, generateModOverrides } from '../services/lua.js';

const mods = new Hono();

mods.use('*', authMiddleware());

mods.get('/search', async (c) => {
  const query = c.req.query('q');
  if (!query) {
    return c.json({ error: 'Search query required' }, 400);
  }

  try {
    const response = await fetch(
      `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?key=&search_text=${encodeURIComponent(query)}&appid=322330&return_metadata=true&numperpage=20&query_type=1`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const scrapeResponse = await fetch(
        `https://steamcommunity.com/workshop/browse/?appid=322330&searchtext=${encodeURIComponent(query)}&browsesort=textsearch`
      );
      const html = await scrapeResponse.text();

      const results: { workshopId: string; title: string; description: string; previewUrl: string }[] = [];
      const itemPattern = /data-publishedfileid="(\d+)"[\s\S]*?<div class="workshopItemTitle ellipsis">([^<]+)<\/div>/g;
      let match;
      while ((match = itemPattern.exec(html)) !== null) {
        results.push({
          workshopId: match[1],
          title: match[2].trim(),
          description: '',
          previewUrl: '',
        });
      }
      return c.json(results);
    }

    const data = await response.json();
    const files = data.response?.publishedfiledetails || [];
    const results = files.map((f: Record<string, unknown>) => ({
      workshopId: f.publishedfileid as string,
      title: f.title as string,
      description: (f.file_description as string || '').slice(0, 200),
      previewUrl: f.preview_url as string || '',
    }));

    return c.json(results);
  } catch {
    return c.json({ error: 'Failed to search workshop' }, 500);
  }
});

mods.get('/details/:workshopId', async (c) => {
  const workshopId = c.req.param('workshopId');
  
  try {
    const response = await fetch(
      `https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `itemcount=1&publishedfileids[0]=${workshopId}`
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const details = data.response?.publishedfiledetails?.[0];
      if (details) {
        return c.json({
          workshopId: details.publishedfileid,
          title: details.title || `Workshop-${workshopId}`,
          description: details.description || '',
          previewUrl: details.preview_url || ''
        });
      }
    }
    
    // Fallback to basic info
    return c.json({
      workshopId,
      title: `Workshop-${workshopId}`,
      description: '',
      previewUrl: ''
    });
  } catch {
    return c.json({
      workshopId,
      title: `Workshop-${workshopId}`,
      description: '',
      previewUrl: ''
    });
  }
});

mods.get('/server/:serverId', async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = c.req.param('serverId');

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE share_code = ?', args: [serverId] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && user.role !== 'guest' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const clusterDir = getClusterPath(server.kuid as string, server.share_code as string);
  const modOverridesPath = path.join(clusterDir, 'Master', 'modoverrides.lua');

  try {
    const content = await fs.readFile(modOverridesPath, 'utf-8');
    const parsed = parseModOverrides(content);
    if (!parsed) {
      return c.json({ error: 'Failed to parse mod overrides' }, 500);
    }
    return c.json(parsed);
  } catch {
    return c.json({});
  }
});

mods.put('/server/:serverId', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = c.req.param('serverId');

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE share_code = ?', args: [serverId] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const modsData = body as Record<string, { enabled: boolean; configuration_options: Record<string, unknown> }>;

  const content = generateModOverrides(modsData);
  const clusterDir = getClusterPath(server.kuid as string, server.share_code as string);

  await fs.writeFile(path.join(clusterDir, 'Master', 'modoverrides.lua'), content);
  await fs.writeFile(path.join(clusterDir, 'Caves', 'modoverrides.lua'), content);

  const allServers = await db.execute({ sql: 'SELECT kuid, share_code FROM servers', args: [] });
  const allWorkshopIds = new Set<string>();

  for (const srv of allServers.rows) {
    const srvClusterDir = getClusterPath(srv.kuid as string, srv.share_code as string);
    try {
      const modContent = await fs.readFile(path.join(srvClusterDir, 'Master', 'modoverrides.lua'), 'utf-8');
      const parsed = parseModOverrides(modContent);
      if (parsed) {
        for (const key of Object.keys(parsed)) {
          const workshopId = key.replace('workshop-', '');
          allWorkshopIds.add(workshopId);
        }
      }
    } catch {}
  }

  await updateModsSetup(Array.from(allWorkshopIds));

  return c.json({ success: true });
});

export default mods;

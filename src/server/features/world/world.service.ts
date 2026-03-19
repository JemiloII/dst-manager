import fs from 'fs/promises';
import path from 'path';
import WorldQueries from './world.queries.js';
import { getClusterPath } from '@server/services/dst.js';
import { parseLuaOverrides, generateLevelDataOverride } from '@server/services/lua.js';

class WorldService {
  async getOverrides(code: string, shard: string, userId: number, userRole: string) {
    const server = await WorldQueries.findServerByCode(code);
    if (!server) throw new Error('Server not found');
    if (userRole !== 'admin' && userRole !== 'guest' && server.user_id !== userId) {
      throw new Error('Forbidden');
    }

    const clusterDir = getClusterPath(server.share_code);
    const filePath = path.join(clusterDir, shard, 'leveldataoverride.lua');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const overrides = parseLuaOverrides(content);
      if (!overrides) throw new Error('Failed to parse level data override');
      return { overrides, raw: content };
    } catch (e: any) {
      if (e.message === 'Failed to parse level data override') throw e;
      return { overrides: {}, raw: '' };
    }
  }

  async updateOverrides(code: string, shard: string, userId: number, userRole: string, body: { overrides?: Record<string, string | boolean | number>; raw?: string }) {
    const server = await WorldQueries.findServerByCode(code);
    if (!server) throw new Error('Server not found');
    if (userRole !== 'admin' && server.user_id !== userId) {
      throw new Error('Forbidden');
    }

    let finalOverrides: Record<string, string | boolean | number>;

    if (body.raw) {
      const parsed = parseLuaOverrides(body.raw);
      if (!parsed) throw new Error('Invalid or dangerous Lua content detected');
      finalOverrides = parsed;
    } else {
      finalOverrides = body.overrides || {};
    }

    const clusterDir = getClusterPath(server.share_code);
    const filePath = path.join(clusterDir, shard, 'leveldataoverride.lua');

    let baseLua: string;
    try {
      baseLua = await fs.readFile(filePath, 'utf-8');
    } catch {
      baseLua = await fs.readFile(path.join('./dst', shard, 'leveldataoverride.lua'), 'utf-8');
    }

    const playstyle = shard === 'Caves' ? undefined : server.game_mode;
    const content = generateLevelDataOverride(baseLua, finalOverrides, playstyle);
    await fs.writeFile(filePath, content);
  }
}

export const worldService = new WorldService();

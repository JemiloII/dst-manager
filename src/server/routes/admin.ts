import { Hono } from 'hono';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';
import { getClusterPath } from '../services/dst.js';

const execAsync = promisify(exec);

const admin = new Hono();

admin.use('*', authMiddleware());

admin.post('/update-dst', requireRole('admin'), async (c) => {
  try {
    const { stdout, stderr } = await execAsync('steamcmd +login anonymous +app_update 343050 +quit', {
      timeout: 300000,
    });
    return c.json({ success: true, output: stdout + stderr });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Update failed';
    return c.json({ error: msg }, 500);
  }
});

admin.get('/export/:serverId', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const serverId = parseInt(c.req.param('serverId'));

  const result = await db.execute({ sql: 'SELECT * FROM servers WHERE id = ?', args: [serverId] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const server = result.rows[0];
  if (user.role !== 'admin' && server.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const clusterDir = getClusterPath(server.kuid as string, server.share_code as string);
  const zipName = `Cluster_${server.share_code}.tar.gz`;
  const zipPath = path.join('/tmp', zipName);

  try {
    await execAsync(`tar -czf "${zipPath}" -C "${path.dirname(clusterDir)}" "${path.basename(clusterDir)}"`);

    const stat = await fs.stat(zipPath);
    const fileStream = createReadStream(zipPath);

    return new Response(fileStream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': stat.size.toString(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Export failed';
    return c.json({ error: msg }, 500);
  }
});

export default admin;

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import fs from 'fs/promises';
import { authMiddleware, requireRole } from '@server/middleware/auth.js';
import type { JwtPayload } from '@server/middleware/auth.js';
import { logService } from './logs.service.js';

type Variables = { user: JwtPayload };

const logRoutes = new Hono<{ Variables: Variables }>();

logRoutes.use('*', authMiddleware());

logRoutes.get('/:serverId/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');
  const shard = c.req.param('shard');
  const lines = parseInt(c.req.query('lines') || '200');

  const logFile = await logService.getLogPath(user.id, user.role, serverId, shard);
  if (!logFile) return c.json({ error: 'Not found or forbidden' }, 404);

  const log = await logService.readLog(logFile, lines);
  return c.json({ log });
});

logRoutes.get('/:serverId/:shard/stream', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');
  const shard = c.req.param('shard');

  const logFile = await logService.getLogPath(user.id, user.role, serverId, shard);
  if (!logFile) return c.json({ error: 'Not found or forbidden' }, 404);

  return streamSSE(c, async (stream) => {
    let offset = 0;
    let alive = true;

    stream.onAbort(() => { alive = false; });

    try {
      const stat = await fs.stat(logFile);
      offset = stat.size;
    } catch {
      offset = 0;
    }

    while (alive) {
      try {
        const stat = await fs.stat(logFile);

        if (stat.size < offset) offset = 0;

        if (stat.size > offset) {
          const fh = await fs.open(logFile, 'r');
          const buf = Buffer.alloc(stat.size - offset);
          await fh.read(buf, 0, buf.length, offset);
          await fh.close();
          offset = stat.size;

          const text = buf.toString('utf-8');
          if (text.trim()) {
            await stream.writeSSE({ data: text, event: 'log' });
          }
        }
      } catch {
        // File might not exist yet
      }

      await stream.sleep(1500);
    }
  });
});

logRoutes.delete('/:serverId/:shard', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');
  const shard = c.req.param('shard');

  const logFile = await logService.getLogPath(user.id, user.role, serverId, shard);
  if (!logFile) return c.json({ error: 'Not found or forbidden' }, 404);

  await logService.clearLog(logFile);
  return c.json({ success: true });
});

export default logRoutes;

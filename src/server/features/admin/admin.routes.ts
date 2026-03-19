import { Hono } from 'hono';
import { authMiddleware, requireRole } from '@server/middleware/auth.js';
import type { JwtPayload } from '@server/middleware/auth.js';
import { adminService } from './admin.service.js';

type Variables = { user: JwtPayload };

const adminRoutes = new Hono<{ Variables: Variables }>();

adminRoutes.use('*', authMiddleware());

adminRoutes.post('/update-dst', requireRole('admin'), async (c) => {
  try {
    const output = await adminService.updateDst();
    return c.json({ success: true, output });
  } catch (e: any) {
    return c.json({ error: e.message || 'Update failed' }, 500);
  }
});

adminRoutes.get('/export/:serverId', requireRole('admin', 'user'), async (c) => {
  const user = c.get('user');
  const serverId = parseInt(c.req.param('serverId'));

  try {
    const { fileStream, zipName, size } = await adminService.exportServer(serverId, user.id, user.role);
    return new Response(fileStream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': size.toString(),
      },
    });
  } catch (e: any) {
    if (e.message === 'Server not found') return c.json({ error: e.message }, 404);
    if (e.message === 'Forbidden') return c.json({ error: e.message }, 403);
    return c.json({ error: e.message || 'Export failed' }, 500);
  }
});

export default adminRoutes;

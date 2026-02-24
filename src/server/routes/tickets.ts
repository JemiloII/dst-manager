import { Hono } from 'hono';
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth.js';
import db from '../db/schema.js';

const tickets = new Hono();

tickets.use('*', authMiddleware());

tickets.get('/', async (c) => {
  const user = c.get('user') as JwtPayload;

  let result;
  if (user.role === 'admin') {
    result = await db.execute({
      sql: `SELECT t.*, u.display_name as submitted_by
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC`,
      args: [],
    });
  } else {
    result = await db.execute({
      sql: 'SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC',
      args: [user.id],
    });
  }

  return c.json(result.rows);
});

tickets.post('/', requireRole('admin', 'user', 'guest'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const { subject, message } = await c.req.json();

  if (!subject || !message) {
    return c.json({ error: 'Subject and message required' }, 400);
  }

  await db.execute({
    sql: 'INSERT INTO tickets (user_id, subject, message) VALUES (?, ?, ?)',
    args: [user.id, subject, message],
  });

  return c.json({ success: true }, 201);
});

tickets.put('/:id/resolve', requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id'));

  await db.execute({
    sql: 'UPDATE tickets SET status = ? WHERE id = ?',
    args: ['resolved', id],
  });

  return c.json({ success: true });
});

export default tickets;

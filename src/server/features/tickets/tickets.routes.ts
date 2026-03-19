import { Hono } from 'hono';
import { authMiddleware, requireRole } from '@server/middleware/auth.js';
import type { JwtPayload } from '@server/middleware/auth.js';
import { ticketService } from './tickets.service.js';

type Variables = { user: JwtPayload };

const ticketRoutes = new Hono<{ Variables: Variables }>();

ticketRoutes.use('*', authMiddleware());

ticketRoutes.get('/', async (c) => {
  const user = c.get('user');
  const tickets = await ticketService.getTickets(user.id, user.role === 'admin');
  return c.json(tickets);
});

ticketRoutes.post('/', requireRole('admin', 'user', 'guest'), async (c) => {
  const user = c.get('user');
  const { subject, message } = await c.req.json();

  if (!subject || !message) {
    return c.json({ error: 'Subject and message required' }, 400);
  }

  await ticketService.createTicket(user.id, subject, message);
  return c.json({ success: true }, 201);
});

ticketRoutes.put('/:id/resolve', requireRole('admin'), async (c) => {
  const id = parseInt(c.req.param('id'));
  await ticketService.resolveTicket(id);
  return c.json({ success: true });
});

export default ticketRoutes;

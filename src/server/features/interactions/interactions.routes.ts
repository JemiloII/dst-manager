import { Hono } from 'hono';
import { interactionService } from './interactions.service.js';

const interactionRoutes = new Hono();

interactionRoutes.post('/', async (c) => {
  const signature = c.req.header('x-signature-ed25519') || '';
  const timestamp = c.req.header('x-signature-timestamp') || '';
  const body = await c.req.text();

  if (!interactionService.verifyDiscordSignature(body, signature, timestamp)) {
    return c.text('Invalid request signature', 401);
  }

  const payload = JSON.parse(body);
  const result = interactionService.handleInteraction(payload);
  return c.json(result);
});

export default interactionRoutes;

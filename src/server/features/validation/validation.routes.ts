import { Hono } from 'hono';
import { authMiddleware, requireRole, JwtPayload } from '@server/middleware/auth.js';
import { validationService } from './validation.service.js';

const validationRoutes = new Hono();

validationRoutes.use('*', authMiddleware());

// Request a validation code
validationRoutes.post('/request', requireRole('admin', 'user'), async (c) => {
  try {
    const user = c.get('user') as JwtPayload;
    const result = await validationService.requestValidation(user.id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Check validation status
validationRoutes.get('/status', requireRole('admin', 'user'), async (c) => {
  try {
    const user = c.get('user') as JwtPayload;
    const result = await validationService.checkValidationStatus(user.id);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Get validation server info
validationRoutes.get('/server-info', requireRole('admin', 'user'), async (c) => {
  return c.json({
    enabled: validationService.isEnabled(),
    running: validationService.isRunning(),
    serverName: validationService.getServerName(),
  });
});

export default validationRoutes;

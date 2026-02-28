import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';

const { JWT_SECRET = '' } = process.env;

export interface JwtPayload {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'guest';
}

type Variables = {
  user: JwtPayload;
};

export function authMiddleware() {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    // Check Authorization header first
    const header = c.req.header('Authorization');
    let token: string | undefined;
    
    if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    } else {
      // For SSE, check query parameter
      const queryToken = c.req.query('token');
      if (queryToken) {
        token = queryToken;
      }
    }
    
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
      c.set('user', payload);
      await next();
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  });
}

export function requireRole(...roles: string[]) {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
}

export function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

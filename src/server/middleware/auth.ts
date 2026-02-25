import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface JwtPayload {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'guest';
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
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
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      c.set('user', payload);
      await next();
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  };
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as JwtPayload;
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}

export function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

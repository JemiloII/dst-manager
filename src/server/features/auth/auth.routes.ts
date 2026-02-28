import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Auth from './auth.queries.js';
import Servers from '../servers/servers.queries.js';
import { generateTokens, authMiddleware, JwtPayload } from '@server/middleware/auth.js';

const { JWT_SECRET = '' } = process.env;

const auth = new Hono();

auth.post('/register', async (c) => {
  const { username, password, displayName } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  if (await Auth.checkUsername(username)) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  const userCount = await Auth.getUserCount('guest');
  const isFirst = userCount === 0;
  const role = isFirst ? 'admin' : 'user';

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await Auth.createUser(username, passwordHash, role, displayName || username);

  const payload: JwtPayload = { id: userId, username, role };
  const tokens = generateTokens(payload);

  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await Auth.createRefreshToken(userId, refreshHash, expiresAt);

  return c.json({ ...tokens, user: payload });
});

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const user = await Auth.findUserByUsername(username);
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const payload: JwtPayload = {
    id: user.id,
    username: user.username,
    role: user.role as 'admin' | 'user' | 'guest',
  };
  const tokens = generateTokens(payload);

  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await Auth.createRefreshToken(user.id, refreshHash, expiresAt);

  return c.json({ ...tokens, user: payload });
});

auth.post('/guest', async (c) => {
  const { displayName, shareCode } = await c.req.json();

  if (!displayName || !shareCode) {
    return c.json({ error: 'Display name and share code required' }, 400);
  }

  // Verify share code exists
  const server = await Servers.findByShareCode(shareCode);
  
  if (!server) {
    return c.json({ error: 'Invalid share code' }, 404);
  }

  // Check if display name is already taken by a real user
  if (await Auth.checkDisplayName(displayName)) {
    return c.json({ error: 'This name is already taken' }, 409);
  }

  // Use display name as username for guests (prefixed to avoid conflicts)
  const guestUsername = `guest_${displayName}`;
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  const userId = await Auth.createUser(guestUsername, passwordHash, 'guest', displayName);

  const payload: JwtPayload = { id: userId, username: displayName, role: 'guest' };
  const tokens = generateTokens(payload);

  return c.json({ ...tokens, user: { ...payload, displayName } });
});

auth.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json();

  if (!refreshToken) {
    return c.json({ error: 'Refresh token required' }, 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload & { type: string };
    if (decoded.type !== 'refresh') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    const stored = await Auth.getRefreshTokens(decoded.id);

    let valid = false;
    let matchedTokenId: number | null = null;
    for (const row of stored) {
      if (await bcrypt.compare(refreshToken, row.token_hash)) {
        valid = true;
        matchedTokenId = row.id;
        break;
      }
    }

    if (!valid || !matchedTokenId) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    await Auth.deleteRefreshToken(matchedTokenId);

    const payload: JwtPayload = { id: decoded.id, username: decoded.username, role: decoded.role };
    const tokens = generateTokens(payload);

    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await Auth.createRefreshToken(decoded.id, refreshHash, expiresAt);

    return c.json({ ...tokens, user: payload });
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
});

auth.post('/logout', authMiddleware(), async (c) => {
  const user = c.get('user') as JwtPayload;
  await Auth.deleteAllRefreshTokens(user.id);
  return c.json({ success: true });
});

export default auth;

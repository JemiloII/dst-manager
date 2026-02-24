import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db/schema.js';
import { env } from '../env.js';
import { generateTokens, authMiddleware, JwtPayload } from '../middleware/auth.js';

const auth = new Hono();

auth.post('/register', async (c) => {
  const { username, password, displayName } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
  if (existing.rows.length > 0) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  const userCount = await db.execute({ sql: 'SELECT COUNT(*) as count FROM users WHERE role != ?', args: ['guest'] });
  const isFirst = (userCount.rows[0].count as number) === 0;
  const role = isFirst ? 'admin' : 'user';

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.execute({
    sql: 'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
    args: [username, passwordHash, role, displayName || username],
  });

  const payload: JwtPayload = { id: Number(result.lastInsertRowid), username, role };
  const tokens = generateTokens(payload);

  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({
    sql: 'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    args: [Number(result.lastInsertRowid), refreshHash, expiresAt],
  });

  return c.json({ ...tokens, user: payload });
});

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
  if (result.rows.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const payload: JwtPayload = {
    id: user.id as number,
    username: user.username as string,
    role: user.role as 'admin' | 'user' | 'guest',
  };
  const tokens = generateTokens(payload);

  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({
    sql: 'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    args: [user.id as number, refreshHash, expiresAt],
  });

  return c.json({ ...tokens, user: payload });
});

auth.post('/guest', async (c) => {
  const { displayName, shareCode } = await c.req.json();

  if (!displayName || !shareCode) {
    return c.json({ error: 'Display name and share code required' }, 400);
  }

  // Verify share code exists
  const server = await db.execute({ 
    sql: 'SELECT id FROM servers WHERE share_code = ?', 
    args: [shareCode] 
  });
  
  if (server.rows.length === 0) {
    return c.json({ error: 'Invalid share code' }, 404);
  }

  // Check if display name is already taken by a real user
  const existing = await db.execute({ 
    sql: 'SELECT id FROM users WHERE username = ? OR display_name = ?', 
    args: [displayName, displayName] 
  });
  
  if (existing.rows.length > 0) {
    return c.json({ error: 'This name is already taken' }, 409);
  }

  // Use display name as username for guests (prefixed to avoid conflicts)
  const guestUsername = `guest_${displayName}`;
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  const result = await db.execute({
    sql: 'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
    args: [guestUsername, passwordHash, 'guest', displayName],
  });

  const payload: JwtPayload = { id: Number(result.lastInsertRowid), username: displayName, role: 'guest' };
  const tokens = generateTokens(payload);

  return c.json({ ...tokens, user: { ...payload, displayName } });
});

auth.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json();

  if (!refreshToken) {
    return c.json({ error: 'Refresh token required' }, 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as JwtPayload & { type: string };
    if (decoded.type !== 'refresh') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    const stored = await db.execute({
      sql: 'SELECT * FROM refresh_tokens WHERE user_id = ?',
      args: [decoded.id],
    });

    let valid = false;
    let matchedTokenId: number | null = null;
    for (const row of stored.rows) {
      if (await bcrypt.compare(refreshToken, row.token_hash as string)) {
        valid = true;
        matchedTokenId = row.id as number;
        break;
      }
    }

    if (!valid || !matchedTokenId) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    await db.execute({ sql: 'DELETE FROM refresh_tokens WHERE id = ?', args: [matchedTokenId] });

    const payload: JwtPayload = { id: decoded.id, username: decoded.username, role: decoded.role };
    const tokens = generateTokens(payload);

    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.execute({
      sql: 'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      args: [decoded.id, refreshHash, expiresAt],
    });

    return c.json({ ...tokens, user: payload });
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
});

auth.post('/logout', authMiddleware(), async (c) => {
  const user = c.get('user') as JwtPayload;
  await db.execute({ sql: 'DELETE FROM refresh_tokens WHERE user_id = ?', args: [user.id] });
  return c.json({ success: true });
});

export default auth;

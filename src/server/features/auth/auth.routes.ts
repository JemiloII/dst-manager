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
  const { username, password, displayName, kuid } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  if (kuid) {
    if (!/^KU_[A-Za-z0-9_-]+$/.test(kuid)) {
      return c.json({ error: 'Invalid KUID format. Must start with KU_ followed by alphanumeric characters.' }, 400);
    }
    if (await Auth.checkKuid(kuid)) {
      return c.json({ error: 'This KUID is already registered to another account' }, 409);
    }
  }

  if (await Auth.checkUsername(username)) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  const userCount = await Auth.getUserCount('guest');
  const isFirst = userCount === 0;
  const role = isFirst ? 'admin' : 'user';

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await Auth.createUser(username, passwordHash, role, displayName || username, kuid);

  const payload: JwtPayload = { id: userId, username, role };
  const tokens = generateTokens(payload);

  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await Auth.createRefreshToken(userId, refreshHash, expiresAt);

  return c.json({ ...tokens, user: { ...payload, displayName: displayName || username, isValidated: false, kuid: kuid || null } });
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

  return c.json({ ...tokens, user: { ...payload, displayName: user.display_name || user.username, isValidated: !!user.is_validated, kuid: user.kuid } });
});

auth.post('/guest', async (c) => {
  const { displayName, shareCode, username, password, kuid } = await c.req.json();

  if (!displayName || !shareCode) {
    return c.json({ error: 'Display name and share code required' }, 400);
  }

  const server = await Servers.findByShareCode(shareCode);
  if (!server) {
    return c.json({ error: 'Invalid share code' }, 404);
  }

  // Check display name against server owner
  const owner = await Auth.findUserById(server.user_id);
  if (owner && owner.display_name?.toLowerCase() === displayName.toLowerCase()) {
    return c.json({ error: 'This name is already taken on this server' }, 409);
  }

  // Per-server display name uniqueness
  if (await Servers.checkDisplayNameOnServer(server.id, displayName)) {
    return c.json({ error: 'This name is already taken on this server' }, 409);
  }

  // If username+password provided, create as full user
  const isUpgrade = username && password;
  let role: 'user' | 'guest' = 'guest';
  let guestUsername = `guest_${crypto.randomBytes(4).toString('hex')}`;
  let passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  let validatedKuid: string | undefined;

  if (isUpgrade) {
    if (await Auth.checkUsername(username)) {
      return c.json({ error: 'Username already taken' }, 409);
    }
    if (kuid) {
      if (!/^KU_[A-Za-z0-9_-]+$/.test(kuid)) {
        return c.json({ error: 'Invalid KUID format' }, 400);
      }
      if (await Auth.checkKuid(kuid)) {
        return c.json({ error: 'This KUID is already registered to another account' }, 409);
      }
      validatedKuid = kuid;
    }
    guestUsername = username;
    passwordHash = await bcrypt.hash(password, 10);
    role = 'user';
  }

  const userId = await Auth.createUser(guestUsername, passwordHash, role, displayName, validatedKuid);
  await Servers.addGuest(server.id, userId, displayName);

  const payload: JwtPayload = { id: userId, username: isUpgrade ? username : displayName, role };
  const tokens = generateTokens(payload);

  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await Auth.createRefreshToken(userId, refreshHash, expiresAt);

  return c.json({ ...tokens, user: { ...payload, displayName, isValidated: false, kuid: validatedKuid || null } });
});

auth.post('/upgrade', authMiddleware(), async (c) => {
  const user = c.get('user') as JwtPayload;

  if (user.role !== 'guest') {
    return c.json({ error: 'Only guest accounts can be upgraded' }, 400);
  }

  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  if (await Auth.checkUsername(username)) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await Auth.updatePasswordAndRole(user.id, passwordHash, username);

  const payload: JwtPayload = { id: user.id, username, role: 'user' };
  const tokens = generateTokens(payload);

  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await Auth.deleteAllRefreshTokens(user.id);
  await Auth.createRefreshToken(user.id, refreshHash, expiresAt);

  return c.json({ ...tokens, user: payload });
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

    // Look up current role from DB (handles upgraded guests)
    const dbUser = await Auth.findUserById(decoded.id);
    const currentRole = (dbUser?.role as JwtPayload['role']) || decoded.role;
    const currentUsername = dbUser?.username || decoded.username;

    const payload: JwtPayload = { id: decoded.id, username: currentUsername, role: currentRole };
    const tokens = generateTokens(payload);

    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await Auth.createRefreshToken(decoded.id, refreshHash, expiresAt);

    return c.json({ ...tokens, user: { ...payload, displayName: dbUser?.display_name || currentUsername, isValidated: !!dbUser?.is_validated, kuid: dbUser?.kuid || null } });
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

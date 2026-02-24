import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  userId: number;
  username: string;
  role: 'admin' | 'user' | 'guest';
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}

export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
}
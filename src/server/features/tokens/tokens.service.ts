import Tokens from './tokens.queries.js';
import { extractKuid } from '@server/services/dst.js';

class TokenService {
  async getTokens(userId: number, availableOnly: boolean) {
    if (availableOnly) {
      return Tokens.findAvailable(userId);
    }
    return Tokens.findByUserId(userId);
  }

  async createToken(userId: number, rawToken: string, nickname: string) {
    const trimmed = rawToken.trim();

    const kuid = extractKuid(trimmed);
    if (!kuid) {
      throw new Error('Failed to extract KUID from token. Please verify your token.');
    }

    const existing = await Tokens.findByTokenAndUser(userId, trimmed);
    if (existing) {
      throw new Error('This token already exists in your account');
    }

    const id = await Tokens.create({ userId, token: trimmed, kuid, nickname });
    return Tokens.findById(id);
  }

  async deleteToken(tokenId: number, userId: number, isAdmin: boolean) {
    const token = await Tokens.findById(tokenId);
    if (!token) {
      throw new Error('Token not found');
    }

    if (token.user_id !== userId && !isAdmin) {
      throw new Error('Unauthorized');
    }

    const inUse = await Tokens.isInUse(tokenId);
    if (inUse) {
      throw new Error('Cannot delete a token that is in use by a server');
    }

    await Tokens.delete(tokenId, token.user_id);
  }

  async resolveTokenId(userId: number, clusterToken: string, kuid: string): Promise<number> {
    const existing = await Tokens.findByTokenAndUser(userId, clusterToken);
    if (existing) return existing.id;

    return Tokens.create({ userId, token: clusterToken, kuid, nickname: '' });
  }
}

export const tokenService = new TokenService();

import db from '@server/db/schema.js';
import { User } from '../users/users.queries.js';

export interface RefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
}

export class Auth {
  async checkUsername(username: string): Promise<boolean> {
    const result = await db.execute({ 
      sql: 'SELECT id FROM users WHERE username = ?', 
      args: [username] 
    });
    return result.rows.length > 0;
  }

  async getUserCount(excludeRole?: string): Promise<number> {
    if (excludeRole) {
      const result = await db.execute({ 
        sql: 'SELECT COUNT(*) as count FROM users WHERE role != ?', 
        args: [excludeRole] 
      });
      return result.rows[0].count as number;
    }
    const result = await db.execute({ 
      sql: 'SELECT COUNT(*) as count FROM users', 
      args: [] 
    });
    return result.rows[0].count as number;
  }

  async createUser(username: string, passwordHash: string, role: string, displayName: string): Promise<number> {
    const result = await db.execute({
      sql: 'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
      args: [username, passwordHash, role, displayName],
    });
    return Number(result.lastInsertRowid);
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const result = await db.execute({ 
      sql: 'SELECT * FROM users WHERE username = ?', 
      args: [username] 
    });
    return result.rows.length > 0 ? result.rows[0] as User : null;
  }

  async checkDisplayName(displayName: string): Promise<boolean> {
    const result = await db.execute({ 
      sql: 'SELECT id FROM users WHERE username = ? OR display_name = ?', 
      args: [displayName, displayName] 
    });
    return result.rows.length > 0;
  }

  async createRefreshToken(userId: number, tokenHash: string, expiresAt: string): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      args: [userId, tokenHash, expiresAt],
    });
  }

  async getRefreshTokens(userId: number): Promise<RefreshToken[]> {
    const result = await db.execute({
      sql: 'SELECT * FROM refresh_tokens WHERE user_id = ?',
      args: [userId],
    });
    return result.rows as RefreshToken[];
  }

  async deleteRefreshToken(id: number): Promise<void> {
    await db.execute({ 
      sql: 'DELETE FROM refresh_tokens WHERE id = ?', 
      args: [id] 
    });
  }

  async deleteAllRefreshTokens(userId: number): Promise<void> {
    await db.execute({ 
      sql: 'DELETE FROM refresh_tokens WHERE user_id = ?', 
      args: [userId] 
    });
  }
}

export default new Auth();
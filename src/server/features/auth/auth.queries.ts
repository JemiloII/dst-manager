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

  async createUser(username: string, passwordHash: string, role: string, displayName: string, kuid?: string): Promise<number> {
    const result = await db.execute({
      sql: 'INSERT INTO users (username, password_hash, role, display_name, kuid) VALUES (?, ?, ?, ?, ?)',
      args: [username, passwordHash, role, displayName, kuid || null],
    });
    return Number(result.lastInsertRowid);
  }

  async checkKuid(kuid: string): Promise<boolean> {
    const result = await db.execute({
      sql: 'SELECT id FROM users WHERE kuid = ?',
      args: [kuid],
    });
    return result.rows.length > 0;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const result = await db.execute({ 
      sql: 'SELECT * FROM users WHERE username = ?', 
      args: [username] 
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as User : null;
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
    return result.rows as unknown as RefreshToken[];
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

  async findUserById(userId: number): Promise<User | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as User : null;
  }

  async updatePasswordAndRole(userId: number, passwordHash: string, username: string): Promise<void> {
    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, role = ?, username = ? WHERE id = ?',
      args: [passwordHash, 'user', username, userId],
    });
  }

  async searchUsers(query: string, excludeIds: number[] = []): Promise<{ id: number; username: string; display_name: string }[]> {
    const placeholders = excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : '';
    const excludeClause = excludeIds.length > 0 ? `AND id NOT IN (${placeholders})` : '';
    const result = await db.execute({
      sql: `SELECT id, username, display_name FROM users
            WHERE role != 'guest'
            AND (username LIKE ? OR display_name LIKE ?)
            ${excludeClause}
            LIMIT 10`,
      args: [`%${query}%`, `%${query}%`, ...excludeIds],
    });
    return result.rows as any[];
  }
}

export default new Auth();
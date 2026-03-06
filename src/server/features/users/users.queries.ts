import db from '@server/db/schema.js';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  display_name: string;
  kuid: string | null;
  ign: string | null;
  is_validated: number;
}

export class Users {
  async findByUsername(username: string): Promise<User | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username],
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as User : null;
  }

  async createAdmin(username: string, passwordHash: string, kuid?: string): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, role, display_name, kuid, is_validated) VALUES (?, ?, ?, ?, ?, ?)',
      args: [username, passwordHash, 'admin', username, kuid || null, kuid ? 1 : 0],
    });
  }

  async updateKuid(userId: number, kuid: string): Promise<void> {
    await db.execute({
      sql: 'UPDATE users SET kuid = ? WHERE id = ?',
      args: [kuid, userId],
    });
  }

  async updateValidation(userId: number, ign: string): Promise<void> {
    await db.execute({
      sql: 'UPDATE users SET is_validated = 1, ign = ? WHERE id = ?',
      args: [ign, userId],
    });
  }
}

export default new Users();
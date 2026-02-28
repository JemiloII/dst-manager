import db from '@server/db/schema.js';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  display_name: string;
}

export class Users {
  async findByUsername(username: string): Promise<User | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username],
    });
    return result.rows.length > 0 ? result.rows[0] as User : null;
  }

  async createAdmin(username: string, passwordHash: string): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
      args: [username, passwordHash, 'admin', username],
    });
  }
}

export default new Users();
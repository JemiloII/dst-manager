import db from '@server/db/schema.js';

export interface ValidationCode {
  id: number;
  user_id: number;
  code: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export class ValidationQueries {
  async createCode(userId: number, code: string, expiresAt: string): Promise<number> {
    const result = await db.execute({
      sql: 'INSERT INTO validation_codes (user_id, code, expires_at) VALUES (?, ?, ?)',
      args: [userId, code, expiresAt],
    });
    return Number(result.lastInsertRowid);
  }

  async findActiveCode(code: string): Promise<ValidationCode | null> {
    const result = await db.execute({
      sql: "SELECT * FROM validation_codes WHERE code = ? AND used = 0 AND expires_at > datetime('now')",
      args: [code],
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ValidationCode : null;
  }

  async markCodeUsed(id: number): Promise<void> {
    await db.execute({
      sql: 'UPDATE validation_codes SET used = 1 WHERE id = ?',
      args: [id],
    });
  }

  async getActiveCodeForUser(userId: number): Promise<ValidationCode | null> {
    const result = await db.execute({
      sql: "SELECT * FROM validation_codes WHERE user_id = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1",
      args: [userId],
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ValidationCode : null;
  }

  async countRecentCodes(userId: number): Promise<number> {
    const result = await db.execute({
      sql: "SELECT COUNT(*) as count FROM validation_codes WHERE user_id = ? AND created_at > datetime('now', '-1 hour')",
      args: [userId],
    });
    return result.rows[0].count as number;
  }

  async cleanExpiredCodes(): Promise<void> {
    await db.execute({
      sql: "DELETE FROM validation_codes WHERE expires_at < datetime('now') OR used = 1",
      args: [],
    });
  }
}

export default new ValidationQueries();

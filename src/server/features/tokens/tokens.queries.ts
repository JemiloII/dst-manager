import db from '@server/db/schema.js';

export interface ClusterToken {
  id: number;
  user_id: number;
  token: string;
  kuid: string;
  nickname: string;
  created_at: string;
}

export interface ClusterTokenWithUsage extends ClusterToken {
  in_use: boolean;
  server_name: string | null;
}

export class Tokens {
  async findByUserId(userId: number): Promise<ClusterTokenWithUsage[]> {
    const result = await db.execute({
      sql: `SELECT ct.*,
            CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as in_use,
            s.name as server_name
            FROM cluster_tokens ct
            LEFT JOIN servers s ON s.cluster_token_id = ct.id
            WHERE ct.user_id = ?
            ORDER BY ct.id ASC`,
      args: [userId],
    });
    return result.rows as unknown as ClusterTokenWithUsage[];
  }

  async findById(id: number): Promise<ClusterToken | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM cluster_tokens WHERE id = ?',
      args: [id],
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ClusterToken : null;
  }

  async findByTokenAndUser(userId: number, token: string): Promise<ClusterToken | null> {
    const result = await db.execute({
      sql: 'SELECT * FROM cluster_tokens WHERE user_id = ? AND token = ?',
      args: [userId, token],
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ClusterToken : null;
  }

  async create(data: { userId: number; token: string; kuid: string; nickname: string }): Promise<number> {
    const result = await db.execute({
      sql: 'INSERT INTO cluster_tokens (user_id, token, kuid, nickname) VALUES (?, ?, ?, ?)',
      args: [data.userId, data.token, data.kuid, data.nickname],
    });
    return Number(result.lastInsertRowid);
  }

  async delete(id: number, userId: number): Promise<void> {
    await db.execute({
      sql: 'DELETE FROM cluster_tokens WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
  }

  async findAvailable(userId: number): Promise<ClusterToken[]> {
    const result = await db.execute({
      sql: `SELECT ct.* FROM cluster_tokens ct
            WHERE ct.user_id = ? AND ct.id NOT IN (SELECT cluster_token_id FROM servers WHERE cluster_token_id IS NOT NULL)
            ORDER BY ct.id ASC`,
      args: [userId],
    });
    return result.rows as unknown as ClusterToken[];
  }

  async isInUse(id: number): Promise<boolean> {
    const result = await db.execute({
      sql: 'SELECT id FROM servers WHERE cluster_token_id = ?',
      args: [id],
    });
    return result.rows.length > 0;
  }
}

export default new Tokens();

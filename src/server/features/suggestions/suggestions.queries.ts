import db from '@server/db/schema.js';

export interface Suggestion {
  id: number;
  server_id: number;
  user_id: number;
  workshop_id: string;
  suggested_config: string;
  status: string;
  created_at: string;
  suggested_by?: string;
  server_owner?: number;
  share_code?: string;
  srv_id?: number;
}

class SuggestionQueries {
  async findByServerCode(code: string): Promise<Suggestion[]> {
    const result = await db.execute({
      sql: `SELECT ms.*, u.display_name as suggested_by
            FROM mod_suggestions ms
            JOIN users u ON ms.user_id = u.id
            WHERE ms.server_id = (SELECT id FROM servers WHERE share_code = ?)
            ORDER BY CASE ms.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'denied' THEN 2 END, ms.created_at DESC`,
      args: [code],
    });
    return result.rows as unknown as Suggestion[];
  }

  async findByIdWithServer(id: number): Promise<Suggestion | null> {
    const result = await db.execute({
      sql: `SELECT ms.*, s.user_id as server_owner, s.share_code, s.id as srv_id
            FROM mod_suggestions ms
            JOIN servers s ON ms.server_id = s.id
            WHERE ms.id = ?`,
      args: [id],
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as Suggestion : null;
  }

  async create(serverId: number, userId: number, workshopId: string, config: string): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO mod_suggestions (server_id, user_id, workshop_id, suggested_config) VALUES (?, ?, ?, ?)',
      args: [serverId, userId, workshopId, config],
    });
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await db.execute({
      sql: 'UPDATE mod_suggestions SET status = ? WHERE id = ?',
      args: [status, id],
    });
  }

  async findServerByCode(code: string) {
    const result = await db.execute({
      sql: 'SELECT id, user_id FROM servers WHERE share_code = ?',
      args: [code],
    });
    return result.rows.length > 0 ? result.rows[0] as any : null;
  }
}

export default new SuggestionQueries();

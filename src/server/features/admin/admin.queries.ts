import db from '@server/db/schema.js';

class AdminQueries {
  async findServerById(id: number) {
    const result = await db.execute({
      sql: 'SELECT * FROM servers WHERE id = ?',
      args: [id],
    });
    return result.rows.length > 0 ? result.rows[0] as any : null;
  }
}

export default new AdminQueries();

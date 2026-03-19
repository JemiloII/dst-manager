import db from '@server/db/schema.js';

class WorldQueries {
  async findServerByCode(code: string) {
    const result = await db.execute({
      sql: 'SELECT * FROM servers WHERE share_code = ?',
      args: [code],
    });
    return result.rows.length > 0 ? result.rows[0] as any : null;
  }
}

export default new WorldQueries();

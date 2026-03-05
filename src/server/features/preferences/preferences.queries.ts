import db from '@server/db/schema.js';

export class Preferences {
  async getAll(userId: number): Promise<Record<string, string>> {
    const result = await db.execute({
      sql: 'SELECT key, value FROM user_preferences WHERE user_id = ?',
      args: [userId],
    });
    const prefs: Record<string, string> = {};
    for (const row of result.rows) {
      prefs[row.key as string] = row.value as string;
    }
    return prefs;
  }

  async set(userId: number, key: string, value: string): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = ?',
      args: [userId, key, value, value],
    });
  }

  async setBatch(userId: number, prefs: Record<string, string>): Promise<void> {
    const entries = Object.entries(prefs);
    if (entries.length === 0) return;

    await db.batch(
      entries.map(([key, value]) => ({
        sql: 'INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = ?',
        args: [userId, key, value, value],
      }))
    );
  }
}

export default new Preferences();

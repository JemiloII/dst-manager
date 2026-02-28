import db from '../../db/schema';

export class Mods {
  async getServerById(serverId: string) {
    const result = await db.execute({ 
      sql: 'SELECT * FROM servers WHERE share_code = ?', 
      args: [serverId] 
    });
    return result.rows[0] || null;
  }

  async getAllServers() {
    const result = await db.execute({ 
      sql: 'SELECT kuid, share_code FROM servers', 
      args: [] 
    });
    return result.rows;
  }
}

export default new Mods();
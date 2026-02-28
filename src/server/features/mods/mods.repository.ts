import db from '../../db/schema';

export async function getServerById(serverId: string) {
  const result = await db.execute({ 
    sql: 'SELECT * FROM servers WHERE share_code = ?', 
    args: [serverId] 
  });
  return result.rows[0] || null;
}

export async function getAllServers() {
  const result = await db.execute({ 
    sql: 'SELECT kuid, share_code FROM servers', 
    args: [] 
  });
  return result.rows;
}
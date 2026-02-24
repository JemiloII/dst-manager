import { createClient } from '@libsql/client';
import { createTables } from './schema';

let db: ReturnType<typeof createClient>;

export async function initDatabase() {
  const dbUrl = process.env.DATABASE_URL || 'file:local.db';
  
  db = createClient({
    url: dbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  await createTables(db);
  
  // Create admin user if env vars are set
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;
  const adminKuid = process.env.ADMIN_KUID;
  
  if (adminUser && adminPass) {
    const { hash } = await import('../auth/password');
    const hashedPassword = await hash(adminPass);
    
    // Check if admin already exists
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [adminUser]
    });
    
    if (existing.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO users (username, password_hash, role, display_name, kuid) VALUES (?, ?, ?, ?, ?)',
        args: [adminUser, hashedPassword, 'admin', 'Admin', adminKuid]
      });
      console.log('Admin user created');
    }
  }
  
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
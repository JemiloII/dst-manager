import { createClient } from '@libsql/client';

const {
  DATABASE_URL = 'file:data.db'
} = process.env;

const db = createClient({
  url: DATABASE_URL,
});

export class Database {
  static async init() {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
        display_name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        cluster_token TEXT NOT NULL,
        kuid TEXT NOT NULL,
        share_code TEXT UNIQUE NOT NULL,
        max_players INTEGER DEFAULT 6,
        game_mode TEXT DEFAULT 'survival',
        server_intention TEXT DEFAULT 'cooperative',
        mod_count INTEGER DEFAULT 0,
        pvp INTEGER DEFAULT 0,
        password TEXT DEFAULT '',
        port_offset INTEGER UNIQUE NOT NULL,
        status TEXT DEFAULT 'stopped' CHECK (status IN ('stopped', 'starting', 'running', 'paused')),
        pids TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS mod_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        workshop_id TEXT NOT NULL,
        suggested_config TEXT DEFAULT '{}',
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (server_id) REFERENCES servers(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS server_guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        display_name TEXT NOT NULL,
        joined_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(server_id, user_id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS user_preferences (
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS server_admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        user_id INTEGER,
        kuid TEXT DEFAULT '',
        added_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS validation_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        code TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      args: [],
    },
  ]);

  // Migrations for existing databases
  await db.execute({
    sql: `ALTER TABLE servers ADD COLUMN server_intention TEXT DEFAULT 'cooperative'`,
    args: [],
  }).catch(() => {});

  await db.execute({
    sql: `ALTER TABLE servers ADD COLUMN mod_count INTEGER DEFAULT 0`,
    args: [],
  }).catch(() => {});

  await db.execute({
    sql: `ALTER TABLE servers ADD COLUMN started_at TEXT DEFAULT NULL`,
    args: [],
  }).catch(() => {});

  await db.execute({
    sql: `ALTER TABLE servers ADD COLUMN cluster_key TEXT DEFAULT NULL`,
    args: [],
  }).catch(() => {});

  await db.execute({
    sql: `ALTER TABLE users ADD COLUMN kuid TEXT DEFAULT NULL`,
    args: [],
  }).catch(() => {});

  await db.execute({
    sql: `ALTER TABLE users ADD COLUMN ign TEXT DEFAULT NULL`,
    args: [],
  }).catch(() => {});

  await db.execute({
    sql: `ALTER TABLE users ADD COLUMN is_validated INTEGER DEFAULT 0`,
    args: [],
  }).catch(() => {});

  await db.execute({
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kuid ON users(kuid) WHERE kuid IS NOT NULL`,
    args: [],
  }).catch(() => {});

  // Migration: Allow NULL user_id in server_admins for KUID-only entries
  const tableInfo = await db.execute({ sql: `PRAGMA table_info(server_admins)`, args: [] });
  const userIdCol = (tableInfo.rows as any[]).find((r: any) => r.name === 'user_id');
  if (userIdCol && userIdCol.notnull === 1) {
    await db.execute({ sql: `DROP TABLE IF EXISTS server_admins_tmp`, args: [] });
    await db.batch([
      {
        sql: `CREATE TABLE server_admins_tmp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id INTEGER NOT NULL,
          user_id INTEGER,
          kuid TEXT DEFAULT '',
          added_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        args: [],
      },
      {
        sql: `INSERT INTO server_admins_tmp (id, server_id, user_id, kuid, added_at)
              SELECT id, server_id, user_id, kuid, added_at FROM server_admins`,
        args: [],
      },
      { sql: `DROP TABLE server_admins`, args: [] },
      { sql: `ALTER TABLE server_admins_tmp RENAME TO server_admins`, args: [] },
    ]);
  }
  }
}

export default db;

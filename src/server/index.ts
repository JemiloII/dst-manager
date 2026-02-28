import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import bcrypt from 'bcrypt';
import { initDb } from './db/schema';
import db from './db/schema';
import { env } from './env';
import auth from './routes/auth';
import servers from './routes/servers';
import { modsRouter } from './features/mods';
import world from './routes/world';
import suggestions from './routes/suggestions';
import tickets from './routes/tickets';
import logs from './routes/logs';
import admin from './routes/admin';
import { startLobbyPoller } from './services/lobby';

const app = new Hono();

app.use('*', cors());

// Error handling middleware
app.onError((err, c) => {
  console.error(`Error handling request ${c.req.path}:`, err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

app.route('/api/auth', auth);
app.route('/api/servers', servers);
app.route('/api/mods', modsRouter);
app.route('/api/world', world);
app.route('/api/suggestions', suggestions);
app.route('/api/tickets', tickets);
app.route('/api/logs', logs);
app.route('/api/admin', admin);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  // Serve static files from Vite's build output
  app.use('/*', serveStatic({ root: './dist/client' }));
  
  // SPA fallback - serve index.html for client-side routing
  app.get('*', serveStatic({ path: './dist/client/index.html' }));
}

async function seedAdmin() {
  if (!env.ADMIN_USER || !env.ADMIN_PASS) return;

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [env.ADMIN_USER],
  });

  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(env.ADMIN_PASS, 10);
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
      args: [env.ADMIN_USER, hash, 'admin', env.ADMIN_USER],
    });
    console.log(`Admin user "${env.ADMIN_USER}" created`);
  }
}

async function start() {
  try {
    await initDb();
    await seedAdmin();

    startLobbyPoller();

    // Start server (Vite dev server plugin handles it in development)
    if (!import.meta.env?.DEV) {
      serve({ fetch: app.fetch, port: env.PORT }, () => {
        console.log(`DST Server Manager running on port ${env.PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    // Don't exit in development
    if (!import.meta.env?.DEV) {
      process.exit(1);
    }
  }
}

// Global error handlers - log but don't crash
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

start();

export default app;

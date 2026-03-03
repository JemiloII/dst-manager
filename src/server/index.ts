import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import bcrypt from 'bcrypt';
import { Database } from './db/schema';
import Users from './features/users/users.queries.js';
import { authRoutes } from './features/auth/index.js';
import { serverRoutes } from './features/servers/index.js';
import { dockerProcessService } from './services/docker-process.js';
import { modsRouter } from './features/mods';
import { lobbiesRoutes } from './features/lobbies';
import world from './routes/world';
import suggestions from './routes/suggestions';
import tickets from './routes/tickets';
import logs from './routes/logs';
import admin from './routes/admin';
import { Monitor } from './services/monitor';

const {
  ADMIN_USER = '',
  ADMIN_PASS = '',
  PORT = '7891',
  NODE_ENV = 'development'
} = process.env;

const DEV = NODE_ENV === 'development';

const app = new Hono();

app.use('*', cors());

// Error handling middleware
app.onError((err, c) => {
  console.error(`Error handling request ${c.req.path}:`, err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

app.route('/api/auth', authRoutes);
app.route('/api/servers', serverRoutes);
app.route('/api/mods', modsRouter);
app.route('/api/lobbies', lobbiesRoutes);
app.route('/api/world', world);
app.route('/api/suggestions', suggestions);
app.route('/api/tickets', tickets);
app.route('/api/logs', logs);
app.route('/api/admin', admin);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// In production, serve the built frontend
if (NODE_ENV === 'production') {
  // Serve static files from Vite's build output
  app.use('/*', serveStatic({ root: './dist/client' }));
  
  // SPA fallback - serve index.html for client-side routing
  app.get('*', serveStatic({ path: './dist/client/index.html' }));
}

async function seedAdmin() {
  if (!ADMIN_USER || !ADMIN_PASS) return;

  const existing = await Users.findByUsername(ADMIN_USER);

  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASS, 10);
    await Users.createAdmin(ADMIN_USER, hash);
    console.log(`Admin user "${ADMIN_USER}" created`);
  }
}

async function start() {
  try {
    await Database.init();
    await seedAdmin();
    
    // Check running servers on startup
    await dockerProcessService.checkAllServersOnStartup();
    
    // Build Docker image if it doesn't exist
    console.log('Checking Docker image...');
    const buildResult = await dockerProcessService.buildDockerImage();
    if (!buildResult.success) {
      console.error('Failed to build Docker image:', buildResult.message);
    } else {
      console.log('Docker image ready');
    }

    Monitor.start();

    // Start server (Vite dev server plugin handles it in development)
    if (!DEV) {
      serve({ fetch: app.fetch, port: parseInt(PORT, 10) }, () => {
        console.log(`DST Server Manager running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    // Don't exit in development
    if (!DEV) {
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

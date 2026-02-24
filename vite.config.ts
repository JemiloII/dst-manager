import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import devServer from '@hono/vite-dev-server';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' &&
      devServer({
        entry: 'src/server/index.ts',
        injectClientScript: false,
        exclude: [/^(?!\/api).*$/],  // Only handle /api routes, let Vite handle everything else
      }),
  ],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@server': path.resolve(__dirname, 'src/server'),
    },
  },
  server: {
    port: 7891,
    host: '0.0.0.0',
    allowedHosts: ['localhost', 'dst.gg', '.dst.gg'],
  },
}));

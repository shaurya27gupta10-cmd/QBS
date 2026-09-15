import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function payloadApiPlugin(): Plugin {
  const CACHE_FILE = path.resolve(process.cwd(), '.payload_cache.json');
  const store = new Map<string, { payload: string; filename?: string; timestamp: number }>();

  // Restore existing store from disk on server start
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object' && 'payload' in (v as any)) {
            store.set(k.toLowerCase(), v as any);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not read payload cache from disk:', err);
  }

  const persistToDisk = () => {
    try {
      const obj = Object.fromEntries(store.entries());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Could not write payload cache to disk:', err);
    }
  };

  return {
    name: 'payload-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/payload', (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

        if (req.method === 'GET') {
          const id = (url.searchParams.get('id') || '').toLowerCase().trim();
          if (!id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing id parameter' }));
            return;
          }
          const item = store.get(id);
          if (!item) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Payload not found' }));
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, id, payload: item.payload, filename: item.filename }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (!data.id || !data.payload) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing id or payload' }));
                return;
              }
              const cleanId = String(data.id).toLowerCase().trim();
              store.set(cleanId, {
                payload: data.payload,
                filename: data.filename,
                timestamp: Date.now(),
              });
              if (store.size > 2000) {
                const oldest = store.keys().next().value;
                if (oldest) store.delete(oldest);
              }
              persistToDisk();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, id: cleanId }));
            } catch {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to save payload' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), payloadApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Disable HMR to eliminate WebSocket connection error banners in sandboxed iframe environment
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

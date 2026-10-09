// Serves Balloon Room and its sync API from one Node process, for running sync on your own
// machine or on any Node host. Settings come from environment variables (see the README):
//   MONGODB_URI, SYNC_KEY, and optionally MONGODB_DB, ALLOWED_ORIGINS, PORT, SYNC_STORE=memory.
// Run it with `npm run serve`, then open http://localhost:8000.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSyncHandler, parseOrigins } from './sync-handler.js';
import { storageFromEnv } from './storage.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
};

// Only the app's own files are served, never .env, .git, node_modules or the server code.
const PUBLIC_FILES = new Set(['index.html', 'styles.css', 'CP_book.pdf']);

// Maps a URL path to a file the app needs, or null.
export function publicFile(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path === '/') path = '/index.html';
  const rel = path.slice(1);
  const parts = rel.split('/');
  if (parts.some((part) => !part || part.startsWith('.') || part.includes('\\') || part.includes('\0'))) return null;
  const isAppScript = parts[0] === 'src' && extname(rel) === '.js';
  if (!PUBLIC_FILES.has(rel) && !isAppScript) return null;
  return join(ROOT, ...parts);
}

export function createAppServer({ env = process.env, log = console } = {}) {
  const storage = storageFromEnv(env);
  const sync = createSyncHandler({
    storage,
    syncKey: env.SYNC_KEY,
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    log,
  });

  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/state') return sync(req, res);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    const file = publicFile(pathname);
    let body = null;
    if (file) {
      try {
        body = await readFile(file);
      } catch {
        body = null;
      }
    }
    if (!body) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(req.method === 'HEAD' ? undefined : body);
  });
  // Let the process exit cleanly once the server stops.
  server.on('close', () => {
    if (storage) storage.close().catch(() => {});
  });
  return server;
}

const runDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  const port = Number(process.env.PORT) || 8000;
  const configured = Boolean(process.env.SYNC_KEY && (process.env.MONGODB_URI || process.env.SYNC_STORE === 'memory'));
  createAppServer().listen(port, () => {
    console.log(`Balloon Room is running at http://localhost:${port}`);
    if (!configured) console.log('Sync is off: set MONGODB_URI and SYNC_KEY to turn it on (see the README).');
    else if (!process.env.MONGODB_URI) console.log('Sync is using memory storage, which forgets everything when the server stops.');
  });
}

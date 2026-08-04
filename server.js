/**
 * Local development server.
 *
 * A thin adapter over src/core.js: same data logic as the deployed Worker, with
 * daily history kept in history.json instead of Cloudflare KV.
 *
 * No dependencies. Requires Node 18+ (uses global fetch).
 *   node server.js
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPayload } from './src/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HANDLE = process.env.BOOTDEV_HANDLE || 'the_baaneh';
const PATH_SLUG = process.env.BOOTDEV_PATH || 'backend';
const TZ = process.env.BOOTDEV_TZ || 'UTC';
const PORT = Number(process.env.PORT) || 4173;

const HISTORY = path.join(__dirname, 'history.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

/** File-backed store matching the interface core.js expects. */
const fileStore = {
  async read() {
    try {
      const h = JSON.parse(fs.readFileSync(HISTORY, 'utf8'));
      return Array.isArray(h.days) ? h.days : [];
    } catch {
      return [];
    }
  },
  async write(days) {
    try {
      fs.writeFileSync(HISTORY, JSON.stringify({ days }, null, 1));
    } catch (err) {
      console.warn('[history] could not write:', err.message);
    }
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/progress') {
    try {
      const data = await buildPayload({
        store: fileStore,
        handle: HANDLE,
        pathSlug: PATH_SLUG,
        tz: TZ,
        fresh: url.searchParams.get('fresh') === '1',
      });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('[api]', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`\n  boot.dev dashboard for @${HANDLE}`);
  console.log(`  http://localhost:${PORT}\n`);
});

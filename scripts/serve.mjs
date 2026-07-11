// Dev server for the demo. Serves the repo root (so examples/ can import
// `../dist/…`) and redirects `/` → `/examples/`. Binds to loopback and scans for
// the next free port from PORT (default 5173) — a specific-address bind means a
// server already squatting the port (even an IPv6-only one) triggers EADDRINUSE,
// so we skip past it. With `--watch` it also runs `tsup --watch`, rebuilding
// `dist/` as you edit `src/`. Driven by `pnpm dev`.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const START = Number(process.env.PORT) || 5173;
const WATCH = process.argv.includes('--watch');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function handler(req, res) {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') {
      res.writeHead(302, { location: '/examples/' });
      res.end();
      return;
    }
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(err && err.code === 'ENOENT' ? 404 : 400);
    res.end(err && err.code === 'ENOENT' ? 'Not found' : 'Bad request');
  }
}

function startWatch() {
  const bin = fileURLToPath(new URL('../node_modules/.bin/tsup', import.meta.url));
  const tsup = spawn(bin, ['--watch'], { stdio: 'inherit' });
  const stop = () => {
    tsup.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

const server = createServer(handler);
let port = START;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port - START < 50) {
    server.listen(++port, 'localhost'); // port busy (incl. an IPv6-only squatter) — try the next
  } else {
    console.error(err);
    process.exit(1);
  }
});
server.listen(port, 'localhost', () => {
  console.log(`\n  favicon-env demo → http://localhost:${port}/\n`);
  if (WATCH) startWatch();
});

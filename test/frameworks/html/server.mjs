import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const packageDist = new URL('./', import.meta.resolve('favicon-env'));
const mode = valueAfter('--mode') ?? 'esm';
const environment = process.env.APP_ENV ?? 'prod';
const port = Number(process.env.PORT ?? 4321);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  try {
    if (url.pathname === '/') {
      send(response, html(mode, environment), 'text/html; charset=utf-8');
      return;
    }
    if (url.pathname === '/favicon.svg') {
      send(response, await readFile(new URL('./favicon.svg', import.meta.url)), 'image/svg+xml');
      return;
    }
    if (url.pathname.startsWith('/dist/')) {
      const file = url.pathname.slice('/dist/'.length);
      if (!/^[a-zA-Z0-9._-]+$/.test(file)) throw new Error('Invalid path');
      send(response, await readFile(new URL(file, packageDist)), 'text/javascript; charset=utf-8');
      return;
    }
    response.writeHead(404).end('Not found');
  } catch (error) {
    response.writeHead(500).end(error instanceof Error ? error.message : 'Unknown error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Plain HTML ${mode} fixture ready at http://127.0.0.1:${port}`);
});

function html(scriptMode, appEnv) {
  const enabled = appEnv === 'dev' || appEnv === 'staging';
  const options =
    scriptMode === 'esm'
      ? appEnv === 'dev'
        ? `{ source: '/favicon.svg?source=html-esm', environments: { dev: { invert: 0.65 } } }`
        : `{ size: 96, environments: { staging: { tint: '#a855f7', badge: '#22d3ee' } } }`
      : appEnv === 'dev'
        ? `{ environments: { dev: { hue: 75, badge: { text: 'G', color: '#ef4444' } } } }`
        : `{ environments: { staging: { badge: { text: 'GS', color: '#fde047', textColor: '#111827', corner: 'center', size: 0.7 } } } }`;
  const script = !enabled
    ? ''
    : scriptMode === 'global'
      ? `<script src="/dist/favicon-env.global.js"></script>
         <script>void faviconEnv.envFavicon({ ...${options}, detect: () => ${JSON.stringify(appEnv)} })</script>`
      : `<script type="module">
           import { envFavicon } from '/dist/index.js'
           void envFavicon({ ...${options}, detect: () => ${JSON.stringify(appEnv)} })
         </script>`;

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>favicon-env plain HTML ${scriptMode} integration</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
      </head>
      <body>
        <main data-app-env="${appEnv}">Plain HTML ${scriptMode} fixture</main>
        ${script}
      </body>
    </html>`;
}

function send(response, body, contentType) {
  response.writeHead(200, { 'content-type': contentType });
  response.end(body);
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

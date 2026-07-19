import { chromium, firefox, webkit } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import process from 'node:process';
import {
  environmentVariables,
  environments as allEnvironments,
  expectedFavicon,
  frameworks as allFrameworks,
} from './matrix.mjs';

const root = new URL('../../', import.meta.url).pathname;
const selectedFramework = valueAfter('--framework');
const selectedEnvironment = valueAfter('--env');
const selectedBrowser = valueAfter('--browser') ?? 'chromium';
const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[selectedBrowser];
const frameworks = allFrameworks.filter(({ id }) => !selectedFramework || id === selectedFramework);
const environments = allEnvironments.filter(
  (environment) => !selectedEnvironment || environment === selectedEnvironment,
);

if (frameworks.length === 0 || environments.length === 0 || !browserType) {
  throw new Error('Unknown --framework, --env, or --browser filter');
}

await run(['build']);
const browser = await browserType.launch({ headless: true });

try {
  for (const framework of frameworks) {
    for (const environment of environments) {
      const label = `${framework.id} / ${environment} / ${selectedBrowser}`;
      const port = await availablePort();
      const instance = `test-${framework.id}-${environment}-${selectedBrowser}`;
      const env = environmentVariables(framework, environment, port, instance);

      if (environment !== 'dev' && framework.build !== false) {
        await run(['--filter', framework.packageName, 'build'], env, `${label} build`);
        if (environment === 'prod') {
          await assertRuntimeExcluded(framework, instance, environment, label);
        }
      }

      const [command, args] =
        environment === 'dev' ? framework.devCommand(port) : framework.startCommand(port);
      const server = start(command, args, env, framework.cwd);

      try {
        const url = `http://127.0.0.1:${port}`;
        await waitUntilReady(url, server, label);
        const page = await browser.newPage();
        const browserErrors = [];
        page.on('pageerror', (error) => browserErrors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') browserErrors.push(message.text());
        });
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForSelector(`[data-app-env="${environment}"]`);
        await assertFavicon(page, expectedFavicon(framework, environment), label, browserErrors);
        if (environment === 'prod' && framework.build === false) {
          await assertHtmlRuntimeExcluded(page, label);
        }
        await page.close();
        console.log(`✓ ${label}`);
      } finally {
        await stop(server);
      }
    }
  }
} finally {
  await browser.close();
}

async function assertRuntimeExcluded(framework, instance, environment, label) {
  const directory = framework.clientBundleDir?.(instance, environment);
  if (!directory) throw new Error(`${label} has no client bundle exclusion assertion`);

  const files = await javascriptFiles(directory);
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (source.includes('/favicon.ico')) offenders.push(file);
  }
  if (offenders.length > 0) {
    throw new Error(`${label} retained the favicon-env runtime in: ${offenders.join(', ')}`);
  }
}

async function javascriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await javascriptFiles(path)));
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

async function assertHtmlRuntimeExcluded(page, label) {
  const scripts = await page
    .locator('script')
    .evaluateAll((elements) =>
      elements.map(
        (element) => `${element.getAttribute('src') ?? ''}\n${element.textContent ?? ''}`,
      ),
    );
  if (scripts.some((script) => script.includes('favicon-env'))) {
    throw new Error(`${label} retained the favicon-env runtime script`);
  }
}

async function assertFavicon(page, expected, label, browserErrors) {
  try {
    await page.waitForFunction((expectedKind) => {
      const icons = document.querySelectorAll('link[rel~="icon"]');
      const icon = icons.item(0);
      if (icons.length !== 1 || !(icon instanceof HTMLLinkElement)) return false;
      if (expectedKind === 'original') {
        return icon.href.endsWith('/favicon.svg') && !icon.hasAttribute('data-favicon-env');
      }
      if (expectedKind === 'direct') {
        return (
          icon.hasAttribute('data-favicon-env') &&
          icon.href.endsWith('/favicon.svg?custom=angular-dev') &&
          icon.type === 'image/svg+xml'
        );
      }
      return (
        icon.hasAttribute('data-favicon-env') && icon.href.startsWith('data:image/png;base64,')
      );
    }, expected.kind);
  } catch (error) {
    const icons = await page.locator('link[rel~="icon"]').evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.getAttribute('href'),
        managed: element.hasAttribute('data-favicon-env'),
      })),
    );
    throw new Error(
      `${label} expected ${expected.label}: ${JSON.stringify({ icons, browserErrors })}`,
      {
        cause: error,
      },
    );
  }
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function run(args, env = process.env, label = args.join(' ')) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

function start(command, args, env, cwd) {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.log = '';
  const collect = (chunk) => {
    child.log = `${child.log}${chunk}`.slice(-12_000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  return child;
}

async function waitUntilReady(url, child, label) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${label} server exited early (${child.exitCode})\n${child.log}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} server did not become ready\n${child.log}`);
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a test port'));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function stop(child) {
  if (child.exitCode !== null) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return;
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
  }
}

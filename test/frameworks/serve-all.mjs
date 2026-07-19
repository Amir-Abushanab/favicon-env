import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';
import { environmentVariables, environments, expectedFavicon, frameworks } from './matrix.mjs';

const root = new URL('../../', import.meta.url).pathname;
const cases = frameworks.flatMap((framework) =>
  environments.map((environment, index) => {
    const port = framework.ports[index];
    const instance = `${framework.id}-${environment}`;
    return {
      ...framework,
      environment,
      port,
      url: `http://127.0.0.1:${port}`,
      expected: expectedFavicon(framework, environment).label,
      label: `${framework.framework} / ${environment}`,
      env: environmentVariables(framework, environment, port, instance),
    };
  }),
);
const servers = [];
let resolveStop;
const stopRequested = new Promise((resolve) => {
  resolveStop = resolve;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    resolveStop();
    stopAllSync();
  });
}
process.once('exit', stopAllSync);

try {
  await assertPortsAvailable(cases);
  await run(['build'], process.env, 'library');

  for (const item of cases.filter(
    ({ environment, build }) => environment !== 'dev' && build !== false,
  )) {
    console.log(`\nBuilding ${item.label}…`);
    await run(['--filter', item.packageName, 'build'], item.env, item.label);
  }

  console.log(`\nStarting all ${cases.length} framework fixtures…`);
  for (const item of cases) {
    const [command, args] =
      item.environment === 'dev' ? item.devCommand(item.port) : item.startCommand(item.port);
    servers.push({
      ...item,
      child: start(command, args, item.env, item.label, item.cwd),
    });
  }

  await Promise.all(servers.map(({ url, child, label }) => waitUntilReady(url, child, label)));

  console.log(`\nAll ${cases.length} fixtures are ready:\n`);
  console.table(
    cases.map(({ framework, environment, url, expected }) => ({
      Framework: framework,
      Environment: environment,
      URL: url,
      'Expected favicon': expected,
    })),
  );
  console.log('Press Ctrl+C to stop all servers.\n');

  const result = await waitForStopOrExit(servers);
  if (result) {
    throw new Error(`${result.label} exited unexpectedly (${result.code ?? result.signal})`);
  }
} finally {
  await Promise.all(servers.map(({ child }) => stop(child)));
}

function run(args, env, label) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} build exited with code ${code}`));
    });
  });
}

function start(command, args, env, label, cwd) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.log = '';
  pipeWithLabel(child.stdout, label, child);
  pipeWithLabel(child.stderr, label, child);
  return child;
}

function pipeWithLabel(stream, label, child) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      child.log = `${child.log}${line}\n`.slice(-12_000);
      if (line) console.log(`[${label}] ${line}`);
    }
  });
}

async function waitUntilReady(url, child, label) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${label} exited before becoming ready\n${child.log}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready\n${child.log}`);
}

function waitForStopOrExit(activeServers) {
  return Promise.race([
    stopRequested.then(() => null),
    new Promise((resolve) => {
      for (const { child, label } of activeServers) {
        child.once('exit', (code, signal) => resolve({ label, code, signal }));
      }
    }),
  ]);
}

function stopAllSync() {
  for (const { child } of servers) {
    if (child.exitCode !== null) continue;
    try {
      child.kill('SIGTERM');
    } catch {}
  }
}

async function assertPortsAvailable(items) {
  const occupied = [];
  for (const item of items) {
    const available = await portIsAvailable(item.port);
    if (!available) occupied.push(`${item.port} (${item.label})`);
  }
  if (occupied.length > 0) {
    throw new Error(`Fixture ports already in use: ${occupied.join(', ')}`);
  }
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function stop(child) {
  if (child.exitCode !== null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) {
    try {
      child.kill('SIGKILL');
    } catch {}
  }
}

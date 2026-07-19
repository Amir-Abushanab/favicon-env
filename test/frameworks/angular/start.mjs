import { spawn } from 'node:child_process';

const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');
const output = instance ? `dist-${instance}` : 'dist';
const child = spawn('node', [`${output}/server/server.mjs`], { stdio: 'inherit' });

child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

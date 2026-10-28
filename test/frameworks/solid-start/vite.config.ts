import { solidStart } from '@solidjs/start/config';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');

export default defineConfig({
  cacheDir: instance ? `node_modules/.vite-${instance}` : 'node_modules/.vite',
  plugins: [
    solidStart(),
    nitro({
      preset: 'node-server',
      buildDir: instance ? `node_modules/.nitro-${instance}` : 'node_modules/.nitro',
      output: { dir: instance ? `.output-${instance}` : '.output' },
    }),
  ],
});

import { defineConfig } from '@solidjs/start/config';

const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');

export default defineConfig({
  server: {
    preset: 'node-server',
    buildDir: instance ? `node_modules/.nitro-${instance}` : 'node_modules/.nitro',
    output: { dir: instance ? `.output-${instance}` : '.output' },
  },
  vite({ router }) {
    return {
      cacheDir: instance
        ? `node_modules/.vite-${instance}-${router}`
        : `node_modules/.vite-${router}`,
    };
  },
});

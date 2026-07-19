import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');

export default defineConfig({
  cacheDir: instance ? `node_modules/.vite-${instance}` : 'node_modules/.vite',
  plugins: [
    tanstackStart(),
    nitro({
      buildDir: instance ? `node_modules/.nitro-${instance}` : 'node_modules/.nitro',
      output: { dir: instance ? `.output-${instance}` : '.output' },
    }),
    react(),
  ],
});

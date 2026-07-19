import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');
const appEnv = process.env.PUBLIC_APP_ENV ?? 'prod';

export default defineConfig({
  cacheDir: instance ? `node_modules/.vite-${instance}` : 'node_modules/.vite',
  define: { __FAVICON_ENV_APP_ENV__: JSON.stringify(appEnv) },
  plugins: [
    sveltekit({
      adapter: adapter({ out: instance ? `build-${instance}` : 'build' }),
      outDir: instance ? `.svelte-kit-${instance}` : '.svelte-kit',
    }),
  ],
});

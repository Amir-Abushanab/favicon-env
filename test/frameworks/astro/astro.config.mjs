import { defineConfig } from 'astro/config';

const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');

export default defineConfig({
  outDir: instance ? `./dist-${instance}` : './dist',
  cacheDir: instance ? `./node_modules/.astro-${instance}` : './node_modules/.astro',
  vite: {
    cacheDir: instance ? `./node_modules/.vite-${instance}` : './node_modules/.vite',
  },
});

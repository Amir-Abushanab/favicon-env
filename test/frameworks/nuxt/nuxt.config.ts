const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');
const appEnv = process.env.NUXT_PUBLIC_APP_ENV ?? 'prod';

export default defineNuxtConfig({
  compatibilityDate: '2026-07-18',
  devtools: { enabled: false },
  nitro: { output: { dir: instance ? `.output-${instance}` : '.output' } },
  vite: {
    cacheDir: instance ? `node_modules/.vite-${instance}` : 'node_modules/.vite',
    define: { __FAVICON_ENV_APP_ENV__: JSON.stringify(appEnv) },
  },
  app: {
    head: {
      title: 'favicon-env Nuxt integration',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
});

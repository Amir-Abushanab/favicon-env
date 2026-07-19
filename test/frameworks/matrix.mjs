const fixtures = new URL('./', import.meta.url);

export const frameworks = [
  {
    id: 'next',
    framework: 'Next.js',
    packageName: '@favicon-env-test/next',
    cwd: fixture('next'),
    envKey: 'NEXT_PUBLIC_APP_ENV',
    ports: [4400, 4401, 4402],
    effects: ['hue rotation', 'full inversion'],
    clientBundleDir: (_instance, environment) => fixture(`next/.next-${environment}/static`),
    devCommand: (port) =>
      command('node_modules/.bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port),
    startCommand: (port) =>
      command('node_modules/.bin/next', 'start', '--hostname', '127.0.0.1', '--port', port),
  },
  {
    id: 'tanstack-start',
    framework: 'TanStack Start',
    packageName: '@favicon-env-test/tanstack-start',
    cwd: fixture('tanstack-start'),
    envKey: 'VITE_APP_ENV',
    ports: [4410, 4411, 4412],
    effects: ['exact-colour tint', 'explicit CSS filter'],
    clientBundleDir: (instance) => fixture(`tanstack-start/.output-${instance}/public`),
    devCommand: (port) =>
      command('node_modules/.bin/vite', 'dev', '--host', '127.0.0.1', '--port', port),
    startCommand: () => command('node', 'start.mjs'),
  },
  {
    id: 'astro',
    framework: 'Astro',
    packageName: '@favicon-env-test/astro',
    cwd: fixture('astro'),
    envKey: 'PUBLIC_APP_ENV',
    ports: [4420, 4421, 4422],
    effects: ['automatic host hue', 'dot badge'],
    clientBundleDir: (instance) => fixture(`astro/dist-${instance}`),
    devCommand: () => command('node', 'dev.mjs'),
    startCommand: (port) =>
      command('node_modules/.bin/astro', 'preview', '--host', '127.0.0.1', '--port', port),
  },
  {
    id: 'sveltekit',
    framework: 'SvelteKit',
    packageName: '@favicon-env-test/sveltekit',
    cwd: fixture('sveltekit'),
    envKey: 'PUBLIC_APP_ENV',
    ports: [4430, 4431, 4432],
    effects: ['positioned text badge', 'opaque cover badge'],
    clientBundleDir: (instance) => fixture(`sveltekit/.svelte-kit-${instance}/output/client`),
    devCommand: (port) =>
      command('node_modules/.bin/vite', 'dev', '--host', '127.0.0.1', '--port', port),
    startCommand: () => command('node', 'start.mjs'),
  },
  {
    id: 'solid-start',
    framework: 'SolidStart',
    packageName: '@favicon-env-test/solid-start',
    cwd: fixture('solid-start'),
    envKey: 'VITE_APP_ENV',
    ports: [4440, 4441, 4442],
    effects: ['translucent cover badge', 'combined hue and partial inversion'],
    clientBundleDir: (instance) => fixture(`solid-start/.output-${instance}/public`),
    devCommand: (port) =>
      command('node_modules/.bin/vinxi', 'dev', '--host', '127.0.0.1', '--port', port),
    startCommand: () => command('node', 'start.mjs'),
  },
  {
    id: 'angular',
    framework: 'Angular SSR',
    packageName: '@favicon-env-test/angular',
    cwd: fixture('angular'),
    envKey: 'APP_ENV',
    ports: [4450, 4451, 4452],
    effects: ['direct custom source', 'custom source with tint'],
    faviconKinds: ['direct', 'png'],
    clientBundleDir: (instance) => fixture(`angular/dist-${instance}/browser`),
    devCommand: (port) =>
      command('node_modules/.bin/ng', 'serve', '--host', '127.0.0.1', '--port', port),
    startCommand: () => command('node', 'start.mjs'),
  },
  {
    id: 'nuxt',
    framework: 'Nuxt',
    packageName: '@favicon-env-test/nuxt',
    cwd: fixture('nuxt'),
    envKey: 'NUXT_PUBLIC_APP_ENV',
    ports: [4460, 4461, 4462],
    effects: ['regex rule with capture', 'function rule with computed badge'],
    clientBundleDir: (instance) => fixture(`nuxt/.output-${instance}/public`),
    devCommand: (port) =>
      command('node_modules/.bin/nuxt', 'dev', '--host', '127.0.0.1', '--port', port),
    startCommand: () => command('node', 'start.mjs'),
  },
  {
    id: 'html-esm',
    framework: 'Plain HTML (ESM)',
    packageName: '@favicon-env-test/html',
    cwd: fixture('html'),
    envKey: 'APP_ENV',
    ports: [4470, 4471, 4472],
    effects: ['explicit source with partial inversion', 'custom size with tint and dot'],
    build: false,
    devCommand: () => command('node', 'server.mjs', '--mode', 'esm'),
    startCommand: () => command('node', 'server.mjs', '--mode', 'esm'),
  },
  {
    id: 'html-global',
    framework: 'Plain HTML (global)',
    packageName: '@favicon-env-test/html',
    cwd: fixture('html'),
    envKey: 'APP_ENV',
    ports: [4480, 4481, 4482],
    effects: ['global build with hue and badge', 'centred badge with explicit text colour'],
    build: false,
    devCommand: () => command('node', 'server.mjs', '--mode', 'global'),
    startCommand: () => command('node', 'server.mjs', '--mode', 'global'),
  },
];

export const environments = ['dev', 'staging', 'prod'];

export function environmentVariables(framework, environment, port, instance) {
  return {
    ...process.env,
    NO_COLOR: '1',
    NG_CLI_ANALYTICS: 'false',
    NUXT_TELEMETRY_DISABLED: '1',
    HOST: '127.0.0.1',
    NITRO_HOST: '127.0.0.1',
    PORT: String(port),
    FAVICON_ENV_INSTANCE: instance,
    [framework.envKey]: environment,
  };
}

export function expectedFavicon(framework, environment) {
  if (environment === 'prod') return { label: 'original framework favicon', kind: 'original' };
  const index = environment === 'dev' ? 0 : 1;
  return {
    label: framework.effects[index],
    kind: framework.faviconKinds?.[index] ?? 'png',
  };
}

function fixture(name) {
  return new URL(`./${name}/`, fixtures).pathname;
}

function command(executable, ...args) {
  return [executable, args.map(String)];
}

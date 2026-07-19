# favicon-env

Tint your favicon per environment so you can tell instances apart at a glance — no more staring at three identical tabs wondering which one is production.

![favicon-env — the same base icon per environment: prod, dev (hue-shift), dev (exact-colour tint), dev (invert), staging (dot), a "#344" preview cover, and a custom image](docs/hero.png)

**[▶ Live, clickable demo](https://amir-abushanab.github.io/favicon-env/)**

- **Runtime mode** — tint an existing SVG, PNG, or ICO in the browser.
- **Build-time mode** — bake changes into an SVG during build or SSR.
- **Zero dependencies.** ~2.3 kB min+gzip.

## Install

```sh
pnpm add favicon-env
```

> **Using an AI coding agent?** Install the bundled [Agent Skill](https://tanstack.com/intent) with `pnpm dlx @tanstack/intent@latest install`.

## Runtime mode

```js
import { envFavicon } from 'favicon-env';

envFavicon({
  environments: {
    dev: { tint: '#22c55e' },
    staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
  },
});
```

### Zero bytes in prod

An unconditional call stays bundled even when `prod` is absent from `environments`. To remove the runtime, put `import('favicon-env')` behind a compile-time environment check. The examples below use this pattern, and the framework matrix scans their emitted prod assets to verify exclusion.

Call it on the client after the favicon link exists:

<details>
<summary><b>Next.js</b> — App Router</summary>

```tsx
// app/favicon-env.tsx — a client component
'use client';
import { useEffect } from 'react';

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? 'prod';

export function FaviconEnv() {
  useEffect(() => {
    if (appEnv !== 'dev' && appEnv !== 'staging') return;

    let queued = false;
    const apply = async () => {
      queued = false;
      const { envFavicon } = await import('favicon-env');
      await envFavicon({
        environments: {
          dev: { tint: '#22c55e' },
          staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
        },
        detect: () => appEnv,
      });
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(apply);
    };
    // Next can restore metadata-managed icons during hydration or navigation.
    const observer = new MutationObserver(() => {
      if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
        schedule();
      }
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'rel'],
    });
    schedule();
    return () => observer.disconnect();
  }, []);
  return null;
}
```

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { FaviconEnv } from './favicon-env';

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FaviconEnv />
        {children}
      </body>
    </html>
  );
}
```

The observer handles metadata reconciliation during hydration and navigation. Pages Router: render the component from `pages/_app.tsx`.

</details>

<details>
<summary><b>TanStack Router / Start</b></summary>

```tsx
// src/client.tsx
import { StartClient } from '@tanstack/react-start/client';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

const appEnv = import.meta.env.VITE_APP_ENV ?? 'prod';

if (appEnv === 'dev' || appEnv === 'staging') {
  let queued = false;
  const apply = async () => {
    queued = false;
    const { envFavicon } = await import('favicon-env');
    await envFavicon({
      environments: {
        dev: { tint: '#22c55e' },
        staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
      },
      detect: () => appEnv,
    });
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(apply);
  };
  const observer = new MutationObserver(() => {
    if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
      schedule();
    }
  });
  observer.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'rel'],
  });
  schedule();
}

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
);
```

Create the optional `src/client.tsx` entry. For a TanStack Router SPA, use the same observer in `src/main.tsx` before rendering the app.

</details>

<details>
<summary><b>Astro</b></summary>

```astro
---
// src/layouts/Layout.astro
---
<html lang="en">
  <head>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <slot />
    <script>
      const appEnv = import.meta.env.PUBLIC_APP_ENV ?? 'prod';
      if (appEnv === 'dev' || appEnv === 'staging') {
        void import('favicon-env').then(({ envFavicon }) =>
          envFavicon({
            environments: {
              dev: { tint: '#22c55e' },
              staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
            },
            detect: () => appEnv,
          }),
        );
      }
    </script>
  </body>
</html>
```

For an SVG with no first-paint flash, use the build-time helper below.

</details>

<details>
<summary><b>SvelteKit</b></summary>

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    const appEnv = __FAVICON_ENV_APP_ENV__;
    if (appEnv !== 'dev' && appEnv !== 'staging') return;

    let queued = false;
    const apply = async () => {
      queued = false;
      const { envFavicon } = await import('favicon-env');
      await envFavicon({
        environments: {
          dev: { tint: '#22c55e' },
          staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
        },
        detect: () => appEnv,
      });
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(apply);
    };
    const observer = new MutationObserver(() => {
      if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
        schedule();
      }
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'rel'],
    });
    schedule();

    return () => observer.disconnect();
  });
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</svelte:head>

{@render children()}
```

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __FAVICON_ENV_APP_ENV__: JSON.stringify(process.env.PUBLIC_APP_ENV ?? 'prod'),
  },
  plugins: [sveltekit()],
});
```

```ts
// src/app.d.ts
declare const __FAVICON_ENV_APP_ENV__: string;
```

The explicit build constant lets Vite remove the import from prod output.

</details>

<details>
<summary><b>SolidStart</b></summary>

```tsx
// src/app.tsx
import { Link, MetaProvider } from '@solidjs/meta';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { onCleanup, onMount, Suspense } from 'solid-js';

export default function App() {
  onMount(() => {
    const appEnv = import.meta.env.VITE_APP_ENV ?? 'prod';
    if (appEnv !== 'dev' && appEnv !== 'staging') return;

    let queued = false;
    const apply = async () => {
      queued = false;
      const { envFavicon } = await import('favicon-env');
      await envFavicon({
        environments: {
          dev: { tint: '#22c55e' },
          staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
        },
        detect: () => appEnv,
      });
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(apply);
    };
    const observer = new MutationObserver(() => {
      if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
        schedule();
      }
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'rel'],
    });
    schedule();
    onCleanup(() => observer.disconnect());
  });

  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
```

Keep the hook in the app root so it survives route changes.

</details>

<details>
<summary><b>Angular SSR</b> — standalone application</summary>

```ts
// src/app/app.ts
import { Component, DestroyRef, afterNextRender, inject } from '@angular/core';
import { loadEnvFavicon } from './favicon-env-loader';

declare const APP_ENV: string;

@Component({ selector: 'app-root', template: '<main>App</main>', imports: [] })
export class App {
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (APP_ENV !== 'dev' && APP_ENV !== 'staging') return;

      let queued = false;
      const apply = async () => {
        queued = false;
        const envFavicon = await loadEnvFavicon();
        if (!envFavicon) return;
        await envFavicon({
          environments: {
            dev: { tint: '#22c55e' },
            staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
          },
          detect: () => APP_ENV,
        });
      };
      const schedule = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(apply);
      };
      const observer = new MutationObserver(() => {
        if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
          schedule();
        }
      });

      observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'rel'],
      });
      schedule();
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
```

```ts
// src/app/favicon-env-loader.ts
export async function loadEnvFavicon() {
  return (await import('favicon-env')).envFavicon;
}
```

```ts
// src/app/favicon-env-loader.prod.ts
import type { EnvFaviconOptions } from 'favicon-env';

type EnvFavicon = (options?: EnvFaviconOptions) => Promise<void>;

export async function loadEnvFavicon(): Promise<EnvFavicon | null> {
  return null;
}
```

In the production build configuration in `angular.json`:

```json
{
  "define": { "APP_ENV": "'prod'" },
  "fileReplacements": [
    {
      "replace": "src/app/favicon-env-loader.ts",
      "with": "src/app/favicon-env-loader.prod.ts"
    }
  ]
}
```

Use the real loader for dev/staging. Angular's file replacement prevents it from emitting an unused lazy chunk in prod.

</details>

<details>
<summary><b>Nuxt</b></summary>

```ts
// app/plugins/favicon-env.client.ts
export default defineNuxtPlugin(() => {
  const appEnv = __FAVICON_ENV_APP_ENV__;
  if (appEnv !== 'dev' && appEnv !== 'staging') return;

  let queued = false;
  const apply = async () => {
    queued = false;
    const { envFavicon } = await import('favicon-env');
    await envFavicon({
      environments: {
        dev: { tint: '#22c55e' },
        staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
      },
      detect: () => appEnv,
    });
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(apply);
  };
  const observer = new MutationObserver(() => {
    if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
      schedule();
    }
  });

  observer.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'rel'],
  });
  schedule();
});
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    define: {
      __FAVICON_ENV_APP_ENV__: JSON.stringify(process.env.NUXT_PUBLIC_APP_ENV ?? 'prod'),
    },
  },
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
});
```

```ts
// app/types.d.ts
declare const __FAVICON_ENV_APP_ENV__: string;
```

The explicit build constant lets Vite remove the import from prod output.

</details>

<details>
<summary><b>Plain HTML</b> — ESM and global builds</summary>

```html
<!-- Native ESM through an ESM-aware CDN -->
<link rel="icon" href="/favicon.svg" />
<script type="module">
  import { envFavicon } from 'https://esm.sh/favicon-env';

  void envFavicon({
    environments: {
      dev: { tint: '#22c55e' },
      staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
    },
  });
</script>
```

```html
<!-- Classic global build -->
<link rel="icon" href="/favicon.svg" />
<script src="https://unpkg.com/favicon-env/dist/favicon-env.global.js"></script>
<script>
  void faviconEnv.envFavicon({
    environments: {
      dev: { tint: '#22c55e' },
      staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
    },
  });
</script>
```

The global script can also auto-run with `data-auto` or `data-dev`/`data-staging` attributes.
For a zero-byte prod page, have the HTML build/template omit these scripts when the app environment is `prod`.

</details>

By default the environment is guessed from the hostname (`localhost` / `*.local` / raw IPs → `dev`; a `staging`/`preview`/`qa`/… segment → `staging`; everything else → `prod`). Override it:

```js
envFavicon({
  environments: {
    dev: { tint: '#22c55e' },
    staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
  },
  detect: () => (location.port === '4000' ? 'staging' : 'prod'),
});
```

Environment names are arbitrary. Custom names require a custom `detect`:

```js
envFavicon({
  environments: {
    canary: { hue: 280 },
    demo: { badge: '#22c55e' },
  },
  detect: () => {
    if (location.hostname.startsWith('canary.')) return 'canary';
    if (location.hostname.endsWith('.demo.acme.com')) return 'demo';
    return 'prod'; // not in the map → favicon left untouched
  },
});
```

`detect` can use any runtime value, such as `import.meta.env.MODE`.

### Exact colours

Use `hue` for a relative colour shift or `tint` for a specific duotone colour:

```js
envFavicon({
  environments: {
    dev: { tint: '#22c55e' },
    staging: { tint: '#f59e0b' },
  },
});
```

Colour fields accept CSS colours, including `oklch()`, `lab()`, and `color(display-p3 …)` where supported.

### Invert

Pass `true` for a full invert or `0`–`1` for a partial invert:

```js
envFavicon({
  environments: {
    dev: { invert: true },
    staging: { invert: 0.9 },
  },
});
```

`invert` composes with `hue`; `tint` takes precedence, and `filter` overrides both.

### Auto mode

Derive a stable hue from `location.host`:

```js
envFavicon({ auto: true });
```

### Badges, PR numbers & URL rules

A `badge` can be a colour dot or an object with text. Rules can interpolate regex captures with `$1` or `$<name>`:

```js
envFavicon({
  rules: [
    { match: /^pr-(\d+)\./, badge: { text: '#$1', color: '#8b5cf6' } },
    { match: /staging\./, hue: 45 },
  ],
});
```

Regex rules test `location.host`, including the port. First match wins. Functions receive the full `URL`:

```js
rules: [
  {
    match: (url) => url.searchParams.has('pr'),
    badge: { text: (match, url) => `#${url.searchParams.get('pr')}` },
  },
];
```

Use `shape: 'cover'` to make multi-digit text readable at favicon size:

```js
{ badge: { text: '#344', color: '#8b5cf6', shape: 'cover' } }
```

### A different image per environment

Use `src` to replace the base image. Other effects still apply:

```js
envFavicon({
  environments: {
    staging: { src: '/favicon.staging.svg' },
    preview: { src: '/favicon.svg', badge: { text: '#344' } },
  },
});
```

## Build-time / SSR mode

Use `faviconDataUri` to bake changes into an SVG:

```astro
---
// src/pages/index.astro
import { faviconDataUri } from 'favicon-env/ssr'
import favicon from '../favicon.svg?raw'

const env = import.meta.env.PUBLIC_APP_ENV ?? (import.meta.env.DEV ? 'dev' : 'prod')
const tint = { dev: { hue: 130 }, staging: { hue: 45 }, prod: false }[env]
---
<link rel="icon" type="image/svg+xml" href={faviconDataUri(favicon, tint)} />
```

The SSR entry has no DOM dependency and supports badges:

```js
const pr = process.env.VERCEL_GIT_PULL_REQUEST_ID;
faviconDataUri(favicon, pr ? { badge: { text: `#${pr}` } } : { hue: 45 });
```

### Vite

This Vite plugin rewrites an SVG favicon using the current mode:

```js
// vite.config.js
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { faviconDataUri } from 'favicon-env/ssr';

const tints = {
  development: { hue: 130 },
  staging: { hue: 45 },
};

function faviconEnv() {
  let config;
  return {
    name: 'favicon-env',
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml(html) {
      const tint = tints[config.mode];
      if (!tint) return;
      return html.replace(/<link\b[^>]*\brel=["']icon["'][^>]*>/i, (tag) => {
        const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
        if (!href?.endsWith('.svg')) return tag;
        let svg;
        try {
          svg = readFileSync(path.join(config.publicDir, href.replace(/^\//, '')), 'utf8');
        } catch {
          return tag;
        }
        return tag.replace(/\bhref=["'][^"']*["']/i, `href="${faviconDataUri(svg, tint)}"`);
      });
    },
  };
}

export default defineConfig({
  plugins: [faviconEnv()],
});
```

The favicon must be an SVG in `public/`. Omit a mode to leave it unchanged.

## API

### `envFavicon(options?): Promise<void>` — runtime

| option         | type                               | default               | description                                                         |
| -------------- | ---------------------------------- | --------------------- | ------------------------------------------------------------------- |
| `environments` | `Record<string, EnvTint \| false>` | —                     | Map of env name (any string) → tint. Missing/`false` = untouched.   |
| `rules`        | `EnvRule[]`                        | —                     | URL-matched tints, checked first; regex captures fill `badge.text`. |
| `detect`       | `() => string \| undefined`        | hostname heuristic    | Return the current env name (a key of `environments`).              |
| `auto`         | `boolean \| { offset?: number }`   | `false`               | Ignore `environments`; derive a unique hue from `location.host`.    |
| `source`       | `string`                           | current icon / `.ico` | Favicon URL to tint.                                                |
| `size`         | `number`                           | `64`                  | Canvas raster size in px.                                           |

`EnvTint`: `{ hue?: number; invert?: boolean | number; tint?: string; filter?: string; src?: string; badge?: string | Badge }`. Precedence is `filter` → `tint` → `hue`/`invert`; `src` replaces the base image.

`Badge`: `{ text?: string | number; color?: string; textColor?: string; shape?: 'pill' | 'cover'; corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'; size?: number; opacity?: number }`. Without text it renders a dot. `textColor` defaults to automatic black/white contrast.

`EnvRule`: an `EnvTint` plus `match: RegExp | ((url: URL) => boolean)`. A `RegExp` is tested against `location.host` and its captures interpolate into `badge.text` (`$1`, `$<name>`); a function receives the `URL`, and in a rule `badge.text` may also be `(match, url) => string | number`.

### `favicon-env/ssr` — build-time

- `tintSvg(svg, tint) => string` — SVG string with the tint baked in as a wrapping filtered group.
- `svgToDataUri(svg) => string` — percent-encoded `data:image/svg+xml,…`.
- `faviconDataUri(svg, tint) => string` — the two combined; a ready favicon `href`.

### Helpers (from the main entry)

- `hashHue(input, offset?) => number` — the deterministic 0–359 hue used by auto mode.
- `defaultDetect(hostname?) => string` — the built-in `dev`/`staging`/`prod` heuristic.
- `matchRules(rules, url) => EnvTint | null` — the pure rule matcher (first match wins, captures interpolated). Reuse it server-side with a request `URL` and feed the result to `favicon-env/ssr`'s `faviconDataUri`.

## Caveats

- Cross-origin favicons need CORS permission for runtime canvas processing; failures leave the icon unchanged.
- Runtime mode may briefly show the original icon. Use the SSR helper to avoid this.
- Runtime mode requires canvas `ctx.filter`; unsupported browsers keep the original icon.

## License

MIT © Amir Abushanab

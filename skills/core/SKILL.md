---
name: core
description: >
  favicon-env tints the browser favicon per environment (dev/staging/prod) so
  identical tabs are distinguishable. Load when calling envFavicon, choosing
  runtime (canvas) vs build-time (SSR) mode, adding hue/invert/filter tints or
  badges/PR numbers, wiring it into Next.js/TanStack/Astro/SvelteKit/SolidStart/
  Angular/Nuxt/Vite/plain HTML, or configuring detect, environments, rules, or
  auto mode.
metadata:
  type: core
  library: favicon-env
  library_version: '0.2.0'
sources:
  - 'Amir-Abushanab/favicon-env:README.md'
  - 'Amir-Abushanab/favicon-env:src/tint.ts'
  - 'Amir-Abushanab/favicon-env:src/ssr.ts'
  - 'Amir-Abushanab/favicon-env:src/detect.ts'
---

# favicon-env

Two modes ship as separate entry points. `favicon-env` (runtime) redraws the
page's favicon on a `<canvas>` in the browser — works with any existing favicon
(svg/png/ico), but briefly shows the untinted icon until JS runs. `favicon-env/ssr`
(build-time) bakes the tint into an SVG string with no first-paint flash — use it
when you control the favicon SVG.

## Setup

Runtime — gate the import with a compile-time public environment value:

```js
const appEnv = import.meta.env.VITE_APP_ENV ?? 'prod';

if (appEnv === 'dev' || appEnv === 'staging') {
  void import('favicon-env').then(({ envFavicon }) =>
    envFavicon({
      environments: {
        dev: { tint: '#22c55e' },
        staging: { badge: '#f59e0b' },
      },
      detect: () => appEnv,
    }),
  );
}
```

With a literal prod value, the bundler can remove the branch and package runtime.
An unconditional call remains bundled even when `prod` is absent from `environments`.

The environment name defaults to a `location.hostname` heuristic (`defaultDetect`):
`localhost`/`*.local`/raw IPs → `dev`; a `staging`/`preview`/`qa`/`uat`/… segment →
`staging`; everything else → `prod`.

### Framework placement

| Runtime        | Put `envFavicon` here                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| Next.js        | Client component `useEffect`; render once from the root layout                 |
| TanStack Start | Optional `src/client.tsx`, before `hydrateRoot`                                |
| Astro          | Bundled client `<script>` in the root layout                                   |
| SvelteKit      | `onMount` in persistent `src/routes/+layout.svelte`                            |
| SolidStart     | `onMount` in `src/app.tsx`; use `onCleanup` for the observer                   |
| Angular SSR    | `afterNextRender` in the standalone root component; clean up with `DestroyRef` |
| Nuxt           | `app/plugins/favicon-env.client.ts`, using an explicit Vite build constant     |
| Vite SPA       | Client entry module (`src/main.ts`, etc.)                                      |
| Plain HTML     | Native module or the global build (`window.faviconEnv`)                        |

For any SSR router/head manager that declares the favicon itself, wrap the call in
the head-observer pattern below. Hydration or navigation can otherwise restore its
unmanaged `<link rel="icon">` after an early call. Apply only when an unmanaged icon
exists, queue one microtask at a time, and disconnect through the framework's native
cleanup hook when the integration is component-scoped.

### Zero runtime bytes in prod

Put `import('favicon-env')` behind a value the client bundler replaces at build time.
Use `NEXT_PUBLIC_*` in Next and `import.meta.env.VITE_*`/`PUBLIC_*` where those values
are folded to literals. SvelteKit and Nuxt may preserve their normal public runtime
configuration, so define a dedicated constant through Vite's `define` option and use
that in the guard.

Angular's application builder can emit a lazy chunk even behind a false `define`
guard. Put the dynamic import in a local loader module and replace that module with a
typed no-op in the prod build using Angular `fileReplacements`. For plain HTML, omit
the ESM/global script from the generated prod page. Do not use `enabled: false`: the
runtime must already be imported to read that option.

## Core Patterns

### Custom environments — any name, but supply a matching `detect`

```js
void envFavicon({
  environments: { canary: { hue: 280 }, demo: { badge: '#22c55e' } },
  detect: () => {
    if (location.hostname.startsWith('canary.')) return 'canary';
    if (location.hostname.endsWith('.demo.acme.com')) return 'demo';
    return 'prod'; // not in the map → untouched
  },
});
```

`environments` keys are arbitrary strings, but `defaultDetect` only ever returns
`dev`/`staging`/`prod`, so any other key needs a custom `detect`.

### URL rules — stamp the PR number on preview deploys

```js
void envFavicon({
  rules: [
    // pr-344.myapp.dev → a "#344" tile; $1 is the regex capture
    { match: /^pr-(\d+)\./, badge: { text: '#$1', color: '#8b5cf6', shape: 'cover' } },
    { match: /staging\./, hue: 45 },
  ],
});
```

`match` is a `RegExp` tested against `location.host` (includes `:port`) or a
`(url: URL) => boolean`. Rules are checked first, in order; first match wins, then
it falls through to `auto`/`environments`.

### Auto mode — one stable colour per host, zero config

```js
void envFavicon({ auto: true });
```

Derives a deterministic hue from `location.host`, so every origin and port gets its
own colour — handy for telling several dev servers apart.

### Build-time SSR — no first-paint flash

```js
import { faviconDataUri } from 'favicon-env/ssr';
import favicon from './favicon.svg?raw';

// during an Astro/Vite build; pick the tint for the current env
const href = faviconDataUri(favicon, { hue: 130 });
// → render into <link rel="icon" type="image/svg+xml" href={href}>
```

`favicon-env/ssr` is pure string manipulation (no DOM), safe in Node. It bakes a
CSS `filter` and/or badge into the SVG using its `viewBox`.

## Common Mistakes

### HIGH — Custom env name with no matching detect

Wrong:

```js
void envFavicon({ environments: { canary: { hue: 280 } } });
```

Correct:

```js
void envFavicon({
  environments: { canary: { hue: 280 } },
  detect: () => (location.hostname.startsWith('canary.') ? 'canary' : 'prod'),
});
```

`defaultDetect` only returns `dev`/`staging`/`prod`, so `environments.canary` is
never looked up and the favicon is left untouched — no error is thrown.

Source: src/detect.ts, src/tint.ts (resolveTint)

### HIGH — Calling it from a Server Component / during SSR

Wrong:

```jsx
// app/page.tsx — a Next.js App Router Server Component
import { envFavicon } from 'favicon-env';
envFavicon({ environments: { dev: { hue: 130 } } }); // runs on the server
```

Correct:

```jsx
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
        environments: { dev: { tint: '#22c55e' }, staging: { badge: '#f59e0b' } },
        detect: () => appEnv,
      });
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(apply);
    };
    const observer = new MutationObserver(() => {
      if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) schedule();
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

Runtime mode needs `document`; on the server it is a no-op and never tints the
client. Use `useEffect` in a client component (Next App Router), or call it at a
client-entry module (Vite/TanStack Router `src/main.ts`, TanStack Start's optional
`src/client.tsx`, an Astro `<script>`, SvelteKit/Solid `onMount`, Angular
`afterNextRender`, or a Nuxt `.client.ts` plugin). In TanStack Start, preserve the standard
`hydrateRoot(document, <StartClient />)` code. Install the same head observer shown
above before hydration because TanStack's head hydration can restore its route-managed
icon after an early `envFavicon` call; no React effect cleanup is needed for this
page-lifetime client entry.
Do not put the Next.js integration in `instrumentation-client.ts`: it runs before
hydration, so Next's metadata reconciliation can restore the original icon after
`envFavicon` replaces it. In the client component, observe `document.head` and
reapply only when an unmanaged icon appears; disconnect the observer in the Next effect
cleanup for React StrictMode. This also handles route-level metadata changes.

In SvelteKit put the observer in a persistent `+layout.svelte` and return cleanup
from `onMount`. In SolidStart register cleanup with `onCleanup` inside `onMount`.
In Angular register it with `DestroyRef.onDestroy` inside `afterNextRender`. In Nuxt
use a `.client.ts` plugin; a page-lifetime plugin observer does not require component
cleanup. Use public build constants (`NEXT_PUBLIC_*`, `PUBLIC_*`, `VITE_*`, or a Vite
`define`) rather than changing `NODE_ENV` to `staging`. Use Angular file replacement
and explicit Vite constants for SvelteKit/Nuxt when prod must emit no runtime chunk.

Source: src/tint.ts (`typeof document` guard), README "Runtime mode"

### MEDIUM — Using `hue` when you want an exact colour

Wrong:

```js
// trying to make dev green — but hue-rotate is relative to the base icon
void envFavicon({ environments: { dev: { hue: 130 } } });
```

Correct:

```js
void envFavicon({ environments: { dev: { tint: '#22c55e' } } });
```

`hue` _rotates_ the existing colours (the result depends on the base icon, and it
barely moves white/black/grey). `tint` colourises to an _exact_ colour while
preserving shape and shading. For a flat block, use a text-less `cover` badge. For a
quick high-contrast flip with no colour to choose, use `invert: true` (or a `0`–`1`
amount); it composes with `hue`, while `tint` and an explicit `filter` take precedence.

Source: src/types.ts (EnvTint.tint / EnvTint.invert), src/tint.ts (colorize path), src/filter.ts

### MEDIUM — Multi-digit badge as a corner pill

Wrong:

```js
void envFavicon({ environments: { preview: { badge: { text: '#344' } } } });
```

Correct:

```js
void envFavicon({
  environments: { preview: { badge: { text: '#344', shape: 'cover' } } },
});
```

The default `pill` badge sits in a corner at ~half the icon, so a 3–4 digit number
is illegible at 16px. `shape: 'cover'` fills the whole icon with the number.

Source: src/tint.ts (drawBadge), README "Badges"

### MEDIUM — Cross-origin favicon source without CORS

Wrong:

```js
void envFavicon({
  source: 'https://cdn.example.com/favicon.png', // served without CORS headers
  environments: { dev: { hue: 130 } },
});
```

Correct:

```js
// serve the favicon same-origin, or with Access-Control-Allow-Origin
void envFavicon({ source: '/favicon.png', environments: { dev: { hue: 130 } } });
```

Tinting draws to a canvas; a cross-origin image without CORS taints it, so
`envFavicon` catches the error and leaves the favicon untouched — silently.

Source: src/tint.ts (`img.crossOrigin`, tainted-canvas catch)

### MEDIUM — Expecting runtime mode to avoid the first-paint flash

Wrong:

```js
// runtime mode always shows the untinted icon until JS runs
import { envFavicon } from 'favicon-env';
void envFavicon({ environments: { dev: { hue: 130 } } });
```

Correct:

```js
// bake the tint into the initial HTML at build time — no flash
import { faviconDataUri } from 'favicon-env/ssr';
const href = faviconDataUri(faviconSvg, { hue: 130 });
```

`envFavicon` runs after first paint, so the original icon flashes briefly. When
that matters, render the SSR helper's output into the initial `<link rel="icon">`.

Source: README "First-paint flash", src/ssr.ts

### MEDIUM — Treating envFavicon as synchronous

Wrong:

```js
envFavicon({ environments: { dev: { hue: 130 } } });
const href = document.querySelector('link[rel~="icon"]').href; // old icon — not swapped yet
```

Correct:

```js
await envFavicon({ environments: { dev: { hue: 130 } } });
const href = document.querySelector('link[rel~="icon"]').href;
```

`envFavicon` returns a `Promise` and loads the base image asynchronously before
redrawing; the `<link>` is not replaced until it resolves.

Source: src/tint.ts (returns `Promise`, `img` load listener)

---
name: core
description: >
  favicon-env tints the browser favicon per environment (dev/staging/prod) so
  identical tabs are distinguishable. Load when calling envFavicon, choosing
  runtime (canvas) vs build-time (SSR) mode, adding hue/filter tints or
  badges/PR numbers, wiring it into Next.js/TanStack/Astro/Vite, or configuring
  detect, environments, rules, or auto mode.
metadata:
  type: core
  library: favicon-env
  library_version: '0.1.0'
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

Runtime — call once on the client, as early as possible:

```js
import { envFavicon } from 'favicon-env'

void envFavicon({
  environments: {
    dev: { hue: 130 },             // hue-rotate degrees
    staging: { badge: '#f59e0b' }, // a corner dot; keeps the logo intact
    // prod omitted → favicon left untouched
  },
})
```

The environment name defaults to a `location.hostname` heuristic (`defaultDetect`):
`localhost`/`*.local`/raw IPs → `dev`; a `staging`/`preview`/`qa`/`uat`/… segment →
`staging`; everything else → `prod`.

## Core Patterns

### Custom environments — any name, but supply a matching `detect`

```js
void envFavicon({
  environments: { canary: { hue: 280 }, demo: { badge: '#22c55e' } },
  detect: () => {
    if (location.hostname.startsWith('canary.')) return 'canary'
    if (location.hostname.endsWith('.demo.acme.com')) return 'demo'
    return 'prod' // not in the map → untouched
  },
})
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
})
```

`match` is a `RegExp` tested against `location.host` (includes `:port`) or a
`(url: URL) => boolean`. Rules are checked first, in order; first match wins, then
it falls through to `auto`/`environments`.

### Auto mode — one stable colour per host, zero config

```js
void envFavicon({ auto: true })
```

Derives a deterministic hue from `location.host`, so every origin and port gets its
own colour — handy for telling several dev servers apart.

### Build-time SSR — no first-paint flash

```js
import { faviconDataUri } from 'favicon-env/ssr'
import favicon from './favicon.svg?raw'

// during an Astro/Vite build; pick the tint for the current env
const href = faviconDataUri(favicon, { hue: 130 })
// → render into <link rel="icon" type="image/svg+xml" href={href}>
```

`favicon-env/ssr` is pure string manipulation (no DOM), safe in Node. It bakes a
CSS `filter` and/or badge into the SVG using its `viewBox`.

## Common Mistakes

### HIGH — Custom env name with no matching detect

Wrong:

```js
void envFavicon({ environments: { canary: { hue: 280 } } })
```

Correct:

```js
void envFavicon({
  environments: { canary: { hue: 280 } },
  detect: () => (location.hostname.startsWith('canary.') ? 'canary' : 'prod'),
})
```

`defaultDetect` only returns `dev`/`staging`/`prod`, so `environments.canary` is
never looked up and the favicon is left untouched — no error is thrown.

Source: src/detect.ts, src/tint.ts (resolveTint)

### HIGH — Calling it from a Server Component / during SSR

Wrong:

```jsx
// app/page.tsx — a Next.js App Router Server Component
import { envFavicon } from 'favicon-env'
envFavicon({ environments: { dev: { hue: 130 } } }) // runs on the server
```

Correct:

```jsx
'use client'
import { useEffect } from 'react'
import { envFavicon } from 'favicon-env'

export function FaviconEnv() {
  useEffect(() => {
    void envFavicon({ environments: { dev: { hue: 130 } } })
  }, [])
  return null
}
```

Runtime mode needs `document`; on the server it is a no-op and never tints the
client. Use `useEffect` in a client component (Next App Router), or call it at a
client-entry module (Vite/TanStack `src/main.ts`, or an Astro `<script>`).

Source: src/tint.ts (`typeof document` guard), README "Runtime mode"

### MEDIUM — Using `hue` when you want an exact colour

Wrong:

```js
// trying to make dev green — but hue-rotate is relative to the base icon
void envFavicon({ environments: { dev: { hue: 130 } } })
```

Correct:

```js
void envFavicon({ environments: { dev: { tint: '#22c55e' } } })
```

`hue` *rotates* the existing colours (the result depends on the base icon, and it
barely moves white/black/grey). `tint` colourises to an *exact* colour while
preserving shape and shading. For a flat block, use a text-less `cover` badge.

Source: src/types.ts (EnvTint.tint), src/tint.ts (colorize path)

### MEDIUM — Multi-digit badge as a corner pill

Wrong:

```js
void envFavicon({ environments: { preview: { badge: { text: '#344' } } } })
```

Correct:

```js
void envFavicon({
  environments: { preview: { badge: { text: '#344', shape: 'cover' } } },
})
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
})
```

Correct:

```js
// serve the favicon same-origin, or with Access-Control-Allow-Origin
void envFavicon({ source: '/favicon.png', environments: { dev: { hue: 130 } } })
```

Tinting draws to a canvas; a cross-origin image without CORS taints it, so
`envFavicon` catches the error and leaves the favicon untouched — silently.

Source: src/tint.ts (`img.crossOrigin`, tainted-canvas catch)

### MEDIUM — Expecting runtime mode to avoid the first-paint flash

Wrong:

```js
// runtime mode always shows the untinted icon until JS runs
import { envFavicon } from 'favicon-env'
void envFavicon({ environments: { dev: { hue: 130 } } })
```

Correct:

```js
// bake the tint into the initial HTML at build time — no flash
import { faviconDataUri } from 'favicon-env/ssr'
const href = faviconDataUri(faviconSvg, { hue: 130 })
```

`envFavicon` runs after first paint, so the original icon flashes briefly. When
that matters, render the SSR helper's output into the initial `<link rel="icon">`.

Source: README "First-paint flash", src/ssr.ts

### MEDIUM — Treating envFavicon as synchronous

Wrong:

```js
envFavicon({ environments: { dev: { hue: 130 } } })
const href = document.querySelector('link[rel~="icon"]').href // old icon — not swapped yet
```

Correct:

```js
await envFavicon({ environments: { dev: { hue: 130 } } })
const href = document.querySelector('link[rel~="icon"]').href
```

`envFavicon` returns a `Promise` and loads the base image asynchronously before
redrawing; the `<link>` is not replaced until it resolves.

Source: src/tint.ts (returns `Promise`, `img` load listener)

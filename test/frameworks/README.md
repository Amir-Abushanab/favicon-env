# Framework integration matrix

Playwright tests the workspace package in nine browser integrations:

| Framework           | Integration                                    |
| ------------------- | ---------------------------------------------- |
| Next.js             | client component and head observer             |
| TanStack Start      | client entry and head observer                 |
| Astro               | bundled client script                          |
| SvelteKit           | root layout, `onMount`, and head observer      |
| SolidStart          | root app, Solid lifecycle, and `@solidjs/meta` |
| Angular SSR         | `afterNextRender` and `DestroyRef`             |
| Nuxt                | client plugin, Vite build constant, and Unhead |
| Plain HTML (ESM)    | native module                                  |
| Plain HTML (global) | `favicon-env.global.js`                        |

Each runs as dev, staging, and prod. Staging uses a production build with public app configuration—not `NODE_ENV=staging`.

```sh
# All 27 cases in Chromium
pnpm test:frameworks

# Filter by browser, framework, or environment
pnpm test:frameworks -- --browser firefox
pnpm test:frameworks -- --browser webkit --framework nuxt --env staging
```

Filters:

- Framework: `next`, `tanstack-start`, `astro`, `sveltekit`, `solid-start`, `angular`, `nuxt`, `html-esm`, `html-global`
- Browser: `chromium`, `firefox`, `webkit`
- Environment: `dev`, `staging`, `prod`

For manual inspection:

```sh
pnpm dev:frameworks
```

| Framework           |  Dev | Staging | Prod |
| ------------------- | ---: | ------: | ---: |
| Next.js             | 4400 |    4401 | 4402 |
| TanStack Start      | 4410 |    4411 | 4412 |
| Astro               | 4420 |    4421 | 4422 |
| SvelteKit           | 4430 |    4431 | 4432 |
| SolidStart          | 4440 |    4441 | 4442 |
| Angular SSR         | 4450 |    4451 | 4452 |
| Nuxt                | 4460 |    4461 | 4462 |
| Plain HTML (ESM)    | 4470 |    4471 | 4472 |
| Plain HTML (global) | 4480 |    4481 | 4482 |

Open `http://localhost:<port>` and press `Ctrl+C` to stop all servers.

Every fixture uses its framework's real favicon. Across dev/staging, the matrix covers hue, inversion, exact tint, an explicit filter, auto mode, dot/pill/cover badges, custom sources, URL rules, custom canvas size, and the global build. Assertions require the expected managed SVG or PNG and the untouched original in prod. Prod builds are also scanned to ensure their client assets contain no `favicon-env` runtime; plain HTML must contain no runtime script. Deploy separately to test CSP, CORS, CDN headers, base paths, and platform adapters.

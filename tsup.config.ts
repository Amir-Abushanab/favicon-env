import { defineConfig } from 'tsup';

// Two outputs:
//   - ESM entries (`index`, `ssr`) → the package API consumed by bundlers.
//       index → runtime (canvas) mode, browser-only, DOM-guarded.
//       ssr   → build-time (SVG string) helpers, safe to run in Node.
//   - A minified IIFE (`favicon-env.global`) exposing `window.faviconEnv`, for
//     no-build sites that drop in a <script> tag (auto-runs from data-* attrs).
// tsup emits JS only; `.d.ts` come from `tsc -p tsconfig.build.json` (see the
// `build` script), since tsup's dts backend can't consume the TS 7 compiler API.
// `clean` runs only on the first config so the second doesn't wipe its siblings.
export default defineConfig([
  {
    entry: { index: 'src/index.ts', ssr: 'src/ssr.ts' },
    format: ['esm'],
    target: 'es2020',
    dts: false,
    treeshake: true,
    sourcemap: true,
    clean: true,
  },
  {
    // tsup appends `.global` for the IIFE format, so this entry emits
    // `favicon-env.global.js` (matching the `./global` export + unpkg field).
    entry: { 'favicon-env': 'src/global.ts' },
    format: ['iife'],
    globalName: 'faviconEnv',
    target: 'es2020',
    dts: false,
    minify: true,
    sourcemap: true,
    clean: false,
  },
]);

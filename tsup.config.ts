import { defineConfig } from 'tsup';

// ESM `index` (runtime/canvas, browser-only) + `ssr` (build-time SVG, Node-safe),
// plus a minified IIFE `favicon-env.global` (window.faviconEnv) for no-build <script>
// sites. tsup emits JS only; the `.d.ts` come from `tsc -p tsconfig.build.json` (its
// dts backend can't consume the TS 7 compiler API). `clean` is on the first config
// only, so the second doesn't wipe its siblings.
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

# favicon-env

## 0.3.3

### Patch Changes

- 777f31f: Fix `hue`, `invert`, `auto` and `tint` doing nothing (or the wrong thing) in WebKit/Safari. Two independent engine gaps were behind it: WebKit ships no `CanvasRenderingContext2D.filter`, so the runtime path's `ctx.filter = …` was a silent no-op and the icon was redrawn untinted; and WebKit ignores a CSS `filter` set on an _inner_ SVG element, so the build-time `tintSvg` output — a `<g>` carrying `filter:hue-rotate(…)` — rendered untinted too. `tint` was hit by the first gap as well: it starts with `grayscale(1)`, so WebKit multiplied the flood colour over the full-colour base and produced a visibly wrong duotone.

  Both paths now go through the same colour-matrix representation of the CSS filter. Runtime mode uses the native `ctx.filter` where it exists and otherwise replays the filter as a matrix pass over the drawn pixels; SSR mode emits a real SVG `<filter>` (one `feColorMatrix` per CSS filter function, matching how a browser chains and clamps them) instead of a CSS one. Output is identical across Chromium, Firefox and WebKit to within a rounding step, and `hue-rotate`, `invert`, `grayscale`, `sepia`, `saturate`, `brightness`, `contrast` and `opacity` are all covered — including inside an explicit `filter` string. `blur()` and `drop-shadow()` have no matrix form and still need Chromium or Firefox.

  New `pnpm test:pixels` suite asserts the colour that actually comes out, per engine, for both paths; it runs in CI across all three browsers. The existing framework suite only checked that _an_ icon had been swapped in, which is how an untinted-but-well-formed favicon passed on WebKit for so long.

## 0.3.2

### Patch Changes

- 9f8afc2: Document the non-JS backend path. Runtime mode never needed a bundler or a JavaScript framework — it reads the page's `<link rel="icon">` (falling back to `/favicon.ico`), redraws it on a canvas and swaps the `href` — so Rails, Django, Laravel, Phoenix, Go and Rust/Wasm apps can serve `dist/favicon-env.global.js` from their static assets and let the server template inject `detect`. The README gains a "Non-JS backends" integration block and a note that `favicon-env/ssr` is the one JavaScript-only entry point; the bundled Intent skill gains the matching pattern, plus the gotcha that the global build's `data-*` attributes only declare hues and still resolve the environment through `defaultDetect`. No runtime change.

## 0.3.1

### Patch Changes

- 0ab5f0a: Bump development dependencies (@changesets/cli 3, Playwright 1.62, oxlint 1.80, oxfmt 0.65, knip 6.32, @swc/core 1.16, dependency-cruiser 18.2, publint 0.3.24, @tanstack/intent 0.3.7). No runtime change.

  The published Intent skill's `library_version` now tracks `package.json` automatically: `pnpm run version` syncs it as part of the release, and CI fails on drift. The skill had silently stayed at `0.2.0` through the `0.3.0` release; it now reports the version it actually ships with.

## 0.3.0

### Minor Changes

- 7bad0f7: Add `invert` — flip the favicon's colours per environment for an instant, high-contrast variant with no colour to pick. `invert: true` inverts fully; a `0`–`1` number is a partial invert (maps to CSS `invert()`). It composes with `hue` (both apply), while `tint` and an explicit `filter` take precedence. Works in both runtime (canvas) and build-time SSR modes.

## 0.2.0

### Minor Changes

- 2f8e61a: Add `tint` — colourise the favicon to an exact colour per environment. `tint: '#hex'` recolours the icon to that exact colour while preserving its shape and shading (a luminance duotone), so a white logo becomes solid `tint`. It complements `hue` (a _relative_ rotation); precedence is `filter` > `tint` > `hue`. Works in both runtime (canvas) and build-time SSR modes.

### Patch Changes

- 76a88b3: Badge auto-contrast now understands CSS Color 4 colours. A `badge.color` in `oklch()` / `oklab()` / `lab()` / `lch()` now picks black or white text from its `L` (lightness) channel, instead of always falling back to white. Those colour spaces already passed through to the rendered favicon (`tint`, `badge.color`, `textColor` accept any CSS colour); this fixes the text-contrast heuristic for them.

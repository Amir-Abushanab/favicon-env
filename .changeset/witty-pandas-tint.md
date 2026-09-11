---
'favicon-env': patch
---

Fix `hue`, `invert`, `auto` and `tint` doing nothing (or the wrong thing) in WebKit/Safari. Two independent engine gaps were behind it: WebKit ships no `CanvasRenderingContext2D.filter`, so the runtime path's `ctx.filter = …` was a silent no-op and the icon was redrawn untinted; and WebKit ignores a CSS `filter` set on an *inner* SVG element, so the build-time `tintSvg` output — a `<g>` carrying `filter:hue-rotate(…)` — rendered untinted too. `tint` was hit by the first gap as well: it starts with `grayscale(1)`, so WebKit multiplied the flood colour over the full-colour base and produced a visibly wrong duotone.

Both paths now go through the same colour-matrix representation of the CSS filter. Runtime mode uses the native `ctx.filter` where it exists and otherwise replays the filter as a matrix pass over the drawn pixels; SSR mode emits a real SVG `<filter>` (one `feColorMatrix` per CSS filter function, matching how a browser chains and clamps them) instead of a CSS one. Output is identical across Chromium, Firefox and WebKit to within a rounding step, and `hue-rotate`, `invert`, `grayscale`, `sepia`, `saturate`, `brightness`, `contrast` and `opacity` are all covered — including inside an explicit `filter` string. `blur()` and `drop-shadow()` have no matrix form and still need Chromium or Firefox.

New `pnpm test:pixels` suite asserts the colour that actually comes out, per engine, for both paths; it runs in CI across all three browsers. The existing framework suite only checked that *an* icon had been swapped in, which is how an untinted-but-well-formed favicon passed on WebKit for so long.

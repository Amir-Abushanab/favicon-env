# favicon-env

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

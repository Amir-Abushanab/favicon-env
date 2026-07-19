---
'favicon-env': minor
---

Add `invert` — flip the favicon's colours per environment for an instant, high-contrast variant with no colour to pick. `invert: true` inverts fully; a `0`–`1` number is a partial invert (maps to CSS `invert()`). It composes with `hue` (both apply), while `tint` and an explicit `filter` take precedence. Works in both runtime (canvas) and build-time SSR modes.

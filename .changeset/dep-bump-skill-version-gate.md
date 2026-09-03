---
'favicon-env': patch
---

Bump development dependencies (@changesets/cli 3, Playwright 1.62, oxlint 1.80, oxfmt 0.65, knip 6.32, @swc/core 1.16, dependency-cruiser 18.2, publint 0.3.24, @tanstack/intent 0.3.7). No runtime change.

The published Intent skill's `library_version` now tracks `package.json` automatically: `pnpm run version` syncs it as part of the release, and CI fails on drift. The skill had silently stayed at `0.2.0` through the `0.3.0` release; it now reports the version it actually ships with.

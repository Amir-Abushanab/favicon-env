---
'favicon-env': patch
---

Document the non-JS backend path. Runtime mode never needed a bundler or a JavaScript framework — it reads the page's `<link rel="icon">` (falling back to `/favicon.ico`), redraws it on a canvas and swaps the `href` — so Rails, Django, Laravel, Phoenix, Go and Rust/Wasm apps can serve `dist/favicon-env.global.js` from their static assets and let the server template inject `detect`. The README gains a "Non-JS backends" integration block and a note that `favicon-env/ssr` is the one JavaScript-only entry point; the bundled Intent skill gains the matching pattern, plus the gotcha that the global build's `data-*` attributes only declare hues and still resolve the environment through `defaultDetect`. No runtime change.

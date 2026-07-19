// Regenerates docs/hero.png — the README's showcase strip of one base icon tinted
// per environment. Renders the tiles with the build-time SSR helper (so they match
// what the library actually produces) and screenshots them with Playwright.
//
//   pnpm hero   # (builds first, then runs this)
//
// The base/alt artwork is lifted straight from examples/index.html so the hero and
// the live demo can never drift apart.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { faviconDataUri } = await import(pathToFileURL(path.join(ROOT, 'dist/index.js')).href);

// Reuse the demo's exact artwork so the hero never drifts from the showcase.
const demo = readFileSync(path.join(ROOT, 'examples/index.html'), 'utf8');
const grab = (name) => {
  const m = new RegExp(`const ${name} =\\s*'([\\s\\S]*?)';`).exec(demo);
  if (!m) throw new Error(`could not extract "${name}" svg from examples/index.html`);
  return m[1];
};
const base = grab('base');
const alt = grab('alt');

// The tiles, left to right — grouped as recolour (hue/tint/invert), badge, image.
const tiles = [
  { label: 'prod', tint: false, svg: base },
  { label: 'dev · hue', tint: { hue: 130 }, svg: base },
  { label: 'dev · tint', tint: { tint: '#22c55e' }, svg: base },
  { label: 'dev · invert', tint: { invert: true }, svg: base },
  { label: 'staging · dot', tint: { badge: '#f59e0b' }, svg: base },
  { label: 'preview · #344', tint: { badge: { text: '#344', color: '#8b5cf6', shape: 'cover' } }, svg: base },
  { label: 'custom · image', tint: { badge: { text: 'S', color: '#0ea5e9' } }, svg: alt },
];

const cells = tiles
  .map((t) => {
    const uri = faviconDataUri(t.svg, t.tint);
    return `<div class="cell"><img src="${uri}" width="132" height="132" alt=""/><span>${t.label}</span></div>`;
  })
  .join('');

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { background: #0a0b14; }
  #strip {
    display: inline-flex; align-items: flex-start; gap: 40px;
    padding: 58px 64px 52px;
    background: radial-gradient(120% 140% at 50% -20%, #191d3a 0%, #0a0b14 60%);
    font: 600 15.5px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .cell { display: flex; flex-direction: column; align-items: center; gap: 20px; }
  .cell img { width: 132px; height: 132px; filter: drop-shadow(0 12px 26px rgba(0, 0, 0, 0.5)); }
  .cell span { color: #ced4f1; letter-spacing: 0.01em; white-space: nowrap; }
</style><div id="strip">${cells}</div>`;

const out = path.join(ROOT, 'docs/hero.png');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.locator('#strip').screenshot({ path: out });
} finally {
  await browser.close();
}

const buf = readFileSync(out);
console.log(`wrote docs/hero.png (${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)})`);

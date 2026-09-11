// Rendered-pixel tests: run the real library in a real engine and read the
// colour that actually comes out, for both the runtime (canvas) and build-time
// (SVG) paths.
//
// The framework suite only checks that a `data:image/png` icon got swapped in,
// which is why WebKit shipping no `CanvasRenderingContext2D.filter` went
// unnoticed for so long — it produced a perfectly well-formed, completely
// untinted icon. These assertions compare colours instead.
//
//   node test/pixels.mjs [--browser chromium|firefox|webkit]
import { chromium, firefox, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { after, before, describe, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { hashHue } from '../dist/index.js';
import { svgToDataUri, tintSvg } from '../dist/ssr.js';

const browserTypes = { chromium, firefox, webkit };
const flag = process.argv.indexOf('--browser');
const browserName = (flag === -1 ? undefined : process.argv[flag + 1]) ?? 'chromium';
const browserType = browserTypes[browserName];
if (!browserType) throw new Error(`Unknown --browser ${browserName}`);

// A flat fill, so every pixel is the same colour and sampling is unambiguous.
const BASE_RGB = [91, 141, 239];
const base =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">' +
  '<rect width="8" height="8" fill="#5b8def"/></svg>';
const baseUri = svgToDataUri(base);

// Expected results for #5b8def, from the Filter Effects spec's colour matrices —
// the same numbers Chromium and Firefox produce natively for the CSS string.
// `page.setContent` leaves `location.host` empty, so auto mode's hue is fixed.
const AUTO_HUE = hashHue('');
const CASES = [
  { name: 'hue', tint: { hue: 130 }, expected: [245, 108, 108] },
  { name: 'invert', tint: { invert: true }, expected: [164, 114, 16] },
  { name: 'partial invert', tint: { invert: 0.85 }, expected: [153, 118, 49] },
  { name: 'hue + invert', tint: { hue: 130, invert: true }, expected: [10, 147, 147] },
  { name: 'tint', tint: { tint: '#22c55e' }, expected: [18, 106, 51] },
  {
    name: 'explicit filter string',
    tint: { filter: 'saturate(2) hue-rotate(45deg)' },
    expected: [158, 109, 255],
  },
];

// Engines round filter maths slightly differently; 5/255 is well inside "same
// colour" and far outside "the filter did nothing".
const TOLERANCE = 5;

function assertColor(actual, expected, what) {
  assert.notEqual(actual, 'ERR', `${what}: the icon failed to load`);
  const got = actual.split(',').map(Number);
  const off = got.map((v, i) => Math.abs(v - expected[i]));
  assert.ok(
    Math.max(...off) <= TOLERANCE,
    `${what}: expected ~${expected.join(',')}, got ${actual}`,
  );
}

function assertTinted(actual, what) {
  const got = actual.split(',').map(Number);
  const off = got.map((v, i) => Math.abs(v - BASE_RGB[i]));
  assert.ok(Math.max(...off) > TOLERANCE, `${what}: icon is still the untinted base (${actual})`);
}

describe(`rendered pixels (${browserName})`, () => {
  let browser;
  let page;

  before(async () => {
    const lib = await readFile(new URL('../dist/favicon-env.global.js', import.meta.url), 'utf8');
    browser = await browserType.launch();
    page = await browser.newPage();
    await page.setContent(
      `<link rel="icon" type="image/svg+xml" href="${baseUri}">` +
        `<script>${lib.replace(/<\/script>/gi, '<\\/script>')}</script>`,
    );
    // Read the colour at the centre of any icon URL, via a canvas the test owns.
    await page.evaluate(() => {
      window.sample = (href) =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.addEventListener('error', () => resolve('ERR'));
          img.addEventListener('load', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 8, 8);
            const [r, g, b] = ctx.getImageData(4, 4, 1, 1).data;
            resolve(`${r},${g},${b}`);
          });
          img.src = href;
        });
    });
  });

  after(async () => {
    await browser?.close();
  });

  // Run envFavicon against a pristine base icon and sample what it swapped in.
  // `detect` is rebuilt inside the page — a function can't cross `evaluate`.
  const runtimeColor = (options, env) =>
    page.evaluate(async ([src, opts, envName]) => {
      document.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove());
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = src;
      document.head.append(link);
      const full = { ...opts, source: src, size: 8 };
      if (envName) full.detect = () => envName;
      await window.faviconEnv.envFavicon(full);
      return window.sample(document.querySelector('link[rel~="icon"]').href);
    }, [baseUri, options, env]);

  test('the untinted base reads as its own fill colour', async () => {
    assertColor(await page.evaluate((uri) => window.sample(uri), baseUri), BASE_RGB, 'base');
  });

  for (const { name, tint, expected } of CASES) {
    test(`runtime: ${name}`, async () => {
      const color = await runtimeColor({ environments: { dev: tint } }, 'dev');
      assertTinted(color, `runtime ${name}`);
      assertColor(color, expected, `runtime ${name}`);
    });

    test(`ssr: ${name}`, async () => {
      const uri = svgToDataUri(tintSvg(base, tint));
      const color = await page.evaluate((href) => window.sample(href), uri);
      assertTinted(color, `ssr ${name}`);
      assertColor(color, expected, `ssr ${name}`);
    });
  }

  test('runtime: auto mode tints from the host hash', async () => {
    const color = await runtimeColor({ auto: true });
    assertTinted(color, 'runtime auto');
    const uri = svgToDataUri(tintSvg(base, { hue: AUTO_HUE }));
    const viaSsr = await page.evaluate((href) => window.sample(href), uri);
    assertColor(color, viaSsr.split(',').map(Number), 'runtime auto vs the same hue via ssr');
  });

  test('a badge still lands on a filter no engine here can apply', async () => {
    // `blur()` has no colour-matrix form, so the fallback path skips it — but the
    // swap, and anything drawn on top, must still happen.
    const color = await runtimeColor(
      {
        environments: {
          dev: { filter: 'blur(0.5px)', badge: { shape: 'cover', color: '#ff0000' } },
        },
      },
      'dev',
    );
    assertColor(color, [255, 0, 0], 'cover badge over an unsupported filter');
  });
});

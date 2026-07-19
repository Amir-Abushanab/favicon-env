import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashHue,
  defaultDetect,
  matchRules,
  tintSvg,
  svgToDataUri,
  faviconDataUri,
} from '../dist/index.js';

test('hashHue is deterministic and in [0, 360)', () => {
  const a = hashHue('example.com');
  assert.equal(a, hashHue('example.com'));
  assert.ok(Number.isInteger(a) && a >= 0 && a < 360);
});

test('hashHue spreads distinct hosts across the wheel', () => {
  const hosts = ['a.com', 'b.com', 'c.com', 'd.com', 'localhost:3000', 'localhost:3001'];
  const hues = new Set(hosts.map((h) => hashHue(h)));
  assert.ok(hues.size >= 4, `expected variety, got ${[...hues].join(',')}`);
});

test('hashHue offset wraps at 360', () => {
  assert.equal(hashHue('x', 360), hashHue('x', 0));
});

test('defaultDetect classifies hosts', () => {
  assert.equal(defaultDetect('localhost'), 'dev');
  assert.equal(defaultDetect('127.0.0.1'), 'dev');
  assert.equal(defaultDetect('myapp.local'), 'dev');
  assert.equal(defaultDetect('192.168.1.5'), 'dev');
  assert.equal(defaultDetect('staging.myapp.com'), 'staging');
  assert.equal(defaultDetect('myapp-preview.vercel.app'), 'staging');
  assert.equal(defaultDetect('myapp.com'), 'prod');
  assert.equal(defaultDetect('www.myapp.com'), 'prod');
  assert.equal(defaultDetect('developer.io'), 'prod'); // "dev" must be a whole segment
});

// --- rules (URL → tint, with capture interpolation) ---

test('matchRules: regex captures feed a $1 badge template', () => {
  const rules = [{ match: /^pr-(\d+)\./, badge: { text: '#$1', color: '#8b5cf6' } }];
  const tint = matchRules(rules, new URL('https://pr-344.myapp.dev/some/path'));
  assert.deepEqual(tint, { badge: { color: '#8b5cf6', text: '#344' } });
});

test('matchRules: named capture groups via $<name>', () => {
  const rules = [{ match: /^pr-(?<n>\d+)\./, badge: { text: 'PR $<n>' } }];
  const tint = matchRules(rules, new URL('https://pr-7.app.dev/'));
  assert.equal(tint?.badge?.text, 'PR 7');
});

test('matchRules: a function match with a function badge text', () => {
  const rules = [
    {
      match: (url) => url.searchParams.has('pr'),
      badge: { text: (_m, url) => `#${url.searchParams.get('pr')}` },
    },
  ];
  const tint = matchRules(rules, new URL('https://app.dev/?pr=99'));
  assert.deepEqual(tint, { badge: { text: '#99' } });
});

test('matchRules: first match wins and the host includes the port', () => {
  const rules = [
    { match: /:3001$/, hue: 200 },
    { match: /localhost/, hue: 10 },
  ];
  assert.deepEqual(matchRules(rules, new URL('http://localhost:3001/')), { hue: 200 });
  assert.deepEqual(matchRules(rules, new URL('http://localhost:3000/')), { hue: 10 });
});

test('matchRules: a string badge is shorthand for a dot', () => {
  const tint = matchRules([{ match: /staging/, badge: '#f00' }], new URL('https://staging.app.dev/'));
  assert.deepEqual(tint, { badge: { color: '#f00' } });
});

test('matchRules: no rule matches → null', () => {
  assert.equal(matchRules([{ match: /nope/, hue: 1 }], new URL('https://app.dev/')), null);
});

// --- SVG helpers ---

test('tintSvg wraps content in a filtered group', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#00f"/></svg>';
  const out = tintSvg(svg, { hue: 120 });
  assert.match(out, /hue-rotate\(120deg\)/);
  assert.match(out, /class="__favenv"/);
  assert.ok(out.includes('<rect'), 'keeps original content');
  assert.ok(!out.includes('<!--'), 'injects no XML comment (— double-hyphen hazard)');
});

test('tintSvg honours an explicit filter over hue', () => {
  const svg = '<svg viewBox="0 0 1 1"></svg>';
  assert.match(tintSvg(svg, { hue: 10, filter: 'saturate(2)' }), /filter:saturate\(2\)/);
});

test('tintSvg is a no-op for empty/false tints and non-svg input', () => {
  const svg = '<svg viewBox="0 0 1 1"></svg>';
  assert.equal(tintSvg(svg, false), svg);
  assert.equal(tintSvg(svg, {}), svg);
  assert.equal(tintSvg('not an svg', { hue: 90 }), 'not an svg');
});

test('tintSvg colourises to an exact colour via a duotone SVG filter', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#00f"/></svg>';
  const out = tintSvg(svg, { tint: '#22c55e' });
  assert.match(out, /<filter[^>]*id="__favenv_c"[^>]*color-interpolation-filters="sRGB"/);
  assert.match(out, /type="saturate" values="0"/, 'desaturates first');
  assert.match(out, /flood-color="#22c55e"/);
  assert.match(out, /mode="multiply"/);
  assert.match(out, /operator="in"/, 're-masks the original alpha');
  assert.match(out, /<g filter="url\(#__favenv_c\)">/);
  assert.ok(out.includes('<rect'), 'keeps the original artwork');
  assert.ok(!out.includes('__favenv{filter'), 'no CSS filter group for a tint');
});

test('tint precedence: explicit filter beats tint beats hue', () => {
  const svg = '<svg viewBox="0 0 1 1"></svg>';
  const filterWins = tintSvg(svg, { tint: '#f00', filter: 'saturate(2)' });
  assert.match(filterWins, /filter:saturate\(2\)/);
  assert.ok(!filterWins.includes('__favenv_c'), 'filter overrides tint');
  const tintWins = tintSvg(svg, { tint: '#f00', hue: 90 });
  assert.match(tintWins, /__favenv_c/);
  assert.ok(!tintWins.includes('hue-rotate'), 'tint overrides hue');
});

test('tintSvg escapes the tint colour', () => {
  const out = tintSvg('<svg viewBox="0 0 1 1"></svg>', { tint: 'x"/><script>bad' });
  assert.ok(!out.includes('<script>'), 'no raw markup leaks via flood-color');
});

// --- invert ---

test('tintSvg inverts the icon via a CSS filter', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#00f"/></svg>';
  const out = tintSvg(svg, { invert: true });
  assert.match(out, /filter:invert\(1\)/);
  assert.match(out, /class="__favenv"/);
  assert.ok(out.includes('<rect'), 'keeps the original artwork');
});

test('invert accepts a 0–1 amount', () => {
  assert.match(tintSvg('<svg viewBox="0 0 1 1"></svg>', { invert: 0.85 }), /filter:invert\(0\.85\)/);
});

test('invert composes with hue in a single filter', () => {
  const out = tintSvg('<svg viewBox="0 0 1 1"></svg>', { hue: 130, invert: true });
  assert.match(out, /filter:hue-rotate\(130deg\) invert\(1\)/);
});

test('invert false / 0 is a no-op', () => {
  const svg = '<svg viewBox="0 0 1 1"></svg>';
  assert.equal(tintSvg(svg, { invert: false }), svg);
  assert.equal(tintSvg(svg, { invert: 0 }), svg);
});

test('invert precedence: explicit filter beats it, tint (duotone) beats it', () => {
  const svg = '<svg viewBox="0 0 1 1"></svg>';
  assert.match(tintSvg(svg, { invert: true, filter: 'saturate(2)' }), /filter:saturate\(2\)/);
  const tintWins = tintSvg(svg, { invert: true, tint: '#22c55e' });
  assert.match(tintWins, /__favenv_c/);
  assert.ok(!tintWins.includes('invert('), 'tint overrides invert');
});

test('invert composites with a badge', () => {
  const svg = '<svg viewBox="0 0 64 64"><rect width="64" height="64"/></svg>';
  const out = tintSvg(svg, { invert: true, badge: '#f00' });
  assert.match(out, /filter:invert\(1\)/);
  assert.match(out, /<rect[^>]*fill="#f00"/, 'draws the badge on top');
});

test('tint composites with a badge', () => {
  const svg = '<svg viewBox="0 0 64 64"><rect width="64" height="64"/></svg>';
  const out = tintSvg(svg, { tint: '#0ea5e9', badge: '#f00' });
  assert.match(out, /url\(#__favenv_c\)/, 'colourises the base');
  assert.match(out, /<rect[^>]*fill="#f00"/, 'and draws the badge on top');
});

test('svgToDataUri percent-encodes', () => {
  assert.equal(svgToDataUri('<svg/>'), 'data:image/svg+xml,%3Csvg%2F%3E');
});

test('faviconDataUri returns a decodable, tinted svg data uri', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#f00"/></svg>';
  const uri = faviconDataUri(svg, { hue: 200 });
  assert.ok(uri.startsWith('data:image/svg+xml,'));
  const decoded = decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
  assert.match(decoded, /hue-rotate\(200deg\)/);
});

// --- badges (number / dot overlay) ---

test('tintSvg renders a text badge outside the filter group', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64"/></svg>';
  const out = tintSvg(svg, { badge: { text: '#344', color: '#8b5cf6' } });
  assert.match(out, />#344</, 'renders the label text');
  assert.match(out, /<rect[^>]*fill="#8b5cf6"/, 'uses the badge colour');
  assert.ok(!out.includes('__favenv'), 'no filter group when only a badge');
});

test('tintSvg combines a filter and a badge', () => {
  const out = tintSvg('<svg viewBox="0 0 32 32"><rect/></svg>', { hue: 90, badge: { text: 1 } });
  assert.match(out, /hue-rotate\(90deg\)/);
  assert.match(out, /class="__favenv"/);
  assert.match(out, />1</);
});

test('tintSvg escapes badge text', () => {
  const out = tintSvg('<svg viewBox="0 0 10 10"></svg>', { badge: { text: 'a<b&c' } });
  assert.match(out, /a&lt;b&amp;c/);
  assert.ok(!out.includes('a<b&c'), 'no raw markup leaks in');
});

test('a string badge is a plain dot (no text)', () => {
  const out = tintSvg('<svg viewBox="0 0 10 10"></svg>', { badge: '#00ff00' });
  assert.match(out, /<rect[^>]*fill="#00ff00"/);
  assert.ok(!out.includes('<text'), 'no text element for a dot');
});

test('a badge is skipped when the svg has no viewBox or width/height', () => {
  const svg = '<svg><rect/></svg>';
  assert.equal(tintSvg(svg, { badge: { text: '1' } }), svg);
});

test('badge size scales the pill (default = half the icon)', () => {
  const dot = tintSvg('<svg viewBox="0 0 100 100"><rect/></svg>', { badge: '#f00' });
  assert.match(dot, /<rect[^>]*height="50"/, 'default 0.5 → 50');
  const big = tintSvg('<svg viewBox="0 0 100 100"><rect/></svg>', {
    badge: { text: '344', size: 1, corner: 'center' },
  });
  assert.match(big, /<rect[^>]*height="100"/, 'size 1 → full height');
  assert.match(big, /font-weight="700"/);
  assert.match(big, />344</);
});

test('badge shape "cover" replaces the icon with a full-bleed number tile', () => {
  const svg = '<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#00f"/></svg>';
  const out = tintSvg(svg, { badge: { text: '#344', color: '#8b5cf6', shape: 'cover' } });
  assert.ok(!out.includes('fill="#00f"'), 'drops the base content');
  assert.match(out, /<rect[^>]*width="64"[^>]*height="64"[^>]*fill="#8b5cf6"/);
  assert.match(out, />#344</);
  assert.match(out, /font-weight="700"/);
});

test('badge text auto-contrasts against the badge colour (like runtime)', () => {
  const svg = '<svg viewBox="0 0 64 64"><rect/></svg>';
  // light backgrounds → black text, dark → white; 3-digit hex is handled too
  assert.match(tintSvg(svg, { badge: { text: '1', color: '#facc15' } }), /<text[^>]*fill="#000"/);
  assert.match(tintSvg(svg, { badge: { text: '1', color: '#ff0' } }), /<text[^>]*fill="#000"/);
  assert.match(tintSvg(svg, { badge: { text: '1', color: '#1e293b' } }), /<text[^>]*fill="#fff"/);
  // `cover` too, and an explicit textColor still wins
  assert.match(
    tintSvg(svg, { badge: { text: '9', color: '#e2e8f0', shape: 'cover' } }),
    /<text[^>]*fill="#000"/,
  );
  assert.match(
    tintSvg(svg, { badge: { text: '9', color: '#e2e8f0', textColor: '#123456', shape: 'cover' } }),
    /<text[^>]*fill="#123456"/,
  );
});

test('badge text auto-contrasts against oklch / lab / lch colours (CSS Color 4)', () => {
  const svg = '<svg viewBox="0 0 64 64"><rect/></svg>';
  const text = (color) => tintSvg(svg, { badge: { text: '1', color } });
  // oklch/oklab L is 0–1
  assert.match(text('oklch(0.9 0.1 100)'), /<text[^>]*fill="#000"/, 'light oklch → black');
  assert.match(text('oklch(0.35 0.1 260)'), /<text[^>]*fill="#fff"/, 'dark oklch → white');
  assert.match(text('oklab(88% -0.1 0.1)'), /<text[^>]*fill="#000"/, 'percentage L too');
  // lab/lch L is 0–100
  assert.match(text('lab(85 20 40)'), /<text[^>]*fill="#000"/, 'light lab → black');
  assert.match(text('lch(30 50 150)'), /<text[^>]*fill="#fff"/, 'dark lch → white');
  // an unhandled space (display-p3) falls back to white without crashing
  assert.match(text('color(display-p3 0.2 0.3 0.4)'), /<text[^>]*fill="#fff"/);
});

test('badge opacity fades the group', () => {
  const out = tintSvg('<svg viewBox="0 0 64 64"><rect/></svg>', {
    badge: { text: '9', color: '#f00', opacity: 0.5 },
  });
  assert.match(out, /<g opacity="0.5">/);
});

test('a translucent cover keeps the base showing through', () => {
  const svg = '<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#00f"/></svg>';
  assert.ok(
    !tintSvg(svg, { badge: { text: '1', shape: 'cover' } }).includes('fill="#00f"'),
    'opaque cover drops the base',
  );
  const translucent = tintSvg(svg, { badge: { text: '1', shape: 'cover', opacity: 0.6 } });
  assert.ok(translucent.includes('fill="#00f"'), 'translucent cover keeps the base');
  assert.match(translucent, /<g opacity="0.6">/);
});

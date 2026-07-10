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

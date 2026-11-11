import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageOf, roomy } from '../src/page-warmup.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'https://nsp-center.ru/catalog/';

test('only same-site pages are warmed up, never site management, the API or files', () => {
  assert.equal(pageOf('/health/', base), '/health/');
  assert.equal(pageOf('/catalog/?PAGEN_1=2', base), '/catalog/?PAGEN_1=2');
  assert.equal(pageOf('/admin/', base), null);
  assert.equal(pageOf('/api/site', base), null);
  assert.equal(pageOf('/images/a.jpg', base), null);
  assert.equal(pageOf('https://nsp25.com/signup', base), null);
  assert.equal(pageOf(null, base), null, 'a link without an address');
});

test('a data saver or a slow connection warms only the tabs', () => {
  assert.equal(roomy({ connection: { saveData: true } }), false);
  assert.equal(roomy({ connection: { effectiveType: 'slow-2g' } }), false);
  assert.equal(roomy({ connection: { effectiveType: '4g' } }), true);
  assert.equal(roomy({}), true);
});

test('pages open from the service worker copy at once and refresh in the background; tabs are kept ahead', () => {
  const sw = read('scripts/sw-template.js');
  assert.match(sw, /if \(hit\) \{ event\.waitUntil\(fresh\); return hit; \}/);
  assert.match(sw, /event\.data\?\.type === 'warm'/);
  assert.match(sw, /\(admin\|api\)/, 'site management and the API are never kept');
  assert.match(sw, /old\.slice\(0, -1\)/, 'the previous version stays until the next update');
  const pwa = read('scripts/pwa.mjs');
  assert.match(pwa, /const pages = \['\/', '\/catalog\/', '\/consultation\/', '\/health\/', '\/profile\/', '\/cart\/'\];/);
  assert.match(pwa, /walk\('dist'\)/, 'every change of a page makes a new version');
});

test('no animated page transition: it slowed tab switches and washed the header in light green', () => {
  assert.doesNotMatch(read('src/app.css'), /@view-transition|view-transition-name/);
});

test('scrolling the catalog sections lights nothing up; a hover colour only for a real pointer', () => {
  const css = read('src/catalog-mobile-entry.css');
  assert.doesNotMatch(css, /\.catalog-entry-link:is\(:hover/);
  assert.match(css, /\(hover:hover\)\{\.catalog-entry-link:hover/);
});

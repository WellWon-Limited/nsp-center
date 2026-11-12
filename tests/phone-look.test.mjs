import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('src/app.css');

test('the status bar and the area above the page are white like the header; below the page dark like the tab bar', () => {
  assert.match(read('index.html'), /<meta name="theme-color" content="#ffffff"\/>/);
  assert.match(css, /\.site-header::before\{content:"";position:absolute;left:0;right:0;bottom:100%;height:100vh;background:var\(--color-white\)/);
  assert.match(css, /body\{background:linear-gradient\(to top,#fff calc\(var\(--phone-nav-height,52px\) \+ env\(safe-area-inset-bottom\)\),var\(--color-bg\) 0\)\}/);
});

test('the loading screen block stands exactly in the middle of the screen', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /\.nsp-launch-center\{[^}]*translateY\(-8px\)/);
  assert.match(html, /to\{opacity:1;transform:none\}/);
});

test('app icons are solid dark green to the edge, with no transparency', () => {
  for (const name of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
    const png = readFileSync(new URL(`../public/icons/${name}`, import.meta.url));
    assert.equal(png[25], 2, `${name}: colour type RGB (no alpha channel)`);
  }
});

test('an empty screen shows only its line at first; the footer starts below the screen', () => {
  assert.match(css, /body:has\(\.empty-screen\) \.site-main\{min-height:calc\(100lvh - /);
});

test('the FAQ does not repeat its heading', () => {
  const $ = cheerio.load(read('dist/company/faq/index.html'));
  assert.equal($('h1').text().trim(), 'Частые вопросы');
  assert.ok(!$('.information-group-title').toArray().some(h => /^частые вопросы$/i.test($(h).text().trim())));
});

test('with the keyboard open the chat fits the space above it and the header stays', () => {
  const chat = read('src/assistant.css');
  // The keyboard rule outranks the site's page rules (#root min-height:100svh, position:relative), which used to keep the
  // input row under the keyboard.
  assert.match(chat, /html\.chat-kb-open\[data-catalog-design\] body:has\(\.chat\):has\(\.site-header\) > #root,\n  html\.chat-kb-open body:has\(\.chat\) #root \{ position: fixed; left: 0; right: 0; top: var\(--chat-top, 0px\); height: var\(--chat-vh, 100svh\); min-height: 0; \}/);
  const code = read('src/assistant.tsx');
  assert.match(code, /requestAnimationFrame\(apply\)/, 'updated once per frame');
  assert.doesNotMatch(code, /window\.scrollTo\(0, 0\)/, 'the page is not yanked to the top on every keyboard step');
  assert.match(code, /document\.addEventListener\('focusin', onFocusIn\)/);
  // The header stays still: room for the keyboard is made at the touch on the field (no iOS slide), nothing follows the
  // keyboard frame by frame.
  assert.match(code, /document\.addEventListener\('touchstart', prepare, \{ passive: true, capture: true \}\)/);
  assert.match(code, /set\(window\.innerHeight - guess\(\), 0\)/);
  assert.doesNotMatch(code, /const track = /);
  assert.match(code, /className="chat-send"[^>]*onPointerDown=\{e => e\.preventDefault\(\)\}/, 'sending keeps the keyboard open, as in messengers');
});

test('every inline script of the page head is valid JavaScript (a broken one silently drops the first-paint data)', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 4);
  for (const code of scripts) assert.doesNotThrow(() => new Function(code), code.slice(0, 80));
});

test('no clip on the page: a screen-wide dimming (the install offer) covers the screen to its very top edge', () => {
  assert.doesNotMatch(css, /body\{clip-path:/);
  assert.match(css, /background-attachment:fixed\}\n body::before\{display:none\}/);
});

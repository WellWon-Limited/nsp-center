import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('src/app.css');

test('the browser theme and the upper overscroll strip continue the shared header surface', () => {
  assert.match(read('index.html'), /<meta name="theme-color" content="#eaf5f1"\/>/);
  assert.match(css, /\.site-header::before\{content:"";position:absolute;left:0;right:0;bottom:100%;height:100vh;background:var\(--header-edge-surface,var\(--color-bg\)\)/);
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
  assert.match(code, /document\.addEventListener\('focusin',\s*onFocusIn\)/);
  // Use actual viewport measurements rather than an old keyboard estimate.
  assert.doesNotMatch(code, /addEventListener\('touchstart'/);
  assert.doesNotMatch(code, /const guess|keyboard-height/, 'a stale keyboard estimate cannot leave an empty band');
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

test('the home heading rises once per visit, and the page on screen is not reloaded for a new version', () => {
  const html = read('index.html');
  assert.match(html, /if\(sx\.getItem\("nsp-center:hero-played"\)&&!\(nx&&nx\.type==="reload"\)\)dx\.classList\.add\("nsp-hero-played"\)/);
  assert.match(read('src/hero-heading.css'), /html\.nsp-hero-played \.hero-heading--enter \.hero-title-word\{animation:none\}/);
  assert.match(read('src/hero-heading.tsx'), /sessionStorage\.setItem\('nsp-center:hero-played', '1'\)/);
  assert.doesNotMatch(read('src/pwa.tsx'), /location\.reload\(\)/);
});



test('the consultation page is the chat alone, wide and centred; its contact card lives in the home pickup block', () => {
  assert.doesNotMatch(read('src/App.tsx'), /consult-contact/);
  const css = read('src/consultation.css');
  assert.match(css, /\.consult-page\{width:min\(100% - 56px,1040px\)\}\n \.consult-layout\{grid-template-columns:minmax\(0,1fr\)\}\n \.consult-layout>\.chat\{max-width:none\}/);
  assert.match(read('src/home-story.tsx'), /<ContactCard className="story-pickup-card" address=\{false\} heading="h3"\/>/);
  assert.match(read('src/home-story.css'), /grid-template-areas:"address card" "info card"/);
  assert.match(read('src/contact-card.css'), /#root \.contact-card a\.contact-card-phone\{font-size:28px;font-weight:800;color:#2f6f5a/);
});

test('the plan time is optional: added from a product without a time, listed last, no reminder', async () => {
  // The product page's «+ Добавить в план приёма» (src/product-overview.tsx).
  assert.match(read('src/product-overview.tsx'), /\[\.\.\.s\.intake,\{id:p\.id,time:'',done:false\}\]/);
  assert.match(read('src/personal.tsx'), /time:newTime,done:false\}/);
  assert.match(read('src/pwa.tsx'), /if \(!it\.time\) return false;/);
  const { restorePlans } = await import('../src/intake-plan.ts').catch(() => ({}));
  if (restorePlans) assert.deepEqual(restorePlans({ '2026-11-13': [{ id: 'a', time: '', done: false }, { id: 'b', time: '25:00', done: false }] }, new Set(['a', 'b'])), { '2026-11-13': [{ id: 'a', time: '', done: false }] });
  else assert.match(read('src/intake-plan.ts'), /x\.time===''\|\|/);
});

test('the desktop hero fits its three category tiles and extends the unchanged photo with woodland', () => {
 const css=read('src/home-desktop.css');
 assert.match(css,/--hero-h:max\(260px,min\(var\(--hero-natural\),var\(--hero-fit\)\)\);/);
 assert.match(css,/woodland-side-extension-haze-v2\.png/);
 assert.doesNotMatch(css,/filter:blur\(32px\)/);
 assert.doesNotMatch(read('src/home-hero-framing.tsx'),/ResizeObserver|setProperty|useLayoutEffect/);
 assert.match(css,/height:var\(--home-tile-h\)!important/);
});

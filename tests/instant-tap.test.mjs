import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTap, installInstantTap, INSTANT_TARGETS } from '../src/instant-tap.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('a tap is a short touch that barely moves; a swipe or a long press is not', () => {
  assert.equal(isTap(3, -4, 120), true);
  assert.equal(isTap(0, 30, 120), false, 'scrolling');
  assert.equal(isTap(25, 0, 120), false, 'sideways swipe');
  assert.equal(isTap(0, 0, 900), false, 'long press');
});

test('only the fixed bars get first-tap clicks; the scrolling menu sheet keeps normal taps', () => {
  assert.match(INSTANT_TARGETS, /\.bottom-nav a\[href\]/);
  assert.match(INSTANT_TARGETS, /\.site-header button:not\(\.mobile-menu button\)/);
  assert.match(INSTANT_TARGETS, /\.site-header a\[href\]:not\(\.mobile-menu a\)/);
});

test('a still tap on a tab clicks it once and lights it up at once', () => {
  const listeners = {};
  const classes = new Set();
  let clicks = 0;
  let prevented = false;
  const link = { isConnected: true, disabled: false, classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
    closest: sel => (sel === INSTANT_TARGETS || sel === '.bottom-nav' ? link : null), contains: el => el === link, click: () => { clicks++; } };
  const doc = { addEventListener: (type, fn) => { listeners[type] = fn; }, querySelectorAll: () => [], elementFromPoint: () => link };
  installInstantTap({ addEventListener() {} }, doc);
  listeners.touchstart({ touches: [{ clientX: 10, clientY: 800 }], target: { closest: () => link }, timeStamp: 0 });
  listeners.touchend({ touches: [], changedTouches: [{ clientX: 12, clientY: 801 }], timeStamp: 90, preventDefault: () => { prevented = true; } });
  assert.equal(clicks, 1);
  assert.equal(prevented, true, 'the browser does not click a second time');
  assert.equal(classes.has('is-going'), true);
  listeners.touchstart({ touches: [{ clientX: 10, clientY: 800 }], target: { closest: () => link }, timeStamp: 1000 });
  listeners.touchmove({ touches: [{ clientX: 10, clientY: 760 }] });
  listeners.touchend({ touches: [], changedTouches: [{ clientX: 10, clientY: 760 }], timeStamp: 1100, preventDefault() {} });
  assert.equal(clicks, 1, 'a drag is left to the browser');
});

test('a menu tap before the page is alive is remembered and replayed', () => {
  assert.match(read('index.html'), /closest\("\.menu-toggle"\)\)window\.__nspMenuTap=1/);
  assert.match(read('src/boot.tsx'), /__nspMenuTap[\s\S]*\.menu-toggle\[aria-expanded="false"\][\s\S]*click\(\)/);
});

test('the whole product card opens the product, with the heart and buttons on top', () => {
  const css = read('src/app.css');
  assert.match(css, /\.product-card \.card-title h3 a::after\{content:"";position:absolute;inset:0;z-index:1\}/);
  assert.match(css, /\.product-card \.favorite\{z-index:2\}/);
  assert.match(css, /\.product-card \.product-meta>\.btn\{position:relative;z-index:2\}/);
});

test('the home heading waits under the loading screen and rises once it is gone', () => {
  const css = read('src/hero-heading.css');
  assert.match(css, /html\.nsp-splash \.hero-heading--enter \.hero-title-word\{animation-play-state:paused\}/);
  assert.doesNotMatch(css, /nsp-splash-out/);
});

test('the loading screen: no progress line, no blur layers, its own colour reaches the top edge', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /nsp-launch-progress/);
  assert.doesNotMatch(html, /\.nsp-launch::(?:before|after)/);
  // The status bar takes the screen's background-color; the gradient starts with the same colour at the top.
  assert.match(html, /background-color:#d3ebe1;background-image:[^;]*linear-gradient\(180deg,#d3ebe1 0/);
});

test('switching tabs on the white phone bar: the tapped icon turns dark, the one being left turns quiet, none vanish', () => {
  const css = read('src/home-phone-variants.css');
  assert.match(css, /html\[data-home-design="d"\] body \.bottom-nav a\.is-going,html\[data-home-design="d"\] body \.bottom-nav a\.is-going>span\{color:var\(--color-ink\)\}/);
  assert.match(css, /html\[data-home-design="d"\] body \.bottom-nav:has\(a\.is-going\) a\[aria-current="page"\]:not\(\.is-going\)>span\{color:rgb\(29 58 54 \/ \.58\)\}/);
});

test('a tab opens painted at once: the page is drawn before the app script runs, with one stylesheet in the head', () => {
  const main = read('src/main.tsx');
  assert.match(main, /requestAnimationFrame\(\(\)=>setTimeout\(\(\)=>\{ void import\('\.\/boot'\); \},0\)\);/);
  assert.match(main, /installAppHistory\(window,document,standaloneIos\(window\)\);/, 'taps keep working before the app starts');
  assert.match(main, /import '\.\/presentation-styles';/);
  assert.match(read('src/presentation-styles.ts'), /import '\.\/app\.css';/);
  assert.match(read('vite.config.ts'), /cssCodeSplit:false/, 'no styles arrive with the app script');
  assert.match(read('scripts/prerender.mjs'), /rel="modulepreload" crossorigin href="\/assets\/\$\{bootChunk\}"/);
  assert.match(read('src/pwa.tsx'), /if \(document\.readyState === 'complete'\) register\(\); else addEventListener\('load', register, \{ once: true \}\);/);
});

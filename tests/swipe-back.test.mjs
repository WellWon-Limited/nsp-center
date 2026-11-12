import test from 'node:test';
import assert from 'node:assert/strict';
import { isBackSwipe, standaloneIos } from '../src/swipe-back.mjs';

test('a back swipe starts at the left edge and goes right: a third of the screen, or a short quick flick', () => {
  const W = 390;
  assert.equal(isBackSwipe(8, 140, 10, W, 0.05), true, 'slow but long enough: a slow deliberate swipe counts too');
  assert.equal(isBackSwipe(8, 60, 5, W, 0.6), true, 'short quick flick');
  assert.equal(isBackSwipe(8, 60, 5, W, 0.1), false, 'short and slow: let go, it springs back');
  assert.equal(isBackSwipe(40, 200, 10, W, 0.5), false, 'not from the edge');
  assert.equal(isBackSwipe(8, 30, 0, W, 1), false, 'too short even if quick');
  assert.equal(isBackSwipe(8, 200, 150, W, 0.5), false, 'mostly up or down: that is scrolling');
  assert.equal(isBackSwipe(8, 200, 10, W, -0.3), false, 'the finger went back left before letting go: cancelled');
});

test('the direction is decided after the first 10 px', async () => {
  const { swipeDirection } = await import('../src/swipe-back.mjs');
  assert.equal(swipeDirection(4, 3), null);
  assert.equal(swipeDirection(14, 4), true);
  assert.equal(swipeDirection(6, 12), false, 'scrolling stays scrolling');
  assert.equal(swipeDirection(-12, 0), false);
});

test('fields, carousels that can scroll back, and open menus or dialogs keep their touches', async () => {
  const { ownsTouch } = await import('../src/swipe-back.mjs');
  const win = { getComputedStyle: el => ({ overflowX: el.overflowX ?? 'visible' }) };
  const body = { nodeType: 1 };
  const el = (props, parent = body) => ({ nodeType: 1, parentElement: parent, scrollLeft: 0, scrollWidth: 100, clientWidth: 100, matches: () => false, ...props });
  const doc = (overlays = []) => ({ body, querySelectorAll: () => overlays });
  const field = el({ matches: sel => /input/.test(sel) });
  assert.equal(ownsTouch(field, doc(), win), true, 'a text field');
  const carousel = el({ overflowX: 'auto', scrollWidth: 900, clientWidth: 390, scrollLeft: 120 });
  assert.equal(ownsTouch(el({}, carousel), doc(), win), true, 'inside a carousel scrolled away from its start');
  const atStart = el({ overflowX: 'auto', scrollWidth: 900, clientWidth: 390, scrollLeft: 0 });
  assert.equal(ownsTouch(el({}, atStart), doc(), win), false, 'a carousel at its start cannot scroll further back');
  const menu = { getBoundingClientRect: () => ({ width: 300, height: 400 }) };
  assert.equal(ownsTouch(el({}), doc([menu]), win), true, 'an open menu or dialog');
});

test('only the iPhone home-screen app gets the gesture (browsers and Android have their own)', () => {
  const win = (standalone, ua, mq = false) => ({ navigator: { standalone, userAgent: ua }, matchMedia: () => ({ matches: mq }) });
  assert.equal(standaloneIos(win(true, 'iPhone')), true);
  assert.equal(standaloneIos(win(undefined, 'Mozilla/5.0 (iPhone)', true)), true);
  assert.equal(standaloneIos(win(false, 'Mozilla/5.0 (iPhone)')), false, 'Safari tab');
  assert.equal(standaloneIos(win(undefined, 'Mozilla/5.0 (Linux; Android 14)', true)), false, 'Android');
});

test('the swipe works only on a screen with a back button, and does what that button does', async () => {
  const { backButton, BACK_BUTTONS } = await import('../src/swipe-back.mjs');
  const shown = { getBoundingClientRect: () => ({ width: 80, height: 32 }) };
  const hidden = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };
  assert.equal(backButton({ querySelectorAll: sel => (sel === '.back-action' ? [] : [hidden, shown]) }), shown);
  const step = { getBoundingClientRect: () => ({ width: 60, height: 30 }) };
  assert.equal(backButton({ querySelectorAll: sel => (sel === '.back-action' ? [step] : [shown]) }), step, 'the test\'s «Назад» goes to the previous question first');
  assert.equal(backButton({ querySelectorAll: () => [] }), null, 'home and tabs without a back button: no swipe');
  assert.equal(backButton({ querySelectorAll: () => [hidden] }), null);
  assert.match(BACK_BUTTONS, /\.back-link/);
  assert.match(BACK_BUTTONS, /\.catalog-mobile-back/);
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../src/swipe-back.mjs', import.meta.url), 'utf8');
  assert.match(code, /if \(button\) button\.click\(\);/);
  assert.doesNotMatch(code, /history\.back\(\)/);
});

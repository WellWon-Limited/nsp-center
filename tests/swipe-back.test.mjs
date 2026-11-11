import test from 'node:test';
import assert from 'node:assert/strict';
import { isBackSwipe, standaloneIos } from '../src/swipe-back.mjs';

test('a back swipe starts at the left edge and goes right, mostly sideways and quickly', () => {
  assert.equal(isBackSwipe(8, 120, 10, 250), true);
  assert.equal(isBackSwipe(40, 120, 10, 250), false, 'not from the edge');
  assert.equal(isBackSwipe(8, 40, 0, 250), false, 'too short');
  assert.equal(isBackSwipe(8, 120, 110, 250), false, 'mostly up or down: that is scrolling');
  assert.equal(isBackSwipe(8, 120, 10, 1500), false, 'too slow');
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

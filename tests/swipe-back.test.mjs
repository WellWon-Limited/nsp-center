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

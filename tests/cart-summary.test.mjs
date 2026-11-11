import test from 'node:test';
import assert from 'node:assert/strict';
import { cartSummary } from '../src/cart-summary.mjs';

const product = (id, retail, partner, availability = 'InStock') => ({ id, prices: { retail, partner }, availability });
const a = product('a', 1560, 1170), b = product('b', 1000, null), gone = product('gone', 900, 700, 'OutOfStock');

test('the order counts ticked products in stock, with quantities', () => {
  const s = cartSummary([a, b, gone], { a: 2, b: 1, gone: 3 }, [], false);
  assert.equal(s.count, 3);
  assert.equal(s.retail, 2 * 1560 + 1000);
  assert.equal(s.total, s.retail);
  assert.equal(s.saving, 2 * (1560 - 1170), 'a product without a card price saves nothing');
  assert.deepEqual(cartSummary([a, b], { a: 2, b: 1 }, ['a'], false).count, 1, 'an unticked product is left out');
});

test('with the discount card the total is the card price and the saving is shown', () => {
  const s = cartSummary([a, b], { a: 2, b: 1 }, [], true);
  assert.equal(s.total, 2 * 1170 + 1000);
  assert.equal(s.retail - s.total, s.saving);
});

test('courier within the ring road: 350 ₽, free from 12 000 ₽ of what is paid', () => {
  assert.deepEqual([cartSummary([a], { a: 1 }, [], false).courier, cartSummary([a], { a: 1 }, [], false).freeCourierLeft], [350, 12000 - 1560]);
  const big = cartSummary([a], { a: 8 }, [], false);
  assert.deepEqual([big.courier, big.freeCourierLeft], [0, 0]);
  assert.equal(cartSummary([a], { a: 8 }, [], true).courier, 350, 'the threshold counts the card price actually paid');
});

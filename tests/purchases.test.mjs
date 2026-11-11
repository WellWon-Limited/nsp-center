import test from 'node:test';
import assert from 'node:assert/strict';
import { orderDate, purchased, purchasedIds } from '../src/purchased-ids.mjs';

test('"Мои покупки" lists each ordered product once, latest orders first, only products still on the site', () => {
  const orders = [{ date: '01.10.2026', products: { a: 1, c: 3, gone: 1 } }, { date: '10.11.2026', products: { b: 1, a: 2 } }, { id: 'old draft without products', date: '12.11.2026' }];
  assert.deepEqual(purchasedIds(orders, new Set(['a', 'b', 'c'])), ['b', 'a', 'c']);
  assert.deepEqual(purchased(orders, new Set(['a', 'b', 'c'])).find(p => p.id === 'a'), { id: 'a', date: '10.11.2026', times: 2 }, 'the latest order date and how many orders had it');
  assert.deepEqual(purchasedIds([], new Set(['a'])), []);
  assert.equal(orderDate('10.11.2026'), '10 ноября 2026');
});

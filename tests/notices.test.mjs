import test from 'node:test';
import assert from 'node:assert/strict';
import { addNotice, badge, byDay, dayLabel, namesLine, newCount, shortTime } from '../src/notices.mjs';

const now = new Date(2026, 10, 10, 15, 0).getTime();
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).toISOString();

test('one notice per thing: the same id replaces the old one and comes back as new; old ones are dropped', () => {
  let list = addNotice([], { id: 'reviews-pending', title: 'Новый отзыв на проверку', text: 'Ждут проверки: 1', at: at(10, 9), read: true }, now);
  list = addNotice([...list, { id: 'old', title: 'x', at: new Date(2026, 8, 1).toISOString(), read: true }], { id: 'reviews-pending', title: 'Новый отзыв на проверку', text: 'Ждут проверки: 4', at: at(10, 14) }, now);
  assert.deepEqual(list.map(n => [n.id, n.text, n.read]), [['reviews-pending', 'Ждут проверки: 4', false]], 'replaced, unread, and the 70-day-old one is gone');
  const many = Array.from({ length: 60 }, (_, i) => ({ id: String(i), title: 't', at: at(10, 12) }));
  assert.equal(many.reduce((l, n) => addNotice(l, n, now), []).length, 50);
});

test('the list is grouped by day with a short time', () => {
  const list = [{ id: 'a', at: at(10, 14, 50) }, { id: 'b', at: at(9, 8) }, { id: 'c', at: at(3, 10) }, { id: 'd', at: at(10, 8) }, { id: 'e' }];
  assert.deepEqual(byDay(list, now).map(g => [g.label, g.items.map(n => n.id)]), [['Сегодня', ['a', 'd']], ['Вчера', ['b']], ['3 ноября', ['c']], ['Ранее', ['e']]]);
  assert.equal(shortTime(new Date(2026, 10, 10, 14, 59, 40).toISOString(), now), 'только что');
  assert.equal(shortTime(at(10, 14, 50), now), '10 мин назад');
  assert.match(shortTime(at(10, 8), now), /^в 08:00$/);
  assert.equal(dayLabel(new Date(2025, 11, 31).toISOString(), now), '31 декабря 2025');
});

test('bell number, heading count and names of one intake time', () => {
  assert.deepEqual([badge(3), badge(9), badge(12)], ['3', '9', '9+']);
  assert.deepEqual([newCount(1), newCount(3), newCount(11), newCount(21)], ['1 новое', '3 новых', '11 новых', '21 новое']);
  assert.equal(namesLine(['Коэнзим Q10', 'Хлорофилл', 'Омега-3']), 'Коэнзим Q10, Хлорофилл, +1');
});

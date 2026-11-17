import test from 'node:test';
import assert from 'node:assert/strict';
import { cardFacts, compositionParts, releaseForm, supportLine } from '../scripts/card-facts.mjs';
import { applySite, reviewSummary } from '../packages/presentation/site.ts';
import { readContent } from '../scripts/check-content.mjs';

test('card lines: what it supports comes from body systems, never from the disease list', () => {
  assert.equal(supportLine('Иммунная, Пищеварительная, Обмен веществ'), 'Поддержка иммунной\nи пищеварительной систем');
  assert.equal(supportLine('Сердечно-сосудистая'), 'Поддержка\nсердечно-сосудистой системы');
  assert.equal(supportLine('Кожа, волосы, ногти'), 'Поддержка\nкожи, волос и ногтей');
  assert.equal(releaseForm('Взрослым по 2 капсулы 2 раза в день'), 'Капсулы');
  assert.equal(releaseForm('Детям по 1 жевательной таблетке'), 'Жевательные таблетки');
  assert.deepEqual(compositionParts('Корни володушки китайской (Bupleurum chinese) - 77,6 мг; корни пиона (Paeonia) - 58,2 мг'), ['Корни володушки китайской', 'корни пиона']);
  const content = readContent();
  const byId = new Map(content.products.map((p) => [p.id, p]));
  for (const p of content.products) {
    const card = cardFacts(p, byId);
    assert.ok(card.kicker, `${p.id}: card has no kicker`);
    for (const word of (p.properties['Назначение'] ?? '').split(',').map((s) => s.trim()).filter((s) => /гастрит|колит|астма|бронхит|панкреатит|атеросклероз/i.test(s))) assert.ok(!card.sub.includes(word), `${p.id}: disease «${word}» on the card`);
  }
});

test('stars come only from published customer reviews: their mean to one decimal and their count', () => {
  const p = { id: 'a', name: 'A', rating: 3.44, review_count: 25, availability: 'InStock', availability_text: '', prices: { retail: 100, partner: null, source: 'snapshot' } };
  applySite([p], { rate: null, products: {}, hiddenNotes: {}, ratings: {} }, 94);
  assert.equal(p.stars, undefined, 'the old site numbers are not shown');
  applySite([p], { rate: null, products: {}, hiddenNotes: {}, ratings: { a: { sum: 9, count: 2 } } }, 94);
  assert.deepEqual(p.stars, { value: 4.5, count: 2, sum: 9 });
  applySite([p], { rate: null, products: {}, hiddenNotes: {}, ratings: { a: { sum: 12, count: 3 } } }, 94);
  assert.deepEqual(p.stars, { value: 4, count: 3, sum: 12 }, 'a new 3-star review lowers the mean');
});

test('expert comments count as reviews with five stars unless set otherwise; the mean joins customers\' stars', () => {
  const p = { id: 'a', stars: { value: 4.5, count: 2, sum: 9 } };
  assert.deepEqual(reviewSummary(p, 3, null), { count: 5, stars: 4.8 });
  assert.deepEqual(reviewSummary(p, 3, { hiddenNotes: {}, noteStars: { a: { k: 2 } } }), { count: 5, stars: 4.2 }, 'an expert comment set to 2 stars lowers the mean');
  assert.deepEqual(reviewSummary({ id: 'b' }, 3, { hiddenNotes: { b: ['x'] } }), { count: 2, stars: 5 }, 'hidden comments are not counted');
  assert.deepEqual(reviewSummary({ id: 'c' }, 0, null), { count: 0, stars: null });
});

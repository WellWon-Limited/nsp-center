import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { customProduct, freeId, mergeCustom, sectionsOf, slugOf, validateNewProduct } from '../src/custom-product.mjs';

const content = JSON.parse(readFileSync(new URL('../packages/catalog/generated/content.json', import.meta.url), 'utf8'));
const categories = () => structuredClone(content.categories);
const face = '/catalog/ukhod-za-kozhey-litsa-i-shei/';

test('a new card gets a readable free address from its name', () => {
  assert.equal(slugOf('Крем для рук (Hand Cream)'), 'krem-dlya-ruk-hand-cream');
  assert.equal(slugOf('Щётка №1'), 'shchetka-1');
  assert.equal(freeId('Крем для рук', new Set(['krem-dlya-ruk', 'krem-dlya-ruk-2'])), 'krem-dlya-ruk-3');
  assert.equal(slugOf('!!!'), 'tovar');
});

test('the creation form is checked and explained in words', () => {
  const ok = { name: 'Крем для рук', article: '21699', categoryPath: face, retailRub: '1 990', partnerRub: '1490', availability: 'InStock' };
  assert.deepEqual(validateNewProduct(ok, categories()).value, { name: 'Крем для рук', article: '21699', categoryPath: face, retailRub: 1990, partnerRub: 1490, availability: 'InStock' });
  assert.match(validateNewProduct({ ...ok, name: 'К' }, categories()).error, /Название/);
  assert.match(validateNewProduct({ ...ok, categoryPath: '/catalog/' }, categories()).error, /раздел/);
  assert.match(validateNewProduct({ ...ok, categoryPath: '' }, categories()).error, /раздел/, 'a missing category never falls back to a random section');
  assert.match(validateNewProduct({ ...ok, retailRub: 'дорого' }, categories()).error, /Розничная/);
  assert.match(validateNewProduct({ ...ok, partnerRub: '2500' }, categories()).error, /ниже розничной/);
  assert.equal(validateNewProduct({ ...ok, partnerRub: '' }, categories()).value.partnerRub, null, 'the card price may be left empty');
});

test('a created card sits in its section and the sections above, and keeps its card price private', () => {
  const cats = categories();
  assert.deepEqual(sectionsOf(face, cats).map(c => c.name), ['Натуральная косметика', 'Уход за кожей лица и шеи']);
  const data = { name: 'Крем для рук', article: '', categoryPath: face, retailRub: 1990, partnerRub: 1490, availability: 'InStock' };
  const p = customProduct('krem-dlya-ruk', data, cats);
  assert.equal(p.path, '/product/krem-dlya-ruk/');
  assert.equal(p.category, 'Натуральная косметика/Уход за кожей лица и шеи');
  assert.deepEqual([p.prices.retail, p.prices.partner], [1990, null], 'the public card has no card price');
  assert.equal(customProduct('krem-dlya-ruk', data, cats, true).prices.partner, 1490, 'card holders get it from /api/card-prices');
  const products = structuredClone(content.products);
  mergeCustom(products, cats, [p]);
  assert.ok(products.includes(p));
  assert.equal(products[0].id,p.id,'a newly created product appears at the beginning of the catalog');
  for (const path of ['/catalog/naturalnaya-kosmetika/', face]) assert.equal(cats.find(c => c.path === path).products[0], p.path);
  mergeCustom(products, cats, [p]);
  assert.equal(products.filter(x => x.id === p.id).length, 1, 'merging again adds nothing');
  mergeCustom(products, cats, []);
  assert.ok(!products.some(x => x.id === p.id) && !cats.some(c => c.products.includes(p.path)), 'a deleted card leaves every list');
});

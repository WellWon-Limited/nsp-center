import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { applySite, listed, readSite } from '../src/site.ts';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const content = JSON.parse(read('src/generated/content.json'));
const stock = JSON.parse(read('src/product-stock.json'));
const byArticle = article => content.products.find(p => p.article === article);

test('cosmetics follow what the supplier has: three Bremani Care products in stock, Tropical Mists hidden', () => {
  for (const article of stock.inStock) assert.equal(byArticle(article).availability, 'InStock', article);
  const tropical = content.products.filter(p => p.properties?.['Коллекция'] === 'Tropical Mists');
  assert.deepEqual(tropical.map(p => p.article).sort(), [...stock.discontinued].sort(), 'the whole Tropical Mists line, nothing else');
  for (const p of tropical) assert.deepEqual([p.hidden, p.availability], [true, 'OutOfStock'], p.path);
  for (const article of ['21600', '21602']) {
    const p = byArticle(article);
    assert.equal(p.category, 'Натуральная косметика/Уход за кожей лица и шеи');
    for (const path of ['/catalog/naturalnaya-kosmetika/', '/catalog/ukhod-za-kozhey-litsa-i-shei/']) assert.ok(content.categories.find(c => c.path === path).products.includes(p.path), `${article} in ${path}`);
  }
});

test('a hidden product keeps its address, says it is not on sale and leaves the catalog, sitemap and chat', () => {
  const hidden = content.products.find(p => p.hidden);
  const $ = cheerio.load(read(`dist${hidden.path}index.html`));
  assert.match($('[data-ds-id="product-gone"] h1').text(), /сейчас нет в продаже/);
  assert.equal($('[data-ds-id="product-gone"] a').attr('href'), hidden.categoryPath);
  assert.equal($('meta[name="robots"]').attr('content'), 'noindex, nofollow');
  assert.ok(!read('dist/catalog/naturalnaya-kosmetika/index.html').includes(`href="${hidden.path}"`), 'not in its section');
  assert.ok(!read('dist/sitemap.xml').includes(hidden.path), 'not in the sitemap');
  assert.ok(!JSON.parse(read('src/generated/chat-index.json')).products.some(p => p.id === hidden.id), 'not offered by the chat');
});

test('the administrator hides and returns a product over what the build says', () => {
  const tropical = structuredClone(content.products.find(p => p.hidden));
  const plain = structuredClone(content.products.find(p => !p.hidden && p.availability === 'InStock'));
  applySite([tropical, plain], null, content.pricing.rubPerUnit);
  assert.deepEqual([listed(tropical), listed(plain)], [false, true], 'as built');
  applySite([tropical, plain], readSite({ products: {}, visibility: { [tropical.id]: false, [plain.id]: true } }), content.pricing.rubPerUnit);
  assert.deepEqual([listed(tropical), listed(plain)], [true, false], 'the administrator returned one and hid the other');
  assert.equal(plain.availability, 'OutOfStock', 'a hidden product cannot be bought');
  applySite([tropical, plain], readSite({ products: {}, visibility: { [plain.id]: false } }), content.pricing.rubPerUnit);
  assert.deepEqual([listed(tropical), listed(plain), plain.availability], [false, true, 'InStock'], 'returned, with its stock back');
});

test('site management has the switch and lists hidden products', () => {
  const admin = read('src/admin.tsx');
  assert.match(admin, /'\/api\/admin\/visibility', \{ productId: p\.id, hidden: !hidden \}/);
  assert.match(admin, /Скрыть с сайта/);
  assert.match(admin, /Вернуть на сайт/);
  assert.match(admin, /<h3>Скрыты с сайта<\/h3>/);
});

test('Saturday hours are 17:30 everywhere', () => {
  assert.ok(!read('src/generated/content.json').includes('Сб: с 12:00 до 18:00'));
  assert.match(read('src/assistant.tsx'), /сб с 12:00 до 17:30/);
});

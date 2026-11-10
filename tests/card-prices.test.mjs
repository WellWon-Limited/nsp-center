import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cardPricesFor, publicProduct, publicSiteSettings } from '../scripts/card-prices.mjs';

test('a public product has no card price, no card units and none of the old site price fields', () => {
  const p = publicProduct({ id: 'a', price: 3758, price_base: 3758, discount: '-0%', prices: { retail: 4676, partner: 3340, source: 'price-list', units: { retail: 49.74, partner: 35.53 } } });
  assert.deepEqual(p, { id: 'a', prices: { retail: 4676, partner: null, source: 'price-list', units: { retail: 49.74 } } });
});

test('card prices follow the administrator: own rubles, own units × rate, list units × rate, built price', () => {
  const products = [
    { id: 'list', prices: { partner: 700, units: { partner: 7 } } },
    { id: 'rub', prices: { partner: 700, units: { partner: 7 } } },
    { id: 'units', prices: { partner: 700, units: { partner: 7 } } },
    { id: 'built', prices: { partner: 650 } },
    { id: 'none', prices: { partner: null } },
  ];
  const settings = { rate: { rubPerUnit: 110 }, products: { rub: { partnerRub: 555 }, units: { partnerUnits: 8 } } };
  assert.deepEqual(cardPricesFor(products, settings, 100), { list: 770, rub: 555, units: 880, built: 650 });
  assert.deepEqual(publicSiteSettings({ products: { rub: { retailRub: 900, partnerRub: 555, partnerUnits: 5, availability: null } } }).products, { rub: { retailRub: 900, availability: null } });
});

test('the built site carries no card prices: bundle data, page data and scripts', () => {
  const summary = JSON.parse(readFileSync('src/generated/summary.json', 'utf8'));
  assert.ok(summary.products.every(p => p.prices.partner === null && p.prices.units?.partner === undefined && !('price_base' in p)), 'summary.json');
  const chat = JSON.parse(readFileSync('src/generated/chat-index.json', 'utf8'));
  assert.ok(chat.products.every(p => p.partner === null), 'chat-index.json: the chat gets the card price from the site, not its own index');
  const files = [];
  const walk = dir => { for (const f of readdirSync(dir)) { const path = join(dir, f); if (statSync(path).isDirectory()) walk(path); else if (/\.(html|js)$/.test(f)) files.push(path); } };
  walk('dist');
  const content = JSON.parse(readFileSync('src/generated/content.json', 'utf8'));
  const sample = content.products.find(p => p.prices.partner && p.prices.partner !== p.prices.retail);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /["']?partner["']?\s*:\s*\d/, file + ' (JSON in scripts has unquoted keys)');
    assert.doesNotMatch(text, /"price_base"/, file);
  }
  const page = readFileSync(join('dist', sample.path.replace(/^\//, ''), 'index.html'), 'utf8');
  assert.ok(!page.includes(String(sample.prices.partner)) || !new RegExp(`\\b${sample.prices.partner}\\b`).test(page.replace(/\d{5,}/g, '')), `${sample.path} shows no card price`);
  assert.doesNotMatch(page, /С дисконтной картой — <strong>/, 'the offer has no amount');
});

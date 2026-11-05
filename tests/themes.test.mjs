import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { root, readContent } from '../scripts/check-content.mjs';
import { readThemes } from '../scripts/themes.mjs';

const content = readContent();
const themes = readThemes();
const products = new Map(content.products.map((product) => [product.id, product]));
const dist = resolve(root, 'dist');
const manifest = new Map(JSON.parse(readFileSync(resolve(dist, 'prerender-manifest.json'), 'utf8')).routes.map((route) => [route.url, route.file]));
// Russian BAD advertising law and Yandex rules: a supplement page must not promise treatment.
const treatmentClaim = /(?<![а-яё])(лечит|лечат|лечение|вылеч|излеч|исцел|избав\w* от)/iu;

test('Every theme is a prerendered page with one H1, its products, FAQ markup and no treatment claims', () => {
  assert.ok(themes.length > 0, 'No theme pages defined');
  for (const theme of themes) {
    assert.match(theme.path, /^\/temy\/[a-z0-9-]+\/$/u, `${theme.slug}: theme path must live under /temy/`);
    const ids = [theme.mainProductId, ...theme.pairs.map((pair) => pair.productId)];
    for (const id of ids) assert.ok(products.has(id), `${theme.slug}: unknown product ${id}`);
    assert.equal(new Set(ids).size, ids.length, `${theme.slug}: a product is listed twice`);
    const texts = [theme.title, theme.description, theme.h1, theme.lead, ...theme.pairs.map((pair) => pair.why), ...theme.sections.flatMap((section) => [section.heading, ...section.paragraphs]), ...theme.faq.flatMap((item) => [item.question, item.answer])];
    for (const text of texts) assert.doesNotMatch(text, treatmentClaim, `${theme.slug}: treatment claim in "${text}"`);
    assert.ok(theme.description.length <= 160, `${theme.slug}: meta description longer than 160 characters`);

    const file = manifest.get(theme.path);
    assert.ok(file, `${theme.slug}: page not prerendered`);
    const $ = cheerio.load(readFileSync(resolve(dist, file), 'utf8'));
    assert.equal($('h1').length, 1, `${theme.slug}: exactly one H1`);
    assert.equal($('h1').text(), theme.h1);
    assert.equal($('meta[name="description"]').attr('content'), theme.description);
    for (const id of ids) assert.ok($(`a[href="${products.get(id).path}"]`).length > 0, `${theme.slug}: no link to ${id}`);
    const graph = JSON.parse($('script[type="application/ld+json"]').text())['@graph'];
    const faq = graph.find((entry) => entry['@type'] === 'FAQPage');
    assert.equal(faq?.mainEntity.length ?? 0, theme.faq.length, `${theme.slug}: FAQPage markup differs from the FAQ block`);

    const main = products.get(theme.mainProductId);
    const $product = cheerio.load(readFileSync(resolve(dist, manifest.get(main.path)), 'utf8'));
    assert.ok($product(`[data-ds-id="product-theme"] a[href="${theme.path}"]`).length === 1, `${theme.slug}: main product page does not link to the theme`);
  }
});

test('The browser bundle carries only the theme index; each theme page embeds its own full theme', () => {
  const summary = JSON.parse(readFileSync(resolve(root, 'src/generated/summary.json'), 'utf8'));
  assert.equal(summary.themes.length, themes.length);
  for (const entry of summary.themes) assert.ok(!('sections' in entry) && !('faq' in entry), `${entry.slug}: full text leaked into the browser summary`);
  for (const theme of themes) {
    const $ = cheerio.load(readFileSync(resolve(dist, manifest.get(theme.path)), 'utf8'));
    assert.equal(JSON.parse($('#nsp-page-data').text()).theme?.slug, theme.slug, `${theme.slug}: page data lacks its theme`);
  }
});

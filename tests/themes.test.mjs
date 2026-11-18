import {recommendationAreas} from '../packages/presentation/recommendation-areas.mjs';
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
    assert.equal($('.theme-page--paper > .theme-hero > h1').length, 1, `${theme.slug}: title must sit outside the article panel`);
    assert.equal($('.theme-paper h1').length, 0, `${theme.slug}: title moved inside the panel`);
    assert.equal($('.theme-paper .theme-lead').text(), theme.lead, `${theme.slug}: article introduction changed`);
    assert.equal($('.theme-paper .theme-section').length, theme.sections.length, `${theme.slug}: a section was lost`);
    assert.equal($('.theme-paper .theme-faq details').length, theme.faq.length, `${theme.slug}: an answer was lost`);

    assert.equal($('meta[name="description"]').attr('content'), theme.description);
    for (const id of ids) {const count=$(`a[href="${products.get(id).path}"]`).length;if(products.get(id).hidden)assert.equal(count,0,`${theme.slug}: hidden product must not be offered`);else assert.ok(count>0,`${theme.slug}: no link to ${id}`);}
    const graph = JSON.parse($('script[type="application/ld+json"]').text())['@graph'];
    const faq = graph.find((entry) => entry['@type'] === 'FAQPage');
    assert.equal(faq?.mainEntity.length ?? 0, theme.faq.length, `${theme.slug}: FAQPage markup differs from the FAQ block`);

    const main = products.get(theme.mainProductId);
    const $product = cheerio.load(readFileSync(resolve(dist, manifest.get(main.path)), 'utf8'));
    assert.ok($product(`[data-ds-id="product-theme"] a[href="${theme.path}"]`).length === (main.hidden?0:1), `${theme.slug}: main product page does not link to the theme`);
  }
});

test('The browser bundle carries only the theme index; each theme page embeds its own full theme', () => {
  const summary = JSON.parse(readFileSync(resolve(root, 'packages/catalog/generated/summary.json'), 'utf8'));
  assert.equal(summary.themes.length, themes.length);
  for (const entry of summary.themes) assert.ok(!('sections' in entry) && !('faq' in entry), `${entry.slug}: full text leaked into the browser summary`);
  for (const theme of themes) {
    const $ = cheerio.load(readFileSync(resolve(dist, manifest.get(theme.path)), 'utf8'));
    assert.equal(JSON.parse($('#nsp-page-data').text()).theme?.slug, theme.slug, `${theme.slug}: page data lacks its theme`);
  }
});

test('Expert comments are attributed to a named speaker and lecture, contain no treatment claims and open the Reviews tab', () => {
  for (const product of content.products.filter((item) => item.experts?.length)) {
    for (const note of product.experts) {
      assert.ok(note.speaker && note.lecture && note.text, `${product.id}: expert note lacks speaker, lecture or text`);
      assert.doesNotMatch(note.text, treatmentClaim, `${product.id}: treatment claim in expert note "${note.text}"`);
      assert.ok(note.text.length <= 400, `${product.id}: expert note longer than 400 characters`);
    }
    const $ = cheerio.load(readFileSync(resolve(dist, manifest.get(product.path)), 'utf8'));
    assert.equal($('#panel-reviews .expert-note').length, product.hidden?0:product.experts.length, `${product.id}: expert notes not rendered before JavaScript`);
  }
});

test('A product set shows the expert comments of the products inside it, each marked with its product', () => {
  const sets = content.products.filter((item) => item.setProducts?.length);
  for (const set of sets) {
    const ids = new Set(set.setProducts);
    for (const id of ids) assert.ok(content.products.some((p) => p.id === id && p.id !== set.id), `${set.id}: unknown product ${id} in the set`);
    const expected = set.setProducts.filter((id) => content.products.find((p) => p.id === id).experts?.length).length;
    assert.equal(set.experts?.length ?? 0, expected, `${set.id}: the set should carry one comment per product that has one`);
    for (const note of set.experts ?? []) assert.ok(note.about, `${set.id}: a set's comment must name its product`);
  }
});

test('The recommendation test only suggests catalog products, with reasons free of treatment claims', () => {
  const pairs = Object.values(recommendationAreas).flatMap(area=>area.products).map(([id,reason])=>['',id,reason]);
  assert.ok(pairs.length >= 15, 'recommendation areas list too few products');
  for (const [, id, reason] of pairs) {
    assert.ok(products.has(id), `recommend: unknown product ${id}`);
    assert.doesNotMatch(reason, treatmentClaim, `recommend: treatment claim in "${reason}"`);
  }
});

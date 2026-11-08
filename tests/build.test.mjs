import {productCover} from '../src/product-media.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { root, readContent, readSource } from '../scripts/check-content.mjs';
import { pricesFor, readPriceList } from '../scripts/pricing.mjs';

const content = readContent();
const source = readSource();
const priceList = readPriceList();
const dist = resolve(root, 'dist');
const manifest = JSON.parse(readFileSync(resolve(dist, 'prerender-manifest.json'), 'utf8'));
const base = 'https://nsp-center.ru';
const pathOf = (value) => {
  const url = new URL(value, base);
  return url.pathname + url.search;
};
const manifestMap = new Map(manifest.routes.map((route) => [pathOf(route.url), route.file]));
const routeMap = new Map(content.routes.map((route) => [pathOf(route.url ?? route.sourceUrl), route]));
const productMap = new Map(content.products.map((product) => [product.path, product]));
const htmlFor = (url) => readFileSync(resolve(dist, manifestMap.get(pathOf(url))), 'utf8');
const flattenJsonLd = (value) => Array.isArray(value) ? value.flatMap(flattenJsonLd) : value?.['@graph'] ? flattenJsonLd(value['@graph']) : [value];

test('Every one of the 227 source URLs has its own real prerendered HTML document', () => {
  assert.equal(source.pages.length, 227);
  assert.equal(manifestMap.size, manifest.routes.length, 'Manifest has duplicate source URL keys');
  const sourceFiles = source.pages.map((page) => {
    const file = manifestMap.get(pathOf(page.url));
    assert.ok(file, `Missing rendered source URL: ${page.url}`);
    assert.ok(!file.includes('..') && !file.startsWith('/'), `Unsafe manifest filename: ${file}`);
    const fullPath = resolve(dist, file);
    assert.ok(existsSync(fullPath) && statSync(fullPath).isFile(), `Missing SSR file: ${file}`);
    assert.ok(statSync(fullPath).size > 1000, `Empty/minimal SSR document: ${file}`);
    return file;
  });
  assert.equal(new Set(sourceFiles).size, 227, 'Pagination variants share an HTML document and lose their source content');
});

test('All 227 SSR documents expose content before JavaScript: title, exactly one H1, description and canonical', () => {
  for (const page of source.pages) {
    const route = routeMap.get(pathOf(page.url));
    const $ = cheerio.load(htmlFor(page.url));
    assert.ok(route, `No route contract: ${page.url}`);
    assert.ok($('title').text().trim().includes(route.title.trim()), `${page.url}: SEO title differs`);
    assert.equal($('h1').length, 1, `${page.url}: must render exactly one H1`);
    assert.ok($('h1').text().trim(), `${page.url}: H1 is empty`);
    assert.ok($('meta[name="description"]').attr('content')?.trim(), `${page.url}: missing description`);
    const canonical = $('link[rel="canonical"]').attr('href');
    assert.ok(canonical?.startsWith(`${base}/`), `${page.url}: canonical is not an absolute site URL`);
    assert.equal(pathOf(canonical), pathOf(page.url), `${page.url}: canonical lost pagination or changed path`);
    assert.ok($('main').text().trim().length > 20, `${page.url}: main content requires JS`);
    assert.equal($('main form[action*="bitrix"],main form[action*="personal/profile"]').length, 0, `${page.url}: legacy backend form remains`);
    const originalUrl = $('#root').attr('data-route');
    assert.equal(originalUrl, pathOf(page.url), `${page.url}: hydration route loses query state`);
  }
});

test('Every product carries the retail and partner prices of the NSP price list, or its snapshot price when unlisted', () => {
  let listed = 0;
  for (const original of source.products) {
    const product = productMap.get(pathOf(original.url));
    const expected = pricesFor(original, priceList);
    assert.deepEqual(product.prices, expected, `${product.path}: prices differ from the price list`);
    if (expected.source === 'price-list') {
      listed += 1;
      assert.ok(expected.partner > 0 && expected.partner < expected.retail, `${product.path}: partner price must be below retail`);
    } else assert.equal(expected.retail, original.price, `${product.path}: unlisted product must keep the snapshot price`);
    const $ = cheerio.load(htmlFor(product.path));
    // Before JavaScript everyone sees the retail price; a listed product also offers the discount card with its card price.
    assert.ok($('[data-ds-id="purchase-prices"] .price-row.current').text().includes(String(expected.retail).replace(/\B(?=(\d{3})+$)/g, '\u00a0')), `${product.path}: retail price before JavaScript`);
    assert.equal($('.card-offer').length, expected.partner === null ? 0 : 1, `${product.path}: discount-card offer before JavaScript`);
  }
  assert.equal(listed, 118, 'Products matched to the November 2026 price list');
});

test('All 166 product SSR documents have valid nested Product/Offer JSON-LD with retail prices', () => {
  for (const original of source.products) {
    const path = pathOf(original.url);
    const product = productMap.get(path);
    const $ = cheerio.load(htmlFor(path));
    const jsonLd = [];
    $('script[type="application/ld+json"]').each((_, element) => {
      assert.doesNotThrow(() => jsonLd.push(...flattenJsonLd(JSON.parse($(element).text()))), `${path}: invalid JSON-LD`);
    });
    const structured = jsonLd.find((entry) => entry?.['@type'] === 'Product');
    assert.ok(structured, `${path}: missing Product structured data`);
    assert.equal(structured.name, original.name, `${path}: Product name differs`);
    const offer = Array.isArray(structured.offers) ? structured.offers[0] : structured.offers;
    assert.ok(offer && offer['@type'] === 'Offer', `${path}: price must be nested under Product.offers`);
    assert.equal(Number(offer.price), pricesFor(original, priceList).retail, `${path}: structured price must be the retail price`);
    assert.equal(offer.priceCurrency, 'RUB', `${path}: currency differs`);
    assert.equal(offer.availability?.split('/').at(-1), original.availability, `${path}: stock status differs`);
    assert.ok(String(structured.image).includes(productCover(product)), `${path}: structured image differs`);
    if (structured.aggregateRating) {
      assert.equal(structured.aggregateRating['@type'], 'AggregateRating', `${path}: invalid aggregate rating type`);
      assert.equal(Number(structured.aggregateRating.ratingValue), original.rating, `${path}: rating differs`);
    }
    assert.ok($('main').text().includes(original.name.split('(')[0].trim()), `${path}: product title absent from SSR`);
    // The product card shows a curated facts list; these snapshot fields are left out on purpose.
    const curatedOmissions = new Set([
      'Назначение', // a list of diseases: supplements may not be advertised as treatment (docs/SEO.md principle 4)
      'Здоровье всей семьи', // audience tags that can contradict the label (e.g. "Кормящим мамам" vs breastfeeding contraindication)
      'Тип', // the product type is already the breadcrumb and the card kicker
    ]);
    for (const key of Object.keys(original.properties)) if (!curatedOmissions.has(key)) assert.ok($('main').text().includes(key) || (key === 'pv' && $('main').text().includes('PV')) || (key.startsWith('Состав') && $('main').text().includes('Состав')) || (key.startsWith('Противопоказания') && $('main').text().includes('Противопоказания')) || (key === 'Применение' && $('main').text().includes('Как принимать')) || (key === 'Нанесение' && $('main').text().includes('Как наносить')), `${path}: property omitted from SSR: ${key}`);
  }
});

test('Rendered category pagination exposes every member once, with no unavailable page link', () => {
  for (const category of content.categories) {
    const rendered = [];
    for (const route of manifest.routes.filter((route) => new URL(route.url, base).pathname === category.path)) {
      const $ = cheerio.load(htmlFor(route.url));
      $('[data-ds-id="product-card"] h3 a[href]').each((_, element) => rendered.push(element.attribs.href));
      $('.pagination a[href]').each((_, element) => assert.ok(manifestMap.has(pathOf(element.attribs.href)), `${route.url}: pagination URL lacks rendered document: ${element.attribs.href}`));
    }
    const expected = category.path === '/catalog/' ? content.products.map((product) => product.path) : category.products;
    assert.deepEqual([...new Set(rendered)].sort(), [...new Set(expected)].sort(), `${category.path}: SSR pagination misses/adds products`);
    assert.equal(rendered.length, new Set(rendered).size, `${category.path}: SSR product repeated across pages`);
  }
});

test('Every prerendered route uses available local assets and safe internal links', () => {
  const available = new Set([...manifestMap.keys(), ...Object.keys(content.redirects), '/404/']);
  const mediaFile = (value) => resolve(dist, decodeURI(new URL(value, base).pathname).replace(/^\//u, ''));
  for (const route of manifest.routes) {
    const $ = cheerio.load(htmlFor(route.url));
    $('[src],[href],[poster]').each((_, element) => {
      for (const attribute of ['src', 'href', 'poster']) {
        const value = element.attribs?.[attribute];
        if (!value || /^(?:#|tel:|mailto:|data:)/u.test(value)) continue;
        const url = new URL(value, base);
        assert.ok(!/^javascript:/iu.test(value), `${route.url}: unsafe link ${value}`);
        assert.ok(!/(?:mc\.yandex|google-analytics|googletagmanager|doubleclick)/iu.test(value), `${route.url}: legacy tracking ${value}`);
        if (url.origin !== base) continue;
        if (/^\/(?:assets|media)\//u.test(url.pathname) || element.name === 'link' && element.attribs.rel !== 'canonical') {
          assert.ok(existsSync(mediaFile(value)), `${route.url}: missing built asset ${value}`);
        } else if (element.name === 'a') {
          const canonical = pathOf(value);
          assert.ok(available.has(canonical) || available.has(url.pathname), `${route.url}: broken local link ${value}`);
        }
      }
    });
    $('img').each((_, element) => assert.ok(element.attribs.alt?.trim(), `${route.url}: image without meaningful alt`));
  }
});

test('Sitemap includes every source pathname, including all products and articles', () => {
  const $ = cheerio.load(readFileSync(resolve(dist, 'sitemap.xml'), 'utf8'), { xml: true });
  const locations = $('loc').map((_, element) => $(element).text()).get();
  assert.equal(new Set(locations).size, locations.length, 'Sitemap has duplicate URLs');
  const paths = new Set(locations.map((url) => new URL(url).pathname));
  for (const page of source.pages) assert.ok(paths.has(new URL(page.url).pathname), `Sitemap misses ${page.url}`);
  for (const url of locations) assert.ok(url.startsWith(`${base}/`), `Sitemap uses wrong origin: ${url}`);
});

test('All 13 stale product URLs have real redirect documents leading to the matching current product', () => {
  for (const { url } of source.audit.broken_links) {
    const oldPath = new URL(url).pathname;
    const target = content.redirects[oldPath];
    const file = resolve(dist, oldPath.replace(/^\//u, ''), 'index.html');
    assert.ok(existsSync(file), `Missing legacy redirect document: ${oldPath}`);
    const $ = cheerio.load(readFileSync(file, 'utf8'));
    assert.equal($('link[rel="canonical"]').attr('href'), base + target, `${oldPath}: wrong canonical target`);
    assert.ok($('meta[http-equiv="refresh"]').attr('content')?.includes(`url=${target}`), `${oldPath}: no working static redirect`);
    assert.equal($('a[href]').attr('href'), target, `${oldPath}: accessible fallback link differs`);
    assert.ok(manifestMap.has(target) && productMap.has(target), `${oldPath}: target is not a rendered product`);
  }
});

test('The isolated running app serves all 227 source URLs without a 404', { skip: !process.env.NSP_TEST_URL }, async () => {
  const failures = [];
  for (const page of source.pages) {
    const path = pathOf(page.url);
    const response = await fetch(new URL(path, process.env.NSP_TEST_URL), { signal: AbortSignal.timeout(10000) });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) failures.push(`${path}: HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());
    if ($('h1').length !== 1 || !$('main').text().trim()) failures.push(`${path}: empty/unrendered content`);
    if ($('#root').attr('data-route') !== path) failures.push(`${path}: HTTP server returned the wrong pagination document`);
  }
  assert.deepEqual(failures, []);
});

test('The site is installable and works offline: manifest, icons and a service worker that precaches the app shell', () => {
  const app = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'));
  assert.equal(app.name, 'NSP Center');
  assert.equal(app.display, 'standalone');
  assert.equal(app.start_url, '/');
  assert.equal(app.background_color, '#faf7ee');
  for (const size of ['192x192', '512x512']) assert.ok(app.icons.some((icon) => icon.sizes === size && existsSync(resolve(dist, icon.src.slice(1)))), `manifest icon ${size} is missing`);
  assert.ok(app.icons.some((icon) => icon.purpose === 'maskable'), 'manifest needs a maskable icon');
  const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
  const precache = JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
  for (const page of ['/', '/health/', '/profile/']) assert.ok(precache.includes(page), `${page} must work offline`);
  const built = readFileSync(resolve(dist, 'index.html'), 'utf8').match(/\/assets\/[^"]+/g);
  for (const file of built) assert.ok(precache.includes(file), `${file} must be precached`);
  for (const file of precache) if (!file.endsWith('/')) assert.ok(existsSync(resolve(dist, file.slice(1))), `precached ${file} does not exist`);
  const $ = cheerio.load(htmlFor('/'));
  assert.equal($('link[rel="manifest"]').attr('href'), '/manifest.webmanifest');
  assert.equal($('link[rel="apple-touch-icon"]').attr('href'), '/icons/apple-touch-icon.png');
  assert.equal($('.nsp-launch').length,1);assert.equal($('.nsp-launch img').attr('src'),'/icons/splash.svg');assert.equal($('.nsp-launch-tagline').text(),'Забота о себе в вашем ритме.');assert.equal($('.nsp-launch-tagline br,.nsp-launch .loading').length,0);assert.equal($('.nsp-launch').attr('aria-hidden'),'true');
});

test('Products added after the snapshot have a page, price-list prices, a local image and a place on the first category page', () => {
  const added = content.products.filter((product) => product.added);
  assert.ok(added.length >= 2, 'expected the added products (src/product-new)');
  for (const product of added) {
    assert.ok(manifestMap.has(product.path), `${product.path}: no prerendered page`);
    assert.deepEqual(product.prices, pricesFor(product, priceList), `${product.path}: prices differ from the price list`);
    assert.ok(existsSync(resolve(root, 'public', product.image.slice(1))), `${product.path}: image file missing`);
    const $ = cheerio.load(htmlFor(product.path));
    assert.ok($('h1').text().includes(product.name.split('(')[0].trim()), `${product.path}: title absent`);
    assert.equal($('.card-offer').length, 1, `${product.path}: discount-card offer missing`);
    const category = cheerio.load(htmlFor(product.categoryPath));
    assert.ok(category(`[data-ds-id="product-card"] h3 a[href="${product.path}"]`).length === 1, `${product.path}: not on the first page of its category`);
  }
});

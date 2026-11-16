import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as cheerio from 'cheerio';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, 'references/nsp-center.ru');
const origin = 'https://nsp-center.ru';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const cleanText = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();
const pathOf = (value) => {
  const url = new URL(value, origin);
  const pagination = [...url.searchParams].filter(([key]) => /^PAGEN_\d+$/u.test(key));
  const query = new URLSearchParams(pagination).toString();
  return `${decodeURI(url.pathname)}${query ? `?${query}` : ''}`;
};
const keyOf = (item) => pathOf(item.url ?? item.path ?? item.sourceUrl);
const htmlText = (html) => {
  const $ = cheerio.load(html ?? '', null, false);
  $('br').replaceWith(' ');
  $('p,li,div,h2,h3,h4,h5,h6,tr,td,section,article').append(' ');
  return cleanText($.text());
};
const words = (text) => set(String(text).toLocaleLowerCase('ru').replace(/https?:\/\/[^\s)]+/gu, '').match(/[\p{L}\p{N}]+/gu) ?? []);
const retention = (original, rendered) => {
  const originalWords = words(original);
  const renderedWords = new Set(words(rendered));
  return originalWords.length ? originalWords.filter((word) => renderedWords.has(word)).length / originalWords.length : 1;
};
const set = (items) => [...new Set(items)].sort();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

export function readSource() {
  const source = (name) => readJson(resolve(sourceRoot, `data/${name}.json`));
  return {
    products: source('products'), categories: source('catalog'), articles: source('blog'),
    pages: readFileSync(resolve(sourceRoot, 'data/pages.jsonl'), 'utf8').trim().split('\n').map(JSON.parse),
    audit: source('audit'), assets: source('assets'), site: source('site'),
  };
}

export function readContent() {
  return readJson(resolve(root, 'src/generated/content.json'));
}

function htmlFragments(data) {
  const fragments = [];
  function visit(value, context, isHtml = false) {
    if (typeof value === 'string' && isHtml) fragments.push({ context, html: value });
    else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${context}[${index}]`, isHtml));
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) visit(child, `${context}.${key}`, isHtml || /html$/iu.test(key));
    }
  }
  for (const name of ['products', 'categories', 'articles', 'pages', 'site']) visit(data[name], name);
  return fragments;
}

export function auditContent(data = readContent(), source = readSource()) {
  const checks = [];
  const check = (name, run) => {
    const issues = [];
    const expect = (condition, message) => { if (!condition) issues.push(message); };
    try { run(expect); } catch (error) { issues.push(error.message); }
    checks.push({ name, issues });
  };
  const routes = data.routes ?? [];
  const routePaths = new Set(routes.map(keyOf));
  const productMap = new Map((data.products ?? []).map((item) => [keyOf(item), item]));
  // Products added after the snapshot (scripts/new-products.mjs) are checked by their own test, not against the snapshot.
  const snapshotOnly = (paths) => paths.filter((item) => !productMap.get(item)?.added);
  const categoryMap = new Map((data.categories ?? []).map((item) => [keyOf(item), item]));
  const articleMap = new Map((data.articles ?? []).map((item) => [keyOf(item), item]));
  const pageMap = new Map((data.pages ?? []).map((item) => [keyOf(item), item]));
  const redirects = data.redirects ?? {};
  const fragments = htmlFragments(data);
  const exclusions = new Map((data.audit?.unresolvedInternalLinks ?? []).map((item) => [pathOf(item.url), item.reason]));
  const publicFile = (url) => resolve(root, 'public', decodeURI(new URL(url, origin).pathname).replace(/^\//u, ''));

  check('Snapshot contract: 227 source pages, including 18 pagination URLs', (expect) => {
    expect(source.pages.length === 227, `Expected 227 source pages; got ${source.pages.length}`);
    expect(source.pages.filter((page) => new URL(page.url).search).length === 18, 'Expected 18 source pagination URLs');
    expect(source.products.length === 166 && source.categories.length === 17 && source.articles.length === 8, 'Snapshot entity counts changed');
    expect(routePaths.size === routes.length, 'Duplicate generated route keys');
    for (const page of source.pages) {
      expect(routePaths.has(pathOf(page.url)), `Missing source route: ${pathOf(page.url)}`);
      expect(existsSync(resolve(sourceRoot, page.raw_html)), `Missing original raw HTML: ${page.raw_html}`);
    }
    for (const route of routes) {
      expect(route.path?.startsWith('/') && !route.path.startsWith('//'), `Unnormalized route: ${route.path}`);
      expect(Boolean(cleanText(route.title)), `Missing route title: ${route.path}`);
    }
  });

  check('All 166 products preserve prices, article, availability, properties and sections', (expect) => {
    const snapshotProducts = [...productMap.values()].filter((item) => !item.added).length;
    expect(snapshotProducts === 166, `Expected 166 unique snapshot products; got ${snapshotProducts}`);
    const scalars = ['name', 'article', 'price', 'price_base', 'discount', 'currency', 'brand', 'category', 'rating', 'review_count'];
    // Stock is the snapshot's except what the NSP office confirmed later (src/product-stock.json); Saturday closes at 17:30.
    const stock = readJson(resolve(root, 'src/product-stock.json'));
    const stockOf = (original) => stock.inStock.includes(original.article) ? ['InStock', 'В наличии'] : (stock.discontinued.includes(original.article)||(stock.hiddenIds??[]).includes(pathOf(original.url).split('/').filter(Boolean).at(-1))) ? ['OutOfStock', 'Нет в наличии'] : [original.availability, original.availability_text];
    const withHours = (sections) => Object.fromEntries(Object.entries(sections).map(([name, text]) => [name, typeof text === 'string' ? text.replace(/Сб: с 12:00 до 18:00/g, 'Сб: с 12:00 до 17:30') : text]));
    for (const original of source.products) {
      const path = pathOf(original.url);
      const product = productMap.get(path);
      expect(Boolean(product), `Missing product: ${path}`);
      if (!product) continue;
      for (const field of scalars) expect(product[field] === original[field], `${path}: ${field} differs from snapshot`);
      const [availability, availabilityText] = stockOf(original);
      expect(product.availability === availability && product.availability_text === availabilityText, `${path}: stock differs from the snapshot and src/product-stock.json`);
      expect(Boolean(product.hidden) === (stock.discontinued.includes(original.article)||(stock.hiddenIds??[]).includes(pathOf(original.url).split('/').filter(Boolean).at(-1))), `${path}: hidden only when the line is no longer supplied`);
      expect(equal(product.properties, original.properties), `${path}: product properties lost or changed`);
      expect(equal(product.sections, withHours(original.sections)), `${path}: product sections lost or changed`);
      expect(equal(set(product.related ?? []), set(original.related.map(pathOf).filter((url) => url !== path))), `${path}: related product links lost`);
      expect(Number.isFinite(product.price) && product.price > 0, `${path}: invalid price`);
      expect(product.currency === 'RUB', `${path}: invalid currency`);
      expect(Boolean(product.image) && (product.images ?? []).includes(product.image), `${path}: primary image not in gallery`);
      for (const [name, text] of Object.entries(original.sections)) {
        // These snapshot sections are shop controls/cards, represented by the new
        // consultation UI and typed related products rather than rich HTML.
        if (name === '(без заголовка)' && cleanText(text) === 'Нужна консультация? Сомневаетесь, подойдет ли вам этот товар? Позвоните мне') continue;
        if (['Сопутствующие товары', 'Рекомендуемые товары'].includes(name)) continue;
        const html = product.sectionsHtml?.[name];
        const plainSource = withHours({ text }).text.replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1');
        expect(typeof html === 'string' && retention(plainSource, htmlText(html)) >= 0.98, `${path}: rendered section text lost: ${name}`);
      }
    }
  });

  check('All source product images and certificate documents remain local and byte-identical', (expect) => {
    const verifyMedia = (originalUrl, importedUrl, context) => {
      expect(typeof importedUrl === 'string' && importedUrl.startsWith('/media/'), `${context}: media is not local: ${importedUrl}`);
      if (typeof importedUrl !== 'string' || !importedUrl.startsWith('/media/')) return;
      const original = source.assets[originalUrl];
      expect(Boolean(original?.file), `${context}: original media missing in source manifest: ${originalUrl}`);
      const file = publicFile(importedUrl);
      expect(existsSync(file) && statSync(file).isFile() && statSync(file).size > 0, `${context}: local media missing/empty: ${importedUrl}`);
      if (original?.file && existsSync(file)) {
        const sourceFile = resolve(sourceRoot, original.file);
        expect(existsSync(sourceFile), `${context}: source file missing: ${original.file}`);
        if (existsSync(sourceFile)) expect(digest(sourceFile) === digest(file), `${context}: original media bytes changed: ${importedUrl}`);
      }
    };
    for (const original of source.products) {
      const path = pathOf(original.url);
      const product = productMap.get(path);
      if (!product) continue;
      expect(product.images?.length === original.images.length, `${path}: gallery image count differs`);
      original.images.forEach((url, index) => verifyMedia(url, product.images?.[index], `${path} image ${index}`));
      expect(product.documents?.length === original.documents.length, `${path}: certificate document count differs`);
      original.documents.forEach((document, index) => {
        const imported = product.documents?.[index];
        expect(imported?.name === document.name && imported?.size === document.size, `${path}: certificate metadata differs at ${index}`);
        verifyMedia(document.url, imported?.url, `${path} document ${index}`);
      });
    }
  });

  check('All 17 categories retain full membership and every pagination route', (expect) => {
    expect(categoryMap.size === 17, `Expected 17 categories; got ${categoryMap.size}`);
    for (const original of source.categories) {
      const path = pathOf(original.url);
      const category = categoryMap.get(path);
      expect(Boolean(category), `Missing category: ${path}`);
      if (!category) continue;
      expect(category.name === original.name, `${path}: category name differs`);
      expect(equal(set(snapshotOnly(category.products ?? [])), set(original.products.map(pathOf))), `${path}: category membership differs`);
      expect(equal(set(category.pagination ?? []), set(original.pagination.map(pathOf))), `${path}: pagination differs`);
      expect((category.products ?? []).every((item) => productMap.has(item)), `${path}: category references missing products`);
      expect(category.parent === (original.parent ? pathOf(original.parent) : null), `${path}: category parent differs`);
      expect(equal(set(category.children ?? []), set(original.children.map(pathOf))), `${path}: category children differ`);
      for (const pagination of original.pagination) expect(routePaths.has(pathOf(pagination)), `Missing pagination route: ${pagination}`);
      const pageRoutes = routes.filter((route) => keyOf(route).split('?')[0] === path);
      if (pageRoutes.some((route) => route.products)) {
        expect(equal(set(snapshotOnly(pageRoutes.flatMap((route) => route.products ?? []))), set(original.products.map(pathOf))), `${path}: paginated route union loses products`);
        const paginatedProducts = pageRoutes.flatMap((route) => route.products ?? []);
        expect(paginatedProducts.length === new Set(paginatedProducts).size, `${path}: product duplicated between pagination pages`);
      }
    }
  });

  check('Articles and informational pages exist, with unique article SEO titles', (expect) => {
    expect(articleMap.size === 8, `Expected 8 articles; got ${articleMap.size}`);
    const articleTitles = [];
    for (const original of source.articles) {
      const path = pathOf(original.url);
      const article = articleMap.get(path);
      expect(Boolean(article), `Missing article: ${path}`);
      if (!article) continue;
      expect(article.title === original.title && article.date === original.date, `${path}: article title/date differs`);
      const route = routes.find((item) => keyOf(item) === path);
      articleTitles.push(cleanText(route?.title));
      expect(cleanText(route?.title).includes(cleanText(original.title)), `${path}: SEO title lacks article name`);
      const originalBody = original.text.split(original.date ?? '__no_date__').at(-1).split('Рекомендуемые товары из статьи')[0].replace(/Назад к списку\s*$/u, '');
      expect(retention(originalBody, htmlText(article.html)) >= 0.98, `${path}: article body text lost`);
    }
    expect(set(articleTitles).length === 8, 'Article SEO titles are duplicated');
    const pages = source.pages.filter((page) => page.type === 'page');
    expect(pages.length === 16, 'Expected 16 source informational pages');
    for (const original of pages) {
      const path = pathOf(original.url);
      const page = pageMap.get(path);
      expect(Boolean(page), `Missing informational page: ${path}`);
      if (!page) continue;
      let substantive = original.text;
      for (const breadcrumb of original.breadcrumbs) substantive = substantive.replaceAll(breadcrumb.name, ' ');
      if (original.h1) substantive = substantive.replaceAll(original.h1, ' ');
      substantive = substantive.replace(/Загрузка карты\s*\.{3}|Вернуться/gu, '');
      if (original.words > 4) expect(retention(substantive, `${page.title} ${htmlText(page.html)}`) >= (original.path === '/video/' ? 0.75 : 0.90), `${path}: substantive page lost its content`);
      else expect(page.emptySource === true, `${path}: original empty page must be explicitly identified`);
    }
  });

  check('All editorial article and informational-page images remain available without altered bytes', (expect) => {
    const externalMedia = new Set(data.audit?.externalMedia ?? []);
    const verify = (originalUrl, importedMedia, context) => {
      const url = new URL(originalUrl, origin);
      if (url.origin !== origin) {
        expect(importedMedia.includes(url.href) && externalMedia.has(url.href), `${context}: external source media lost or undocumented: ${url.href}`);
        return;
      }
      const expected = `/media${url.pathname}`;
      expect(importedMedia.includes(expected), `${context}: editorial image absent from rendered media: ${expected}`);
      const original = source.assets[url.href];
      const localFile = publicFile(expected);
      expect(Boolean(original?.file) && existsSync(localFile), `${context}: original editorial image unavailable: ${url.href}`);
      if (original?.file && existsSync(localFile)) expect(digest(resolve(sourceRoot, original.file)) === digest(localFile), `${context}: editorial image bytes changed: ${expected}`);
    };
    for (const original of source.pages.filter((page) => page.type === 'page')) {
      const page = pageMap.get(pathOf(original.url));
      if (!page) continue;
      for (const image of original.images) {
        // Template map markers are UI decoration; source review avatars and
        // video thumbnails are editorial media and are still required.
        if (new URL(image.original).pathname.startsWith('/bitrix/')) continue;
        verify(image.original, page.media ?? [], original.path);
        if (original.path === '/video/') {
          const videoId = new URL(image.original).pathname.split('/')[2];
          const $ = cheerio.load(page.html, null, false);
          expect($('a[href]').toArray().some((element) => /(?:youtube\.com|youtu\.be)/u.test(element.attribs.href) && element.attribs.href.includes(videoId)), `${original.path}: thumbnail has no working external video URL for ${videoId}`);
        }
      }
    }
    for (const original of source.articles) {
      const path = pathOf(original.url);
      const article = articleMap.get(path);
      if (!article) continue;
      const sourcePage = source.pages.find((page) => pathOf(page.url) === path);
      const $ = cheerio.load(gunzipSync(readFileSync(resolve(sourceRoot, sourcePage.raw_html))).toString('utf8'));
      $('.news-detail-text img').each((_, element) => {
        if ($(element).parents().toArray().some((parent) => /(?:c-widget-products-\d+|c-catalog-section)/u.test(parent.attribs?.class ?? ''))) return;
        const src = new URL(element.attribs.src, original.url).href;
        const originalImage = sourcePage.images.find((image) => image.src === src)?.original ?? src;
        verify(originalImage, article.images ?? [], path);
      });
    }
  });

  check('The 13 old product URLs redirect to existing current product routes', (expect) => {
    expect(source.audit.broken_links.length === 13, 'Expected 13 known stale source URLs');
    for (const { url } of source.audit.broken_links) {
      const oldPath = pathOf(url);
      const target = redirects[oldPath];
      expect(Boolean(target) && productMap.has(target), `${oldPath}: redirect missing or target is not a current product`);
      expect(target?.split('/').filter(Boolean).at(-1) === oldPath.split('/').filter(Boolean).at(-1), `${oldPath}: redirect changes product identity`);
    }
  });

  check('Imported rich HTML has no executable code, inline styles, forms, tracking or duplicate page H1', (expect) => {
    expect(fragments.length > 0, 'No rich HTML found to audit');
    const unsafe = 'script,style,link,meta,base,iframe,object,embed,form,input,textarea,select,button';
    for (const { context, html } of fragments) {
      const $ = cheerio.load(html, null, false);
      expect($(unsafe).length === 0, `${context}: unsafe active or backend element in imported HTML`);
      expect($('h1').length === 0, `${context}: embedded h1 duplicates the page heading`);
      $('*').each((_, element) => {
        for (const [attribute, value] of Object.entries(element.attribs ?? {})) {
          expect(!/^on/iu.test(attribute) && attribute !== 'style' && attribute !== 'srcdoc', `${context}: unsafe ${attribute} attribute`);
          expect(!/^(?:\s|[\u0000-\u001f])*javascript:/iu.test(value), `${context}: javascript URL`);
          expect(!/(?:mc\.yandex|metrika|google-analytics|googletagmanager|doubleclick|facebook\.com\/tr)/iu.test(value), `${context}: tracking URL remains`);
        }
      });
    }
  });

  check('Imported internal links resolve; external-only exclusions have reasons; all local media exists', (expect) => {
    for (const [url, reason] of exclusions) expect(Boolean(cleanText(reason)), `Unexplained external-only URL: ${url}`);
    for (const { context, html } of fragments) {
      const $ = cheerio.load(html, null, false);
      $('[href],[src],[poster]').each((_, element) => {
        for (const attribute of ['href', 'src', 'poster']) {
          const value = element.attribs?.[attribute];
          if (!value || value.startsWith('#') || /^(?:tel|mailto):/iu.test(value)) continue;
          let url;
          try { url = new URL(value, origin); } catch { expect(false, `${context}: malformed URL ${value}`); continue; }
          expect(['https:', 'http:'].includes(url.protocol), `${context}: unsupported URL protocol ${value}`);
          if (url.origin !== origin) continue;
          const path = pathOf(url.href);
          if (url.pathname.startsWith('/media/')) {
            expect(existsSync(publicFile(url.href)) && statSync(publicFile(url.href)).isFile(), `${context}: missing media ${value}`);
          } else if (attribute === 'href') {
            const target = redirects[path] ?? path;
            const externalOnly = /^https?:\/\//iu.test(value) && exclusions.has(path);
            expect(routePaths.has(target) || externalOnly, `${context}: unresolved internal link ${value}`);
          } else {
            expect(false, `${context}: source-host media was not copied locally: ${value}`);
          }
        }
      });
      $('[srcset]').each((_, element) => {
        for (const value of element.attribs.srcset.split(',').map((item) => item.trim().split(/\s+/u)[0])) {
          if (value.startsWith('/')) expect(existsSync(publicFile(value)), `${context}: missing srcset media ${value}`);
        }
      });
    }
    for (const entity of [...productMap.values(), ...articleMap.values(), ...pageMap.values()]) {
      for (const media of entity.images ?? []) {
        const value = typeof media === 'string' ? media : media.src ?? media.url;
        if (value?.startsWith('/media/')) expect(existsSync(publicFile(value)), `${keyOf(entity)}: missing gallery media ${value}`);
      }
    }
    expect(typeof data.site?.logo === 'string' && data.site.logo.startsWith('/media/') && existsSync(publicFile(data.site.logo)), 'Site logo is not available locally');
  });
  return checks;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const checks = auditContent();
    for (const { name, issues } of checks) {
      console.log(`${issues.length ? 'FAIL' : 'PASS'} ${name}`);
      issues.forEach((issue) => console.error(`  ${issue}`));
    }
    const failures = checks.reduce((sum, check) => sum + check.issues.length, 0);
    console.log(`${checks.length} checks; ${failures} issue(s)`);
    process.exitCode = failures ? 1 : 0;
  } catch (error) {
    console.error(`Content audit cannot run: ${error.message}`);
    process.exitCode = 1;
  }
}

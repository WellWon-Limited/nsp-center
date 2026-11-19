import { FREE_COURIER_FROM } from '../packages/domain/delivery-prices.mjs';
import { existsSync, readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { load } from 'cheerio';
import {publicProduct} from '../packages/domain/card-prices.mjs';
import { pricesFor, readPriceList } from './pricing.mjs';
import { readThemes } from './themes.mjs';
import { readProductCopy } from './product-copy.mjs';
import { readNewProducts } from './new-products.mjs';
import { readProductExperts, readSetContents } from './product-experts.mjs';

// Offline import: the snapshot is the content source and is never written to;
// the NSP price list (references/prices/) adds retail and partner prices.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = resolve(root, 'references/nsp-center.ru');
const generated = resolve(root, 'packages/catalog/generated/content.json');
const mediaRoot = resolve(root, 'public/media');
const origin = 'https://nsp-center.ru';
const readData = name => JSON.parse(readFileSync(resolve(snapshot, `data/${name}.json`), 'utf8'));
const sourceProducts = readData('products');
const sourceCategories = readData('catalog');
const sourceArticles = readData('blog');
const sourceSite = readData('site');
const crawl = readData('crawl');
const assets = readData('assets');
const sourceAudit = readData('audit');
const priceList = readPriceList();
const productCopy = readProductCopy();
const productExperts = readProductExperts();
const sourcePages = readFileSync(resolve(snapshot, 'data/pages.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const sourceByUrl = new Map(sourcePages.map(page => [page.url, page]));
const successfulPages = crawl.filter(page => page.kind === 'page' && page.status === 200);
const sourceRouteSet = new Set(successfulPages.map(page => pathnameUrl(page.url)));
const copied = new Set();
const externalMedia = new Set();
const unresolvedLinks = new Map();
const unavailableDecorativeMedia = new Set();
const sourceContent = [];

function pathnameUrl(value, base = origin) {
  if (!value) return value;
  const url = new URL(value, base);
  return url.hostname.replace(/^www\./, '') === 'nsp-center.ru'
    ? `${url.pathname}${url.search}${url.hash}` : url.href;
}

const redirects = Object.fromEntries(sourceAudit.broken_links.map(link => {
  const old = pathnameUrl(link.url);
  const slug = new URL(link.url).pathname.split('/').filter(Boolean).at(-1);
  const target = `/product/${slug}/`;
  if (!sourceRouteSet.has(target)) throw new Error(`No product for stale source link ${old}`);
  return [old, target];
}));

function siteUrl(value, base = origin) {
  const path = pathnameUrl(value, base);
  if (!path) return path;
  const [withoutHash, hash] = path.split('#');
  let normalized = redirects[withoutHash] || withoutHash;
  if (normalized.startsWith('/') && !normalized.includes('?') && !sourceRouteSet.has(normalized) && sourceRouteSet.has(`${normalized}/`)) normalized += '/';
  return normalized + (hash ? `#${hash}` : '');
}

function originalAssetPath(path) {
  return path.replace(/^\/upload\/resize_cache\/((?:iblock|medialibrary)\/[^/]+)\/[^/]+\//, '/upload/$1/');
}

function hasSnapshotMedia(value, base) {
  const url = new URL(value, base);
  if (url.hostname.replace(/^www\./, '') !== 'nsp-center.ru') return true;
  const path = originalAssetPath(decodeURIComponent(url.pathname));
  const entry = assets[`${origin}${path}`] || assets[url.href];
  return existsSync(resolve(snapshot, entry?.file || `assets/${path.replace(/^\//, '')}`));
}

function localMedia(value, base = origin) {
  if (!value) return null;
  const url = new URL(value, base);
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  if (url.hostname.replace(/^www\./, '') !== 'nsp-center.ru') {
    externalMedia.add(url.href);
    return url.href;
  }
  const path = originalAssetPath(decodeURIComponent(url.pathname));
  if (!/\.(?:avif|gif|ico|jpe?g|png|svg|webp|pdf|txt|docx?|xlsx?|mp4|webm|ogg|mp3|wav)$/i.test(path)) {
    throw new Error(`Refusing executable or unsupported media: ${value}`);
  }
  const entry = assets[`${origin}${path}`] || assets[url.href];
  const source = resolve(snapshot, entry?.file || `assets/${path.replace(/^\//, '')}`);
  if (!source.startsWith(snapshot + sep) || !existsSync(source)) throw new Error(`Missing snapshot media ${value}: ${source}`);
  const destination = resolve(mediaRoot, path.replace(/^\//, ''));
  if (!destination.startsWith(mediaRoot + sep)) throw new Error(`Invalid media path ${path}`);
  if (!copied.has(destination)) {
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    copied.add(destination);
  }
  return `/media${path}`;
}

function provenance(page) {
  return { raw: page.raw_html, markdown: page.markdown };
}

function rawPage(url) {
  const page = sourceByUrl.get(url);
  if (!page) throw new Error(`Missing page metadata ${url}`);
  const text = gunzipSync(readFileSync(resolve(snapshot, page.raw_html))).toString('utf8');
  return { page, $: load(text), raw: text };
}

function pageContainers($) {
  const wrapper = $('.intec-template-content > div').first();
  if (!wrapper.length) return [];
  return wrapper.children().toArray().filter(node => {
    const element = $(node);
    if (element.find('.sale-basket-small, .c-header, .c-breadcrumb, .intec-breadcrumb').length) return false;
    if (element.find('h1').length && element.text().trim() === element.find('h1').text().trim()) return false;
    return true;
  });
}

const unsafeTags = 'script,style,noscript,template,iframe,object,embed,svg,math,canvas,link,meta,base,input,button,select,textarea';
const blockTags = new Set(['p', 'div', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'figure', 'figcaption', 'blockquote', 'dl', 'dt', 'dd', 'address', 'pre', 'details', 'summary']);
const allowedTags = new Set([...blockTags, 'a', 'img', 'strong', 'em', 'u', 's', 'small', 'sup', 'sub', 'br', 'hr', 'span', 'caption', 'code']);

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function semanticHtml(input, base, title = '') {
  const $ = load(input, null, false);
  $(unsafeTags).remove();
  $('form').each((_, node) => $(node).replaceWith($(node).html() || ''));
  $('[itemscope][style*="display: none"], [itemscope][style*="display:none"], .contacts-map, .store-map, [class*="map-google"], .news-detail-back, .news-detail-footer, .news-detail-social, .c-main-form, .c-form, .c-form-result-new, [class*="main-form-template"]').remove();
  // Product cards have their own typed representation; source shop widgets are not article content.
  $('.c-widget-products-1, .c-widget-products-2, .c-widget-products-3, .c-catalog-section, .widget-products, .news-detail-products').remove();
  $('h3').filter((_, node) => $(node).text().trim() === 'Рекомендуемые товары из статьи').parent().remove();
  // Static FAQ panels are made readable without depending on the old tab scripts.
  const faqLabels = new Map();
  $('.faq .nav-tabs a[href]').each((_, node) => faqLabels.set($(node).attr('href').slice(1), $(node).text().trim()));
  $('.faq .tab-pane').each((_, node) => {
    const label = faqLabels.get($(node).attr('id'));
    if (label) $(node).prepend(`<h2>${escapeText(label)}</h2>`);
  });
  $('.nav-tabs, .faq-item-name-indicators').remove();
  $('.contacts-contact-icon, .contacts-contact-icon-wrap').remove();
  $('.faq-item-name-text, .widget-element-name').each((_, node) => { node.tagName = 'h3'; });
  // Video thumbnails and destinations were data attributes in the original UI.
  $('.video-gallery-list [data-src], .c-videos [data-src]').each((_, node) => {
    const item = $(node);
    const destination = item.attr('data-src');
    if (!/^https?:\/\//i.test(destination || '')) return;
    const label = item.find('.video-gallery-list-item-name').text().trim() || title;
    const style = item.find('[style*="background-image"]').attr('style') || '';
    const thumbnail = /url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(style)?.[1];
    item.replaceWith(`<figure><a href="${escapeText(destination)}">${thumbnail ? `<img src="${escapeText(thumbnail)}" alt="${escapeText(label)}">` : ''}<figcaption>${escapeText(label)}</figcaption></a></figure>`);
  });
  // Keep real background pictures as accessible images, discard source styling.
  $('[style*="background-image"]').each((_, node) => {
    const element = $(node);
    const picture = /background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(element.attr('style') || '')?.[1];
    if (picture && !element.find('img').length) {
      if (hasSnapshotMedia(picture, base)) element.prepend(`<img src="${escapeText(picture)}" alt="">`);
      else unavailableDecorativeMedia.add(new URL(picture, base).href);
    }
  });
  $('h1').each((_, node) => {
    if ($(node).text().trim() === title.trim()) $(node).remove();
    else node.tagName = 'h2';
  });
  $('b').each((_, node) => { node.tagName = 'strong'; });
  $('i').each((_, node) => { node.tagName = 'em'; });

  const elements = $('*').toArray();
  for (const node of elements) {
    const element = $(node);
    const tag = node.tagName.toLowerCase();
    if (!allowedTags.has(tag)) {
      element.replaceWith(element.html() || '');
      continue;
    }
    const attrs = { ...node.attribs };
    for (const name of Object.keys(attrs)) element.removeAttr(name);
    if (tag === 'a') {
      const href = attrs.href;
      if (href && /^(?:https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(href.trim())) {
        const absolute = href.startsWith('#') ? href : new URL(href, base).href;
        const parsed = new URL(href, base);
        const internal = parsed.hostname.replace(/^www\./, '') === 'nsp-center.ru';
        const normalized = siteUrl(absolute, base);
        if (internal && /\.(?:jpe?g|png|gif|webp|svg|pdf|docx?|xlsx?|txt)$/i.test(parsed.pathname)) {
          element.attr('href', localMedia(absolute, base));
        } else if (internal && !href.startsWith('#') && !sourceRouteSet.has(normalized.split('#')[0])) {
          unresolvedLinks.set(normalized, 'Source endpoint was not saved as a content page; imported as plain text.');
          element.replaceWith(element.html() || '');
          continue;
        } else {
          element.attr('href', normalized);
          if (!internal && /^https?:/i.test(normalized)) element.attr('rel', 'noopener noreferrer');
        }
      } else {
        element.replaceWith(element.html() || '');
        continue;
      }
      if (attrs.title) element.attr('title', attrs.title);
    } else if (tag === 'img') {
      const image = localMedia(attrs.src || attrs['data-src'], base);
      if (!image) { element.remove(); continue; }
      element.attr({ src: image, alt: attrs.alt || title || '', loading: 'lazy', decoding: 'async' });
      if (attrs.title) element.attr('title', attrs.title);
    } else if (tag === 'td' || tag === 'th') {
      for (const name of ['colspan', 'rowspan']) if (/^\d{1,2}$/.test(attrs[name] || '')) element.attr(name, attrs[name]);
      if (tag === 'th' && ['row', 'col', 'rowgroup', 'colgroup'].includes(attrs.scope)) element.attr('scope', attrs.scope);
    } else if (tag === 'ol' && /^\d{1,3}$/.test(attrs.start || '')) element.attr('start', attrs.start);
  }
  // Preserve block boundaries while discarding the source layout's class/id scaffolding.
  $('div').toArray().reverse().forEach(node => {
    const element = $(node);
    if (!element.text().trim() && !element.find('img,table,hr').length) { element.remove(); return; }
    if (!element.children().toArray().some(child => blockTags.has(child.tagName))) node.tagName = 'p';
    else element.replaceWith(element.html() || '');
  });
  $('span').each((_, node) => $(node).replaceWith($(node).html() || ''));
  $('p').filter((_, node) => !$(node).text().trim() && !$(node).find('img').length).remove();
  $.root().contents().add($('*').contents()).each((_, node) => { if (node.type === 'comment') $(node).remove(); });
  // The source call-back button opened a popup form that does not exist here; only its dead label survived.
  $('p, div, span, a').filter((_, node) => $(node).text().trim() === 'Заказать звонок').remove();
  return $.html().trim();
}

function fragmentStats(path, html) {
  const $ = load(html, null, false);
  const media = [...new Set($('img[src],a[href^="/media/"]').toArray().map(node => $(node).attr(node.tagName === 'img' ? 'src' : 'href')))];
  sourceContent.push({ path, characters: $.root().text().replace(/\s+/g, ' ').trim().length, media: media.length });
  return media;
}

const products = sourceProducts.map(product => {
  const path = siteUrl(product.url);
  const id = path.split('/').filter(Boolean).at(-1);
  const { $ } = rawPage(product.url);
  const sectionsHtml = {};
  $('.catalog-element-section').each((_, node) => {
    const section = $(node);
    const name = section.find('.catalog-element-section-name').first().text().trim() || '(без заголовка)';
    const content = section.find('.catalog-element-section-content').first();
    sectionsHtml[name] = semanticHtml(content.length ? content.html() : section.html(), product.url, product.name);
  });
  const images = product.images.map(image => localMedia(image));
  const categoryCrumb = product.breadcrumbs.filter(crumb => crumb.url && crumb.url.includes('/catalog/')).at(-1);
  const output = {
    ...product,
    url: path, id, path,
    breadcrumbs: product.breadcrumbs.map(crumb => ({ ...crumb, url: crumb.url ? siteUrl(crumb.url) : null })),
    categoryPath: categoryCrumb ? siteUrl(categoryCrumb.url) : null,
    image: images[0] || null, images,
    documents: product.documents.map(document => ({ ...document, url: document.url ? localMedia(document.url) : null })),
    related: product.related.map(url => siteUrl(url)),
    description: product.sections['Описание'] || '',
    descriptionHtml: sectionsHtml['Описание'] || '',
    sectionsHtml,
    prices: pricesFor(product, priceList),
    ...(productCopy.has(id) ? { copy: productCopy.get(id) } : {}),
  };
  fragmentStats(path, output.descriptionHtml);
  return output;
});

const categories = sourceCategories.map(category => {
  const path = siteUrl(category.url);
  const { $ } = rawPage(category.url);
  const description = $('[class*="catalog-section-description"], [class*="section-description"], .intec-ui-markup-text').first();
  return {
    ...category,
    id: path === '/catalog/' ? 'catalog' : path.split('/').filter(Boolean).at(-1),
    path, url: path,
    breadcrumbs: category.breadcrumbs.map(crumb => ({ ...crumb, url: crumb.url ? siteUrl(crumb.url) : null })),
    products: category.products.map(url => siteUrl(url)),
    parent: category.parent ? siteUrl(category.parent) : null,
    children: category.children.map(url => siteUrl(url)),
    pagination: category.pagination.map(url => siteUrl(url)),
    html: description.length ? semanticHtml(description.html(), category.url, category.name) : '',
  };
});

const articles = sourceArticles.map(article => {
  const path = siteUrl(article.url);
  const { $, page } = rawPage(article.url);
  const container = $('.news-detail-text').first();
  if (!container.length) throw new Error(`Missing article container ${article.url}`);
  const related = [...new Set(container.find('a[href]').toArray().map(node => siteUrl($(node).attr('href'), article.url)).filter(url => /^\/product\//.test(url)))];
  const html = semanticHtml(container.html(), article.url, article.title);
  const images = fragmentStats(path, html).filter(url => !/\.(?:pdf|docx?|xlsx?|txt)$/i.test(url));
  return {
    id: path.split('/').filter(Boolean).at(-1), path, url: path,
    title: article.title, date: article.date, description: $('.news-detail-text-preview').first().text().trim() || article.description,
    image: images[0] || null, images, html, body: html, related,
    source: provenance(page),
  };
});

const pages = sourcePages.filter(page => page.type === 'page').map(page => {
  const { $, raw } = rawPage(page.url);
  const path = siteUrl(page.url);
  const title = page.h1 || (path === '/health-marafon/' ? 'Марафон здоровья' : page.title.split('|')[0].trim());
  let html = semanticHtml(pageContainers($).map(node => $.html(node)).join('\n'), page.url, title);
  // Keep the imported delivery article in sync with the current checkout terms.
  if (path === '/delivery/') html = html.replace(/12(?:[\s\u00a0\u202f]|&nbsp;)*000/g, FREE_COURIER_FROM.toLocaleString('ru-RU'));
  const media = fragmentStats(path, html);
  return {
    id: path.split('/').filter(Boolean).join('-'), path, url: path, title,
    description: page.meta.description || null,
    html, body: html, media, emptySource: !raw.trim() || (!load(html, null, false).root().text().trim() && !media.length),
    source: provenance(page),
  };
});

const home = rawPage(`${origin}/`);
const homepageContainers = pageContainers(home.$).map(node => home.$.html(node));
const homepageBanner = home.$('.c-slider-template-5').first();
if (homepageBanner.length) homepageContainers.unshift(homepageBanner.html());
const homeHtml = semanticHtml(homepageContainers.join('\n'), `${origin}/`, 'NSP-Center');
const homeMedia = fragmentStats('/', homeHtml);
const site = {
  ...sourceSite,
  logo: sourceSite.logo ? localMedia(sourceSite.logo) : null,
  header_links: sourceSite.header_links.map(link => ({ ...link, url: siteUrl(link.url) })),
  footer_links: sourceSite.footer_links.map(link => ({ ...link, url: siteUrl(link.url) })),
  address: 'г. Санкт-Петербург, наб. Обводного канала д.64, корп.2, лит.А, помещ. 17H, оф. 29/3 (2-ой этаж)',
  homeHtml, homeMedia,
};

const routes = successfulPages.map(record => {
  const url = pathnameUrl(record.url);
  const parsed = new URL(record.url);
  const path = parsed.pathname;
  const metadata = sourceByUrl.get(record.url);
  let type, entity;
  if (path === '/') { type = 'home'; entity = { id: 'home', name: 'NSP-Center' }; }
  else if (path.startsWith('/product/')) { type = 'product'; entity = products.find(product => product.path === path); }
  else if (path.startsWith('/catalog/')) { type = 'category'; entity = categories.find(category => category.path === path); }
  else if (path === '/blog/') { type = 'blog'; entity = { id: 'blog', title: 'Блог о здоровье' }; }
  else if (path.startsWith('/blog/')) { type = 'article'; entity = articles.find(article => article.path === path); }
  else { type = 'page'; entity = pages.find(page => page.path === path); }
  if (!entity) throw new Error(`No content for source route ${url}`);
  const route = { url, path, type, id: entity.id, title: entity.title || entity.name, sourceUrl: record.url, canonicalPath: path };
  if (type === 'category') {
    const pageParameter = [...parsed.searchParams].find(([key]) => /^PAGEN_\d+$/.test(key));
    route.page = pageParameter ? Number(pageParameter[1]) : 1;
    route.products = [...new Set((metadata.links || []).map(link => siteUrl(link.url)).filter(link => /^\/product\//.test(link) && sourceRouteSet.has(link)))];
  }
  return route;
});

const content = {
  products, categories, articles, pages, site, routes, redirects,
  // The warehouse rate the rubles were computed with; the administrator may set another one at runtime (packages/presentation/site.ts).
  pricing: { rubPerUnit: priceList.rubPerUnit },
  themes: readThemes(),
  audit: {
    source: sourceAudit,
    sourcePages: successfulPages.length, routeCount: routes.length, copiedMedia: copied.size,
    externalMedia: [...externalMedia].sort(),
    unavailableDecorativeMedia: [...unavailableDecorativeMedia].sort().map(url => ({ url, reason: 'Decorative background image is referenced by source HTML but absent from the offline snapshot.' })),
    unresolvedInternalLinks: [...unresolvedLinks].map(([url, reason]) => ({ url, reason })).sort((a, b) => a.url.localeCompare(b.url)),
    emptySourcePages: pages.filter(page => page.emptySource).map(page => page.path),
    sourceContent,
  },
};
if (products.length !== 166 || categories.length !== 17 || articles.length !== 8 || routes.length !== 227 || pages.length !== 16) {
  throw new Error('Snapshot completeness invariants failed');
}
// Products added after the snapshot: their own routes, first in their category (its first page) and in the catalog.
for (const product of readNewProducts(priceList, categories)) {
  if (products.some(p => p.path === product.path || p.article === product.article)) throw new Error(`New product ${product.id} duplicates a catalog product`);
  products.push(product);
  routes.push({ url: product.path, path: product.path, type: 'product', id: product.id, title: product.name, sourceUrl: null, canonicalPath: product.path });
  const sections = product.category.split('/').map(name => categories.find(c => c.name === name));
  for (const category of sections) {
    category.products.unshift(product.path);
    const firstPage = routes.find(r => r.type === 'category' && r.path === category.path && r.page === 1);
    if (firstPage?.products) firstPage.products.unshift(product.path);
  }
}
// Stock checked with the NSP office (packages/catalog/source/product-stock.json): what the supplier has now, and lines no longer supplied.
// A discontinued product keeps its page (its address stays, marked noindex) but is hidden from the catalog, search and chat.
const stock = JSON.parse(readFileSync(new URL('../packages/catalog/source/product-stock.json', import.meta.url), 'utf8'));
for (const article of [...stock.inStock, ...stock.discontinued]) if (!products.some(product => product.article === article)) throw new Error(`Product stock: unknown article ${article}`);
for (const product of products) {
  if (stock.inStock.includes(product.article)) { product.availability = 'InStock'; product.availability_text = 'В наличии'; }
  if (stock.discontinued.includes(product.article)||(stock.hiddenIds??[]).includes(product.id)) { product.availability = 'OutOfStock'; product.availability_text = 'Нет в наличии'; product.hidden = true; }
}
// The pick-up point closes at 17:30 on Saturdays (checked with the office 2026-11-11); the snapshot's stock block said 18:00.
for (const product of products) for (const key of ['sections', 'sectionsHtml']) for (const [name, text] of Object.entries(product[key] ?? {})) if (typeof text === 'string') product[key][name] = text.replace(/Сб: с 12:00 до 18:00/g, 'Сб: с 12:00 до 17:30');
for (const product of products) if (productExperts.has(product.id)) product.experts = productExperts.get(product.id);
for (const id of productExperts.keys()) if (!products.some(product => product.id === id)) throw new Error(`Product experts: unknown product ${id}`);
for (const [setId, ids] of readSetContents()) {
  const set = products.find(product => product.id === setId);
  if (!set) throw new Error(`Set contents: unknown set ${setId}`);
  const parts = ids.map(id => products.find(product => product.id === id) ?? (() => { throw new Error(`Set contents ${setId}: unknown product ${id}`); })());
  set.setProducts = parts.map(part => part.id);
  // One comment per product keeps the tab readable (a set may hold a dozen products).
  const notes = parts.flatMap(part => (part.experts ?? []).slice(0, 1).map(note => ({ ...note, about: part.name.replace(/\s*\([^)]*\)/g, '').trim() })));
  if (!set.experts?.length && notes.length) set.experts = notes;
}
if (new Set(routes.map(route => route.url)).size !== routes.length) throw new Error('Duplicate imported routes');
for (const html of [...products.flatMap(product => Object.values(product.sectionsHtml)), ...articles.map(article => article.html), ...pages.map(page => page.html), homeHtml]) {
  const unsafe = /<(?:script|style|h1|iframe|form|input|button)\b|\son\w+=|\sstyle=/i.exec(html);
  if (unsafe) throw new Error(`Unsafe markup survived content import: ${html.slice(Math.max(0, unsafe.index - 60), unsafe.index + 180)}`);
}
mkdirSync(dirname(generated), { recursive: true });
writeFileSync(generated, JSON.stringify(content, null, 2) + '\n');
writeFileSync(resolve(dirname(generated), 'public.json'), JSON.stringify({...content, products:content.products.map(publicProduct)}));
console.log(`Imported ${products.length} products, ${categories.length} categories, ${articles.length} articles, ${pages.length} pages, ${routes.length} routes and ${copied.size} local media files.`);
console.log(`Source empty pages: ${content.audit.emptySourcePages.join(', ')}. External media: ${externalMedia.size}.`);

import { readProductBadges, validateProductBadges } from './product-badges.mjs';
// Product cards an administrator creates in site management (scripts/site-admin.mjs, table custom_products). The server
// keeps only the essentials — name, article, section, ruble prices and stock; the description, composition, certificates
// and photo are filled in afterwards in the same editor as every other card (table product_content). This module turns
// a stored card into the product object the pages read, the same way on the server and in the browser.

const LETTERS = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };

/** The address part of a new card from its name: «Крем для рук (Hand Cream)» -> «krem-dlya-ruk-hand-cream». */
export function slugOf(name) {
  const latin = [...String(name).toLowerCase()].map(ch => LETTERS[ch] ?? ch).join('');
  return latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'tovar';
}

/** A free address: the slug, or the slug with -2, -3… when it is taken. */
export function freeId(name, taken) {
  const base = slugOf(name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const rub = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 10_000_000 ? Math.round(n) : NaN;
};

/** What the creation form sends, checked: { value } or { error } in words for the administrator. */
export function validateNewProduct(input, categories) {
  if (!input || typeof input !== 'object') return { error: 'Нет данных карточки.' };
  const name = String(input.name ?? '').trim();
  if (name.length < 2 || name.length > 200) return { error: 'Название — от 2 до 200 знаков.' };
  const article = String(input.article ?? '').trim();
  if (article.length > 40) return { error: 'Артикул — не длиннее 40 знаков.' };
  const category = categories.find(c => c.path === input.categoryPath && c.path !== '/catalog/');
  if (!category) return { error: 'Выберите раздел каталога.' };
  const retailRub = rub(input.retailRub);
  if (!retailRub) return { error: 'Розничная цена — число больше нуля, например 1990.' };
  const partnerRub = rub(input.partnerRub);
  if (Number.isNaN(partnerRub)) return { error: 'Цена по карте — число больше нуля, или оставьте поле пустым.' };
  if (partnerRub !== null && partnerRub >= retailRub) return { error: 'Цена по карте должна быть ниже розничной.' };
  const badges = input.badges === undefined ? null : validateProductBadges(input.badges);
  if (badges?.error) return { error: badges.error };
  const availability = input.availability === 'OutOfStock' ? 'OutOfStock' : 'InStock';
  return { value: { name, article, categoryPath: category.path, retailRub, partnerRub, availability, ...(badges ? { badges: badges.value } : {}) } };
}

/** The sections a card shows up in: its own and the ones above it (not the whole catalog, which lists everything). */
export function sectionsOf(categoryPath, categories) {
  const out = [];
  for (let c = categories.find(x => x.path === categoryPath); c && c.path !== '/catalog/'; c = categories.find(x => x.path === c.parent)) out.unshift(c);
  return out;
}

/** The product object of a stored card. `withPartner` keeps the card price (only for /api/card-prices on the server). */
export function customProduct(id, data, categories, withPartner = false) {
  const sections = sectionsOf(data.categoryPath, categories);
  const own = sections.at(-1);
  const path = `/product/${id}/`;
  const inStock = data.availability !== 'OutOfStock';
  return {
    id, path, url: path, name: data.name, article: data.article || null,
    price: null, price_base: null, discount: null, currency: 'RUB',
    availability: inStock ? 'InStock' : 'OutOfStock', availability_text: inStock ? 'В наличии' : 'Нет в наличии',
    brand: null, category: sections.map(c => c.name).join('/') || null, categoryPath: own?.path ?? '/catalog/',
    breadcrumbs: [{ name: 'Главная', url: '/' }, ...sections.map(c => ({ name: c.name, url: c.path })), { name: data.name, url: null }],
    rating: null, review_count: 0, properties: {}, sections: {}, sectionsHtml: {}, description: '', descriptionHtml: '',
    image: null, images: [], documents: [], microdata_outside_product: [], related: [],
    prices: { retail: data.retailRub, partner: withPartner ? data.partnerRub ?? null : null, source: 'admin' },
    card: { kicker: own?.name ?? '', sub: '', parts: [], more: 0, notes: 0 },
    custom: true, badges: readProductBadges(data.badges),
  };
}

/** Puts the created cards into the lists the pages read (the catalog and its sections) and takes out deleted ones. */
export function mergeCustom(products, categories, extras) {
  for (let i = products.length - 1; i >= 0; i--) {
    const p = products[i];
    if (!p.custom || extras.some(e => e.id === p.id)) continue;
    products.splice(i, 1);
    for (const c of categories) c.products = c.products.filter(path => path !== p.path);
  }
  for (const e of extras) {
    if (products.some(p => p.id === e.id || p.path === e.path)) continue;
    products.unshift(e);
    for (const c of sectionsOf(e.categoryPath, categories)) if (!c.products.includes(e.path)) c.products.unshift(e.path);
  }
}

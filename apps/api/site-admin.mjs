import {CARD_APPLICATION_SCHEMA,cardApplicationRoute} from './card-applications.mjs';
import { KNOWLEDGE_SCHEMA, inheritedKnowledge, checkKnowledge, searchLectures, lectureContext, saveProductKnowledge } from './product-knowledge.mjs';
import {readManagedCatalog,managedCategoryList,catalogAdminState,saveManagedCatalog} from './catalog-admin.mjs';
import { validateProductBadges } from '../../packages/domain/product-badges.mjs';
import { ORDER_SCHEMA, orderAdminRoute } from './order-admin.mjs';
import { randomBytes } from 'node:crypto';
import { cardPricesFor, cardUnitsOf, publicSiteSettings } from '../../packages/domain/card-prices.mjs';
import { emailError } from '../../packages/domain/contact-fields.mjs';
import { customProduct, freeId, validateNewProduct } from '../../packages/domain/custom-product.mjs';
import { CONTENT_KINDS, HIDEABLE_KINDS, videoOf, articleOf, articleSlug, validateContent as validateSiteContent } from '../../packages/domain/site-content.mjs';
import { randomInt } from 'node:crypto';
/** 16 characters without look-alikes (no 0/O, 1/l/I): a staff member's first password, shown once. */
export const oneTimePassword = () => Array.from({ length: 16 }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(56)]).join('');
// Site management (the administrator's part of the profile) and customer reviews, on the accounts database
// (scripts/accounts.mjs routes /api/site, /api/reviews and /api/admin/* here).
//
// What an administrator changes is applied in the visitor's browser over the built site (src/site.ts): the warehouse
// rate (rubles per у.е.), a product's own prices and stock, hidden expert comments, and customer reviews (they appear
// only after approval). Every change is written to admin_log: who, what and when.
export const SITE_SCHEMA = `
alter table users add column if not exists role text not null default 'customer';
create table if not exists site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists product_overrides (
  product_id text primary key,
  retail_units numeric,
  partner_units numeric,
  retail_rub integer,
  partner_rub integer,
  availability text,
  updated_at timestamptz not null default now()
);
alter table product_overrides add column if not exists badges jsonb;
create table if not exists content_items (
  id bigserial primary key,
  kind text not null,
  slug text unique,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists content_hidden (
  kind text not null,
  key text not null,
  primary key (kind, key)
);
create table if not exists custom_products (
  product_id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists product_visibility (
  product_id text primary key,
  hidden boolean not null,
  updated_at timestamptz not null default now()
);
create table if not exists hidden_notes (
  product_id text not null,
  note_key text not null,
  primary key (product_id, note_key)
);
create table if not exists note_stars (
  product_id text not null,
  note_key text not null,
  rating integer not null check (rating between 1 and 5),
  primary key (product_id, note_key)
);
create table if not exists reviews (
  id bigserial primary key,
  product_id text not null,
  user_id bigint not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  text text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);
create index if not exists reviews_product_idx on reviews (product_id, status);
create table if not exists product_content (
  product_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists files (
  id text primary key,
  product_id text not null,
  kind text not null,
  name text not null,
  mime text not null,
  size integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create table if not exists chat_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  question text not null,
  answer text not null,
  products text not null default '',
  answered boolean not null default true
);
create index if not exists chat_log_at_idx on chat_log (at);
create table if not exists ai_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  ip_hash text not null,
  question text not null,
  answer text not null,
  products text not null default '',
  sources jsonb not null default '[]',
  flagged boolean not null default false,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0
);
create index if not exists ai_log_at_idx on ai_log (at);
create table if not exists admin_log (
  id bigserial primary key,
  user_id bigint references users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}',
  at timestamptz not null default now()
);` + ORDER_SCHEMA + KNOWLEDGE_SCHEMA + CARD_APPLICATION_SCHEMA;

const AVAILABILITY = new Set(['InStock', 'OutOfStock']);
// Uploads: photos and certificate scans only, as images (no SVG — it can carry scripts).
const UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD = 8 * 1024 * 1024;

/** A product's card content as built (scripts/serve.mjs passes content.json products): what the editor starts from. */
export function productBase(p) {
  if (!p) return null;
  return { name: p.name, about: p.copy?.about ?? [], highlights: p.copy?.highlights ?? [], description: p.description ?? '', properties: p.properties ?? {}, documents: (p.documents ?? []).filter(d => d.url).map(d => ({ name: d.name, url: d.url })) };
}
const localUrl = v => typeof v === 'string' && /^\/(api\/files|media|images)\/[\w./%-]+$/.test(v) && !v.includes('..');
const textList = (v, items, max) => Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, items).map(x => x.slice(0, max)) : undefined;
/** The administrator's card content: only what is set replaces the built card; anything malformed is an error. */
export function validateContent(c) {
  if (!c || typeof c !== 'object') return { error: 'Нет данных карточки.' };
  const out = {};
  if (c.name !== undefined) { const name = String(c.name).trim(); if (name.length < 2 || name.length > 200) return { error: 'Название — от 2 до 200 знаков.' }; out.name = name; }
  if (c.summary !== undefined) { if (typeof c.summary !== 'string' || c.summary.length > 300) return { error: 'Короткая строка — не больше 300 знаков.' }; out.summary=c.summary.trim(); }
  if (c.about !== undefined) out.about = textList(c.about, 20, 2000) ?? [];
  if (c.highlights !== undefined) out.highlights = textList(c.highlights, 20, 300) ?? [];
  if (c.properties !== undefined) {
    if (!c.properties || typeof c.properties !== 'object') return { error: 'Состав и применение заполнены неверно.' };
    out.properties = Object.fromEntries(Object.entries(c.properties).slice(0, 40).filter(([k, v]) => k.length <= 120 && typeof v === 'string').map(([k, v]) => [k, v.trim().slice(0, 6000)]));
  }
  if (c.documents !== undefined) {
    if (!Array.isArray(c.documents) || c.documents.length > 30 || c.documents.some(d => !localUrl(d?.url))) return { error: 'Сертификаты заполнены неверно.' };
    out.documents = c.documents.map(d => ({ name: String(d.name ?? '').slice(0, 160), url: d.url }));
  }
  if(c.photos!==undefined){if(!Array.isArray(c.photos)||!c.photos.length||c.photos.length>20||c.photos.some(u=>!localUrl(u)))return {error:'Добавьте от 1 до 20 фотографий товара.'};out.photos=[...new Set(c.photos)];out.image=out.photos[0]||'';}
  if(c.videos!==undefined){if(!Array.isArray(c.videos)||c.videos.length>20||c.videos.some(v=>!videoOf(v?.url)||typeof v.title!=='string'||!v.title.trim()||v.title.length>200))return {error:'Добавьте название и ссылку на VK Видео, Rutube или YouTube.'};out.videos=c.videos.map(v=>({url:videoOf(v.url).href,title:v.title.trim()}));}
  if (c.photos===undefined && c.image !== undefined && c.image !== null) { if (!localUrl(c.image)) return { error: 'Фото заполнено неверно.' }; out.image = c.image; }
  return { value: out };
}
const REVIEW_STATUS = new Set(['pending', 'published', 'hidden']);
/** A price in у.е. or rubles from the form: empty means «as in the price list» (null); otherwise a positive number. */
const amount = (v, max, integer) => {
  if (v === null || v === undefined || v === '') return { value: null };
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > max) return { error: true };
  return { value: integer ? Math.round(n) : Math.round(n * 100) / 100 };
};
const num = v => v === null ? null : Number(v);
const authorName = row => `${row.first_name} ${row.last_name ? row.last_name[0] + '.' : ''}`.trim();

/** Today's official dollar rate of the Bank of Russia, as a hint next to the warehouse rate; kept for an hour; null when
 *  cbr.ru does not answer within 4 seconds. */
let cbrCache = { at: 0, value: null };
export async function cbrUsd() {
  if (Date.now() - cbrCache.at < 3600_000) return cbrCache.value;
  try {
    const r = await fetch('https://www.cbr.ru/scripts/XML_daily.asp', { signal: AbortSignal.timeout(4000) });
    const xml = new TextDecoder('windows-1251').decode(await r.arrayBuffer());
    const date = xml.match(/<ValCurs Date="(\d\d)\.(\d\d)\.(\d{4})"/);
    const usd = xml.match(/<CharCode>USD<\/CharCode>\s*<Nominal>(\d+)<\/Nominal>[\s\S]*?<Value>([\d,]+)<\/Value>/);
    cbrCache = { at: Date.now(), value: date && usd ? { rubPerUsd: Math.round(Number(usd[2].replace(',', '.')) / Number(usd[1]) * 100) / 100, date: `${date[3]}-${date[2]}-${date[1]}` } : null };
  } catch { cbrCache = { at: Date.now() - 3300_000, value: null }; }
  return cbrCache.value;
}

/** Cards created in site management, oldest first. */
export const customRows = async pool => (await pool.query('select product_id, data from custom_products order by created_at')).rows;
/** One created card as a product (for the server's page shell and sitemap), or null. */
export async function findCustomProduct(pool, id, categories) {
  const { rows } = await pool.query('select product_id, data from custom_products where product_id = $1', [id]);
  const catalog=await readManagedCatalog(pool,categories);
  return rows[0] ? customProduct(rows[0].product_id, {...rows[0].data,categoryPath:catalog.assignments[id]??rows[0].data.categoryPath}, categories) : null;
}

/** Public settings every page applies: the rate, product overrides and hidden expert comments. */
export async function siteSettings(pool, categories = [], productPaths = new Map()) {
  const catalog=await readManagedCatalog(pool,categories);
  const catalogCategories=await managedCategoryList(pool,categories);
  const [{ rows: rate }, { rows: products }, { rows: notes }, { rows: cards }, { rows: ratings }, { rows: stars }, { rows: visibility }, custom, { rows: items }, { rows: hiddenItems }, { rows: knowledge }] = await Promise.all([
    pool.query("select value, updated_at from site_settings where key = 'rate'"),
    pool.query('select * from product_overrides'),
    pool.query('select product_id, note_key from hidden_notes'),
    pool.query("select product_id, data->>'name' as name, data->>'image' as image, data->>'summary' as summary, data->'properties'->>'Объём' as package from product_content"),
    pool.query("select product_id, sum(rating)::int as sum, count(*)::int as count from reviews where status = 'published' group by product_id"),
    pool.query('select product_id, note_key, rating from note_stars'),
    pool.query('select product_id, hidden from product_visibility'),
    customRows(pool),
    pool.query('select id, kind, slug, data, created_at from content_items order by created_at desc, id desc'),
    pool.query('select kind, key from content_hidden'),
    pool.query('select product_id,data from product_knowledge'),
  ]);
  const hiddenNotes = {};
  for (const n of notes) (hiddenNotes[n.product_id] ??= []).push(n.note_key);
  return {
    catalog,
    rate: rate[0] ? { rubPerUnit: Number(rate[0].value.rubPerUnit), updatedAt: rate[0].updated_at } : null,
    products: Object.fromEntries(products.map(p => [p.product_id, { retailUnits: num(p.retail_units), partnerUnits: num(p.partner_units), retailRub: p.retail_rub, partnerRub: p.partner_rub, availability: p.availability, ...(p.badges ? { badges: p.badges } : {}) }])),
    knowledge: Object.fromEntries(knowledge.map(r=>[r.product_id,r.data])),
    hiddenNotes,
    // Shown or hidden from customers by an administrator; a product not listed here is as built (src/product-stock.json).
    visibility: Object.fromEntries(visibility.map(v => [v.product_id, v.hidden])),
    // Cards created in site management, without their card price (src/custom-product.mjs).
    extraProducts: custom.map(r => customProduct(r.product_id, {...r.data,categoryPath:catalog.assignments[r.product_id]??r.data.categoryPath}, catalogCategories)),
    // «Контент» in site management: offers, photos, videos, articles and FAQ answers (src/site-content.mjs), newest
    // first, and the old site's videos, articles and answers an administrator hid.
    content: {
      promos: items.filter(i => i.kind === 'promo').map(i => ({ id: Number(i.id), ...i.data })),
      photos: items.filter(i => i.kind === 'photo').map(i => ({ id: Number(i.id), ...i.data })),
      videos: items.filter(i => i.kind === 'video').map(i => ({ id: Number(i.id), ...i.data })),
      faq: items.filter(i => i.kind === 'faq').map(i => ({ id: Number(i.id), ...i.data })).reverse(),
      articles: items.filter(i => i.kind === 'article').map(i => ({ ...articleOf(i, new Map([...productPaths, ...custom.map(r => [r.product_id, `/product/${r.product_id}/`])])), contentId: Number(i.id), data: i.data })),
    },
    hiddenContent: Object.fromEntries(HIDEABLE_KINDS.map(kind => [kind, hiddenItems.filter(h => h.kind === kind).map(h => h.key)])),
    // Stars of published customer reviews, added to the old site's rating on every card and product page.
    ratings: Object.fromEntries(ratings.map(r => [r.product_id, { sum: r.sum, count: r.count }])),
    // Stars of expert comments that differ from the default five (set by the administrator on the product page).
    noteStars: stars.reduce((all, s) => ({ ...all, [s.product_id]: { ...all[s.product_id], [s.note_key]: s.rating } }), {}),
    // A card's own name and photo (the rest of the content is fetched on the product's page: /api/product-content).
    cards: Object.fromEntries(cards.map(c => [c.product_id, { ...(c.name ? { name: c.name } : {}), ...(typeof c.image==='string' ? { image: c.image } : {}), ...(typeof c.summary==='string'?{summary:c.summary}:{}), ...(typeof c.package==='string'?{package:c.package}:{}) }]).filter(([, c]) => Object.keys(c).length)),
  };
}

/**
 * Handles /api/site, /api/reviews and /api/admin/*; returns false for other paths.
 * `ctx`: pool, send, readJson, sessionUser(req), productIds (Set of known product ids, or null to accept any).
 */
const chatLogRate = new Map();
export async function siteRoute(ctx, req, res, path, url) {
  const { pool, send, readJson, sessionUser, staffUser, productIds } = ctx;
  const method = req.method;
  if(await cardApplicationRoute(ctx,req,res,path,url))return true;
  const builtProduct = id => typeof id === 'string' && (!productIds || productIds.has(id));
  // A product of the build, or a card created in site management.
  const knownProduct = async id => builtProduct(id) || (typeof id === 'string' && (await pool.query('select 1 from custom_products where product_id = $1', [id])).rowCount > 0);
  const log = (user, action, detail) => pool.query('insert into admin_log (user_id, action, detail) values ($1, $2, $3)', [user.id, action, JSON.stringify(detail)]);

  // Card prices are not public: /api/site gives them (the administrator's card price fields) to administrators only,
  // and /api/card-prices gives the card prices to a signed-in account with a discount card number (scripts/card-prices.mjs).
  if (path === '/api/site' && method === 'GET') {
    const [settings, staff] = await Promise.all([siteSettings(pool, ctx.categories, ctx.productPaths), staffUser(req)]);
    send(res, 200, staff ? settings : publicSiteSettings(settings), { 'Cache-Control': 'no-store' });
    return true;
  }
  if (path === '/api/card-prices' && method === 'GET') {
    const [customer, staff] = await Promise.all([sessionUser(req), staffUser(req)]);
    const user = staff ?? customer;
    const headers = { 'Cache-Control': 'private, no-store' };
    if (!user) { send(res, 401, { error: 'Войдите в аккаунт, чтобы видеть цены по дисконтной карте.' }, headers); return true; }
    const admin = Boolean(staff);
    if (!admin && !String(user.partner_id ?? '').trim()) { send(res, 403, { error: 'Укажите номер дисконтной карты в профиле.' }, headers); return true; }
    const products = [...(ctx.cardProducts ?? []), ...(await customRows(pool)).map(r => customProduct(r.product_id, r.data, ctx.categories ?? [], true))];
    send(res, 200, { prices: cardPricesFor(products, await siteSettings(pool, ctx.categories, ctx.productPaths), ctx.buildRate), ...(admin ? { units: cardUnitsOf(products) } : {}) }, headers);
    return true;
  }

  if (path === '/api/product-content' && method === 'GET') {
    const id = url.searchParams.get('id');
    if (!(await knownProduct(id))) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    const { rows } = await pool.query('select data from product_content where product_id = $1', [id]);
    // A created card starts empty: its name is the base, everything else is filled in the editor.
    const created = ctx.productBase?.(id) ? null : (await pool.query('select data from custom_products where product_id = $1', [id])).rows[0]?.data;
    send(res, 200, { content: rows[0]?.data ?? null, base: ctx.productBase?.(id) ?? (created ? productBase({ name: created.name }) : null) });
    return true;
  }
  if (path.startsWith('/api/files/') && method === 'GET') {
    const id = path.slice('/api/files/'.length);
    const { rows } = /^[a-f0-9]{32}$/.test(id) ? await pool.query('select mime, data from files where id = $1', [id]) : { rows: [] };
    if (!rows[0]) { send(res, 404, { error: 'Нет такого файла.' }); return true; }
    res.writeHead(200, { 'Content-Type': rows[0].mime, 'Content-Length': rows[0].data.length, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
    res.end(req.method === 'HEAD' ? undefined : rows[0].data);
    return true;
  }
  if (path === '/api/reviews' && method === 'GET') {
    const product = url.searchParams.get('product');
    if (!(await knownProduct(product))) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    const { rows } = await pool.query("select r.id, r.rating, r.text, r.created_at, u.first_name, u.last_name from reviews r join users u on u.id = r.user_id where r.product_id = $1 and r.status = 'published' order by r.created_at desc limit 200", [product]);
    send(res, 200, { reviews: rows.map(r => ({ id: Number(r.id), rating: r.rating, text: r.text, date: r.created_at, author: authorName(r) })) });
    return true;
  }
  // Every question of the site chat and its answer (src/assistant.tsx), for «Чат-консультант» in site management: no
  // name, email or address of the visitor is kept, entries live 90 days, a visitor may log at most 60 questions an hour.
  if (path === '/api/chat-log' && method === 'POST') {
    const body = await readJson(req);
    const question = typeof body?.question === 'string' ? body.question.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
    const answer = typeof body?.answer === 'string' ? body.answer.trim().slice(0, 2000) : '';
    if (!question || !answer) { send(res, 400, { error: 'Нет вопроса.' }); return true; }
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
    const hour = Math.floor(Date.now() / 3_600_000);
    const seen = chatLogRate.get(ip);
    const count = seen?.hour === hour ? seen.count : 0;
    if (count >= 60) { send(res, 429, { error: 'Слишком много вопросов.' }); return true; }
    chatLogRate.set(ip, { hour, count: count + 1 });
    if (chatLogRate.size > 5000) for (const [k, v] of chatLogRate) if (v.hour !== hour) chatLogRate.delete(k);
    const products = Array.isArray(body?.products) ? body.products.filter(id => typeof id === 'string' && /^[\w-]{1,120}$/.test(id)).slice(0, 8).join(',') : '';
    if (Math.random() < 0.02) await pool.query("delete from chat_log where at < now() - interval '90 days'");
    await pool.query('insert into chat_log (question, answer, products, answered) values ($1, $2, $3, $4)', [question, answer, products, body?.answered !== false]);
    send(res, 201, { ok: true });
    return true;
  }
  if (path === '/api/reviews' && method === 'POST') {
    const user = await sessionUser(req);
    if (!user) { send(res, 401, { error: 'Войдите в аккаунт, чтобы оставить отзыв.' }); return true; }
    const body = await readJson(req);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const rating = Number(body?.rating);
    if (!(await knownProduct(body?.productId))) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { send(res, 400, { error: 'Поставьте оценку от 1 до 5.' }); return true; }
    if (text.length < 2 || text.length > 2000) { send(res, 400, { error: 'Напишите отзыв: от 2 до 2000 знаков.' }); return true; }
    const { rows: [{ count }] } = await pool.query("select count(*)::int as count from reviews where user_id = $1 and created_at > now() - interval '1 day'", [user.id]);
    if (count >= 10) { send(res, 429, { error: 'Сегодня вы уже оставили много отзывов. Попробуйте завтра.' }); return true; }
    await pool.query('insert into reviews (product_id, user_id, rating, text) values ($1, $2, $3, $4)', [body.productId, user.id, rating, text]);
    send(res, 201, { status: 'pending' });
    return true;
  }

  if (!path.startsWith('/api/admin/')) return false;
  // Site management: only a signed-in member of staff (its own cookie, scripts/accounts.mjs staffUser).
  const user = await staffUser(req);
  if (!user) { send(res, 401, { error: 'Войдите в управление сайтом.' }); return true; }

  // Full built data for staff previews; never fetch rendered customer HTML.
  if(path==='/api/admin/preview-data'){
    if(method!=='GET'){send(res,405,{error:'Метод не поддерживается.'});return true;}
    const id=url.searchParams.get('product'),pagePath=url.searchParams.get('page');
    const product=id?(ctx.cardProducts??[]).find(p=>p.id===id):null;
    const page=pagePath?(ctx.previewPages??[]).find(p=>p.path===pagePath):null;
    if(!product&&!page){send(res,404,{error:'Материал не найден.'});return true;}
    send(res,200,product?{product}:{page},{'Cache-Control':'no-store'});return true;
  }

  if (await orderAdminRoute(ctx, req, res, path, url, user)) return true;
  if(path==='/api/admin/categories'){
    if(method==='GET'){const state=await catalogAdminState(pool,ctx.categories,ctx.cardProducts??[]);send(res,200,{catalog:state.config,categories:state.categories,products:state.products.map(p=>({id:p.id,name:p.name,categoryPath:p.categoryPath,hidden:p.hidden,availability:p.availability}))});return true;}
    if(method!=='PUT'){send(res,405,{error:'Метод не поддерживается.'});return true;}
    const result=await saveManagedCatalog(ctx,user,await readJson(req));
    if(result.error)send(res,result.status??400,{error:result.error});else send(res,200,await siteSettings(pool,ctx.categories,ctx.productPaths));
    return true;
  }

  if(path==='/api/admin/knowledge-search'&&method==='GET'){send(res,200,await searchLectures(pool,url.searchParams.get('q'),url.searchParams.get('page')));return true;}
  if(path==='/api/admin/knowledge'&&method==='GET'){
    const q=String(url.searchParams.get('q')??'').trim().slice(0,120);
    const lectureId=url.searchParams.get('lecture');
    if(lectureId){const lecture=await lectureContext(pool,lectureId,url.searchParams.get('q'));send(res,lecture?200:404,lecture??{error:'Лекция не найдена.'});return true;}
    const sourceId=url.searchParams.get('source');
    if(sourceId){const {rows}=await pool.query('select id,name,article,data from knowledge_products where id=$1',[sourceId]);send(res,rows[0]?200:404,rows[0]??{error:'Материалы товара не найдены.'});return true;}
    const productId=url.searchParams.get('product');
    const [products,lectures,saved,counts]=await Promise.all([
      pool.query('select id,name,article from knowledge_products where name ilike $1 or article ilike $1 order by name limit 200',['%'+q+'%']),
      pool.query('select id,course,lecture,speaker from knowledge_lectures where lecture ilike $1 or speaker ilike $1 order by lecture limit 100',['%'+q+'%']),
      productId?pool.query('select data from product_knowledge where product_id=$1 union all select data from knowledge_products where id=$1 limit 1',[productId]):Promise.resolve({rows:[]}),
      pool.query('select (select count(*)::int from knowledge_products) as products,(select count(*)::int from knowledge_lectures) as lectures')
    ]);send(res,200,{products:products.rows,lectures:lectures.rows,knowledge:saved.rows[0]?.data??null,counts:counts.rows[0]});return true;
  }
  // How many reviews wait for approval: the administrator's profile and bell show it.
  if (path === '/api/admin/pending' && method === 'GET') {
    const { rows: [{ count }] } = await pool.query("select count(*)::int as count from reviews where status = 'pending'");
    send(res, 200, { reviews: count });
    return true;
  }
  // The consultation agent's questions of the last 30 days (scripts/ai-agent.mjs), newest first, with the month's tokens.
  if (path === '/api/admin/chat-log' && method === 'GET') {
    const unanswered = url.searchParams.get('filter') === 'unanswered';
    const [{ rows: entries }, { rows: [counts] }] = await Promise.all([
      pool.query(`select at, question, answer, products, answered from chat_log where at >= now() - interval '90 days'${unanswered ? ' and not answered' : ''} order by at desc limit 300`),
      pool.query(`select count(*) filter (where at >= date_trunc('day', now()))::int as today, count(*) filter (where at >= now() - interval '7 days')::int as week,
        count(*) filter (where at >= now() - interval '30 days')::int as month, count(*) filter (where not answered and at >= now() - interval '30 days')::int as unanswered from chat_log`),
    ]);
    send(res, 200, { counts, entries });
    return true;
  }
  if (path === '/api/admin/ai-log' && method === 'GET') {
    const [{ rows }, { rows: [m] }] = await Promise.all([
      pool.query('select at, question, answer, products, sources, flagged from ai_log order by at desc limit 100'),
      pool.query("select count(*)::int as questions, coalesce(sum(input_tokens + output_tokens), 0)::bigint as tokens from ai_log where at >= date_trunc('month', now())"),
    ]);
    send(res, 200, { month: { questions: m.questions, tokens: Number(m.tokens) }, entries: rows });
    return true;
  }
  if (path === '/api/admin/overview' && method === 'GET') {
    const [settings, { rows: history }, { rows: reviews }, { rows: users }, cbr] = await Promise.all([
      siteSettings(pool, ctx.categories, ctx.productPaths),
      pool.query("select l.detail, l.at, u.email from admin_log l left join users u on u.id = l.user_id where l.action = 'rate' order by l.at desc limit 30"),
      pool.query('select r.*, u.email, u.first_name, u.last_name from reviews r join users u on u.id = r.user_id order by (r.status = \'pending\') desc, r.created_at desc limit 500'),
      pool.query("select email, first_name, last_name, role, created_at, (select max(at) from admin_log l where l.user_id = users.id and l.action = 'login') as last_login from users where role = 'admin' order by created_at"),
      ctx.cbr === false ? null : cbrUsd(),
    ]);
    send(res, 200, {
      ...settings,
      cbr,
      rateHistory: history.map(h => ({ rubPerUnit: Number(h.detail.rubPerUnit), from: h.detail.from === null || h.detail.from === undefined ? null : Number(h.detail.from), at: h.at, by: h.email })),
      reviews: reviews.map(r => ({ id: Number(r.id), productId: r.product_id, rating: r.rating, text: r.text, status: r.status, date: r.created_at, author: authorName(r), email: r.email })),
      staff: users.map(u => ({ email: u.email, name: `${u.first_name} ${u.last_name}`.trim(), createdAt: u.created_at, lastLogin: u.last_login })),
      cardApplications: (await pool.query("select count(*)::int as n from card_applications where status in ('pending','processing')")).rows[0].n,
      customers: Number((await pool.query("select count(*)::int as n from users where role = 'customer'")).rows[0].n),
    });
    return true;
  }
  if (path === '/api/admin/upload' && method === 'POST') {
    const product = url.searchParams.get('product'), kind = url.searchParams.get('kind');
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim();
    // «content»: a photo of the gallery, an offer or an article cover (no product behind it).
    if ((product !== 'content' && !(await knownProduct(product))) || !['image', 'document'].includes(kind)) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    if (!UPLOAD_TYPES.has(mime)) { send(res, 415, { error: 'Загрузите картинку: JPG, PNG или WEBP.' }); return true; }
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > MAX_UPLOAD) { send(res, 413, { error: 'Файл больше 8 МБ.' }); return true; } chunks.push(chunk); }
    if (!size) { send(res, 400, { error: 'Пустой файл.' }); return true; }
    const id = randomBytes(16).toString('hex');
    const name = String(url.searchParams.get('name') || 'файл').slice(0, 160);
    await pool.query('insert into files (id, product_id, kind, name, mime, size, data) values ($1, $2, $3, $4, $5, $6, $7)', [id, product, kind, name, mime, size, Buffer.concat(chunks)]);
    await log(user, 'upload', { productId: product, kind, id, name, size });
    send(res, 201, { url: `/api/files/${id}`, name });
    return true;
  }
  if (method !== 'PUT') { send(res, 404, { error: 'Нет такого адреса.' }); return true; }
  const body = await readJson(req);
  if (path === '/api/admin/content') {
    if (!(await knownProduct(body?.productId))) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    if (body.reset === true) await pool.query('delete from product_content where product_id = $1', [body.productId]);
    else {
      const checked = validateContent(body.content);
      if (checked.error) { send(res, 400, { error: checked.error }); return true; }
      await pool.query('insert into product_content (product_id, data, updated_at) values ($1, $2, now()) on conflict (product_id) do update set data = product_content.data || excluded.data, updated_at = now()', [body.productId, JSON.stringify(checked.value)]);
    }
    await log(user, body.reset === true ? 'content-reset' : 'content', { productId: body.productId });
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }

  if(path==='/api/admin/product-knowledge'){
    if(!(await knownProduct(body?.productId))){send(res,400,{error:'Нет такого товара.'});return true;}
    const content=body.content===undefined?{value:{}}:validateContent(body.content);
    if(content.error){send(res,400,{error:content.error});return true;}
    const input=body.sourceProductId?await inheritedKnowledge(pool,{knowledgeSourceId:body.sourceProductId}):body.knowledge;
    const checked=input===null&&body.content?{value:null}:await checkKnowledge(pool,input,id=>id!==body.productId&&knownProduct(id));
    if(checked.error){send(res,400,{error:checked.error});return true;}
    await saveProductKnowledge(pool,body.productId,checked.value,content.value);
    await log(user,'product-knowledge',{productId:body.productId,sources:checked.value?.sources.map(s=>s.id)??[]});
    send(res,200,await siteSettings(pool,ctx.categories,ctx.productPaths));return true;
  }
  if (path === '/api/admin/rate') {
    const rate = amount(body?.rubPerUnit, 1000, false);
    if (rate.error || rate.value === null) { send(res, 400, { error: 'Курс — число больше нуля, например 94 или 94,5.' }); return true; }
    const { rows: before } = await pool.query("select value from site_settings where key = 'rate'");
    await pool.query("insert into site_settings (key, value, updated_at) values ('rate', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify({ rubPerUnit: rate.value })]);
    await log(user, 'rate', { rubPerUnit: rate.value, from: before[0] ? Number(before[0].value.rubPerUnit) : (Number(body?.previous) || null) });
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }
  if (path === '/api/admin/product') {
    if (!(await knownProduct(body?.productId))) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    if (body.reset === true) {
      await pool.query('delete from product_overrides where product_id = $1', [body.productId]);
      await log(user, 'product-reset', { productId: body.productId });
      send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
      return true;
    }
    const badges = body.badges === undefined ? null : validateProductBadges(body.badges);
    if (badges?.error) { send(res, 400, { error: badges.error }); return true; }
    const fields = { retailUnits: amount(body.retailUnits, 100000, false), partnerUnits: amount(body.partnerUnits, 100000, false), retailRub: amount(body.retailRub, 10000000, true), partnerRub: amount(body.partnerRub, 10000000, true) };
    if (Object.values(fields).some(f => f.error)) { send(res, 400, { error: 'Цена — число больше нуля. Пустое поле — цена из прайса.' }); return true; }
    const availability = body.availability === null || body.availability === undefined || body.availability === '' ? null : body.availability;
    if (availability !== null && !AVAILABILITY.has(availability)) { send(res, 400, { error: 'Наличие: «в наличии» или «нет в наличии».' }); return true; }
    const v = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value]));
    await pool.query(`insert into product_overrides (product_id, retail_units, partner_units, retail_rub, partner_rub, availability, badges, updated_at) values ($1, $2, $3, $4, $5, $6, $7, now())
      on conflict (product_id) do update set retail_units = excluded.retail_units, partner_units = excluded.partner_units, retail_rub = excluded.retail_rub, partner_rub = excluded.partner_rub, availability = excluded.availability, badges = coalesce(excluded.badges, product_overrides.badges), updated_at = now()`,
      [body.productId, v.retailUnits, v.partnerUnits, v.retailRub, v.partnerRub, availability, badges ? JSON.stringify(badges.value) : null]);
    await log(user, 'product', { productId: body.productId, ...v, availability, ...(badges ? { badges: badges.value } : {}) });
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }
  if (path === '/api/admin/site-content') {
    const kind = body?.kind;
    if (!CONTENT_KINDS.includes(kind)) { send(res, 400, { error: 'Нет такого раздела.' }); return true; }
    const action = body?.action;
    if (action === 'hide' || action === 'show') {
      const key = typeof body?.key === 'string' ? body.key.slice(0, 300) : '';
      if (!HIDEABLE_KINDS.includes(kind) || !key) { send(res, 400, { error: 'Нечего скрыть.' }); return true; }
      if (action === 'hide') await pool.query('insert into content_hidden (kind, key) values ($1, $2) on conflict do nothing', [kind, key]);
      else await pool.query('delete from content_hidden where kind = $1 and key = $2', [kind, key]);
      await log(user, `content-${action}`, { kind, key });
    } else if (action === 'delete') {
      const { rows: gone } = await pool.query('delete from content_items where id = $1 and kind = $2 returning data', [Number(body?.id) || 0, kind]);
      if (!gone.length) { send(res, 400, { error: 'Такой записи уже нет.' }); return true; }
      // Its uploaded photo (gallery photo, offer picture, article cover) goes with it.
      const files = [gone[0].data.image, gone[0].data.cover].map(v => /^\/api\/files\/([a-f0-9]{32})$/.exec(v ?? '')?.[1]).filter(Boolean);
      if (files.length) await pool.query("delete from files where product_id = 'content' and id = any($1)", [files]);
      await log(user, 'content-delete', { kind, id: Number(body.id) });
    } else if (action === 'add' || action === 'update') {
      const contentProductIds = productIds ? new Set([...productIds, ...(await customRows(pool)).map(r => r.product_id)]) : null;
      const checked = validateSiteContent(kind, body?.item, { productIds: contentProductIds });
      if (checked.error) { send(res, 400, { error: checked.error }); return true; }
      if (action === 'update') {
        const { rowCount } = await pool.query('update content_items set data = $3, updated_at = now() where id = $1 and kind = $2', [Number(body?.id) || 0, kind, JSON.stringify(checked.value)]);
        if (!rowCount) { send(res, 400, { error: 'Такой записи уже нет.' }); return true; }
      } else {
        let slug = null;
        if (kind === 'article') {
          const taken = new Set([...(await pool.query("select slug from content_items where slug is not null")).rows.map(r => r.slug), ...[...(ctx.articlePaths ?? [])].map(p => p.split('/')[2])]);
          slug = articleSlug(checked.value.title, taken);
        }
        await pool.query('insert into content_items (kind, slug, data) values ($1, $2, $3)', [kind, slug, JSON.stringify(checked.value)]);
      }
      await log(user, `content-${action}`, { kind, id: Number(body?.id) || null, title: checked.value.title ?? checked.value.q ?? checked.value.caption ?? '' });
    } else { send(res, 400, { error: 'Неизвестное действие.' }); return true; }
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }
  if (path === '/api/admin/new-product') {
    const checked = validateNewProduct(body?.product, await managedCategoryList(pool,ctx.categories??[]));
    if (checked.error) { send(res, 400, { error: checked.error }); return true; }
    const taken = new Set([...(productIds ?? []), ...(await customRows(pool)).map(r => r.product_id)]);
    if (checked.value.article && (ctx.cardProducts ?? []).some(p => p.article === checked.value.article)) { send(res, 400, { error: 'Товар с таким артикулом уже есть в каталоге — найдите его в списке выше.' }); return true; }
    const id = freeId(checked.value.name, taken);
    if(body.product?.knowledgeSourceId&&typeof body.product.knowledgeSourceId!=='string'){send(res,400,{error:'Выберите источник из базы лекций.'});return true;}
    let knowledge=await inheritedKnowledge(pool,{knowledgeSourceId:body.product?.knowledgeSourceId,name:checked.value.name,article:checked.value.article});
    if(body.product?.knowledgeSourceId&&!knowledge){send(res,400,{error:'Материалы товара в базе лекций не найдены.'});return true;}
    if(body.knowledge!==undefined){const draft=await checkKnowledge(pool,body.knowledge,pid=>pid!==id&&knownProduct(pid));if(draft.error){send(res,400,{error:draft.error});return true;}knowledge=draft.value;}
    const checkedContent=body.content===undefined?{value:{}}:validateContent(body.content);
    if(checkedContent.error){send(res,400,{error:checkedContent.error});return true;}
    if(!checkedContent.value.image){send(res,400,{error:'Добавьте хотя бы одно фото товара.'});return true;}
    const content={...checkedContent.value,...(knowledge?{about:knowledge.about,highlights:knowledge.highlights}:{})};
    const client=await pool.connect();
    try{
      await client.query('begin');
      await client.query('insert into custom_products (product_id, data) values ($1, $2)', [id, JSON.stringify(checked.value)]);
      if(knowledge)await client.query('insert into product_knowledge(product_id,data) values($1,$2)',[id,JSON.stringify(knowledge)]);
      if(Object.keys(content).length)await client.query('insert into product_content(product_id,data) values($1,$2)',[id,JSON.stringify(content)]);
      await client.query('insert into product_visibility (product_id, hidden) values ($1, $2)',[id,body.publish!==true]);
      await client.query('commit');
    }catch(error){await client.query('rollback');throw error}finally{client.release()}
    await log(user, 'product-create', { productId: id, ...checked.value });
    send(res, 200, { id, ...(await siteSettings(pool, ctx.categories, ctx.productPaths)) });
    return true;
  }
  if (path === '/api/admin/delete-product') {
    const { rowCount } = typeof body?.productId === 'string' ? await pool.query('delete from custom_products where product_id = $1', [body.productId]) : { rowCount: 0 };
    if (!rowCount) { send(res, 400, { error: 'Удалить можно только карточку, созданную в управлении сайтом.' }); return true; }
    for (const table of ['product_knowledge', 'product_visibility', 'product_overrides', 'product_content', 'hidden_notes', 'note_stars', 'files', 'reviews']) await pool.query(`delete from ${table} where product_id = $1`, [body.productId]);
    await log(user, 'product-delete', { productId: body.productId });
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }
  if (path === '/api/admin/visibility') {
    if (!(await knownProduct(body?.productId)) || typeof body?.hidden !== 'boolean') { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    await pool.query(`insert into product_visibility (product_id, hidden, updated_at) values ($1, $2, now())
      on conflict (product_id) do update set hidden = excluded.hidden, updated_at = now()`, [body.productId, body.hidden]);
    await log(user, body.hidden ? 'product-hide' : 'product-show', { productId: body.productId });
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }
  if (path === '/api/admin/note') {
    if (!(await knownProduct(body?.productId)) || typeof body?.key !== 'string' || !body.key || body.key.length > 400) { send(res, 400, { error: 'Нет такого комментария.' }); return true; }
    if (body.hidden === true) await pool.query('insert into hidden_notes (product_id, note_key) values ($1, $2) on conflict do nothing', [body.productId, body.key]);
    else await pool.query('delete from hidden_notes where product_id = $1 and note_key = $2', [body.productId, body.key]);
    await log(user, body.hidden === true ? 'note-hide' : 'note-show', { productId: body.productId, key: body.key });
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }
  if (path === '/api/admin/note-stars') {
    const rating = Number(body?.rating);
    if (!(await knownProduct(body?.productId)) || typeof body?.key !== 'string' || !body.key || body.key.length > 400 || !Number.isInteger(rating) || rating < 1 || rating > 5) { send(res, 400, { error: 'Оценка — от 1 до 5 звёзд.' }); return true; }
    if (rating === 5) await pool.query('delete from note_stars where product_id = $1 and note_key = $2', [body.productId, body.key]);
    else await pool.query('insert into note_stars (product_id, note_key, rating) values ($1, $2, $3) on conflict (product_id, note_key) do update set rating = excluded.rating', [body.productId, body.key, rating]);
    await log(user, 'note-stars', { productId: body.productId, key: body.key, rating });
    send(res, 200, await siteSettings(pool, ctx.categories, ctx.productPaths));
    return true;
  }
  if (path === '/api/admin/review') {
    const id = Number(body?.id);
    if (!Number.isInteger(id)) { send(res, 400, { error: 'Нет такого отзыва.' }); return true; }
    if (body.status === 'deleted') await pool.query('delete from reviews where id = $1', [id]);
    else if (REVIEW_STATUS.has(body.status)) await pool.query('update reviews set status = $2, moderated_at = now() where id = $1', [id, body.status]);
    else { send(res, 400, { error: 'Неизвестное действие.' }); return true; }
    await log(user, 'review', { id, status: body.status });
    send(res, 200, { ok: true });
    return true;
  }
  // «Сотрудники»: a staff account is created here with its own email (not by promoting a customer) and a one-time
  // password shown to the administrator once; removing takes away the sign-in and closes its sessions.
  if (path === '/api/admin/staff') {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (emailError(email)) { send(res, 400, { error: emailError(email) }); return true; }
    // A new password for a member of staff who forgot theirs (owner, 2026-11-12): shown once, like the first one; their
    // other sessions end. Resetting your own password keeps you signed in here.
    if (body?.reset === true) {
      const { rows: [member] } = await pool.query("select id from users where lower(email) = $1 and role = 'admin'", [email]);
      if (!member) { send(res, 404, { error: 'Нет сотрудника с такой почтой.' }); return true; }
      const password = oneTimePassword();
      await pool.query('update users set password_hash = $2 where id = $1', [member.id, await ctx.hashPassword(password)]);
      if (email !== user.email.toLowerCase()) await pool.query('delete from sessions where user_id = $1', [member.id]);
      await log(user, 'staff-password-reset', { email });
      send(res, 200, { email, password });
      return true;
    }
    if (body?.remove === true) {
      if (email === user.email.toLowerCase()) { send(res, 400, { error: 'Нельзя удалить самого себя.' }); return true; }
      const { rows: [gone] } = await pool.query("update users set role = 'removed' where lower(email) = $1 and role = 'admin' returning id", [email]);
      if (!gone) { send(res, 404, { error: 'Нет сотрудника с такой почтой.' }); return true; }
      await pool.query('delete from sessions where user_id = $1', [gone.id]);
      await log(user, 'staff-removed', { email });
      send(res, 200, { ok: true });
      return true;
    }
    const { rows: [existing] } = await pool.query('select role from users where lower(email) = $1', [email]);
    if (existing?.role === 'admin') { send(res, 409, { error: 'Этот сотрудник уже есть.' }); return true; }
    if (existing?.role === 'customer') { send(res, 409, { error: 'Эта почта уже у покупателя. Для сотрудника нужна отдельная почта.' }); return true; }
    const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
    const password = oneTimePassword();
    const firstName = clean(body?.firstName, 60) || 'Сотрудник', lastName = clean(body?.lastName, 60);
    if (existing) await pool.query("update users set role = 'admin', password_hash = $2, first_name = $3, last_name = $4 where lower(email) = $1", [email, await ctx.hashPassword(password), firstName, lastName]);
    else await pool.query("insert into users (email, phone, phone_key, first_name, last_name, partner_id, password_hash, consent_at, role) values ($1, '', null, $2, $3, '', $4, now(), 'admin')", [email, firstName, lastName, await ctx.hashPassword(password)]);
    await log(user, 'staff-added', { email });
    send(res, 201, { email, password });
    return true;
  }
  send(res, 404, { error: 'Нет такого адреса.' });
  return true;
}

/** One article added in site management, by its address part, as the pages read it (the server's page shell), or null. */
export async function findContentArticle(pool, slug, productPaths) {
  const { rows } = await pool.query("select id, kind, slug, data, created_at from content_items where kind = 'article' and slug = $1", [slug]);
  return rows[0] ? articleOf(rows[0], productPaths) : null;
}
/** Addresses of the added articles customers can see (for the sitemap). */
export async function contentArticlePaths(pool) {
  const { rows } = await pool.query("select slug from content_items where kind = 'article' and slug is not null");
  return rows.map(r => `/blog/${r.slug}/`);
}

import { ORDER_SCHEMA, orderAdminRoute } from './order-admin.mjs';
import { randomBytes } from 'node:crypto';
import { cardPricesFor, cardUnitsOf, publicSiteSettings } from './card-prices.mjs';
import { emailError } from '../src/contact-fields.mjs';
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
);` + ORDER_SCHEMA;

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
  if (c.image !== undefined && c.image !== null) { if (!localUrl(c.image)) return { error: 'Фото заполнено неверно.' }; out.image = c.image; }
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

/** Public settings every page applies: the rate, product overrides and hidden expert comments. */
export async function siteSettings(pool) {
  const [{ rows: rate }, { rows: products }, { rows: notes }, { rows: cards }, { rows: ratings }, { rows: stars }] = await Promise.all([
    pool.query("select value, updated_at from site_settings where key = 'rate'"),
    pool.query('select * from product_overrides'),
    pool.query('select product_id, note_key from hidden_notes'),
    pool.query("select product_id, data->>'name' as name, data->>'image' as image from product_content"),
    pool.query("select product_id, sum(rating)::int as sum, count(*)::int as count from reviews where status = 'published' group by product_id"),
    pool.query('select product_id, note_key, rating from note_stars'),
  ]);
  const hiddenNotes = {};
  for (const n of notes) (hiddenNotes[n.product_id] ??= []).push(n.note_key);
  return {
    rate: rate[0] ? { rubPerUnit: Number(rate[0].value.rubPerUnit), updatedAt: rate[0].updated_at } : null,
    products: Object.fromEntries(products.map(p => [p.product_id, { retailUnits: num(p.retail_units), partnerUnits: num(p.partner_units), retailRub: p.retail_rub, partnerRub: p.partner_rub, availability: p.availability }])),
    hiddenNotes,
    // Stars of published customer reviews, added to the old site's rating on every card and product page.
    ratings: Object.fromEntries(ratings.map(r => [r.product_id, { sum: r.sum, count: r.count }])),
    // Stars of expert comments that differ from the default five (set by the administrator on the product page).
    noteStars: stars.reduce((all, s) => ({ ...all, [s.product_id]: { ...all[s.product_id], [s.note_key]: s.rating } }), {}),
    // A card's own name and photo (the rest of the content is fetched on the product's page: /api/product-content).
    cards: Object.fromEntries(cards.map(c => [c.product_id, { ...(c.name ? { name: c.name } : {}), ...(c.image ? { image: c.image } : {}) }]).filter(([, c]) => Object.keys(c).length)),
  };
}

/**
 * Handles /api/site, /api/reviews and /api/admin/*; returns false for other paths.
 * `ctx`: pool, send, readJson, sessionUser(req), productIds (Set of known product ids, or null to accept any).
 */
export async function siteRoute(ctx, req, res, path, url) {
  const { pool, send, readJson, sessionUser, staffUser, productIds } = ctx;
  const method = req.method;
  const knownProduct = id => typeof id === 'string' && (!productIds || productIds.has(id));
  const log = (user, action, detail) => pool.query('insert into admin_log (user_id, action, detail) values ($1, $2, $3)', [user.id, action, JSON.stringify(detail)]);

  // Card prices are not public: /api/site gives them (the administrator's card price fields) to administrators only,
  // and /api/card-prices gives the card prices to a signed-in account with a discount card number (scripts/card-prices.mjs).
  if (path === '/api/site' && method === 'GET') {
    const [settings, staff] = await Promise.all([siteSettings(pool), staffUser(req)]);
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
    const products = ctx.cardProducts ?? [];
    send(res, 200, { prices: cardPricesFor(products, await siteSettings(pool), ctx.buildRate), ...(admin ? { units: cardUnitsOf(products) } : {}) }, headers);
    return true;
  }

  if (path === '/api/product-content' && method === 'GET') {
    const id = url.searchParams.get('id');
    if (!knownProduct(id)) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    const { rows } = await pool.query('select data from product_content where product_id = $1', [id]);
    send(res, 200, { content: rows[0]?.data ?? null, base: ctx.productBase?.(id) ?? null });
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
    if (!knownProduct(product)) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    const { rows } = await pool.query("select r.id, r.rating, r.text, r.created_at, u.first_name, u.last_name from reviews r join users u on u.id = r.user_id where r.product_id = $1 and r.status = 'published' order by r.created_at desc limit 200", [product]);
    send(res, 200, { reviews: rows.map(r => ({ id: Number(r.id), rating: r.rating, text: r.text, date: r.created_at, author: authorName(r) })) });
    return true;
  }
  if (path === '/api/reviews' && method === 'POST') {
    const user = await sessionUser(req);
    if (!user) { send(res, 401, { error: 'Войдите в аккаунт, чтобы оставить отзыв.' }); return true; }
    const body = await readJson(req);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const rating = Number(body?.rating);
    if (!knownProduct(body?.productId)) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
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

  if (await orderAdminRoute(ctx, req, res, path, url, user)) return true;

  // How many reviews wait for approval: the administrator's profile and bell show it.
  if (path === '/api/admin/pending' && method === 'GET') {
    const { rows: [{ count }] } = await pool.query("select count(*)::int as count from reviews where status = 'pending'");
    send(res, 200, { reviews: count });
    return true;
  }
  // The consultation agent's questions of the last 30 days (scripts/ai-agent.mjs), newest first, with the month's tokens.
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
      siteSettings(pool),
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
      customers: Number((await pool.query("select count(*)::int as n from users where role = 'customer'")).rows[0].n),
    });
    return true;
  }
  if (path === '/api/admin/upload' && method === 'POST') {
    const product = url.searchParams.get('product'), kind = url.searchParams.get('kind');
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!knownProduct(product) || !['image', 'document'].includes(kind)) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
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
    if (!knownProduct(body?.productId)) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    if (body.reset === true) await pool.query('delete from product_content where product_id = $1', [body.productId]);
    else {
      const checked = validateContent(body.content);
      if (checked.error) { send(res, 400, { error: checked.error }); return true; }
      await pool.query('insert into product_content (product_id, data, updated_at) values ($1, $2, now()) on conflict (product_id) do update set data = excluded.data, updated_at = now()', [body.productId, JSON.stringify(checked.value)]);
    }
    await log(user, body.reset === true ? 'content-reset' : 'content', { productId: body.productId });
    send(res, 200, await siteSettings(pool));
    return true;
  }

  if (path === '/api/admin/rate') {
    const rate = amount(body?.rubPerUnit, 1000, false);
    if (rate.error || rate.value === null) { send(res, 400, { error: 'Курс — число больше нуля, например 94 или 94,5.' }); return true; }
    const { rows: before } = await pool.query("select value from site_settings where key = 'rate'");
    await pool.query("insert into site_settings (key, value, updated_at) values ('rate', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify({ rubPerUnit: rate.value })]);
    await log(user, 'rate', { rubPerUnit: rate.value, from: before[0] ? Number(before[0].value.rubPerUnit) : (Number(body?.previous) || null) });
    send(res, 200, await siteSettings(pool));
    return true;
  }
  if (path === '/api/admin/product') {
    if (!knownProduct(body?.productId)) { send(res, 400, { error: 'Нет такого товара.' }); return true; }
    if (body.reset === true) {
      await pool.query('delete from product_overrides where product_id = $1', [body.productId]);
      await log(user, 'product-reset', { productId: body.productId });
      send(res, 200, await siteSettings(pool));
      return true;
    }
    const fields = { retailUnits: amount(body.retailUnits, 100000, false), partnerUnits: amount(body.partnerUnits, 100000, false), retailRub: amount(body.retailRub, 10000000, true), partnerRub: amount(body.partnerRub, 10000000, true) };
    if (Object.values(fields).some(f => f.error)) { send(res, 400, { error: 'Цена — число больше нуля. Пустое поле — цена из прайса.' }); return true; }
    const availability = body.availability === null || body.availability === undefined || body.availability === '' ? null : body.availability;
    if (availability !== null && !AVAILABILITY.has(availability)) { send(res, 400, { error: 'Наличие: «в наличии» или «нет в наличии».' }); return true; }
    const v = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value]));
    await pool.query(`insert into product_overrides (product_id, retail_units, partner_units, retail_rub, partner_rub, availability, updated_at) values ($1, $2, $3, $4, $5, $6, now())
      on conflict (product_id) do update set retail_units = excluded.retail_units, partner_units = excluded.partner_units, retail_rub = excluded.retail_rub, partner_rub = excluded.partner_rub, availability = excluded.availability, updated_at = now()`,
      [body.productId, v.retailUnits, v.partnerUnits, v.retailRub, v.partnerRub, availability]);
    await log(user, 'product', { productId: body.productId, ...v, availability });
    send(res, 200, await siteSettings(pool));
    return true;
  }
  if (path === '/api/admin/note') {
    if (!knownProduct(body?.productId) || typeof body?.key !== 'string' || !body.key || body.key.length > 400) { send(res, 400, { error: 'Нет такого комментария.' }); return true; }
    if (body.hidden === true) await pool.query('insert into hidden_notes (product_id, note_key) values ($1, $2) on conflict do nothing', [body.productId, body.key]);
    else await pool.query('delete from hidden_notes where product_id = $1 and note_key = $2', [body.productId, body.key]);
    await log(user, body.hidden === true ? 'note-hide' : 'note-show', { productId: body.productId, key: body.key });
    send(res, 200, await siteSettings(pool));
    return true;
  }
  if (path === '/api/admin/note-stars') {
    const rating = Number(body?.rating);
    if (!knownProduct(body?.productId) || typeof body?.key !== 'string' || !body.key || body.key.length > 400 || !Number.isInteger(rating) || rating < 1 || rating > 5) { send(res, 400, { error: 'Оценка — от 1 до 5 звёзд.' }); return true; }
    if (rating === 5) await pool.query('delete from note_stars where product_id = $1 and note_key = $2', [body.productId, body.key]);
    else await pool.query('insert into note_stars (product_id, note_key, rating) values ($1, $2, $3) on conflict (product_id, note_key) do update set rating = excluded.rating', [body.productId, body.key, rating]);
    await log(user, 'note-stars', { productId: body.productId, key: body.key, rating });
    send(res, 200, await siteSettings(pool));
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

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
create table if not exists admin_log (
  id bigserial primary key,
  user_id bigint references users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}',
  at timestamptz not null default now()
);`;

const AVAILABILITY = new Set(['InStock', 'OutOfStock']);
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
  const [{ rows: rate }, { rows: products }, { rows: notes }] = await Promise.all([
    pool.query("select value, updated_at from site_settings where key = 'rate'"),
    pool.query('select * from product_overrides'),
    pool.query('select product_id, note_key from hidden_notes'),
  ]);
  const hiddenNotes = {};
  for (const n of notes) (hiddenNotes[n.product_id] ??= []).push(n.note_key);
  return {
    rate: rate[0] ? { rubPerUnit: Number(rate[0].value.rubPerUnit), updatedAt: rate[0].updated_at } : null,
    products: Object.fromEntries(products.map(p => [p.product_id, { retailUnits: num(p.retail_units), partnerUnits: num(p.partner_units), retailRub: p.retail_rub, partnerRub: p.partner_rub, availability: p.availability }])),
    hiddenNotes,
  };
}

/**
 * Handles /api/site, /api/reviews and /api/admin/*; returns false for other paths.
 * `ctx`: pool, send, readJson, sessionUser(req), productIds (Set of known product ids, or null to accept any).
 */
export async function siteRoute(ctx, req, res, path, url) {
  const { pool, send, readJson, sessionUser, productIds } = ctx;
  const method = req.method;
  const knownProduct = id => typeof id === 'string' && (!productIds || productIds.has(id));
  const log = (user, action, detail) => pool.query('insert into admin_log (user_id, action, detail) values ($1, $2, $3)', [user.id, action, JSON.stringify(detail)]);

  if (path === '/api/site' && method === 'GET') { send(res, 200, await siteSettings(pool)); return true; }

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
  const user = await sessionUser(req);
  if (!user) { send(res, 401, { error: 'Вы не вошли в аккаунт.' }); return true; }
  if (user.role !== 'admin') { send(res, 403, { error: 'Этот раздел только для администратора.' }); return true; }

  // How many reviews wait for approval: the administrator's profile and bell show it.
  if (path === '/api/admin/pending' && method === 'GET') {
    const { rows: [{ count }] } = await pool.query("select count(*)::int as count from reviews where status = 'pending'");
    send(res, 200, { reviews: count });
    return true;
  }
  if (path === '/api/admin/overview' && method === 'GET') {
    const [settings, { rows: history }, { rows: reviews }, { rows: users }, cbr] = await Promise.all([
      siteSettings(pool),
      pool.query("select l.detail, l.at, u.email from admin_log l left join users u on u.id = l.user_id where l.action = 'rate' order by l.at desc limit 30"),
      pool.query('select r.*, u.email, u.first_name, u.last_name from reviews r join users u on u.id = r.user_id order by (r.status = \'pending\') desc, r.created_at desc limit 500'),
      pool.query('select email, first_name, last_name, role, created_at from users order by created_at desc limit 1000'),
      ctx.cbr === false ? null : cbrUsd(),
    ]);
    send(res, 200, {
      ...settings,
      cbr,
      rateHistory: history.map(h => ({ rubPerUnit: Number(h.detail.rubPerUnit), from: h.detail.from === null || h.detail.from === undefined ? null : Number(h.detail.from), at: h.at, by: h.email })),
      reviews: reviews.map(r => ({ id: Number(r.id), productId: r.product_id, rating: r.rating, text: r.text, status: r.status, date: r.created_at, author: authorName(r), email: r.email })),
      users: users.map(u => ({ email: u.email, name: `${u.first_name} ${u.last_name}`.trim(), role: u.role, createdAt: u.created_at })),
    });
    return true;
  }
  if (method !== 'PUT') { send(res, 404, { error: 'Нет такого адреса.' }); return true; }
  const body = await readJson(req);

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
  if (path === '/api/admin/user') {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body?.role === 'admin' ? 'admin' : body?.role === 'customer' ? 'customer' : null;
    if (!email || !role) { send(res, 400, { error: 'Укажите почту и роль.' }); return true; }
    if (email === user.email.toLowerCase() && role !== 'admin') { send(res, 400, { error: 'Нельзя снять права администратора с самого себя.' }); return true; }
    const { rowCount } = await pool.query('update users set role = $2 where lower(email) = $1', [email, role]);
    if (!rowCount) { send(res, 404, { error: 'Нет аккаунта с такой почтой.' }); return true; }
    await log(user, 'role', { email, role });
    send(res, 200, { ok: true });
    return true;
  }
  send(res, 404, { error: 'Нет такого адреса.' });
  return true;
}

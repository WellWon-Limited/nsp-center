import { customerOrder, readCustomerOrder } from './order-read.mjs';
import { assertDatabaseReady } from './database/ready.mjs';
// Accounts API (apps/api/app.mjs): registration, sign-in, sign-out and the account's own data
// (cart, favourites, waiting list, intake plan, marathon) kept in Postgres, so they follow the visitor to any device.
// It works only when DATABASE_URL is set; without it every /api/ request answers 503 and the site keeps its
// in-browser demo account (packages/presentation/store.tsx decides by that answer).
//
// Passwords: scrypt with a random salt per account. Sessions: a random token in an HttpOnly SameSite=Lax cookie; the
// database keeps only its SHA-256. Requests that change data must be JSON from the site's own origin (CSRF guard).
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { domainToUnicode } from 'node:url';
import { saveCheckout } from './order-checkout.mjs';
import { customProduct } from '../../packages/domain/custom-product.mjs';
import { SITE_SCHEMA, siteRoute } from './site-admin.mjs';
import { customerEmailError, formatPhone, phoneError, russianEmail, FOREIGN_EMAIL_ERROR } from '../../packages/domain/contact-fields.mjs';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'nsp_session';
const SESSION_DAYS = 30;
/** Site management (/admin/) has its own sign-in and session, separate from a customer's: a staff account is not a
 *  customer account, and its session lasts one working day (research 2026-11-10, OWASP session management). */
const STAFF_COOKIE = 'nsp_staff', STAFF_HOURS = 12;
const MAX_BODY = 256 * 1024;
const MAX_DATA = 200 * 1024;
/** The parts of the visitor's state that belong to the account (packages/presentation/store.tsx SYNC_KEYS mirrors this list). */
export const DATA_KEYS = ['cart', 'favorites', 'waitlist', 'intake', 'intakeDate', 'intakePlans', 'intakeLog', 'habits', 'tasks', 'day', 'orders'];

export const SCHEMA = `
create table if not exists users (
  id bigserial primary key,
  email text not null,
  phone text not null default '',
  phone_key text,
  first_name text not null,
  last_name text not null,
  partner_id text not null default '',
  password_hash text not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table users add column if not exists role text not null default 'customer';
-- Staff (including removed staff) and customers have separate email identities.
create unique index if not exists users_email_scope_key on users (lower(email), (role = 'customer'));
drop index if exists users_email_key;
drop index if exists users_phone_key;
create table if not exists sessions (
  token_hash text primary key,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions (user_id);
create table if not exists account_data (
  user_id bigint primary key references users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);`;

const SCRYPT = { N: 16384, r: 8, p: 1 };
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export async function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
}
// Compared against when the login matches no account, so a wrong email takes as long as a wrong password.
const decoyHash = await hashPassword(randomBytes(12).toString('hex'));

const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
/** One spelling per mailbox: lower case, and a Cyrillic domain as letters, whether the browser sent "почта.рф" or its
 *  Latin form "xn--80a1acny.xn--p1ai" (Chrome does the latter), so the same person never gets two accounts. */
export const normalEmail = value => {
  const email = clean(value, 120).toLowerCase(), at = email.lastIndexOf('@');
  if (at < 1 || !email.includes('xn--')) return email;
  const domain = domainToUnicode(email.slice(at + 1));
  return domain ? `${email.slice(0, at)}@${domain}` : email;
};
const digits = v => v.replace(/\D/g, '');
/** Last 10 digits of a Russian phone: «+7 900 111-22-33», «8 900 1112233» and «9001112233» are the same number. */
export const phoneKey = phone => { const d = digits(phone); return d.length >= 10 ? d.slice(-10) : null; };

/** Name, phone and discount card number as the visitor may edit them; `error` is a sentence for the visitor. */
export function validateProfile(body) {
  const firstName = clean(body?.firstName, 60), lastName = clean(body?.lastName, 60), phone = clean(body?.phone, 30), partnerId = digits(clean(body?.partnerId, 20));
  if (!firstName || !lastName) return { error: 'Укажите имя и фамилию.' };
  if (phoneError(phone)) return { error: phoneError(phone) };
  const shown = formatPhone(phone);
  return { value: { firstName, lastName, phone: shown, phoneKey: shown ? phoneKey(shown) : null, partnerId } };
}
export function validateRegistration(body) {
  const profile = validateProfile(body);
  if (profile.error) return profile;
  const email = normalEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (customerEmailError(email)) return { error: customerEmailError(email) };
  if (password.length < 8 || password.length > 200) return { error: 'Пароль должен быть не короче 8 символов.' };
  if (body?.consent !== true) return { error: 'Нужно согласие на обработку персональных данных.' };
  return { value: { ...profile.value, email, password } };
}
/** Keeps only the account's own parts of the state; their contents are checked by the site when it reads them. */
export function pickData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return Object.fromEntries(DATA_KEYS.filter(k => k in data).map(k => [k, data[k]]));
}

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim().split('=')).filter(([k, v]) => k && v !== undefined).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const isHttps = req => req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
const cookie = (req, value, maxAge, name = SESSION_COOKIE) => `${name}=${value}; Path=/; HttpOnly; SameSite=${name === STAFF_COOKIE ? 'Strict' : 'Lax'}; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

function send(res, status, body, headers = {}) {
  const text = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(text);
}
async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}
// A form or script on another site cannot send JSON here without a CORS preflight, and the Origin it sends must be ours.
// An upload (a photo or certificate scan, /api/admin/upload) is not JSON; it must then carry our Origin.
function sameOrigin(req, upload = false) {
  const origin = req.headers.origin;
  if (upload ? !origin : !String(req.headers['content-type'] || '').startsWith('application/json')) return false;
  if (!origin) return true;
  try { return new URL(origin).host === String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim(); } catch { return false; }
}

/** Failed sign-ins per address and login: 10 within 15 minutes, then a pause. Registrations: 20 per address per hour. */
function limiter(max, windowMs) {
  const hits = new Map();
  return {
    blocked(key) { const h = hits.get(key); if (h && h.until < Date.now()) hits.delete(key); return (hits.get(key)?.count ?? 0) >= max; },
    hit(key) { const now = Date.now(); const h = hits.get(key); if (!h || h.until < now) hits.set(key, { count: 1, until: now + windowMs }); else h.count++; if (hits.size > 10000) for (const [k, v] of hits) if (v.until < now) hits.delete(k); },
    reset(key) { hits.delete(key); },
  };
}

/** A member of staff as site management shows them. */
const staffOf = row => ({ firstName: row.first_name, lastName: row.last_name, email: row.email });
const accountOf = row => ({ firstName: row.first_name, lastName: row.last_name, email: row.email, phone: row.phone, partnerId: row.partner_id, createdAt: new Date(row.created_at).toISOString().slice(0, 10) });

/**
 * Returns `handle(req, res, url)` for every /api/ request. With no `databaseUrl` (or `pool`) it answers 503.
 * `productIds` (a Set) limits reviews and product settings to the site's products. Staff accounts
 * (site management, /admin/) are created by `npm run admin:create` or in «Сотрудники», never by registration.
 * `cardProducts`, `buildRate`: the built products with their card prices and the build's ruble rate, for GET
 * /api/card-prices (scripts/card-prices.mjs).
 * `categories`: the catalog sections, for cards created in site management (packages/presentation/custom-product.mjs).
 * `cbr: false` skips asking cbr.ru for the reference rate (tests). `productBase(id)`: a product's built card content
 * (name, description, properties, certificates, photo), shown in the administrator's editor next to the changes.
 * The schema is prepared by db:migrate; requests only check readiness and retry if the database was down.
 */
export async function createAccounts({ databaseUrl, pool: givenPool, productIds = null, productBase = () => null, cardProducts = [], buildRate = 0, pickupAddress = '', cbr = true, categories = [], articlePaths = [], previewPages = [], knowledgeThemes = [], lectureCorpusFile } = {}) {
  const productPaths = new Map(cardProducts.filter(p => p?.path).map(p => [p.id, p.path]));
  if (!databaseUrl && !givenPool) return { enabled: false, handle: (req, res) => send(res, 503, { error: 'Сервер аккаунтов не подключён.' }), close: async () => {} };
  const pool = givenPool ?? new (await import('pg')).default.Pool({ connectionString: databaseUrl, max: 5 });
  // An idle connection dropped by the database (restart, shutdown) must not take the whole site server down.
  pool.on('error', error => console.error('Accounts database connection lost:', error.message));
  let ready = null;
  // Staff accounts are created only by `npm run admin:create` or by an administrator in «Сотрудники» — never by
  // registering with a listed email (anyone could register it first). ADMIN_EMAILS is no longer read.
  const readyDatabase = () => (ready ??= assertDatabaseReady(pool).catch(error => { ready = null; throw error; }));
  const orderRequests = limiter(30, 60 * 1000);
  const signIns = limiter(10, 15 * 60 * 1000), registrations = limiter(20, 60 * 60 * 1000);

  async function startSession(req, userId, staff = false) {
    const token = randomBytes(32).toString('base64url');
    await pool.query('delete from sessions where user_id = $1 and expires_at < now()', [userId]);
    const seconds = staff ? STAFF_HOURS * 3600 : SESSION_DAYS * 86400;
    await pool.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${seconds} seconds')`, [tokenHash(token), userId]);
    return cookie(req, token, seconds, staff ? STAFF_COOKIE : SESSION_COOKIE);
  }
  async function userOf(req, name, role) {
    const token = parseCookies(req.headers.cookie)[name];
    if (!token) return null;
    const { rows } = await pool.query('select u.* from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now() and u.role = $2', [tokenHash(token), role]);
    return rows[0] ?? null;
  }
  /** The signed-in customer (the shop's cookie); a staff account is never a customer here. */
  const sessionUser = req => userOf(req, SESSION_COOKIE, 'customer');
  /** The signed-in member of staff (site management's own cookie). */
  const staffUser = req => userOf(req, STAFF_COOKIE, 'admin');
  async function accountWithData(user) {
    const { rows } = await pool.query('select data, updated_at from account_data where user_id = $1', [user.id]);
    return { account: accountOf(user), data: rows[0]?.data ?? {}, updatedAt: rows[0]?.updated_at ?? null };
  }
  const taken = error => error?.code === '23505' && error.constraint === 'users_email_scope_key' ? 'Аккаунт с таким email уже есть. Войдите в него или укажите другой email.' : null;

  /** Site management's sign-in (/admin/): /api/admin/login, /logout, /me. Only staff accounts; returns false for other
   *  /api/admin/ paths (they are checked in scripts/site-admin.mjs with staffUser). */
  async function staffAuth(req, res, path) {
    const method = req.method;
    if (path === '/api/admin/login' && method === 'POST') {
      const body = await readJson(req);
      const login = normalEmail(body?.login), password = typeof body?.password === 'string' ? body.password.slice(0, 200) : '';
      const key = `staff|${login}`;
      if (signIns.blocked(key)) { send(res, 429, { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' }); return true; }
      const { rows: [user] } = await pool.query("select * from users where lower(email) = $1 and role = 'admin'", [login]);
      const ok = await verifyPassword(password, user?.password_hash ?? decoyHash) && Boolean(user);
      if (!ok) { signIns.hit(key); send(res, 401, { error: 'Неверная почта или пароль сотрудника.' }); return true; }
      signIns.reset(key);
      await pool.query("insert into admin_log (user_id, action, detail) values ($1, 'login', '{}')", [user.id]);
      send(res, 200, { staff: staffOf(user) }, { 'Set-Cookie': await startSession(req, user.id, true) });
      return true;
    }
    if (path === '/api/admin/logout' && method === 'POST') {
      const token = parseCookies(req.headers.cookie)[STAFF_COOKIE];
      if (token) await pool.query('delete from sessions where token_hash = $1', [tokenHash(token)]);
      send(res, 204, undefined, { 'Set-Cookie': cookie(req, '', 0, STAFF_COOKIE) });
      return true;
    }
    if (path === '/api/admin/me' && method === 'GET') {
      const user = await staffUser(req);
      send(res, user ? 200 : 401, user ? { staff: staffOf(user) } : { error: 'Войдите в управление сайтом.' }, { 'Cache-Control': 'no-store' });
      return true;
    }
    return false;
  }

  async function route(req, res, path, url) {
    const method = req.method;
    if (method !== 'GET' && !sameOrigin(req, path === '/api/admin/upload')) return send(res, 403, { error: 'Запрос отклонён.' });
    if (path.startsWith('/api/admin/') && await staffAuth(req, res, path)) return;
    if (await siteRoute({ pool, send, readJson, sessionUser, staffUser, hashPassword, productIds, productBase, cardProducts, buildRate, cbr, categories, previewPages, productPaths, articlePaths: new Set(articlePaths) }, req, res, path, url)) return;
    if (path === '/api/orders') {
      if (method !== 'POST') return send(res, 405, { error: 'Оформление заказа доступно методом POST.' });
      const ip = clientIp(req);
      if (orderRequests.blocked(ip)) return send(res, 429, { error: 'Слишком много запросов. Попробуйте через минуту.' });
      orderRequests.hit(ip);
      const user = await sessionUser(req);
      try {
        const result = await saveCheckout({ pool, buildRate, pickupAddress, loadCatalog: async client => {
          const {rows:[snapshot]} = await client.query(`select
            (select value from site_settings where key='rate') as rate,
            coalesce((select jsonb_agg(o) from product_overrides o),'[]'::jsonb) as overrides,
            coalesce((select jsonb_object_agg(product_id,hidden) from product_visibility),'{}'::jsonb) as visibility,
            coalesce((select jsonb_object_agg(product_id,jsonb_build_object('name',data->>'name')) from product_content),'{}'::jsonb) as cards,
            coalesce((select jsonb_agg(c) from custom_products c),'[]'::jsonb) as custom`);
          const num = v => v === null ? null : Number(v);
          const settings = {rate:snapshot.rate,visibility:snapshot.visibility,cards:snapshot.cards,products:Object.fromEntries(snapshot.overrides.map(p=>[p.product_id,{retailUnits:num(p.retail_units),partnerUnits:num(p.partner_units),retailRub:p.retail_rub,partnerRub:p.partner_rub,availability:p.availability}]))};
          const custom = snapshot.custom;
          return { settings, products: [...cardProducts, ...custom.map(r => customProduct(r.product_id, r.data, categories, true))] };
        } }, user, await readJson(req));
        return send(res, result.repeated ? 200 : 201, result);
      } catch (e) {
        if (e.orderStatus) return send(res, e.orderStatus, { error: e.message });
        throw e;
      }
    }
    if (/^\/api\/orders\/\d{1,18}$/.test(path)) {
      if (method !== 'GET') return send(res, 405, { error: 'Доступно только чтение заказа.' });
      const user = await sessionUser(req);
      const token = typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer /, '') : '';
      const order = await readCustomerOrder(pool, path.split('/').at(-1), user, token);
      return send(res, order ? 200 : 404, order ? {order} : {error:'Заказ недоступен. Войдите в аккаунт покупателя или откройте сохранённую ссылку на заказ.'});
    }
    if (path === '/api/account/orders') {
      const user = await sessionUser(req);
      if (!user) return send(res, 401, { error: 'Вы не вошли в аккаунт.' });
      if (method !== 'GET') return send(res, 405, { error: 'Доступно только чтение заказов.' });
      // Never accept an email or customer id from the browser; staff notes are private.
      const {rows} = await pool.query('select * from order_read where user_id = $1 order by created_at desc, id desc', [user.id]);
      return send(res, 200, {orders: rows.map(customerOrder)});
    }
    if (path === '/api/auth/me' && method === 'GET') {
      const user = await sessionUser(req);
      return user ? send(res, 200, await accountWithData(user)) : send(res, 401, { error: 'Вы не вошли в аккаунт.' });
    }
    if (path === '/api/auth/register' && method === 'POST') {
      const ip = clientIp(req);
      if (registrations.blocked(ip)) return send(res, 429, { error: 'Слишком много регистраций с этого адреса. Попробуйте через час.' });
      const checked = validateRegistration(await readJson(req));
      if (checked.error) return send(res, 400, { error: checked.error });
      const v = checked.value;
      registrations.hit(ip);
      try {
        const { rows } = await pool.query('insert into users (email, phone, phone_key, first_name, last_name, partner_id, password_hash, consent_at, role) values ($1, $2, $3, $4, $5, $6, $7, now(), $8) returning *', [v.email, v.phone, v.phoneKey, v.firstName, v.lastName, '', await hashPassword(v.password), 'customer']);
        return send(res, 201, await accountWithData(rows[0]), { 'Set-Cookie': await startSession(req, rows[0].id) });
      } catch (error) { const message = taken(error); if (message) return send(res, 409, { error: message }); throw error; }
    }
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await readJson(req);
      const login = normalEmail(body?.login), password = typeof body?.password === 'string' ? body.password.slice(0, 200) : '';
      const key = `${clientIp(req)}|${login}`;
      if (signIns.blocked(key)) return send(res, 429, { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
      if (!russianEmail(login)) return send(res, 400, { error: FOREIGN_EMAIL_ERROR });
      // Sign-in is by email only (owner, 2026-11-10); the phone stays a contact field of the profile.
      const { rows } = await pool.query("select * from users where lower(email) = $1 and role = 'customer'", [login]);
      const user = rows[0];
      const ok = await verifyPassword(password, user?.password_hash ?? decoyHash) && Boolean(user);
      if (!ok || user.role !== 'customer') { signIns.hit(key); return send(res, 401, { error: 'Неверный логин или пароль.' }); }
      signIns.reset(key);
      return send(res, 200, await accountWithData(user), { 'Set-Cookie': await startSession(req, user.id) });
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) await pool.query('delete from sessions where token_hash = $1', [tokenHash(token)]);
      return send(res, 204, undefined, { 'Set-Cookie': cookie(req, '', 0) });
    }
    if (path === '/api/account' && method === 'PUT') {
      const user = await sessionUser(req);
      if (!user) return send(res, 401, { error: 'Вы не вошли в аккаунт.' });
      const body = await readJson(req);
      if (body?.profile !== undefined) {
        const checked = validateProfile(body.profile);
        if (checked.error) return send(res, 400, { error: checked.error });
        const v = checked.value;
        try { await pool.query("update users set first_name = $2, last_name = $3, phone = $4, phone_key = $5, partner_id = case when $6='' and not exists(select 1 from card_applications where user_id=users.id) then '' else users.partner_id end where id = $1", [user.id, v.firstName, v.lastName, v.phone, v.phoneKey, v.partnerId]); }
        catch (error) { const message = taken(error); if (message) return send(res, 409, { error: message }); throw error; }
      }
      let updatedAt = null;
      if (body?.data !== undefined) {
        const data = JSON.stringify(pickData(body.data));
        if (data.length > MAX_DATA) return send(res, 413, { error: 'Слишком много данных для одного аккаунта.' });
        ({ rows: [{ updated_at: updatedAt }] } = await pool.query('insert into account_data (user_id, data, updated_at) values ($1, $2, now()) on conflict (user_id) do update set data = excluded.data, updated_at = now() returning updated_at', [user.id, data]));
      }
      return send(res, 200, { updatedAt });
    }
    return send(res, 404, { error: 'Нет такого адреса.' });
  }

  return {
    enabled: true,
    pool,
    ready: readyDatabase,
    async handle(req, res, url) {
      try { await readyDatabase(); }
      catch (error) { console.error('Accounts database is unavailable:', error.message); return send(res, 503, { error: 'Сервер аккаунтов временно недоступен. Попробуйте позже.' }); }
      try { await route(req, res, url.pathname, url); }
      catch (error) {
        if (error.status) return send(res, error.status, { error: 'Некорректный запрос.' });
        console.error('Accounts API error:', error);
        send(res, 500, { error: 'Что-то пошло не так. Попробуйте ещё раз.' });
      }
    },
    close: () => givenPool ? Promise.resolve() : pool.end(),
  };
}

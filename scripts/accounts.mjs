// Accounts API of the site server (scripts/serve.mjs): registration, sign-in, sign-out and the account's own data
// (cart, favourites, waiting list, intake plan, marathon) kept in Postgres, so they follow the visitor to any device.
// It works only when DATABASE_URL is set; without it every /api/ request answers 503 and the site keeps its
// in-browser demo account (src/store.tsx decides by that answer).
//
// Passwords: scrypt with a random salt per account. Sessions: a random token in an HttpOnly SameSite=Lax cookie; the
// database keeps only its SHA-256. Requests that change data must be JSON from the site's own origin (CSRF guard).
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SITE_SCHEMA, siteRoute } from './site-admin.mjs';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'nsp_session';
const SESSION_DAYS = 30;
const MAX_BODY = 256 * 1024;
const MAX_DATA = 200 * 1024;
/** The parts of the visitor's state that belong to the account (src/store.tsx SYNC_KEYS mirrors this list). */
export const DATA_KEYS = ['cart', 'favorites', 'waitlist', 'intake', 'intakeDate', 'intakePlans', 'intakeLog', 'habits', 'tasks', 'day'];

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
create unique index if not exists users_email_key on users (lower(email));
create unique index if not exists users_phone_key on users (phone_key) where phone_key is not null;
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
const digits = v => v.replace(/\D/g, '');
/** Last 10 digits of a Russian phone: «+7 900 111-22-33», «8 900 1112233» and «9001112233» are the same number. */
export const phoneKey = phone => { const d = digits(phone); return d.length >= 10 ? d.slice(-10) : null; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Name, phone and discount card number as the visitor may edit them; `error` is a sentence for the visitor. */
export function validateProfile(body) {
  const firstName = clean(body?.firstName, 60), lastName = clean(body?.lastName, 60), phone = clean(body?.phone, 30), partnerId = digits(clean(body?.partnerId, 20));
  if (!firstName || !lastName) return { error: 'Укажите имя и фамилию.' };
  if (phone && !phoneKey(phone)) return { error: 'Проверьте телефон: нужно 10 цифр после +7.' };
  return { value: { firstName, lastName, phone, phoneKey: phone ? phoneKey(phone) : null, partnerId } };
}
export function validateRegistration(body) {
  const profile = validateProfile(body);
  if (profile.error) return profile;
  const email = clean(body?.email, 120).toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!EMAIL.test(email)) return { error: 'Проверьте email.' };
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
const cookie = (req, value, maxAge) => `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
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
function sameOrigin(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return false;
  const origin = req.headers.origin;
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

const accountOf = row => ({ firstName: row.first_name, lastName: row.last_name, email: row.email, phone: row.phone, partnerId: row.partner_id, createdAt: new Date(row.created_at).toISOString().slice(0, 10), ...(row.role === 'admin' ? { admin: true } : {}) });

/**
 * Returns `handle(req, res, url)` for every /api/ request. With no `databaseUrl` (or `pool`) it answers 503.
 * `productIds` (a Set) limits reviews and product settings to the site's products. `adminEmails`: accounts with these
 * emails are administrators (on the server: ADMIN_EMAILS, comma-separated); more can be appointed in the admin section.
 * `cbr: false` skips asking cbr.ru for the reference rate (tests).
 * The schema is created on the first request; a database that is down gives 503 and is retried on the next request.
 */
export async function createAccounts({ databaseUrl, pool: givenPool, productIds = null, adminEmails = [], cbr = true } = {}) {
  const admins = adminEmails.map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!databaseUrl && !givenPool) return { enabled: false, handle: (req, res) => send(res, 503, { error: 'Сервер аккаунтов не подключён.' }), close: async () => {} };
  const pool = givenPool ?? new (await import('pg')).default.Pool({ connectionString: databaseUrl, max: 5 });
  // An idle connection dropped by the database (restart, shutdown) must not take the whole site server down.
  pool.on('error', error => console.error('Accounts database connection lost:', error.message));
  let ready = null;
  const migrate = () => (ready ??= pool.query(SCHEMA + SITE_SCHEMA).then(() => admins.length && pool.query("update users set role = 'admin' where lower(email) = any($1)", [admins])).catch(error => { ready = null; throw error; }));
  const signIns = limiter(10, 15 * 60 * 1000), registrations = limiter(20, 60 * 60 * 1000);

  async function startSession(req, userId) {
    const token = randomBytes(32).toString('base64url');
    await pool.query('delete from sessions where user_id = $1 and expires_at < now()', [userId]);
    await pool.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [tokenHash(token), userId]);
    return cookie(req, token, SESSION_DAYS * 86400);
  }
  async function sessionUser(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const { rows } = await pool.query('select u.* from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()', [tokenHash(token)]);
    return rows[0] ?? null;
  }
  async function accountWithData(user) {
    const { rows } = await pool.query('select data, updated_at from account_data where user_id = $1', [user.id]);
    return { account: accountOf(user), data: rows[0]?.data ?? {}, updatedAt: rows[0]?.updated_at ?? null };
  }
  const taken = error => error?.code === '23505' ? (String(error.constraint).includes('phone') ? 'Этот телефон уже указан в другом аккаунте.' : 'Аккаунт с таким email уже есть. Войдите в него или укажите другой email.') : null;

  async function route(req, res, path, url) {
    const method = req.method;
    if (method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Запрос отклонён.' });
    if (await siteRoute({ pool, send, readJson, sessionUser, productIds, cbr }, req, res, path, url)) return;
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
        const { rows } = await pool.query('insert into users (email, phone, phone_key, first_name, last_name, partner_id, password_hash, consent_at, role) values ($1, $2, $3, $4, $5, $6, $7, now(), $8) returning *', [v.email, v.phone, v.phoneKey, v.firstName, v.lastName, v.partnerId, await hashPassword(v.password), admins.includes(v.email) ? 'admin' : 'customer']);
        return send(res, 201, await accountWithData(rows[0]), { 'Set-Cookie': await startSession(req, rows[0].id) });
      } catch (error) { const message = taken(error); if (message) return send(res, 409, { error: message }); throw error; }
    }
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await readJson(req);
      const login = clean(body?.login, 120).toLowerCase(), password = typeof body?.password === 'string' ? body.password.slice(0, 200) : '';
      const key = `${clientIp(req)}|${login}`;
      if (signIns.blocked(key)) return send(res, 429, { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
      const { rows } = login.includes('@')
        ? await pool.query('select * from users where lower(email) = $1', [login])
        : await pool.query('select * from users where phone_key = $1', [phoneKey(login) ?? '']);
      const user = rows[0];
      const ok = await verifyPassword(password, user?.password_hash ?? decoyHash) && Boolean(user);
      if (!ok) { signIns.hit(key); return send(res, 401, { error: 'Неверный телефон, email или пароль.' }); }
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
        try { await pool.query('update users set first_name = $2, last_name = $3, phone = $4, phone_key = $5, partner_id = $6 where id = $1', [user.id, v.firstName, v.lastName, v.phone, v.phoneKey, v.partnerId]); }
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
    async handle(req, res, url) {
      try { await migrate(); }
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySite, noteKey, visibleNotes } from '../src/site.ts';
import { createAccounts, hashPassword, verifyPassword, validateRegistration, phoneKey, pickData, parseCookies } from '../scripts/accounts.mjs';

test('passwords are salted scrypt hashes and verify only with the same password', async () => {
  const a = await hashPassword('secret-2026'), b = await hashPassword('secret-2026');
  assert.match(a, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('secret-2026', a), true);
  assert.equal(await verifyPassword('secret-2027', a), false);
  assert.equal(await verifyPassword('secret-2026', 'sha256$abc'), false);
});

test('registration input is checked with messages for the visitor', () => {
  const ok = { firstName: ' Анна ', lastName: 'Иванова', email: 'Anna@Example.ru', phone: '8 (900) 111-22-33', partnerId: '72-04', password: '12345678', consent: true };
  const { value } = validateRegistration(ok);
  assert.deepEqual([value.firstName, value.email, value.phoneKey, value.partnerId], ['Анна', 'anna@example.ru', '9001112233', '7204']);
  assert.match(validateRegistration({ ...ok, consent: false }).error, /согласие/);
  assert.match(validateRegistration({ ...ok, password: 'short' }).error, /8 символов/);
  assert.match(validateRegistration({ ...ok, email: 'anna' }).error, /email/);
  assert.match(validateRegistration({ ...ok, phone: '12345' }).error, /телефон/);
  assert.equal(phoneKey('+7 900 111-22-33'), phoneKey('89001112233'));
  assert.deepEqual(pickData({ cart: { a: 1 }, account: { email: 'x' }, signedIn: true }), { cart: { a: 1 } });
  assert.deepEqual(parseCookies('a=1; nsp_session=x%3Dy'), { a: '1', nsp_session: 'x=y' });
});

test('without a database every /api/ request answers 503', async () => {
  const accounts = await createAccounts({});
  const server = createServer((req, res) => accounts.handle(req, res, new URL(req.url, 'http://x')));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`);
  assert.equal(r.status, 503);
  server.close();
});

// Full flow against a real Postgres (the embedded one, in a temporary directory). Postgres refuses to run as root, so
// the test is skipped there.
test('accounts API: register, session, data, sign-out, sign-in, guards', { skip: process.getuid?.() === 0 && 'Postgres does not run as root' }, async t => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = mkdtempSync(join(tmpdir(), 'nsp-accounts-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), port, user: 'test', password: 'test', persistent: false, autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} });
  await pg.initialise(); await pg.start(); await pg.createDatabase('accounts');
  const accounts = await createAccounts({ databaseUrl: `postgres://test:test@127.0.0.1:${port}/accounts`, productIds: new Set(['bee-pollen', 'alfalfa']), adminEmails: ['boss@example.ru'], cbr: false });
  const server = createServer((req, res) => accounts.handle(req, res, new URL(req.url, 'http://x')));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { server.close(); await accounts.close(); await pg.stop(); rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let session = '';
  const call = async (path, method = 'GET', body, headers = {}) => {
    const r = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Cookie: session } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get('set-cookie'); if (set) session = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    return { status: r.status, body: r.status === 204 ? null : await r.json(), cookie: set };
  };

  assert.equal((await call('/api/auth/me')).status, 401);
  const registered = await call('/api/auth/register', 'POST', { firstName: 'Анна', lastName: 'Иванова', email: 'anna@example.ru', phone: '+7 900 111-22-33', partnerId: '', password: 'password-1', consent: true });
  assert.equal(registered.status, 201);
  assert.match(registered.cookie, /^nsp_session=[\w-]{20,}; Path=\/; HttpOnly; SameSite=Lax/);
  assert.equal(registered.body.account.email, 'anna@example.ru');

  assert.equal((await call('/api/account', 'PUT', { profile: { firstName: 'Анна', lastName: 'Петрова', phone: '+7 900 111-22-33', partnerId: '446621' }, data: { cart: { 'bee-pollen': 2 }, signedIn: true } })).status, 200);
  const me = await call('/api/auth/me');
  assert.equal(me.body.account.lastName, 'Петрова');
  assert.equal(me.body.account.partnerId, '446621');
  assert.deepEqual(me.body.data, { cart: { 'bee-pollen': 2 } });

  assert.equal((await call('/api/auth/register', 'POST', { firstName: 'А', lastName: 'Б', email: 'ANNA@example.ru', password: 'password-2', consent: true })).status, 409);
  assert.equal((await call('/api/account', 'PUT', { data: {} }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: session } })).status, 403);

  const old = session;
  assert.equal((await call('/api/auth/logout', 'POST', {})).status, 204);
  assert.equal(session, '');
  session = old;
  assert.equal((await call('/api/auth/me')).status, 401, 'the signed-out session no longer works');
  session = '';

  assert.equal((await call('/api/auth/login', 'POST', { login: 'anna@example.ru', password: 'wrong-pass' })).status, 401);
  const byPhone = await call('/api/auth/login', 'POST', { login: '8 900 111 22 33', password: 'password-1' });
  assert.equal(byPhone.status, 200);
  assert.deepEqual(byPhone.body.data, { cart: { 'bee-pollen': 2 } });

  const { rows } = await accounts.pool.query('select password_hash from users');
  assert.match(rows[0].password_hash, /^scrypt\$/, 'no plain passwords in the database');

  // A customer writes a review; it is not public until an administrator publishes it.
  assert.equal((await call('/api/reviews', 'POST', { productId: 'bee-pollen', rating: 5, text: ' ' })).status, 400);
  assert.equal((await call('/api/reviews', 'POST', { productId: 'bee-pollen', rating: 0, text: 'Хорошо' })).status, 400);
  assert.equal((await call('/api/reviews', 'POST', { productId: 'unknown', rating: 5, text: 'Хороший продукт, пью месяц.' })).status, 400);
  assert.equal((await call('/api/reviews', 'POST', { productId: 'bee-pollen', rating: 5, text: 'Хороший продукт, пью месяц.' })).status, 201);
  assert.deepEqual((await call('/api/reviews?product=bee-pollen')).body.reviews, []);
  assert.equal((await call('/api/admin/overview')).status, 403, 'a customer is not an administrator');
  assert.equal((await call('/api/admin/rate', 'PUT', { rubPerUnit: 1 })).status, 403);

  // ADMIN_EMAILS makes this account an administrator at registration.
  session = '';
  const boss = await call('/api/auth/register', 'POST', { firstName: 'Марина', lastName: 'Админ', email: 'boss@example.ru', password: 'password-3', consent: true });
  assert.equal(boss.body.account.admin, true);
  assert.equal((await call('/api/admin/rate', 'PUT', { rubPerUnit: 'abc' })).status, 400);
  assert.equal((await call('/api/admin/rate', 'PUT', { rubPerUnit: '96,5' })).body.rate.rubPerUnit, 96.5);
  assert.equal((await call('/api/admin/product', 'PUT', { productId: 'alfalfa', retailUnits: '15', availability: 'OutOfStock' })).status, 200);
  const site = (await call('/api/site')).body;
  assert.equal(site.rate.rubPerUnit, 96.5);
  assert.deepEqual(site.products.alfalfa, { retailUnits: 15, partnerUnits: null, retailRub: null, partnerRub: null, availability: 'OutOfStock' });
  assert.equal((await call('/api/admin/note', 'PUT', { productId: 'alfalfa', key: 'Врач|Лекция|Текст', hidden: true })).body.hiddenNotes.alfalfa[0], 'Врач|Лекция|Текст');
  assert.equal((await call('/api/admin/pending')).body.reviews, 1);
  const overview = (await call('/api/admin/overview')).body;
  assert.equal(overview.rateHistory[0].rubPerUnit, 96.5);
  assert.equal(overview.rateHistory[0].by, 'boss@example.ru');
  const review = overview.reviews[0];
  assert.equal(review.status, 'pending');
  assert.equal((await call('/api/admin/review', 'PUT', { id: review.id, status: 'published' })).status, 200);
  assert.equal((await call('/api/reviews?product=bee-pollen')).body.reviews[0].author, 'Анна П.');
  assert.equal((await call('/api/admin/review', 'PUT', { id: review.id, status: 'deleted' })).status, 200);
  assert.deepEqual((await call('/api/reviews?product=bee-pollen')).body.reviews, []);
  assert.equal((await call('/api/admin/user', 'PUT', { email: 'boss@example.ru', role: 'customer' })).status, 400, 'cannot demote yourself');
  assert.equal((await call('/api/admin/user', 'PUT', { email: 'anna@example.ru', role: 'admin' })).status, 200);
});

test('site settings recompute rubles from у.е. and never compound', () => {
  const product = () => ({ id: 'a', availability: 'InStock', availability_text: 'В наличии', prices: { retail: 940, partner: 705, source: 'price-list', units: { retail: 10, partner: 7.5 } } });
  const p = product(), q = { ...product(), id: 'b', prices: { retail: 500, partner: null, source: 'snapshot' } };
  const site = { rate: { rubPerUnit: 96 }, products: { b: { retailUnits: null, partnerUnits: null, retailRub: 450, partnerRub: null, availability: 'OutOfStock' } }, hiddenNotes: { a: ['Врач|Лекция|Текст'] } };
  applySite([p, q], site, 94);
  assert.deepEqual([p.prices.retail, p.prices.partner], [960, 720]);
  assert.deepEqual([q.prices.retail, q.availability, q.availability_text], [450, 'OutOfStock', 'Нет в наличии']);
  applySite([p, q], site, 94);
  assert.equal(p.prices.retail, 960, 'applying twice gives the same price');
  applySite([p, q], { ...site, products: { a: { retailUnits: 12, partnerUnits: null, retailRub: null, partnerRub: null, availability: null } } }, 94);
  assert.deepEqual([p.prices.retail, q.prices.retail, q.availability], [1152, 500, 'InStock']);
  applySite([p, q], null, 94);
  assert.deepEqual([p.prices.retail, p.prices.partner], [940, 705], 'no settings: the built prices');
  const notes = [{ speaker: 'Врач', lecture: 'Лекция', text: 'Текст', role: '', course: '' }, { speaker: 'Другой', lecture: 'Лекция', text: 'Текст', role: '', course: '' }];
  assert.equal(noteKey(notes[0]), 'Врач|Лекция|Текст');
  assert.deepEqual(visibleNotes('a', notes, site).map(n => n.speaker), ['Другой']);
});

import {createAccounts} from './database-helper.mjs';
import sharp from 'sharp';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyContent, applySite, noteKey, visibleNotes } from '../packages/presentation/site.ts';
import { hashPassword, verifyPassword, validateRegistration, phoneKey, pickData, parseCookies } from '../scripts/accounts.mjs';

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
  assert.match(validateRegistration({ ...ok, email: 'anna' }).error, /Недопустимый адрес почты/);
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
  const accounts = await createAccounts({ databaseUrl: `postgres://test:test@127.0.0.1:${port}/accounts`, knowledgeThemes:[{mainProductId:'alfalfa',lead:'Люцерна: растительная питательная поддержка.',pairs:[{productId:'bee-pollen',why:'Пищевая поддержка рациона.'}],sources:[{course:'Курс',lecture:'Растения в питании',speaker:'Лектор'}]}], categories: JSON.parse(readFileSync(new URL('../packages/catalog/generated/content.json', import.meta.url), 'utf8')).categories, productIds: new Set(['bee-pollen', 'alfalfa']), cardProducts: [{ id: 'bee-pollen', prices: { retail: 1000, partner: 714, units: { retail: 10, partner: 7.14 } } }, { id: 'alfalfa', name:'Люцерна', prices: { retail: 900, partner: null } }], buildRate: 100, adminEmails: ['boss@example.ru'], cbr: false });
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
  assert.equal((await call('/api/card-prices')).status, 401, 'a guest gets no card prices');
  const registered = await call('/api/auth/register', 'POST', { firstName: 'Анна', lastName: 'Иванова', email: 'anna@example.ru', phone: '+7 900 111-22-33', partnerId: '', password: 'password-1', consent: true });
  assert.equal(registered.status, 201);
  assert.match(registered.cookie, /^nsp_session=[\w-]{20,}; Path=\/; HttpOnly; SameSite=Lax/);
  assert.equal(registered.body.account.email, 'anna@example.ru');
  assert.equal((await call('/api/card-prices')).status, 403, 'no card number, no card prices');

  assert.equal((await call('/api/account', 'PUT', { profile: { firstName: 'Анна', lastName: 'Петрова', phone: '+7 900 111-22-33', partnerId: '446621' }, data: { cart: { 'bee-pollen': 2 }, signedIn: true } })).status, 200);
  assert.equal((await call('/api/auth/me')).body.account.partnerId, '', 'a profile update cannot verify a self-entered card');
  assert.equal((await call('/api/card-prices')).status, 403);
  // Existing cards imported by staff remain valid; new claims use the approval flow tested separately.
  await accounts.pool.query("update users set partner_id='446621' where email='anna@example.ru'");
  const me = await call('/api/auth/me');
  assert.equal(me.body.account.lastName, 'Петрова');
  const cardPrices = await call('/api/card-prices');
  assert.equal(cardPrices.status, 200, 'an account with a card number gets the card prices');
  assert.deepEqual(cardPrices.body, { prices: { 'bee-pollen': 714 } }, 'card prices by the price list units and rate; no units for a customer');
  const publicSite = await call('/api/site');
  assert.ok(Object.values(publicSite.body.products).every(o => !('partnerRub' in o) && !('partnerUnits' in o)), '/api/site has no card price fields for a customer');
  assert.equal(me.body.account.partnerId, '446621');
  assert.deepEqual(me.body.data, { cart: { 'bee-pollen': 2 } });

  assert.equal((await call('/api/auth/register', 'POST', { firstName: 'А', lastName: 'Б', email: 'ANNA@example.ru', password: 'password-2', consent: true })).status, 409);
  assert.equal((await call('/api/account', 'PUT', { data: {} }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: session } })).status, 403);

  const purchaseHistory=[{id:'HISTORY-1',date:'14.11.2026',total:1000,items:1,products:{'bee-pollen':1}}];
  assert.equal((await call('/api/account','PUT',{data:{cart:{'bee-pollen':2},orders:purchaseHistory}})).status,200);
  assert.deepEqual((await call('/api/auth/me')).body.data.orders,purchaseHistory,'purchase history stays with this account');
  const old = session;
  assert.equal((await call('/api/auth/logout', 'POST', {})).status, 204);
  assert.equal(session, '');
  session = old;
  assert.equal((await call('/api/auth/me')).status, 401, 'the signed-out session no longer works');
  session = '';

  assert.equal((await call('/api/auth/login', 'POST', { login: 'anna@example.ru', password: 'wrong-pass' })).status, 401);
  assert.equal((await call('/api/auth/login', 'POST', { login: '8 900 111 22 33', password: 'password-1' })).status, 400, 'sign-in is by email only, not by phone');
  assert.match((await call('/api/auth/login', 'POST', { login: 'anna@gmail.com', password: 'password-1' })).body.error, /не поддерживаем/, 'foreign mail is refused at sign-in');
  assert.match((await call('/api/auth/register', 'POST', { firstName: 'А', lastName: 'Б', email: 'anna2@gmail.com', password: 'password-1', consent: true })).body.error, /не поддерживаем/, 'and at registration');
  const byEmail = await call('/api/auth/login', 'POST', { login: 'Anna@Example.ru', password: 'password-1' });
  assert.equal(byEmail.status, 200);
  assert.deepEqual(byEmail.body.data, { cart: { 'bee-pollen': 2 },orders:purchaseHistory },'purchase history returns after signing in again');

  const { rows } = await accounts.pool.query('select password_hash from users');
  assert.match(rows[0].password_hash, /^scrypt\$/, 'no plain passwords in the database');

  // A customer writes a review; it is not public until an administrator publishes it.
  assert.equal((await call('/api/reviews', 'POST', { productId: 'bee-pollen', rating: 5, text: ' ' })).status, 400);
  assert.equal((await call('/api/reviews', 'POST', { productId: 'bee-pollen', rating: 0, text: 'Хорошо' })).status, 400);
  assert.equal((await call('/api/reviews', 'POST', { productId: 'unknown', rating: 5, text: 'Хороший продукт, пью месяц.' })).status, 400);
  assert.equal((await call('/api/reviews', 'POST', { productId: 'bee-pollen', rating: 5, text: 'Хороший продукт, пью месяц.' })).status, 201);
  assert.deepEqual((await call('/api/reviews?product=bee-pollen')).body.reviews, []);
  assert.equal((await call('/api/admin/overview')).status, 401, 'a customer session does not open site management');
  assert.equal((await call('/api/admin/rate', 'PUT', { rubPerUnit: 1 })).status, 401);
  assert.equal((await call('/api/admin/visibility', 'PUT', { productId: 'alfalfa', hidden: true })).status, 401, 'a customer cannot hide products');
  assert.equal((await call('/api/admin/chat-log')).status, 401, 'a customer cannot read the chat questions');
  assert.equal((await call('/api/admin/new-product', 'PUT', { product: { name: 'Чужая карточка' } })).status, 401, 'a customer cannot create cards');
  assert.equal((await call('/api/admin/categories')).status,401,'category management is staff-only');
  assert.equal((await call('/api/admin/categories','PUT',{action:'create',name:'Чужая категория',revision:0})).status,401);
  assert.equal((await call('/api/admin/site-content', 'PUT', { kind: 'faq', action: 'add', item: { q: 'Вопрос?', a: 'Ответ.' } })).status, 401, 'a customer cannot change the content');
  assert.equal((await call('/api/admin/knowledge-search?q=магний')).status,401,'lecture transcripts are only available to staff');

  // Staff are separate accounts (npm run admin:create): their own sign-in, session and cookie; registration never makes one.
  session = '';
  const listed = await call('/api/auth/register', 'POST', { firstName: 'Кто-то', lastName: 'Чужой', email: 'boss-copy@example.ru', password: 'password-9', consent: true });
  assert.equal(listed.body.account.admin, undefined, 'registration gives no staff rights');
  session = '';
  await accounts.pool.query("insert into users (email, first_name, last_name, password_hash, consent_at, role) values ('boss@example.ru', 'Марина', 'Админ', $1, now(), 'admin')", [await hashPassword('password-3-staff')]);
  const asCustomer = await call('/api/auth/login', 'POST', { login: 'boss@example.ru', password: 'password-3-staff' });
  assert.deepEqual(asCustomer, {status:401,body:{error:'Неверный логин или пароль.'},cookie:null}, 'staff credentials get the ordinary failed customer login response without a session');
  const wrongStaffPassword = await call('/api/auth/login', 'POST', {login:'boss@example.ru',password:'wrong-password'});
  const unknownCustomer = await call('/api/auth/login', 'POST', {login:'unknown@example.ru',password:'wrong-password'});
  assert.deepEqual(wrongStaffPassword, asCustomer, 'the response does not disclose whether the staff password was correct');
  assert.deepEqual(unknownCustomer, asCustomer, 'the response does not disclose the account role or existence');
  assert.equal((await call('/api/admin/me')).status, 401);
  assert.equal((await call('/api/admin/login', 'POST', { login: 'anna@example.ru', password: 'password-1' })).status, 401, 'a customer does not sign in to site management');
  const sharedPhone = await call('/api/auth/register', 'POST', {firstName:'Другой',lastName:'Покупатель',email:'shared-phone@example.ru',phone:'+7 900 111-22-33',password:'password-4',consent:true});
  assert.equal(sharedPhone.status,201,'contact phone can be shared by customers');
  const personalBoss = await call('/api/auth/register', 'POST', {firstName:'Марина',lastName:'Покупатель',email:'boss@example.ru',phone:'+7 900 111-22-33',password:'password-5',consent:true});
  assert.equal(personalBoss.status,201,'staff can register an independent customer with the same email');
  assert.equal((await call('/api/auth/register','POST',{firstName:'Повтор',lastName:'Покупатель',email:'BOSS@example.ru',password:'password-5',consent:true})).status,409);
  assert.equal((await call('/api/auth/login','POST',{login:'boss@example.ru',password:'password-3-staff'})).status,401);
  assert.equal((await call('/api/admin/login','POST',{login:'boss@example.ru',password:'password-5'})).status,401);
  assert.equal((await call('/api/auth/login','POST',{login:'boss@example.ru',password:'password-5'})).status,200);
  session = '';
  const boss = await call('/api/admin/login', 'POST', { login: 'boss@example.ru', password: 'password-3-staff' });
  assert.equal(boss.status, 200);
  assert.match(boss.cookie, /^nsp_staff=[\w-]{20,}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=43200/, 'a 12-hour staff session');
  assert.equal((await call('/api/admin/me')).body.staff.email, 'boss@example.ru');
  assert.equal((await call('/api/auth/me')).status, 401, 'the staff cookie is not a customer session');
  assert.equal((await call('/api/admin/rate', 'PUT', { rubPerUnit: 'abc' })).status, 400);
  const library=(await call('/api/admin/knowledge')).body;
  assert.equal(library.counts.products,1);
  assert.equal(library.counts.lectures,1);
  const materials=(await call('/api/admin/knowledge?source=alfalfa')).body.data;
  assert.equal(materials.recommendations[0].area,'nutrition');
  assert.equal((await call('/api/admin/new-product','PUT',{product:{name:'Товар без фото',categoryPath:'/catalog/ukhod-za-kozhey-litsa-i-shei/',retailRub:1000}})).status,400,'a new product requires a photo');
  const linked=(await call('/api/admin/new-product','PUT',{content:{image:'/images/journal-final/magnesium-cover-v1.jpg'},product:{name:'Люцерна, новая упаковка',categoryPath:'/catalog/ukhod-za-kozhey-litsa-i-shei/',retailRub:1000,knowledgeSourceId:'alfalfa'}})).body;
  assert.deepEqual(linked.knowledge[linked.id].about,materials.about,'new cards immediately receive confirmed source material');
  assert.equal(linked.knowledge[linked.id].pairs[0].productId,'bee-pollen');
  const changed={...materials,benefit:'Поддержка питания',recommendations:[{area:'nutrition',reason:'Растительные ингредиенты для разнообразия рациона.'}]};
  assert.equal((await call('/api/admin/product-knowledge','PUT',{productId:linked.id,knowledge:changed})).status,200);
  assert.equal((await call('/api/site')).body.knowledge[linked.id].benefit,'Поддержка питания');
  assert.equal((await call('/api/admin/product-knowledge','PUT',{productId:linked.id,knowledge:{...changed,sources:[]}})).status,400,'unattributed recommendations cannot be published');
  assert.equal((await call('/api/admin/product-knowledge','PUT',{productId:linked.id,knowledge:{...changed,recommendations:[{area:'made-up',reason:'x'}]}})).status,400);

  // The matching word occurs deep inside the transcript, not in its title or author.
  const lectureBody='Вступление. '.repeat(1500)+'Речь о магнии. Магнием дополняют рацион. Подбирайте продукты внимательно. '+'Завершение. '.repeat(300);
  await accounts.pool.query('insert into knowledge_lectures(id,course,lecture,speaker,body) values($1,$2,$3,$4,$5)',['body-only','Курс теста','Нервная система','Анна Лекторова',lectureBody]);
  const found=(await call('/api/admin/knowledge-search?q='+encodeURIComponent('магний'))).body;
  assert.ok(found.results.some(r=>r.id==='body-only'),'search finds Russian word forms in the transcript body');
  assert.match(found.results.find(r=>r.id==='body-only').excerpt,/<nsp-match>/);
  const context=(await call('/api/admin/knowledge?lecture=body-only&q='+encodeURIComponent('магний'))).body;
  assert.match(context.excerpt,/магни/iu,'context opens near the match beyond the old 12,000-character cutoff');
  assert.equal((await call('/api/admin/knowledge-search?q='+encodeURIComponent('уникальноенесуществующееслово'))).body.total,0);
  assert.equal((await call('/api/admin/knowledge-search?q=')).body.total,0);
  assert.equal((await call('/api/admin/knowledge-search?q='+encodeURIComponent("' OR 1=1 --"))).status,200,'query punctuation is data, not SQL');
  for(let n=0;n<12;n++)await accounts.pool.query('insert into knowledge_lectures(id,course,lecture,speaker,body) values($1,$2,$3,$4,$5)',['page-'+n,'Курс','Другой материал '+n,'Лектор','Магний входит в рацион.']);
  const first=(await call('/api/admin/knowledge-search?q='+encodeURIComponent('магний'))).body;
  const next=(await call('/api/admin/knowledge-search?q='+encodeURIComponent('магний')+'&page=2')).body;
  assert.equal(first.results.length,8);assert.equal(first.hasMore,true);
  assert.equal(new Set([...first.results,...next.results].map(x=>x.id)).size,first.total,'search pagination has no gaps or duplicates');
  const source={id:'body-only',course:'Курс теста',lecture:'Нервная система',speaker:'Анна Лекторова',query:'магний'};
  const expertKnowledge={...changed,sources:[source],experts:[{sourceId:'body-only',speaker:'Подменённое имя',role:'Профессор',text:'Рассказывает о роли магния в повседневном питании.'}]};
  const expertSaved=(await call('/api/admin/product-knowledge','PUT',{productId:linked.id,knowledge:expertKnowledge})).body.knowledge[linked.id];
  assert.equal(expertSaved.experts[0].speaker,'Анна Лекторова','expert attribution comes from the attached lecture');
  assert.equal(expertSaved.experts[0].role,'Автор лекции');
  assert.equal(expertSaved.sources[0].query,'магний','the saved source keeps the query for reopening context');
  const syncedCopy=(await call('/api/product-content?id='+linked.id)).body.content;
  assert.deepEqual(syncedCopy.about,expertKnowledge.about,'knowledge and the displayed product description are saved together');
  assert.equal((await call('/api/admin/product-knowledge','PUT',{productId:linked.id,knowledge:{...expertKnowledge,experts:[{sourceId:'missing',text:'Произвольный текст отзыва.'}]}})).status,400,'an expert note needs a real attached source');
  assert.equal((await call('/api/admin/product-knowledge','PUT',{productId:linked.id,knowledge:{...expertKnowledge,experts:[{sourceId:'body-only',text:''}]}})).status,400);

  const complete=(await call('/api/admin/new-product','PUT',{
    product:{name:'Новый товар из редактора',categoryPath:'/catalog/ukhod-za-kozhey-litsa-i-shei/',retailRub:1500},
    knowledge:expertKnowledge,content:{properties:{Состав:'Растительные ингредиенты.'},image:'/images/journal-final/magnesium-cover-v1.jpg'}
  })).body;
  assert.ok(complete.id,'new-product form creates the record only on final submit');
  assert.equal(complete.visibility[complete.id],true,'a newly created card stays hidden');
  assert.equal(complete.knowledge[complete.id].experts[0].speaker,'Анна Лекторова','lecture expert can be attached before the product exists');
  assert.equal(complete.cards[complete.id].image,'/webp/images/journal-final/magnesium-cover-v1.webp');
  const fullContent=(await call('/api/product-content?id='+complete.id)).body.content;
  assert.equal(fullContent.properties.Состав,'Растительные ингредиенты.');
  assert.deepEqual(fullContent.about,expertKnowledge.about);

  const manual=await call('/api/admin/new-product','PUT',{
    product:{name:'Готовая новая карточка',categoryPath:'/catalog/ukhod-za-kozhey-litsa-i-shei/',retailRub:2100,availability:'InStock'},publish:true,
    content:{name:'Готовая новая карточка',summary:'Короткая строка для каталога',properties:{'Объём':'60 капсул','Состав 1 ед. (таблетки, пакетика, порции)':'Проверенный состав'},image:'/images/journal-final/magnesium-cover-v1.jpg'},
    knowledge:{about:['Описание, заполненное администратором вручную.'],highlights:[],benefit:'Короткая строка для каталога',recommendations:[],pairs:[],sources:[],experts:[]}
  });
  assert.equal(manual.status,200);
  const published=manual.body;assert.equal(published.visibility[published.id],false,'the new editor can publish a completed card immediately');
  assert.equal(published.cards[published.id].summary,'Короткая строка для каталога');assert.equal(published.cards[published.id].package,'60 капсул');
  const publicRecord=(await call('/api/site')).body;
  assert.ok(publicRecord.extraProducts.some(p=>p.id===published.id));assert.equal(publicRecord.visibility[published.id],false);
  const factsOnly=await call('/api/admin/product-knowledge','PUT',{productId:published.id,knowledge:null,content:{name:'Новое название',summary:'Новая строка',properties:{'Объём':'90 капсул'}}});
  assert.equal(factsOnly.status,200,'the composition panel can save manual information without inventing lecture sources');
  assert.equal(factsOnly.body.cards[published.id].name,'Новое название');assert.equal(factsOnly.body.cards[published.id].package,'90 капсул');
  await call('/api/admin/delete-product','PUT',{productId:published.id});
  const beforeFailed=(await call('/api/site')).body.extraProducts.length;
  assert.equal((await call('/api/admin/new-product','PUT',{product:{name:'Неполный материал',categoryPath:'/catalog/ukhod-za-kozhey-litsa-i-shei/',retailRub:1500},knowledge:{...expertKnowledge,sources:[]}})).status,400);
  assert.equal((await call('/api/site')).body.extraProducts.length,beforeFailed,'invalid lecture data cannot leave a half-created card');
  await call('/api/admin/delete-product','PUT',{productId:complete.id});
  await call('/api/admin/delete-product','PUT',{productId:linked.id});
  assert.equal((await call('/api/site')).body.knowledge[linked.id],undefined,'deleting a card also removes its knowledge links');
  const auto=(await call('/api/admin/new-product','PUT',{content:{image:'/images/journal-final/magnesium-cover-v1.jpg'},product:{name:'Люцерна',categoryPath:'/catalog/ukhod-za-kozhey-litsa-i-shei/',retailRub:1000}})).body;
  assert.deepEqual(auto.knowledge[auto.id].about,materials.about,'an exact unambiguous match is linked automatically');
  await call('/api/admin/delete-product','PUT',{productId:auto.id});

  assert.equal((await call('/api/admin/rate', 'PUT', { rubPerUnit: '96,5' })).body.rate.rubPerUnit, 96.5);
  assert.equal((await call('/api/admin/product', 'PUT', { productId: 'alfalfa', retailUnits: '15', availability: 'OutOfStock' })).status, 200);
  const site = (await call('/api/site')).body;
  assert.equal(site.rate.rubPerUnit, 96.5);
  assert.deepEqual(site.products.alfalfa, { retailUnits: 15, partnerUnits: null, retailRub: null, partnerRub: null, availability: 'OutOfStock' });
  // Labels survive reloads and price-only edits; only staff can set them, unsupported discounts are rejected.
  for (const discountPercent of [5, 10, 15, 20, 30, 50]) {
    const badges = { discountPercent, isNew: true, isHit: true };
    const saved = await call('/api/admin/product', 'PUT', { productId: 'alfalfa', availability: 'OutOfStock', badges });
    assert.equal(saved.status, 200);
    assert.deepEqual((await call('/api/site')).body.products.alfalfa.badges, badges);
  }
  assert.equal((await call('/api/admin/product', 'PUT', { productId: 'alfalfa', badges: { discountPercent: 99, isNew: true, isHit: false } })).status, 400);
  assert.equal((await call('/api/site')).body.products.alfalfa.badges.discountPercent, 50, 'a rejected edit leaves the saved labels alone');
  await call('/api/admin/product', 'PUT', { productId: 'alfalfa', retailRub: 2000 });
  assert.equal((await call('/api/site')).body.products.alfalfa.badges.discountPercent, 50, 'older price-only clients preserve labels');
  const clearedBadges = { discountPercent: 0, isNew: false, isHit: false };
  await call('/api/admin/product', 'PUT', { productId: 'alfalfa', badges: clearedBadges });
  assert.deepEqual((await call('/api/site')).body.products.alfalfa.badges, clearedBadges, 'staff can remove all labels');
  assert.equal((await call('/api/admin/note', 'PUT', { productId: 'alfalfa', key: 'Врач|Лекция|Текст', hidden: true })).body.hiddenNotes.alfalfa[0], 'Врач|Лекция|Текст');
  assert.equal((await call('/api/admin/pending')).body.reviews, 1);
  assert.equal((await call('/api/admin/note-stars', 'PUT', { productId: 'alfalfa', key: 'Врач|Лекция|Текст', rating: 9 })).status, 400);
  assert.equal((await call('/api/admin/note-stars', 'PUT', { productId: 'alfalfa', key: 'Врач|Лекция|Текст', rating: 3 })).body.noteStars.alfalfa['Врач|Лекция|Текст'], 3);
  // A new card: created hidden, filled in the editor, shown, seen by customers without its card price, then deleted.
  const face = '/catalog/ukhod-za-kozhey-litsa-i-shei/';
  assert.match((await call('/api/admin/new-product', 'PUT', { product: { name: 'Крем', categoryPath: face, retailRub: '' } })).body.error, /Розничная/);
  const created = await call('/api/admin/new-product', 'PUT', { content:{image:'/images/journal-final/magnesium-cover-v1.jpg'},product: { name: 'Крем для рук', article: '', categoryPath: face, retailRub: '1990', partnerRub: '1490', availability: 'InStock', badges: { discountPercent: 15, isNew: true, isHit: false } } });
  assert.equal(created.body.id, 'krem-dlya-ruk');
  assert.deepEqual(created.body.extraProducts.find(p=>p.id==='krem-dlya-ruk').badges,{discountPercent:15,isNew:true,isHit:false});
  assert.equal(created.body.visibility['krem-dlya-ruk'], true, 'a new card starts hidden');
  assert.equal((await call('/api/admin/new-product', 'PUT', {content:{image:'/images/journal-final/magnesium-cover-v1.jpg'}, product: { name: 'Крем для рук', categoryPath: face, retailRub: '990' } })).body.id, 'krem-dlya-ruk-2', 'the same name gets its own address');
  assert.equal((await call('/api/product-content?id=krem-dlya-ruk')).body.base.name, 'Крем для рук', 'the editor opens it');
  assert.equal((await call('/api/admin/content', 'PUT', { productId: 'krem-dlya-ruk', content: { about: ['Мягкий крем.'] } })).status, 200);
  assert.equal((await call('/api/admin/visibility', 'PUT', { productId: 'krem-dlya-ruk', hidden: false })).status, 200);
  assert.equal((await call('/api/card-prices')).body.prices['krem-dlya-ruk'], 1490, 'the card price for those who may see it');
  const publicCard = (await call('/api/site')).body.extraProducts.find(p => p.id === 'krem-dlya-ruk');
  assert.deepEqual([publicCard.path, publicCard.prices.partner], ['/product/krem-dlya-ruk/', null]);
  assert.equal((await call('/api/admin/delete-product', 'PUT', { productId: 'alfalfa' })).status, 400, 'built cards are hidden, not deleted');
  assert.equal((await call('/api/admin/delete-product', 'PUT', { productId: 'krem-dlya-ruk-2' })).status, 200);
  assert.deepEqual((await call('/api/site')).body.extraProducts.map(p => p.id), ['krem-dlya-ruk']);

  // Persistent categories: create, rename, assign existing/new cards, reject stale saves, remove with relocation.
  let catalog=(await call('/api/admin/categories')).body.catalog;
  let change=await call('/api/admin/categories','PUT',{action:'create',name:'Новая категория',revision:catalog.revision});
  assert.equal(change.status,200);catalog=change.body.catalog;
  const categoryPath=catalog.categories.find(c=>c.name==='Новая категория').path;
  change=await call('/api/admin/categories','PUT',{action:'rename',path:categoryPath,name:'Уход каждый день',revision:catalog.revision});
  assert.equal(change.status,200);catalog=change.body.catalog;
  assert.equal(catalog.categories.find(c=>c.name==='Уход каждый день').path,categoryPath,'renaming keeps the existing address');
  assert.equal((await call('/api/admin/categories','PUT',{action:'create',name:'Устаревшее окно',revision:0})).status,409);
  change=await call('/api/admin/categories','PUT',{action:'move',productIds:['krem-dlya-ruk'],to:categoryPath,revision:catalog.revision});
  assert.equal(change.status,200);catalog=change.body.catalog;
  assert.equal((await call('/api/site')).body.extraProducts.find(p=>p.id==='krem-dlya-ruk').categoryPath,categoryPath);
  const fresh=await call('/api/admin/new-product','PUT',{content:{image:'/images/journal-final/magnesium-cover-v1.jpg'},product:{name:'Проверка новой категории',categoryPath,retailRub:1200}});
  assert.equal(fresh.status,200,'a new product can use a category created without rebuilding');
  assert.equal(fresh.body.extraProducts.find(p=>p.id===fresh.body.id).categoryPath,categoryPath);
  assert.equal((await call('/api/admin/categories','PUT',{action:'delete',path:categoryPath,revision:catalog.revision})).status,400,'products cannot be orphaned');
  change=await call('/api/admin/categories','PUT',{action:'delete',path:categoryPath,to:face,revision:catalog.revision});
  assert.equal(change.status,200);assert.equal(change.body.catalog.categories.find(c=>c.path===categoryPath).archived,true);
  assert.equal((await call('/api/site')).body.extraProducts.find(p=>p.id==='krem-dlya-ruk').categoryPath,face);
  assert.ok((await call('/api/admin/categories')).body.products.some(p=>p.id===fresh.body.id),'deleting the category preserves its products');
  assert.equal((await call('/api/admin/delete-product','PUT',{productId:fresh.body.id})).status,200);

  // «Контент»: offers, photos, videos, articles and answers are added, changed and deleted; old ones are hidden and returned.
  const content = (kind, action, extra) => call('/api/admin/site-content', 'PUT', { kind, action, ...extra });
  assert.match((await content('video', 'add', { item: { url: 'https://example.com/x', title: 'Ролик' } })).body.error, /VK Видео, Rutube или YouTube/);
  assert.equal((await content('video', 'add', { item: { url: 'https://vkvideo.ru/video-1_2', title: 'О компании' } })).body.content.videos[0].url, 'https://vkvideo.ru/video-1_2');
  const faq = (await content('faq', 'add', { item: { q: 'Есть ли рассрочка?', a: 'Нет.' } })).body.content.faq[0];
  assert.equal((await content('faq', 'update', { id: faq.id, item: { q: 'Есть ли рассрочка?', a: 'Пока нет.' } })).body.content.faq[0].a, 'Пока нет.');
  const promo = await content('promo', 'add', { item: { title: 'Скидка 10%', text: 'На все БАД.', to: '2099-01-01' } });
  assert.equal(promo.body.content.promos[0].title, 'Скидка 10%');
  const promoId=promo.body.content.promos[0].id;
  const promoEdited=await content('promo','update',{id:promoId,item:{title:'Подборка',text:'Условия акции',products:['alfalfa','krem-dlya-ruk']}});
  assert.deepEqual(promoEdited.body.content.promos[0].products,['alfalfa','krem-dlya-ruk'],'a campaign supports built and newly created products');
  assert.deepEqual((await call('/api/site')).body.content.promos[0].products,['alfalfa','krem-dlya-ruk']);
  const photo=(await content('photo','add',{item:{image:'/images/journal-final/magnesium-cover-v1.jpg',caption:'Фото'}})).body.content.photos[0];
  assert.equal((await call('/api/site')).body.content.photos[0].caption,'Фото');
  assert.equal((await content('photo','update',{id:photo.id,item:{image:photo.image,caption:'Новая подпись'}})).body.content.photos[0].caption,'Новая подпись');
  await content('photo','delete',{id:photo.id});
  assert.equal((await call('/api/site')).body.content.photos.length,0);

  const article = (await content('article', 'add', { item: { title: 'Витамин D зимой', body: 'Зимой солнца мало, и витамин D нужен с едой.', products: ['alfalfa', 'unknown'] } })).body.content.articles[0];
  assert.deepEqual([article.path, article.custom, article.data.products], ['/blog/vitamin-d-zimoy/', true, ['alfalfa']]);
  const articleEdited=(await content('article','update',{id:article.contentId,item:{title:'Витамин D зимой',lead:'Новый вводный абзац.',body:'Проверяем обновление полной статьи через редактор.',products:['krem-dlya-ruk']}})).body.content.articles[0];
  assert.deepEqual(articleEdited.related,['/product/krem-dlya-ruk/'],'a new article can link to a newly created product');
  assert.match(articleEdited.html,/Новый вводный абзац/);

  assert.equal((await content('article', 'add', { item: { title: 'Витамин D зимой', body: 'Ещё одна статья с тем же заголовком.' } })).body.content.articles[0].path, '/blog/vitamin-d-zimoy-2/', 'the same title gets its own address');
  assert.deepEqual((await content('video', 'hide', { key: 'bNT7e_FykCE' })).body.hiddenContent.video, ['bNT7e_FykCE']);
  assert.deepEqual((await content('video', 'show', { key: 'bNT7e_FykCE' })).body.hiddenContent.video, []);
  assert.equal((await content('promo', 'hide', { key: 'x' })).status, 400, 'offers are deleted, not hidden');
  assert.equal((await content('faq', 'delete', { id: faq.id })).body.content.faq.length, 0);
  assert.equal((await call('/api/site')).body.content.articles.length, 2, 'everyone sees the journal');

  // Hiding a product from customers and bringing it back («Товары» in site management).
  assert.equal((await call('/api/admin/visibility', 'PUT', { productId: 'alfalfa', hidden: 'yes' })).status, 400);
  assert.equal((await call('/api/admin/visibility', 'PUT', { productId: 'unknown-product', hidden: true })).status, 400);
  assert.equal((await call('/api/admin/visibility', 'PUT', { productId: 'alfalfa', hidden: true })).body.visibility.alfalfa, true);
  assert.equal((await call('/api/site')).body.visibility.alfalfa, true, 'every visitor learns the product is hidden');
  assert.equal((await call('/api/admin/visibility', 'PUT', { productId: 'alfalfa', hidden: false })).body.visibility.alfalfa, false, 'and it comes back');
  // The site chat's questions: anyone's chat logs them (no name kept), only staff read them.
  assert.equal((await call('/api/chat-log', 'POST', { question: ' ', answer: 'x' })).status, 400);
  assert.equal((await call('/api/chat-log', 'POST', { question: 'Сколько стоит доставка?', answer: 'Бесплатно по СПб.', products: [], answered: true })).status, 201);
  assert.equal((await call('/api/chat-log', 'POST', { question: 'Есть ли у вас корм для кошек?', answer: 'Пока не могу ответить на этот вопрос.', answered: false })).status, 201);
  const chatLog = (await call('/api/admin/chat-log')).body;
  assert.deepEqual([chatLog.counts.today, chatLog.counts.unanswered, chatLog.entries[0].question], [2, 1, 'Есть ли у вас корм для кошек?']);
  assert.deepEqual((await call('/api/admin/chat-log?filter=unanswered')).body.entries.map(e => e.question), ['Есть ли у вас корм для кошек?']);
  assert.deepEqual((await call('/api/admin/ai-log')).body, { month: { questions: 0, tokens: 0 }, entries: [] }, 'the chat log of the consultation agent');
  const overview = (await call('/api/admin/overview')).body;
  assert.equal(overview.rateHistory[0].rubPerUnit, 96.5);
  assert.equal(overview.rateHistory[0].by, 'boss@example.ru');
  const review = overview.reviews[0];
  assert.equal(review.status, 'pending');
  assert.equal((await call('/api/admin/review', 'PUT', { id: review.id, status: 'published' })).status, 200);
  assert.equal((await call('/api/reviews?product=bee-pollen')).body.reviews[0].author, 'Анна П.');
  assert.equal((await call('/api/admin/review', 'PUT', { id: review.id, status: 'deleted' })).status, 200);
  assert.deepEqual((await call('/api/reviews?product=bee-pollen')).body.reviews, []);
  // Creating staff with a customer's email creates a separate identity, never promotes the customer.
  assert.equal((await call('/api/admin/staff', 'PUT', { email: 'anna@example.ru' })).status, 201, 'a separate staff identity is created');
  assert.equal((await accounts.pool.query("select count(*)::int as n from users where email='anna@example.ru' and role='customer'")).rows[0].n,1);
  assert.equal((await call('/api/admin/staff','PUT',{email:'anna@example.ru',remove:true})).status,200);
  const helper = await call('/api/admin/staff', 'PUT', { email: 'helper@example.ru', firstName: 'Вера' });
  assert.equal(helper.status, 201);
  assert.match(helper.body.password, /^[a-zA-Z2-9]{16}$/);
  assert.equal((await call('/api/admin/staff', 'PUT', { email: 'boss@example.ru', remove: true })).status, 400, 'cannot remove yourself');
  assert.deepEqual((await call('/api/admin/overview')).body.staff.map(u => u.email).sort(), ['boss@example.ru', 'helper@example.ru']);
  // A forgotten staff password: an administrator issues a new one-time password; the old one stops working.
  const renewed = await call('/api/admin/staff', 'PUT', { email: 'helper@example.ru', reset: true });
  assert.equal(renewed.status, 200);
  assert.match(renewed.body.password, /^[a-zA-Z2-9]{16}$/);
  assert.notEqual(renewed.body.password, helper.body.password);
  assert.equal((await call('/api/admin/staff', 'PUT', { email: 'anna@example.ru', reset: true })).status, 404, 'a customer has no staff password');
  {
    const boss = session; session = '';
    assert.equal((await call('/api/admin/login', 'POST', { login: 'helper@example.ru', password: helper.body.password })).status, 401, 'the old password no longer works');
    session = '';
    assert.equal((await call('/api/admin/login', 'POST', { login: 'helper@example.ru', password: renewed.body.password })).status, 200, 'the new password works');
    session = boss;
  }
  assert.equal((await call('/api/admin/staff', 'PUT', { email: 'helper@example.ru', remove: true })).status, 200);
  const bossSession = session; session = '';
  assert.equal((await call('/api/admin/login', 'POST', { login: 'helper@example.ru', password: helper.body.password })).status, 401, 'a removed member of staff cannot sign in');
  session = bossSession;

  // Orders use their own records; a customer's saved cart drafts are not sales.
  const { rows: customerRows } = await accounts.pool.query("select id from users where email = 'anna@example.ru'");
  await accounts.pool.query('insert into account_data(user_id,data) values ($1,$2) on conflict(user_id) do update set data=excluded.data', [customerRows[0].id, JSON.stringify({orders:[{id:'LOCAL-1',total:100,items:1,date:'01.01.2026'}]})]);
  assert.equal((await call('/api/admin/orders')).body.total, 0);
  const { rows: orderRows } = await accounts.pool.query(`with o as (insert into shop_orders(user_id,customer,total_kopecks,subtotal_kopecks,discount_kopecks,delivery_kopecks) values ($1,$2,100000,100000,0,0) returning id), i as (insert into order_items(order_id,product_id,name,quantity,unit_price_kopecks,retail_price_kopecks,line_total_kopecks) select id,'alfalfa','Люцерна',2,50000,50000,100000 from o) select id from o`, [customerRows[0].id, JSON.stringify({name:'Анна Петрова',phone:'+7 900 111-22-33',email:'anna@example.ru'})]);
  const buyerLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'anna@example.ru',password:'password-1'})});
  const customerCookie=buyerLogin.headers.get('set-cookie').split(';')[0];
  const ownOrders=await fetch(base+'/api/account/orders?user_id=99999',{headers:{Cookie:customerCookie}});
  assert.equal(ownOrders.status,200);
  const owned=await ownOrders.json();
  assert.equal(owned.orders.length,1);
  assert.equal(owned.orders[0].status,'new');
  assert.equal('note' in owned.orders[0],false,'staff notes are never exposed to customers');
  assert.equal('customer' in owned.orders[0],false,'no other customer details in this endpoint');
  assert.equal((await fetch(base+'/api/account/orders')).status,401);
  const another=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({firstName:'Другой',lastName:'Покупатель',email:'another-orders@example.ru',password:'password-2',consent:true})});
  const otherCookie=another.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await(await fetch(base+'/api/account/orders',{headers:{Cookie:otherCookie}})).json()).orders,[],'a different customer cannot see this order');

  const orderId = String(orderRows[0].id);
  const orders = (await call('/api/admin/orders')).body;
  assert.equal(orders.total, 1); assert.equal(orders.summary.new, 1);
  assert.equal(orders.orders[0].items[0].quantity, 2);
  assert.equal((await call('/api/admin/orders?q=Петрова')).body.total, 1);
  assert.equal((await call('/api/admin/orders?q=missing')).body.total, 0);
  assert.equal((await call('/api/admin/orders?status=unknown')).status, 400);
  assert.equal((await call('/api/admin/orders', 'PUT', {id:orderId,status:'unknown',note:'',updatedAt:orders.orders[0].updatedAt})).status, 400);
  const updated = await call('/api/admin/orders', 'PUT', {id:orderId,status:'completed',note:'Выдан',updatedAt:orders.orders[0].updatedAt,correction:true,reason:'Заказ уже выдан, исправление учёта'});
  assert.equal(updated.status, 200); assert.equal(updated.body.order.note, 'Выдан');
  assert.equal((await call('/api/admin/orders', 'PUT', {id:orderId,status:'cancelled',note:'',updatedAt:orders.orders[0].updatedAt})).status, 409, 'stale changes cannot overwrite another administrator');
  const filtered = (await call('/api/admin/orders?status=completed')).body;
  assert.equal(filtered.total, 1); assert.equal(filtered.summary.completed, 1); assert.equal(filtered.summary.new, 0);
  assert.equal((await accounts.pool.query("select count(*)::int as count from admin_log where action='order'")).rows[0].count, 1);
  const adminSession = session;
  session = '';
  assert.equal((await call('/api/admin/orders')).status, 401);
  await call('/api/auth/login', 'POST', {login:'anna@example.ru',password:'password-1'});
  assert.equal((await call('/api/admin/orders')).status, 401, 'orders stay private to staff');
  assert.equal((await call('/api/admin/orders', 'PUT', {id:orderId,status:'cancelled',note:'',updatedAt:updated.body.order.updatedAt})).status, 401);
  session = adminSession;

  // A card's own content: an uploaded certificate scan is served back; name and photo reach every page via /api/site.
  const png=await sharp({create:{width:2,height:2,channels:4,background:{r:100,g:150,b:200,alpha:.5}}}).png().toBuffer();
  const up = await fetch(base + '/api/admin/upload?product=alfalfa&kind=document&name=scan.png', { method: 'POST', headers: { 'Content-Type': 'image/png', Origin: base, Cookie: session }, body: png });
  assert.equal(up.status, 201);
  const file = await up.json();
  assert.match(file.url, /^\/api\/files\/[a-f0-9]{32}\.webp$/);
  assert.equal((await fetch(base + '/api/admin/upload?product=alfalfa&kind=document', { method: 'POST', headers: { 'Content-Type': 'image/svg+xml', Origin: base, Cookie: session }, body: '<svg/>' })).status, 415, 'no SVG uploads');
  assert.equal((await fetch(base + '/api/admin/upload?product=alfalfa&kind=document', { method: 'POST', headers: { 'Content-Type': 'image/png', Cookie: session }, body: png })).status, 403, 'an upload needs our Origin');
  const served = await fetch(base + file.url);
  assert.equal(served.headers.get('content-type'), 'image/webp');
  const decoded=await sharp(Buffer.from(await served.arrayBuffer())).raw().toBuffer();assert.deepEqual(decoded,await sharp(png).raw().toBuffer());
  assert.equal((await fetch(base+'/api/admin/upload?product=alfalfa&kind=image',{method:'POST',headers:{'Content-Type':'image/png',Origin:base,Cookie:session},body:'not an image'})).status,400,'decode input instead of trusting extension');
  const legacyId='d'.repeat(32);
  await accounts.pool.query('insert into files(id,product_id,kind,name,mime,size,data) values($1,$2,$3,$4,$5,$6,$7)',[legacyId,'alfalfa','image','legacy.png','image/png',png.length,png]);
  const legacy=await fetch(base+'/api/files/'+legacyId+'.webp');assert.equal(legacy.status,200);assert.equal(legacy.headers.get('content-type'),'image/webp');assert.equal((await sharp(Buffer.from(await legacy.arrayBuffer())).metadata()).format,'webp');
  assert.equal((await accounts.pool.query('select mime from files where id=$1',[legacyId])).rows[0].mime,'image/png','legacy source retained');
  assert.equal((await call('/api/admin/content', 'PUT', { productId: 'alfalfa', content: { name: 'X' } })).status, 400);
  assert.equal((await call('/api/admin/content', 'PUT', { productId: 'alfalfa', content: { documents: [{ name: 'evil', url: 'https://evil.example/x.png' }] } })).status, 400);
  assert.equal((await call('/api/admin/content', 'PUT', { productId: 'alfalfa', content: { name: 'Люцерна новая', about: ['Первый абзац.'], properties: { 'Применение': 'По одной капсуле.' }, documents: [file], image: file.url } })).body.cards.alfalfa.name, 'Люцерна новая');
  const card = (await call('/api/product-content?id=alfalfa')).body;
  assert.deepEqual(card.content.documents, [file]);
  assert.equal(card.content.properties['Применение'], 'По одной капсуле.');
  assert.deepEqual((await call('/api/site')).body.cards.alfalfa, { name: 'Люцерна новая', image: file.url });
  // Media edits are independent of the description and support intentional empty lists.
  assert.equal((await call('/api/admin/content','PUT',{productId:'alfalfa',content:{photos:[file.url],videos:[{url:'https://youtu.be/bNT7e_FykCE',title:'О продукте'}]}})).status,200);
  const withMedia=(await call('/api/product-content?id=alfalfa')).body.content;
  assert.deepEqual(withMedia.photos,[file.url]);
  assert.equal(withMedia.videos[0].title,'О продукте');
  assert.equal(withMedia.name,'Люцерна новая');
  assert.deepEqual(withMedia.documents,[file]);
  assert.equal((await call('/api/admin/content','PUT',{productId:'alfalfa',content:{photos:[file.url],documents:[],videos:[]}})).status,200);
  const withoutMedia=(await call('/api/product-content?id=alfalfa')).body.content;
  assert.deepEqual(withoutMedia.photos,[file.url]);assert.deepEqual(withoutMedia.documents,[]);assert.deepEqual(withoutMedia.videos,[]);
  assert.equal(withoutMedia.image,file.url);
  assert.deepEqual(withoutMedia.about,['Первый абзац.']);
  assert.equal((await call('/api/site')).body.cards.alfalfa.image,file.url);
  assert.equal((await call('/api/admin/content','PUT',{productId:'alfalfa',content:{photos:[]}})).status,400,'a product must retain at least one photo');
  assert.equal((await call('/api/admin/content','PUT',{productId:'alfalfa',content:{photos:['https://evil.example/x.jpg']}})).status,400);
  assert.equal((await call('/api/admin/content','PUT',{productId:'alfalfa',content:{videos:[{url:'javascript:alert(1)',title:'Видео'}]}})).status,400);
  assert.equal((await call('/api/admin/content', 'PUT', { productId: 'alfalfa', reset: true })).status, 200);
  assert.equal((await call('/api/product-content?id=alfalfa')).body.content, null);
});

test('site settings recompute rubles from у.е. and never compound', () => {
  const product = () => ({ id: 'a', availability: 'InStock', availability_text: 'В наличии', prices: { retail: 940, partner: 705, source: 'price-list', units: { retail: 10, partner: 7.5 } } });
  const p = product(), q = { ...product(), id: 'b', prices: { retail: 500, partner: null, source: 'snapshot' } };
  const site = { rate: { rubPerUnit: 96 }, products: { b: { retailUnits: null, partnerUnits: null, retailRub: 450, partnerRub: null, availability: 'OutOfStock' } }, hiddenNotes: { a: ['Врач|Лекция|Текст'] } };
  applySite([p, q], site, 94);
  assert.deepEqual([p.prices.retail, p.prices.partner], [960, null], 'without the server card prices nobody sees a card price');
  applySite([p, q], site, 94, { prices: { a: 720 } });
  assert.deepEqual([p.prices.retail, p.prices.partner, q.prices.partner], [960, 720, null], 'a card holder gets the server card prices');
  assert.deepEqual([q.prices.retail, q.availability, q.availability_text], [450, 'OutOfStock', 'Нет в наличии']);
  applySite([p, q], site, 94);
  assert.equal(p.prices.retail, 960, 'applying twice gives the same price');
  applySite([p, q], { ...site, products: { a: { retailUnits: 12, partnerUnits: null, retailRub: null, partnerRub: null, availability: null } } }, 94);
  assert.deepEqual([p.prices.retail, q.prices.retail, q.availability], [1152, 500, 'InStock']);
  applySite([p, q], null, 94);
  assert.deepEqual([p.prices.retail, p.prices.partner], [940, null], 'no settings: the built retail price, no card price');
  const notes = [{ speaker: 'Врач', lecture: 'Лекция', text: 'Текст', role: '', course: '' }, { speaker: 'Другой', lecture: 'Лекция', text: 'Текст', role: '', course: '' }];
  assert.equal(noteKey(notes[0]), 'Врач|Лекция|Текст');
  assert.deepEqual(visibleNotes('a', notes, site).map(n => n.speaker), ['Другой']);
});

test('a card\'s own content replaces only what is set and can be taken back', () => {
  const p = { id: 'a', name: 'Люцерна', copy: { about: ['Было.'], highlights: ['Пункт'] }, properties: { 'Применение': 'Было', 'Состав': 'Люцерна' }, documents: [{ name: 'стр.1', size: '1 КБ', url: '/media/a.jpg' }] };
  applyContent(p, { name: 'Новая', about: ['Стало.'], properties: { 'Применение': 'Стало', 'Состав': '' }, documents: [], image: '/api/files/' + 'a'.repeat(32) });
  assert.deepEqual([p.name, p.copy.about, p.copy.highlights, p.properties, p.documents.length, p.adminImage], ['Новая', ['Стало.'], ['Пункт'], { 'Применение': 'Стало' }, 0, '/api/files/' + 'a'.repeat(32)]);
  applyContent(p, null);
  assert.deepEqual([p.name, p.copy.about, p.properties['Состав'], p.documents.length], ['Люцерна', ['Было.'], 'Люцерна', 1]);
});

test('admin products: a section as on the site and a search by name or article within it', () => {
  const code = readFileSync(new URL('../apps/admin/admin.tsx', import.meta.url), 'utf8');
  assert.ok(code.includes("return visit('/catalog/');"));
  assert.match(code, /<option value="">Все разделы<\/option>/);
  assert.match(code, /data\.products\.filter\(p => \(!inSection \|\| inSection\.has\(p\.path\)\) && words\.every\(w => `\$\{p\.name\} \$\{p\.article \?\? ''\}`\.toLowerCase\(\)\.includes\(w\)\)\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCdek } from '../scripts/cdek.mjs';

// The checkout's CDEK map asks the server, which alone holds the CDEK keys (scripts/cdek.mjs).
function call(cdek, path, { method = 'GET', body } = {}) {
  return new Promise(resolve => {
    const headers = {}; let status = 0;
    const res = { setHeader: (k, v) => { headers[k] = v; }, writeHead: (c, h) => { status = c; Object.assign(headers, h); }, end: text => resolve({ status, headers, body: text ? JSON.parse(text) : null }) };
    const req = { method, socket: { remoteAddress: 'test' }, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(JSON.stringify(body)); } };
    cdek.handle(req, res, new URL(path, 'http://x'));
  });
}

test('without keys the map is off and nothing reaches CDEK', async () => {
  const cdek = createCdek({ clientId: '', clientSecret: '', yandexKey: '', fetchImpl: () => { throw new Error('no call'); } });
  assert.deepEqual((await call(cdek, '/api/cdek?action=config')).body, { enabled: false, yandexKey: '' });
  assert.equal((await call(cdek, '/api/cdek?action=offices')).status, 503);
});

test('pickup points and prices go through the shop server with its token; unknown actions are refused', async () => {
  const seen = [];
  const fetchImpl = async (url, init = {}) => { seen.push([url, init.method ?? 'GET', init.headers?.Authorization]); if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 't1', expires_in: 3600 })); return new Response('[{"code":"SPB1"}]', { headers: { 'x-total-elements': '1' } }); };
  const cdek = createCdek({ clientId: 'id', clientSecret: 'secret', yandexKey: 'ya', base: 'https://cdek.test/v2', fetchImpl });
  assert.deepEqual((await call(cdek, '/api/cdek?action=config')).body, { enabled: true, yandexKey: 'ya' });
  const offices = await call(cdek, '/api/cdek?action=offices&city_code=137');
  assert.equal(offices.status, 200);
  assert.deepEqual(offices.body, [{ code: 'SPB1' }]);
  assert.equal(offices.headers['x-total-elements'], '1');
  assert.ok(seen.some(([u, m, a]) => u === 'https://cdek.test/v2/deliverypoints?city_code=137' && m === 'GET' && a === 'Bearer t1'));
  await call(cdek, '/api/cdek?action=calculate', { method: 'POST', body: { to_location: { code: 44 } } });
  assert.ok(seen.some(([u, m]) => u === 'https://cdek.test/v2/calculator/tarifflist' && m === 'POST'));
  assert.equal(seen.filter(([u]) => u.endsWith('/oauth/token')).length, 1, 'the token is reused');
  assert.equal((await call(cdek, '/api/cdek?action=orders')).status, 400);
});

test('pickup rate limits distinguish customers behind the web proxy', async () => {
  const cdek=createCdek({clientId:'test',clientSecret:'test',yandexKey:'test',fetchImpl:()=>{throw new Error('unexpected outbound request');}});
  const ask=ip=>new Promise(resolve=>{
    const req={method:'GET',headers:{'x-forwarded-for':ip},socket:{remoteAddress:'127.0.0.1'}};
    const res={setHeader(){},writeHead(status){this.status=status;},end(){resolve(this.status);}};
    cdek.handle(req,res,new URL('http://x/api/cdek?action=unknown'));
  });
  for(let i=0;i<120;i++)assert.equal(await ask('192.0.2.1'),400);
  assert.equal(await ask('192.0.2.1'),429);
  assert.equal(await ask('192.0.2.2'),400);
});

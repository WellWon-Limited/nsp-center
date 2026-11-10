import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { buildCorpus, buildIndex, createAi, expandQuery, parseAnswer, retrieve, yandexProvider } from '../scripts/ai-agent.mjs';
import { readContent } from '../scripts/check-content.mjs';

const content = readContent();
const index = buildIndex(buildCorpus(content));

test('the agent finds the doctors\' material for everyday questions', () => {
  const first = q => retrieve(index, expandQuery(q), 4);
  assert.ok(first('плохо сплю, тревожно').some(f => f.products.some(id => ['magnesium-complex', 'hvp', '5-htp-power'].includes(id))), 'sleep finds magnesium, HVP or 5-HTP');
  assert.ok(first('для чего нужен витамин D3').some(f => f.products.includes('vitamin-d3')));
  assert.ok(first('тяжесть после еды и вздутие').some(f => f.products.includes('food-enzymes')));
  for (const f of first('часто простужаюсь')) assert.ok(f.source === null || typeof f.source.lecture === 'string');
});

test('the answer keeps only known products and cited sources, and flags treatment claims', () => {
  const fragments = [{ source: { speaker: 'Ю. Лысиков', lecture: 'Сон' } }, { source: { speaker: 'Е. Бахтина', lecture: 'Стресс' } }];
  const parsed = parseAnswer('Попробуйте магний.\nТОВАРЫ: magnesium-complex, made-up-id\nИСТОЧНИКИ: 2', fragments, new Set(['magnesium-complex']));
  assert.deepEqual(parsed, { text: 'Попробуйте магний.', products: ['magnesium-complex'], sources: [{ speaker: 'Е. Бахтина', lecture: 'Стресс' }], unsafe: false });
  assert.equal(parseAnswer('Это вылечит бессонницу.\nТОВАРЫ: нет', [], new Set()).unsafe, true);
});

test('YandexGPT is called with the API key, the model URI and the rules as the system message', async () => {
  let call;
  const provider = yandexProvider({ apiKey: 'secret', folderId: 'b1gfolder', fetchImpl: async (url, init) => { call = { url, init: { ...init, body: JSON.parse(init.body) } }; return new Response(JSON.stringify({ result: { alternatives: [{ message: { role: 'assistant', text: 'Ответ' }, status: 'ALTERNATIVE_STATUS_FINAL' }], usage: { inputTextTokens: '120', completionTokens: '30', totalTokens: '150' } } }), { status: 200 }); } });
  const out = await provider([{ role: 'system', text: 'Правила' }, { role: 'user', text: 'Вопрос' }]);
  assert.equal(call.url, 'https://ai.api.cloud.yandex.net/foundationModels/v1/completion');
  assert.equal(call.init.headers.Authorization, 'Api-Key secret');
  assert.equal(call.init.body.modelUri, 'gpt://b1gfolder/yandexgpt-5.1');
  assert.equal(call.init.body.messages[0].role, 'system');
  assert.deepEqual(out, { text: 'Ответ', inputTokens: 120, outputTokens: 30 });
});

test('the agent endpoint: off without a key, safe answers, limits, fallback on a bad answer', async t => {
  const off = createAi({ content, env: {} });
  assert.equal(off.enabled, false);
  let reply = 'Магний поддерживает нервную систему.\nТОВАРЫ: magnesium-complex\nИСТОЧНИКИ: 1';
  let calls = 0;
  const ai = createAi({ content, env: { AI_DAILY_LIMIT: '3' }, provider: async messages => { calls++; assert.match(messages[0].text, /Не ставь диагнозы|ставить диагнозы/); return { text: reply, inputTokens: 100, outputTokens: 20 }; } });
  const server = createServer((req, res) => ai.handle(req, res, new URL(req.url, 'http://x')));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const ask = message => fetch(base + '/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }).then(async r => ({ status: r.status, body: await r.json() }));
  assert.deepEqual((await fetch(base + '/api/ai/status').then(r => r.json())).enabled, true);
  const good = await ask('Плохо сплю и тревожно');
  assert.equal(good.status, 200);
  assert.deepEqual(good.body.products, ['magnesium-complex']);
  assert.ok(good.body.sources.length <= 2);
  const urgent = await ask('У меня температура 39 и болит в груди');
  assert.match(urgent.body.text, /103 или 112/);
  assert.equal(calls, 1, 'warning signs never reach the model');
  reply = 'Магний вылечит бессонницу.\nТОВАРЫ: magnesium-complex';
  assert.match((await ask('А магний?')).body.text, /специалист/);
  assert.equal((await ask('Ещё вопрос')).status, 200);
  assert.equal((await ask('И ещё')).status, 429, 'the daily limit per address');
  assert.equal((await fetch(base + '/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 403);
});

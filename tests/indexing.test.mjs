import test from 'node:test';
import assert from 'node:assert/strict';
import { isIndexableHost, BLOCKED_ROBOTS } from '../scripts/indexing.mjs';

test('Only the production domain is open to search engines', () => {
  for (const host of ['nsp-center.ru', 'www.nsp-center.ru', 'NSP-Center.ru', 'nsp-center.ru:443']) assert.equal(isIndexableHost(host), true, host);
  for (const host of ['nsp-center.dev.codimax.ru', '127.0.0.1:5217', 'localhost', 'nsp-center.ru.evil.example', 'evilnsp-center.ru', '', undefined]) assert.equal(isIndexableHost(host), false, String(host));
});

test('Every other host serves a robots.txt that blocks the whole site', () => {
  assert.match(BLOCKED_ROBOTS, /^User-agent: \*\nDisallow: \/\n$/);
});

test('A running non-production server blocks indexing on pages, redirects and robots.txt', { skip: !process.env.NSP_TEST_URL }, async () => {
  const get = (path) => fetch(new URL(path, process.env.NSP_TEST_URL), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  const robots = await get('/robots.txt');
  assert.equal(robots.status, 200);
  assert.equal(await robots.text(), BLOCKED_ROBOTS);
  for (const path of ['/', '/catalog', '/app-prototype/', '/no-such-page/']) {
    const response = await get(path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', path);
  }
});

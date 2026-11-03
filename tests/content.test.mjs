import test from 'node:test';
import assert from 'node:assert/strict';
import { auditContent, readContent, readSource } from '../scripts/check-content.mjs';

for (const { name, issues } of auditContent()) {
  test(name, () => assert.deepEqual(issues, [], issues.join('\n')));
}

test('The content gate rejects realistic content-loss and unsafe-HTML regressions', () => {
  const fixture = structuredClone(readContent());
  const source = readSource();
  fixture.routes = fixture.routes.filter((route) => !route.url.includes('?PAGEN_1=2'));
  fixture.products[0].price += 1;
  fixture.products[0].properties = {};
  fixture.products[0].images[0] = '/media/missing-certificate.jpg';
  const category = fixture.categories.find((item) => item.products.length > 0);
  category.products.pop();
  const articlePaths = new Set(fixture.articles.map((article) => article.path));
  fixture.routes.filter((route) => articlePaths.has(route.path)).forEach((route) => { route.title = 'Блог'; });
  fixture.articles[0].html += '<h1>Duplicate title</h1><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">Bad</a><a href="/missing-route/">Broken</a>';
  const oldPath = new URL(source.audit.broken_links[0].url).pathname;
  delete fixture.redirects[oldPath];
  const failedChecks = auditContent(fixture, source).filter((check) => check.issues.length).map((check) => check.name);
  for (const expected of [
    'Snapshot contract', 'All 166 products', 'All source product images', 'All 17 categories',
    'Articles and informational', 'The 13 old product', 'Imported rich HTML', 'Imported internal links',
  ]) assert.ok(failedChecks.some((name) => name.startsWith(expected)), `Gate missed regression: ${expected}`);
});

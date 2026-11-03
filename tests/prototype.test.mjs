import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { adaptPrototype, readTemplate, ORIGINAL_PROTOTYPE } from '../scripts/prototype-adapter.mjs';

const root = resolve(import.meta.dirname, '..');
const original = readFileSync(resolve(root, ORIGINAL_PROTOTYPE), 'utf8');
const adapted = adaptPrototype(original);
const before = readTemplate(original);
const after = readTemplate(adapted);
const component = (template) => template.slice(template.indexOf('<script type="text/x-dc"'));

test('The adapted prototype drops the drawn phone, caption and fake status bar', () => {
  assert.match(before, /width:390px;height:844px;border-radius:54px/);
  assert.doesNotMatch(after, /width:390px;height:844px/);
  assert.doesNotMatch(after, /border-radius:44px;overflow:hidden/);
  assert.doesNotMatch(after, /letter-spacing:\.04em">[^<]*<\/div>/, 'Caption above the phone must be gone');
  assert.doesNotMatch(after, /<span>9:41<\/span>/, 'Fake status bar must be gone; the device frame draws the real one');
  assert.match(after, /viewport-fit=cover/);
  assert.match(after, /env\(safe-area-inset-top/);
  assert.match(after, /safe-area-inset-top,0px\) - 48px\)\);overflow:clip;/, 'Screen must clip, not scroll, the off-edge background blobs');
});

test('The adapted prototype keeps every screen, behaviour and resource of the original', () => {
  const brokenSetPhoto = "imgBg: p.set ? 'url(uploads/pasted-1790409141694-0.png) 72% 45%/auto 135% #dfeee0'";
  const bundledSetPhoto = "imgBg: p.set ? `url(${(window.__resources&&window.__resources.setsImg)||'uploads/pasted-1790409141694-0.png'}) 72% 45%/auto 135% #dfeee0`";
  assert.ok(component(after).includes(bundledSetPhoto), 'Catalog set cards must use the bundled set photo');
  assert.equal(component(after).replace(bundledSetPhoto, brokenSetPhoto), component(before), 'Component logic must be unchanged apart from the set photo source');
  for (const screen of ['isHome', 'isCatalog', 'isChat', 'isHealth', 'isProfile']) assert.match(after, new RegExp(`\\{\\{ ${screen} \\}\\}`));
  const manifest = (html) => html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1];
  assert.equal(manifest(adapted), manifest(original));
  assert.doesNotMatch(adapted.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1], /<\//, 'Template island must not close its script tag early');
});

test('Benign ResizeObserver notices are filtered before the bundle error banner listens', () => {
  const guard = adapted.indexOf('ResizeObserver loop');
  const banner = adapted.indexOf("window.addEventListener('error'");
  assert.ok(guard > 0 && guard < banner, 'Guard must be registered before the bundle banner listener');
  assert.equal(adaptPrototype(original), adapted, 'Adaptation must be deterministic');
});

test('The local server serves the adapted prototype and the untouched original; the build publishes neither', { skip: !process.env.NSP_TEST_URL }, async () => {
  const get = (path) => fetch(new URL(path, process.env.NSP_TEST_URL), { signal: AbortSignal.timeout(10000) });
  const app = await get('/app-prototype/');
  assert.equal(app.status, 200);
  assert.match(app.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(await app.text(), adapted);
  const source = await get('/app-prototype/original/');
  assert.equal(source.status, 200);
  assert.ok(Buffer.from(await source.arrayBuffer()).equals(readFileSync(resolve(root, ORIGINAL_PROTOTYPE))));
  assert.equal(existsSync(resolve(root, 'dist/app-prototype')), false);
});
